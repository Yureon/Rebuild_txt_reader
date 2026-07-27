export const LIBRARY_NAVIGATION_ACTIONS_PASS = 'v296-library-navigation-actions-pass';
export const LIBRARY_READER_PAGE_NAVIGATION_PASS = 'v574-library-reader-page-navigation-pass';
export const LIBRARY_READER_SEPARATE_PAGE_PASS = 'v574-library-reader-separate-page-pass';
export const LIBRARY_MULTIFILE_OPEN_NO_AUTO_EXPAND_PASS = 'v371-library-multifile-open-no-auto-expand-pass';


function getProgressAliases(novel) {
  const aliases = Array.isArray(novel?.progressAliases) ? novel.progressAliases : [novel?.id];
  return Array.from(new Set(aliases.map(value => String(value || '')).filter(Boolean)));
}

function snapshotTimestamp(snap) {
  return Math.max(0, Number(snap?.updatedAt || snap?.savedAt || snap?.ts || snap?.timestamp) || 0);
}

function findSnapshotForNovel(app, novel) {
  const byNovel = app?.state?.progress?.byNovel || {};
  const representativeId = String(novel?.id || '');
  return getProgressAliases(novel)
    .map(id => ({ id, snap:byNovel[id] }))
    .filter(item => item.snap)
    .sort((left, right) =>
      snapshotTimestamp(right.snap) - snapshotTimestamp(left.snap)
        || Number(right.id === representativeId) - Number(left.id === representativeId)
    )[0]?.snap || null;
}

function preferredReaderProfile(win = globalThis.window) {
  let saved = '';
  try { saved = String(win?.localStorage?.getItem?.('txt-reader.rebuild.preferredEntry') || ''); } catch {}
  if (saved === 'mobile' || saved === 'site') return saved;
  try {
    if (win?.matchMedia?.('(max-width: 820px)').matches || win?.matchMedia?.('(hover: none) and (pointer: coarse)').matches) return 'mobile';
  } catch {}
  return 'site';
}

export function buildReaderPageUrl(novelId, episodeId = '', options = {}) {
  const win = options.windowObject || globalThis.window;
  const profile = options.profile || preferredReaderProfile(win);
  const base = profile === 'mobile' ? '/mobile.html' : '/site.html';
  const url = new URL(base, win?.location?.origin || 'http://local.invalid');
  url.searchParams.set('novelId', String(novelId || ''));
  url.searchParams.set('from', 'library');
  if (episodeId) url.searchParams.set('episodeId', String(episodeId));
  return `${url.pathname}${url.search}`;
}

function navigateLibrarySelectionToReader(app, novel, episodeId = '', options = {}) {
  if (app?.profile !== 'library' || !novel?.id) return false;
  const win = options.windowObject || globalThis.window;
  const href = buildReaderPageUrl(novel.id, episodeId, { windowObject:win });
  win?.location?.assign?.(href);
  return { opened:true, navigated:true, type:episodeId ? 'episode-page' : 'novel-page', novelId:novel.id, episodeId:episodeId || null, href, pass:LIBRARY_READER_SEPARATE_PAGE_PASS };
}

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
  const pageNavigation = navigateLibrarySelectionToReader(app, novel);
  if (pageNavigation) return pageNavigation;

  if (novel.isMultiFile) {
    const openLoadedNovel = () => {
      const snap = findSnapshotForNovel(app, novel) || app.state.progress?.lastRead;
      const episode = deps.findEpisodeForSnapshot?.(novel, snap) || (novel.episodes && novel.episodes[0]);
      app.reader?.openNovel?.(novel, deps.openOptionsFromSnapshot?.({ episodeId: episode?.id || null }, snap));
      deps.closeSidebarAfterLibraryOpen?.(app);
      return { opened:true, type:'multi-file', novelId: novel.id, episodeId: episode?.id || null };
    };
    if ((!Array.isArray(novel.episodes) || !novel.episodes.length) && typeof deps.ensureNovelEpisodesLoaded === 'function') {
      return Promise.resolve(deps.ensureNovelEpisodesLoaded(app, novel)).then(openLoadedNovel).catch(error => {
        deps.toast?.(app, 'error', '회차 목록 불러오기 실패', error?.message || String(error));
        return { opened:false, reason:'episode-load-failed', novelId:novel.id, error:error?.message || String(error) };
      });
    }
    return openLoadedNovel();
  }

  app.reader?.openNovel?.(novel, deps.openOptionsFromSnapshot?.({}, findSnapshotForNovel(app, novel)));
  deps.closeSidebarAfterLibraryOpen?.(app);
  return { opened:true, type:'single-file', novelId: novel.id, episodeId:null };
}

export function openEpisodeFromElementRuntime(app, item, deps = {}) {
  const novelId = getNovelIdFromItem(item);
  const episodeId = getEpisodeIdFromItem(item);
  const novel = app?.state?.novelById?.get?.(novelId);
  if (!novel || !episodeId) return { opened:false, reason: novel ? 'missing-episode-id' : 'missing-novel', novelId, episodeId };
  const pageNavigation = navigateLibrarySelectionToReader(app, novel, episodeId);
  if (pageNavigation) return pageNavigation;
  const openLoadedEpisode = () => {
    const snap = app.state.progress?.readMeta?.[`${novel.id}-${episodeId}`];
    app.reader?.openNovel?.(novel, deps.openOptionsFromSnapshot?.({ episodeId }, snap));
    deps.closeSidebarAfterLibraryOpen?.(app);
    return { opened:true, type:'episode', novelId: novel.id, episodeId };
  };
  if ((!Array.isArray(novel.episodes) || !novel.episodes.length) && typeof deps.ensureNovelEpisodesLoaded === 'function') {
    return Promise.resolve(deps.ensureNovelEpisodesLoaded(app, novel)).then(openLoadedEpisode).catch(error => {
      deps.toast?.(app, 'error', '회차 목록 불러오기 실패', error?.message || String(error));
      return { opened:false, reason:'episode-load-failed', novelId, episodeId, error:error?.message || String(error) };
    });
  }
  return openLoadedEpisode();
}

export function getLibraryNavigationActionsContract() {
  return {
    pass: LIBRARY_NAVIGATION_ACTIONS_PASS,
    owns: ['open-novel-from-row', 'open-episode-from-row', 'mobile-sidebar-close-after-open'],
    injectedBoundaries: ['progress-snapshot-options', 'library-ui-persistence', 'render-refresh', 'reader-open'],
    nonGoals: ['event-delegation', 'favorite-persistence', 'list-action-mutation']
  };
}
