const stateNormalizer = require('./state-normalizer');
const { MAX_DEVICE_PROFILES } = require('./state-device-profile-cap');

const DEVICE_ID_RE = /^[a-zA-Z0-9_-]{8,120}$/;

function safeDeviceId(value) {
  const id = String(value || '').trim().slice(0, 120);
  return DEVICE_ID_RE.test(id) ? id : '';
}

function firstDefined() {
  for (let i = 0; i < arguments.length; i += 1) {
    if (arguments[i] !== null && typeof arguments[i] !== 'undefined') return arguments[i];
  }
  return undefined;
}

function createSyncPolicyService(options = {}) {
  const normalizer = options.normalizer || stateNormalizer;
  const {
    createEmptyUserState,
    ensurePlainObject,
    sanitizeTextValue,
    getSharedSyncUpdatedAt,
    getSharedSyncVersion,
    getDeviceSyncUpdatedAt,
    getDeviceSyncVersion
  } = normalizer;

  const required = {
    createEmptyUserState,
    ensurePlainObject,
    sanitizeTextValue,
    getSharedSyncUpdatedAt,
    getSharedSyncVersion,
    getDeviceSyncUpdatedAt,
    getDeviceSyncVersion
  };
  Object.keys(required).forEach((key) => {
    if (!required[key]) throw new Error(`createSyncPolicyService missing normalizer dependency: ${key}`);
  });

  function emptyPolicy() {
    return createEmptyUserState().shared.syncPolicy;
  }

  function ensureSyncPolicy(state) {
    const empty = emptyPolicy();
    if (!state.shared || typeof state.shared !== 'object' || Array.isArray(state.shared)) state.shared = createEmptyUserState().shared;
    const raw = ensurePlainObject(state.shared.syncPolicy) ? state.shared.syncPolicy : {};
    const share = Object.assign({}, empty.share, ensurePlainObject(raw.share) ? raw.share : {});
    const devices = Array.isArray(raw.devices) ? raw.devices : [];
    state.shared.syncPolicy = {
      preferredDeviceId: safeDeviceId(raw.preferredDeviceId) || null,
      devices: devices
        .filter((item) => ensurePlainObject(item) && safeDeviceId(item.id))
        .slice(0, MAX_DEVICE_PROFILES)
        .map((item) => ({
          id: safeDeviceId(item.id),
          name: sanitizeDeviceName(item.name),
          lastSeenAt: safeTimestamp(item.lastSeenAt)
        })),
      share
    };
    return state.shared.syncPolicy;
  }

  function sanitizeDeviceName(value) {
    return sanitizeTextValue(value, 60, '이름 없는 기기');
  }

  function safeTimestamp(value) {
    const ts = Number(value);
    return Number.isFinite(ts) && ts > 0 ? Math.floor(ts) : 0;
  }

  function getPreferredDeviceId(state) {
    const policy = ensureSyncPolicy(state);
    return safeDeviceId(policy.preferredDeviceId) || null;
  }

  function collectDeviceIds(state, currentDeviceId) {
    const ids = new Set();
    const current = safeDeviceId(currentDeviceId);
    if (current) ids.add(current);

    const policy = ensureSyncPolicy(state);
    policy.devices.forEach((device) => {
      const id = safeDeviceId(device && device.id);
      if (id) ids.add(id);
    });

    if (state.deviceProfiles && typeof state.deviceProfiles === 'object' && !Array.isArray(state.deviceProfiles)) {
      Object.keys(state.deviceProfiles).forEach((id) => {
        const safeId = safeDeviceId(id);
        if (safeId) ids.add(safeId);
      });
    }

    const meta = state.syncMeta && typeof state.syncMeta === 'object' && !Array.isArray(state.syncMeta) ? state.syncMeta : {};
    if (meta.deviceUpdatedAt && typeof meta.deviceUpdatedAt === 'object' && !Array.isArray(meta.deviceUpdatedAt)) {
      Object.keys(meta.deviceUpdatedAt).forEach((id) => {
        const safeId = safeDeviceId(id);
        if (safeId) ids.add(safeId);
      });
    }
    if (meta.deviceVersions && typeof meta.deviceVersions === 'object' && !Array.isArray(meta.deviceVersions)) {
      Object.keys(meta.deviceVersions).forEach((id) => {
        const safeId = safeDeviceId(id);
        if (safeId) ids.add(safeId);
      });
    }

    const progress = state.shared && state.shared.progress && ensurePlainObject(state.shared.progress) ? state.shared.progress : null;
    const lastReadSource = progress && progress.lastRead ? safeDeviceId(progress.lastRead.sourceDeviceId) : '';
    if (lastReadSource) ids.add(lastReadSource);

    return Array.from(ids).slice(0, 30);
  }

  function findPolicyDevice(state, deviceId) {
    const id = safeDeviceId(deviceId);
    if (!id) return null;
    const policy = ensureSyncPolicy(state);
    return policy.devices.find((device) => device.id === id) || null;
  }

  function getDeviceDisplayName(state, deviceId, fallbackInput = {}) {
    const id = safeDeviceId(deviceId);
    const fromInput = sanitizeDeviceName(fallbackInput.deviceName || fallbackInput.name || '');
    if (fromInput && fromInput !== '이름 없는 기기') return fromInput;
    const registered = findPolicyDevice(state, id);
    if (registered && registered.name) return registered.name;
    const progress = state.shared && state.shared.progress && ensurePlainObject(state.shared.progress) ? state.shared.progress : null;
    if (progress && progress.lastRead && safeDeviceId(progress.lastRead.sourceDeviceId) === id) {
      const name = sanitizeDeviceName(progress.lastRead.sourceDeviceName || '');
      if (name && name !== '이름 없는 기기') return name;
    }
    return '이름 없는 기기';
  }

  function registerDeviceSeen(state, deviceId, input = {}, seenAt = Date.now()) {
    const id = safeDeviceId(deviceId);
    if (!id) return null;
    const policy = ensureSyncPolicy(state);
    const now = safeTimestamp(seenAt) || Date.now();
    const name = getDeviceDisplayName(state, id, input);
    const existingIndex = policy.devices.findIndex((device) => device.id === id);
    const existing = existingIndex >= 0 ? policy.devices[existingIndex] : null;
    const next = {
      id,
      name: name || (existing && existing.name) || '이름 없는 기기',
      lastSeenAt: Math.max(now, safeTimestamp(existing && existing.lastSeenAt))
    };
    if (existingIndex >= 0) {
      policy.devices[existingIndex] = next;
    } else {
      policy.devices.unshift(next);
    }
    policy.devices = policy.devices
      .filter((device, idx, arr) => arr.findIndex((other) => other.id === device.id) === idx)
      .sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0))
      .slice(0, MAX_DEVICE_PROFILES);
    return next;
  }

  function evaluateSharedWrite(state, input = {}) {
    const incomingUpdatedAt = Number(firstDefined(input.incomingUpdatedAt, input.updatedAt)) || 0;
    const incomingVersion = Math.max(0, Number(firstDefined(input.incomingVersion, input.syncVersion)) || 0);
    const currentUpdatedAt = getSharedSyncUpdatedAt(state);
    const currentVersion = getSharedSyncVersion(state);

    if (incomingVersion && currentVersion && incomingVersion <= currentVersion) {
      return {
        stale: true,
        reason: 'stale_shared_version',
        currentUpdatedAt,
        currentVersion,
        incomingUpdatedAt,
        incomingVersion
      };
    }

    if (!incomingVersion && incomingUpdatedAt && currentUpdatedAt && incomingUpdatedAt < currentUpdatedAt) {
      return {
        stale: true,
        reason: 'stale_shared_updatedAt',
        currentUpdatedAt,
        currentVersion,
        incomingUpdatedAt,
        incomingVersion
      };
    }

    return {
      stale: false,
      reason: 'accepted_shared_write',
      currentUpdatedAt,
      currentVersion,
      incomingUpdatedAt,
      incomingVersion
    };
  }

  function evaluateDeviceWrite(state, deviceId, input = {}) {
    const id = safeDeviceId(deviceId) || 'default-device';
    const incomingUpdatedAt = Number(firstDefined(input.incomingUpdatedAt, input.updatedAt)) || 0;
    const incomingVersion = Math.max(0, Number(firstDefined(input.incomingVersion, input.syncVersion)) || 0);
    const currentUpdatedAt = getDeviceSyncUpdatedAt(state, id);
    const currentVersion = getDeviceSyncVersion(state, id);

    if (incomingVersion && currentVersion && incomingVersion <= currentVersion) {
      return {
        stale: true,
        reason: 'stale_device_version',
        deviceId: id,
        currentUpdatedAt,
        currentVersion,
        incomingUpdatedAt,
        incomingVersion
      };
    }

    if (!incomingVersion && incomingUpdatedAt && currentUpdatedAt && incomingUpdatedAt < currentUpdatedAt) {
      return {
        stale: true,
        reason: 'stale_device_updatedAt',
        deviceId: id,
        currentUpdatedAt,
        currentVersion,
        incomingUpdatedAt,
        incomingVersion
      };
    }

    return {
      stale: false,
      reason: 'accepted_device_write',
      deviceId: id,
      currentUpdatedAt,
      currentVersion,
      incomingUpdatedAt,
      incomingVersion
    };
  }

  function buildProgressAuthority(state, currentDeviceId) {
    const current = safeDeviceId(currentDeviceId) || null;
    const preferred = getPreferredDeviceId(state);
    const progress = state.shared && state.shared.progress && ensurePlainObject(state.shared.progress) ? state.shared.progress : null;
    const lastRead = progress && ensurePlainObject(progress.lastRead) ? progress.lastRead : null;
    const sourceDeviceId = lastRead ? safeDeviceId(lastRead.sourceDeviceId) || null : null;
    const sourceSavedAt = lastRead ? safeTimestamp(lastRead.sourceSavedAt || lastRead.ts) : 0;

    const isRemoteForCurrent = !!(sourceDeviceId && current && sourceDeviceId !== current);
    const isFromPreferredDevice = !!(preferred && sourceDeviceId && preferred === sourceDeviceId);
    const isPreferredAuthoritative = !!(!preferred || !sourceDeviceId || sourceDeviceId === preferred);
    const blockedByPreferredDevice = !!(preferred && sourceDeviceId && sourceDeviceId !== preferred);

    return {
      hasLastRead: !!lastRead,
      sourceDeviceId,
      sourceDeviceName: lastRead ? sanitizeDeviceName(lastRead.sourceDeviceName || getDeviceDisplayName(state, sourceDeviceId || '', {})) : '',
      sourceSavedAt,
      isRemoteForCurrent,
      isFromPreferredDevice,
      isPreferredAuthoritative,
      blockedByPreferredDevice,
      shouldOfferRemoteResume: !!(isRemoteForCurrent && isPreferredAuthoritative),
      lastRead: lastRead ? {
        novelId: sanitizeTextValue(lastRead.novelId, 160, ''),
        episodeId: lastRead.episodeId == null ? null : sanitizeTextValue(lastRead.episodeId, 160, ''),
        episodeIdx: Number.isFinite(Number(lastRead.episodeIdx)) ? Math.max(0, Math.floor(Number(lastRead.episodeIdx))) : 0,
        chunk: Number.isFinite(Number(lastRead.chunk)) ? Math.max(1, Math.floor(Number(lastRead.chunk))) : 1,
        totalChunks: Number.isFinite(Number(lastRead.totalChunks)) ? Math.max(1, Math.floor(Number(lastRead.totalChunks))) : 1,
        ratio: Number.isFinite(Number(lastRead.ratio)) ? Math.min(1, Math.max(0, Number(lastRead.ratio))) : 0,
        globalBlockIndex: Number.isFinite(Number(lastRead.globalBlockIndex)) ? Math.max(0, Math.floor(Number(lastRead.globalBlockIndex))) : null,
        blockIndex: Number.isFinite(Number(lastRead.blockIndex)) ? Math.max(0, Math.floor(Number(lastRead.blockIndex))) : null,
        charIndex: Number.isFinite(Number(lastRead.charIndex)) ? Math.max(0, Math.floor(Number(lastRead.charIndex))) : 0,
        documentRatio: Number.isFinite(Number(lastRead.documentRatio)) ? Math.min(1, Math.max(0, Number(lastRead.documentRatio))) : null,
        sourceDeviceId,
        sourceDeviceName: lastRead.sourceDeviceName ? sanitizeDeviceName(lastRead.sourceDeviceName) : '',
        sourceSavedAt,
        ts: Number.isFinite(Number(lastRead.ts)) ? Math.max(0, Math.floor(Number(lastRead.ts))) : 0
      } : null
    };
  }

  function buildSyncPolicySummary(state, currentDeviceId) {
    const current = safeDeviceId(currentDeviceId) || null;
    const policy = ensureSyncPolicy(state);
    const preferred = getPreferredDeviceId(state);
    const ids = collectDeviceIds(state, current);
    const devices = ids.map((id) => {
      const registered = findPolicyDevice(state, id);
      const profileUpdatedAt = getDeviceSyncUpdatedAt(state, id);
      const profileVersion = getDeviceSyncVersion(state, id);
      const lastSeenAt = Math.max(safeTimestamp(registered && registered.lastSeenAt), profileUpdatedAt);
      return {
        id,
        name: getDeviceDisplayName(state, id, {}),
        lastSeenAt,
        updatedAt: profileUpdatedAt,
        syncVersion: profileVersion,
        isCurrent: !!(current && id === current),
        isPreferred: !!(preferred && id === preferred)
      };
    }).sort((a, b) => {
      if (a.isPreferred !== b.isPreferred) return a.isPreferred ? -1 : 1;
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      return (b.lastSeenAt || 0) - (a.lastSeenAt || 0);
    });

    return {
      currentDeviceId: current,
      preferredDeviceId: preferred,
      effectiveDeviceId: preferred || current,
      currentDeviceIsPreferred: !!(current && preferred && current === preferred),
      preferredDeviceKnown: !!(preferred && devices.some((device) => device.id === preferred)),
      hasOtherDevices: devices.some((device) => !device.isCurrent),
      share: Object.assign({}, emptyPolicy().share, ensurePlainObject(policy.share) ? policy.share : {}),
      devices,
      progressAuthority: buildProgressAuthority(state, current)
    };
  }

  return {
    safeDeviceId,
    ensureSyncPolicy,
    getPreferredDeviceId,
    registerDeviceSeen,
    evaluateSharedWrite,
    evaluateDeviceWrite,
    buildSyncPolicySummary
  };
}

module.exports = {
  createSyncPolicyService,
  safeDeviceId
};
