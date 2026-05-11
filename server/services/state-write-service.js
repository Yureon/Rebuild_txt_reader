const { pickAllowedObject } = require('../utils/object');
const stateNormalizer = require('./state-normalizer');
const { createSyncPolicyService } = require('./sync-policy-service');

function createHttpError(statusCode, message) {
  const err = new Error(message || 'state write failed');
  err.statusCode = statusCode;
  return err;
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
    markSharedSyncUpdatedAt,
    markSharedSyncVersion,
    markDeviceSyncUpdatedAt,
    markDeviceSyncVersion
  } = normalizer;

  const required = {
    createEmptyUserState,
    createEmptyDeviceProfile,
    normalizeUserState,
    normalizeProgressStateInput,
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
    markSharedSyncUpdatedAt,
    markSharedSyncVersion,
    markDeviceSyncUpdatedAt,
    markDeviceSyncVersion,
    syncPolicyService
  };
  Object.keys(required).forEach((key) => {
    if (!required[key]) throw new Error(`createStateWriteService missing normalizer dependency: ${key}`);
  });
  ['buildSyncPolicySummary', 'evaluateSharedWrite', 'evaluateDeviceWrite', 'registerDeviceSeen'].forEach((key) => {
    if (typeof syncPolicyService[key] !== 'function') throw new Error(`createStateWriteService missing syncPolicyService method: ${key}`);
  });

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
    const normalized = normalizeUserState(getSyncData());
    setSyncData(normalized);

    const requestedDeviceId = getRequestedDeviceId(req, normalized);

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
    const incomingUpdatedAt = Number(nextShared && nextShared.updatedAt) || 0;
    const sharedDecision = syncPolicyService.evaluateSharedWrite(state, { incomingUpdatedAt, incomingVersion: 0 });
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
    const incomingUpdatedAt = Number(nextProgress.updatedAt) || 0;
    const incomingVersion = Math.max(0, Number(nextProgress.syncVersion) || 0);
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

  function saveDeviceState(req, nextDevice) {
    const check = validateDeviceState(nextDevice);
    if (!check.ok) {
      throw createHttpError(400, check.error);
    }

    const state = normalizeUserState(getSyncData());
    const rawDeviceId = (nextDevice && nextDevice.deviceId) || req.get('x-device-id') || getRequestedDeviceId(req, state) || 'default-device';
    const deviceId = (typeof syncPolicyService.safeDeviceId === 'function' && syncPolicyService.safeDeviceId(rawDeviceId))
      || getRequestedDeviceId(req, state)
      || 'default-device';

    const incomingUpdatedAt = Number(nextDevice && nextDevice.updatedAt) || 0;
    const incomingVersion = Math.max(0, Number(nextDevice && nextDevice.syncVersion) || 0);
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

  function getLegacySyncState() {
    const state = normalizeUserState(getSyncData());
    setSyncData(state);
    return state.legacy || {};
  }

  return {
    getUserStateResponse,
    saveSharedState,
    saveProgressState,
    saveDeviceState,
    getLegacySyncState
  };
}

module.exports = {
  createStateWriteService
};
