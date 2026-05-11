const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createSyncStateService } = require('./sync-state-service');
const { createStateWriteService } = require('./state-write-service');
const { createSyncPolicyService } = require('./sync-policy-service');
const stateNormalizer = require('./state-normalizer');

const TXT_READER_MULTI_USER_STATE_NAMESPACE_PASS = 'v389-txt-reader-multi-user-state-namespace-pass';
const TXT_READER_MULTI_USER_STATE_ADMIN_MANAGEMENT_PASS = 'v392-txt-reader-multi-user-state-admin-management-pass';
const TXT_READER_MULTI_USER_STATE_SNAPSHOT_MANAGEMENT_PASS = 'v401-txt-reader-multi-user-state-snapshot-management-pass';
const TXT_READER_MULTI_USER_STATE_SNAPSHOT_RETENTION_PASS = 'v404-user-state-snapshot-retention-pass';
const DEFAULT_MAX_SNAPSHOTS_PER_USER = 30;
const DEFAULT_MAX_SNAPSHOT_BYTES_PER_USER = 50 * 1024 * 1024;

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
  const cache = new Map();

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
      logger
    });
    const syncPolicyService = createSyncPolicyService({ normalizer: stateNormalizer });
    const stateWriteService = createStateWriteService({ syncStateService, normalizer: stateNormalizer, syncPolicyService });
    return { stateWriteService, syncStateService, owner: safeUserId(owner) };
  }

  function getBundleForOwner(owner) {
    const id = safeUserId(owner);
    if (cache.has(id)) return cache.get(id);
    const bundle = createServiceForOwner(id);
    cache.set(id, bundle);
    return bundle;
  }

  function getForSession(session) {
    return getBundleForOwner(getStateOwnerId(session)).stateWriteService;
  }

  function getForUserId(userId) {
    return getBundleForOwner(userId).stateWriteService;
  }

  function getNormalizedStateForUserId(userId) {
    const id = safeUserId(userId);
    const bundle = getBundleForOwner(id);
    const raw = stateNormalizer.normalizeUserState(bundle.syncStateService.get());
    bundle.syncStateService.set(raw);
    return { id, bundle, state: raw };
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

  function createSnapshotForUserId(userId, reason = 'manual', metadata = {}) {
    const { id, bundle, state } = getNormalizedStateForUserId(userId);
    const snapshotDir = getSnapshotDirForOwner(id);
    fs.mkdirSync(snapshotDir, { recursive: true });
    const createdAt = new Date().toISOString();
    const snapshotId = `admin-state-${createdAt.replace(/[:.]/g, '-')}-${safeSnapshotReason(reason)}-${crypto.randomBytes(4).toString('hex')}.json`;
    const filePath = path.join(snapshotDir, snapshotId);
    const payload = {
      version: 1,
      pass: TXT_READER_MULTI_USER_STATE_SNAPSHOT_MANAGEMENT_PASS,
      userId: id,
      reason: safeSnapshotReason(reason),
      createdAt,
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
      state
    };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    bundle.syncStateService.set(state);
    const retention = pruneSnapshotsForUserId(id);
    return { ok: true, pass: TXT_READER_MULTI_USER_STATE_SNAPSHOT_MANAGEMENT_PASS, retentionPass: TXT_READER_MULTI_USER_STATE_SNAPSHOT_RETENTION_PASS, userId: id, snapshot: summarizeSnapshotFile(id, filePath), retention };
  }

  function summarizeSnapshotFile(userId, filePath) {
    const stat = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    let reason = '';
    let createdAt = stat.mtime.toISOString();
    let hasState = false;
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      reason = String(raw.reason || '');
      createdAt = raw.createdAt || createdAt;
      hasState = !!raw.state || !!raw.shared || !!raw.deviceProfiles;
    } catch (err) {}
    return { id: fileName, userId: safeUserId(userId), createdAt, reason, sizeBytes: stat.size, hasState };
  }

  function isAutomaticSnapshotReason(reason) {
    return /^before_(reset|restore|delete_reset)$/.test(String(reason || ''));
  }

  function pruneSnapshotsForUserId(userId, options = {}) {
    const id = safeUserId(userId);
    const snapshotDir = getSnapshotDirForOwner(id);
    let snapshots = [];
    try {
      snapshots = fs.readdirSync(snapshotDir)
        .filter((name) => name.endsWith('.json'))
        .map((name) => summarizeSnapshotFile(id, path.join(snapshotDir, name)))
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    } catch (err) {
      return { ok: true, pass: TXT_READER_MULTI_USER_STATE_SNAPSHOT_RETENTION_PASS, userId: id, pruned: [], retainedCount: 0, totalBytes: 0, reason: 'snapshot_dir_unavailable' };
    }
    let totalBytes = snapshots.reduce((sum, item) => sum + Number(item.sizeBytes || 0), 0);
    const keepIds = new Set();
    const pruned = [];
    const sortedOldestFirst = snapshots.slice().reverse();

    snapshots.slice(0, maxSnapshotsPerUser).forEach((item) => keepIds.add(item.id));

    function tryDelete(item, cause) {
      if (!item || pruned.some((p) => p.id === item.id)) return false;
      if (keepIds.has(item.id) && snapshots.length - pruned.length <= maxSnapshotsPerUser && totalBytes <= maxSnapshotBytesPerUser) return false;
      try {
        fs.rmSync(path.join(snapshotDir, item.id), { force: true });
        pruned.push({ id: item.id, reason: item.reason, sizeBytes: item.sizeBytes, cause });
        totalBytes -= Number(item.sizeBytes || 0);
        return true;
      } catch (err) {
        if (logger && typeof logger.error === 'function') logger.error('snapshot prune failed:', err.message);
        return false;
      }
    }

    for (const item of sortedOldestFirst) {
      if (snapshots.length - pruned.length <= maxSnapshotsPerUser && totalBytes <= maxSnapshotBytesPerUser) break;
      if (isAutomaticSnapshotReason(item.reason)) tryDelete(item, 'automatic_retention');
    }
    for (const item of sortedOldestFirst) {
      if (snapshots.length - pruned.length <= maxSnapshotsPerUser && totalBytes <= maxSnapshotBytesPerUser) break;
      tryDelete(item, 'size_or_count_retention');
    }
    return { ok: true, pass: TXT_READER_MULTI_USER_STATE_SNAPSHOT_RETENTION_PASS, userId: id, pruned, retainedCount: Math.max(0, snapshots.length - pruned.length), totalBytes: Math.max(0, totalBytes), maxSnapshotsPerUser, maxSnapshotBytesPerUser };
  }

  function listSnapshotsForUserId(userId) {
    const id = safeUserId(userId);
    const snapshotDir = getSnapshotDirForOwner(id);
    let snapshots = [];
    try {
      snapshots = fs.readdirSync(snapshotDir)
        .filter((name) => name.endsWith('.json'))
        .map((name) => summarizeSnapshotFile(id, path.join(snapshotDir, name)))
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    } catch (err) {
      snapshots = [];
    }
    const totalBytes = snapshots.reduce((sum, item) => sum + Number(item.sizeBytes || 0), 0);
    return { ok: true, pass: TXT_READER_MULTI_USER_STATE_SNAPSHOT_MANAGEMENT_PASS, retentionPass: TXT_READER_MULTI_USER_STATE_SNAPSHOT_RETENTION_PASS, userId: id, snapshotDir, snapshots, retention:{ maxSnapshotsPerUser, maxSnapshotBytesPerUser, totalBytes, count:snapshots.length } };
  }

  function readSnapshotForUserId(userId, snapshotId) {
    const { id, filePath } = snapshotPathFromId(userId, snapshotId);
    if (!fs.existsSync(filePath)) {
      const err = new Error('snapshot not found');
      err.statusCode = 404;
      err.code = 'SNAPSHOT_NOT_FOUND';
      throw err;
    }
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const state = raw && raw.state ? raw.state : raw;
    return {
      ok: true,
      pass: TXT_READER_MULTI_USER_STATE_SNAPSHOT_MANAGEMENT_PASS,
      userId: id,
      snapshot: summarizeSnapshotFile(id, filePath),
      payload: raw,
      state: stateNormalizer.normalizeUserState(state)
    };
  }

  function restoreSnapshotForUserId(userId, snapshotId, options = {}) {
    const id = safeUserId(userId);
    const beforeSnapshot = options.skipBeforeSnapshot ? null : createSnapshotForUserId(id, 'before_restore', { restoringSnapshotId: snapshotId });
    const snapshot = readSnapshotForUserId(id, snapshotId);
    const bundle = getBundleForOwner(id);
    const next = stateNormalizer.normalizeUserState(snapshot.state);
    next.updatedAt = Date.now();
    bundle.syncStateService.set(next);
    bundle.syncStateService.flush();
    return {
      ok: true,
      pass: TXT_READER_MULTI_USER_STATE_SNAPSHOT_MANAGEMENT_PASS,
      userId: id,
      restoredSnapshot: snapshot.snapshot,
      beforeSnapshot: beforeSnapshot && beforeSnapshot.snapshot,
      restoredAt: new Date().toISOString(),
      state: next
    };
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

  function resetStateForUserId(userId, options = {}) {
    const id = safeUserId(userId);
    const beforeSnapshot = options.skipBeforeSnapshot ? null : createSnapshotForUserId(id, options.snapshotReason || 'before_reset', { operation: 'state_reset' });
    const bundle = getBundleForOwner(id);
    const empty = stateNormalizer.normalizeUserState(stateNormalizer.createEmptyUserState());
    empty.updatedAt = Date.now();
    bundle.syncStateService.set(empty);
    bundle.syncStateService.flush();
    return {
      ok: true,
      pass: TXT_READER_MULTI_USER_STATE_ADMIN_MANAGEMENT_PASS,
      snapshotPass: TXT_READER_MULTI_USER_STATE_SNAPSHOT_MANAGEMENT_PASS,
      userId: id,
      resetAt: new Date().toISOString(),
      beforeSnapshot: beforeSnapshot && beforeSnapshot.snapshot,
      state: empty
    };
  }

  return {
    getForSession,
    getForUserId,
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
    getStateOwnerId
  };
}

module.exports = {
  TXT_READER_MULTI_USER_STATE_NAMESPACE_PASS,
  TXT_READER_MULTI_USER_STATE_ADMIN_MANAGEMENT_PASS,
  TXT_READER_MULTI_USER_STATE_SNAPSHOT_MANAGEMENT_PASS,
  TXT_READER_MULTI_USER_STATE_SNAPSHOT_RETENTION_PASS,
  DEFAULT_MAX_SNAPSHOTS_PER_USER,
  DEFAULT_MAX_SNAPSHOT_BYTES_PER_USER,
  safeUserId,
  getStateOwnerId,
  createUserStateServiceManager
};
