import { getVirtualLayoutDiagnostics } from '../reader/virtual-layout.mjs';
import { getSearchTextCacheDiagnostics } from './search-diagnostics.mjs';
import { getRecoveryImportScopes } from './import-scope-panel.mjs';
import { downloadRecoveryJsonFile } from './export-utils.mjs';

export const RECOVERY_SNAPSHOT_EXPORT_REFACTOR_PASS = 'v176-recovery-snapshot-export-pass';
export const READER_RECOVERY_PROGRESS_DIAGNOSTICS_PASS = 'v487-reader-recovery-progress-diagnostics-pass';


function buildReaderProgressDiagnostics(app) {
  const state = app?.state || {};
  const current = state.current || null;
  return {
    pass: READER_RECOVERY_PROGRESS_DIAGNOSTICS_PASS,
    version: state.version || '',
    mode: current?.novel?.isMultiFile && current?.episode ? 'multi-file' : 'single-file',
    novelId: current?.novel?.id || null,
    episodeId: current?.episode?.id || null,
    chunk: Number.isFinite(Number(current?.chunk)) ? Number(current.chunk) : null,
    totalChunks: Number.isFinite(Number(current?.totalChunks)) ? Number(current.totalChunks) : null,
    sliderProgressDiagnostic: state.lastReaderSliderProgressDiagnostic || null,
    coordinatePolicy: state.lastReaderCoordinatePolicy || null,
    safeAreaMultiFileProgress: state.lastSafeAreaMultiFileProgress || null,
    navSliderValue: app?.els?.navSlider?.value || '',
    navSliderMax: app?.els?.navSlider?.max || '',
    readerScrollTop: Math.round(Number(app?.els?.reader?.scrollTop) || 0),
    readerClientHeight: Math.round(Number(app?.els?.reader?.clientHeight) || 0),
    readerScrollHeight: Math.round(Number(app?.els?.reader?.scrollHeight) || 0),
    at: Date.now()
  };
}

export function buildRecoverySnapshot(app, options = {}) {
  const base = {
    version: app.state.version,
    deviceId: app.state.deviceId,
    deviceName: app.state.deviceName,
    current: app.state.current ? {
      novelId: app.state.current.novel.id,
      episodeId: app.state.current.episode?.id || null,
      chunk: app.state.current.chunk,
      totalChunks: app.state.current.totalChunks,
      title: app.state.current.title
    } : null,
    prefs: app.state.prefs,
    novels: app.state.novels.length,
    loadedChunks: Array.from(app.state.loadedChunks.keys()),
    virtualDiagnostics: getVirtualLayoutDiagnostics(app),
    readerProgressDiagnostics: buildReaderProgressDiagnostics(app),
    searchTextCacheDiagnostics: getSearchTextCacheDiagnostics(app, app.state.search?.coveragePreview || null),
    searchResults: app.state.search.results.length,
    errors: app.state.errors.slice(-10),
    sharedVersion: app.state.sharedVersion,
    deviceVersion: app.state.deviceVersion,
    syncPolicySummary: app.state.syncPolicySummary,
    recoveryImportScopes: getRecoveryImportScopes(app)
  };
  if (!options.full) return base;
  return {
    ...base,
    exportedAt: Date.now(),
    recoveryFormat: 'txt-reader-rebuild-recovery-v2',
    recoveryCapabilities: {
      scopedImport: true,
      importPreview: true,
      serverStateRestoreOptIn: true,
      deviceStateRestoreOptIn: true,
      clientCacheActions: true
    },
    prefs: app.state.prefs,
    bookmarks: app.state.bookmarks || [],
    favorites: Array.from(app.state.favorites || []),
    recents: app.state.recents || [],
    progress: app.state.progress || {},
    collapsedFolders: Array.from(app.state.collapsedFolders || []),
    shared: app.state.shared || null,
    device: app.state.device || null
  };
}

export function downloadRecoverySnapshot(app, options = {}) {
  const filename = options.filename || 'txt-reader-rebuild-recovery.json';
  return downloadRecoveryJsonFile(filename, buildRecoverySnapshot(app, { full: true }));
}
