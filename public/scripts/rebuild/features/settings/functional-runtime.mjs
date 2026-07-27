import { clamp } from '../../core/utils.mjs';
import { normalizeSafeViewportProfiles } from './safe-area-profiles.mjs';
import { applySafeAreaSlotState, applySafeElement, resolveSafeAreaSlotLayout } from './safe-area-slot-layout.mjs';

export const FUNCTIONAL_PREFS_RUNTIME_LAZY_PASS = 'v599-functional-prefs-runtime-lazy-pass';
export { normalizeSafeViewportProfiles };

function normalizeReaderEpisodeBoundaryMode(value) {
  const mode = String(value || 'manual');
  if (mode === 'scrollBeyond' || mode === 'scroll-beyond' || mode === 'scroll') return 'scrollBeyond';
  return 'manual';
}

export function normalizeFunctionalPrefs(p = {}) {
  if (p.safeClockShow !== undefined && p.showClock === undefined) p.showClock = !!p.safeClockShow;
  if (p.safeProgressShow !== undefined && p.showProgress === undefined) p.showProgress = !!p.safeProgressShow;
  if (p.tapNavEnabled === undefined) p.tapNavEnabled = true;
  if (!p.tapDirection) p.tapDirection = 'vertical';
  p.tapScrollPercent = clamp(p.tapScrollPercent == null ? 90 : p.tapScrollPercent, 30, 100);
  if (p.tapAnim === undefined) p.tapAnim = true;
  p.tapSpeed = clamp(p.tapSpeed == null ? 400 : p.tapSpeed, 100, 800);
  if (p.swipeNav === undefined) p.swipeNav = true;
  p.swipeThreshold = clamp(p.swipeThreshold == null ? 50 : p.swipeThreshold, 24, 100);
  p.readerEpisodeBoundaryMode = normalizeReaderEpisodeBoundaryMode(p.readerEpisodeBoundaryMode);
  delete p.libraryDndHoverOpenDelay;
  if (!p.safeClockPos) p.safeClockPos = 'left';
  if (!p.safeProgressPos) p.safeProgressPos = 'right';
  if (!p.safeNetworkPos) p.safeNetworkPos = 'auto';
  if (p.safeViewportAutoFit === undefined) p.safeViewportAutoFit = false;
  p.safeTopInsetExtra = clamp(p.safeTopInsetExtra == null ? 0 : p.safeTopInsetExtra, -12, 180);
  p.safeBottomInsetExtra = clamp(p.safeBottomInsetExtra == null ? 0 : p.safeBottomInsetExtra, -12, 240);
  p.safeViewportProfiles = normalizeSafeViewportProfiles(p.safeViewportProfiles || []);
  const selected = String(p.safeViewportProfileId || '').trim().slice(0, 80);
  p.safeViewportProfileId = p.safeViewportProfiles.some(profile => profile.id === selected) ? selected : '';
  if (!p.timezone) p.timezone = 'Asia/Seoul';
  p.timezoneOffset = clamp(p.timezoneOffset == null ? 540 : p.timezoneOffset, -720, 840);
  return p;
}

export function applyFunctionalPrefs(app) {
  const p = normalizeFunctionalPrefs(app?.state?.prefs || {});
  const safeSlots = resolveSafeAreaSlotLayout(p);
  applySafeElement(app?.els?.safeClock, p.showClock !== false, safeSlots.clock, 'clock');
  applySafeElement(app?.els?.safeProgress, p.showProgress !== false, safeSlots.progress, 'progress');
  applySafeElement(app?.els?.toolbarNetworkMode, p.showNetwork !== false, safeSlots.network, 'network');
  applySafeAreaSlotState(app, safeSlots);
  if (app?.els?.safeAreaBar?.dataset) app.els.safeAreaBar.dataset.safeRemaining = p.safeRemainingShow ? 'on' : 'off';
  document.body?.classList?.toggle('reduce-motion', Number(p.animationsMs) <= 0);
  app?.viewportFit?.refresh?.('prefs');
  return p;
}
