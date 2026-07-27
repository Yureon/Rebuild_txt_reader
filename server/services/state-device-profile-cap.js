const MAX_DEVICE_PROFILES = 20;
const DEVICE_ID_RE = /^[a-zA-Z0-9_-]{8,120}$/;
const V674_SERVER_DEVICE_PROFILE_CAP_PASS = 'v674-server-device-profile-cap-pass';

function safeDeviceId(value) {
  const id = String(value || '').trim().slice(0, 120);
  return DEVICE_ID_RE.test(id) ? id : '';
}

function safeNonNegativeInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
}

function compareText(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function reconcileDeviceCollections(state, options = {}) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return state;

  const createDeviceProfile = typeof options.createDeviceProfile === 'function'
    ? options.createDeviceProfile
    : (updatedAt) => ({ updatedAt });
  const maxDevices = Number.isSafeInteger(options.maxDevices) && options.maxDevices > 0
    ? options.maxDevices
    : MAX_DEVICE_PROFILES;

  const profiles = state.deviceProfiles && typeof state.deviceProfiles === 'object' && !Array.isArray(state.deviceProfiles)
    ? state.deviceProfiles
    : {};
  const syncMeta = state.syncMeta && typeof state.syncMeta === 'object' && !Array.isArray(state.syncMeta)
    ? state.syncMeta
    : {};
  const deviceUpdatedAt = syncMeta.deviceUpdatedAt && typeof syncMeta.deviceUpdatedAt === 'object' && !Array.isArray(syncMeta.deviceUpdatedAt)
    ? syncMeta.deviceUpdatedAt
    : {};
  const deviceVersions = syncMeta.deviceVersions && typeof syncMeta.deviceVersions === 'object' && !Array.isArray(syncMeta.deviceVersions)
    ? syncMeta.deviceVersions
    : {};

  if (!state.shared || typeof state.shared !== 'object' || Array.isArray(state.shared)) state.shared = {};
  const policy = state.shared.syncPolicy && typeof state.shared.syncPolicy === 'object' && !Array.isArray(state.shared.syncPolicy)
    ? state.shared.syncPolicy
    : { preferredDeviceId:null, devices:[], share:{} };
  const policyDevices = Array.isArray(policy.devices) ? policy.devices : [];
  const preferredDeviceId = safeDeviceId(policy.preferredDeviceId);
  const currentDeviceId = safeDeviceId(options.currentDeviceId);
  const candidates = new Map();

  function candidateFor(value) {
    const id = safeDeviceId(value);
    if (!id) return null;
    if (!candidates.has(id)) {
      candidates.set(id, {
        id,
        profile:null,
        policyDevice:null,
        profileUpdatedAt:0,
        metaUpdatedAt:0,
        updatedAt:0,
        version:0
      });
    }
    return candidates.get(id);
  }

  Object.keys(profiles).forEach((rawId) => {
    const candidate = candidateFor(rawId);
    if (!candidate) return;
    const profile = profiles[rawId];
    if (profile && typeof profile === 'object' && !Array.isArray(profile)) {
      candidate.profile = profile;
      candidate.profileUpdatedAt = safeNonNegativeInteger(profile.updatedAt);
      candidate.updatedAt = Math.max(candidate.updatedAt, candidate.profileUpdatedAt);
      candidate.version = Math.max(candidate.version, safeNonNegativeInteger(profile.syncVersion));
    }
  });

  Object.keys(deviceUpdatedAt).forEach((rawId) => {
    const candidate = candidateFor(rawId);
    if (!candidate) return;
    candidate.metaUpdatedAt = safeNonNegativeInteger(deviceUpdatedAt[rawId]);
    candidate.updatedAt = Math.max(candidate.updatedAt, candidate.metaUpdatedAt);
  });

  Object.keys(deviceVersions).forEach((rawId) => {
    const candidate = candidateFor(rawId);
    if (candidate) candidate.version = Math.max(candidate.version, safeNonNegativeInteger(deviceVersions[rawId]));
  });

  policyDevices.forEach((rawDevice) => {
    if (!rawDevice || typeof rawDevice !== 'object' || Array.isArray(rawDevice)) return;
    const candidate = candidateFor(rawDevice.id);
    if (!candidate) return;
    const normalizedDevice = {
      id:candidate.id,
      name:String(rawDevice.name || 'Unknown device').trim().slice(0, 60) || 'Unknown device',
      lastSeenAt:safeNonNegativeInteger(rawDevice.lastSeenAt)
    };
    const previous = candidate.policyDevice;
    if (
      !previous
      || normalizedDevice.lastSeenAt > previous.lastSeenAt
      || (
        normalizedDevice.lastSeenAt === previous.lastSeenAt
        && compareText(normalizedDevice.name, previous.name) < 0
      )
    ) {
      candidate.policyDevice = normalizedDevice;
    }
    candidate.updatedAt = Math.max(candidate.updatedAt, normalizedDevice.lastSeenAt);
  });

  candidateFor(preferredDeviceId);
  candidateFor(currentDeviceId);

  const ranked = Array.from(candidates.values()).sort((a, b) => {
    if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt;
    if (a.version !== b.version) return b.version - a.version;
    return compareText(a.id, b.id);
  });
  const selected = new Set();
  [preferredDeviceId, currentDeviceId].forEach((id) => {
    if (id && candidates.has(id) && selected.size < maxDevices) selected.add(id);
  });
  ranked.forEach((candidate) => {
    if (selected.size < maxDevices) selected.add(candidate.id);
  });
  const retained = ranked.filter((candidate) => selected.has(candidate.id));

  const nextProfiles = {};
  const nextUpdatedAt = {};
  const nextVersions = {};
  const nextPolicyDevices = [];
  retained.forEach((candidate) => {
    const deviceUpdatedAtValue = Math.max(candidate.profileUpdatedAt, candidate.metaUpdatedAt);
    const profile = candidate.profile || createDeviceProfile(deviceUpdatedAtValue);
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return;
    profile.updatedAt = candidate.profile ? candidate.profileUpdatedAt : deviceUpdatedAtValue;
    nextProfiles[candidate.id] = profile;
    nextUpdatedAt[candidate.id] = deviceUpdatedAtValue;
    nextVersions[candidate.id] = candidate.version;
    nextPolicyDevices.push({
      id:candidate.id,
      name:candidate.policyDevice ? candidate.policyDevice.name : 'Unknown device',
      lastSeenAt:candidate.policyDevice ? candidate.policyDevice.lastSeenAt : deviceUpdatedAtValue
    });
  });

  state.deviceProfiles = nextProfiles;
  state.syncMeta = {
    ...syncMeta,
    deviceUpdatedAt:nextUpdatedAt,
    deviceVersions:nextVersions
  };
  state.shared.syncPolicy = {
    ...policy,
    preferredDeviceId:preferredDeviceId || null,
    devices:nextPolicyDevices
  };
  return state;
}

module.exports = {
  MAX_DEVICE_PROFILES,
  DEVICE_ID_RE,
  V674_SERVER_DEVICE_PROFILE_CAP_PASS,
  safeDeviceId,
  reconcileDeviceCollections
};
