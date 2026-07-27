const fs = require('fs');
const path = require('path');
const { loadJsonWithBackup, atomicWriteJson, fsyncDirectoryAsync } = require('../repositories/json-file-store');

const SYNC_STATE_LIFECYCLE_PASS = 'v591-sync-state-lifecycle-pass';
const SYNC_STATE_DATA_PATH_PASS = 'v591-sync-state-data-path-pass';
const V676_PROGRESS_JOURNAL_PASS = 'v676-progress-journal-nofollow-pass';
const V675_PROGRESS_JOURNAL_PASS = V676_PROGRESS_JOURNAL_PASS;

function isPathInside(parentDir, candidatePath) {
  const parent = path.resolve(parentDir);
  const candidate = path.resolve(candidatePath);
  return candidate === parent || candidate.startsWith(parent + path.sep);
}

function loadLegacyJsonWithBackup(filePath, fallbackValue) {
  const fallback = typeof fallbackValue === 'undefined' ? null : fallbackValue;
  for (const targetPath of [filePath, `${filePath}.bak`]) {
    try {
      const stat = fs.lstatSync(targetPath);
      if (!stat.isFile() || stat.isSymbolicLink()) continue;
      return {
        ok: true,
        data: JSON.parse(fs.readFileSync(targetPath, 'utf8')),
        source: targetPath === filePath ? 'primary' : 'backup',
        path: targetPath
      };
    } catch {}
  }
  return { ok: false, data: fallback, source: 'fallback', path: '' };
}

