import { setButtonBusy } from '../core/utils.mjs';
import { status, toast } from './ui.mjs';
import { MAX_RESULTS, SEARCH_FULL_SCAN_DIAGNOSTICS_PASS, buildSearchCompletionSummary, buildSearchCoveragePreview, getSearchProcessedCount, loadSearchServerPerformanceProfile, prewarmSearchWorker, searchAllChunks, searchLoadedChunks, searchSelectedChunks } from './search/matcher.mjs';
import { renderResults as renderSearchResults } from './search/results-view.mjs';
import { updateSearchRetryBar } from './search/status-panel.mjs';
import { buildSearchStatusSuffix, describeCoveragePreview } from './search/status-formatters.mjs';
import { buildSearchRemoteHint, buildSearchResultCountLabel } from './search/result-labels.mjs';
import { applyRemotePosition, installSearchRemoteDrag } from './search/remocon-ui.mjs';
import { getVisibleSearchResultIndexes, handleSearchFilterClick as handleSearchFilterControlClick, hasFullSearchPermission, updateSearchModeControls } from './search/filter-controls.mjs';
import { buildSearchJumpLiveFieldValidation, buildSearchJumpMessage, validateLastSearchJumpRetry } from './search/jump-status.mjs';
import { announceSearchJumpStatus } from './search/announcement-formatters.mjs';
import { ensureActiveSearchResultVisible, syncSearchNavigationButtons } from './search/navigation-ui.mjs';
import { buildSearchJumpInfo } from './search/jump-info.mjs';
import { clearSearchJumpRuntimeStateFields } from './search/session-reset.mjs';
import { handleSearchRetrybarClick as dispatchSearchRetrybarClick } from './search/retry-dispatcher.mjs';
import { resetSearchRuntimeForReaderChange, resetSearchRuntimeSession } from './search/session-runtime.mjs';
import { beginSearchRun, buildSearchRunRequest, finishSearchRun } from './search/run-actions.mjs';
import { beginSearchRetry, buildSearchRetryDoneMessage, buildSearchRetryRequest, finishSearchRetry } from './search/retry-actions.mjs';
import { isShortcut } from './settings/shortcuts.mjs';

const SEARCH_FULL_SCAN_UX_PASS = 'v150-search-full-scan-ux-pass';
const SEARCH_RESULT_JUMP_VALIDATION_PASS = 'v151-search-result-jump-validation-pass';
const SEARCH_JUMP_UX_PASS = 'v152-search-jump-ux-pass';
const SEARCH_JUMP_FAILURE_RECOVERY_PASS = 'v152-search-jump-failure-recovery-pass';
const SEARCH_LIVE_FIELD_VALIDATION_PASS = 'v153-search-live-field-validation-pass';
const SEARCH_SESSION_CLEANUP_PASS = 'v154-search-session-cleanup-pass';
const SEARCH_CONTEXT_RESET_PASS = 'v155-search-context-reset-pass';
const SEARCH_CONTEXT_RESET_ON_READER_CHANGE_PASS = 'v155-search-reset-on-reader-change-pass';
const SEARCH_REMOCON_CLOSE_RESET_PASS = 'v155-search-remocon-close-reset-pass';
const SEARCH_REMOTE_PILL_COMPACTION_PASS = 'v349-search-remote-pill-compaction-pass';
const SEARCH_MULTI_EPISODE_RESULT_JUMP_PASS = 'v363-search-multi-episode-result-jump-pass';
const SEARCH_CONTINUE_DURING_NAVIGATION_PASS = 'v365-search-continue-during-navigation-pass';
const SEARCH_COMPACT_STATUS_PASS = 'v366-search-compact-status-pass';
const SEARCH_CACHE_ONLY_CLIENT_UX_PASS = 'v398-search-cache-only-client-ux-pass';
const SEARCH_MODAL_CLOSE_ABORT_PASS = 'v509-search-modal-close-abort-pass';
const SEARCH_COVERAGE_PREVIEW_SCHEDULE_PASS = 'v534-search-coverage-preview-schedule-pass';
const SEARCH_BLOCK_MANIFEST_LAZY_PASS = 'v537-search-block-manifest-lazy-pass';
const SEARCH_FULL_SEARCH_PERMISSION_MODAL_PASS = 'v551-search-full-search-permission-modal-pass';
const SEARCH_COVERAGE_PREVIEW_SCHEDULE_DELAY_MS = 160;

