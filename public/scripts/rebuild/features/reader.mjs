import { clamp, debounce, formatPercent, throttle } from '../core/utils.mjs';
import { persistProgress } from '../state/app-state.mjs';
import { setToolbarTitle, showReader, status, toast } from './ui.mjs';
import {
  ensureVirtualState,
  resetVirtualDocument,
  rebuildVirtualRows,
  snapshotVirtualScroll,
  scheduleVirtualRender,
  scrollToVirtualTarget,
  captureVirtualViewportAnchor,
  restoreVirtualViewportAnchor,
  isProgrammaticSliderScrollEvent,
  isProgrammaticReaderScrollEvent,
  markProgrammaticReaderScroll,
  clearPendingSliderMeasureTarget,
  getVisibleChunk,
  getViewportAddress,
  getChunkViewportState,
  invalidateVirtualLayout as invalidateVirtualLayoutCore,
  hasVirtualChunkRows,
  markVirtualScrollActivity
} from './reader/virtual-layout.mjs';
import { installJumpPanel } from './reader/jump-panel.mjs';
import { isTyping, prepareOffline, prepareOfflineChunks, setChunkLoading, toggleFullscreen } from './reader/dom-actions.mjs';
import { chunkKey, maybeExtendChunks, warmAdjacentChunks } from './reader/chunk-window.mjs';
import { rememberRecent, saveProgress, updateProgressFromViewport } from './reader/progress.mjs';
import { createReaderScrollSideEffectScheduler } from './reader/scroll-side-effects.mjs';
import { applyBlockManifest, applyFolderBlockManifest, hasBlockManifest, hasFolderBlockManifest, resetCoordinateState, resolveGlobalBlock, ratioToChunkTarget } from './reader/coordinates.mjs';
import { readChunkPayloadFromCache } from './reader/cache-store.mjs';
import { installPrefetchQueue, abortReaderPrefetch } from './reader/prefetch-queue.mjs';
import { installOfflineStatus } from './reader/offline-status.mjs';
import { commitLoadedChunk, reportChunkLoadFailure } from './reader/load-chunk-side-effects.mjs';
import { buildReaderManifestFailureReport, rememberReaderFailureReport } from './reader/failure-reporting.mjs';
import { buildReaderChunkNavigationIntent, buildReaderOpenNovelLoadIntent } from './reader/navigation-intent.mjs';
import { buildReaderOpenCurrentState, clearReaderOpenDeferredTimers, resetReaderOpenRuntimeState } from './reader/open-state.mjs';
import { loadReaderManualDiagnosticsHistory, promptAndAppendReaderManualDiagnosticsSnapshot, clearReaderManualDiagnosticsHistory, exportReaderManualDiagnosticsHistory, importReaderManualDiagnosticsHistory } from './reader/manual-diagnostics-storage.mjs';
import { isReaderRequestCurrent, manifestRequestKey, resetReaderRequestScope as resetReaderRequestScopeCore, resolveReaderChunkLoadJoin } from './reader/request-guards.mjs';
import { isShortcut } from './settings/shortcuts.mjs';

const READER_INTERACTION_PASS = 'v143-reader-interaction-pass';
const READER_CACHE_WARMUP_PASS = 'v144-reader-cache-warmup-pass';
const READER_MOBILE_STABILITY_PASS = 'v146-mobile-interaction-stability-pass';
const READER_SCROLL_BUFFER_PASS = 'v147-reader-scroll-buffer-pass';
const READER_VELOCITY_BUFFER_PASS = 'v149-reader-velocity-buffer-pass';
const READER_SEARCH_JUMP_STABILITY_PASS = 'v151-reader-search-jump-stability-pass';
const READER_TAP_ZONE_PASS = 'v281-reader-third-tap-zone-pass';
const READER_EPISODE_BOUNDARY_SCROLL_BEYOND_PASS = 'v357-reader-episode-scroll-beyond-pass';
const READER_EPISODE_BOUNDARY_LOCK_PASS = 'v359-reader-episode-boundary-lock-pass';
const READER_JUMP_PANEL_EPISODE_SELECT_PASS = 'v362-reader-jump-panel-episode-select-pass';
const READER_SEARCH_MULTI_EPISODE_JUMP_PASS = 'v363-reader-search-multi-episode-jump-pass';
const READER_MULTI_FILE_LOCAL_SLIDER_PASS = 'v380-reader-multi-file-local-slider-pass';
const READER_MANIFEST_TOTAL_CHUNKS_NAV_REFRESH_PASS = 'v424-reader-manifest-total-chunks-nav-refresh-pass';
const READER_LOADED_CHUNK_APPEND_NOOP_PASS = 'v456-reader-loaded-chunk-append-noop-pass';
const READER_LIVE_SCROLL_PROGRESS_PASS = 'v464-reader-live-scroll-progress-pass';
const READER_SLIDER_RATIO_SCROLL_ANCHOR_PASS = 'v464-reader-slider-ratio-scroll-anchor-pass';
const READER_SLIDER_BLOCK_DIRECT_ANCHOR_PASS = 'v465-reader-slider-block-direct-anchor-pass';
const READER_EPISODE_BOUNDARY_PULL_CONFIRM_PASS = 'v471-reader-episode-boundary-pull-confirm-pass';
const READER_EPISODE_BOUNDARY_PULL_INDICATOR_PASS = 'v471-reader-episode-boundary-pull-indicator-pass';
const READER_EPISODE_BOUNDARY_PREV_PULL_PASS = 'v472-reader-episode-boundary-prev-pull-pass';
const READER_FULL_FILE_CHAR_PROGRESS_PASS = 'v472-reader-full-file-char-progress-pass';
const READER_PREV_BOUNDARY_TOP_INDICATOR_PASS = 'v473-reader-prev-boundary-top-indicator-pass';
const READER_SLIDER_CHAR_TARGET_ANCHOR_PASS = 'v474-reader-slider-nearest-char-anchor-pass';
const READER_SLIDER_MEASURED_CHAR_ANCHOR_PASS = 'v475-reader-slider-measured-char-anchor-pass';
const READER_NAV_SLIDER_RELEASE_COMMIT_PASS = 'v515-reader-nav-slider-release-commit-pass';
const READER_NAV_SLIDER_IN_WINDOW_JUMP_PASS = 'v520-reader-nav-slider-in-window-jump-pass';
const READER_FOLDER_MANIFEST_WINDOW_PASS = 'v542-reader-folder-manifest-window-pass';
export const CONTENT_WORKER_RETRY_UX_PASS = 'v569-content-worker-retry-ux-pass';
const READER_VIEWPORT_TRANSITION_ANCHOR_PASS = 'v521-reader-viewport-transition-anchor-pass';
const READER_EPISODE_BOUNDARY_PULL_THRESHOLD_PX = 88;

