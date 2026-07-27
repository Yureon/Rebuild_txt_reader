import { ApiClient } from './core/api.mjs';
import { REBUILD_VERSION, stableDeviceId } from './core/utils.mjs';
import { createState } from './state/app-state.mjs';
import { installUi, showReader, toast } from './features/ui.mjs';
import { installClientPerformanceMetrics, markPerformancePhase, finalizeBootPerformance } from './core/performance-metrics.mjs';

export const MAIN_LAZY_BOOT_PASS = 'v568-main-lazy-boot-pass';
export const MAIN_PERFORMANCE_PHASE_PASS = 'v569-main-performance-phase-pass';
export const SEPARATE_LIBRARY_READER_PAGE_PASS = 'v574-separate-library-reader-page-pass';
export const LIBRARY_NAVIGATION_RESTORE_PASS = 'v575-library-navigation-restore-pass';
export const BOOT_PROMISE_RECOVERY_PASS = 'v610-boot-promise-recovery-pass';

let activeBootPromise = null;

export function normalizeProfile(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'mobile') return 'mobile';
  if (raw === 'library') return 'library';
  return 'site';
}

export function boot(options = {}) {
  if (window.__TXT_READER_REBUILD_BOOT_OK__ && window.TxtReaderRebuild) return Promise.resolve(window.TxtReaderRebuild);
  if (activeBootPromise) return activeBootPromise;
  activeBootPromise = runBoot(options).catch(async (error) => {
    try {
      const { cleanupFailedBoot } = await import('./core/boot-recovery.mjs');
      cleanupFailedBoot(window.TxtReaderRebuild);
    } catch {}
    window.__TXT_READER_REBUILD_BOOT_STARTED__ = false;
    window.__TXT_READER_REBUILD_BOOT_OK__ = false;
    window.TxtReaderRebuild = null;
    throw error;
  }).finally(() => {
    activeBootPromise = null;
  });
  return activeBootPromise;
}

async function runBoot(options = {}) {
  const profile = normalizeProfile(
    options.profile ||
    window.__TXT_READER_CLIENT_PROFILE__ ||
    document.body?.dataset.clientProfile ||
    'site'
  );

  window.__TXT_READER_REBUILD_BOOT_STARTED__ = true;
  markPerformancePhase('bootStart', { pass:MAIN_PERFORMANCE_PHASE_PASS, profile });
  document.documentElement.dataset.clientProfile = profile;
  document.documentElement.dataset.mainLazyBootPass = MAIN_LAZY_BOOT_PASS;
  document.body?.setAttribute('data-client-profile', profile);
  document.body?.classList.add(`reader-${profile}`);

  const deviceId = stableDeviceId();
  const api = new ApiClient({ deviceId });
  const scopeBootstrap = await import('./core/user-scope-bootstrap.mjs').then(module => module.bootstrapUserScope(api));
  const state = createState({ profile });
  state.userId = String(scopeBootstrap?.snapshot?.userId || '');
  state.userAccessSnapshot = scopeBootstrap?.snapshot || null;
  state.userStorageScope = scopeBootstrap?.scope || 'anonymous';
  state.userStorageMigration = scopeBootstrap?.migration || null;
  const app = {
    profile,
    isMobileProfile: profile === 'mobile',
    isLibraryProfile: profile === 'library',
    separateLibraryReaderPages: true,
    state,
    api,
    els: {},
    closeSidebar: null,
    openLayer: null,
    closeLayer: null,
    reader: null,
    library: null,
    bookmarks: null,
    search: null
  };
  window.TxtReaderRebuild = app;
  installClientPerformanceMetrics(app);
  await import('./core/progress-hydration.mjs').then(m=>m.hydratePersistedProgress(app));

  installUi(app);
  markPerformancePhase('uiInstalled');
  await import('./features/lazy-features.mjs').then(module => module.installLazyFeatureRuntime(app));
  await import('./features/library.mjs').then(module => module.installLibrary(app));

  await import('./core/user-scope-bootstrap.mjs').then(module => module.initializeAccessBootstrap(app, scopeBootstrap, { deferRestrictedDetails:profile === 'library' }));
  await import('./core/progress-storage.mjs').then(module => module.deleteLegacyUnscopedProgressState()).catch(() => false);
  await import('./features/sync/server-state-hydration.mjs').then(module => module.hydrateServerState(app));
  markPerformancePhase('serverStateHydrated');
  await import('./features/settings/appearance.mjs').then(module => module.applyPrefs(app));
  if (profile === 'library') {
    const navigationTarget = await import('./features/library-navigation-context.mjs').then(module => module.readLibraryNavigationContext());
    app.state.libraryNavigationTarget = navigationTarget;
    app.state.libraryViewMode = navigationTarget.requested ? navigationTarget.view : 'shelf';
    app.state.libraryCatalogMode = app.state.libraryViewMode === 'shelf' ? 'shelf' : (app.state.libraryViewMode === 'explorer' ? 'explorer' : 'tree');
    if (navigationTarget.requested) {
      app.state.libraryNavigationPersistedUi = {
        scope:app.state.libraryShelfScope,
        sort:app.state.libraryShelfSort,
        filters:app.state.libraryShelfFilters
      };
      app.state.libraryShelfScope = 'all';
      app.state.libraryShelfSort = 'title';
      app.state.libraryFilter = '';
      app.state.libraryShelfFilters = { publicationStatuses:[], authors:[], categories:[], tags:[], groupKinds:[] };
    }
    await app.library.load();
    markPerformancePhase('libraryReady', { count:app.state.libraryShelfItems?.length || 0, pass:SEPARATE_LIBRARY_READER_PAGE_PASS });
  } else {
    showReader(app, 'empty');
    const target = readReaderTargetFromLocation();
    if (target.novelId) {
      try {
        await openReaderTarget(app, target);
      } catch (error) {
        showReader(app, 'empty');
        toast(app, 'error', '작품 열기 실패', error?.message || String(error));
      }
    } else await restoreLastRead(app);
    markPerformancePhase('lastReadRestoreComplete', { restored:!!app.state.current, target:target.novelId || '' });
  }
  await import('./features/sync/periodic-device-sync.mjs').then(module => module.installPeriodicDeviceSync(app));
  window.__TXT_READER_REBUILD_BOOT_OK__ = true;
  finalizeBootPerformance();
  console.info(`[txt-reader] ${REBUILD_VERSION} ${profile} boot ok · ${MAIN_LAZY_BOOT_PASS}`);
  return app;
}

