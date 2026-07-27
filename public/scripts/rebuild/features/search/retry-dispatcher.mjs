export const SEARCH_RETRY_DISPATCHER_SPLIT_PASS = 'v201-search-retry-dispatcher-split-pass';

export function handleSearchRetrybarClick(app, ev, handlers = {}) {
  const target = ev?.target instanceof Element ? ev.target.closest('.nsearch-chunk-retry-btn') : null;
  if (!target || !app.els.nsearchRetrybar?.contains?.(target)) return;
  if (target.dataset.retryKind === 'jump') {
    handlers.retryLastSearchJump?.(app);
    return;
  }
  const chunk = Math.max(1, Math.round(Number(target.dataset.chunk) || 0));
  const kind = target.dataset.retryKind === 'failed' ? 'failed' : 'missing';
  if (!chunk) return;
  handlers.retrySearchChunks?.(app, kind, [chunk]);
}