export function installSearch(app) {
  app.searchCleanup?.();
  const disposers = [];
  const on = (target, type, handler, options) => {
    if (!target) return;
    target.addEventListener(type, handler, options);
    disposers.push(() => target.removeEventListener(type, handler, options));
  };
  app.search = {
    open: () => openSearch(app),
    close: (options = {}) => closeSearch(app, options),
    run: () => runSearch(app),
    move: dir => moveResult(app, dir),
    updateRemote: () => renderResults(app),
    resetSession: (reason = 'manual-reset', options = {}) => resetSearchSession(app, reason, options),
    resetForReaderChange: (nextIdentity = {}, prevCurrent = null) => resetSearchForReaderChange(app, nextIdentity, prevCurrent)
  };
  installSearchRemoteDrag(app, on);
  on(app.els.novelSearchBtn, 'click', () => openSearch(app));
  on(app.els.nsearchOverlay, 'click', ev => {
    if (ev.target === app.els.nsearchOverlay) closeSearch(app, { abort:true, reason:'search-modal-overlay', triggerPass: SEARCH_MODAL_CLOSE_ABORT_PASS });
  });
  on(app.els.nsearchClose, 'click', () => closeSearch(app, { abort:true, reason:'search-modal-close-button', triggerPass: SEARCH_MODAL_CLOSE_ABORT_PASS }));
  on(app.els.nsearchInput, 'keydown', ev => {
    if (handleSearchNavigationKey(app, ev)) return;
    if (ev.key === 'Enter') runSearch(app);
    if (ev.key === 'Escape') closeSearch(app, { abort:true, reason:'search-modal-input-escape', triggerPass: SEARCH_MODAL_CLOSE_ABORT_PASS });
  });
  on(app.els.nsearchResults, 'keydown', ev => handleSearchNavigationKey(app, ev));
  on(app.els.nsearchPrevBtn, 'click', () => moveResult(app, -1));
  on(app.els.nsearchNextBtn, 'click', () => moveResult(app, 1));
  on(app.els.nsearchAllchunks, 'change', () => {
    updateSearchModeControls(app);
    scheduleSearchCoveragePreview(app, { reason:'search-mode-change' });
  });
  on(app.els.nsearchCoverageRefresh, 'click', () => refreshSearchCoveragePreview(app, { manual:true }));
  on(app.els.nsearchRetryMissing, 'click', () => retrySearchChunks(app, 'missing'));
  on(app.els.nsearchRetryFailed, 'click', () => retrySearchChunks(app, 'failed'));
  on(app.els.nsearchRetrybar, 'click', ev => dispatchSearchRetrybarClick(app, ev, { retryLastSearchJump, retrySearchChunks }));
  on(app.els.nsearchFilterbar, 'click', ev => handleSearchFilterControlClick(app, ev, { renderResults }));
  on(window, 'online', () => scheduleSearchCoveragePreview(app, { reason:'network-online' }));
  on(window, 'offline', () => scheduleSearchCoveragePreview(app, { reason:'network-offline' }));
  on(window, 'txt-reader-search-stats', () => updateSearchRetryBar(app));
  on(window, 'txt-reader-search-results', () => renderResults(app));
  on(app.els.searchNavRemotePrev, 'click', () => moveResult(app, -1, { source:'remote' }));
  on(app.els.searchNavRemoteNext, 'click', () => moveResult(app, 1, { source:'remote' }));
  on(app.els.searchNavRemoteOpen, 'click', () => {
    app.state.search.remoteDismissed = false;
    openSearch(app);
  });
  on(app.els.searchNavRemoteClose, 'click', () => {
    resetSearchSession(app, 'search-remocon-close', { triggerPass: SEARCH_REMOCON_CLOSE_RESET_PASS, remoteDismissed: true });
  });
  on(window, 'keydown', ev => {
    if (isSearchOpen(app) && handleSearchNavigationKey(app, ev)) return;
    if (ev.target && /input|textarea/i.test(ev.target.tagName)) return;
    if (isShortcut(app, 'searchOpen', ev)) { ev.preventDefault(); openSearch(app); return; }
    if (app.state.search.results.length && isShortcut(app, 'searchNext', ev)) { ev.preventDefault(); moveResult(app, 1); return; }
    if (app.state.search.results.length && isShortcut(app, 'searchPrev', ev)) { ev.preventDefault(); moveResult(app, -1); }
  });
  renderResults(app);
  updateSearchModeControls(app);
  updateSearchRetryBar(app);
  app.searchCleanup = () => {
    app.state.search.abortController?.abort?.();
    app.state.search.running = false;
    app.state.search.resultCallbacks = null;
    cancelScheduledSearchCoveragePreview(app);
    app.searchResultCleanup?.();
    if (app.state.search.remoteClampRaf) {
      cancelAnimationFrame(app.state.search.remoteClampRaf);
      app.state.search.remoteClampRaf = 0;
    }
    disposers.splice(0).forEach(dispose => dispose());
  };
}