export function installReader(app) {
  app.readerCleanup?.();
  const disposers = [];
  const on = (target, type, handler, options) => {
    if (!target) return;
    target.addEventListener(type, handler, options);
    disposers.push(() => target.removeEventListener(type, handler, options));
  };
  const saveProgressDebounced = debounce(() => saveProgress(app), 650);
  const scrollSideEffects = createReaderScrollSideEffectScheduler(app, {
    updateProgressFromViewport,
    saveProgressDebounced,
    maybeExtendChunks: (targetApp, loader) => maybeExtendChunks(targetApp, loader),
    loadChunk: (chunk, mode, options) => loadChunk(app, chunk, mode, options)
  });
  app.state.scrollSideEffects = scrollSideEffects;
  app.state.readerSaveProgressDebounced = saveProgressDebounced;
  const onScroll = throttle(() => {
    if (isProgrammaticSliderScrollEvent(app) || isProgrammaticReaderScrollEvent(app)) {
      scheduleVirtualRender(app);
      updateProgressFromViewport(app);
      saveProgressDebounced();
      if (app.state) app.state.readerLiveScrollProgressPass = READER_LIVE_SCROLL_PROGRESS_PASS;
      return;
    }
    markVirtualScrollActivity(app, { source: 'scroll' });
    scheduleVirtualRender(app);
    scrollSideEffects.schedule();
    if (app.state) app.state.readerLiveScrollProgressPass = READER_LIVE_SCROLL_PROGRESS_PASS;
  }, 32);
  const onResize = debounce(() => invalidateVirtualLayout(app, { reason: 'window-resize', preserveViewportAnchor: true }), 160);
  const captureViewportTransitionAnchor = (reason, options = {}) => captureReaderViewportTransitionAnchor(app, reason, options);
  const restoreViewportTransitionAnchor = reason => restoreReaderViewportTransitionAnchor(app, reason);
  const handleViewportTransition = (reason, options = {}) => {
    if (options.capture !== false) captureViewportTransitionAnchor(reason);
    clearPendingSliderMeasureTarget(app, { phase: 'viewport-transition', reason, clearProgrammaticScroll: true });
    restoreViewportTransitionAnchor(reason);
  };
  const toggleFullscreenWithAnchor = trigger => {
    captureViewportTransitionAnchor(`fullscreen-toggle-${trigger || 'unknown'}`, { force: true });
    return toggleFullscreen();
  };
  const onKeyDown = ev => {
    if (isTyping(ev.target)) return;
    if (isShortcut(app, 'readerNext', ev) || isShortcut(app, 'readerPageNext', ev)) { ev.preventDefault(); goRelative(app, 1); return; }
    if (isShortcut(app, 'readerPrev', ev) || isShortcut(app, 'readerPagePrev', ev)) { ev.preventDefault(); goRelative(app, -1); return; }
    if (isShortcut(app, 'fullscreen', ev)) { ev.preventDefault(); toggleFullscreenWithAnchor('shortcut'); }
  };

  app.reader = {
    openNovel: (novel, opts = {}) => openNovel(app, novel, opts),
    reloadCurrent: () => reloadCurrent(app),
    loadChunk: (chunk, mode = 'replace', options = {}) => loadChunk(app, chunk, mode, options),
    goRelative: dir => goRelative(app, dir),
    goSearchResult: result => goSearchResult(app, result),
    goBlock: (globalBlockIndex = 0, options = {}) => goBlock(app, globalBlockIndex, options),
    goPercent: (ratio = 0, options = {}) => goPercent(app, ratio, options),
    goEpisode: (episodeId, options = {}) => goEpisode(app, episodeId, options),
    debugGoChunk: (chunk, options = {}) => goChunkInternal(app, chunk, options),
    goPosition: address => goPosition(app, address),
    ensureBlockManifest: options => ensureBlockManifest(app, options),
    ensureFolderBlockManifest: options => ensureFolderBlockManifest(app, options),
    prepareOfflineChunks: (chunks, options = {}) => prepareOfflineChunks(app, chunks, options),
    getViewportAddress: () => getViewportAddress(app),
    updateProgress: () => { updateProgressFromViewport(app); saveProgressDebounced(); },
    persistProgress: () => saveProgress(app, { immediate:true }),
    invalidateLayout: () => invalidateVirtualLayout(app),
    recordManualDiagnostics: (entry = {}, promptFn = null) => promptAndAppendReaderManualDiagnosticsSnapshot(app, entry, promptFn),
    clearManualDiagnostics: () => clearReaderManualDiagnosticsHistory(app),
    exportManualDiagnostics: () => exportReaderManualDiagnosticsHistory(app),
    importManualDiagnostics: (payload = null) => importReaderManualDiagnosticsHistory(app, payload)
  };

  ensureVirtualState(app);
  loadReaderManualDiagnosticsHistory(app);
  installPrefetchQueue(app);
  installOfflineStatus(app, { on });
  installReaderInteractionControls(app, { on });
  on(document, 'fullscreenchange', () => handleViewportTransition('fullscreenchange', { capture: false }));
  on(document, 'webkitfullscreenchange', () => handleViewportTransition('webkitfullscreenchange', { capture: false }));
  on(window, 'txt-reader-pseudo-fullscreen-change', () => handleViewportTransition('pseudo-fullscreen-change', { capture: false }));
  on(window, 'txt-reader-viewport-fit', () => restoreViewportTransitionAnchor('viewport-fit'));
  if (window.visualViewport) {
    on(window.visualViewport, 'resize', () => handleViewportTransition('visual-viewport-resize', { capture: false }), { passive: true });
  }
  on(app.els.prevBtn, 'click', () => goRelative(app, -1));
  on(app.els.nextBtn, 'click', () => goRelative(app, 1));
  on(app.els.navSlider, 'pointerdown', () => markNavSliderSeeking(app, true));
  on(app.els.navSlider, 'touchstart', () => markNavSliderSeeking(app, true), { passive:true });
  on(app.els.navSlider, 'input', ev => {
    const ratio = (Number(ev.target.value) || 0) / 1000;
    markNavSliderSeeking(app, true);
    rememberNavSliderPendingCommit(app, ratio, 'input');
    previewSliderPosition(app, ratio);
  });
  on(app.els.navSlider, 'change', ev => {
    rememberNavSliderPendingCommit(app, (Number(ev.target.value) || 0) / 1000, 'change');
    commitNavSliderPosition(app, (Number(ev.target.value) || 0) / 1000, 'change');
  });
  on(app.els.navSlider, 'pointerup', () => commitNavSliderRelease(app, 'pointerup'));
  on(app.els.navSlider, 'touchend', () => commitNavSliderRelease(app, 'touchend'), { passive:true });
  on(app.els.navSlider, 'pointercancel', () => commitNavSliderRelease(app, 'pointercancel'));
  on(app.els.navSlider, 'blur', () => commitNavSliderRelease(app, 'blur'));
  on(app.els.reader, 'scroll', onScroll, { passive: true });
  on(app.els.reader, 'wheel', ev => maybeOpenEpisodeFromWheelBoundary(app, ev), { passive: true });
  installReaderBottomTouchBoundary(app, { on });
  on(app.els.fsBtn, 'click', () => toggleFullscreenWithAnchor('button'));
  on(app.els.offlineReadyBtn, 'click', () => prepareOffline(app));
  installJumpPanel(app, {
    goBlock: (globalBlockIndex, options) => goBlock(app, globalBlockIndex, options),
    goPercent: (ratio, options) => goPercent(app, ratio, options),
    goEpisode: (episodeId, options) => goEpisode(app, episodeId, options)
  });
  on(window, 'resize', onResize);
  on(window, 'keydown', onKeyDown);
  on(window, 'pagehide', () => flushReaderProgressBeforeContextChange(app, 'pagehide'));
  on(document, 'visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushReaderProgressBeforeContextChange(app, 'visibility-hidden');
  });
  app.readerCleanup = () => {
    flushReaderProgressBeforeContextChange(app, 'reader-cleanup');
    disposers.splice(0).forEach(dispose => dispose());
    onScroll.cancel?.();
    onResize.cancel?.();
    saveProgressDebounced.cancel?.();
    scrollSideEffects.cancel?.();
    app.state.scrollSideEffects = null;
    app.state.readerSaveProgressDebounced = null;
    window.clearTimeout(app.state.readerTapNavSaveTimer || 0);
    window.clearTimeout(app.state.readerInteractionWarmupTimer || 0);
    window.clearTimeout(app.state.offlineCoverageRefreshTimer || 0);
    clearReaderOpenDeferredTimers(app);
    cancelReaderTapAnimation(app);
    resetEpisodeBoundaryPull(app, { hide: true, reason: 'cleanup' });
    app.state.chunkFetchAbort?.abort?.();
    app.state.readerManifestRequest = null;
    app.jumpPanelCleanup?.();
    app.offlineStatus?.dispose?.();
    abortReaderPrefetch(app);
  };
}



function flushReaderProgressBeforeContextChange(app, reason = 'reader-context-change') {
  const current = app?.state?.current;
  if (!current) return null;
  app.state.readerSaveProgressDebounced?.cancel?.();
  try {
    updateProgressFromViewport(app);
    const request = saveProgress(app, { keepalive:true, lifecycle:true });
    app.state.lastReaderContextProgressFlush = {
      pass: 'v607-reader-context-progress-flush-pass',
      reason: String(reason || 'reader-context-change'),
      novelId: String(current?.novel?.id || ''),
      episodeId: current?.episode?.id || null,
      at: Date.now()
    };
    return request;
  } catch (error) {
    app.state.errors?.push?.({ area:'reader-progress-flush', message:error?.message || String(error), at:Date.now() });
    return null;
  }
}

function installReaderInteractionControls(app, { on } = {}) {
  const reader = app.els.reader;
  if (!reader || !reader.dataset) return;
  reader.dataset.readerInteractionPass = READER_INTERACTION_PASS;
  reader.dataset.readerCacheWarmupPass = READER_CACHE_WARMUP_PASS;
  reader.dataset.readerMobileStabilityPass = READER_MOBILE_STABILITY_PASS;
  reader.dataset.readerScrollBufferPass = READER_SCROLL_BUFFER_PASS;
  reader.dataset.readerVelocityBufferPass = READER_VELOCITY_BUFFER_PASS;
  reader.dataset.readerSearchJumpStabilityPass = READER_SEARCH_JUMP_STABILITY_PASS;
  reader.dataset.readerTapZonePass = READER_TAP_ZONE_PASS;
  let pointer = null;
  let touchScroll = null;
  const listen = typeof on === 'function'
    ? on
    : (target, type, handler, options) => target?.addEventListener(type, handler, options);

  const resetPointer = () => {
    if (pointer?.dragging) {
      reader.classList.remove('reader-drag-panning');
      document.body?.classList.remove('reader-drag-panning-active');
    }
    pointer = null;
  };


  listen(reader, 'touchstart', ev => {
    const touch = ev.changedTouches?.[0] || ev.touches?.[0] || null;
    touchScroll = touch ? { startY: touch.clientY, lastY: touch.clientY, moved: false, at: Date.now() } : null;
  }, { passive: true });

  listen(reader, 'touchmove', ev => {
    const touch = ev.changedTouches?.[0] || ev.touches?.[0] || null;
    if (!touchScroll || !touch) return;
    const moved = Math.abs(touch.clientY - touchScroll.startY);
    touchScroll.lastY = touch.clientY;
    if (moved > 5) {
      touchScroll.moved = true;
      markVirtualScrollActivity(app, { source: 'touch-scroll', durationMs: Math.max(520, Math.round(resolveReaderTouchCoastRetainMs(app, moved) * 0.55)) });
    }
  }, { passive: true });

  listen(reader, 'touchend', ev => {
    const touch = ev.changedTouches?.[0] || null;
    const current = touchScroll;
    touchScroll = null;
    if (!current) return;
    const moved = touch ? Math.abs(touch.clientY - current.startY) : Math.abs(Number(current.lastY) - Number(current.startY));
    if (current.moved || moved > 6) {
      markVirtualScrollActivity(app, { source: 'touch-coast', durationMs: resolveReaderTouchCoastRetainMs(app, moved) });
    }
  }, { passive: true });

  listen(reader, 'touchcancel', () => { touchScroll = null; }, { passive: true });

  listen(reader, 'pointerdown', ev => {
    if (!shouldHandleReaderPointer(app, ev)) return;
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    cancelReaderTapAnimation(app);
    pointer = {
      id: ev.pointerId,
      type: ev.pointerType || 'mouse',
      startX: ev.clientX,
      startY: ev.clientY,
      lastX: ev.clientX,
      lastY: ev.clientY,
      startTop: reader.scrollTop,
      startLeft: reader.scrollLeft,
      at: Date.now(),
      dragging: false,
      moved: false,
      cancelled: false
    };
    try { reader.setPointerCapture?.(ev.pointerId); } catch {}
  }, { passive: true });

  listen(reader, 'pointermove', ev => {
    if (!pointer || ev.pointerId !== pointer.id) return;
    const dx = ev.clientX - pointer.startX;
    const dy = ev.clientY - pointer.startY;
    const moved = Math.hypot(dx, dy);
    pointer.lastX = ev.clientX;
    pointer.lastY = ev.clientY;
    if (moved > 5) pointer.moved = true;
    if (pointer.type === 'mouse' && pointer.moved) {
      pointer.dragging = true;
      reader.classList.add('reader-drag-panning');
      document.body?.classList.add('reader-drag-panning-active');
      markVirtualScrollActivity(app, { source: 'drag-pan', durationMs: 220 });
      reader.scrollTop = pointer.startTop - dy;
      reader.scrollLeft = pointer.startLeft - dx;
      ev.preventDefault?.();
    }
  }, { passive: false });

  listen(reader, 'pointerup', ev => {
    if (!pointer || ev.pointerId !== pointer.id) return;
    const current = pointer;
    const dx = ev.clientX - current.startX;
    const dy = ev.clientY - current.startY;
    const duration = Date.now() - current.at;
    const moved = Math.hypot(dx, dy);
    const wasDragPanning = !!current.dragging;
    resetPointer();
    if (!app.state.current || current.cancelled) return;
    if (handleReaderSwipe(app, { dx, dy, duration, pointerType: current.type })) {
      markReaderSuppressNextClick(app);
      ev.preventDefault?.();
      return;
    }
    if (current.type === 'touch' && moved > 6) {
      markVirtualScrollActivity(app, { source: 'touch-coast', durationMs: resolveReaderTouchCoastRetainMs(app, moved) });
    }
    if (wasDragPanning || moved > 12 || duration > 700) {
      markReaderSuppressNextClick(app);
      return;
    }
    if (handleReaderTap(app, ev.clientX, ev.clientY)) {
      markReaderSuppressNextClick(app);
      ev.preventDefault?.();
    }
  }, { passive: false });

  listen(reader, 'pointercancel', ev => {
    if (!pointer || ev.pointerId !== pointer.id) return;
    pointer.cancelled = true;
    resetPointer();
  }, { passive: true });

  listen(reader, 'lostpointercapture', ev => {
    if (!pointer || ev.pointerId !== pointer.id) return;
    if (pointer.dragging) resetPointer();
  }, { passive: true });

  listen(reader, 'click', ev => {
    if (!shouldSuppressReaderClick(app)) return;
    ev.preventDefault?.();
    ev.stopPropagation?.();
    ev.stopImmediatePropagation?.();
  }, { capture: true });
}


