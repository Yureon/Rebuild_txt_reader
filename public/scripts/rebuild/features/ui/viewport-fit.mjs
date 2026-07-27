import { clamp } from '../../core/utils.mjs';
import { normalizeSafeViewportProfiles } from '../settings/functional-runtime.mjs';

const MOBILE_FULLSCREEN_TOP_FALLBACK = 18;
const MOBILE_FULLSCREEN_BOTTOM_FALLBACK = 18;
const MOBILE_FULLSCREEN_READER_NAV_GAP = 14;
const VIEWPORT_STABLE_DELTA_PX = 1;
const VIEWPORT_STABLE_REQUIRED = 3;
const SAFE_TOP_MIN = -12;
const SAFE_TOP_MAX = 180;
const SAFE_BOTTOM_MIN = -12;
const SAFE_BOTTOM_MAX = 240;
const SAFE_AREA_COLLISION_FIT_PASS = 'v462-safe-area-collision-fit-pass';
const SAFE_AREA_ITERATIVE_COLLISION_FIT_PASS = 'v464-safe-area-iterative-collision-fit-pass';
const SAFE_AREA_STRICT_COLLISION_TRIM_PASS = 'v465-safe-area-strict-collision-trim-pass';
const SAFE_AREA_BADGE_ONLY_COLLISION_PASS = 'v471-safe-area-badge-only-collision-pass';

export function installViewportFit(app, { on } = {}) {
  let scheduled = 0;
  const refresh = reason => {
    if (scheduled) window.cancelAnimationFrame?.(scheduled);
    scheduled = window.requestAnimationFrame?.(() => {
      scheduled = 0;
      applyViewportFit(app, reason);
    }) || 0;
    if (!scheduled) applyViewportFit(app, reason);
  };
  const refreshSeries = (reason, delays = [0, 120, 300, 700, 1200]) => {
    delays.forEach(delay => window.setTimeout(() => refresh(`${reason}-${delay}`), delay));
  };

  const listen = typeof on === 'function'
    ? on
    : (target, type, handler, options) => target?.addEventListener(type, handler, options);

  listen(window, 'resize', () => refresh('window-resize'), { passive: true });
  listen(window, 'orientationchange', () => refreshSeries('orientationchange', [0, 160, 360, 800]), { passive: true });
  listen(document, 'fullscreenchange', () => refreshSeries('fullscreenchange'));
  listen(document, 'webkitfullscreenchange', () => refreshSeries('webkitfullscreenchange'));
  listen(window, 'txt-reader-pseudo-fullscreen-change', () => refreshSeries('pseudo-fullscreen-change', [0, 80, 180, 360, 720]));
  listen(window, 'txt-reader-safe-area-content-change', () => scheduleSafeAreaCollisionFit(app, 'safe-area-content-change'));
  if (window.visualViewport) {
    listen(window.visualViewport, 'resize', () => refresh('visual-viewport-resize'), { passive: true });
    listen(window.visualViewport, 'scroll', () => refresh('visual-viewport-scroll'), { passive: true });
  }

  app.viewportFit = {
    refresh,
    measure: () => measureViewportFit(app)
  };
  refresh('install');
  return app.viewportFit;
}

export function applyViewportFit(app, reason = '') {
  const metrics = measureViewportFit(app);
  const root = document.documentElement;
  const body = document.body;
  const style = root.style;
  style.setProperty('--app-vh', `${metrics.visualHeight}px`);
  style.setProperty('--app-vw', `${metrics.visualWidth}px`);
  style.setProperty('--viewport-offset-top', `${metrics.offsetTop}px`);
  style.setProperty('--viewport-bottom-occlusion', `${metrics.bottomOcclusion}px`);
  style.setProperty('--safe-browser-top-extra', `${metrics.safeTopExtra}px`);
  style.setProperty('--safe-browser-bottom-extra', `${metrics.safeBottomExtra}px`);
  style.setProperty('--safe-browser-auto-top-extra', `${metrics.autoTopExtra}px`);
  style.setProperty('--safe-browser-auto-bottom-extra', `${metrics.autoBottomExtra}px`);
  style.setProperty('--reader-nav-gap', `${metrics.readerNavGap}px`);
  root.dataset.displayMode = metrics.displayMode;
  root.dataset.viewportFit = metrics.isBrowserFullscreen ? 'browser-fullscreen' : metrics.displayMode;
  body?.classList.toggle('browser-fullscreen-fit', metrics.isBrowserFullscreen);
  body?.classList.toggle('standalone-fit', metrics.isStandalone);
  app.state.viewportFit = recordViewportSample(app, { ...metrics, reason, updatedAt: Date.now() });
  applySafeAreaCollisionFit(app, app.state.viewportFit, reason);
  try { window.dispatchEvent(new CustomEvent('txt-reader-viewport-fit', { detail: app.state.viewportFit })); } catch {}
  return app.state.viewportFit;
}

