export const LIBRARY_RENDER_ORCHESTRATOR_PASS = 'v298-library-render-orchestrator-pass';

function scheduleAfterFrame(fn) {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(fn);
  return setTimeout(fn, 0);
}

export function renderLibraryOrchestratorRuntime(app, options = {}, deps = {}) {
  const opts = deps.normalizeLibraryRenderOptions?.(options) || {};
  const box = app?.els?.novelList;
  if (!box) return;
  deps.cancelLibraryVirtualRender?.(app);
  if (opts.resetScroll) box.scrollTop = 0;
  box.classList.add('novel-list-rendering');
  deps.renderLibraryQuickList?.(app);

  const novels = deps.getLibraryFilteredNovels?.(app, { allowCache: opts.source === 'virtual-scroll' }) || [];
  if (!novels.length) {
    deps.renderLibraryEmptyState?.(app, box, opts);
    return;
  }

  const virtual = deps.renderLibraryVirtualIfEnabled?.(app, box, novels, opts) || { rendered:false, reason:'missing-virtual-renderer' };
  if (virtual.rendered) {
    scheduleAfterFrame(() => box.classList.remove('novel-list-rendering'));
    return;
  }

  deps.renderLibraryFull?.(app, box, novels, virtual.reason || 'flag-off', opts);
  scheduleAfterFrame(() => box.classList.remove('novel-list-rendering'));
}