function isMobileLibraryOverlayOpen(app) {
  const body = document.body;
  if (!body?.classList?.contains('mobile-library-overlay')) return false;
  return !!(body.classList.contains('library-open') || app?.els?.sidebar?.classList?.contains('open') || app?.els?.overlay?.classList?.contains('open'));
}

function markReaderSuppressNextClick(app, timeout = 360) {
  if (!app?.state) return;
  app.state.readerSuppressNextClickUntil = Date.now() + Math.max(80, Number(timeout) || 360);
}

function resolveReaderTouchCoastRetainMs(app, moved = 0) {
  const viewport = Math.max(0, Number(app?.els?.reader?.clientHeight) || 0);
  const viewportMs = viewport > 0 ? Math.round(viewport * 0.95) : 900;
  const moveMs = Math.min(420, Math.round(Math.max(0, Number(moved) || 0) * 3));
  return clamp(Math.max(900, viewportMs + moveMs), 900, 1900);
}

function shouldSuppressReaderClick(app) {
  const until = Number(app?.state?.readerSuppressNextClickUntil) || 0;
  if (!until) return false;
  if (Date.now() <= until) return true;
  if (app?.state) app.state.readerSuppressNextClickUntil = 0;
  return false;
}

function shouldHandleReaderPointer(app, ev) {
  const reader = app.els.reader;
  if (!reader || reader.style.display === 'none' || !app.state.current) return false;
  if (isMobileLibraryOverlayOpen(app)) return false;
  if (!ev.isPrimary) return false;
  if (document.body?.classList.contains('modal-layer-open')) return false;
  const target = ev.target;
  if (!target || typeof target.closest !== 'function') return true;
  if (target.closest('button,input,select,textarea,a,label,[contenteditable="true"],.reader-jump-panel,.reader-jump-overlay,#chunk-loading')) return false;
  if (target.closest('#search-nav-remote,#toast-wrap,#ui-status-dock,#offline-download-status,#offline-download-status-dock')) return false;
  return true;
}

function handleReaderTap(app, clientX, clientY) {
  const reader = app.els.reader;
  const rect = reader?.getBoundingClientRect?.();
  if (!reader || !rect || rect.width <= 0 || rect.height <= 0) return false;
  const yRatio = clamp((clientY - rect.top) / rect.height, 0, 1);
  const zone = resolveReaderTapZone(yRatio);
  app.state.lastReaderTapZone = {
    pass: READER_TAP_ZONE_PASS,
    zone,
    yRatio: Math.round(yRatio * 1000) / 1000,
    at: Date.now()
  };
  if (zone === 'middle') {
    toggleReaderChrome(app);
    return true;
  }
  if (app.state.prefs?.tapNavEnabled === false) return false;
  scrollReaderByPage(app, zone === 'top' ? -1 : 1, 'tap');
  return true;
}

function resolveReaderTapZone(yRatio) {
  if (yRatio < 1 / 3) return 'top';
  if (yRatio > 2 / 3) return 'bottom';
  return 'middle';
}

function handleReaderSwipe(app, { dx = 0, dy = 0, duration = 0, pointerType = '' } = {}) {
  if (app.state.prefs?.swipeNav === false) return false;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const threshold = clamp(app.state.prefs?.swipeThreshold ?? 50, 24, 100);
  const quickEnough = !duration || duration < 900;
  if (!quickEnough) return false;
  if (absX >= threshold && absX >= absY * 1.35) {
    scrollReaderByPage(app, dx < 0 ? 1 : -1, pointerType === 'mouse' ? 'mouse-swipe' : 'swipe');
    return true;
  }
  return false;
}

function scrollReaderByPage(app, dir = 1, source = 'tap') {
  const reader = app.els.reader;
  if (!reader) return;
  const percent = clamp(app.state.prefs?.tapScrollPercent ?? 90, 30, 100) / 100;
  const delta = Math.max(120, Math.round(reader.clientHeight * percent)) * (dir < 0 ? -1 : 1);
  const duration = clamp(app.state.prefs?.tapSpeed ?? 400, 100, 800);
  if (app.state.prefs?.tapAnim === false) {
    cancelReaderTapAnimation(app);
    markProgrammaticReaderScroll(app, { source, durationMs: 180, scrollTop: reader.scrollTop + delta });
    reader.scrollTop += delta;
  } else {
    animateReaderScrollBy(app, delta, duration);
  }
  window.clearTimeout(app.state.readerTapNavSaveTimer || 0);
  app.state.readerTapNavSaveTimer = window.setTimeout(() => {
    updateProgressFromViewport(app);
    saveProgress(app, { immediate: true });
    app.state.scrollSideEffects?.schedule();
  }, app.state.prefs?.tapAnim === false ? 80 : duration + 80);
  app.offlineStatus?.update?.(source);
  scheduleReaderInteractionWarmup(app, dir, source);
}

function scheduleReaderInteractionWarmup(app, dir = 1, source = 'tap') {
  const current = app.state.current;
  if (!current || !app.readerPrefetch?.warm) return;
  window.clearTimeout(app.state.readerInteractionWarmupTimer || 0);
  app.state.readerInteractionWarmupTimer = window.setTimeout(() => {
    if (!app.state.current || app.state.current !== current || !app.readerPrefetch?.warm) return;
    const centerChunk = getVisibleChunk(app) || current.chunk;
    const direction = dir < 0 ? 'backward' : 'forward';
    app.readerPrefetch.warm(centerChunk, { direction, source, pass: READER_CACHE_WARMUP_PASS });
  }, 120);
}

function animateReaderScrollBy(app, delta = 0, duration = 400) {
  const reader = app.els.reader;
  if (!reader || !Number.isFinite(delta) || !delta) return;
  cancelReaderTapAnimation(app);
  const startTop = reader.scrollTop;
  const maxTop = Math.max(0, reader.scrollHeight - reader.clientHeight);
  const targetTop = clamp(startTop + delta, 0, maxTop);
  const startAt = performance.now();
  const ease = t => 1 - Math.pow(1 - t, 3);
  const step = now => {
    const ratio = clamp((now - startAt) / duration, 0, 1);
    const nextTop = startTop + (targetTop - startTop) * ease(ratio);
    markVirtualScrollActivity(app, { source: 'tap-animation', durationMs: 120 });
    markProgrammaticReaderScroll(app, { source: 'tap-animation', durationMs: 180, scrollTop: nextTop });
    reader.scrollTop = nextTop;
    if (ratio < 1) {
      app.state.readerTapNavAnimationFrame = requestAnimationFrame(step);
    } else {
      app.state.readerTapNavAnimationFrame = 0;
    }
  };
  app.state.readerTapNavAnimationFrame = requestAnimationFrame(step);
}

function cancelReaderTapAnimation(app) {
  if (app.state.readerTapNavAnimationFrame) {
    cancelAnimationFrame(app.state.readerTapNavAnimationFrame);
    app.state.readerTapNavAnimationFrame = 0;
  }
}

function toggleReaderChrome(app, force = null) {
  const body = document.body;
  const nextHidden = force == null ? !body?.classList.contains('reader-bars-hidden') : !!force;
  body?.classList.toggle('reader-bars-hidden', nextHidden);
  app.els.navBar?.setAttribute('aria-hidden', nextHidden ? 'true' : 'false');
  status(app, 'reader', nextHidden ? '상단/하단바 숨김' : '상단/하단바 표시', 1200);
}

function resetReaderRequestScope(app) {
  app.state.readerFolderManifestRequest = null;
  return resetReaderRequestScopeCore(app, { abortReaderPrefetch });
}

async function openNovel(app, novel, opts = {}) {
  if (!novel) return;
  flushReaderProgressBeforeContextChange(app, 'reader-context-change');
  const previousReaderContext = app.state.current || null;
  const openState = buildReaderOpenCurrentState(novel, opts);
  if (!opts.preserveSearchSession) app.search?.resetForReaderChange?.({ novel, episode: openState.episode }, previousReaderContext);
  const preserveFolderManifest = shouldPreserveFolderManifestForOpen(app, openState.current);
  const openSessionId = resetReaderRequestScope(app);
  app.state.current = openState.current;
  const openCurrent = app.state.current;
  const openSignal = app.state.chunkFetchAbort?.signal || null;
  resetReaderOpenRuntimeState(app, {
    resetCoordinateState,
    resetCoordinateOptions: { preserveFolderManifest },
    resetVirtualDocument,
    setToolbarTitle,
    showReader
  });
  if (opts.keepHighlight && opts.query) {
    app.state.search.highlights = {
      chunk: Math.max(1, Number(opts.chunk) || 1),
      query: String(opts.query || ''),
      index: Math.max(0, Number(opts.searchIndex) || 0),
      matchLength: Math.max(1, Number(opts.matchLength) || String(opts.query || '').length)
    };
  }
  const manifestPromise = ensureBlockManifest(app, { signal: openSignal });
  const folderManifestPromise = ensureFolderBlockManifest(app, { signal: openSignal });
  const manifest = await manifestPromise.catch(() => null);
  folderManifestPromise?.catch?.(() => {});
  if (!isReaderRequestCurrent(app, { signal: openSignal, sessionId: openSessionId, current: openCurrent })) return null;
  if (manifest) {
    ensureVirtualState(app).lastFullFileCharProgress = {
      pass: READER_FULL_FILE_CHAR_PROGRESS_PASS,
      source: 'open-novel-manifest-ready',
      totalChunks: Number(manifest.totalChunks) || 0,
      totalChars: Number(manifest.totalChars) || 0,
      at: Date.now()
    };
  }
  if (opts.globalBlockIndex != null && (hasBlockManifest(app) || opts.totalChunks)) {
    const target = resolveGlobalBlock(app, opts.globalBlockIndex);
    app.state.current.chunk = target.chunk;
  }
  await loadChunk(app, openCurrent.chunk, 'replace', buildReaderOpenNovelLoadIntent({
    ...opts,
    ratio: openCurrent.ratio
  }));
  if (!isReaderRequestCurrent(app, { signal: openSignal, sessionId: openSessionId, current: openCurrent })) return null;
  warmAdjacentChunks(app, (chunk, mode, options) => loadChunk(app, chunk, mode, options), { centerChunk: openCurrent.chunk, direction: 'forward' });
  rememberRecent(app);
  app.library.render({ source:'reader-open', followActive:true });
  return openCurrent;
}

