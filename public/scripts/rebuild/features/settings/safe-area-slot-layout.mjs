import { SAFE_POSITION_STYLES } from './safe-area-constants.mjs';
import { formatSafeSlotLabel } from './safe-area-labels.mjs';
export { formatSafeSlotLabel } from './safe-area-labels.mjs';


export function resolveSafeAreaSlotLayout(p = {}) {
  const normalize = (value, fallback) => SAFE_POSITION_STYLES[value] ? value : fallback;
  const out = {
    clock: normalize(p.safeClockPos || 'left', 'left'),
    progress: normalize(p.safeProgressPos || 'right', 'right'),
    network: normalize(p.safeNetworkPos || 'auto', 'auto')
  };
  const clockVisible = p.showClock !== false;
  const progressVisible = p.showProgress !== false;
  const networkVisible = p.showNetwork !== false;
  const occupied = new Set();
  if (clockVisible) occupied.add(out.clock);
  if (progressVisible && occupied.has(out.progress)) out.progress = out.clock === 'right' ? 'left' : 'right';
  if (progressVisible) occupied.add(out.progress);
  if (networkVisible && occupied.has(out.network)) {
    const fallbacks = ['right-inner','left-inner','auto','center','right','left'];
    out.network = fallbacks.find(pos => !occupied.has(pos)) || out.network;
  }
  out.collisionGuard = [clockVisible ? out.clock : '', progressVisible ? out.progress : '', networkVisible ? out.network : '']
    .filter(Boolean)
    .join('|');
  return out;
}


export function applySafeAreaSlotState(app, layout = {}) {
  const bar = app?.els?.safeAreaBar || document.getElementById('safe-area-bar');
  if (!bar) return;
  const slotSummary = ['clock', 'network', 'progress']
    .map(key => `${key}:${layout[key] || 'off'}`)
    .join('|');
  bar.dataset.safeLayoutGuard = 'v140';
  bar.dataset.safeQualityPass = 'v140';
  bar.dataset.safeCollisionGuard = layout.collisionGuard || '';
  bar.dataset.safeSlotSummary = slotSummary;
  bar.dataset.safeNetworkPlacement = layout.network || 'auto';
  bar.style.setProperty('--safe-inner-offset', 'clamp(72px,18vw,112px)');
  bar.style.setProperty('--safe-network-max', layout.network === 'center' ? 'min(28vw,150px)' : 'min(32vw,190px)');
}


export function applySafeElement(el, visible, position, slotName = '') {
  if (!el) return;
  const normalizedPosition = SAFE_POSITION_STYLES[position] ? position : 'auto';
  el.style.display = visible ? 'inline-flex' : 'none';
  el.dataset.safeVisible = visible ? 'true' : 'false';
  el.dataset.safePosition = normalizedPosition;
  if (slotName) {
    const slotLabel = formatSafeSlotLabel(slotName, normalizedPosition);
    el.dataset.safeSlotResolved = slotName;
    el.dataset.safeSlotLabel = slotLabel;
    el.setAttribute('aria-label', slotLabel);
  }
  el.setAttribute('aria-hidden', visible ? 'false' : 'true');
  const style = SAFE_POSITION_STYLES[normalizedPosition] || SAFE_POSITION_STYLES.auto;
  el.style.left = style.left;
  el.style.right = style.right;
  el.style.transform = style.transform;
}
