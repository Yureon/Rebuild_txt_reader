export const SEARCH_FILTER_SUMMARY_SPLIT_PASS = 'v209-search-filter-summary-pass';

export function getSearchSourceLabel(source) {
  if (source === 'network') return '네트워크';
  if (source === 'reader-cache') return '캐시';
  if (source === 'loaded') return '표시중';
  if (source === 'memory') return '메모리';
  return '출처 미확인';
}

export function getSearchFilterLabel(filter) {
  if (filter === 'cache') return '캐시';
  if (filter === 'network') return '네트워크';
  return '전체';
}

export function buildSearchFilterButtonLabel(value, count, total) {
  const label = getSearchFilterLabel(value);
  const safeCount = Math.max(0, Number(count) || 0);
  const safeTotal = Math.max(0, Number(total) || 0);
  return value === 'all' ? `${label} ${safeTotal}` : `${label} ${safeCount}`;
}

export function buildSearchCountSummary(totalResults, visibleResults, filter) {
  const total = Math.max(0, Number(totalResults) || 0);
  const visible = Math.max(0, Number(visibleResults) || 0);
  if (!total) return '';
  return filter === 'all' ? `${total}개` : `${visible}/${total}개`;
}

export function buildSearchResultsStatusText({ running = false, query = '', statsText = '', totalResults = 0, visibleResults = 0, activeLabel = 0, filter = 'all', windowed = false } = {}) {
  const total = Math.max(0, Number(totalResults) || 0);
  const visible = Math.max(0, Number(visibleResults) || 0);
  const active = Math.max(1, Number(activeLabel) || 1);
  const filterText = filter === 'all' ? '' : ` · 필터 ${getSearchFilterLabel(filter)} ${visible}개`;
  const windowText = windowed ? ' · 결과 목록 windowing 적용' : '';
  if (running) return statsText || '검색 중…';
  if (total) return `현재 ${active}/${Math.max(1, visible)}${filterText}${windowText} · ${statsText || '결과를 누르면 검색창을 닫고 본문으로 이동합니다.'}`;
  return query ? `${statsText ? `${statsText} · ` : ''}일치하는 결과가 없습니다.` : '검색어를 입력하세요.';
}

export function buildSearchRemoteCountLabel(activeLabel, visibleResults, filter) {
  const base = `검색 결과 ${Math.max(1, Number(activeLabel) || 1)} / ${Math.max(0, Number(visibleResults) || 0)}`;
  return filter === 'all' ? base : `${base} · ${getSearchFilterLabel(filter)}`;
}

export function buildSearchRemoteText(query, filter, totalResults) {
  const safeQuery = String(query || '').trim();
  if (!safeQuery) return '검색 결과 이동 리모컨';
  const suffix = filter === 'all' ? '' : ` · 전체 ${Math.max(0, Number(totalResults) || 0)}개`;
  return `“${safeQuery}”${suffix} · 드래그로 위치 조정`;
}


export const SEARCH_RESULT_WINDOW_STATUS_SPLIT_PASS = 'v210-search-result-window-status-pass';

export function buildSearchResultWindowStatus({ start = 0, end = 0, visibleResults = 0, renderedCount = 0, activeLabel = 1 } = {}) {
  const safeStart = Math.max(0, Number(start) || 0);
  const safeEnd = Math.max(safeStart, Number(end) || safeStart);
  const safeVisible = Math.max(0, Number(visibleResults) || 0);
  const safeRendered = Math.max(0, Number(renderedCount) || 0);
  const safeActive = Math.max(1, Number(activeLabel) || 1);
  return `${safeStart + 1}–${safeEnd} / ${safeVisible}개 결과 window · DOM ${safeRendered}개 유지 · 현재 ${safeActive}`;
}

export function buildSearchEmptyFilterText(filter) {
  return `${getSearchFilterLabel(filter)} 필터에 표시할 결과가 없습니다.`;
}