async function reloadCurrent(app) {
  const c = app.state.current;
  if (!c) return;
  const visible = getChunkViewportState(app);
  await openNovel(app, c.novel, { episodeId: c.episode?.id || null, chunk: visible.chunk || c.chunk, ratio: visible.ratio ?? c.ratio });
}

function recordLoadedChunkAppendNoop(app, payload = {}) {
  const v = ensureVirtualState(app);
  const rowsReady = payload.rowsReady === true;
  v.loadedChunkAppendNoopPass = READER_LOADED_CHUNK_APPEND_NOOP_PASS;
  v.lastLoadedChunkAppendNoop = {
    pass: READER_LOADED_CHUNK_APPEND_NOOP_PASS,
    chunk: Number(payload.chunk) || 0,
    mode: String(payload.mode || ''),
    rowsReady,
    rebuiltMissingRows: !rowsReady,
    source: String(payload.source || ''),
    at: Date.now(),
    reason: rowsReady ? 'already-loaded chunk kept virtual rows without rebuild' : 'already-loaded chunk rebuilt missing virtual rows'
  };
}

async function loadChunk(app, chunk, mode = 'replace', options = {}) {
  const c = app.state.current;
  if (!c) return null;
  const targetChunk = Number(chunk) === -1 ? -1 : Math.max(1, Number(chunk) || 1);
  const key = chunkKey(c, targetChunk);
  const loadedChunk = app.state.loadedChunks.get(targetChunk);
  if (loadedChunk && mode !== 'replace') {
    const rowsReady = hasVirtualChunkRows(app, targetChunk);
    if (!rowsReady) {
      rebuildVirtualRows(app, mode, targetChunk, options);
    }
    recordLoadedChunkAppendNoop(app, { chunk: targetChunk, mode, rowsReady, source: String(options?.source || '') });
    return loadedChunk;
  }
  const sessionId = app.state.readerSessionId;
  const controller = app.state.chunkFetchAbort;
  const signal = controller?.signal || null;
  const prev = snapshotVirtualScroll(app);
  app.state.loadingChunkOwners ||= new Map();
  if (app.state.loadingChunks.has(key)) {
    const existingOwner = app.state.loadingChunkOwners.get(key);
    const join = resolveReaderChunkLoadJoin(existingOwner, { sessionId, current: c, mode });
    if (join.action === 'join' || join.action === 'promote') {
      const loaded = await existingOwner.promise;
      if (join.action !== 'promote' || !isReaderRequestCurrent(app, { signal, sessionId, current: c, data: loaded })) return loaded || null;
      app.state.lastReaderChunkLoadJoin = { pass:join.pass, action:join.action, key, fromMode:existingOwner.mode, mode, at:Date.now() };
      return commitLoadedChunk(app, {
        current: c,
        targetChunk,
        data: { ...loaded, currentChunk:loaded.chunk, __blocks:loaded.blocks, __fromReaderCache:true },
        mode,
        options,
        prev,
        resetVirtualDocument
      });
    }
    app.state.loadingChunks.delete(key);
    if (app.state.loadingChunkOwners.get(key) === existingOwner) app.state.loadingChunkOwners.delete(key);
  }
  const loadOwner = { key, sessionId, current:c, mode, promise:null };
  app.state.loadingChunks.add(key);
  app.state.loadingChunkOwners.set(key, loadOwner);
  setChunkLoading(app, true);
  const operation = (async () => {
    try {
      const data = await loadChunkPayload(app, c, targetChunk, signal, { mode, source:String(options?.source || '') });
      if (!isReaderRequestCurrent(app, { signal, sessionId, current: c, data })) return null;
      return await commitLoadedChunk(app, {
        current: c,
        targetChunk,
        data,
        mode,
        options,
        prev,
        resetVirtualDocument
      });
    } catch (e) {
      if (!reportChunkLoadFailure(app, e, { targetChunk, mode })) return null;
      throw e;
    } finally {
      if (app.state.loadingChunkOwners?.get?.(key) === loadOwner) {
        app.state.loadingChunkOwners.delete(key);
        app.state.loadingChunks.delete(key);
      }
      if (!app.state.loadingChunks.size) setChunkLoading(app, false);
    }
  })();
  loadOwner.promise = operation;
  return operation;
}

async function ensureBlockManifest(app, options = {}) {
  const c = app.state.current;
  if (!c || typeof app.api.blockManifest !== 'function') return null;
  if (hasBlockManifest(app)) return app.state.readerCoordinates?.manifest || null;
  const key = manifestRequestKey(app, c);
  if (app.state.readerManifestRequest?.key === key && app.state.readerManifestRequest.promise) {
    return app.state.readerManifestRequest.promise;
  }
  const sessionId = app.state.readerSessionId;
  const signal = options.signal || app.state.chunkFetchAbort?.signal || null;
  const request = { key, promise: null, sessionId, current:c };
  const promise = app.api.blockManifest({
    novelId: c.novel.id,
    episodeId: c.episode?.id || null,
    preprocess: app.state.prefs.preprocess
  }, { signal }).then(manifest => {
    if (!isReaderRequestCurrent(app, { signal, sessionId, current:c, data:manifest })) return null;
    if (manifestRequestKey(app, app.state.current) !== key) return null;
    const applied = applyBlockManifest(app, manifest);
    if (applied && Number(manifest.totalChunks) > 0) {
      const previousTotalChunks = Math.max(1, Number(app.state.current.totalChunks) || 1);
      const nextTotalChunks = Math.max(1, Number(manifest.totalChunks) || app.state.current.totalChunks || 1);
      app.state.current.totalChunks = nextTotalChunks;
      if (nextTotalChunks !== previousTotalChunks) {
        app.state.lastReaderManifestTotalChunksRefresh = {
          pass: READER_MANIFEST_TOTAL_CHUNKS_NAV_REFRESH_PASS,
          previousTotalChunks,
          totalChunks: nextTotalChunks,
          at: Date.now()
        };
        updateProgressFromViewport(app);
      }
    }
    return applied;
  }).catch(error => {
    if (error && error.name === 'AbortError') return null;
    rememberReaderFailureReport(app, buildReaderManifestFailureReport(app, error, { key }));
    console.warn('[txt-reader] block manifest unavailable; using estimated coordinates', error);
    return null;
  }).finally(() => {
    if (app.state.readerManifestRequest === request) app.state.readerManifestRequest = null;
  });
  request.promise = promise;
  app.state.readerManifestRequest = request;
  return promise;
}

function folderManifestRequestKey(app, current) {
  const base = manifestRequestKey(app, current).split('::');
  base[1] = 'multi-window';
  base.push(String(current?.episode?.id || ''));
  return base.join('::');
}

function currentPreprocessSignature(app) {
  const preprocess = app.state.prefs?.preprocess || {};
  return [
    preprocess.removeNoise ? 'rn1' : 'rn0',
    preprocess.chapterSpacing ? 'cs1' : 'cs0',
    preprocess.collapseBreaks ? 'cb1' : 'cb0',
    preprocess.splitDense ? 'sd1' : 'sd0',
    preprocess.dialogueBreak ? 'db1' : 'db0',
    preprocess.paragraphOptimize ? 'po1' : 'po0',
    preprocess.aggressive ? 'ag1' : 'ag0'
  ].join('-');
}

function folderManifestHasEpisode(app, episodeId) {
  return !!app.state.readerCoordinates?.folderManifestByEpisode?.has?.(String(episodeId || ''));
}

function folderManifestPayloadHasEpisode(manifest, episodeId) {
  const target = String(episodeId || '');
  return !!target && Array.isArray(manifest?.episodes) && manifest.episodes.some(row => String(row?.episodeId || '') === target);
}

function shouldPreserveFolderManifestForOpen(app, current) {
  if (!current?.novel?.isMultiFile || !current.episode) return false;
  const coords = app.state.readerCoordinates || null;
  const manifest = coords?.folderManifest || null;
  if (!manifest || !coords?.folderManifestByEpisode?.size) return false;
  if (String(manifest.novelId || '') !== String(current.novel.id || '')) return false;
  const manifestSignature = String(manifest.preprocessSignature || '');
  if (manifestSignature && manifestSignature !== currentPreprocessSignature(app)) return false;
  return coords.folderManifestByEpisode.has(String(current.episode.id || ''));
}

function shouldRefreshFolderManifestWindow(app, current, manifest) {
  if (!current?.novel?.isMultiFile || !current.episode || !manifest || manifest.partial !== true) return false;
  if (!folderManifestHasEpisode(app, current.episode.id)) return true;
  const index = Math.max(0, Number(current.episodeIdx) || 0);
  const start = Math.max(0, Number(manifest.windowStartIndex) || 0);
  const end = Math.max(start, Number(manifest.windowEndIndex) || start);
  const radius = Math.max(0, Number(manifest.radius) || 0);
  const edgeThreshold = Math.max(1, Math.min(3, Math.ceil(Math.max(1, radius) / 3)));
  return index - start <= edgeThreshold || end - index <= edgeThreshold;
}