export function measureViewportFit(app) {
  const vv = window.visualViewport || null;
  const layoutWidth = Math.max(1, Number(window.innerWidth) || document.documentElement.clientWidth || 1);
  const layoutHeight = Math.max(1, Number(window.innerHeight) || document.documentElement.clientHeight || 1);
  const visualWidth = Math.round(Math.max(1, Number(vv?.width) || layoutWidth));
  const visualHeight = Math.round(Math.max(1, Number(vv?.height) || layoutHeight));
  const offsetTop = Math.max(0, Math.round(Number(vv?.offsetTop) || 0));
  const bottomOcclusion = Math.max(0, Math.round(layoutHeight - visualHeight - offsetTop));
  const isStandalone = isStandaloneDisplay();
  const isFullscreen = !!document.fullscreenElement;
  const isCoarse = !!window.matchMedia?.('(pointer: coarse)')?.matches;
  const isNarrow = Math.min(layoutWidth, layoutHeight) <= 900;
  const isMobile = !!app?.isMobileProfile || isCoarse || isNarrow;
  const isBrowserFullscreen = isFullscreen && isMobile && !isStandalone;
  const displayMode = isStandalone ? 'standalone' : (isFullscreen ? 'fullscreen' : 'browser');
  const prefs = app?.state?.prefs || {};
  const context = buildSafeViewportContext({ displayMode, isStandalone, isBrowserFullscreen, isMobile });
  const activeProfile = findMatchingSafeViewportProfile(prefs, context);
  const selectedProfileId = String(prefs.safeViewportProfileId || '');
  const useLivePrefs = !!activeProfile && activeProfile.id === selectedProfileId;
  const source = useLivePrefs ? prefs : (activeProfile || prefs);
  const autoFit = source.safeViewportAutoFit === true;
  const manualTop = clamp(source.safeTopInsetExtra == null ? 0 : source.safeTopInsetExtra, SAFE_TOP_MIN, SAFE_TOP_MAX);
  const manualBottom = clamp(source.safeBottomInsetExtra == null ? 0 : source.safeBottomInsetExtra, SAFE_BOTTOM_MIN, SAFE_BOTTOM_MAX);
  const autoTopExtra = autoFit && isBrowserFullscreen ? MOBILE_FULLSCREEN_TOP_FALLBACK : 0;
  const autoBottomExtra = autoFit
    ? Math.max(bottomOcclusion, isBrowserFullscreen ? MOBILE_FULLSCREEN_BOTTOM_FALLBACK : 0)
    : 0;
  const safeTopExtra = Math.max(0, Math.round(autoTopExtra + manualTop));
  const safeBottomExtra = Math.max(0, Math.round(autoBottomExtra + manualBottom));
  const readerNavGap = isBrowserFullscreen ? Math.max(MOBILE_FULLSCREEN_READER_NAV_GAP, Math.round(safeBottomExtra * 0.45)) : 0;
  return {
    displayMode,
    isStandalone,
    isFullscreen,
    isBrowserFullscreen,
    isMobile,
    layoutWidth,
    layoutHeight,
    visualWidth,
    visualHeight,
    offsetTop,
    bottomOcclusion,
    autoFit,
    autoTopExtra,
    autoBottomExtra,
    manualTop,
    manualBottom,
    safeTopExtra,
    safeBottomExtra,
    readerNavGap,
    safeContextKey: context.key,
    safeContextLabel: context.label,
    activeSafeProfileId: activeProfile?.id || '',
    activeSafeProfileName: activeProfile?.name || '',
    activeSafeProfileContextKey: activeProfile?.contextKey || '',
    selectedSafeProfileId: selectedProfileId,
    safeProfileReentryReady: !!activeProfile,
    usingLiveSafePrefs: useLivePrefs
  };
}

