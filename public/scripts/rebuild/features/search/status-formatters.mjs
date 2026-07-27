import { buildSearchCompletionSummary, getSearchProcessedCount } from './matcher.mjs';

export const SEARCH_STATUS_FORMATTERS_SPLIT_PASS = 'v202-search-status-formatters-split-pass';

export function buildSearchStatusSuffix(stats = {}) {
  if (stats.skippedCacheOnlyChunks) return ` · 캐시 외 ${stats.skippedCacheOnlyChunks}개 제외`;
  if (stats.skippedOfflineChunks) return ` · 오프라인 누락 ${stats.skippedOfflineChunks}개`;
  if (stats.failedChunks) return ` · 실패 ${stats.failedChunks}개`;
  return '';
}

export function buildSearchRunSummary(app, stats = {}, preview = null) {
  const summary = buildSearchCompletionSummary(stats, Number(stats.resultCount) || app.state.search.results.length || 0);
  const processed = getSearchProcessedCount(stats);
  const total = Math.max(0, Number(stats.totalChunks) || Number(preview?.totalChunks) || 0);
  const mode = stats.mode === 'cache-only' ? '캐시 검색' : '전체 본문 검색';
  const coverage = total ? ` · 처리율 ${Math.min(100, Math.round((processed / total) * 100))}%` : '';
  return `${mode} · ${summary}${coverage}`;
}

export function describeCoveragePreview(app, preview) {
  if (!preview || !preview.totalChunks) return '';
  const total = Number(preview.totalChunks) || 0;
  const searchable = Number(preview.searchableChunks) || 0;
  const cached = Number(preview.cacheChunks) || 0;
  const loaded = Number(preview.loadedChunks) || 0;
  const memory = Number(preview.memoryChunks) || 0;
  const mode = preview.online ? '온라인' : '오프라인';
  const cacheOnly = !!(preview.cacheOnly || app.state.search.cacheOnly);
  const suffix = cacheOnly
    ? `서버 요청 없음 · 캐시 외 제외 ${Math.max(0, Number(preview.serverFreeMissingChunks) || total - Number(preview.cachedOrLoaded || 0))}개`
    : (preview.online
      ? '네트워크 fetch 가능'
      : `누락 ${Math.max(0, Number(preview.offlineMissingChunks) || 0)}개`);
  const truncated = preview.truncated ? ` · 앞 ${preview.sampledChunks}개 기준` : '';
  const label = cacheOnly ? '캐시 검색 가능' : `${mode} 검색 가능`;
  return `${label} ${searchable}/${total} · 표시중 ${loaded} · 메모리 ${memory} · 캐시 ${cached} · ${suffix}${truncated}`;
}
