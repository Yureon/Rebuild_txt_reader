const { pickAllowedObject } = require('../utils/object');
const stateNormalizer = require('./state-normalizer');
const { createSyncPolicyService } = require('./sync-policy-service');

function createHttpError(statusCode, message) {
  const err = new Error(message || 'state write failed');
  err.statusCode = statusCode;
  return err;
}

function parseSyncVersion(value) {
  if (value == null || value === '') return 0;
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 0 || version >= Number.MAX_SAFE_INTEGER) {
    throw createHttpError(400, 'syncVersion invalid');
  }
  return version;
}

function parseClientTimestamp(value) {
  if (value == null || value === '') return 0;
  const timestamp = Number(value);
  if (!Number.isSafeInteger(timestamp) || timestamp < 0 || timestamp > Date.now() + 86400000) {
    throw createHttpError(400, 'updatedAt invalid');
  }
  return timestamp;
}

function createStateWriteService(options = {}) {
  const {
    syncStateService,
    normalizer = stateNormalizer,
    syncPolicyService = createSyncPolicyService({ normalizer })
  } = options;

  if (!syncStateService || typeof syncStateService.get !== 'function' || typeof syncStateService.set !== 'function' || typeof syncStateService.saveSoon !== 'function') {
    throw new Error('createStateWriteService requires syncStateService with get/set/saveSoon methods');
  }

  const {
    createEmptyUserState,
    createEmptyDeviceProfile,
    normalizeUserState,
    normalizeProgressStateInput,
    normalizeProgressSnapshotInput,
    mergeProgressSnapshotDelta,
    mergeProgressSnapshotDeltaIncremental,
    ensurePlainObject,
    getRequestedDeviceId,
    getSharedSyncUpdatedAt,
    getSharedSyncVersion,
    getDeviceSyncUpdatedAt,
    getDeviceSyncVersion,
    getDeviceProfileForResponse,
    validateSharedState,
    validateDeviceState,
    mergeSharedState,
    mergeDeviceState,
    normalizeDeviceProfile,
    markSharedSyncUpdatedAt,
    markSharedSyncVersion,
    markDeviceSyncUpdatedAt,
    markDeviceSyncVersion,
    reconcileDeviceCollections
  } = normalizer;

  const required = {
    createEmptyUserState,
    createEmptyDeviceProfile,
    normalizeUserState,
    normalizeProgressStateInput,
    normalizeProgressSnapshotInput,
    mergeProgressSnapshotDelta,
    mergeProgressSnapshotDeltaIncremental,
    ensurePlainObject,
    getRequestedDeviceId,
    getSharedSyncUpdatedAt,
    getSharedSyncVersion,
    getDeviceSyncUpdatedAt,
    getDeviceSyncVersion,
    getDeviceProfileForResponse,
    validateSharedState,
    validateDeviceState,
    mergeSharedState,
    mergeDeviceState,
    normalizeDeviceProfile,
    markSharedSyncUpdatedAt,
    markSharedSyncVersion,
    markDeviceSyncUpdatedAt,
    markDeviceSyncVersion,
    reconcileDeviceCollections,
    syncPolicyService
  };
  Object.keys(required).forEach((key) => {
    if (!required[key]) throw new Error(`createStateWriteService missing normalizer dependency: ${key}`);
  });
  ['buildSyncPolicySummary', 'evaluateSharedWrite', 'evaluateDeviceWrite', 'registerDeviceSeen'].forEach((key) => {
    if (typeof syncPolicyService[key] !== 'function') throw new Error(`createStateWriteService missing syncPolicyService method: ${key}`);
  });

  let durableMutationChain = Promise.resolve();

  function getSyncData() {
    return syncStateService.get();
  }

  function setSyncData(next) {
    return syncStateService.set(next);
  }

  function saveSyncData() {
    return syncStateService.saveSoon();
  }

  function getUserStateResponse(req) {
    const raw = getSyncData();
    const hintedDeviceId = typeof syncPolicyService.safeDeviceId === 'function'
      ? syncPolicyService.safeDeviceId(req.get('x-device-id'))
      : '';
    const normalized = normalizeUserState(raw, { currentDeviceId:hintedDeviceId });
    const requestedDeviceId = getRequestedDeviceId(req, normalized);
    setSyncData(normalized);

    return {
      version: normalized.version || 1,
      updatedAt: normalized.updatedAt || Date.now(),
      sharedUpdatedAt: getSharedSyncUpdatedAt(normalized),
      sharedVersion: getSharedSyncVersion(normalized),
      deviceUpdatedAt: getDeviceSyncUpdatedAt(normalized, requestedDeviceId),
      deviceVersion: getDeviceSyncVersion(normalized, requestedDeviceId),
      shared: normalized.shared || createEmptyUserState().shared,
      device: getDeviceProfileForResponse(normalized, requestedDeviceId),
      deviceProfiles: normalized.deviceProfiles || {},
      currentDeviceId: requestedDeviceId,
      syncPolicySummary: syncPolicyService.buildSyncPolicySummary(normalized, requestedDeviceId)
    };
  }

  function saveSharedState(nextShared) {
    const check = validateSharedState(nextShared);
    if (!check.ok) {
      throw createHttpError(400, check.error);
    }

    const state = normalizeUserState(getSyncData());
    const incomingUpdatedAt = parseClientTimestamp(nextShared && nextShared.updatedAt);
    const incomingBaseVersion = parseSyncVersion(nextShared && nextShared.syncVersion);
    const proposedVersion = incomingBaseVersion ? incomingBaseVersion + 1 : 0;
    const sharedDecision = syncPolicyService.evaluateSharedWrite(state, { incomingUpdatedAt, incomingVersion: proposedVersion });
    const currentUpdatedAt = sharedDecision.currentUpdatedAt;
    if (sharedDecision.stale) {
      setSyncData(state);
      return {
        success: true,
        skipped: true,
        reason: sharedDecision.reason,
        updatedAt: state.updatedAt,
        sharedUpdatedAt: currentUpdatedAt,
        sharedVersion: sharedDecision.currentVersion,
        shared: state.shared,
        syncPolicySummary: syncPolicyService.buildSyncPolicySummary(state, null)
      };
    }

    state.shared = mergeSharedState(state.shared, nextShared);
    state.version = 1;
    state.updatedAt = Date.now();
    markSharedSyncUpdatedAt(state, Math.max(state.updatedAt, incomingUpdatedAt || 0));
    markSharedSyncVersion(state, proposedVersion || (sharedDecision.currentVersion + 1));
    setSyncData(state);
    saveSyncData();

    return {
      success: true,
      updatedAt: state.updatedAt,
      sharedUpdatedAt: getSharedSyncUpdatedAt(state),
      sharedVersion: getSharedSyncVersion(state),
      shared: state.shared,
      syncPolicySummary: syncPolicyService.buildSyncPolicySummary(state, null)
    };
  }

  function saveProgressState(body) {
    const nextProgress = pickAllowedObject(body, ['progress', 'updatedAt', 'syncVersion']);
    if (!ensurePlainObject(nextProgress.progress)) {
      throw createHttpError(400, 'progress invalid');
    }

    const state = normalizeUserState(getSyncData());
    const incomingUpdatedAt = parseClientTimestamp(nextProgress.updatedAt);
    const incomingVersion = parseSyncVersion(nextProgress.syncVersion);
    const sharedDecision = syncPolicyService.evaluateSharedWrite(state, { incomingUpdatedAt, incomingVersion });
    const currentUpdatedAt = sharedDecision.currentUpdatedAt;
    const currentVersion = sharedDecision.currentVersion;

    if (sharedDecision.stale) {
      setSyncData(state);
      return {
        success: true,
        skipped: true,
        reason: sharedDecision.reason,
        updatedAt: state.updatedAt,
        sharedUpdatedAt: currentUpdatedAt,
        sharedVersion: currentVersion,
        shared: state.shared,
        syncPolicySummary: syncPolicyService.buildSyncPolicySummary(state, null)
      };
    }

    state.shared.progress = normalizeProgressStateInput(nextProgress.progress);
    state.version = 1;
    state.updatedAt = Date.now();
    const savedAt = markSharedSyncUpdatedAt(state, Math.max(state.updatedAt, incomingUpdatedAt || 0));
    const savedVersion = markSharedSyncVersion(state, incomingVersion || (currentVersion + 1));
    setSyncData(state);
    saveSyncData();

    return {
      success: true,
      updatedAt: state.updatedAt,
      sharedUpdatedAt: savedAt,
      sharedVersion: savedVersion,
      shared: state.shared,
      syncPolicySummary: syncPolicyService.buildSyncPolicySummary(state, nextProgress.progress && nextProgress.progress.lastRead && nextProgress.progress.lastRead.sourceDeviceId)
    };
  }

  function saveProgressDelta(body, routeNovelId) {
    const nextProgress = pickAllowedObject(body, ['snapshot', 'updatedAt', 'syncVersion', '_accessDenied']);
    if (nextProgress._accessDenied) throw createHttpError(403, 'library access denied');
    if (!ensurePlainObject(nextProgress.snapshot)) throw createHttpError(400, 'progress snapshot invalid');

    const state = normalizeUserState(getSyncData());
    const merged = mergeProgressSnapshotDelta(state.shared.progress, nextProgress.snapshot, routeNovelId);
    if (!merged) throw createHttpError(400, 'progress snapshot invalid');
    const incomingUpdatedAt = parseClientTimestamp(nextProgress.updatedAt);
    const incomingVersion = parseSyncVersion(nextProgress.syncVersion);
    const sharedDecision = syncPolicyService.evaluateSharedWrite(state, { incomingUpdatedAt, incomingVersion });
    const currentUpdatedAt = sharedDecision.currentUpdatedAt;
    const currentVersion = sharedDecision.currentVersion;

    if (sharedDecision.stale) {
      setSyncData(state);
      return {
        success:true,
        skipped:true,
        reason:sharedDecision.reason,
        updatedAt:state.updatedAt,
        sharedUpdatedAt:currentUpdatedAt,
        sharedVersion:currentVersion,
        progressSnapshot:state.shared.progress?.byNovel?.[merged.snapshot.novelId] || null,
        syncPolicySummary:syncPolicyService.buildSyncPolicySummary(state, merged.snapshot.sourceDeviceId)
      };
    }

    state.shared.progress = merged.progress;
    state.version = 1;
    state.updatedAt = Date.now();
    const savedAt = markSharedSyncUpdatedAt(state, Math.max(state.updatedAt, incomingUpdatedAt || 0));
    const savedVersion = markSharedSyncVersion(state, incomingVersion || (currentVersion + 1));
    setSyncData(state);
    saveSyncData();

    return {
      success:true,
      updatedAt:state.updatedAt,
      sharedUpdatedAt:savedAt,
      sharedVersion:savedVersion,
      progressSnapshot:merged.snapshot,
      progressDelta:{ novelId:merged.snapshot.novelId, readMetaKey:merged.readMetaKey, positionKeys:merged.positionKeys },
      syncPolicySummary:syncPolicyService.buildSyncPolicySummary(state, merged.snapshot.sourceDeviceId)
    };
  }

  function saveDeviceState(req, nextDevice) {
    const check = validateDeviceState(nextDevice);
    if (!check.ok) {
      throw createHttpError(400, check.error);
    }

    const raw = getSyncData();
    const rawDeviceId = (nextDevice && nextDevice.deviceId) || req.get('x-device-id') || '';
    const hintedDeviceId = (typeof syncPolicyService.safeDeviceId === 'function' && syncPolicyService.safeDeviceId(rawDeviceId)) || '';
    const state = normalizeUserState(raw, { currentDeviceId:hintedDeviceId });
    const deviceId = hintedDeviceId
      || getRequestedDeviceId(req, state)
      || 'default-device';

    const incomingUpdatedAt = parseClientTimestamp(nextDevice && nextDevice.updatedAt);
    const incomingVersion = parseSyncVersion(nextDevice && nextDevice.syncVersion);
    const deviceDecision = syncPolicyService.evaluateDeviceWrite(state, deviceId, { incomingUpdatedAt, incomingVersion });
    const currentUpdatedAt = deviceDecision.currentUpdatedAt;
    const currentVersion = deviceDecision.currentVersion;

    if (deviceDecision.stale) {
      setSyncData(state);
      return {
        success: true,
        skipped: true,
        reason: deviceDecision.reason,
        updatedAt: state.updatedAt,
        deviceUpdatedAt: currentUpdatedAt,
        deviceVersion: currentVersion,
        deviceId,
        device: state.deviceProfiles[deviceId] || createEmptyDeviceProfile(),
        deviceProfiles: state.deviceProfiles,
        syncPolicySummary: syncPolicyService.buildSyncPolicySummary(state, deviceId)
      };
    }

    state.deviceProfiles[deviceId] = mergeDeviceState(state.deviceProfiles[deviceId], nextDevice);
    syncPolicyService.registerDeviceSeen(state, deviceId, nextDevice, incomingUpdatedAt || Date.now());
    state.version = 1;
    state.updatedAt = Date.now();
    const savedAt = markDeviceSyncUpdatedAt(state, deviceId, Math.max(state.updatedAt, incomingUpdatedAt || 0));
    const savedVersion = markDeviceSyncVersion(state, deviceId, incomingVersion || (currentVersion + 1));
    reconcileDeviceCollections(state, {
      currentDeviceId:deviceId,
      createDeviceProfile:(updatedAt) => normalizeDeviceProfile({ updatedAt })
    });
    setSyncData(state);
    saveSyncData();

    return {
      success: true,
      updatedAt: state.updatedAt,
      deviceUpdatedAt: savedAt,
      deviceVersion: savedVersion,
      deviceId,
      device: state.deviceProfiles[deviceId],
      deviceProfiles: state.deviceProfiles,
      syncPolicySummary: syncPolicyService.buildSyncPolicySummary(state, deviceId)
    };
  }


  async function persistMutationResult(result) {
    if (!result || result.skipped) return result;
    if (typeof syncStateService.flushAndWait !== 'function') return result;
    try {
      await syncStateService.flushAndWait();
      return { ...result, persisted:true };
    } catch (error) {
      const wrapped = createHttpError(503, 'state persistence failed');
      wrapped.code = 'STATE_PERSISTENCE_FAILED';
      wrapped.cause = error;
      throw wrapped;
    }
  }

  function runDurableMutation(mutate) {
    const operation = durableMutationChain.catch(() => {}).then(async () => {
      const previous = normalizeUserState(getSyncData());
      try {
        return await persistMutationResult(mutate());
      } catch (error) {
        if (error && error.code === 'STATE_PERSISTENCE_FAILED') {
          setSyncData(previous);
          saveSyncData();
        }
        throw error;
      }
    });
    durableMutationChain = operation.catch(() => {});
    return operation;
  }

  function saveSharedStateAsync(nextShared) {
    return runDurableMutation(() => saveSharedState(nextShared));
  }

  function saveProgressStateAsync(body) {
    return runDurableMutation(() => saveProgressState(body));
  }

  function saveProgressDeltaAsync(body, routeNovelId) {
    if (typeof syncStateService.appendProgressJournal !== 'function') {
      return runDurableMutation(() => saveProgressDelta(body, routeNovelId));
    }
    const operation = durableMutationChain.catch(() => {}).then(async () => {
      const nextProgress = pickAllowedObject(body, ['snapshot', 'updatedAt', 'syncVersion', '_accessDenied']);
      if (nextProgress._accessDenied) throw createHttpError(403, 'library access denied');
      if (!ensurePlainObject(nextProgress.snapshot)) throw createHttpError(400, 'progress snapshot invalid');
      const routeId = String(routeNovelId || '').trim().slice(0, 160);
      const snapshot = normalizeProgressSnapshotInput(nextProgress.snapshot, routeId, nextProgress.snapshot.episodeId);
      if (!snapshot || !routeId || snapshot.novelId !== routeId) throw createHttpError(400, 'progress snapshot invalid');

      const state = getSyncData();
      const incomingUpdatedAt = parseClientTimestamp(nextProgress.updatedAt);
      const incomingVersion = parseSyncVersion(nextProgress.syncVersion);
      const sharedDecision = syncPolicyService.evaluateSharedWrite(state, { incomingUpdatedAt, incomingVersion });
      const currentUpdatedAt = sharedDecision.currentUpdatedAt;
      const currentVersion = sharedDecision.currentVersion;
      if (sharedDecision.stale) {
        return {
          success:true,
          skipped:true,
          reason:sharedDecision.reason,
          updatedAt:state.updatedAt,
          sharedUpdatedAt:currentUpdatedAt,
          sharedVersion:currentVersion,
          progressSnapshot:state.shared?.progress?.byNovel?.[snapshot.novelId] || null,
          syncPolicySummary:syncPolicyService.buildSyncPolicySummary(state, snapshot.sourceDeviceId)
        };
      }

      const stateUpdatedAt = Date.now();
      const savedAt = Math.max(stateUpdatedAt, incomingUpdatedAt || 0);
      const savedVersion = incomingVersion || (currentVersion + 1);
      const entry = {
        schemaVersion:1,
        op:'progress-delta',
        routeNovelId:routeId,
        snapshot,
        stateUpdatedAt,
        sharedUpdatedAt:savedAt,
        sharedVersion:savedVersion
      };
      let merged = null;
      try {
        await syncStateService.appendProgressJournal(entry, () => {
          merged = mergeProgressSnapshotDeltaIncremental(state.shared.progress, snapshot, routeId);
          if (!merged) throw createHttpError(400, 'progress snapshot invalid');
          state.shared.progress = merged.progress;
          state.version = 1;
          state.updatedAt = stateUpdatedAt;
          markSharedSyncUpdatedAt(state, savedAt);
          markSharedSyncVersion(state, savedVersion);
          return merged;
        });
      } catch (error) {
        if (error && error.statusCode) throw error;
        const wrapped = createHttpError(503, 'state persistence failed');
        wrapped.code = 'STATE_PROGRESS_JOURNAL_FAILED';
        wrapped.cause = error;
        throw wrapped;
      }
      return {
        success:true,
        persisted:true,
        persistence:'progress-journal',
        updatedAt:state.updatedAt,
        sharedUpdatedAt:savedAt,
        sharedVersion:savedVersion,
        progressSnapshot:merged.snapshot,
        progressDelta:{ novelId:merged.snapshot.novelId, readMetaKey:merged.readMetaKey, positionKeys:merged.positionKeys },
        syncPolicySummary:syncPolicyService.buildSyncPolicySummary(state, merged.snapshot.sourceDeviceId)
      };
    });
    durableMutationChain = operation.catch(() => {});
    return operation;
  }

  function saveDeviceStateAsync(req, nextDevice) {
    return runDurableMutation(() => saveDeviceState(req, nextDevice));
  }

  function getLegacySyncState() {
    const state = normalizeUserState(getSyncData());
    setSyncData(state);
    return state.legacy || {};
  }

  return {
    getUserStateResponse,
    saveSharedState,
    saveSharedStateAsync,
    saveProgressState,
    saveProgressStateAsync,
    saveProgressDelta,
    saveProgressDeltaAsync,
    saveDeviceState,
    saveDeviceStateAsync,
    getLegacySyncState
  };
}

module.exports = {
  createStateWriteService,
  parseSyncVersion,
  parseClientTimestamp
};
