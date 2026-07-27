const {
  ensurePlainObject,
  isSafeRecordKey,
  assignSafeRecord,
  sanitizeTextValue,
  clampNumber,
  sanitizeStringList
} = require('./state-normalizer-core');
const { normalizeDevicePrefs, normalizeViewerPrefs, sanitizeThemeBucket } = require('./state-normalizer-theme');
const {
  normalizeProgressSnapshotInput,
  normalizePositionValueInput,
  normalizeProgressStateInput,
  mergeProgressSnapshotDelta,
  mergeProgressSnapshotDeltaIncremental,
  V675_PROGRESS_INCREMENTAL_MERGE_PASS
} = require('./state-normalizer-progress');
const { normalizeSyncPolicyInput: normalizeSyncPolicyInputPure } = require('./state-normalizer-sync-policy');
const { sanitizeBookmarkList, sanitizeRecentList, sanitizeUserTagList, sanitizeNovelUserTags, sanitizeCollapsedFolders } = require('./state-normalizer-lists');
const { validateSharedState, validateDeviceState } = require('./state-normalizer-validation');
const {
  STATE_NORMALIZER_SYNC_META_SPLIT_PASS,
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
} = require('./state-normalizer-sync-meta');
const { mergeSharedStateInput, mergeDeviceStateInput } = require('./state-normalizer-merge');
const {
  MAX_DEVICE_PROFILES,
  V674_SERVER_DEVICE_PROFILE_CAP_PASS,
  reconcileDeviceCollections
} = require('./state-device-profile-cap');

function createEmptyDeviceProfile() {
  return {
    collapsedFolders: [],
    theme: {
      activeThemeId: 'default',
      themes: {}
    },
    prefs: normalizeDevicePrefs({}),
    updatedAt: Date.now()
  };
}

function createEmptyUserState() {
  return {
    version: 1,
    updatedAt: Date.now(),
    syncMeta: createEmptySyncMeta(),
    shared: {
      favorites: [],
      bookmarks: [],
      recents: [],
      userTags: [],
      novelUserTags: {},
      searchHistory: [],
      progress: {
        lastRead: null,
        byNovel: {},
        positions: {},
        readMeta: {}
      },
      theme: {
        activeThemeId: 'default',
        themes: {}
      },
      viewerPrefs: {},
      lastOpenedNovelId: null,
      syncPolicy: {
        preferredDeviceId: null,
        devices: [],
        share: {
          progress: true,
          favorites: true,
          bookmarks: true,
          recents: true,
          searchHistory: true,
          lastOpenedNovelId: true,
          collapsedFolders: false,
          theme: false,
          otherDeviceAlert: true,
          otherDeviceConnectToast: true
        }
      }
    },
    deviceProfiles: {},
    legacy: {}
  };
}

