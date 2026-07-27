import { setSearchModeBadge } from '../ui.mjs';
import { SEARCH_PERFORMANCE_PASS, getSearchResultFilterSnapshot } from './matcher.mjs';

export const SEARCH_FILTER_CONTROLS_SPLIT_PASS = 'v411-search-filter-controls-default-cache-pass';
export const SEARCH_FULL_SEARCH_PERMISSION_UI_PASS = 'v551-search-full-search-permission-ui-pass';

const SEARCH_VISIBLE_INDEX_CACHE_PASS = 'v145-search-visible-index-cache-pass';

export function hasFullSearchPermission(app) {
  const snapshot = app?.state?.userAccessSnapshot || null;
  if (!snapshot || !snapshot.userId) return true;
  if (snapshot.fullSearchAllowed === false) return false;
  if (snapshot.appPermissions && snapshot.appPermissions.fullSearch === false) return false;
  return true;
}

export function updateSearchModeControls(app) {
  const fullSearchAllowed = hasFullSearchPermission(app);
  const toggle = app.els.nsearchAllchunks || null;
  if (toggle && !fullSearchAllowed) toggle.checked = false;
  const allChunks = fullSearchAllowed && !!toggle?.checked;
  const cacheOnly = !allChunks;
  app.state.search.cacheOnly = cacheOnly;
  if (toggle) {
    toggle.disabled = !fullSearchAllowed;
    toggle.setAttribute?.('aria-label', fullSearchAllowed ? (allChunks ? '전체검색 켜짐: 서버 전체 검색 사용' : '전체검색 꺼짐: 표시중/캐시만 검색') : '전체검색 권한 없음: 표시중/캐시만 검색');
    toggle.setAttribute?.('aria-pressed', allChunks ? 'true' : 'false');
    const label = toggle.closest?.('.nsearch-mode-toggle');
    if (label) {
      label.hidden = !fullSearchAllowed;
      label.setAttribute?.('data-mode', allChunks ? 'server' : 'cache');
      label.dataset.fullSearchPermissionPass = SEARCH_FULL_SEARCH_PERMISSION_UI_PASS;
    }
  }
  const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
  if (!online) setSearchModeBadge(app, 'offline', '오프라인', '오프라인 상태 · 표시중/캐시 범위만 검색할 수 있습니다.');
  else if (cacheOnly) setSearchModeBadge(app, 'normal', '캐시 검색', '서버 요청 없이 표시중/메모리/오프라인 캐시 범위만 검색합니다.');
  else setSearchModeBadge(app, 'fast', '서버 검색', '현재 작품 전체 chunk를 서버 content API로 검색합니다.');
  if (app.state.search) {
    app.state.search.fullSearchAllowed = fullSearchAllowed;
    app.state.search.fullSearchPermissionPass = SEARCH_FULL_SEARCH_PERMISSION_UI_PASS;
    app.state.search.searchModeBadgePass = 'v645-search-mode-badge-separation-pass';
  }
}

export function handleSearchFilterClick(app, ev, options = {}) {
  const target = ev?.target instanceof Element ? ev.target.closest('.nsearch-filter-btn') : null;
  if (!target || !app.els.nsearchFilterbar?.contains?.(target)) return;
  const filter = String(target.dataset.nsearchFilter || 'all');
  app.state.search.sourceFilter = filter;
  app.state.search.resultWindowStart = 0;
  const visible = getVisibleSearchResultIndexes(app);
  if (visible.length && !visible.includes(Number(app.state.search.activeIndex))) app.state.search.activeIndex = visible[0];
  if (typeof options.renderResults === 'function') options.renderResults(app);
}

export function getVisibleSearchResultIndexes(app) {
  const filter = app.state.search.sourceFilter || 'all';
  const results = Array.isArray(app.state.search.results) ? app.state.search.results : [];
  const cache = app.state.search.visibleIndexesCache || null;
  if (cache && cache.pass === SEARCH_VISIBLE_INDEX_CACHE_PASS && cache.resultsRef === results && cache.filter === filter && cache.length === results.length) {
    return cache.indexes;
  }
  const snapshot = getSearchResultFilterSnapshot(app, results, filter);
  const indexes = snapshot.indexes;
  app.state.search.visibleIndexesCache = {
    pass: SEARCH_VISIBLE_INDEX_CACHE_PASS,
    version: SEARCH_PERFORMANCE_PASS,
    resultsRef: results,
    filter,
    length: results.length,
    indexes
  };
  return indexes;
}

export function resetSearchPerformanceCaches(app) {
  if (!app?.state?.search) return;
  app.state.search.resultFilterSnapshotCache = null;
  app.state.search.visibleIndexesCache = null;
  app.state.search.resultRenderSignature = '';
  app.state.search.lastStatsEventAt = 0;
}
