export const LIBRARY_NAVIGATION_ACTIONS_PASS = 'v296-library-navigation-actions-pass';
export const LIBRARY_MULTIFILE_OPEN_NO_AUTO_EXPAND_PASS = 'v371-library-multifile-open-no-auto-expand-pass';

function getNovelIdFromItem(item) {
  return String(item?.dataset?.novelId || '');
}

function getEpisodeIdFromItem(item) {
  return String(item?.dataset?.episodeId || '');
}

export function closeSidebarAfterLibraryOpenRuntime(app, options = {}) {
  if (!app || typeof app.closeSidebar !== 'function') return false;
  const doc = options.documentObject || globalThis.document;
  const win = options.windowObject || globalThis.window;
  const mobileOverlay = !!doc?.body?.classList?.contains?.('mobile-library-overlay') || !!app.isMobileProfile;
  if (!mobileOverlay) return false;
  win?.requestAnimationFrame?.(() => app.closeSidebar?.());
  return true;
}

export function openNovelFromElementRuntime(app, item, deps = {}) {
  const novelId = getNovelIdFromItem(item);
  const novel = app?.state?.novelById?.get?.(novelId);
  if (!novel) return { opened:false, reason:'missing-novel', novelId };

  if (novel.isMultiFile) {
    const snap = app.state.progress?.byNovel?.[novel.id] || app.state.progress?.lastRead;
    const episode = deps.findEpisodeForSnapshot?.(novel, snap) || (novel.episodes && novel.episodes[0]);
    app.reader?.openNovel?.(novel, deps.openOptionsFromSnapshot?.({ episodeId: episode?.id || null }, snap));
    deps.closeSidebarAfterLibraryOpen?.(app);
    return { opened:true, type:'multi-file', novelId: novel.id, episodeId: episode?.id || null };
  }

  app.reader?.openNovel?.(novel, deps.openOptionsFromSnapshot?.({}, app.state.progress?.byNovel?.[novel.id]));
  deps.closeSidebarAfterLibraryOpen?.(app);
  return { opened:true, type:'single-file', novelId: novel.id, episodeId:null };
}

export function openEpisodeFromElementRuntime(app, item, deps = {}) {
  const novelId = getNovelIdFromItem(item);
  const episodeId = getEpisodeIdFromItem(item);
  const novel = app?.state?.novelById?.get?.(novelId);
  if (!novel || !episodeId) return { opened:false, reason: novel ? 'missing-episode-id' : 'missing-novel', novelId, episodeId };
  const snap = app.state.progress?.readMeta?.[`${novel.id}-${episodeId}`];
  app.reader?.openNovel?.(novel, deps.openOptionsFromSnapshot?.({ episodeId }, snap));
  deps.closeSidebarAfterLibraryOpen?.(app);
  return { opened:true, type:'episode', novelId: novel.id, episodeId };
}

export function getLibraryNavigationActionsContract() {
  return {
    pass: LIBRARY_NAVIGATION_ACTIONS_PASS,
    owns: ['open-novel-from-row', 'open-episode-from-row', 'mobile-sidebar-close-after-open'],
    injectedBoundaries: ['progress-snapshot-options', 'library-ui-persistence', 'render-refresh', 'reader-open'],
    nonGoals: ['event-delegation', 'favorite-persistence', 'list-action-mutation']
  };
}