function createSyncStateService(options = {}) {
  const {
    syncPath,
    legacySyncPath = '',
    snapshotDir,
    snapshotPrefix = 'sync-state',
    createEmptyState,
    normalizeState,
    applyProgressJournalEntry = null,
    progressJournalPath = `${syncPath}.progress.ndjson`,
    progressJournalCompactEntries = 128,
    progressJournalCompactBytes = 1024 * 1024,
    logger = console,
    writeJson = atomicWriteJson
  } = options;

  if (!syncPath) throw new Error('createSyncStateService requires syncPath');
  if (!snapshotDir) throw new Error('createSyncStateService requires snapshotDir');
  if (typeof createEmptyState !== 'function') throw new Error('createSyncStateService requires createEmptyState');
  if (typeof normalizeState !== 'function') throw new Error('createSyncStateService requires normalizeState');
  if (typeof writeJson !== 'function') throw new Error('createSyncStateService requires writeJson function');

  const progressJournalRoot = path.resolve(path.dirname(syncPath));

  function progressJournalBoundaryError(message, code = 'PROGRESS_JOURNAL_BOUNDARY') {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function readProgressJournalNoFollowSync() {
    const parent = path.dirname(progressJournalPath);
    const parentReal = fs.realpathSync(parent);
    const rootReal = fs.realpathSync(progressJournalRoot);
    if (!isPathInside(rootReal, parentReal)) throw progressJournalBoundaryError('progress journal parent is outside the user state directory');
    const linkStat = fs.lstatSync(progressJournalPath);
    if (!linkStat.isFile() || linkStat.isSymbolicLink()) throw progressJournalBoundaryError('progress journal is not a regular file', 'PROGRESS_JOURNAL_NOFOLLOW');
    const noFollow = Number(fs.constants.O_NOFOLLOW) || 0;
    const fd = fs.openSync(progressJournalPath, fs.constants.O_RDONLY | noFollow);
    try {
      const stat = fs.fstatSync(fd);
      if (!stat.isFile()) throw progressJournalBoundaryError('progress journal descriptor is not a regular file', 'PROGRESS_JOURNAL_NOFOLLOW');
      return fs.readFileSync(fd, 'utf8');
    } finally {
      fs.closeSync(fd);
    }
  }

  async function openProgressJournalNoFollow(mode) {
    const parent = path.dirname(progressJournalPath);
    await fs.promises.mkdir(parent, { recursive:true });
    const [parentReal, rootReal] = await Promise.all([fs.promises.realpath(parent), fs.promises.realpath(progressJournalRoot)]);
    if (!isPathInside(rootReal, parentReal)) throw progressJournalBoundaryError('progress journal parent is outside the user state directory');
    let existed = true;
    try {
      const linkStat = await fs.promises.lstat(progressJournalPath);
      if (!linkStat.isFile() || linkStat.isSymbolicLink()) throw progressJournalBoundaryError('progress journal is not a regular file', 'PROGRESS_JOURNAL_NOFOLLOW');
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      existed = false;
    }
    const noFollow = Number(fs.constants.O_NOFOLLOW) || 0;
    const base = fs.constants.O_WRONLY | fs.constants.O_CREAT | noFollow;
    const flags = mode === 'truncate' ? base | fs.constants.O_TRUNC : base | fs.constants.O_APPEND;
    const handle = await fs.promises.open(progressJournalPath, flags, 0o600);
    try {
      const stat = await handle.stat();
      if (!stat.isFile()) throw progressJournalBoundaryError('progress journal descriptor is not a regular file', 'PROGRESS_JOURNAL_NOFOLLOW');
      if (!existed) await fsyncDirectoryAsync(parent);
      return handle;
    } catch (error) {
      await handle.close().catch(() => {});
      throw error;
    }
  }

  const primaryLoaded = loadJsonWithBackup(syncPath, createEmptyState());
  let loaded = primaryLoaded;
  const canLoadLegacy = !primaryLoaded.ok
    && legacySyncPath
    && path.resolve(String(legacySyncPath)) !== path.resolve(String(syncPath));
  if (canLoadLegacy) {
    const legacyLoaded = loadLegacyJsonWithBackup(legacySyncPath, createEmptyState());
    if (legacyLoaded.ok) {
      loaded = {
        ...legacyLoaded,
        source: `legacy-${legacyLoaded.source}`,
        legacyPath: legacyLoaded.path
      };
    }
  }
  const loadedFromLegacy = String(loaded.source || '').startsWith('legacy-');
  let state = loaded.ok && loaded.data ? normalizeState(loaded.data) : createEmptyState();
  let progressJournalEntries = 0;
  let progressJournalBytes = 0;
  let progressJournalReplayApplied = 0;
  let progressJournalReplaySkipped = 0;
  let progressJournalReplayErrors = 0;

  function replayProgressJournal() {
    if (typeof applyProgressJournalEntry !== 'function') return;
    let text = '';
    try { text = readProgressJournalNoFollowSync(); }
    catch (error) { if (!error || error.code !== 'ENOENT') logger?.warn?.('Progress journal load failed:', error.message); return; }
    progressJournalBytes = Buffer.byteLength(text);
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      progressJournalEntries += 1;
      try {
        const result = applyProgressJournalEntry(state, JSON.parse(line));
        if (result && result.applied) progressJournalReplayApplied += 1;
        else progressJournalReplaySkipped += 1;
      } catch (error) {
        progressJournalReplayErrors += 1;
        logger?.warn?.('Progress journal entry ignored:', error.message);
      }
    }
  }
  replayProgressJournal();
  let saveTimer = null;
  let writing = false;
  let dirty = false;
  let retryTimer = null;
  let snapshotTimer = null;
  let stopped = false;
  let closePromise = null;
  let closeResolve = null;
  let closeRequestedPromise = null;
  let progressJournalTail = Promise.resolve();
  let progressJournalCompactTimer = null;
  let progressJournalCompactions = 0;
  let progressJournalAppendFailures = 0;
  const flushWaiters = [];

  const SNAPSHOT_KEEP = 8;
  const SNAPSHOT_MIN_INTERVAL_MS = 2 * 60 * 1000;
  const persistenceState = {
    lastLoadedFrom: loaded.source || 'fallback',
    lastSaveAt: 0,
    lastSaveErrorAt: 0,
    lastSaveError: '',
    lastRetryAt: 0,
    lastSnapshotAt: 0,
    lastSnapshotErrorAt: 0,
    lastSnapshotError: '',
    writeFailures: 0,
    snapshotWriteFailures: 0,
    closeSucceeded: null,
    loadedFromLegacy,
    legacyPath: loaded.legacyPath || '',
    migrationTarget: loadedFromLegacy ? syncPath : ''
  };

  function get() {
    return state;
  }

  function set(next) {
    state = normalizeState(next);
    return state;
  }

  function unrefTimer(timer) {
    if (timer && typeof timer.unref === 'function') timer.unref();
    return timer;
  }

  async function trimSnapshots() {
    try {
      const files = (await fs.promises.readdir(snapshotDir))
        .filter((name) => name.startsWith(snapshotPrefix + '-') && name.endsWith('.json'))
        .sort();
      while (files.length > SNAPSHOT_KEEP) {
        const oldest = files.shift();
        if (!oldest) break;
        try { await fs.promises.unlink(path.join(snapshotDir, oldest)); } catch {}
      }
    } catch {}
  }

  function scheduleSnapshot(reason) {
    if (stopped) return;
    if (snapshotTimer) clearTimeout(snapshotTimer);
    snapshotTimer = unrefTimer(setTimeout(() => {
      snapshotTimer = null;
      if (stopped) return;
      if ((persistenceState.lastSnapshotAt || 0) && Date.now() - persistenceState.lastSnapshotAt < SNAPSHOT_MIN_INTERVAL_MS) {
        return;
      }
      const suffix = String(reason || 'save').slice(0, 24);
      const fileName = `${snapshotPrefix}-${new Date().toISOString().replace(/[:.]/g, '-')}-${suffix}.json`;
      const snapshotPath = path.join(snapshotDir, fileName);
      writeJson(snapshotPath, state, (error) => {
        if (error) {
          persistenceState.lastSnapshotErrorAt = Date.now();
          persistenceState.lastSnapshotError = String(error.message || 'snapshot save failed');
          persistenceState.snapshotWriteFailures += 1;
          if (logger && typeof logger.error === 'function') logger.error('Sync snapshot save error:', persistenceState.lastSnapshotError);
          return;
        }
        persistenceState.lastSnapshotAt = Date.now();
        persistenceState.lastSnapshotErrorAt = 0;
        persistenceState.lastSnapshotError = '';
        persistenceState.snapshotWriteFailures = 0;
        trimSnapshots().catch(() => {});
      });
    }, 1200));
  }

  function scheduleRetry(delayMs) {
    if (stopped) return;
    const waitMs = Math.min(30000, Math.max(1500, Number(delayMs) || 2500));
    if (retryTimer) clearTimeout(retryTimer);
    persistenceState.lastRetryAt = Date.now() + waitMs;
    retryTimer = unrefTimer(setTimeout(() => {
      retryTimer = null;
      if (!stopped) flush();
    }, waitMs));
  }

  function isPersistencePermissionError(error) {
    return error && ['EACCES', 'EPERM', 'EROFS'].includes(error.code);
  }

  function settleClose(success) {
    if (!closeResolve || writing || dirty) return;
    persistenceState.closeSucceeded = !!success;
    const resolve = closeResolve;
    closeResolve = null;
    resolve(!!success);
  }

  function settleFlushWaiters(error = null) {
    if (!flushWaiters.length) return;
    const waiters = flushWaiters.splice(0, flushWaiters.length);
    waiters.forEach(({ resolve, reject }) => error ? reject(error) : resolve(true));
  }

  function flush() {
    if (stopped && !closePromise) return false;
    dirty = true;
    if (writing || retryTimer) return true;
    writing = true;

    const writeNext = () => {
      if (!dirty) {
        writing = false;
        settleFlushWaiters();
        settleClose(true);
        return;
      }

      dirty = false;
      writeJson(syncPath, state, (error) => {
        if (error) {
          logger.error('Sync save error (will keep in memory instead):', error.message);
          persistenceState.lastSaveErrorAt = Date.now();
          persistenceState.lastSaveError = String(error.message || 'sync save failed');
          persistenceState.writeFailures += 1;
          settleFlushWaiters(error);

          if (stopped) {
            // close() marks dirty while an older write is in flight. Give that final
            // state one explicit write attempt, but never keep a retry timer alive.
            if (dirty) return writeNext();
            writing = false;
            settleClose(false);
            return;
          }

          dirty = true;
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
        if (!stopped) scheduleSnapshot('save');
        writeNext();
      });
    };

    writeNext();
    return true;
  }


  async function appendJournalLine(entry) {
    const line = `${JSON.stringify(entry)}\n`;
    const handle = await openProgressJournalNoFollow('append');
    try {
      await handle.writeFile(line, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    progressJournalEntries += 1;
    progressJournalBytes += Buffer.byteLength(line);
  }

  async function truncateProgressJournal() {
    const handle = await openProgressJournalNoFollow('truncate');
    try { await handle.sync(); } finally { await handle.close(); }
    progressJournalEntries = 0;
    progressJournalBytes = 0;
    progressJournalCompactions += 1;
  }

  function scheduleProgressJournalCompaction() {
    if (stopped || progressJournalCompactTimer || !progressJournalEntries) return;
    progressJournalCompactTimer = unrefTimer(setTimeout(() => {
      progressJournalCompactTimer = null;
      compactProgressJournal().catch(error => logger?.error?.('Progress journal compaction failed:', error.message));
    }, 800));
  }

  function compactProgressJournal(force = false) {
    const operation = progressJournalTail.catch(() => {}).then(async () => {
      if (!progressJournalEntries) return { compacted:false, pass:V675_PROGRESS_JOURNAL_PASS };
      if (!force && progressJournalEntries < Math.max(8, Number(progressJournalCompactEntries) || 128)
        && progressJournalBytes < Math.max(65536, Number(progressJournalCompactBytes) || (1024 * 1024))) {
        return { compacted:false, pass:V675_PROGRESS_JOURNAL_PASS };
      }
      await flushAndWait();
      await truncateProgressJournal();
      return { compacted:true, pass:V675_PROGRESS_JOURNAL_PASS };
    });
    progressJournalTail = operation.catch(() => {});
    return operation;
  }

  function appendProgressJournal(entry, applyMutation) {
    if (stopped) return Promise.reject(Object.assign(new Error('sync state service is stopped'), { code:'SYNC_STATE_STOPPED' }));
    if (!entry || typeof entry !== 'object' || typeof applyMutation !== 'function') {
      return Promise.reject(Object.assign(new Error('invalid progress journal mutation'), { code:'PROGRESS_JOURNAL_INVALID' }));
    }
    const operation = progressJournalTail.catch(() => {}).then(async () => {
      try {
        await appendJournalLine(entry);
      } catch (error) {
        progressJournalAppendFailures += 1;
        throw error;
      }
      const result = applyMutation();
      if (progressJournalEntries >= Math.max(8, Number(progressJournalCompactEntries) || 128)
        || progressJournalBytes >= Math.max(65536, Number(progressJournalCompactBytes) || (1024 * 1024))) {
        scheduleProgressJournalCompaction();
      }
      return { result, persisted:true, persistence:'progress-journal', pass:V675_PROGRESS_JOURNAL_PASS };
    });
    progressJournalTail = operation.catch(() => {});
    return operation;
  }


  function flushAndWait() {
    if (stopped) return Promise.reject(Object.assign(new Error('sync state service is stopped'), { code:'SYNC_STATE_STOPPED' }));
    if (saveTimer) clearTimeout(saveTimer);
    if (retryTimer) clearTimeout(retryTimer);
    saveTimer = null;
    retryTimer = null;
    persistenceState.lastRetryAt = 0;
    return new Promise((resolve, reject) => {
      flushWaiters.push({ resolve, reject });
      dirty = true;
      flush();
    });
  }

  function saveSoon() {
    if (stopped) return false;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = unrefTimer(setTimeout(() => {
      saveTimer = null;
      if (!stopped) flush();
    }, 120));
    return true;
  }

  function closeBase() {
    if (closePromise) return closePromise;
    stopped = true;
    if (saveTimer) clearTimeout(saveTimer);
    if (retryTimer) clearTimeout(retryTimer);
    if (snapshotTimer) clearTimeout(snapshotTimer);
    saveTimer = null;
    retryTimer = null;
    snapshotTimer = null;
    persistenceState.lastRetryAt = 0;

    closePromise = new Promise((resolve) => {
      closeResolve = resolve;
    });
    dirty = true;
    if (!writing) flush();
    return closePromise;
  }


  function close() {
    if (closeRequestedPromise) return closeRequestedPromise;
    if (progressJournalCompactTimer) clearTimeout(progressJournalCompactTimer);
    progressJournalCompactTimer = null;
    closeRequestedPromise = compactProgressJournal(true)
      .catch(error => { logger?.error?.('Final progress journal compaction failed:', error.message); return false; })
      .then(() => closeBase());
    return closeRequestedPromise;
  }

  function stop() {
    return close();
  }

  function getPersistenceStatus() {
    return {
      pass: SYNC_STATE_LIFECYCLE_PASS,
      dataPathPass: SYNC_STATE_DATA_PATH_PASS,
      loadedFrom: persistenceState.lastLoadedFrom || 'fallback',
      lastSaveAt: persistenceState.lastSaveAt || 0,
      lastSaveErrorAt: persistenceState.lastSaveErrorAt || 0,
      lastSaveError: persistenceState.lastSaveError || '',
      lastRetryAt: persistenceState.lastRetryAt || 0,
      lastSnapshotAt: persistenceState.lastSnapshotAt || 0,
      lastSnapshotErrorAt: persistenceState.lastSnapshotErrorAt || 0,
      lastSnapshotError: persistenceState.lastSnapshotError || '',
      writeFailures: persistenceState.writeFailures || 0,
      snapshotWriteFailures: persistenceState.snapshotWriteFailures || 0,
      closeSucceeded: persistenceState.closeSucceeded,
      loadedFromLegacy: !!persistenceState.loadedFromLegacy,
      legacyPath: persistenceState.legacyPath || '',
      migrationTarget: persistenceState.migrationTarget || '',
      dirty: !!dirty,
      writing: !!writing,
      stopped: !!stopped,
      pendingFlushWaiters: flushWaiters.length,
      progressJournal: {
        pass:V675_PROGRESS_JOURNAL_PASS,
        path:progressJournalPath,
        entries:progressJournalEntries,
        bytes:progressJournalBytes,
        replayApplied:progressJournalReplayApplied,
        replaySkipped:progressJournalReplaySkipped,
        replayErrors:progressJournalReplayErrors,
        compactions:progressJournalCompactions,
        appendFailures:progressJournalAppendFailures,
        compactScheduled:!!progressJournalCompactTimer
      },
      timers: {
        save: !!saveTimer,
        retry: !!retryTimer,
        snapshot: !!snapshotTimer,
        progressJournalCompact: !!progressJournalCompactTimer
      },
      timerRefs: {
        save: saveTimer && typeof saveTimer.hasRef === 'function' ? saveTimer.hasRef() : null,
        retry: retryTimer && typeof retryTimer.hasRef === 'function' ? retryTimer.hasRef() : null,
        snapshot: snapshotTimer && typeof snapshotTimer.hasRef === 'function' ? snapshotTimer.hasRef() : null,
        progressJournalCompact: progressJournalCompactTimer && typeof progressJournalCompactTimer.hasRef === 'function' ? progressJournalCompactTimer.hasRef() : null
      }
    };
  }

  if (loaded.source === 'backup' || loadedFromLegacy) saveSoon();
  if (progressJournalEntries) {
    progressJournalCompactTimer = unrefTimer(setTimeout(() => {
      progressJournalCompactTimer = null;
      compactProgressJournal(true).catch(error => logger?.error?.('Replayed progress journal compaction failed:', error.message));
    }, 800));
  }

  return {
    get,
    set,
    saveSoon,
    flush,
    flushAndWait,
    appendProgressJournal,
    compactProgressJournal,
    close,
    stop,
    getPersistenceStatus,
    pass: SYNC_STATE_LIFECYCLE_PASS,
    dataPathPass: SYNC_STATE_DATA_PATH_PASS
  };
}

module.exports = {
  SYNC_STATE_LIFECYCLE_PASS,
  SYNC_STATE_DATA_PATH_PASS,
  V675_PROGRESS_JOURNAL_PASS,
  createSyncStateService
};
