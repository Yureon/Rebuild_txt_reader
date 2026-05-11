export const SEARCH_ANNOUNCEMENT_FORMATTERS_SPLIT_PASS = 'v203-search-announcement-formatters-split-pass';

export function getSearchJumpSourceLabel(source, targetLoaded = false) {
  if (targetLoaded || source === 'loaded') return '표시중 chunk';
  if (source === 'memory') return '메모리 캐시';
  if (source === 'reader-cache') return '로컬 캐시';
  if (source === 'network') return '네트워크 검색 결과';
  return '필요 시 chunk 로드';
}

export function announceSearchJumpStatus(app, info = {}, stage = 'loading', deps = {}) {
  const buildMessage = typeof deps.buildSearchJumpMessage === 'function'
    ? deps.buildSearchJumpMessage
    : () => '';
  const message = buildMessage(info, stage);
  const duration = stage === 'loading' ? 2400 : 1600;
  if (!deps.suppressPill && typeof deps.status === 'function') deps.status(app, 'search', message, duration);
  const isOpen = typeof deps.isSearchOpen === 'function' ? deps.isSearchOpen(app) : false;
  if (isOpen && app?.els?.nsearchStatus) app.els.nsearchStatus.textContent = message;
  return message;
}