function openSearch(app) {
  if (!app.state.current) {
    toast(app, 'info', '본문 검색', '먼저 작품을 열어주세요.');
    return;
  }
  app.state.search.remoteDismissed = false;
  app.state.search.fullSearchAllowed = hasFullSearchPermission(app);
  app.state.search.fullSearchPermissionPass = SEARCH_FULL_SEARCH_PERMISSION_MODAL_PASS;
  updateSearchModeControls(app);
  app.openLayer('nsearchOverlay', 'nsearchPanel');
  if (app.els.nsearchResults && !app.els.nsearchResults.hasAttribute('tabindex')) app.els.nsearchResults.tabIndex = 0;
  renderResults(app);
  scheduleSearchCoveragePreview(app, { reason:'search-open', delayMs: 80 });
  try { loadSearchServerPerformanceProfile(app, { reason:'search-open' }).catch(() => {}); } catch {}
  try { prewarmSearchWorker(app, 'search-open'); } catch {}
  window.requestAnimationFrame(() => {
    app.els.nsearchInput?.focus?.({ preventScroll: true });
    ensureActiveSearchResultVisible(app);
  });
}

function closeSearch(app, options = {}) {
  const abort = options.abort === true;
  cancelScheduledSearchCoveragePreview(app);
  if (abort) {
    app.state.search.modalCloseAbortPass = options.triggerPass || SEARCH_MODAL_CLOSE_ABORT_PASS;
    app.state.search.lastModalCloseAbort = { pass: app.state.search.modalCloseAbortPass, reason: String(options.reason || 'modal-close'), at: Date.now() };
    app.state.search.abortController?.abort?.();
    app.state.search.running = false;
    app.state.search.resultCallbacks = null;
    setButtonBusy(app.els.nsearchNextBtn, false);
  }
  app.state.search.continueDuringNavigationPass = SEARCH_CONTINUE_DURING_NAVIGATION_PASS;
  app.state.search.compactStatusPass = SEARCH_COMPACT_STATUS_PASS;
  syncSearchNavigationButtons(app);
  app.els.nsearchInput?.blur?.();
  if (app.els.nsearchStatus) app.els.nsearchStatus.textContent = buildSearchRemoteHint(app.state.search.results.length);
  app.closeLayer('nsearchOverlay', 'nsearchPanel');
  renderResults(app);
}

