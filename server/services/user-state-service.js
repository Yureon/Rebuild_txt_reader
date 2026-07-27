const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createSyncStateService } = require('./sync-state-service');
const { createStateWriteService } = require('./state-write-service');
const { createSyncPolicyService } = require('./sync-policy-service');
const stateNormalizer = require('./state-normalizer');
const { atomicWriteJsonAsync } = require('../repositories/json-file-store');

const TXT_READER_MULTI_USER_STATE_NAMESPACE_PASS = 'v389-txt-reader-multi-user-state-namespace-pass';
const TXT_READER_MULTI_USER_STATE_ADMIN_MANAGEMENT_PASS = 'v392-txt-reader-multi-user-state-admin-management-pass';
const TXT_READER_MULTI_USER_STATE_SNAPSHOT_MANAGEMENT_PASS = 'v401-txt-reader-multi-user-state-snapshot-management-pass';
const TXT_READER_MULTI_USER_STATE_SNAPSHOT_RETENTION_PASS = 'v404-user-state-snapshot-retention-pass';
const DEFAULT_MAX_SNAPSHOTS_PER_USER = 30;
const DEFAULT_MAX_SNAPSHOT_BYTES_PER_USER = 50 * 1024 * 1024;
const DEFAULT_MAX_CACHED_USER_BUNDLES = 128;
const DEFAULT_USER_BUNDLE_IDLE_MS = 30 * 60 * 1000;

