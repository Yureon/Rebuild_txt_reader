const fs = require('fs');
const path = require('path');
const { loadJsonWithBackup, atomicWriteJson } = require('../repositories/json-file-store');

function createSyncStateService(options = {}) {
  const {
    syncPath,
    snapshotDir,
    snapshotPrefix = 'sync-state',
    createEmptyState,
    normalizeState,
    logger = console
  } = options;

  if (!syncPath) throw new Error('createSyncStateService requires syncPath');
  if (!snapshotDir) throw new Error('createSyncStateService requires snapshotDir');
  if (typeof createEmptyState !== 'function') throw new Error('createSyncStateService requires createEmptyState');
  if (typeof normalizeState !== 'function') throw new Error('createSyncStateService requires normalizeState');

  const loaded = loadJsonWithBackup(syncPath, createEmptyState());
  let state = loaded.ok && loaded.data ? normalizeState(loaded.data) : createEmptyState();
  let saveTimer = null;
  let writing = false;
  let dirty = false;
  let retryTimer = null;
  let snapshotTimer = null;

  const SNAPSHOT_KEEP = 8;
  const SNAPSHOT_MIN_INTERVAL_MS = 2 * 60 * 1000;
  const persistenceState = {
    lastLoadedFrom: loaded.source || 'fallback',
    lastSaveAt: 0,
    lastSaveErrorAt: 0,
    lastSaveError: '',
    lastRetryAt: 0,
    lastSnapshotAt: 0,
    writeFailures: 0
  };

  function get() {
    return state;
  }

  function set(next) {
    state = normalizeState(next);
    return state;
  }

  function trimSnapshots() {
    try {
      const files = fs.readdirSync(snapshotDir)
        .filter((name) => name.startsWith(snapshotPrefix + '-') && name.endsWith('.json'))
        .sort();
      while (files.length > SNAPSHOT_KEEP) {
        const oldest = files.shift();
        if (!oldest) break;
        try { fs.unlinkSync(path.join(snapshotDir, oldest)); } catch (e) {}
      }
    } catch (e) {}
  }

  function scheduleSnapshot(reason) {
    if (snapshotTimer) clearTimeout(snapshotTimer);
    snapshotTimer = setTimeout(() => {
      snapshotTimer = null;
      if ((persistenceState.lastSnapshotAt || 0) && Date.now() - persistenceState.lastSnapshotAt < SNAPSHOT_MIN_INTERVAL_MS) {
        return;
      }
      const suffix = String(reason || 'save').slice(0, 24);
      const fileName = `${snapshotPrefix}-${new Date().toISOString().replace(/[:.]/g, '-')}-${suffix}.json`;
      const snapshotPath = path.join(snapshotDir, fileName);
      atomicWriteJson(snapshotPath, state, () => {
        persistenceState.lastSnapshotAt = Date.now();
        trimSnapshots();
      });
    }, 1200);
  }

  function scheduleRetry(delayMs) {
    const waitMs = Math.min(30000, Math.max(1500, Number(delayMs) || 2500));
    if (retryTimer) clearTimeout(retryTimer);
    persistenceState.lastRetryAt = Date.now() + waitMs;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      flush();
    }, waitMs);
  }

  function isPersistencePermissionError(error) {
    return error && ['EACCES', 'EPERM', 'EROFS'].includes(error.code);
  }

  function flush() {
    dirty = true;
    if (writing || retryTimer) return;
    writing = true;

    const writeNext = () => {
      if (!dirty) {
        writing = false;
        return;
      }

      dirty = false;
      atomicWriteJson(syncPath, state, (error) => {
        if (error) {
          logger.error('Sync save error (will keep in memory instead):', error.message);
          dirty = true;
          persistenceState.lastSaveErrorAt = Date.now();
          persistenceState.lastSaveError = String(error.message || 'sync save failed');
          persistenceState.writeFailures += 1;
          const retryDelay = isPersistencePermissionError(error)
            ? 30000
            : 1800 * Math.pow(2, Math.min(4, persistenceState.writeFailures - 1));
          writing = false;
          scheduleRetry(retryDelay);
          return;
        }

        persistenceState.lastSaveAt = Date.now();
        persistenceState.lastSaveErrorAt = 0;
        persistenceState.lastSaveError = '';
        persistenceState.writeFailures = 0;
        scheduleSnapshot('save');
        writeNext();
      });
    };

    writeNext();
  }

  function saveSoon() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      flush();
    }, 120);
  }

  function getPersistenceStatus() {
    return {
      loadedFrom: persistenceState.lastLoadedFrom || 'fallback',
      lastSaveAt: persistenceState.lastSaveAt || 0,
      lastSaveErrorAt: persistenceState.lastSaveErrorAt || 0,
      lastSaveError: persistenceState.lastSaveError || '',
      lastRetryAt: persistenceState.lastRetryAt || 0,
      lastSnapshotAt: persistenceState.lastSnapshotAt || 0,
      writeFailures: persistenceState.writeFailures || 0,
      dirty: !!dirty,
      writing: !!writing
    };
  }

  if (loaded.source === 'backup') saveSoon();

  return {
    get,
    set,
    saveSoon,
    flush,
    getPersistenceStatus
  };
}

module.exports = {
  createSyncStateService
};
