export const SEARCH_SESSION_RESET_HELPERS_SPLIT_PASS = 'v205-search-session-reset-helpers-split-pass';

export function buildSearchSessionResetSnapshot(search = {}, inputValue = '') {
  return {
    query: String(search.query || inputValue || ''),
    resultCount: Array.isArray(search.results) ? search.results.length : 0,
    activeIndex: Number(search.activeIndex),
    runId: Number(search.runId) || 0,
    remoteDismissed: !!search.remoteDismissed
  };
}

export function clearSearchJumpRuntimeStateFields(search = {}, reason = 'reset', options = {}, cleanupPass = '') {
  const keepRetryValidation = !!options.keepRetryValidation;
  const preservedRetryValidation = keepRetryValidation ? search.lastJumpRetryValidation : null;
  search.lastJumpValidation = null;
  search.lastJumpStatus = null;
  search.lastJumpFailure = null;
  search.lastJumpLiveFieldValidation = null;
  search.lastJumpRetryValidation = preservedRetryValidation;
  search.lastJumpSessionCleanup = {
    pass: cleanupPass,
    reason: String(reason || 'reset'),
    at: Date.now()
  };
}

export function applySearchSessionCoreReset(search = {}, options = {}) {
  search.abortController?.abort?.();
  search.abortController = null;
  search.runId = (Number(search.runId) || 0) + 1;
  search.running = false;
  search.query = '';
  search.results = [];
  search.activeIndex = -1;
  search.resultWindowStart = 0;
  search.highlights = null;
  search.stats = null;
  search.coveragePreview = null;
  search.sourceFilter = 'all';
  search.cacheOnly = true;
  search.remoteDismissed = options.remoteDismissed !== false;
  return search;
}

export function buildSearchContextResetRecord({ contextResetPass = '', triggerPass = '', reason = 'reset', previous = null } = {}) {
  return {
    pass: contextResetPass,
    triggerPass: String(triggerPass || ''),
    reason: String(reason || 'reset'),
    previous,
    at: Date.now()
  };
}