async function runSearch(app) {
  const request = buildSearchRunRequest(app);
  if (!beginSearchRun(app, request, { clearSearchJumpRuntimeState })) { renderResults(app); return; }
  renderResults(app);
  try {
    await loadSearchServerPerformanceProfile(app, { reason:'search-run' });
    const warm = prewarmSearchWorker(app, 'search-run');
    if (app.state.search && app.state.search.stats) {
      app.state.search.stats.searchWorkerWarmStart = warm;
      app.state.search.stats.searchBlockManifestPolicyPass = SEARCH_BLOCK_MANIFEST_LAZY_PASS;
      app.state.search.stats.searchBlockManifestPolicy = 'lazy-on-reader-jump';
    }
    if (request.controller.signal.aborted || request.runId !== app.state.search.runId) return;
    await searchAllChunks(app, request.query, request.runId, request.controller.signal, { cacheOnly: request.cacheOnly });
    scheduleSearchCoveragePreview(app, { reason:'search-complete', silent:true, delayMs: 40 });
    if (request.controller.signal.aborted || request.runId !== app.state.search.runId) return;
    const previousActiveIndex = Number(app.state.search.activeIndex);
    const hasUserSelection = Number.isFinite(previousActiveIndex) && previousActiveIndex >= 0 && previousActiveIndex < app.state.search.results.length;
    app.state.search.activeIndex = hasUserSelection ? previousActiveIndex : (app.state.search.results.length ? 0 : -1);
    renderResults(app);
    if (app.state.search.results.length && !hasUserSelection) await jumpToResult(app, 0);
    const capped = buildSearchResultCountLabel(app.state.search.results.length, MAX_RESULTS);
    const stats = app.state.search.stats || {};
    const suffix = buildSearchStatusSuffix(stats);
    const completeSummary = buildSearchCompletionSummary(stats, app.state.search.results.length);
    status(app, 'search', completeSummary || `검색 결과 ${capped}${suffix}`);
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    toast(app, 'error', '검색 실패', e.message || String(e));
  } finally {
    finishSearchRun(app, request, { renderResults });
  }
}

function renderResults(app) {
  renderSearchResults(app, {
    jumpToResult: idx => jumpToResult(app, idx),
    closeSearch: (options = {}) => closeSearch(app, options),
    isSearchOpen: () => isSearchOpen(app)
  });
  syncSearchNavigationButtons(app);
  applyRemotePosition(app);
  updateSearchRetryBar(app);
}


async function moveResult(app, dir, options = {}) {
  const indexes = getVisibleSearchResultIndexes(app);
  const len = indexes.length;
  if (!len) return;
  app.state.search.remoteDismissed = false;
  const current = Number(app.state.search.activeIndex);
  const pos = indexes.indexOf(current);
  const base = pos >= 0 ? pos : (dir < 0 ? 0 : -1);
  const nextPos = (base + dir + len) % len;
  await activateResult(app, indexes[nextPos], options);
}

async function activateResult(app, idx, options = {}) {
  const len = app.state.search.results.length;
  if (!len) return;
  const next = Math.max(0, Math.min(len - 1, Number(idx) || 0));
  app.state.search.activeIndex = next;
  app.state.search.remoteDismissed = false;
  app.state.search.lastJumpAt = Date.now();
  renderResults(app);
  const remoteNavigation = options?.source === 'remote';
  await jumpToResult(app, next, { suppressPill: remoteNavigation });
  const duration = remoteNavigation ? 900 : 1800;
  status(app, 'search', `검색 결과 ${next + 1}/${len}`, duration);
  if (remoteNavigation && app?.state?.search) {
    app.state.search.remotePillCompactionPass = SEARCH_REMOTE_PILL_COMPACTION_PASS;
  }
}

function handleSearchNavigationKey(app, ev) {
  if (!isSearchOpen(app) && ev.currentTarget !== app.els.nsearchInput && ev.currentTarget !== app.els.nsearchResults) return false;
  const len = app.state.search.results.length;
  if (ev.key === 'Escape') {
    ev.preventDefault();
    closeSearch(app, { abort:true, reason:'search-navigation-escape', triggerPass: SEARCH_MODAL_CLOSE_ABORT_PASS });
    return true;
  }
  if (!len) return false;
  const pageStep = Math.max(10, Math.min(40, Math.floor(len / 20) || 10));
  const keyMap = {
    ArrowDown: 1,
    ArrowUp: -1,
    PageDown: pageStep,
    PageUp: -pageStep
  };
  if (Object.prototype.hasOwnProperty.call(keyMap, ev.key)) {
    ev.preventDefault();
    moveResult(app, keyMap[ev.key]);
    return true;
  }
  if (ev.key === 'Home') {
    ev.preventDefault();
    activateResult(app, 0);
    return true;
  }
  if (ev.key === 'End') {
    ev.preventDefault();
    activateResult(app, len - 1);
    return true;
  }
  return false;
}