function normalizeUserState(raw, options = {}) {
  const base = createEmptyUserState();
  const src = raw && typeof raw === 'object' ? raw : {};

  const reserved = new Set(['version', 'updatedAt', 'shared', 'device', 'deviceProfiles', 'legacy', 'syncMeta']);
  Object.keys(src).forEach((k) => {
    if (!reserved.has(k) && isSafeRecordKey(k)) {
      base.legacy[k] = src[k];
    }
  });

  if (src.legacy && typeof src.legacy === 'object' && !Array.isArray(src.legacy)) {
    base.legacy = assignSafeRecord({}, base.legacy, src.legacy);
  }

  if (typeof src.version === 'number') base.version = src.version;
  if (typeof src.updatedAt === 'number') base.updatedAt = src.updatedAt;


  base.syncMeta = normalizeSyncMetaInput(src.syncMeta);

  if (src.shared && typeof src.shared === 'object' && !Array.isArray(src.shared)) {
    const s = src.shared;

    if (Array.isArray(s.favorites)) base.shared.favorites = sanitizeStringList(s.favorites, 2000, 200);
    if (Array.isArray(s.bookmarks)) base.shared.bookmarks = sanitizeBookmarkList(s.bookmarks);
    if (Array.isArray(s.recents)) base.shared.recents = sanitizeRecentList(s.recents);
    if (Array.isArray(s.userTags)) base.shared.userTags = sanitizeUserTagList(s.userTags);
    if (s.novelUserTags && typeof s.novelUserTags === 'object' && !Array.isArray(s.novelUserTags)) base.shared.novelUserTags = sanitizeNovelUserTags(s.novelUserTags, base.shared.userTags);
    if (Array.isArray(s.searchHistory)) base.shared.searchHistory = sanitizeStringList(s.searchHistory, 100, 160);

    if (s.progress && typeof s.progress === 'object' && !Array.isArray(s.progress)) {
      base.shared.progress = normalizeProgressStateInput(s.progress);
    }

    if (s.theme && typeof s.theme === 'object' && !Array.isArray(s.theme)) {
      base.shared.theme = sanitizeThemeBucket(s.theme);
    }

    if (s.viewerPrefs && typeof s.viewerPrefs === 'object' && !Array.isArray(s.viewerPrefs)) {
      base.shared.viewerPrefs = normalizeViewerPrefs(s.viewerPrefs);
    }

    if (typeof s.lastOpenedNovelId === 'string' || s.lastOpenedNovelId === null) {
      base.shared.lastOpenedNovelId = s.lastOpenedNovelId;
    }

    if (s.syncPolicy && typeof s.syncPolicy === 'object' && !Array.isArray(s.syncPolicy)) {
      base.shared.syncPolicy = normalizeSyncPolicyInput(s.syncPolicy, { maxDevices:Infinity });
    }
  }

  if (src.deviceProfiles && typeof src.deviceProfiles === 'object' && !Array.isArray(src.deviceProfiles)) {
    Object.keys(src.deviceProfiles).forEach((deviceId) => {
      const cleanId = String(deviceId || '').trim().slice(0, 120);
      if (!isSafeRecordKey(cleanId)) return;
      base.deviceProfiles[cleanId] = normalizeDeviceProfile(src.deviceProfiles[deviceId]);
    });
  }

  if (src.device && typeof src.device === 'object' && !Array.isArray(src.device)) {
    const fallbackDeviceId = (
      base.shared && base.shared.syncPolicy && typeof base.shared.syncPolicy.preferredDeviceId === 'string' && base.shared.syncPolicy.preferredDeviceId.trim()
    ) ||
    (Array.isArray(base.shared.syncPolicy.devices) && base.shared.syncPolicy.devices[0] && typeof base.shared.syncPolicy.devices[0].id === 'string'
      ? base.shared.syncPolicy.devices[0].id
      : 'default-device');

    if (isSafeRecordKey(fallbackDeviceId) && !base.deviceProfiles[fallbackDeviceId]) {
      base.deviceProfiles[fallbackDeviceId] = normalizeDeviceProfile(src.device);
    }
  }

  return reconcileDeviceCollections(base, {
    currentDeviceId:options.currentDeviceId,
    createDeviceProfile:(updatedAt) => normalizeDeviceProfile({ updatedAt })
  });
}


const DEVICE_ID_RE = /^[a-zA-Z0-9_-]{8,120}$/;
function normalizeSyncPolicyInput(input, options = {}) {
  return normalizeSyncPolicyInputPure(input, {
    basePolicy:createEmptyUserState().shared.syncPolicy,
    deviceIdRe:DEVICE_ID_RE,
    maxDevices:options.maxDevices
  });
}

function mergeSharedState(prevShared, nextShared) {
  return mergeSharedStateInput(prevShared || {}, nextShared || {}, {
    baseShared: createEmptyUserState().shared,
    normalizeSyncPolicyInput
  });
}

function mergeDeviceState(prevDevice, nextDevice) {
  return mergeDeviceStateInput(prevDevice || {}, nextDevice || {}, { normalizeDeviceProfile });
}
function normalizeDeviceProfile(input) {
  const src = ensurePlainObject(input) ? input : {};
  const base = createEmptyDeviceProfile();
  return {
    collapsedFolders: sanitizeCollapsedFolders(src.collapsedFolders),
    theme: ensurePlainObject(src.theme) ? sanitizeThemeBucket(src.theme) : base.theme,
    prefs: ensurePlainObject(src.prefs) ? normalizeDevicePrefs(src.prefs) : base.prefs,
    updatedAt: typeof src.updatedAt === 'number' ? src.updatedAt : Date.now()
  };
}