function readReaderTargetFromLocation(locationObject = globalThis.location) {
  try {
    const url = new URL(locationObject?.href || '', globalThis.location?.origin || 'http://local.invalid');
    return {
      novelId:String(url.searchParams.get('novelId') || '').trim(),
      episodeId:String(url.searchParams.get('episodeId') || '').trim(),
      source:String(url.searchParams.get('from') || '').trim()
    };
  } catch {
    return { novelId:'', episodeId:'', source:'' };
  }
}

async function openReaderTarget(app, target = {}) {
  let novel = app.state.novelById.get(target.novelId);
  if (!novel && typeof app.library?.ensureNovelLoaded === 'function') novel = await app.library.ensureNovelLoaded(target.novelId);
  if (!novel) throw new Error('선택한 작품을 찾을 수 없습니다.');
  if (novel.isMultiFile && typeof app.library?.ensureNovelEpisodes === 'function') await app.library.ensureNovelEpisodes(novel);
  const snap = await import('./features/library-model.mjs').then(module => module.findProgressSnapshotForNovel(app.state, novel));
  const explicitEpisodeId = String(target.episodeId || '');
  let choice = 'resume';
  if (target.source === 'library' && !explicitEpisodeId && snap) {
    choice = await import('./features/reader/continue-reading-prompt.mjs')
      .then(module => module.promptContinueReading(app, novel, snap));
  }
  if (choice === 'restart') {
    const firstEpisodeId = novel.isMultiFile ? String(novel.episodes?.[0]?.id || '') : '';
    await app.reader.openNovel(novel, { episodeId:firstEpisodeId || null, chunk:1, ratio:0, documentRatio:0, globalBlockIndex:0, blockIndex:0, charIndex:0 });
    return;
  }
  const episodeId = explicitEpisodeId || snap?.episodeId || null;
  await app.reader.openNovel(novel, {
    episodeId,
    chunk:snap?.chunk || 1,
    totalChunks:snap?.totalChunks,
    ratio:snap?.documentRatio ?? snap?.ratio ?? 0,
    documentRatio:snap?.documentRatio,
    episodeDocumentRatio:snap?.episodeDocumentRatio,
    globalBlockIndex:snap?.globalBlockIndex,
    blockIndex:snap?.blockIndex,
    charIndex:snap?.charIndex
  });
}

async function restoreLastRead(app) {
  const snap = app.state.progress.lastRead || null;
  if (!snap || !snap.novelId) return;
  let novel = app.state.novelById.get(snap.novelId);
  if (!novel && typeof app.library?.ensureNovelLoaded === 'function') {
    try { novel = await app.library.ensureNovelLoaded(snap.novelId); } catch {}
  }
  if (!novel) return;
  try {
    if (novel.isMultiFile && typeof app.library?.ensureNovelEpisodes === 'function') {
      await app.library.ensureNovelEpisodes(novel);
    }
    await app.reader.openNovel(novel, { episodeId: snap.episodeId || null, chunk: snap.chunk || 1, totalChunks: snap.totalChunks, ratio: snap.documentRatio ?? snap.ratio ?? 0, globalBlockIndex: snap.globalBlockIndex, blockIndex: snap.blockIndex, charIndex: snap.charIndex });
  } catch (e) {
    toast(app, 'info', '자동 복원 실패', e.message || String(e));
  }
}
