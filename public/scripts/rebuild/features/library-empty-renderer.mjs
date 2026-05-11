import { createEl } from '../core/utils.mjs';

export const LIBRARY_EMPTY_RENDERER_PASS = 'v297-library-empty-renderer-pass';

export function renderLibraryEmptyStateRuntime(app, box, options = {}, deps = {}) {
  if (!box) return false;
  box.classList.remove('library-virtual-active');
  delete box.dataset.libraryVirtualActive;
  if (app?.state) app.state.libraryVirtualWindowRenderCache = null;
  box.replaceChildren(createEl('div', {
    class:'list-empty-state',
    text: app?.state?.libraryFilter ? '검색 결과가 없습니다.' : '표시할 TXT 파일이 없습니다.'
  }));
  if (options.resetScroll) box.scrollTop = 0;
  deps.recordLibraryVirtualRender?.(app, {
    mode:'full',
    kind:'informational-empty-state',
    blocking:false,
    reason:'empty-list',
    rowCount:0,
    renderedRows:0,
    source:options.source,
    at:Date.now()
  });
  box.classList.remove('novel-list-rendering');
  return true;
}