async function ensureFolderBlockManifest(app, options = {}) {
  const c = app.state.current;
  if (!c?.novel?.isMultiFile || !c.episode || typeof app.api.blockManifest !== 'function') return null;
  const currentEpisodeId = String(c.episode.id || '');
  const existingFolderManifest = app.state.readerCoordinates?.folderManifest || null;
  if (hasFolderBlockManifest(app) && folderManifestHasEpisode(app, currentEpisodeId) && !shouldRefreshFolderManifestWindow(app, c, existingFolderManifest)) return existingFolderManifest;
  const key = folderManifestRequestKey(app, c);
  if (app.state.readerFolderManifestRequest?.key === key && app.state.readerFolderManifestRequest.promise) {
    return app.state.readerFolderManifestRequest.promise;
  }
  const sessionId = app.state.readerSessionId;
  const signal = options.signal || app.state.chunkFetchAbort?.signal || null;
  const request = { key, promise: null, sessionId, current:c };
  const promise = app.api.blockManifest({
    novelId: c.novel.id,
    episodeId: null,
    preprocess: app.state.prefs.preprocess,
    centerEpisodeId: c.episode.id,
    centerEpisodeIndex: c.episodeIdx,
    folderManifestScope: 'window'
  }, { signal }).then(manifest => {
    if (!isReaderRequestCurrent(app, { signal, sessionId, current:c, data:manifest })) return null;
    const activeEpisodeId = String(app.state.current?.episode?.id || '');
    if (folderManifestRequestKey(app, app.state.current) !== key && !folderManifestPayloadHasEpisode(manifest, activeEpisodeId)) return null;
    const applied = applyFolderBlockManifest(app, manifest);
    if (applied) {
      app.state.lastMultiFileFolderManifest = {
        pass: READER_MULTI_FILE_LOCAL_SLIDER_PASS,
        windowPass: READER_FOLDER_MANIFEST_WINDOW_PASS,
        mode: applied.partial ? 'folder-window-manifest-available' : 'folder-manifest-available',
        scope: applied.scope || '',
        partial: applied.partial === true,
        totalEpisodes: applied.totalEpisodes,
        manifestedEpisodes: applied.manifestedEpisodes,
        windowStartIndex: applied.windowStartIndex,
        windowEndIndex: applied.windowEndIndex,
        centerEpisodeIndex: applied.centerEpisodeIndex,
        radius: applied.radius,
        totalBlocks: applied.totalBlocks,
        totalChars: applied.totalChars,
        at: Date.now()
      };
      updateProgressFromViewport(app);
    }
    return applied;
  }).catch(error => {
    if (error && error.name === 'AbortError') return null;
    console.warn('[txt-reader] multi-file block manifest unavailable; using episode-count progress', error);
    return null;
  }).finally(() => {
    if (app.state.readerFolderManifestRequest === request) app.state.readerFolderManifestRequest = null;
  });
  request.promise = promise;
  app.state.readerFolderManifestRequest = request;
  return promise;
}

async function loadChunkPayload(app, current, targetChunk, signal, context = {}) {
  if (Number(targetChunk) !== -1) {
    const cached = await readChunkPayloadFromCache(app, current, targetChunk);
    if (cached) return cached;
  }
  const request = () => app.api.content({
    novelId: current.novel.id,
    episodeId: current.episode?.id || null,
    chunk: targetChunk,
    preprocess: app.state.prefs.preprocess
  }, { signal });
  try {
    return await request();
  } catch (error) {
    const workerBusy = error?.code === 'content_worker_busy' || error?.data?.error === 'content_worker_busy';
    const foreground = context.mode === 'replace' || context.mode === 'jump';
    if (!workerBusy || !foreground || signal?.aborted) throw error;
    const retryAfterSeconds = Math.max(1, Math.min(6, Number(error.retryAfterSeconds) || 1));
    app.state.contentWorkerRetry = {
      pass:CONTENT_WORKER_RETRY_UX_PASS,
      chunk:Number(targetChunk) || 1,
      retryAfterSeconds,
      source:String(context.source || ''),
      at:Date.now()
    };
    status(app, 'sync', `서버가 큰 파일을 처리 중입니다 · ${retryAfterSeconds}초 후 재시도`, Math.max(1800, retryAfterSeconds * 1000));
    await waitForContentWorkerRetry(retryAfterSeconds * 1000, signal);
    return request();
  }
}

function waitForContentWorkerRetry(delayMs, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener?.('abort', onAbort);
      resolve();
    }, Math.max(0, Number(delayMs) || 0));
    const onAbort = () => {
      window.clearTimeout(timer);
      signal?.removeEventListener?.('abort', onAbort);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener?.('abort', onAbort, { once:true });
  });
}


function getReaderEpisodeBoundaryMode(app) {
  const raw = String(app?.state?.prefs?.readerEpisodeBoundaryMode || 'manual');
  if (raw === 'scrollBeyond' || raw === 'scroll-beyond' || raw === 'scroll') return 'scrollBeyond';
  return 'manual';
}

function hasNextEpisode(current) {
  return !!(current?.episode && Array.isArray(current?.novel?.episodes) && current.episodeIdx < current.novel.episodes.length - 1);
}

function hasPrevEpisode(current) {
  return !!(current?.episode && Array.isArray(current?.novel?.episodes) && current.episodeIdx > 0);
}

function isReaderAtEpisodeTop(app, tolerancePx = 2) {
  const reader = app?.els?.reader || null;
  const c = app?.state?.current || null;
  if (!reader || !c || !hasPrevEpisode(c)) return false;
  if (app.state.readerEpisodeBoundaryOpening) return false;
  return Math.max(0, Number(reader.scrollTop) || 0) <= Math.max(0, Number(tolerancePx) || 0);
}

function isReaderAtEpisodeBottom(app, tolerancePx = 2) {
  const reader = app?.els?.reader || null;
  const c = app?.state?.current || null;
  if (!reader || !c || !hasNextEpisode(c)) return false;
  if (app.state.readerEpisodeBoundaryOpening) return false;
  const chunks = Array.from(app.state.loadedChunks?.keys?.() || []).map(Number).filter(Number.isFinite);
  const maxLoadedChunk = chunks.length ? Math.max(...chunks) : Number(c.chunk) || 1;
  const totalChunks = Math.max(1, Number(c.totalChunks) || 1);
  if (maxLoadedChunk < totalChunks) return false;
  const maxTop = Math.max(0, (Number(reader.scrollHeight) || 0) - (Number(reader.clientHeight) || 0));
  return Math.max(0, maxTop - (Number(reader.scrollTop) || 0)) <= Math.max(0, Number(tolerancePx) || 0);
}

function isEpisodeBoundaryTransitionLocked(app) {
  const until = Number(app?.state?.readerEpisodeBoundaryCooldownUntil) || 0;
  return !!app?.state?.readerEpisodeBoundaryOpening || Date.now() < until;
}

function recordEpisodeBoundaryTransitionBlocked(app, payload = {}) {
  const v = ensureVirtualState(app);
  v.episodeBoundaryLockPass = READER_EPISODE_BOUNDARY_LOCK_PASS;
  v.lastEpisodeBoundaryLock = {
    pass: READER_EPISODE_BOUNDARY_LOCK_PASS,
    ...payload,
    at: Date.now()
  };
}

async function openNextEpisodeFromBoundary(app, source = 'boundary') {
  const c = app.state.current;
  if (!hasNextEpisode(c)) return false;
  const v = ensureVirtualState(app);
  const key = `${c.novel.id}:${c.episode?.id || 'single'}:${c.episodeIdx}:next`;
  if (isEpisodeBoundaryTransitionLocked(app)) {
    recordEpisodeBoundaryTransitionBlocked(app, { key, source: String(source || 'boundary'), reason: 'transition already opening or cooling down' });
    return false;
  }
  if (v.episodeBoundaryOpenKey === key && Date.now() - (Number(v.episodeBoundaryOpenAt) || 0) < 1600) {
    recordEpisodeBoundaryTransitionBlocked(app, { key, source: String(source || 'boundary'), reason: 'same episode boundary duplicate' });
    return false;
  }
  app.state.readerEpisodeBoundaryOpening = true;
  app.state.readerEpisodeBoundaryCooldownUntil = Date.now() + 1800;
  v.episodeBoundaryOpenKey = key;
  v.episodeBoundaryOpenAt = Date.now();
  v.episodeBoundaryModePass = READER_EPISODE_BOUNDARY_SCROLL_BEYOND_PASS;
  v.episodeBoundaryLockPass = READER_EPISODE_BOUNDARY_LOCK_PASS;
  v.lastEpisodeBoundaryOpen = {
    pass: READER_EPISODE_BOUNDARY_SCROLL_BEYOND_PASS,
    lockPass: READER_EPISODE_BOUNDARY_LOCK_PASS,
    mode: getReaderEpisodeBoundaryMode(app),
    source: String(source || 'boundary'),
    fromEpisodeId: c.episode?.id || '',
    fromEpisodeIdx: Number(c.episodeIdx) || 0,
    at: Date.now()
  };
  const nextEp = c.novel.episodes[c.episodeIdx + 1];
  status(app, 'reader', '다음 화로 이동');
  try {
    await openNovel(app, c.novel, { episodeId: nextEp.id, chunk: 1 });
    return true;
  } finally {
    app.state.readerEpisodeBoundaryOpening = false;
    app.state.readerEpisodeBoundaryCooldownUntil = Date.now() + 1800;
  }
}