function isSearchOpen(app) {
  return !!(app.els.nsearchOverlay?.classList.contains('open') || app.els.nsearchPanel?.classList.contains('open'));
}

async function jumpToResult(app, idx, options = {}) {
  const result = app.state.search.results[idx];
  if (!result) return;
  const validation = validateSearchResultJump(app, result, idx);
  recordSearchJumpValidation(app, validation);
  if (!validation.ok) {
    const reason = validation.reason || 'invalid-search-result';
    status(app, 'search', '검색 결과 이동 취소 · ' + reason);
    toast(app, 'warning', '검색 결과 이동', '현재 작품과 맞지 않는 검색 결과라 이동하지 않았습니다.');
    return;
  }
  const target = validation.result;
  const jumpInfo = buildSearchJumpInfo(app, target, idx, validation, { searchJumpUxPass: SEARCH_JUMP_UX_PASS, liveFieldValidationPass: SEARCH_LIVE_FIELD_VALIDATION_PASS });
  recordSearchJumpStatus(app, { ...jumpInfo, stage:'loading' });
  announceSearchJump(app, jumpInfo, 'loading', { suppressPill: !!options.suppressPill });
  app.state.search.highlights = { chunk: target.chunk, query: target.query, index: target.index, matchLength: target.matchLength || String(target.query || '').length };
  try {
    if (typeof app.reader.goSearchResult === 'function') {
      await app.reader.goSearchResult(target);
      recordSearchJumpValidation(app, { ...validation, done:true, usedReaderGoSearchResult:true });
      clearSearchJumpFailure(app);
      recordSearchJumpStatus(app, { ...jumpInfo, stage:'done', usedReaderGoSearchResult:true });
      announceSearchJump(app, jumpInfo, 'done', { suppressPill: !!options.suppressPill });
      return;
    }
    if (typeof app.reader.goPosition === 'function') {
      await app.reader.goPosition({ chunk: target.chunk, searchIndex: Number(target.index) || 0, query: target.query, matchLength: target.matchLength, keepHighlight: true, align: 'center' });
      recordSearchJumpValidation(app, { ...validation, done:true, usedReaderGoPosition:true });
      clearSearchJumpFailure(app);
      recordSearchJumpStatus(app, { ...jumpInfo, stage:'done', usedReaderGoPosition:true });
      announceSearchJump(app, jumpInfo, 'done', { suppressPill: !!options.suppressPill });
    }
  } catch (error) {
    if (error && error.name === 'AbortError') throw error;
    recordSearchJumpFailure(app, jumpInfo, error);
    const message = buildSearchJumpMessage(jumpInfo, 'failed');
    status(app, 'search', message);
    toast(app, 'error', '검색 결과 이동 실패', '해당 결과를 다시 누르거나 검색 패널의 이동 재시도 버튼을 사용하세요.');
    updateSearchRetryBar(app);
  }
}


