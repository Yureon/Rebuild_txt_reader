export const SEARCH_RESULT_LABELS_SPLIT_PASS = 'v208-search-result-labels-pass';

export function buildSearchResultCountLabel(resultCount = 0, maxResults = 0) {
  const count = Math.max(0, Math.round(Number(resultCount) || 0));
  const cap = Math.max(0, Math.round(Number(maxResults) || 0));
  return cap > 0 && count >= cap ? `상위 ${cap}개` : `${count}개`;
}

export function buildSearchRemoteHint(resultCount = 0) {
  return Math.max(0, Number(resultCount) || 0) ? '검색 결과 이동 리모컨으로 계속 이동할 수 있습니다.' : '';
}
