export const LIBRARY_RENDER_ORCHESTRATOR_PASS = 'v298-library-render-orchestrator-pass';


function appendTreePageControl(app, box) {
  if (!box || app?.state?.libraryViewMode === 'shelf') return;
  box.querySelector?.('[data-library-tree-page-control]')?.remove?.();
  const cursor = String(app?.state?.libraryTreeNextCursor || '');
  const total = Math.max(0, Number(app?.state?.libraryTreeTotal) || 0);
  const loaded = Math.max(0, Number(app?.state?.libraryTreeLoadedCount) || (Array.isArray(app?.state?.novels) ? app.state.novels.length : 0));
  if (!cursor) return;
  const wrap = document.createElement('div');
  wrap.className = 'library-tree-page-control';
  wrap.dataset.libraryTreePageControl = '1';
  const status = document.createElement('span');
  status.setAttribute('role', 'status');
  status.textContent = `${loaded.toLocaleString()} / ${total.toLocaleString()}개 로드됨`;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'library-tree-load-more-btn';
  button.dataset.libraryTreeLoadMore = '1';
  button.disabled = !!app.state.libraryTreeLoadingMore;
  button.textContent = app.state.libraryTreeLoadingMore ? '불러오는 중…' : '다음 탐색 목록 불러오기';
  wrap.append(status, button);
  box.append(wrap);
}

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
  deps.syncLibraryChrome?.(app);
  if (app?.state?.libraryViewMode === 'shelf') {
    deps.renderLibraryShelf?.(app, box, opts);
    scheduleAfterFrame(() => box.classList.remove('novel-list-rendering'));
    return;
  }
  deps.renderLibraryQuickList?.(app);
  if (app?.state?.libraryViewMode === 'explorer') {
    box.classList.remove('library-shelf-active');
    const novels = deps.getLibraryFilteredNovels?.(app, { allowCache:false }) || [];
    if (!novels.length) {
      deps.renderLibraryEmptyState?.(app, box, opts);
      appendTreePageControl(app, box);
      return;
    }
    deps.renderLibraryExplorer?.(app, box, novels, opts);
    appendTreePageControl(app, box);
    scheduleAfterFrame(() => box.classList.remove('novel-list-rendering'));
    return;
  }
  box.classList.remove('library-shelf-active');

  const novels = deps.getLibraryFilteredNovels?.(app, { allowCache: opts.source === 'virtual-scroll' }) || [];
  if (!novels.length) {
    deps.renderLibraryEmptyState?.(app, box, opts);
    appendTreePageControl(app, box);
    return;
  }

  const virtual = deps.renderLibraryVirtualIfEnabled?.(app, box, novels, opts) || { rendered:false, reason:'missing-virtual-renderer' };
  if (virtual.rendered) {
    appendTreePageControl(app, box);
    scheduleAfterFrame(() => box.classList.remove('novel-list-rendering'));
    return;
  }

  deps.renderLibraryFull?.(app, box, novels, virtual.reason || 'flag-off', {
    ...opts,
    blockingVirtualFallback:virtual.blocking === true,
    virtualFallbackRowCount:Number(virtual.rowCount) || novels.length
  });
  appendTreePageControl(app, box);
  scheduleAfterFrame(() => box.classList.remove('novel-list-rendering'));
}