function validateSearchResultJump(app, result = {}, idx = -1) {
  const current = app.state.current || null;
  const rawChunk = Math.round(Number(result.chunk) || 0);
  const total = Math.max(1, Number(result.totalChunks) || Number(current?.totalChunks) || rawChunk || 1);
  const normalizedChunk = Math.max(1, Math.min(total, rawChunk || 1));
  const rawIndex = Math.round(Number(result.index) || 0);
  const textLength = Math.max(0, Number(result.textLength) || 0);
  const normalizedIndex = textLength ? Math.max(0, Math.min(textLength, rawIndex)) : Math.max(0, rawIndex);
  const query = String(result.query || app.state.search.query || app.els.nsearchInput?.value || '').trim();
  const currentEpisodeId = current?.episode?.id == null ? null : String(current.episode.id);
  const resultEpisodeId = result.episodeId == null ? null : String(result.episodeId);
  let ok = !!current && !!query;
  let reason = ok ? '' : (!current ? 'no-current-reader' : 'empty-query');
  let targetEpisode = null;
  if (ok && result.novelId && current?.novel?.id && String(result.novelId) !== String(current.novel.id)) {
    ok = false;
    reason = 'novel-mismatch';
  }
  if (ok && resultEpisodeId != null && currentEpisodeId != null && resultEpisodeId !== currentEpisodeId) {
    const episodes = Array.isArray(current?.novel?.episodes) ? current.novel.episodes : [];
    targetEpisode = episodes.find(episode => String(episode?.id || '') === resultEpisodeId) || null;
    if (!targetEpisode) {
      ok = false;
      reason = 'episode-mismatch';
    }
  }
  if (ok && (!Number.isFinite(normalizedChunk) || normalizedChunk < 1 || normalizedChunk > total)) {
    ok = false;
    reason = 'chunk-out-of-range';
  }
  const targetLoaded = currentEpisodeId === resultEpisodeId && !!app.state.loadedChunks?.has?.(normalizedChunk);
  return {
    pass: SEARCH_RESULT_JUMP_VALIDATION_PASS,
    multiEpisodePass: targetEpisode ? SEARCH_MULTI_EPISODE_RESULT_JUMP_PASS : '',
    ok,
    reason,
    index: Math.max(0, Math.round(Number(idx) || 0)),
    targetLoaded,
    rawChunk,
    normalizedChunk,
    totalChunks: total,
    targetEpisodeId: resultEpisodeId,
    targetEpisodeTitle: targetEpisode?.title || result.episodeTitle || '',
    result: {
      ...result,
      episodeId: resultEpisodeId,
      episodeTitle: result.episodeTitle || targetEpisode?.title || '',
      episodeIndex: Number.isFinite(Number(result.episodeIndex)) ? Math.max(0, Math.round(Number(result.episodeIndex))) : Math.max(0, Number(current?.episodeIdx) || 0),
      chunk: normalizedChunk,
      totalChunks: total,
      index: normalizedIndex,
      query,
      matchLength: Math.max(1, Number(result.matchLength) || query.length)
    },
    at: Date.now()
  };
}

function recordSearchJumpValidation(app, validation = {}) {
  if (!app?.state?.search) return;
  app.state.search.lastJumpValidation = validation;
  app.state.search.searchResultJumpValidationPass = SEARCH_RESULT_JUMP_VALIDATION_PASS;
}

function clearSearchJumpRuntimeState(app, reason = 'reset', options = {}) {
  if (!app?.state?.search) return;
  clearSearchJumpRuntimeStateFields(app.state.search, reason, options, SEARCH_SESSION_CLEANUP_PASS);
}

function resetSearchSession(app, reason = 'reset', options = {}) {
  return resetSearchRuntimeSession(app, reason, options, {
    passes: { contextResetPass: SEARCH_CONTEXT_RESET_PASS },
    resetRuntimeState: clearSearchJumpRuntimeState,
    renderResults
  });
}

function resetSearchForReaderChange(app, nextIdentity = {}, prevCurrent = null) {
  return resetSearchRuntimeForReaderChange(app, nextIdentity, prevCurrent, {
    passes: {
      contextResetPass: SEARCH_CONTEXT_RESET_PASS,
      readerChangePass: SEARCH_CONTEXT_RESET_ON_READER_CHANGE_PASS
    },
    resetRuntimeState: clearSearchJumpRuntimeState,
    renderResults
  });
}

function announceSearchJump(app, info = {}, stage = 'loading', options = {}) {
  return announceSearchJumpStatus(app, info, stage, { buildSearchJumpMessage, status, isSearchOpen, suppressPill: !!options.suppressPill });
}

