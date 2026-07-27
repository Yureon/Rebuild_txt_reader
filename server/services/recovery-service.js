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

async function getFileHealthAsync(filePath) {
  async function inspect(targetPath) {
    try {
      const stat = await fs.promises.lstat(targetPath);
      return { exists:true, regularFile:stat.isFile(), symlink:stat.isSymbolicLink(), size:stat.isFile() ? stat.size : 0, mtimeMs:Math.floor(stat.mtimeMs || 0) };
    } catch (error) {
      if (error && error.code === 'ENOENT') return { exists:false, regularFile:false, symlink:false, size:0, mtimeMs:0 };
      return { exists:false, regularFile:false, symlink:false, size:0, mtimeMs:0, error:String(error && error.message || error) };
    }
  }
  const [primary, backup] = await Promise.all([inspect(filePath), inspect(filePath + '.bak')]);
  return {
    exists:primary.exists,
    bakExists:backup.exists,
    regularFile:primary.regularFile,
    symlink:primary.symlink,
    bakRegularFile:backup.regularFile,
    bakSymlink:backup.symlink,
    size:primary.size,
    mtimeMs:primary.mtimeMs,
    error:primary.error || backup.error || ''
  };
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

async function getLatestSnapshotInfoAsync(snapshotDir, prefix) {
  const safePrefix = String(prefix || '').trim();
  if (!safePrefix || !snapshotDir) return { count:0, latest:'', latestMtimeMs:0 };
  try {
    const entries = await fs.promises.readdir(snapshotDir, { withFileTypes:true });
    let count = 0;
    let latest = '';
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const name = String(entry.name || '');
      if (!name.startsWith(safePrefix + '-') || !name.endsWith('.json')) continue;
      count += 1;
      if (!latest || name > latest) latest = name;
    }
    let latestMtimeMs = 0;
    if (latest) {
      try {
        const stat = await fs.promises.lstat(path.join(snapshotDir, latest));
        if (stat.isFile() && !stat.isSymbolicLink()) latestMtimeMs = Math.floor(stat.mtimeMs || 0);
      } catch (_error) {}
    }
    return { count, latest, latestMtimeMs };
  } catch (error) {
    if (error && error.code === 'ENOENT') return { count:0, latest:'', latestMtimeMs:0 };
    return { count:0, latest:'', latestMtimeMs:0, error:String(error && error.message || error) };
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

  async function getRecoveryStatusAsync() {
    const [syncData, sessions, fonts, snapshot] = await Promise.all([
      getFileHealthAsync(syncDataPath),
      getFileHealthAsync(sessionStorePath),
      getFileHealthAsync(fontMetaPath),
      getLatestSnapshotInfoAsync(snapshotDir, snapshotPrefix)
    ]);
    const libraryStatus = safeLibraryCacheStatus(libraryService);
    return {
      syncData,
      sessions,
      fonts,
      snapshot,
      libraryCache:libraryStatus.libraryCache,
      syncPersistence:safeSyncPersistenceStatus(syncStateService),
      recoveryPolicies:RECOVERY_POLICIES,
      ...safeContentCacheStatus(contentService),
      dirScanCacheEntries:libraryStatus.dirScanCacheEntries,
      degraded:!!(syncData.error || sessions.error || fonts.error || snapshot.error)
    };
  }

  return {
    getFileHealth,
    getFileHealthAsync,
    getLatestSnapshotInfo: () => getLatestSnapshotInfo(snapshotDir, snapshotPrefix),
    getLatestSnapshotInfoAsync: () => getLatestSnapshotInfoAsync(snapshotDir, snapshotPrefix),
    getRecoveryStatus,
    getRecoveryStatusAsync
  };
}

module.exports = {
  createRecoveryService,
  getFileHealth,
  getFileHealthAsync,
  getLatestSnapshotInfo,
  getLatestSnapshotInfoAsync
};
