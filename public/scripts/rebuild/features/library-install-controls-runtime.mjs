import { debounce } from '../core/utils.mjs';

export const LIBRARY_INSTALL_CONTROLS_RUNTIME_PASS = 'v298-library-install-controls-runtime-pass';

export function createLibraryFilteredRenderRuntime(app, deps = {}) {
  const wait = Number.isFinite(deps.filterRenderWait) ? deps.filterRenderWait : 300;
  return debounce(() => {
    if (app?.state?.libraryViewMode === 'shelf' && typeof deps.loadShelfPage === 'function') {
      Promise.resolve(deps.loadShelfPage(app, { reset:true, source:'filter-input' })).catch(error => {
        const history = Array.isArray(app.state.libraryAsyncErrors) ? app.state.libraryAsyncErrors : [];
        app.state.libraryAsyncErrors = [...history.slice(-19), { pass:'v612-library-async-event-guard-pass', type:'filter-input', message:error?.message || String(error), at:Date.now() }];
      });
      return;
    }
    deps.renderLibrary?.(app, { source:'filter-input', resetScroll:true, followActive:false });
  }, wait);
}

export function installLibraryControlHandlersRuntime(app, on, renderFilteredLibrary, deps = {}) {

  on(app.els.libraryUserTagsBtn, 'click', () => import('./library-user-tags.mjs').then(module => module.openUserTagDialog(app)).catch(error => globalThis.alert?.(error?.message || '사용자 태그 열기 실패')));
  on(app.els.libraryLogoutBtn, 'click', e => import('./library-logout-runtime.mjs').then(m => m.logoutFromLibrary(app, e.currentTarget)).catch(x => globalThis.alert?.(x?.message || '로그아웃 실패')));
  on(app.els.search, 'input', ev => {
    app.state.libraryFilter = String(ev.target.value || '').trim();
    renderFilteredLibrary();
  });
  on(app.els.novelList, 'scroll', () => {
    if (app?.state?.libraryViewMode !== 'files') return;
    deps.scheduleLibraryVirtualRender?.(app);
  }, { passive:true });
  on(app.els.expandAllBtn, 'click', () => {
    renderFilteredLibrary.cancel?.();
    const scrollAnchor = deps.getLibraryScrollAnchor?.(app) || null;
    deps.collectFolderKeys?.(app.state.novels).forEach(k => app.state.collapsedFolders.delete(k));
    app.state.novels.filter(n => n.isMultiFile && n.episodesLoaded === true && Array.isArray(n.episodes) && n.episodes.length).forEach(n => app.state.expandedEpisodeNovels.add(n.id));
    deps.persistLibraryUi?.(app.state);
    deps.renderLibrary?.(app, { source:'expand-all', scrollAnchor, followActive:false });
  });
  on(app.els.collapseAllBtn, 'click', () => {
    renderFilteredLibrary.cancel?.();
    const scrollAnchor = deps.getLibraryScrollAnchor?.(app) || null;
    deps.collectFolderKeys?.(app.state.novels).forEach(k => app.state.collapsedFolders.add(k));
    app.state.expandedEpisodeNovels.clear();
    deps.persistLibraryUi?.(app.state);
    deps.renderLibrary?.(app, { source:'collapse-all', scrollAnchor, followActive:false });
  });
}

export function cleanupLibraryRuntime(app, renderFilteredLibrary, disposers = [], deps = {}) {
  renderFilteredLibrary.cancel?.();
  deps.cancelLibraryVirtualRender?.(app);
  deps.clearLibraryVirtualTrialTimer?.(app);
  if (app?.state?.libraryTagSearchTimer) clearTimeout(app.state.libraryTagSearchTimer);
  if (app?.state) app.state.libraryTagSearchTimer = 0;
  app?.state?.libraryTagSearchController?.abort?.();
  app?.state?.libraryTagLoadMoreController?.abort?.();
  if (app?.state) { app.state.libraryTagSearchController = null; app.state.libraryTagLoadMoreController = null; }
  disposers.splice(0).forEach(dispose => dispose());
  if (app.els.novelList?.dataset) delete app.els.novelList.dataset.delegatedLibraryEvents;
  if (app.els.libraryQuickList?.dataset) delete app.els.libraryQuickList.dataset.delegatedLibraryQuickEvents;
  app.state.libraryActionTarget = null;
  deps.finishLibraryDrag?.(app);
  deps.clearLongPress?.(app);
}
