const fs = require('fs');
const path = require('path');

const DEFAULT_LIBRARY_CACHE = {
  count: 0,
  buildCount: 0,
  lastBuildMs: 0,
  lastBuildAt: 0,
  signature: ''
};

const DEFAULT_CONTENT_CACHE = {
  fileCacheEntries: 0,
  fileCacheBytes: 0,
  chunkIndexPending: 0
};

const RECOVERY_POLICIES = {
  scopedImport: true,
  importPreview: true,
  destructiveClientActionsRequireConfirm: true,
  sharedDeviceRestoreDefault: false,
  serverStateRestoreRequiresExplicitScope: true,
  cacheClearScope: 'client-indexeddb-only',
  backupSnapshotBeforeServerWrite: true
};

function getFileHealth(filePath) {
  try {
    const stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
    return {
      exists: !!stat,
      bakExists: fs.existsSync(filePath + '.bak'),
      size: stat ? stat.size : 0,
      mtimeMs: stat ? Math.floor(stat.mtimeMs || 0) : 0
    };
  } catch (e) {
    return { exists: false, bakExists: false, size: 0, mtimeMs: 0 };
  }
}

function getLatestSnapshotInfo(snapshotDir, prefix) {
  try {
    const safePrefix = String(prefix || '').trim();
    if (!safePrefix || !snapshotDir || !fs.existsSync(snapshotDir)) {
      return { count: 0, latest: '', latestMtimeMs: 0 };
    }

    const files = fs.readdirSync(snapshotDir)
      .filter((name) => name.startsWith(safePrefix + '-') && name.endsWith('.json'))
      .sort();
    const latest = files.length ? files[files.length - 1] : '';
    const st = latest ? fs.statSync(path.join(snapshotDir, latest)) : null;

    return {
      count: files.length,
      latest: latest || '',
      latestMtimeMs: st ? Math.floor(st.mtimeMs || 0) : 0
    };
  } catch (e) {
    return { count: 0, latest: '', latestMtimeMs: 0 };
  }
}

function safeLibraryCacheStatus(libraryService) {
  try {
    const status = libraryService && typeof libraryService.getCacheStatus === 'function'
      ? libraryService.getCacheStatus()
      : {};
    return {
      libraryCache: status.libraryCache || DEFAULT_LIBRARY_CACHE,
      dirScanCacheEntries: Number(status.dirScanCacheEntries) || 0
    };
  } catch (e) {
    return {
      libraryCache: DEFAULT_LIBRARY_CACHE,
      dirScanCacheEntries: 0
    };
  }
}

function safeContentCacheStatus(contentService) {
  try {
    const status = contentService && typeof contentService.getCacheStatus === 'function'
      ? contentService.getCacheStatus()
      : {};
    return Object.assign({}, DEFAULT_CONTENT_CACHE, status || {});
  } catch (e) {
    return Object.assign({}, DEFAULT_CONTENT_CACHE);
  }
}

function safeSyncPersistenceStatus(syncStateService) {
  try {
    return syncStateService && typeof syncStateService.getPersistenceStatus === 'function'
      ? syncStateService.getPersistenceStatus()
      : {};
  } catch (e) {
    return {};
  }
}

function createRecoveryService({
  syncDataPath,
  sessionStorePath,
  fontMetaPath,
  snapshotDir,
  snapshotPrefix,
  libraryService,
  contentService,
  syncStateService
} = {}) {
  if (!syncDataPath) throw new Error('syncDataPath is required');
  if (!sessionStorePath) throw new Error('sessionStorePath is required');
  if (!fontMetaPath) throw new Error('fontMetaPath is required');
  if (!snapshotDir) throw new Error('snapshotDir is required');
  if (!snapshotPrefix) throw new Error('snapshotPrefix is required');

  function getRecoveryStatus() {
    try {
      const snapshot = getLatestSnapshotInfo(snapshotDir, snapshotPrefix);
      const libraryStatus = safeLibraryCacheStatus(libraryService);
      return {
        syncData: getFileHealth(syncDataPath),
        sessions: getFileHealth(sessionStorePath),
        fonts: getFileHealth(fontMetaPath),
        snapshot,
        libraryCache: libraryStatus.libraryCache,
        syncPersistence: safeSyncPersistenceStatus(syncStateService),
        recoveryPolicies: RECOVERY_POLICIES,
        ...safeContentCacheStatus(contentService),
        dirScanCacheEntries: libraryStatus.dirScanCacheEntries
      };
    } catch (err) {
      const libraryStatus = safeLibraryCacheStatus(libraryService);
      return {
        syncData: getFileHealth(syncDataPath),
        sessions: getFileHealth(sessionStorePath),
        fonts: getFileHealth(fontMetaPath),
        snapshot: { count: 0, latest: '', latestMtimeMs: 0 },
        libraryCache: libraryStatus.libraryCache,
        syncPersistence: safeSyncPersistenceStatus(syncStateService),
        recoveryPolicies: RECOVERY_POLICIES,
        ...safeContentCacheStatus(contentService),
        dirScanCacheEntries: libraryStatus.dirScanCacheEntries,
        degraded: true
      };
    }
  }

  return {
    getFileHealth,
    getLatestSnapshotInfo: () => getLatestSnapshotInfo(snapshotDir, snapshotPrefix),
    getRecoveryStatus
  };
}

module.exports = {
  createRecoveryService,
  getFileHealth,
  getLatestSnapshotInfo
};