function recordViewportSample(app, metrics) {
  const state = app?.state || {};
  const sample = {
    visualWidth: metrics.visualWidth,
    visualHeight: metrics.visualHeight,
    layoutHeight: metrics.layoutHeight,
    offsetTop: metrics.offsetTop,
    bottomOcclusion: metrics.bottomOcclusion,
    isBrowserFullscreen: metrics.isBrowserFullscreen,
    displayMode: metrics.displayMode,
    ts: metrics.updatedAt || Date.now(),
    reason: metrics.reason || ''
  };
  const history = Array.isArray(state.viewportFitSamples) ? state.viewportFitSamples.slice(-7) : [];
  history.push(sample);
  state.viewportFitSamples = history.slice(-8);
  const recent = state.viewportFitSamples.slice(-VIEWPORT_STABLE_REQUIRED);
  let stable = recent.length >= VIEWPORT_STABLE_REQUIRED;
  if (stable) {
    for (let i = 1; i < recent.length; i += 1) {
      const prev = recent[i - 1];
      const cur = recent[i];
      if (Math.abs(cur.visualHeight - prev.visualHeight) > VIEWPORT_STABLE_DELTA_PX ||
          Math.abs(cur.visualWidth - prev.visualWidth) > VIEWPORT_STABLE_DELTA_PX ||
          Math.abs(cur.offsetTop - prev.offsetTop) > VIEWPORT_STABLE_DELTA_PX ||
          Math.abs(cur.bottomOcclusion - prev.bottomOcclusion) > VIEWPORT_STABLE_DELTA_PX ||
          cur.isBrowserFullscreen !== prev.isBrowserFullscreen ||
          cur.displayMode !== prev.displayMode) {
        stable = false;
        break;
      }
    }
  }
  const stableCount = stable ? recent.length : countStableTail(state.viewportFitSamples);
  return {
    ...metrics,
    sampleCount: state.viewportFitSamples.length,
    stableCount,
    isStable: stable || stableCount >= VIEWPORT_STABLE_REQUIRED,
    recentSamples: state.viewportFitSamples.slice(-5)
  };
}

function countStableTail(samples = []) {
  if (!samples.length) return 0;
  let count = 1;
  for (let i = samples.length - 1; i > 0; i -= 1) {
    const cur = samples[i];
    const prev = samples[i - 1];
    if (Math.abs(cur.visualHeight - prev.visualHeight) <= VIEWPORT_STABLE_DELTA_PX &&
        Math.abs(cur.visualWidth - prev.visualWidth) <= VIEWPORT_STABLE_DELTA_PX &&
        Math.abs(cur.offsetTop - prev.offsetTop) <= VIEWPORT_STABLE_DELTA_PX &&
        Math.abs(cur.bottomOcclusion - prev.bottomOcclusion) <= VIEWPORT_STABLE_DELTA_PX &&
        cur.isBrowserFullscreen === prev.isBrowserFullscreen &&
        cur.displayMode === prev.displayMode) count += 1;
    else break;
  }
  return count;
}

export function scheduleSafeAreaCollisionFit(app, reason = '') {
  if (!app) return;
  const state = app.state || (app.state = {});
  if (state.safeAreaCollisionFitRaf) return;
  const run = () => {
    state.safeAreaCollisionFitRaf = 0;
    applySafeAreaCollisionFit(app, state.viewportFit || {}, reason || 'scheduled');
  };
  state.safeAreaCollisionFitRaf = window.requestAnimationFrame?.(run) || 0;
  if (!state.safeAreaCollisionFitRaf) run();
}

function applySafeAreaCollisionFit(app, metrics = {}, reason = '') {
  const bar = app?.els?.safeAreaBar || document.getElementById('safe-area-bar');
  if (!bar) return;
  const slots = {
    clock: app?.els?.safeClock || document.getElementById('safe-clock'),
    network: app?.els?.toolbarNetworkMode || document.getElementById('toolbar-network-mode'),
    progress: app?.els?.safeProgress || document.getElementById('safe-progress')
  };
  bar.dataset.safeCollisionFitPass = SAFE_AREA_COLLISION_FIT_PASS;
  bar.dataset.safeIterativeCollisionFitPass = SAFE_AREA_ITERATIVE_COLLISION_FIT_PASS;
  bar.dataset.safeStrictCollisionTrimPass = SAFE_AREA_STRICT_COLLISION_TRIM_PASS;
  bar.dataset.safeBadgeOnlyCollisionPass = SAFE_AREA_BADGE_ONLY_COLLISION_PASS;
  const modes = ['normal', 'compact', 'minimal', 'badge-only', 'hide-network'];
  let chosen = 'normal';
  let finalCheck = { crowded: false, overflows: false, collides: false, visibleCount: 0 };
  bar.dataset.safeOverflowTrim = 'false';
  for (const mode of modes) {
    bar.dataset.safeCollisionMode = mode;
    finalCheck = measureSafeAreaCollision(bar, slots);
    chosen = mode;
    if (!finalCheck.crowded) break;
  }
  if (finalCheck.crowded) {
    bar.dataset.safeOverflowTrim = 'true';
    finalCheck = measureSafeAreaCollision(bar, slots);
  }
  bar.dataset.safeCollisionMode = chosen;
  bar.dataset.safeCollisionState = finalCheck.crowded ? 'collision-fit' : 'clear';
  const state = app?.state || {};
  state.lastSafeAreaCollisionFit = {
    pass: SAFE_AREA_COLLISION_FIT_PASS,
    iterativePass: SAFE_AREA_ITERATIVE_COLLISION_FIT_PASS,
    strictTrimPass: SAFE_AREA_STRICT_COLLISION_TRIM_PASS,
    mode: chosen,
    state: bar.dataset.safeCollisionState,
    reason: reason || '',
    visualWidth: Number(metrics?.visualWidth) || 0,
    displayMode: metrics?.displayMode || '',
    isBrowserFullscreen: !!metrics?.isBrowserFullscreen,
    visibleCount: finalCheck.visibleCount,
    collides: !!finalCheck.collides,
    overflows: !!finalCheck.overflows,
    crowded: !!finalCheck.crowded,
    strictTrim: bar.dataset.safeOverflowTrim === 'true',
    at: Date.now()
  };
}