async function openPrevEpisodeFromBoundary(app, source = 'boundary') {
  const c = app.state.current;
  if (!hasPrevEpisode(c)) return false;
  const v = ensureVirtualState(app);
  const key = `${c.novel.id}:${c.episode?.id || 'single'}:${c.episodeIdx}:prev`;
  if (isEpisodeBoundaryTransitionLocked(app)) {
    recordEpisodeBoundaryTransitionBlocked(app, { key, source: String(source || 'boundary'), reason: 'transition already opening or cooling down' });
    return false;
  }
  if (v.episodeBoundaryOpenKey === key && Date.now() - (Number(v.episodeBoundaryOpenAt) || 0) < 1600) {
    recordEpisodeBoundaryTransitionBlocked(app, { key, source: String(source || 'boundary'), reason: 'same episode boundary duplicate' });
    return false;
  }
  app.state.readerEpisodeBoundaryOpening = true;
  app.state.readerEpisodeBoundaryCooldownUntil = Date.now() + 1800;
  v.episodeBoundaryOpenKey = key;
  v.episodeBoundaryOpenAt = Date.now();
  v.episodeBoundaryPrevPullPass = READER_EPISODE_BOUNDARY_PREV_PULL_PASS;
  v.episodeBoundaryModePass = READER_EPISODE_BOUNDARY_SCROLL_BEYOND_PASS;
  v.episodeBoundaryLockPass = READER_EPISODE_BOUNDARY_LOCK_PASS;
  v.lastEpisodeBoundaryOpen = {
    pass: READER_EPISODE_BOUNDARY_PREV_PULL_PASS,
    legacyPass: READER_EPISODE_BOUNDARY_SCROLL_BEYOND_PASS,
    lockPass: READER_EPISODE_BOUNDARY_LOCK_PASS,
    mode: getReaderEpisodeBoundaryMode(app),
    source: String(source || 'boundary'),
    fromEpisodeId: c.episode?.id || '',
    fromEpisodeIdx: Number(c.episodeIdx) || 0,
    direction: 'prev',
    at: Date.now()
  };
  const prevEp = c.novel.episodes[c.episodeIdx - 1];
  status(app, 'reader', '이전 화로 이동');
  try {
    await openNovel(app, c.novel, { episodeId: prevEp.id, chunk: -1, ratio: 1 });
    return true;
  } finally {
    app.state.readerEpisodeBoundaryOpening = false;
    app.state.readerEpisodeBoundaryCooldownUntil = Date.now() + 1800;
  }
}

function maybeOpenNextEpisodeFromBottomOverscroll(app, event = null) {
  if (getReaderEpisodeBoundaryMode(app) !== 'scrollBeyond') return false;
  const deltaY = Number(event?.deltaY) || 0;
  if (deltaY <= 0) return false;
  if (!isReaderAtEpisodeBottom(app, 2)) return false;
  openNextEpisodeFromBoundary(app, 'bottom-overscroll-wheel');
  return true;
}

function maybeOpenPrevEpisodeFromTopOverscroll(app, event = null) {
  if (getReaderEpisodeBoundaryMode(app) !== 'scrollBeyond') return false;
  const deltaY = Number(event?.deltaY) || 0;
  if (deltaY >= 0) return false;
  if (!isReaderAtEpisodeTop(app, 2)) return false;
  openPrevEpisodeFromBoundary(app, 'top-overscroll-wheel');
  return true;
}

function maybeOpenEpisodeFromWheelBoundary(app, event = null) {
  return maybeOpenPrevEpisodeFromTopOverscroll(app, event) || maybeOpenNextEpisodeFromBottomOverscroll(app, event);
}

function ensureEpisodeBoundaryPullIndicator(app) {
  let dock = document.getElementById('episode-boundary-pull-indicator');
  if (dock) return dock;
  dock = document.createElement('div');
  dock.id = 'episode-boundary-pull-indicator';
  dock.dataset.readerOverlayPass = READER_EPISODE_BOUNDARY_PULL_INDICATOR_PASS;
  dock.dataset.readerOverlayRole = 'episode-boundary-pull-indicator';
  dock.dataset.boundaryPullPass = READER_EPISODE_BOUNDARY_PULL_CONFIRM_PASS;
  dock.dataset.prevBoundaryTopIndicatorPass = READER_PREV_BOUNDARY_TOP_INDICATOR_PASS;
  dock.setAttribute('aria-hidden', 'true');
  dock.innerHTML = '<div class="boundary-pull-card"><div class="boundary-pull-ring" aria-hidden="true"><div class="boundary-pull-ring-inner">↓</div></div><div class="boundary-pull-copy"><div class="boundary-pull-title">→ 다음화로</div><div class="boundary-pull-meta">조금 더 끌어당긴 뒤 손을 떼세요</div></div></div>';
  document.body.appendChild(dock);
  return dock;
}

function resetEpisodeBoundaryPull(app, options = {}) {
  if (!app?.state) return;
  app.state.readerEpisodeBoundaryPull = {
    active: false,
    engaged: false,
    startY: 0,
    currentY: 0,
    progress: 0,
    armed: false,
    thresholdPx: READER_EPISODE_BOUNDARY_PULL_THRESHOLD_PX,
    reason: String(options.reason || 'reset')
  };
  if (options.hide !== false) {
    const dock = document.getElementById('episode-boundary-pull-indicator');
    if (dock) {
      dock.dataset.state = 'hidden';
      dock.dataset.armed = 'false';
      dock.style.removeProperty('--boundary-pull-progress');
      dock.setAttribute('aria-hidden', 'true');
    }
  }
}

function updateEpisodeBoundaryPullIndicator(app, progress = 0, armed = false, direction = 'next') {
  const dock = ensureEpisodeBoundaryPullIndicator(app);
  const dir = direction === 'prev' ? 'prev' : 'next';
  dock.dataset.state = progress > 0 ? 'visible' : 'hidden';
  dock.dataset.armed = armed ? 'true' : 'false';
  dock.dataset.direction = dir;
  dock.dataset.prevBoundaryTopIndicatorPass = READER_PREV_BOUNDARY_TOP_INDICATOR_PASS;
  dock.style.setProperty('--boundary-pull-progress', String(clamp(progress, 0, 1)));
  const title = dock.querySelector('.boundary-pull-title');
  const icon = dock.querySelector('.boundary-pull-ring-inner');
  const meta = dock.querySelector('.boundary-pull-meta');
  if (title) title.textContent = dir === 'prev' ? '← 이전화로' : '→ 다음화로';
  if (icon) icon.textContent = dir === 'prev' ? '↑' : '↓';
  if (meta) meta.textContent = armed ? `손을 떼면 ${dir === 'prev' ? '이전' : '다음'} 화로 이동합니다` : '조금 더 끌어당긴 뒤 손을 떼세요';
  dock.setAttribute('aria-hidden', progress > 0 ? 'false' : 'true');
}

function installReaderBottomTouchBoundary(app, { on } = {}) {
  const reader = app?.els?.reader || null;
  if (!reader || typeof on !== 'function') return;
  resetEpisodeBoundaryPull(app, { hide: true, reason: 'install' });
  const touch = { y: 0, at: 0, startY: 0 };
  const finishPull = () => {
    const state = app?.state?.readerEpisodeBoundaryPull || null;
    const armed = !!state?.armed;
    const direction = String(state?.direction || 'next');
    resetEpisodeBoundaryPull(app, { hide: true, reason: 'touch-end' });
    if (!armed || getReaderEpisodeBoundaryMode(app) !== 'scrollBeyond') return;
    if (direction === 'prev' && isReaderAtEpisodeTop(app, 2)) {
      openPrevEpisodeFromBoundary(app, 'top-pull-release');
    } else if (direction === 'next' && isReaderAtEpisodeBottom(app, 2)) {
      openNextEpisodeFromBoundary(app, 'bottom-pull-release');
    }
  };
  on(reader, 'touchstart', ev => {
    const first = ev.touches?.[0] || ev.changedTouches?.[0];
    const y = Number(first?.clientY) || 0;
    touch.y = y;
    touch.startY = y;
    touch.at = Date.now();
    resetEpisodeBoundaryPull(app, { hide: true, reason: 'touch-start' });
  }, { passive: true });
  on(reader, 'touchmove', ev => {
    const first = ev.touches?.[0] || ev.changedTouches?.[0];
    const y = Number(first?.clientY) || 0;
    const deltaY = touch.y - y;
    touch.y = y;
    if (Date.now() - touch.at > 5000) {
      resetEpisodeBoundaryPull(app, { hide: true, reason: 'expired' });
      return;
    }
    const direction = deltaY > 0 ? 'next' : deltaY < 0 ? 'prev' : '';
    if (!direction) return;
    if (getReaderEpisodeBoundaryMode(app) !== 'scrollBeyond') {
      resetEpisodeBoundaryPull(app, { hide: true, reason: 'mode-disabled' });
      return;
    }
    const validBoundary = direction === 'prev'
      ? hasPrevEpisode(app?.state?.current) && isReaderAtEpisodeTop(app, 2)
      : hasNextEpisode(app?.state?.current) && isReaderAtEpisodeBottom(app, 2);
    if (!validBoundary) {
      resetEpisodeBoundaryPull(app, { hide: true, reason: direction === 'prev' ? 'not-top' : 'not-bottom' });
      return;
    }
    const pull = app.state.readerEpisodeBoundaryPull || (app.state.readerEpisodeBoundaryPull = {});
    if (pull.active && pull.direction && pull.direction !== direction) {
      resetEpisodeBoundaryPull(app, { hide: true, reason: 'direction-changed' });
      return;
    }
    if (!pull.active) {
      pull.active = true;
      pull.engaged = true;
      pull.direction = direction;
      pull.startY = y;
      pull.thresholdPx = READER_EPISODE_BOUNDARY_PULL_THRESHOLD_PX;
    }
    pull.currentY = y;
    const pullDistance = direction === 'prev' ? Math.max(0, y - Number(pull.startY)) : Math.max(0, Number(pull.startY) - y);
    const progress = clamp(pullDistance / Math.max(1, pull.thresholdPx || READER_EPISODE_BOUNDARY_PULL_THRESHOLD_PX), 0, 1);
    pull.progress = progress;
    pull.armed = progress >= 0.999;
    ensureVirtualState(app).lastEpisodeBoundaryPullConfirm = {
      pass: direction === 'prev' ? READER_EPISODE_BOUNDARY_PREV_PULL_PASS : READER_EPISODE_BOUNDARY_PULL_CONFIRM_PASS,
      source: 'touchmove',
      direction,
      pullDistance: Math.round(pullDistance),
      thresholdPx: pull.thresholdPx,
      progress,
      armed: !!pull.armed,
      at: Date.now()
    };
    updateEpisodeBoundaryPullIndicator(app, progress, !!pull.armed, direction);
  }, { passive: true });
  on(reader, 'touchend', finishPull, { passive: true });
  on(reader, 'touchcancel', finishPull, { passive: true });
}


function markNavSliderSeeking(app, active) {
  if (!app?.state) return;
  app.state.navSliderSeeking = !!active;
  if (app.els?.navSlider?.dataset) app.els.navSlider.dataset.navSliderSeeking = active ? 'true' : 'false';
}

