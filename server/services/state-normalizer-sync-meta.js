const { isSafeRecordKey } = require('./state-normalizer-core');

const STATE_NORMALIZER_SYNC_META_SPLIT_PASS = 'v204-server-state-normalizer-sync-meta-split-pass';

function safeSyncInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
}

function createEmptySyncMeta() {
  return {
    sharedUpdatedAt: 0,
    deviceUpdatedAt: {},
    sharedVersion: 0,
    deviceVersions: {}
  };
}

function normalizeSyncMetaInput(input) {
  const meta = createEmptySyncMeta();
  const src = input && typeof input === 'object' && !Array.isArray(input) ? input : null;
  if (!src) return meta;
  meta.sharedUpdatedAt = safeSyncInteger(src.sharedUpdatedAt, 0);
  meta.sharedVersion = safeSyncInteger(src.sharedVersion, 0);
  if (src.deviceUpdatedAt && typeof src.deviceUpdatedAt === 'object' && !Array.isArray(src.deviceUpdatedAt)) {
    Object.keys(src.deviceUpdatedAt).forEach((deviceId) => {
      const cleanId = String(deviceId || '').trim().slice(0, 120);
      const ts = safeSyncInteger(src.deviceUpdatedAt[deviceId], -1);
      if (isSafeRecordKey(cleanId) && ts >= 0) meta.deviceUpdatedAt[cleanId] = ts;
    });
  }
  if (src.deviceVersions && typeof src.deviceVersions === 'object' && !Array.isArray(src.deviceVersions)) {
    Object.keys(src.deviceVersions).forEach((deviceId) => {
      const cleanId = String(deviceId || '').trim().slice(0, 120);
      const ver = safeSyncInteger(src.deviceVersions[deviceId], -1);
      if (isSafeRecordKey(cleanId) && ver >= 0) meta.deviceVersions[cleanId] = ver;
    });
  }
  return meta;
}

function getSharedSyncUpdatedAt(state) {
  const src = state && typeof state === 'object' ? state : {};
  const metaTs = src.syncMeta && Number.isFinite(Number(src.syncMeta.sharedUpdatedAt)) ? Number(src.syncMeta.sharedUpdatedAt) : 0;
  const sharedTs = src.shared && Number.isFinite(Number(src.shared.updatedAt)) ? Number(src.shared.updatedAt) : 0;
  return Math.max(metaTs, sharedTs, 0);
}

function getSharedSyncVersion(state) {
  const src = state && typeof state === 'object' ? state : {};
  const metaVer = src.syncMeta && Number.isFinite(Number(src.syncMeta.sharedVersion)) ? Number(src.syncMeta.sharedVersion) : 0;
  const sharedVer = src.shared && Number.isFinite(Number(src.shared.syncVersion)) ? Number(src.shared.syncVersion) : 0;
  return Math.max(metaVer, sharedVer, 0);
}

function getDeviceSyncUpdatedAt(state, deviceId) {
  const safeId = String(deviceId || '').trim().slice(0, 120);
  if (!isSafeRecordKey(safeId)) return 0;
  const src = state && typeof state === 'object' ? state : {};
  const metaTs = src.syncMeta && src.syncMeta.deviceUpdatedAt && Number.isFinite(Number(src.syncMeta.deviceUpdatedAt[safeId])) ? Number(src.syncMeta.deviceUpdatedAt[safeId]) : 0;
  const profileTs = src.deviceProfiles && src.deviceProfiles[safeId] && Number.isFinite(Number(src.deviceProfiles[safeId].updatedAt)) ? Number(src.deviceProfiles[safeId].updatedAt) : 0;
  return Math.max(metaTs, profileTs, 0);
}

function getDeviceSyncVersion(state, deviceId) {
  const safeId = String(deviceId || '').trim().slice(0, 120);
  if (!isSafeRecordKey(safeId)) return 0;
  const src = state && typeof state === 'object' ? state : {};
  const metaVer = src.syncMeta && src.syncMeta.deviceVersions && Number.isFinite(Number(src.syncMeta.deviceVersions[safeId])) ? Number(src.syncMeta.deviceVersions[safeId]) : 0;
  const profileVer = src.deviceProfiles && src.deviceProfiles[safeId] && Number.isFinite(Number(src.deviceProfiles[safeId].syncVersion)) ? Number(src.deviceProfiles[safeId].syncVersion) : 0;
  return Math.max(metaVer, profileVer, 0);
}

function markSharedSyncUpdatedAt(state, ts) {
  const safeTs = safeSyncInteger(ts, Date.now());
  state.syncMeta = state.syncMeta && typeof state.syncMeta === 'object' ? state.syncMeta : createEmptySyncMeta();
  state.syncMeta.sharedUpdatedAt = safeTs;
  if (state.shared && typeof state.shared === 'object') state.shared.updatedAt = safeTs;
  return safeTs;
}

function markSharedSyncVersion(state, version) {
  const safeVer = safeSyncInteger(version, 0);
  state.syncMeta = state.syncMeta && typeof state.syncMeta === 'object' ? state.syncMeta : createEmptySyncMeta();
  state.syncMeta.sharedVersion = safeVer;
  if (state.shared && typeof state.shared === 'object') state.shared.syncVersion = safeVer;
  return safeVer;
}

function markDeviceSyncUpdatedAt(state, deviceId, ts) {
  const safeId = String(deviceId || '').trim().slice(0, 120) || 'default-device';
  const safeTs = safeSyncInteger(ts, Date.now());
  state.syncMeta = state.syncMeta && typeof state.syncMeta === 'object' ? state.syncMeta : createEmptySyncMeta();
  if (!state.syncMeta.deviceUpdatedAt || typeof state.syncMeta.deviceUpdatedAt !== 'object' || Array.isArray(state.syncMeta.deviceUpdatedAt)) state.syncMeta.deviceUpdatedAt = {};
  if (!isSafeRecordKey(safeId)) return safeTs;
  state.syncMeta.deviceUpdatedAt[safeId] = safeTs;
  if (state.deviceProfiles && state.deviceProfiles[safeId] && typeof state.deviceProfiles[safeId] === 'object') state.deviceProfiles[safeId].updatedAt = safeTs;
  return safeTs;
}

function markDeviceSyncVersion(state, deviceId, version) {
  const safeId = String(deviceId || '').trim().slice(0, 120) || 'default-device';
  const safeVer = safeSyncInteger(version, 0);
  state.syncMeta = state.syncMeta && typeof state.syncMeta === 'object' ? state.syncMeta : createEmptySyncMeta();
  if (!state.syncMeta.deviceVersions || typeof state.syncMeta.deviceVersions !== 'object' || Array.isArray(state.syncMeta.deviceVersions)) state.syncMeta.deviceVersions = {};
  if (!isSafeRecordKey(safeId)) return safeVer;
  state.syncMeta.deviceVersions[safeId] = safeVer;
  if (state.deviceProfiles && state.deviceProfiles[safeId] && typeof state.deviceProfiles[safeId] === 'object') state.deviceProfiles[safeId].syncVersion = safeVer;
  return safeVer;
}


module.exports = {
  STATE_NORMALIZER_SYNC_META_SPLIT_PASS,
  safeSyncInteger,
  createEmptySyncMeta,
  normalizeSyncMetaInput,
  getSharedSyncUpdatedAt,
  getSharedSyncVersion,
  getDeviceSyncUpdatedAt,
  getDeviceSyncVersion,
  markSharedSyncUpdatedAt,
  markSharedSyncVersion,
  markDeviceSyncUpdatedAt,
  markDeviceSyncVersion
};
