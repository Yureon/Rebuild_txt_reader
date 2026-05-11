import { debounce } from '../core/utils.mjs';

export const LIBRARY_INSTALL_CONTROLS_RUNTIME_PASS = 'v298-library-install-controls-runtime-pass';

export function createLibraryFilteredRenderRuntime(app, deps = {}) {
  const wait = Number.isFinite(deps.filterRenderWait) ? deps.filterRenderWait : 120;
  return debounce(() => deps.renderLibrary?.(app, { source:'filter-input', resetScroll:true, followActive:false }), wait);
}

export function installLibraryControlHandlersRuntime(app, on, renderFilteredLibrary, deps = {}) {
  on(app.els.search, 'input', ev => {
    app.state.libraryFilter = String(ev.target.value || '').trim();
    renderFilteredLibrary();
  });
  on(app.els.novelList, 'scroll', () => deps.scheduleLibraryVirtualRender?.(app), { passive:true });
  on(app.els.expandAllBtn, 'click', () => {
    renderFilteredLibrary.cancel?.();
    deps.collectFolderKeys?.(app.state.novels).forEach(k => app.state.collapsedFolders.delete(k));
    app.state.novels.filter(n => n.isMultiFile).forEach(n => app.state.expandedEpisodeNovels.add(n.id));
    deps.persistLibraryUi?.(app.state);
    deps.renderLibrary?.(app, { source:'expand-all', resetScroll:true, followActive:false });
  });
  on(app.els.collapseAllBtn, 'click', () => {
    renderFilteredLibrary.cancel?.();
    deps.collectFolderKeys?.(app.state.novels).forEach(k => app.state.collapsedFolders.add(k));
    app.state.expandedEpisodeNovels.clear();
    deps.persistLibraryUi?.(app.state);
    deps.renderLibrary?.(app, { source:'collapse-all', resetScroll:true, followActive:false });
  });
}

export function cleanupLibraryRuntime(app, renderFilteredLibrary, disposers = [], deps = {}) {
  renderFilteredLibrary.cancel?.();
  deps.cancelLibraryVirtualRender?.(app);
  deps.clearLibraryVirtualTrialTimer?.(app);
  disposers.splice(0).forEach(dispose => dispose());
  if (app.els.novelList?.dataset) delete app.els.novelList.dataset.delegatedLibraryEvents;
  if (app.els.libraryQuickList?.dataset) delete app.els.libraryQuickList.dataset.delegatedLibraryQuickEvents;
  app.state.libraryActionTarget = null;
  deps.finishLibraryDrag?.(app);
  deps.clearLongPress?.(app);
}