function rememberNavSliderPendingCommit(app, ratio = 0, trigger = 'input') {
  if (!app?.state) return;
  const safeRatio = clamp(ratio, 0, 1);
  app.state.navSliderPendingCommit = true;
  app.state.navSliderPendingRatio = safeRatio;
  app.state.lastNavSliderPendingCommit = {
    pass: READER_NAV_SLIDER_RELEASE_COMMIT_PASS,
    trigger,
    ratio: safeRatio,
    bucket: Math.round(safeRatio * 1000),
    at: Date.now()
  };
}

function commitNavSliderRelease(app, trigger = 'release') {
  if (!app?.state) return;
  const pending = app.state.navSliderPendingCommit === true;
  const ratio = Number.isFinite(Number(app.state.navSliderPendingRatio))
    ? Number(app.state.navSliderPendingRatio)
    : (Number(app.els?.navSlider?.value) || 0) / 1000;
  if (pending) {
    commitNavSliderPosition(app, ratio, trigger);
    return;
  }
  markNavSliderSeeking(app, false);
}

async function commitNavSliderPosition(app, ratio = 0, trigger = 'change') {
  if (!app?.state) return;
  const safeRatio = clamp(ratio, 0, 1);
  const bucket = Math.round(safeRatio * 1000);
  const inFlight = app.state.navSliderCommitInFlight || null;
  if (inFlight) {
    app.state.navSliderQueuedCommit = {
      pass: READER_NAV_SLIDER_RELEASE_COMMIT_PASS,
      trigger,
      ratio: safeRatio,
      bucket,
      at: Date.now()
    };
    app.state.navSliderPendingCommit = false;
    return;
  }
  app.state.navSliderPendingCommit = false;
  app.state.navSliderCommitInFlight = {
    pass: READER_NAV_SLIDER_RELEASE_COMMIT_PASS,
    trigger,
    ratio: safeRatio,
    bucket,
    at: Date.now()
  };
  app.state.lastNavSliderReleaseCommit = {
    pass: READER_NAV_SLIDER_RELEASE_COMMIT_PASS,
    phase: 'start',
    trigger,
    ratio: safeRatio,
    bucket,
    at: Date.now()
  };
  try {
    await goSliderPosition(app, safeRatio, { trigger });
  } finally {
    const queued = app.state.navSliderQueuedCommit || null;
    app.state.navSliderCommitInFlight = null;
    app.state.navSliderQueuedCommit = null;
    app.state.lastNavSliderReleaseCommit = {
      pass: READER_NAV_SLIDER_RELEASE_COMMIT_PASS,
      phase: 'finish',
      trigger,
      ratio: safeRatio,
      bucket,
      queued: !!queued,
      at: Date.now()
    };
    if (queued && Math.abs(Number(queued.ratio) - safeRatio) > 0.0015) {
      commitNavSliderPosition(app, queued.ratio, queued.trigger || 'queued');
    }
  }
}

function previewSliderPosition(app, ratio = 0) {
  const safeRatio = clamp(ratio, 0, 1);
  const c = app.state.current;
  if (app.els.navSlider) {
    app.els.navSlider.title = c?.episode ? `현재 화 위치 ${formatPercent(safeRatio, 1)}` : `위치 ${formatPercent(safeRatio, 1)}`;
    app.els.navSlider.dataset.readerSliderRatioAnchorPass = READER_SLIDER_RATIO_SCROLL_ANCHOR_PASS;
  }
  if (!c || !app.els.navInfo) return;
  const prefix = c.episode ? `${c.episodeIdx + 1}/${c.novel.episodes.length}화 · ` : '';
  app.els.navInfo.textContent = `${prefix}현재 위치 ${formatPercent(safeRatio, 1)}`;
  app.state.lastNavSliderPreview = { pass: 'v367-nav-slider-live-preview-pass', ratio: safeRatio, mode: c?.episode ? 'current-episode' : 'single', at: Date.now() };
}

async function goSliderPosition(app, ratio = 0, meta = {}) {
  const safeRatio = clamp(ratio, 0, 1);
  const c = app.state.current;
  const v = ensureVirtualState(app);
  v.sliderRatioScrollAnchorPass = READER_SLIDER_RATIO_SCROLL_ANCHOR_PASS;
  v.lastSliderRatioScrollAnchor = { pass: READER_SLIDER_RATIO_SCROLL_ANCHOR_PASS, releaseCommitPass: READER_NAV_SLIDER_RELEASE_COMMIT_PASS, directAnchorPass: READER_SLIDER_BLOCK_DIRECT_ANCHOR_PASS, source: 'nav-slider', trigger: String(meta?.trigger || ''), ratio: safeRatio, at: Date.now() };
  if (c?.episode && c?.novel?.isMultiFile) {
    v.multiFileLocalSliderPass = READER_MULTI_FILE_LOCAL_SLIDER_PASS;
    v.lastMultiFileLocalSlider = { pass: READER_MULTI_FILE_LOCAL_SLIDER_PASS, releaseCommitPass: READER_NAV_SLIDER_RELEASE_COMMIT_PASS, episodeId: c.episode.id, trigger: String(meta?.trigger || ''), ratio: safeRatio, at: Date.now() };
  }
  markNavSliderSeeking(app, true);
  try {
    await goPercent(app, safeRatio, { source: 'nav-slider', forceBlockTarget: true, directBlockScroll: true });
  } finally {
    markNavSliderSeeking(app, false);
    if (v.pendingSliderMeasureTarget) {
      app.state.lastNavSliderMeasuredProgressRefresh = { pass: READER_SLIDER_MEASURED_CHAR_ANCHOR_PASS, pending: true, ratio: safeRatio, at: Date.now() };
      window.clearTimeout(app.state.readerSliderMeasureRefreshTimer || 0);
      const refreshSessionId = app.state.readerSessionId;
      const refreshCurrent = app.state.current;
      app.state.readerSliderMeasureRefreshTimer = window.setTimeout(() => {
        app.state.readerSliderMeasureRefreshTimer = 0;
        if (refreshSessionId === app.state.readerSessionId && refreshCurrent === app.state.current) updateProgressFromViewport(app);
      }, 80);
    } else {
      updateProgressFromViewport(app);
    }
  }
}

async function goRelative(app, dir) {
  const c = app.state.current;
  if (!c) return;
  let nextChunk = (getVisibleChunk(app) || c.chunk) + dir;
  if (nextChunk < 1 && c.episode && c.episodeIdx > 0) {
    const prevEp = c.novel.episodes[c.episodeIdx - 1];
    await openNovel(app, c.novel, { episodeId: prevEp.id, chunk: -1 });
    return;
  }
  if (nextChunk > c.totalChunks && c.episode && c.episodeIdx < c.novel.episodes.length - 1) {
    const nextEp = c.novel.episodes[c.episodeIdx + 1];
    await openNovel(app, c.novel, { episodeId: nextEp.id, chunk: 1 });
    return;
  }
  nextChunk = clamp(nextChunk, 1, c.totalChunks);
  await goChunkInternal(app, nextChunk);
}

async function goChunkInternal(app, chunk, options = {}) {
  const c = app.state.current;
  if (!c) return;
  resetReaderRequestScope(app);
  app.state.loadedChunks.clear();
  if (!options.keepHighlight) app.state.search.highlights = null;
  resetVirtualDocument(app, { clearMeasures: false });
  const intent = buildReaderChunkNavigationIntent(chunk, options);
  await loadChunk(app, intent.chunk, 'replace', intent.loadOptions);
  status(app, 'reader', intent.statusMessage);
  warmAdjacentChunks(app, (nextChunk, mode, nextOptions) => loadChunk(app, nextChunk, mode, nextOptions), { centerChunk: app.state.current?.chunk, direction: intent.warmDirection });
}

async function goBlock(app, globalBlockIndex = 0, options = {}) {
  await ensureBlockManifest(app);
  const target = resolveGlobalBlock(app, globalBlockIndex);
  if (!app.state.loadedChunks.has(target.chunk)) {
    await goChunkInternal(app, target.chunk, {
      targetAddress: { globalBlockIndex: target.globalBlockIndex, blockIndex: target.blockIndex, charIndex: options.charIndex, align: options.align || 'start' }
    });
    return;
  }
  scrollToVirtualTarget(app, {
    chunk: target.chunk,
    globalBlockIndex: target.globalBlockIndex,
    blockIndex: target.blockIndex,
    charIndex: options.charIndex,
    align: options.align || 'start'
  });
  status(app, 'reader', `블럭 ${target.globalBlockIndex + 1}로 이동`);
}

async function goEpisode(app, episodeId, options = {}) {
  const c = app.state.current;
  if (!c || !c.episode || !Array.isArray(c.novel?.episodes)) return;
  const targetEpisodeId = String(episodeId || '').trim();
  const targetEpisode = c.novel.episodes.find(episode => episode.id === targetEpisodeId);
  if (!targetEpisode) return toast(app, 'error', '위치 이동', '화 정보를 찾을 수 없습니다.');
  if (targetEpisode.id === c.episode.id) {
    if (options.globalBlockIndex != null) {
      await goBlock(app, options.globalBlockIndex, options);
      return;
    }
    await goPercent(app, options.ratio ?? 0, options);
    return;
  }
  const v = ensureVirtualState(app);
  v.jumpPanelEpisodeSelectPass = READER_JUMP_PANEL_EPISODE_SELECT_PASS;
  v.lastJumpPanelEpisodeSelect = {
    pass: READER_JUMP_PANEL_EPISODE_SELECT_PASS,
    fromEpisodeId: c.episode?.id || '',
    toEpisodeId: targetEpisode.id,
    mode: options.globalBlockIndex != null ? 'block' : 'ratio',
    at: Date.now()
  };
  await openNovel(app, c.novel, {
    episodeId: targetEpisode.id,
    chunk: 1,
    ratio: clamp(options.ratio ?? 0, 0, 1),
    globalBlockIndex: options.globalBlockIndex,
    charIndex: options.charIndex,
    align: options.align || 'start'
  });
  status(app, 'reader', `${targetEpisode.title || '선택한 화'}로 이동`);
}

