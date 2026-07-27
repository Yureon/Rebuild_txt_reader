const fs = require('fs');
const path = require('path');
const { fsyncDirectoryAsync } = require('../repositories/json-file-store');

const FILEOPS_ASYNC_IO_PASS = 'v592-fileops-async-io-pass';
const FILEOPS_MUTATION_SERIALIZATION_PASS = 'v627-fileops-stable-path-lock-pass';
const FILEOPS_COMMIT_BOUNDARY_PASS = 'v625-fileops-commit-boundary-pass';
const FILEOPS_QUEUE_CONTROL_PASS = 'v661-fileops-queue-control-pass';
const FILEOPS_DURABLE_JOURNAL_PASS = 'v661-fileops-durable-journal-pass';
const FILEOPS_DIRECTORY_DURABILITY_PASS = 'v674-fileops-directory-durability-pass';

function createFileopsService({
  libraryService,
  logger = console,
  onMutation = null,
  mutationQueueMax = 64,
  mutationWaitTimeoutMs = 30000,
  mutationWatchdogMs = 120000,
  directoryFsync = fsyncDirectoryAsync
} = {}) {
  if (!libraryService) throw new Error('libraryService is required');

  const {
    getLibraryCached,
    getLibraryCachedAsync,
    getLibraryCachedForRequestAsync,
    invalidateLibraryCache,
    beginLibraryMutation,
    commitLibraryMutation,
    abortLibraryMutation,
    sanitizeNodeName,
    normalizeTxtBaseName,
    safeJoinUnderLibrary,
    categoryPathToRelDir,
    sendFsError,
    clearFileCachePath,
    clearAllFileCache,
    isSubPath,
    getNovelStorageInfo,
    getEpisodeStorageInfo,
    clearNovelCachesByInfo
  } = libraryService;

  const activeMutations = new Map();
  const mutationWaiters = [];
  const queueMax = Math.max(1, Math.min(4096, Number(mutationQueueMax) || 64));
  const waitTimeoutMs = Math.max(1000, Math.min(10 * 60 * 1000, Number(mutationWaitTimeoutMs) || 30000));
  const watchdogMs = Math.max(5000, Math.min(24 * 60 * 60 * 1000, Number(mutationWatchdogMs) || 120000));
  let rejectedQueueFull = 0;
  let rejectedWaitTimeout = 0;
  let rejectedAborted = 0;
  let watchdogWarnings = 0;
  let mutationSequence = 0;
  let pendingMutations = 0;
  let completedMutations = 0;
  let maxConcurrentMutations = 0;

  function notifyMutation(type, payload = {}) {
    if (typeof onMutation !== 'function') return;
    try {
      onMutation({ type, ...payload });
    } catch (error) {
      if (logger && typeof logger.warn === 'function') logger.warn('file mutation hook failed', error && error.message || error);
    }
  }

  function normalizeLockPaths(paths = []) {
    const root = getLibraryRootPath();
    const unique = new Set();
    for (const value of Array.isArray(paths) ? paths : [paths]) {
      if (!value) continue;
      const resolved = path.resolve(String(value));
      const relative = path.relative(root, resolved);
      if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('Invalid path');
      unique.add(resolved);
    }
    return [...unique].sort((a, b) => a.length - b.length || a.localeCompare(b));
  }

  function pathsConflict(left = [], right = []) {
    return left.some(a => right.some(b => a === b || a.startsWith(`${b}${path.sep}`) || b.startsWith(`${a}${path.sep}`)));
  }

  function createFileopsError(message, code, statusCode, retryAfterSeconds = 0, details = {}) {
    const error = Object.assign(new Error(message), { code, statusCode, status:statusCode, pass:FILEOPS_QUEUE_CONTROL_PASS }, details);
    if (retryAfterSeconds > 0) error.retryAfterSeconds = retryAfterSeconds;
    return error;
  }

  function removeWaiter(waiter) {
    const index = mutationWaiters.indexOf(waiter);
    if (index >= 0) mutationWaiters.splice(index, 1);
    if (waiter.timer) clearTimeout(waiter.timer);
    waiter.timer = null;
    if (waiter.signal && waiter.abortHandler) waiter.signal.removeEventListener('abort', waiter.abortHandler);
    waiter.abortHandler = null;
  }

  function pumpMutationWaiters() {
    for (let index = 0; index < mutationWaiters.length;) {
      const waiter = mutationWaiters[index];
      if (waiter.signal?.aborted) {
        removeWaiter(waiter);
        rejectedAborted += 1;
        waiter.reject(createFileopsError('file mutation request was cancelled', 'FILEOPS_REQUEST_ABORTED', 499));
        continue;
      }
      const blockedByActive = [...activeMutations.values()].some(active => pathsConflict(waiter.paths, active.paths));
      const blockedByEarlier = mutationWaiters.slice(0, index).some(earlier => pathsConflict(waiter.paths, earlier.paths));
      if (blockedByActive || blockedByEarlier) { index += 1; continue; }
      removeWaiter(waiter);
      const startedAt = Date.now();
      const active = { paths:waiter.paths, label:waiter.label, startedAt, watchdogExceeded:false, watchdogTimer:null };
      active.watchdogTimer = setTimeout(() => {
        active.watchdogExceeded = true;
        watchdogWarnings += 1;
        if (logger && typeof logger.warn === 'function') logger.warn('file mutation exceeded watchdog', { label:waiter.label, ageMs:Date.now() - startedAt, pass:FILEOPS_QUEUE_CONTROL_PASS });
      }, watchdogMs);
      active.watchdogTimer.unref?.();
      activeMutations.set(waiter.id, active);
      maxConcurrentMutations = Math.max(maxConcurrentMutations, activeMutations.size);
      waiter.resolve(() => {
        const current = activeMutations.get(waiter.id);
        if (current?.watchdogTimer) clearTimeout(current.watchdogTimer);
        activeMutations.delete(waiter.id);
        pumpMutationWaiters();
      });
    }
  }

  function acquireMutationPaths(paths, label = 'mutation', signal = null) {
    const normalized = normalizeLockPaths(paths);
    const id = ++mutationSequence;
    return new Promise((resolve, reject) => {
      if (!normalized.length) return reject(new Error('Mutation lock path is required'));
      if (signal?.aborted) {
        rejectedAborted += 1;
        return reject(createFileopsError('file mutation request was cancelled', 'FILEOPS_REQUEST_ABORTED', 499));
      }
      if (mutationWaiters.length >= queueMax) {
        rejectedQueueFull += 1;
        return reject(createFileopsError('file mutation queue is full', 'FILEOPS_MUTATION_QUEUE_FULL', 503, 3));
      }
      const waiter = { id, paths:normalized, label, resolve, reject, queuedAt:Date.now(), signal, timer:null, abortHandler:null };
      waiter.timer = setTimeout(() => {
        if (!mutationWaiters.includes(waiter)) return;
        removeWaiter(waiter);
        rejectedWaitTimeout += 1;
        reject(createFileopsError('file mutation lock wait timed out', 'FILEOPS_MUTATION_WAIT_TIMEOUT', 503, 3));
        pumpMutationWaiters();
      }, waitTimeoutMs);
      waiter.timer.unref?.();
      if (signal) {
        waiter.abortHandler = () => {
          if (!mutationWaiters.includes(waiter)) return;
          removeWaiter(waiter);
          rejectedAborted += 1;
          reject(createFileopsError('file mutation request was cancelled', 'FILEOPS_REQUEST_ABORTED', 499));
          pumpMutationWaiters();
        };
        signal.addEventListener('abort', waiter.abortHandler, { once:true });
      }
      mutationWaiters.push(waiter);
      pumpMutationWaiters();
    });
  }

  function sameLockPaths(left = [], right = []) {
    const a = normalizeLockPaths(left);
    const b = normalizeLockPaths(right);
    return a.length === b.length && a.every((value, index) => value === b[index]);
  }

  async function runMutation(resolvePaths, operation, label = 'mutation', options = {}) {
    const signal = options && options.signal || null;
    pendingMutations += 1;
    let release = null;
    try {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const plannedPaths = await resolvePaths();
        release = await acquireMutationPaths(plannedPaths, label, signal);
        let currentPaths;
        try {
          currentPaths = await resolvePaths();
        } catch (error) {
          release();
          release = null;
          throw error;
        }
        if (!sameLockPaths(plannedPaths, currentPaths)) {
          release();
          release = null;
          continue;
        }
        if (signal?.aborted) throw createFileopsError('file mutation request was cancelled', 'FILEOPS_REQUEST_ABORTED', 499);
        return await operation();
      }
      const error = new Error('Mutation path changed repeatedly while waiting for a lock');
      error.code = 'FILEOPS_PATH_UNSTABLE';
      error.statusCode = 409;
      throw error;
    } finally {
      if (release) release();
      pendingMutations = Math.max(0, pendingMutations - 1);
      completedMutations += 1;
    }
  }


  function durableJournalError(phase, token, cause = null) {
    const operationApplied = phase === 'commit';
    return createFileopsError(
      operationApplied
        ? 'file operation completed but the library journal could not be committed'
        : 'file operation failed and the library journal could not be rolled back',
      operationApplied ? 'LIBRARY_MUTATION_COMMIT_PERSIST_FAILED' : 'LIBRARY_MUTATION_ABORT_PERSIST_FAILED',
      503,
      5,
      { pass:FILEOPS_DURABLE_JOURNAL_PASS, recoveryRequired:true, operationApplied, fileOperationApplied:operationApplied, mutationId:String(token?.id || ''), cause }
    );
  }

  function directoryDurabilityError(token, cause, directoryCount) {
    return createFileopsError(
      'file operation completed but affected directory metadata could not be made durable',
      'LIBRARY_MUTATION_DIRECTORY_FSYNC_FAILED',
      503,
      5,
      {
        pass:FILEOPS_DIRECTORY_DURABILITY_PASS,
        recoveryRequired:true,
        operationApplied:true,
        fileOperationApplied:true,
        mutationId:String(token?.id || ''),
        affectedDirectoryCount:directoryCount,
        cause
      }
    );
  }

  async function fsyncAffectedDirectories(options = {}, token = null) {
    const directories = normalizeLockPaths(options.affectedDirectories || []);
    try {
      for (const directory of directories) await directoryFsync(directory);
    } catch (error) {
      throw directoryDurabilityError(token, error, directories.length);
    }
    return { pass:FILEOPS_DIRECTORY_DURABILITY_PASS, directoryCount:directories.length };
  }

  async function performDurableFsMutation(options, operation) {
    const mutationOptions = options || {};
    const journalOptions = { ...mutationOptions };
    delete journalOptions.affectedDirectories;
    if (typeof beginLibraryMutation !== 'function' || typeof commitLibraryMutation !== 'function') {
      await operation();
      await fsyncAffectedDirectories(mutationOptions);
      return invalidateLibraryCache(journalOptions);
    }
    const token = await Promise.resolve(beginLibraryMutation(journalOptions));
    try {
      await operation();
    } catch (error) {
      if (typeof abortLibraryMutation === 'function') {
        let aborted = false;
        try { aborted = await Promise.resolve(abortLibraryMutation(token)); } catch {}
        if (!aborted) throw durableJournalError('abort', token, error);
      }
      throw error;
    }
    // The pending tombstone is intentionally retained when a post-mutation
    // directory barrier fails. Committing it would report a non-durable
    // rename/removal as complete, while aborting it would hide applied I/O.
    await fsyncAffectedDirectories(mutationOptions, token);
    let committed;
    try { committed = await Promise.resolve(commitLibraryMutation(token)); }
    catch (error) { throw durableJournalError('commit', token, error); }
    if (!committed || committed.statePersisted === false) throw durableJournalError('commit', token);
    return committed;
  }

  async function readLibrary() {
    return typeof getLibraryCachedForRequestAsync === 'function'
      ? getLibraryCachedForRequestAsync()
      : typeof getLibraryCachedAsync === 'function'
        ? getLibraryCachedAsync()
        : getLibraryCached();
  }

  async function findNovel(novelId) {
    const library = await readLibrary();
    const novel = library.find(n => n.id === novelId);
    if (!novel) throw new Error('Novel not found');
    return novel;
  }

  async function lstatOrNull(targetPath) {
    try { return await fs.promises.lstat(targetPath); }
    catch (error) {
      if (error && error.code === 'ENOENT') return null;
      throw error;
    }
  }

  function getLibraryRootPath() {
    return path.resolve(libraryService.libraryPath || libraryService.LIBRARY_PATH || safeJoinUnderLibrary(''));
  }

  async function assertNoSymlinkSegments(targetPath, { allowMissingTail = false } = {}) {
    const configuredRoot = getLibraryRootPath();
    const target = path.resolve(targetPath);
    const relative = path.relative(configuredRoot, target);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('Invalid path');
    let root;
    try { root = await fs.promises.realpath(configuredRoot); }
    catch { throw new Error('Invalid library root'); }
    const rootStat = await lstatOrNull(root);
    if (!rootStat || !rootStat.isDirectory()) throw new Error('Invalid library root');
    let current = root;
    const parts = relative ? relative.split(path.sep).filter(Boolean) : [];
    for (let index = 0; index < parts.length; index += 1) {
      current = path.join(current, parts[index]);
      const stat = await lstatOrNull(current);
      if (!stat) {
        if (allowMissingTail) return true;
        throw new Error('Path not found');
      }
      if (stat.isSymbolicLink()) throw new Error('Invalid path');
      if (index < parts.length - 1 && !stat.isDirectory()) throw new Error('Invalid path');
    }
    return true;
  }

  async function ensureExists(targetPath) {
    await assertNoSymlinkSegments(targetPath);
    const stat = await lstatOrNull(targetPath);
    if (!stat) throw new Error('Path not found');
    if (stat.isSymbolicLink()) throw new Error('Invalid path');
    return stat;
  }

  async function ensureNotExists(targetPath) {
    await assertNoSymlinkSegments(path.dirname(targetPath));
    const stat = await lstatOrNull(targetPath);
    if (stat) throw new Error('Target already exists');
  }

  async function ensureDirExists(targetPath) {
    await assertNoSymlinkSegments(targetPath, { allowMissingTail:true });
    await fs.promises.mkdir(targetPath, { recursive: true });
    await assertNoSymlinkSegments(targetPath);
    const stat = await fs.promises.lstat(targetPath);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Invalid path');
  }

  async function assertStableParentDirectory(targetPath) {
    const configuredRoot = getLibraryRootPath();
    const rootReal = await fs.promises.realpath(configuredRoot);
    const parentPath = path.dirname(path.resolve(targetPath));
    await assertNoSymlinkSegments(parentPath);
    const parentReal = await fs.promises.realpath(parentPath);
    const relative = path.relative(rootReal, parentReal);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('Invalid path');
    const openFlags = fs.constants.O_RDONLY | (fs.constants.O_DIRECTORY || 0) | (fs.constants.O_NOFOLLOW || 0);
    let handle = null;
    try {
      handle = await fs.promises.open(parentPath, openFlags);
      const [fdStat, pathStat] = await Promise.all([handle.stat(), fs.promises.lstat(parentPath)]);
      if (!pathStat.isDirectory() || pathStat.isSymbolicLink()) throw new Error('Invalid path');
      if (Number(fdStat.dev) !== Number(pathStat.dev) || Number(fdStat.ino) !== Number(pathStat.ino)) throw new Error('Path changed during mutation');
      const currentReal = await fs.promises.realpath(parentPath);
      if (currentReal !== parentReal) throw new Error('Path changed during mutation');
      return { parentPath, parentReal, dev:Number(fdStat.dev), ino:Number(fdStat.ino) };
    } finally {
      try { await handle?.close(); } catch {}
    }
  }

  async function revalidateMutationCommit({ sources = [], destinations = [] } = {}) {
    for (const source of sources) {
      await assertNoSymlinkSegments(source);
      await assertStableParentDirectory(source);
      const stat = await fs.promises.lstat(source);
      if (stat.isSymbolicLink()) throw new Error('Invalid path');
    }
    for (const destination of destinations) {
      await assertNoSymlinkSegments(path.dirname(destination));
      await assertStableParentDirectory(destination);
      const stat = await lstatOrNull(destination);
      if (stat && stat.isSymbolicLink()) throw new Error('Invalid path');
    }
    return { pass:FILEOPS_COMMIT_BOUNDARY_PASS };
  }

  async function cleanupEmptyParents(startDir) {
    const root = path.resolve(libraryService.libraryPath || libraryService.LIBRARY_PATH || safeJoinUnderLibrary(''));
    let cur = path.resolve(startDir);
    while (cur.startsWith(root + path.sep) && cur !== root) {
      try {
        const entries = await fs.promises.readdir(cur);
        if (entries.length > 0) break;
        await fs.promises.rmdir(cur);
        cur = path.dirname(cur);
      } catch (_error) {
        break;
      }
    }
  }

  function renameFolder(input) {
    return runMutation(async () => {
      const { categoryPath, newName } = input || {};
      const safeName = sanitizeNodeName(newName);
      if (!categoryPath || !safeName) throw new Error('Invalid request');
      const oldAbsDir = safeJoinUnderLibrary(categoryPathToRelDir(categoryPath));
      return [oldAbsDir, path.join(path.dirname(oldAbsDir), safeName)];
    }, async () => {
      const { categoryPath, newName } = input || {};
      const safeName = sanitizeNodeName(newName);
      if (!categoryPath || !safeName) throw new Error('Invalid request');
      const oldRelDir = categoryPathToRelDir(categoryPath);
      const oldAbsDir = safeJoinUnderLibrary(oldRelDir);
      const newAbsDir = path.join(path.dirname(oldAbsDir), safeName);
      await ensureExists(oldAbsDir);
      await ensureNotExists(newAbsDir);
      await revalidateMutationCommit({ sources:[oldAbsDir], destinations:[newAbsDir] });
      await performDurableFsMutation({
        reason:'renameFolder',
        categoryPaths:[categoryPath],
        affectedDirectories:[path.dirname(oldAbsDir), path.dirname(newAbsDir)]
      }, () => fs.promises.rename(oldAbsDir, newAbsDir));
      clearAllFileCache();
      notifyMutation('renameFolder', { oldPath: categoryPath, newName: safeName });
      return { success: true, oldPath: categoryPath, newName: safeName, pass:FILEOPS_ASYNC_IO_PASS };
    }, 'renameFolder', { signal:input && input.signal });
  }

  function renameNovel(input) {
    return runMutation(async () => {
      const { novelId, title } = input || {};
      const novel = await findNovel(novelId);
      const info = getNovelStorageInfo(novel);
      const nextTitle = normalizeTxtBaseName(title);
      if (!nextTitle) throw new Error('Invalid title');
      const dest = info.type === 'folder' ? path.join(path.dirname(info.absPath), nextTitle) : path.join(path.dirname(info.absPath), nextTitle + '.txt');
      return [info.absPath, dest];
    }, async () => {
      const { novelId, title } = input || {};
      const novel = await findNovel(novelId);
      const info = getNovelStorageInfo(novel);
      const nextTitle = normalizeTxtBaseName(title);
      if (!nextTitle) throw new Error('Invalid title');
      const destAbsPath = info.type === 'folder'
        ? path.join(path.dirname(info.absPath), nextTitle)
        : path.join(path.dirname(info.absPath), nextTitle + '.txt');
      if (path.resolve(destAbsPath) === path.resolve(info.absPath)) {
        return { success: true, skipped: true, type: 'novel', novelId: novel.id, oldTitle: novel.title, newTitle: nextTitle, pass:FILEOPS_ASYNC_IO_PASS };
      }
      await ensureExists(info.absPath);
      await ensureNotExists(destAbsPath);
      clearNovelCachesByInfo(info);
      await revalidateMutationCommit({ sources:[info.absPath], destinations:[destAbsPath] });
      await performDurableFsMutation({
        reason:'renameNovel',
        novelIds:[novel.id],
        affectedDirectories:[path.dirname(info.absPath), path.dirname(destAbsPath)]
      }, () => fs.promises.rename(info.absPath, destAbsPath));
      clearAllFileCache();
      notifyMutation('renameNovel', { novelId: novel.id, oldTitle: novel.title, newTitle: nextTitle });
      return { success: true, type: 'novel', novelId: novel.id, oldTitle: novel.title, newTitle: nextTitle, pass:FILEOPS_ASYNC_IO_PASS };
    }, 'renameNovel', { signal:input && input.signal });
  }

  function deleteNovel(input) {
    return runMutation(async () => {
      const novel = await findNovel(input && input.novelId);
      return [getNovelStorageInfo(novel).absPath];
    }, async () => {
      const { novelId } = input || {};
      const novel = await findNovel(novelId);
      const info = getNovelStorageInfo(novel);
      const parentDir = path.dirname(info.absPath);
      await ensureExists(info.absPath);
      clearNovelCachesByInfo(info);
      await revalidateMutationCommit({ sources:[info.absPath] });
      await performDurableFsMutation({
        reason:'deleteNovel',
        novelIds:[novel.id],
        affectedDirectories:[parentDir]
      }, () => info.type === 'folder'
        ? fs.promises.rm(info.absPath, { recursive:true, force:false })
        : fs.promises.unlink(info.absPath));
      await cleanupEmptyParents(parentDir);
      clearAllFileCache();
      notifyMutation('deleteNovel', { novelId: novel.id, title: novel.title, path: info.absPath });
      return { success: true, type: 'novel', novelId: novel.id, deleted: novel.title, pass:FILEOPS_ASYNC_IO_PASS };
    }, 'deleteNovel', { signal:input && input.signal });
  }

  function moveNovel(input) {
    return runMutation(async () => {
      const { novelId, targetCategoryPath = '' } = input || {};
      const novel = await findNovel(novelId);
      const info = getNovelStorageInfo(novel);
      const targetAbsDir = safeJoinUnderLibrary(targetCategoryPath ? categoryPathToRelDir(targetCategoryPath) : '');
      return [info.absPath, targetAbsDir, path.join(targetAbsDir, info.name)];
    }, async () => {
      const { novelId, targetCategoryPath = '' } = input || {};
      const novel = await findNovel(novelId);
      const info = getNovelStorageInfo(novel);
      const targetRelDir = targetCategoryPath ? categoryPathToRelDir(targetCategoryPath) : '';
      const targetAbsDir = safeJoinUnderLibrary(targetRelDir);
      await ensureExists(info.absPath);
      await ensureDirExists(targetAbsDir);
      const destAbsPath = path.join(targetAbsDir, info.name);
      if (path.resolve(destAbsPath) === path.resolve(info.absPath)) return { success: true, skipped: true, pass:FILEOPS_ASYNC_IO_PASS };
      if (info.type === 'folder' && isSubPath(info.absPath, targetAbsDir)) throw new Error('Invalid path');
      await ensureNotExists(destAbsPath);
      clearNovelCachesByInfo(info);
      await revalidateMutationCommit({ sources:[info.absPath], destinations:[destAbsPath] });
      await performDurableFsMutation({
        reason:'moveNovel',
        novelIds:[novel.id],
        affectedDirectories:[path.dirname(info.absPath), path.dirname(destAbsPath)]
      }, () => fs.promises.rename(info.absPath, destAbsPath));
      clearAllFileCache();
      notifyMutation('moveNovel', { novelId: novel.id, movedTo: targetCategoryPath || '' });
      return { success: true, type: 'novel', novelId: novel.id, movedTo: targetCategoryPath || '', pass:FILEOPS_ASYNC_IO_PASS };
    }, 'moveNovel', { signal:input && input.signal });
  }

  function moveEpisode(input) {
    return runMutation(async () => {
      const { novelId, episodeId, targetCategoryPath = '' } = input || {};
      const novel = await findNovel(novelId);
      const info = getEpisodeStorageInfo(novel, episodeId);
      const targetAbsDir = safeJoinUnderLibrary(targetCategoryPath ? categoryPathToRelDir(targetCategoryPath) : '');
      return [info.absPath, targetAbsDir, path.join(targetAbsDir, info.name)];
    }, async () => {
      const { novelId, episodeId, targetCategoryPath = '' } = input || {};
      const novel = await findNovel(novelId);
      const info = getEpisodeStorageInfo(novel, episodeId);
      const targetRelDir = targetCategoryPath ? categoryPathToRelDir(targetCategoryPath) : '';
      const targetAbsDir = safeJoinUnderLibrary(targetRelDir);
      await ensureExists(info.absPath);
      await ensureDirExists(targetAbsDir);
      const destAbsPath = path.join(targetAbsDir, info.name);
      if (path.resolve(destAbsPath) === path.resolve(info.absPath)) return { success: true, skipped: true, pass:FILEOPS_ASYNC_IO_PASS };
      await ensureNotExists(destAbsPath);
      clearNovelCachesByInfo(info);
      await revalidateMutationCommit({ sources:[info.absPath], destinations:[destAbsPath] });
      await performDurableFsMutation({
        reason:'moveEpisode',
        novelIds:[novel.id],
        affectedDirectories:[path.dirname(info.absPath), path.dirname(destAbsPath)]
      }, () => fs.promises.rename(info.absPath, destAbsPath));
      await cleanupEmptyParents(path.dirname(info.absPath));
      clearAllFileCache();
      notifyMutation('moveEpisode', { novelId: novel.id, episodeId, movedTo: targetCategoryPath || '' });
      return { success: true, type: 'episode', novelId: novel.id, episodeId, movedTo: targetCategoryPath || '', pass:FILEOPS_ASYNC_IO_PASS };
    }, 'moveEpisode', { signal:input && input.signal });
  }

  function moveFolder(input) {
    return runMutation(async () => {
      const { categoryPath, targetCategoryPath = '' } = input || {};
      if (!categoryPath) throw new Error('Invalid request');
      const srcAbsDir = safeJoinUnderLibrary(categoryPathToRelDir(categoryPath));
      const targetAbsDir = safeJoinUnderLibrary(targetCategoryPath ? categoryPathToRelDir(targetCategoryPath) : '');
      return [srcAbsDir, targetAbsDir, path.join(targetAbsDir, path.basename(srcAbsDir))];
    }, async () => {
      const { categoryPath, targetCategoryPath = '' } = input || {};
      if (!categoryPath) throw new Error('Invalid request');
      const srcRelDir = categoryPathToRelDir(categoryPath);
      const srcAbsDir = safeJoinUnderLibrary(srcRelDir);
      const targetRelDir = targetCategoryPath ? categoryPathToRelDir(targetCategoryPath) : '';
      const targetAbsDir = safeJoinUnderLibrary(targetRelDir);
      await ensureExists(srcAbsDir);
      await ensureDirExists(targetAbsDir);
      if (isSubPath(srcAbsDir, targetAbsDir)) throw new Error('Invalid path');
      const destAbsDir = path.join(targetAbsDir, path.basename(srcAbsDir));
      if (path.resolve(destAbsDir) === path.resolve(srcAbsDir)) return { success: true, skipped: true, pass:FILEOPS_ASYNC_IO_PASS };
      await ensureNotExists(destAbsDir);
      await revalidateMutationCommit({ sources:[srcAbsDir], destinations:[destAbsDir] });
      // A full recursive scan here was redundant because every file cache is
      // cleared immediately after the mutation. Avoid walking large SMB trees.
      await performDurableFsMutation({
        reason:'moveFolder',
        categoryPaths:[categoryPath],
        affectedDirectories:[path.dirname(srcAbsDir), path.dirname(destAbsDir)]
      }, () => fs.promises.rename(srcAbsDir, destAbsDir));
      clearAllFileCache();
      notifyMutation('moveFolder', { movedFolder: categoryPath, movedTo: targetCategoryPath || '' });
      return { success: true, type: 'folder', movedFolder: categoryPath, movedTo: targetCategoryPath || '', pass:FILEOPS_ASYNC_IO_PASS };
    }, 'moveFolder', { signal:input && input.signal });
  }

  function renameEpisode(input) {
    return runMutation(async () => {
      const { novelId, episodeId, title } = input || {};
      const novel = await findNovel(novelId);
      const episode = (novel.episodes || []).find(item => item.id === episodeId);
      if (!episode) throw new Error('Path not found');
      const nextTitle = normalizeTxtBaseName(title);
      if (!nextTitle) throw new Error('Invalid title');
      const oldAbs = safeJoinUnderLibrary(episode.path);
      return [oldAbs, path.join(path.dirname(oldAbs), nextTitle + '.txt')];
    }, async () => {
      const { novelId, episodeId, title } = input || {};
      const novel = await findNovel(novelId);
      const episode = (novel.episodes || []).find(e => e.id === episodeId);
      if (!episode) throw new Error('Path not found');
      const nextTitle = normalizeTxtBaseName(title);
      if (!nextTitle) throw new Error('Invalid title');
      const oldAbs = safeJoinUnderLibrary(episode.path);
      const newAbs = path.join(path.dirname(oldAbs), nextTitle + '.txt');
      await ensureExists(oldAbs);
      await ensureNotExists(newAbs);
      await revalidateMutationCommit({ sources:[oldAbs], destinations:[newAbs] });
      await performDurableFsMutation({
        reason:'renameEpisode',
        novelIds:[novel.id],
        affectedDirectories:[path.dirname(oldAbs), path.dirname(newAbs)]
      }, () => fs.promises.rename(oldAbs, newAbs));
      clearFileCachePath(oldAbs);
      clearFileCachePath(newAbs);
      notifyMutation('renameEpisode', { novelId: novel.id, episodeId, oldPath: oldAbs, newPath: newAbs });
      return { success: true, type: 'episode', novelId: novel.id, episodeId, oldTitle: episode.title, newTitle: nextTitle, pass:FILEOPS_ASYNC_IO_PASS };
    }, 'renameEpisode', { signal:input && input.signal });
  }

  function deleteEpisode(input) {
    return runMutation(async () => {
      const { novelId, episodeId } = input || {};
      const novel = await findNovel(novelId);
      const episode = (novel.episodes || []).find(item => item.id === episodeId);
      if (!episode) throw new Error('Path not found');
      return [safeJoinUnderLibrary(episode.path)];
    }, async () => {
      const { novelId, episodeId } = input || {};
      const novel = await findNovel(novelId);
      const episode = (novel.episodes || []).find(e => e.id === episodeId);
      if (!episode) throw new Error('Path not found');
      const abs = safeJoinUnderLibrary(episode.path);
      const parentDir = path.dirname(abs);
      await ensureExists(abs);
      await revalidateMutationCommit({ sources:[abs] });
      await performDurableFsMutation({
        reason:'deleteEpisode',
        novelIds:[novel.id],
        affectedDirectories:[parentDir]
      }, () => fs.promises.unlink(abs));
      await cleanupEmptyParents(parentDir);
      clearFileCachePath(abs);
      notifyMutation('deleteEpisode', { novelId: novel.id, episodeId, path: abs });
      return { success: true, type: 'episode', novelId: novel.id, episodeId, deleted: episode.title, pass:FILEOPS_ASYNC_IO_PASS };
    }, 'deleteEpisode', { signal:input && input.signal });
  }

  function deleteFolder(input) {
    return runMutation(async () => {
      const { categoryPath } = input || {};
      if (!categoryPath) throw new Error('Invalid request');
      return [safeJoinUnderLibrary(categoryPathToRelDir(categoryPath))];
    }, async () => {
      const { categoryPath } = input || {};
      if (!categoryPath) throw new Error('Invalid request');
      const relDir = categoryPathToRelDir(categoryPath);
      const absDir = safeJoinUnderLibrary(relDir);
      const parentDir = path.dirname(absDir);
      await ensureExists(absDir);
      await revalidateMutationCommit({ sources:[absDir] });
      await performDurableFsMutation({
        reason:'deleteFolder',
        categoryPaths:[categoryPath],
        affectedDirectories:[parentDir]
      }, () => fs.promises.rm(absDir, { recursive:true, force:false }));
      await cleanupEmptyParents(parentDir);
      clearAllFileCache();
      notifyMutation('deleteFolder', { deleted: categoryPath });
      return { success: true, deleted: categoryPath, pass:FILEOPS_ASYNC_IO_PASS };
    }, 'deleteFolder', { signal:input && input.signal });
  }

  function getStatus() {
    return {
      asyncIoPass:FILEOPS_ASYNC_IO_PASS,
      serializationPass:FILEOPS_MUTATION_SERIALIZATION_PASS,
      commitBoundaryPass:FILEOPS_COMMIT_BOUNDARY_PASS,
      queueControlPass:FILEOPS_QUEUE_CONTROL_PASS,
      durableJournalPass:FILEOPS_DURABLE_JOURNAL_PASS,
      directoryDurabilityPass:FILEOPS_DIRECTORY_DURABILITY_PASS,
      queueMax,
      waitTimeoutMs,
      watchdogMs,
      rejectedQueueFull,
      rejectedWaitTimeout,
      rejectedAborted,
      watchdogWarnings,
      pendingMutations,
      completedMutations,
      activeMutations:activeMutations.size,
      waitingMutations:mutationWaiters.length,
      maxConcurrentMutations,
      active:[...activeMutations.values()].map(item => ({ label:item.label, paths:item.paths.map(value => path.relative(getLibraryRootPath(), value)), ageMs:Math.max(0, Date.now() - item.startedAt), watchdogExceeded:item.watchdogExceeded === true }))
    };
  }

  return {
    renameFolder,
    renameNovel,
    deleteNovel,
    moveNovel,
    moveEpisode,
    moveFolder,
    renameEpisode,
    deleteEpisode,
    deleteFolder,
    getStatus,
    sendFsError,
    asyncIoPass:FILEOPS_ASYNC_IO_PASS,
    serializationPass:FILEOPS_MUTATION_SERIALIZATION_PASS,
    commitBoundaryPass:FILEOPS_COMMIT_BOUNDARY_PASS,
    queueControlPass:FILEOPS_QUEUE_CONTROL_PASS,
    durableJournalPass:FILEOPS_DURABLE_JOURNAL_PASS,
    directoryDurabilityPass:FILEOPS_DIRECTORY_DURABILITY_PASS,
    assertNoSymlinkSegments,
    revalidateMutationCommit
  };
}

module.exports = {
  FILEOPS_ASYNC_IO_PASS,
  FILEOPS_MUTATION_SERIALIZATION_PASS,
  FILEOPS_COMMIT_BOUNDARY_PASS,
  FILEOPS_QUEUE_CONTROL_PASS,
  FILEOPS_DURABLE_JOURNAL_PASS,
  FILEOPS_DIRECTORY_DURABILITY_PASS,
  createFileopsService
};