function safeUserId(v) {
  return String(v || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_') || 'anonymous';
}

function safeSnapshotReason(v) {
  return String(v || 'manual').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_').slice(0, 36) || 'manual';
}

function safeSnapshotId(v) {
  return String(v || '').trim().replace(/[^a-zA-Z0-9._-]/g, '');
}

function getStateOwnerId(session) {
  if (session && session.kind === 'user') return safeUserId(session.userId);
  if (session && session.kind === 'owner') return '__owner__';
  return 'anonymous';
}

function createUserStateServiceManager(options = {}) {
  const userDataDir = options.userDataDir;
  if (!userDataDir) throw new Error('createUserStateServiceManager requires userDataDir');
  const logger = options.logger || console;
  const maxSnapshotsPerUser = Math.max(1, Number(options.maxSnapshotsPerUser || DEFAULT_MAX_SNAPSHOTS_PER_USER));
  const maxSnapshotBytesPerUser = Math.max(1024 * 1024, Number(options.maxSnapshotBytesPerUser || DEFAULT_MAX_SNAPSHOT_BYTES_PER_USER));
  const maxCachedBundles = Math.max(8, Number(options.maxCachedBundles || DEFAULT_MAX_CACHED_USER_BUNDLES));
  const bundleIdleMs = Math.max(60_000, Number(options.bundleIdleMs || DEFAULT_USER_BUNDLE_IDLE_MS));
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const hardMaxCachedBundles = Math.max(maxCachedBundles + 1, maxCachedBundles * 2);
  const cache = new Map();
  const adminMutationQueues = new Map();

  function runSerializedAdminMutation(userId, task) {
    const id = safeUserId(userId);
    const previous = adminMutationQueues.get(id) || Promise.resolve();
    const run = previous.catch(() => {}).then(task);
    const tail = run.then(() => undefined, () => undefined).finally(() => {
      if (adminMutationQueues.get(id) === tail) adminMutationQueues.delete(id);
    });
    adminMutationQueues.set(id, tail);
    return run;
  }

  function getStatePathForOwner(owner) {
    return path.join(userDataDir, safeUserId(owner), 'state.json');
  }

  function getSnapshotDirForOwner(owner) {
    return path.join(userDataDir, safeUserId(owner), 'snapshots');
  }

  function getStatePathForSession(session) {
    return getStatePathForOwner(getStateOwnerId(session));
  }

  function getSnapshotDirForSession(session) {
    return getSnapshotDirForOwner(getStateOwnerId(session));
  }

  function createServiceForOwner(owner) {
    const syncStateService = createSyncStateService({
      syncPath: getStatePathForOwner(owner),
      snapshotDir: getSnapshotDirForOwner(owner),
      snapshotPrefix: 'user-state',
      createEmptyState: stateNormalizer.createEmptyUserState,
      normalizeState: stateNormalizer.normalizeUserState,
      applyProgressJournalEntry: stateNormalizer.applyProgressJournalEntry,
      logger,
      writeJson:options.writeJson
    });
    const syncPolicyService = createSyncPolicyService({ normalizer: stateNormalizer });
    const stateWriteService = createStateWriteService({ syncStateService, normalizer: stateNormalizer, syncPolicyService });
    return { stateWriteService, syncStateService, owner: safeUserId(owner), shelfStateCache:null, lastAccessAt:now() };
  }

  function isBundleEvictable(bundle) {
    if (!bundle || !bundle.syncStateService || typeof bundle.syncStateService.getPersistenceStatus !== 'function') return false;
    const status = bundle.syncStateService.getPersistenceStatus();
    return !status.dirty && !status.writing && !status.stopped
      && !status.timers?.save && !status.timers?.retry && !status.timers?.snapshot
      && Math.max(0, Number(status.pendingFlushWaiters) || 0) === 0;
  }

  function trimBundleCache(protectedId = '') {
    if (cache.size <= maxCachedBundles) return 0;
    const currentTime = now();
    let removed = 0;
    const candidates = Array.from(cache.entries())
      .filter(([id, bundle]) => id !== protectedId && id !== '__owner__' && isBundleEvictable(bundle))
      .sort((a, b) => Math.max(0, Number(a[1].lastAccessAt) || 0) - Math.max(0, Number(b[1].lastAccessAt) || 0));
    for (const [id, bundle] of candidates) {
      if (cache.size <= maxCachedBundles) break;
      const idleFor = currentTime - Math.max(0, Number(bundle.lastAccessAt) || 0);
      if (idleFor < bundleIdleMs) continue;
      cache.delete(id);
      removed += 1;
    }
    if (cache.size > hardMaxCachedBundles) {
      for (const [id] of candidates) {
        if (cache.size <= hardMaxCachedBundles) break;
        if (!cache.has(id)) continue;
        cache.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  function getBundleForOwner(owner) {
    const id = safeUserId(owner);
    if (cache.has(id)) {
      const bundle = cache.get(id);
      bundle.lastAccessAt = now();
      trimBundleCache(id);
      return bundle;
    }
    const bundle = createServiceForOwner(id);
    cache.set(id, bundle);
    trimBundleCache(id);
    return bundle;
  }

  function getForSession(session) {
    return getBundleForOwner(getStateOwnerId(session)).stateWriteService;
  }

  function getForUserId(userId) {
    return getBundleForOwner(userId).stateWriteService;
  }

  function readShelfStateForUserId(userId) {
    const id = safeUserId(userId);
    const bundle = getBundleForOwner(id);
    const rawState = bundle.syncStateService.get();
    const sharedVersion = Math.max(0, Number(stateNormalizer.getSharedSyncVersion(rawState)) || 0);
    const sharedUpdatedAt = Math.max(0, Number(stateNormalizer.getSharedSyncUpdatedAt(rawState)) || 0);
    const revision = `${sharedVersion}:${sharedUpdatedAt}`;
    if (bundle.shelfStateCache && bundle.shelfStateCache.revision === revision) return bundle.shelfStateCache.value;

    const state = stateNormalizer.normalizeUserState(rawState);
    const shared = state.shared || {};
    const novelUserTags = {};
    for (const [novelId, tags] of Object.entries(shared.novelUserTags && typeof shared.novelUserTags === 'object' && !Array.isArray(shared.novelUserTags) ? shared.novelUserTags : {})) {
      novelUserTags[novelId] = Object.freeze(Array.isArray(tags) ? tags.slice() : []);
    }
    const value = Object.freeze({
      id,
      sharedVersion,
      sharedUpdatedAt,
      favorites:Object.freeze(Array.isArray(shared.favorites) ? shared.favorites.slice() : []),
      recents:Object.freeze(Array.isArray(shared.recents) ? shared.recents.map(item => Object.freeze({ ...(item || {}) })) : []),
      userTags:Object.freeze(Array.isArray(shared.userTags) ? shared.userTags.slice() : []),
      novelUserTags:Object.freeze(novelUserTags)
    });
    bundle.shelfStateCache = { revision, value };
    return value;
  }

  function readNormalizedStateForUserId(userId) {
    const id = safeUserId(userId);
    const bundle = getBundleForOwner(id);
    const state = stateNormalizer.normalizeUserState(bundle.syncStateService.get());
    return { id, bundle, state };
  }

  function getNormalizedStateForUserId(userId) {
    const normalized = readNormalizedStateForUserId(userId);
    normalized.bundle.syncStateService.set(normalized.state);
    return normalized;
  }

  function snapshotPathFromId(userId, snapshotId) {
    const id = safeUserId(userId);
    const cleanId = safeSnapshotId(snapshotId);
    if (!cleanId || cleanId !== snapshotId || !cleanId.endsWith('.json')) {
      const err = new Error('invalid snapshot id');
      err.statusCode = 400;
      err.code = 'INVALID_SNAPSHOT_ID';
      throw err;
    }
    const snapshotDir = getSnapshotDirForOwner(id);
    const filePath = path.join(snapshotDir, cleanId);
    const rel = path.relative(snapshotDir, filePath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      const err = new Error('invalid snapshot path');
      err.statusCode = 400;
      err.code = 'INVALID_SNAPSHOT_ID';
      throw err;
    }
    return { id, snapshotDir, filePath, snapshotId: cleanId };
  }

  async function summarizeSnapshotFile(userId, filePath) {
    const stat = await fs.promises.stat(filePath);
    const fileName = path.basename(filePath);
    let reason = '';
    let createdAt = stat.mtime.toISOString();
    let hasState = false;
    try {
      const raw = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
      reason = String(raw.reason || '');
      createdAt = raw.createdAt || createdAt;
      hasState = !!raw.state || !!raw.shared || !!raw.deviceProfiles;
    } catch {}
    return { id: fileName, userId: safeUserId(userId), createdAt, reason, sizeBytes: stat.size, hasState };
  }

  function isAutomaticSnapshotReason(reason) {
    return /^before_(reset|restore|delete_reset)$/.test(String(reason || ''));
  }

  async function listSnapshotSummaries(userId) {
    const id = safeUserId(userId);
    const snapshotDir = getSnapshotDirForOwner(id);
    let names = [];
    try {
      names = (await fs.promises.readdir(snapshotDir)).filter((name) => name.endsWith('.json'));
    } catch (error) {
      if (error && error.code === 'ENOENT') return [];
      throw error;
    }
    const snapshots = [];
    for (const name of names) {
      try { snapshots.push(await summarizeSnapshotFile(id, path.join(snapshotDir, name))); }
      catch (error) { if (!error || error.code !== 'ENOENT') logger.error?.('snapshot summarize failed:', error.message); }
    }
    return snapshots.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }

  async function pruneSnapshotsForUserIdUnlocked(userId) {
    const id = safeUserId(userId);
    const snapshotDir = getSnapshotDirForOwner(id);
    let snapshots;
    try {
      snapshots = await listSnapshotSummaries(id);
    } catch (error) {
      return { ok:true, pass:TXT_READER_MULTI_USER_STATE_SNAPSHOT_RETENTION_PASS, userId:id, pruned:[], retainedCount:0, totalBytes:0, reason:'snapshot_dir_unavailable' };
    }
    let totalBytes = snapshots.reduce((sum, item) => sum + Number(item.sizeBytes || 0), 0);
    const keepIds = new Set();
    const pruned = [];
    const sortedOldestFirst = snapshots.slice().reverse();
    snapshots.slice(0, maxSnapshotsPerUser).forEach((item) => keepIds.add(item.id));

    async function tryDelete(item, cause) {
      if (!item || pruned.some((p) => p.id === item.id)) return false;
      if (keepIds.has(item.id) && snapshots.length - pruned.length <= maxSnapshotsPerUser && totalBytes <= maxSnapshotBytesPerUser) return false;
      try {
        await fs.promises.rm(path.join(snapshotDir, item.id), { force:true });
        pruned.push({ id:item.id, reason:item.reason, sizeBytes:item.sizeBytes, cause });
        totalBytes -= Number(item.sizeBytes || 0);
        return true;
      } catch (error) {
        logger.error?.('snapshot prune failed:', error.message);
        return false;
      }
    }

    for (const item of sortedOldestFirst) {
      if (snapshots.length - pruned.length <= maxSnapshotsPerUser && totalBytes <= maxSnapshotBytesPerUser) break;
      if (isAutomaticSnapshotReason(item.reason)) await tryDelete(item, 'automatic_retention');
    }
    for (const item of sortedOldestFirst) {
      if (snapshots.length - pruned.length <= maxSnapshotsPerUser && totalBytes <= maxSnapshotBytesPerUser) break;
      await tryDelete(item, 'size_or_count_retention');
    }
    return { ok:true, pass:TXT_READER_MULTI_USER_STATE_SNAPSHOT_RETENTION_PASS, userId:id, pruned, retainedCount:Math.max(0, snapshots.length-pruned.length), totalBytes:Math.max(0,totalBytes), maxSnapshotsPerUser, maxSnapshotBytesPerUser };
  }

  async function createSnapshotForUserIdUnlocked(userId, reason = 'manual', metadata = {}) {
    const { id, bundle, state } = getNormalizedStateForUserId(userId);
    const snapshotDir = getSnapshotDirForOwner(id);
    const createdAt = new Date().toISOString();
    const snapshotId = `admin-state-${createdAt.replace(/[:.]/g, '-')}-${safeSnapshotReason(reason)}-${crypto.randomBytes(4).toString('hex')}.json`;
    const filePath = path.join(snapshotDir, snapshotId);
    const payload = { version:1, pass:TXT_READER_MULTI_USER_STATE_SNAPSHOT_MANAGEMENT_PASS, userId:id, reason:safeSnapshotReason(reason), createdAt, metadata:metadata && typeof metadata === 'object' ? metadata : {}, state };
    await atomicWriteJsonAsync(filePath, payload);
    bundle.syncStateService.set(state);
    const retention = await pruneSnapshotsForUserIdUnlocked(id);
    return { ok:true, pass:TXT_READER_MULTI_USER_STATE_SNAPSHOT_MANAGEMENT_PASS, retentionPass:TXT_READER_MULTI_USER_STATE_SNAPSHOT_RETENTION_PASS, userId:id, snapshot:await summarizeSnapshotFile(id,filePath), retention };
  }

  async function listSnapshotsForUserId(userId) {
    const id = safeUserId(userId);
    const snapshotDir = getSnapshotDirForOwner(id);
    let snapshots = [];
    try { snapshots = await listSnapshotSummaries(id); } catch { snapshots = []; }
    const totalBytes = snapshots.reduce((sum,item) => sum + Number(item.sizeBytes || 0), 0);
    return { ok:true, pass:TXT_READER_MULTI_USER_STATE_SNAPSHOT_MANAGEMENT_PASS, retentionPass:TXT_READER_MULTI_USER_STATE_SNAPSHOT_RETENTION_PASS, userId:id, snapshotDir, snapshots, retention:{ maxSnapshotsPerUser, maxSnapshotBytesPerUser, totalBytes, count:snapshots.length } };
  }

  async function readSnapshotForUserId(userId, snapshotId) {
    const { id, filePath } = snapshotPathFromId(userId, snapshotId);
    let raw;
    try { raw = JSON.parse(await fs.promises.readFile(filePath, 'utf8')); }
    catch (error) {
      if (error && error.code === 'ENOENT') {
        const notFound = new Error('snapshot not found');
        notFound.statusCode = 404;
        notFound.code = 'SNAPSHOT_NOT_FOUND';
        throw notFound;
      }
      throw error;
    }
    const state = raw && raw.state ? raw.state : raw;
    return { ok:true, pass:TXT_READER_MULTI_USER_STATE_SNAPSHOT_MANAGEMENT_PASS, userId:id, snapshot:await summarizeSnapshotFile(id,filePath), payload:raw, state:stateNormalizer.normalizeUserState(state) };
  }

  async function commitStateDurably(bundle, next, previous) {
    bundle.shelfStateCache = null;
    bundle.syncStateService.set(next);
    try {
      await bundle.syncStateService.flushAndWait();
    } catch (error) {
      bundle.shelfStateCache = null;
      bundle.syncStateService.set(previous);
      try { await bundle.syncStateService.flushAndWait(); }
      catch (rollbackError) {
        error.rollbackError = rollbackError;
        logger.error?.('user state durable rollback failed:', rollbackError.message);
      }
      throw error;
    }
  }

  async function restoreSnapshotForUserIdUnlocked(userId, snapshotId, options = {}) {
    const id = safeUserId(userId);
    const beforeSnapshot = options.skipBeforeSnapshot ? null : await createSnapshotForUserIdUnlocked(id, 'before_restore', { restoringSnapshotId:snapshotId });
    const snapshot = await readSnapshotForUserId(id, snapshotId);
    const bundle = getBundleForOwner(id);
    const current = stateNormalizer.normalizeUserState(bundle.syncStateService.get());
    const next = stateNormalizer.normalizeUserState(snapshot.state);
    next.updatedAt = Date.now();
    stateNormalizer.markSharedSyncUpdatedAt(next, next.updatedAt);
    stateNormalizer.markSharedSyncVersion(next, Math.max(stateNormalizer.getSharedSyncVersion(current), stateNormalizer.getSharedSyncVersion(next)) + 1);
    await commitStateDurably(bundle, next, current);
    return { ok:true, pass:TXT_READER_MULTI_USER_STATE_SNAPSHOT_MANAGEMENT_PASS, userId:id, restoredSnapshot:snapshot.snapshot, beforeSnapshot:beforeSnapshot && beforeSnapshot.snapshot, restoredAt:new Date().toISOString(), state:next };
  }

  function exportStateForUserId(userId) {
    const { id, bundle, state } = getNormalizedStateForUserId(userId);
    bundle.syncStateService.set(state);
    return {
      ok: true,
      pass: TXT_READER_MULTI_USER_STATE_ADMIN_MANAGEMENT_PASS,
      userId: id,
      statePath: getStatePathForOwner(id),
      snapshotDir: getSnapshotDirForOwner(id),
      state,
      exportedAt: new Date().toISOString()
    };
  }

  async function resetStateForUserIdUnlocked(userId, options = {}) {
    const id = safeUserId(userId);
    const beforeSnapshot = options.skipBeforeSnapshot ? null : await createSnapshotForUserIdUnlocked(id, options.snapshotReason || 'before_reset', { operation:'state_reset' });
    const bundle = getBundleForOwner(id);
    const current = stateNormalizer.normalizeUserState(bundle.syncStateService.get());
    const empty = stateNormalizer.normalizeUserState(stateNormalizer.createEmptyUserState());
    empty.updatedAt = Date.now();
    stateNormalizer.markSharedSyncUpdatedAt(empty, empty.updatedAt);
    stateNormalizer.markSharedSyncVersion(empty, stateNormalizer.getSharedSyncVersion(current) + 1);
    await commitStateDurably(bundle, empty, current);
    return { ok:true, pass:TXT_READER_MULTI_USER_STATE_ADMIN_MANAGEMENT_PASS, snapshotPass:TXT_READER_MULTI_USER_STATE_SNAPSHOT_MANAGEMENT_PASS, userId:id, resetAt:new Date().toISOString(), beforeSnapshot:beforeSnapshot && beforeSnapshot.snapshot, state:empty };
  }

  function getCacheStatus() {
    return { size:cache.size, maxCachedBundles, hardMaxCachedBundles, bundleIdleMs, owners:Array.from(cache.keys()) };
  }

  function createSnapshotForUserId(userId, reason = 'manual', metadata = {}) {
    return runSerializedAdminMutation(userId, () => createSnapshotForUserIdUnlocked(userId, reason, metadata));
  }

  function restoreSnapshotForUserId(userId, snapshotId, options = {}) {
    return runSerializedAdminMutation(userId, () => restoreSnapshotForUserIdUnlocked(userId, snapshotId, options));
  }

  function resetStateForUserId(userId, options = {}) {
    return runSerializedAdminMutation(userId, () => resetStateForUserIdUnlocked(userId, options));
  }

  function pruneSnapshotsForUserId(userId, options = {}) {
    return runSerializedAdminMutation(userId, () => pruneSnapshotsForUserIdUnlocked(userId, options));
  }

  async function closeAll() {
    await Promise.all(Array.from(adminMutationQueues.values()));
    const bundles = Array.from(cache.values());
    const results = await Promise.all(bundles.map(async (bundle) => {
      try {
        const success = await bundle.syncStateService.close();
        return { owner: bundle.owner, success: !!success };
      } catch (error) {
        if (logger && typeof logger.error === 'function') logger.error(`user state close failed (${bundle.owner}):`, error.message);
        return { owner: bundle.owner, success: false, error: String(error.message || error) };
      }
    }));
    cache.clear();
    return results;
  }

  return {
    getForSession,
    getForUserId,
    readShelfStateForUserId,
    readNormalizedStateForUserId,
    getNormalizedStateForUserId,
    exportStateForUserId,
    resetStateForUserId,
    createSnapshotForUserId,
    listSnapshotsForUserId,
    readSnapshotForUserId,
    restoreSnapshotForUserId,
    pruneSnapshotsForUserId,
    getStatePathForSession,
    getSnapshotDirForSession,
    getStatePathForOwner,
    getSnapshotDirForOwner,
    getStateOwnerId,
    closeAll,
    getCacheStatus
  };
}

module.exports = {
  TXT_READER_MULTI_USER_STATE_NAMESPACE_PASS,
  TXT_READER_MULTI_USER_STATE_ADMIN_MANAGEMENT_PASS,
  TXT_READER_MULTI_USER_STATE_SNAPSHOT_MANAGEMENT_PASS,
  TXT_READER_MULTI_USER_STATE_SNAPSHOT_RETENTION_PASS,
  DEFAULT_MAX_SNAPSHOTS_PER_USER,
  DEFAULT_MAX_SNAPSHOT_BYTES_PER_USER,
  DEFAULT_MAX_CACHED_USER_BUNDLES,
  DEFAULT_USER_BUNDLE_IDLE_MS,
  safeUserId,
  getStateOwnerId,
  createUserStateServiceManager
};