function getRequestedDeviceId(req, syncState) {
  const fromHeader = String(req.get('x-device-id') || '').trim().slice(0, 120);
  if (DEVICE_ID_RE.test(fromHeader)) return fromHeader;

  const preferred = syncState && syncState.shared && syncState.shared.syncPolicy
    ? String(syncState.shared.syncPolicy.preferredDeviceId || '').trim().slice(0, 120)
    : '';
  if (DEVICE_ID_RE.test(preferred)) return preferred;

  const profileIds = syncState && syncState.deviceProfiles && typeof syncState.deviceProfiles === 'object'
    ? Object.keys(syncState.deviceProfiles)
    : [];
  if (profileIds.length) return profileIds[0];

  return 'default-device';
}

function getDeviceProfileForResponse(syncState, deviceId) {
  const safeId = String(deviceId || '').trim().slice(0, 120) || 'default-device';
  const profiles = syncState && syncState.deviceProfiles && typeof syncState.deviceProfiles === 'object'
    ? syncState.deviceProfiles
    : {};
  return normalizeDeviceProfile(profiles[safeId] || null);
}


function applyProgressJournalEntry(state, entry) {
  if (!state || !entry || entry.op !== 'progress-delta') return { applied:false, reason:'invalid-entry' };
  const incomingVersion = Math.max(0, Number(entry.sharedVersion) || 0);
  const currentVersion = getSharedSyncVersion(state);
  if (incomingVersion && incomingVersion <= currentVersion) return { applied:false, reason:'already-applied' };
  if (!state.shared || typeof state.shared !== 'object') state.shared = createEmptyUserState().shared;
  const merged = mergeProgressSnapshotDeltaIncremental(state.shared.progress, entry.snapshot, entry.routeNovelId);
  if (!merged) return { applied:false, reason:'invalid-snapshot' };
  state.shared.progress = merged.progress;
  state.version = 1;
  state.updatedAt = Math.max(Number(state.updatedAt) || 0, Number(entry.stateUpdatedAt) || 0);
  markSharedSyncUpdatedAt(state, Math.max(Number(entry.sharedUpdatedAt) || 0, state.updatedAt));
  markSharedSyncVersion(state, incomingVersion || (currentVersion + 1));
  return { applied:true, snapshot:merged.snapshot };
}

module.exports = {
  STATE_NORMALIZER_SYNC_META_SPLIT_PASS,
  MAX_DEVICE_PROFILES,
  V674_SERVER_DEVICE_PROFILE_CAP_PASS,
  createEmptyDeviceProfile,
  createEmptySyncMeta,
  createEmptyUserState,
  normalizeUserState,
  getSharedSyncUpdatedAt,
  getSharedSyncVersion,
  getDeviceSyncUpdatedAt,
  getDeviceSyncVersion,
  markSharedSyncUpdatedAt,
  markSharedSyncVersion,
  markDeviceSyncUpdatedAt,
  markDeviceSyncVersion,
  normalizeDevicePrefs,
  normalizeViewerPrefs,
  normalizeSyncPolicyInput,
  sanitizeThemeBucket,
  ensurePlainObject,
  isSafeRecordKey,
  assignSafeRecord,
  sanitizeTextValue,
  clampNumber,
  sanitizeStringList,
  sanitizeBookmarkList,
  sanitizeRecentList,
  normalizeProgressSnapshotInput,
  mergeProgressSnapshotDeltaIncremental,
  applyProgressJournalEntry,
  V675_PROGRESS_INCREMENTAL_MERGE_PASS,
  normalizePositionValueInput,
  normalizeProgressStateInput,
  mergeProgressSnapshotDelta,
  sanitizeCollapsedFolders,
  validateSharedState,
  validateDeviceState,
  mergeSharedState,
  mergeDeviceState,
  normalizeDeviceProfile,
  reconcileDeviceCollections,
  getRequestedDeviceId,
  getDeviceProfileForResponse
};