function recordSearchJumpStatus(app, payload = {}) {
  if (!app?.state?.search) return;
  app.state.search.lastJumpStatus = {
    ...payload,
    searchJumpUxPass: SEARCH_JUMP_UX_PASS,
    liveFieldValidationPass: SEARCH_LIVE_FIELD_VALIDATION_PASS,
    at: Date.now()
  };
  app.state.search.lastJumpLiveFieldValidation = buildSearchJumpLiveFieldValidation(app, app.state.search.lastJumpStatus, SEARCH_LIVE_FIELD_VALIDATION_PASS);
}

function clearSearchJumpFailure(app) {
  if (!app?.state?.search) return;
  app.state.search.lastJumpFailure = null;
  updateSearchRetryBar(app);
}

function recordSearchJumpFailure(app, info = {}, error = null) {
  if (!app?.state?.search) return;
  app.state.search.lastJumpFailure = {
    ...info,
    pass: SEARCH_JUMP_FAILURE_RECOVERY_PASS,
    error: error?.message || String(error || 'unknown error'),
    canRetry: true,
    at: Date.now()
  };
  recordSearchJumpStatus(app, { ...info, stage:'failed', error: app.state.search.lastJumpFailure.error });
}

async function retryLastSearchJump(app) {
  const failure = app?.state?.search?.lastJumpFailure || null;
  if (!failure || !failure.canRetry) {
    toast(app, 'info', '검색 결과 이동', '재시도할 이동 실패 기록이 없습니다.');
    return;
  }
  const validation = validateLastSearchJumpRetry(app, failure, SEARCH_LIVE_FIELD_VALIDATION_PASS);
  app.state.search.lastJumpRetryValidation = validation;
  if (!validation.ok) {
    clearSearchJumpRuntimeState(app, 'stale-retry-blocked', { keepRetryValidation:true });
    updateSearchRetryBar(app);
    status(app, 'search', '검색 결과 이동 재시도 취소 · ' + validation.reason);
    toast(app, 'warning', '검색 결과 이동', '현재 검색/작품 상태와 맞지 않는 이전 실패 기록이라 재시도하지 않았습니다.');
    return;
  }
  const index = Math.max(0, Math.round(Number(failure.index) || 0));
  status(app, 'search', '검색 결과 이동 재시도 · chunk ' + (failure.chunk || '-'));
  await activateResult(app, index);
}

async function retrySearchChunks(app, kind, overrideChunks = null) {
  const request = buildSearchRetryRequest(app, kind, overrideChunks);
  if (!request.ok) {
    toast(app, 'info', '재검색', request.message || '재검색할 chunk가 없습니다.');
    return;
  }
  beginSearchRetry(app, request);
  try {
    await searchSelectedChunks(app, request.query, request.runId, request.controller.signal, request.chunks, { mode: request.mode, preserveResults: true });
    if (request.controller.signal.aborted || request.runId !== app.state.search.runId) return;
    if (app.state.search.results.length && app.state.search.activeIndex < 0) app.state.search.activeIndex = 0;
    renderResults(app);
    status(app, 'search', buildSearchRetryDoneMessage(request, app.state.search.stats || {}));
  } catch (error) {
    if (error && error.name === 'AbortError') return;
    toast(app, 'error', '재검색 실패', error.message || String(error));
  } finally {
    finishSearchRetry(app, request, { renderResults });
  }
}

async function refreshSearchCoveragePreview(app, options = {}) {
  const { manual = false, silent = false } = options || {};
  if (!app?.state?.current) return null;
  if (!app.els?.nsearchCoverageSummary && !manual) return null;
  if (manual) cancelScheduledSearchCoveragePreview(app);
  if (app.state.search?.coveragePreviewPromise && !manual) {
    app.state.search.coveragePreviewCoalesced = {
      pass: SEARCH_COVERAGE_PREVIEW_SCHEDULE_PASS,
      reason: String(options.reason || 'coalesced'),
      at: Date.now()
    };
    return app.state.search.coveragePreviewPromise;
  }
  const task = refreshSearchCoveragePreviewNow(app, { manual, silent });
  if (app.state.search) app.state.search.coveragePreviewPromise = task;
  try {
    return await task;
  } finally {
    if (app.state.search?.coveragePreviewPromise === task) app.state.search.coveragePreviewPromise = null;
  }
}