function measureSafeAreaCollision(bar, slots = {}) {
  const barRect = bar.getBoundingClientRect?.();
  if (!barRect || !Number.isFinite(barRect.width)) return { crowded: false, overflows: false, collides: false, visibleCount: 0 };
  const visible = Object.entries(slots)
    .map(([name, node]) => ({ name, node, rect: getVisibleSafeRect(node) }))
    .filter(item => item.rect && item.rect.width > 0 && item.rect.height > 0);
  let collides = false;
  for (let i = 0; i < visible.length && !collides; i += 1) {
    for (let j = i + 1; j < visible.length; j += 1) {
      if (rectsOverlap(visible[i].rect, visible[j].rect)) { collides = true; break; }
    }
  }
  const overflows = visible.some(item =>
    item.rect.left < barRect.left - 1 ||
    item.rect.right > barRect.right + 1 ||
    item.rect.top < barRect.top - 1 ||
    item.rect.bottom > barRect.bottom + 1
  );
  return { crowded: collides || overflows, overflows, collides, visibleCount: visible.length };
}

function getVisibleSafeRect(node) {
  if (!node) return null;
  const style = window.getComputedStyle?.(node);
  if (style && (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || 1) === 0)) return null;
  return node.getBoundingClientRect?.() || null;
}

function rectsOverlap(a, b) {
  return a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
}

function findMatchingSafeViewportProfile(prefs, context) {
  const profiles = normalizeSafeViewportProfiles(prefs?.safeViewportProfiles || []);
  if (!profiles.length) return null;
  const selectedId = String(prefs?.safeViewportProfileId || '');
  const selected = profiles.find(profile => profile.id === selectedId && profile.contextKey === context.key);
  if (selected) return selected;
  return profiles.find(profile => profile.contextKey === context.key) || null;
}

function buildSafeViewportContext(metrics = {}) {
  const uaKey = getBrowserKey();
  const displayMode = metrics.isBrowserFullscreen ? 'browser-fullscreen' : (metrics.displayMode || 'browser');
  const modeLabel = displayMode === 'browser-fullscreen'
    ? '브라우저 전체화면'
    : displayMode === 'standalone'
      ? 'PWA'
      : displayMode === 'fullscreen'
        ? '전체화면'
        : '브라우저';
  return {
    key: `${uaKey}|${displayMode}|${metrics.isMobile ? 'mobile' : 'desktop'}`,
    label: `${modeLabel} · ${uaKey}`
  };
}

function getBrowserKey() {
  const ua = String(navigator.userAgent || '').toLowerCase();
  if (ua.includes('samsungbrowser')) return 'Samsung Internet';
  if (ua.includes('firefox') || ua.includes('fxios')) return 'Firefox';
  if (ua.includes('edg/')) return 'Edge';
  if (ua.includes('crios')) return 'Chrome iOS';
  if (ua.includes('chrome') || ua.includes('chromium')) return 'Chrome';
  if (ua.includes('safari')) return 'Safari';
  return 'Browser';
}

function isStandaloneDisplay() {
  try {
    const standalone = !!window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone === true;
    const manifestFullscreen = !!window.matchMedia?.('(display-mode: fullscreen)')?.matches && !document.fullscreenElement;
    return standalone || manifestFullscreen;
  } catch {
    return false;
  }
}
