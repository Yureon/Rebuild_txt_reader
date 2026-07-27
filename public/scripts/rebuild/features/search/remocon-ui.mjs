import { clamp } from '../../core/utils.mjs';
import { saveLocal } from '../../core/storage.mjs';

export const SEARCH_REMOCON_UI_SPLIT_PASS = 'v198-search-remocon-ui-split-pass';
const SEARCH_REMOCON_VIEWPORT_CLAMP_PASS = 'v146-search-remocon-viewport-clamp-pass';

export function installSearchRemoteDrag(app, on) {
  const remote = app.els.searchNavRemote;
  const handle = remote?.querySelector?.('.search-nav-remote-main');
  if (!remote || !handle) return;
  remote.dataset.searchRemoconStabilityPass = SEARCH_REMOCON_VIEWPORT_CLAMP_PASS;
  let drag = null;
  const startDrag = ev => {
    if (ev.button != null && ev.button !== 0) return;
    drag = {
      pointerId: ev.pointerId,
      startX: ev.clientX,
      startY: ev.clientY,
      startLeft: remote.getBoundingClientRect().left,
      startTop: remote.getBoundingClientRect().top,
      moved: false
    };
    remote.classList.add('dragging');
    handle.setPointerCapture?.(ev.pointerId);
    ev.preventDefault();
  };
  const moveDrag = ev => {
    if (!drag || ev.pointerId !== drag.pointerId) return;
    const dx = ev.clientX - drag.startX;
    const dy = ev.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    const rect = remote.getBoundingClientRect();
    const bounds = getRemoteBounds(app, rect);
    const left = clamp(drag.startLeft + dx, bounds.minLeft, bounds.maxLeft);
    const top = clamp(drag.startTop + dy, bounds.minTop, bounds.maxTop);
    setRemotePosition(app, { left, top });
  };
  const endDrag = ev => {
    if (!drag || ev.pointerId !== drag.pointerId) return;
    remote.classList.remove('dragging');
    if (drag.moved) saveLocal('searchRemotePosition', app.state.search.remotePosition || null);
    handle.releasePointerCapture?.(ev.pointerId);
    drag = null;
  };
  const resetPosition = ev => {
    ev.preventDefault();
    app.state.search.remotePosition = null;
    saveLocal('searchRemotePosition', null);
    applyRemotePosition(app);
  };
  on(handle, 'pointerdown', startDrag);
  on(handle, 'dblclick', resetPosition);
  on(window, 'pointermove', moveDrag, { passive: false });
  on(window, 'pointerup', endDrag);
  const scheduleClamp = () => scheduleSearchRemoteViewportClamp(app);
  on(window, 'resize', scheduleClamp, { passive: true });
  on(window, 'orientationchange', scheduleClamp, { passive: true });
  on(window, 'txt-reader-viewport-fit', scheduleClamp);
  if (window.visualViewport) {
    on(window.visualViewport, 'resize', scheduleClamp, { passive: true });
    on(window.visualViewport, 'scroll', scheduleClamp, { passive: true });
  }
  applyRemotePosition(app);
  scheduleClamp();
}

export function setRemotePosition(app, position) {
  app.state.search.remotePosition = position;
  applyRemotePosition(app);
}

export function scheduleSearchRemoteViewportClamp(app) {
  if (!app?.state?.search) return;
  if (app.state.search.remoteClampRaf) return;
  app.state.search.remoteClampRaf = requestAnimationFrame(() => {
    app.state.search.remoteClampRaf = 0;
    applyRemotePosition(app);
  });
}

export function applyRemotePosition(app) {
  const remote = app.els.searchNavRemote;
  if (!remote) return;
  const pos = app.state.search.remotePosition;
  if (!pos || !Number.isFinite(Number(pos.left)) || !Number.isFinite(Number(pos.top))) {
    remote.classList.remove('has-custom-pos');
    remote.style.left = '';
    remote.style.top = '';
    remote.style.bottom = '';
    remote.style.transform = '';
    return;
  }
  const rect = remote.getBoundingClientRect();
  const bounds = getRemoteBounds(app, rect);
  const left = clamp(Number(pos.left), bounds.minLeft, bounds.maxLeft);
  const top = clamp(Number(pos.top), bounds.minTop, bounds.maxTop);
  app.state.search.remotePosition = { left, top };
  remote.classList.add('has-custom-pos');
  remote.style.left = `${left}px`;
  remote.style.top = `${top}px`;
  remote.style.bottom = 'auto';
  remote.style.transform = 'none';
}

export function getRemoteBounds(app, rect) {
  const vv = window.visualViewport || null;
  const offsetLeft = Number(vv?.offsetLeft) || 0;
  const offsetTop = Number(vv?.offsetTop) || 0;
  const width = Math.max(1, Number(vv?.width) || window.innerWidth || document.documentElement.clientWidth || 1);
  const height = Math.max(1, Number(vv?.height) || window.innerHeight || document.documentElement.clientHeight || 1);
  const remote = app?.els?.searchNavRemote || null;
  const rectWidth = Math.max(1, Number(rect?.width) || Number(remote?.offsetWidth) || 320);
  const rectHeight = Math.max(1, Number(rect?.height) || Number(remote?.offsetHeight) || 56);
  const safeBottom = Math.max(0, Number(app?.state?.viewportFit?.safeBottomExtra) || 0);
  const safeTop = Math.max(0, Number(app?.state?.viewportFit?.safeTopExtra) || 0);
  const minLeft = Math.round(offsetLeft + 8);
  const minTop = Math.round(offsetTop + 8 + Math.min(safeTop, 80));
  const maxLeft = Math.max(minLeft, Math.round(offsetLeft + width - rectWidth - 8));
  const maxTop = Math.max(minTop, Math.round(offsetTop + height - rectHeight - 8 - Math.min(safeBottom, 160))); 
  return { minLeft, minTop, maxLeft, maxTop };
}