async function goPercent(app, ratio = 0, options = {}) {
  await ensureBlockManifest(app);
  const safeRatio = clamp(ratio, 0, 1);
  const current = app.state.current;
  const source = options.source || 'percent';
  const target = ratioToChunkTarget(app, safeRatio);
  const useBlockTarget = options.forceBlockTarget === true;
  const navSliderCharTarget = source === 'nav-slider' && useBlockTarget && Number.isFinite(Number(target.globalBlockIndex));
  if (safeRatio >= 0.999 && current && !navSliderCharTarget) {
    await goChunkInternal(app, Math.max(1, Number(current.totalChunks) || 1), {
      ratio: 1,
      keepHighlight: !!options.keepHighlight,
      statusMessage: '마지막 위치로 이동',
      source
    });
    return;
  }
  if (Number.isFinite(Number(target.globalBlockIndex)) && useBlockTarget) {
    const targetAddress = {
      globalBlockIndex: target.globalBlockIndex,
      blockIndex: target.blockIndex,
      charIndex: target.charIndex,
      charAnchor: source === 'nav-slider' && Number.isFinite(Number(target.charIndex)),
      sliderCharTargetPass: source === 'nav-slider' ? READER_SLIDER_CHAR_TARGET_ANCHOR_PASS : '',
      sliderMeasuredCharAnchorPass: source === 'nav-slider' ? READER_SLIDER_MEASURED_CHAR_ANCHOR_PASS : '',
      sliderTerminal: source === 'nav-slider' && safeRatio >= 0.999,
      documentRatio: target.documentRatio,
      ratio: safeRatio,
      align: options.align || (source === 'nav-slider' && safeRatio >= 0.999 ? 'end' : 'start'),
      directScroll: options.directBlockScroll === true,
      directAnchorPass: options.directBlockScroll === true ? READER_SLIDER_BLOCK_DIRECT_ANCHOR_PASS : ''
    };
    const targetChunk = Math.max(1, Number(target.chunk) || Number(current?.chunk) || 1);
    const loaded = !!app.state.loadedChunks?.has?.(targetChunk);
    const rowsReady = loaded && hasVirtualChunkRows(app, targetChunk);
    if (source === 'nav-slider' && rowsReady) {
      const v = ensureVirtualState(app);
      v.navSliderInWindowJumpPass = READER_NAV_SLIDER_IN_WINDOW_JUMP_PASS;
      v.lastNavSliderInWindowJump = {
        pass: READER_NAV_SLIDER_IN_WINDOW_JUMP_PASS,
        chunk: targetChunk,
        ratio: safeRatio,
        globalBlockIndex: Number.isFinite(Number(target.globalBlockIndex)) ? Math.round(Number(target.globalBlockIndex)) : null,
        charIndex: Number.isFinite(Number(target.charIndex)) ? Math.round(Number(target.charIndex)) : null,
        reason: 'nav slider uses in-window virtual target when the target chunk is already loaded, avoiding replace-load guards resetting to the first block',
        at: Date.now()
      };
      scrollToVirtualTarget(app, { ...targetAddress, chunk: targetChunk, source });
      return;
    }
    await goChunkInternal(app, targetChunk, {
      targetAddress,
      keepHighlight: !!options.keepHighlight,
      source
    });
    return;
  }
  await goChunkInternal(app, target.chunk, {
    ratio: target.ratio,
    keepHighlight: !!options.keepHighlight,
    align: options.align || 'start',
    source
  });
}

async function goPosition(app, address = {}) {
  if (address.globalBlockIndex != null && address.chunk == null) {
    await goBlock(app, address.globalBlockIndex, { charIndex: address.charIndex, align: address.align || 'center' });
    return;
  }
  const targetChunk = Number(address.chunk) || Number(app.state.current?.chunk) || 1;
  const loaded = app.state.loadedChunks.has(targetChunk);
  const rowsReady = loaded && hasVirtualChunkRows(app, targetChunk);
  if (!loaded || !rowsReady) {
    app.state.lastReaderSearchJump = {
      pass: READER_SEARCH_JUMP_STABILITY_PASS,
      targetChunk,
      loaded,
      rowsReady,
      mode: 'replace-load',
      at: Date.now()
    };
    await goChunkInternal(app, targetChunk, {
      keepHighlight: !!address.keepHighlight,
      searchIndex: address.searchIndex,
      query: address.query,
      globalBlockIndex: address.globalBlockIndex,
      blockIndex: address.blockIndex,
      charIndex: address.charIndex,
      align: address.align || 'center'
    });
    return;
  }
  app.state.lastReaderSearchJump = {
    pass: READER_SEARCH_JUMP_STABILITY_PASS,
    targetChunk,
    loaded,
    rowsReady,
    mode: 'in-window-scroll',
    at: Date.now()
  };
  scrollToVirtualTarget(app, address);
}

async function goSearchResult(app, result) {
  if (!result) return;
  const current = app.state.current || null;
  const query = String(result.query || app.state.search.query || '');
  const targetEpisodeId = result.episodeId == null ? null : String(result.episodeId);
  const currentEpisodeId = current?.episode?.id == null ? null : String(current.episode.id);
  const targetChunk = Math.max(1, Number(result.chunk) || 1);
  const searchIndex = Math.max(0, Number(result.index) || 0);
  const matchLength = Number(result.matchLength) || query.length;
  app.state.search.highlights = {
    chunk: targetChunk,
    query,
    index: searchIndex,
    matchLength
  };
  if (targetEpisodeId && current?.episode && targetEpisodeId !== currentEpisodeId && Array.isArray(current?.novel?.episodes)) {
    const targetEpisode = current.novel.episodes.find(episode => String(episode?.id || '') === targetEpisodeId) || null;
    if (!targetEpisode) return;
    const v = ensureVirtualState(app);
    v.searchMultiEpisodeJumpPass = READER_SEARCH_MULTI_EPISODE_JUMP_PASS;
    v.lastSearchMultiEpisodeJump = {
      pass: READER_SEARCH_MULTI_EPISODE_JUMP_PASS,
      fromEpisodeId: currentEpisodeId || '',
      toEpisodeId: targetEpisodeId,
      chunk: targetChunk,
      searchIndex,
      at: Date.now()
    };
    await openNovel(app, current.novel, {
      episodeId: targetEpisode.id,
      chunk: targetChunk,
      searchIndex,
      query,
      matchLength,
      keepHighlight: true,
      preserveSearchSession: true,
      align: 'center'
    });
    return;
  }
  await goPosition(app, {
    chunk: targetChunk,
    searchIndex,
    query,
    matchLength,
    keepHighlight: true,
    align: 'center'
  });
}

function invalidateVirtualLayout(app, options = {}) {
  const reason = String(options.reason || 'reader layout invalidated by resize or viewport transition');
  if (options.preserveViewportAnchor === true) captureReaderViewportTransitionAnchor(app, reason);
  clearPendingSliderMeasureTarget(app, { phase: 'viewport-transition', reason, clearProgrammaticScroll: true });
  invalidateVirtualLayoutCore(app);
  if (options.preserveViewportAnchor === true) restoreReaderViewportTransitionAnchor(app, reason);
  updateProgressFromViewport(app);
}

function captureReaderViewportTransitionAnchor(app, reason = 'viewport-transition', options = {}) {
  const v = ensureVirtualState(app);
  if (!app?.state?.current || !app?.els?.reader) return null;
  const pending = v.pendingViewportTransitionAnchor || null;
  const pendingAge = pending?.createdAt ? Date.now() - Number(pending.createdAt) : Infinity;
  if (pending?.anchor && options.force !== true && pendingAge <= 1800) return pending.anchor;
  const anchor = captureVirtualViewportAnchor(app, { source: 'viewport-transition', reason });
  if (!anchor) return null;
  v.viewportTransitionAnchorPass = READER_VIEWPORT_TRANSITION_ANCHOR_PASS;
  v.pendingViewportTransitionAnchor = {
    pass: READER_VIEWPORT_TRANSITION_ANCHOR_PASS,
    anchor,
    reason: String(reason || 'viewport-transition'),
    createdAt: Date.now(),
    restoreCount: 0,
    restoreTicket: 0
  };
  v.lastViewportTransitionAnchor = {
    pass: READER_VIEWPORT_TRANSITION_ANCHOR_PASS,
    phase: 'capture',
    reason: String(reason || 'viewport-transition'),
    rowId: anchor.rowId || '',
    rowIndex: Number.isFinite(Number(anchor.rowIndex)) ? Number(anchor.rowIndex) : -1,
    offsetPx: Math.round(Number(anchor.offsetPx) || 0),
    scrollTop: Math.round(Number(app.els.reader.scrollTop) || 0),
    at: Date.now()
  };
  return anchor;
}

function restoreReaderViewportTransitionAnchor(app, reason = 'viewport-transition') {
  const v = ensureVirtualState(app);
  const pending = v.pendingViewportTransitionAnchor || null;
  if (!pending?.anchor) return false;
  const createdAt = Number(pending.createdAt) || 0;
  if (createdAt && Date.now() - createdAt > 1800) {
    v.pendingViewportTransitionAnchor = null;
    v.lastViewportTransitionAnchor = {
      pass: READER_VIEWPORT_TRANSITION_ANCHOR_PASS,
      phase: 'expired',
      reason: String(reason || pending.reason || 'viewport-transition'),
      at: Date.now()
    };
    return false;
  }
  const ticket = Date.now() + Math.random();
  pending.restoreTicket = ticket;
  const delays = [0, 80, 180, 360];
  for (const timer of v.viewportTransitionTimers || []) window.clearTimeout(timer);
  v.viewportTransitionTimers = delays.map((delay, index) => window.setTimeout(() => {
      const active = v.pendingViewportTransitionAnchor || null;
      if (!active?.anchor || active.restoreTicket !== ticket) return;
      scheduleVirtualRender(app);
      const result = restoreVirtualViewportAnchor(app, active.anchor, {
        source: 'viewport-transition',
        reason: String(reason || active.reason || 'viewport-transition'),
        explicit: true
      });
      active.restoreCount = Math.max(0, Number(active.restoreCount) || 0) + 1;
      v.lastViewportTransitionAnchor = {
        pass: READER_VIEWPORT_TRANSITION_ANCHOR_PASS,
        phase: 'restore',
        reason: String(reason || active.reason || 'viewport-transition'),
        delayMs: delay,
        restoreCount: active.restoreCount,
        applied: result?.applied === true,
        resultReason: String(result?.reason || ''),
        rowId: active.anchor.rowId || '',
        rowIndex: Number.isFinite(Number(active.anchor.rowIndex)) ? Number(active.anchor.rowIndex) : -1,
        scrollTop: Math.round(Number(app?.els?.reader?.scrollTop) || 0),
        at: Date.now()
      };
      if (index === delays.length - 1) {
        v.pendingViewportTransitionAnchor = null;
        v.viewportTransitionTimers = [];
      }
    }, delay));
  return true;
}
