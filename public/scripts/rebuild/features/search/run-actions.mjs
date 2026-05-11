import { setButtonBusy } from '../../core/utils.mjs';
import { createSearchStats } from './matcher.mjs';
import { updateSearchRetryBar } from './status-panel.mjs';
import { hasFullSearchPermission, resetSearchPerformanceCaches, updateSearchModeControls } from './filter-controls.mjs';
import { syncSearchNavigationButtons } from './navigation-ui.mjs';

export const SEARCH_RUN_ACTIONS_PASS = 'v247-search-run-actions-pass';
export const SEARCH_DEFAULT_CACHE_RUN_ACTIONS_PASS = 'v411-search-run-actions-default-cache-pass';
export const SEARCH_FULL_SEARCH_PERMISSION_RUN_PASS = 'v551-search-full-search-permission-run-pass';

export function buildSearchRunRequest(app) {
  const query = String(app?.els?.nsearchInput?.value || '').trim();
  app?.state?.search?.abortController?.abort?.();
  const controller = new AbortController();
  const runId = (Number(app?.state?.search?.runId) || 0) + 1;
  const fullSearchAllowed = hasFullSearchPermission(app);
  const allChunks = fullSearchAllowed && !!app?.els?.nsearchAllchunks?.checked;
  const cacheOnly = !allChunks;
  return { pass: SEARCH_RUN_ACTIONS_PASS, defaultCachePass: SEARCH_DEFAULT_CACHE_RUN_ACTIONS_PASS, fullSearchPermissionPass: SEARCH_FULL_SEARCH_PERMISSION_RUN_PASS, fullSearchAllowed, query, controller, runId, allChunks, cacheOnly };
}

export function beginSearchRun(app, request = {}, deps = {}) {
  const search = app?.state?.search;
  if (!search) return false;
  search.abortController = request.controller;
  search.runId = request.runId;
  search.query = request.query;
    search.results = [];
  search.activeIndex = -1;
  search.resultWindowStart = 0;
  resetSearchPerformanceCaches(app);
  search.remoteDismissed = false;
  search.highlights = null;
  deps.clearSearchJumpRuntimeState?.(app, 'new-search-run');
  search.cacheOnly = !!request.cacheOnly;
  search.fullSearchAllowed = request.fullSearchAllowed !== false;
  search.fullSearchPermissionPass = request.fullSearchPermissionPass || SEARCH_FULL_SEARCH_PERMISSION_RUN_PASS;
  search.stats = createSearchStats(request.cacheOnly ? 'cache-only' : 'all', 0);
  search.coveragePreview = null;
  search.sourceFilter = 'all';
  updateSearchModeControls(app);
  if (app.els?.nsearchStatus) app.els.nsearchStatus.textContent = '';
  updateSearchRetryBar(app);
  if (!request.query || !app.state.current) return false;
  search.running = true;
  setButtonBusy(app.els?.nsearchNextBtn, true, '검색…');
  syncSearchNavigationButtons(app);
  if (app.els?.nsearchStatus) app.els.nsearchStatus.textContent = '검색 중…';
  return true;
}

export function finishSearchRun(app, request = {}, deps = {}) {
  const search = app?.state?.search;
  if (!search || request.runId !== search.runId) return false;
  search.running = false;
  setButtonBusy(app.els?.nsearchNextBtn, false);
  deps.renderResults?.(app);
  syncSearchNavigationButtons(app);
  return true;
}