function scheduleSearchCoveragePreview(app, options = {}) {
  if (!app?.state?.search) return null;
  if (options.manual === true) return refreshSearchCoveragePreview(app, options);
  if (!app.state.current || !app.els?.nsearchCoverageSummary) return null;
  cancelScheduledSearchCoveragePreview(app);
  const search = app.state.search;
  const delayMs = Math.max(0, Number(options.delayMs) || SEARCH_COVERAGE_PREVIEW_SCHEDULE_DELAY_MS);
  search.coveragePreviewSchedulePass = SEARCH_COVERAGE_PREVIEW_SCHEDULE_PASS;
  search.coveragePreviewQueued = {
    ...options,
    manual: false,
    silent: options.silent !== false,
    scheduledAt: Date.now()
  };
  search.lastCoveragePreviewSchedule = {
    pass: SEARCH_COVERAGE_PREVIEW_SCHEDULE_PASS,
    reason: String(options.reason || 'scheduled'),
    delayMs,
    at: Date.now()
  };
  const timerHost = typeof window !== 'undefined' ? window : globalThis;
  const setTimer = timerHost.setTimeout || globalThis.setTimeout;
  if (typeof setTimer !== 'function') return refreshSearchCoveragePreview(app, search.coveragePreviewQueued);
  search.coveragePreviewTimer = setTimer(() => {
    const queued = search.coveragePreviewQueued || {};
    search.coveragePreviewTimer = 0;
    search.coveragePreviewQueued = null;
    refreshSearchCoveragePreview(app, queued).catch(() => {});
  }, delayMs);
  return search.lastCoveragePreviewSchedule;
}

function cancelScheduledSearchCoveragePreview(app) {
  const search = app?.state?.search;
  if (!search?.coveragePreviewTimer) {
    if (search) search.coveragePreviewQueued = null;
    return;
  }
  const timerHost = typeof window !== 'undefined' ? window : globalThis;
  const clearTimer = timerHost.clearTimeout || globalThis.clearTimeout;
  if (typeof clearTimer === 'function') clearTimer(search.coveragePreviewTimer);
  search.coveragePreviewTimer = 0;
  search.coveragePreviewQueued = null;
}

async function refreshSearchCoveragePreviewNow(app, options = {}) {
  const { manual = false, silent = false } = options || {};
  if (!app.state.current) return;
  if (!app.els.nsearchCoverageSummary && !manual) return;
  updateSearchModeControls(app);
  const allChunks = hasFullSearchPermission(app) && !!app.els.nsearchAllchunks?.checked;
  updateSearchRetryBar(app, { previewBusy: true });
  const startedAt = Date.now();
  try {
    if (app.state.search) app.state.search.lastSearchCoveragePreviewManifestPolicy = { pass: SEARCH_BLOCK_MANIFEST_LAZY_PASS, policy: 'skip-manifest-cold-build-for-coverage-preview', at: Date.now() };
    const cacheOnly = !allChunks;
    const preview = await buildSearchCoveragePreview(app, app.state.current, { signal: app.state.search.abortController?.signal, cacheOnly });
    app.state.search.coveragePreview = { ...preview, cacheOnly, cacheOnlyClientUxPass: cacheOnly ? SEARCH_CACHE_ONLY_CLIENT_UX_PASS : '', updatedAt: Date.now(), elapsedMs: Date.now() - startedAt };
    updateSearchRetryBar(app);
    if (manual && !silent) toast(app, 'success', '검색 가능 범위', describeCoveragePreview(app, preview));
  } catch (error) {
    if (error && error.name === 'AbortError') return;
    app.state.search.coveragePreview = { error: error?.message || String(error), updatedAt: Date.now() };
    updateSearchRetryBar(app);
    if (manual && !silent) toast(app, 'error', '검색 가능 범위 확인 실패', error.message || String(error));
  }
}
