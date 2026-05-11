import { ApiClient } from './core/api.mjs';
import { REBUILD_VERSION } from './core/utils.mjs';
import { createState } from './state/app-state.mjs';
import { installUi, showReader, toast } from './features/ui.mjs';
import { installThemeAndSettings, applyPrefs } from './features/theme-settings.mjs';
import { installLibrary } from './features/library.mjs';
import { installReader } from './features/reader.mjs';
import { installBookmarks, installReadDataModal } from './features/bookmarks.mjs';
import { installSearch } from './features/search.mjs';
import { hydrateServerState, installDevtools, installPeriodicDeviceSync } from './features/sync-devtools.mjs';

export function normalizeProfile(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'mobile') return 'mobile';
  return 'site';
}

export async function boot(options = {}) {
  if (window.__TXT_READER_REBUILD_BOOT_OK__ && window.TxtReaderRebuild) return window.TxtReaderRebuild;
  if (window.__TXT_READER_REBUILD_BOOT_STARTED__ && window.TxtReaderRebuild) return window.TxtReaderRebuild;
  const profile = normalizeProfile(
    options.profile ||
    window.__TXT_READER_CLIENT_PROFILE__ ||
    document.body?.dataset.clientProfile ||
    'site'
  );

  window.__TXT_READER_REBUILD_BOOT_STARTED__ = true;
  document.documentElement.dataset.clientProfile = profile;
  document.body?.setAttribute('data-client-profile', profile);
  document.body?.classList.add(`reader-${profile}`);

  const state = createState({ profile });
  const app = {
    profile,
    isMobileProfile: profile === 'mobile',
    state,
    api: new ApiClient({ deviceId: state.deviceId }),
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

  installUi(app);
  installLibrary(app);
  installReader(app);
  installBookmarks(app);
  installReadDataModal(app);
  installSearch(app);
  installThemeAndSettings(app);
  installDevtools(app);

  await hydrateServerState(app);
  applyPrefs(app);
  await app.library.load();
  showReader(app, 'empty');
  await restoreLastRead(app);
  installPeriodicDeviceSync(app);
  window.__TXT_READER_REBUILD_BOOT_OK__ = true;
  console.info(`[txt-reader] ${REBUILD_VERSION} ${profile} boot ok`);
  return app;
}

async function restoreLastRead(app) {
  const snap = app.state.progress.lastRead || null;
  if (!snap || !snap.novelId) return;
  const novel = app.state.novelById.get(snap.novelId);
  if (!novel) return;
  try {
    await app.reader.openNovel(novel, { episodeId: snap.episodeId || null, chunk: snap.chunk || 1, totalChunks: snap.totalChunks, ratio: snap.documentRatio ?? snap.ratio ?? 0, globalBlockIndex: snap.globalBlockIndex, blockIndex: snap.blockIndex, charIndex: snap.charIndex });
  } catch (e) {
    toast(app, 'info', '자동 복원 실패', e.message || String(e));
  }
}
