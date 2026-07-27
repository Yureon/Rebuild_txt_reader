const { ensurePlainObject, assignSafeRecord, sanitizeStringList } = require('./state-normalizer-core');
const { normalizeDevicePrefs, normalizeViewerPrefs, sanitizeThemeBucket } = require('./state-normalizer-theme');
const { normalizeProgressStateInput } = require('./state-normalizer-progress');
const { sanitizeBookmarkList, sanitizeCollapsedFolders, sanitizeRecentList, sanitizeUserTagList, sanitizeNovelUserTags } = require('./state-normalizer-lists');

const STATE_NORMALIZER_MERGE_SPLIT_PASS = 'v205-server-state-normalizer-merge-split-pass';

function mergeSharedStateInput(prevShared = {}, nextShared = {}, options = {}) {
  const baseShared = options.baseShared || {};
  const normalizeSyncPolicyInput = typeof options.normalizeSyncPolicyInput === 'function'
    ? options.normalizeSyncPolicyInput
    : (value) => value || {};
  const merged = assignSafeRecord({}, prevShared || {}, nextShared || {});

  merged.favorites = Array.isArray(nextShared.favorites) ? sanitizeStringList(nextShared.favorites, 2000, 200) : (prevShared.favorites || []);
  merged.bookmarks = Array.isArray(nextShared.bookmarks) ? sanitizeBookmarkList(nextShared.bookmarks) : (prevShared.bookmarks || []);
  merged.recents = Array.isArray(nextShared.recents) ? sanitizeRecentList(nextShared.recents) : (prevShared.recents || []);
  merged.userTags = Array.isArray(nextShared.userTags) ? sanitizeUserTagList(nextShared.userTags) : sanitizeUserTagList(prevShared.userTags || []);
  merged.novelUserTags = nextShared.novelUserTags && typeof nextShared.novelUserTags === 'object' && !Array.isArray(nextShared.novelUserTags)
    ? sanitizeNovelUserTags(nextShared.novelUserTags, merged.userTags)
    : sanitizeNovelUserTags(prevShared.novelUserTags || {}, merged.userTags);
  merged.searchHistory = Array.isArray(nextShared.searchHistory) ? sanitizeStringList(nextShared.searchHistory, 100, 160) : (prevShared.searchHistory || []);

  if (ensurePlainObject(nextShared.progress)) {
    merged.progress = normalizeProgressStateInput(nextShared.progress);
  } else {
    merged.progress = prevShared.progress || baseShared.progress || { lastRead:null, byNovel:{}, positions:{}, readMeta:{} };
  }

  if (ensurePlainObject(nextShared.theme)) {
    merged.theme = sanitizeThemeBucket(nextShared.theme);
  } else {
    merged.theme = prevShared.theme || baseShared.theme || { activeThemeId:'default', themes:{} };
  }

  if (ensurePlainObject(nextShared.viewerPrefs)) {
    merged.viewerPrefs = normalizeViewerPrefs(assignSafeRecord({}, ensurePlainObject(prevShared.viewerPrefs) ? prevShared.viewerPrefs : {}, nextShared.viewerPrefs));
  } else {
    merged.viewerPrefs = prevShared.viewerPrefs || {};
  }

  if ('lastOpenedNovelId' in nextShared) {
    merged.lastOpenedNovelId = nextShared.lastOpenedNovelId || null;
  } else {
    merged.lastOpenedNovelId = prevShared.lastOpenedNovelId || null;
  }

  if (ensurePlainObject(nextShared.syncPolicy)) {
    const nextPolicy = normalizeSyncPolicyInput(nextShared.syncPolicy);
    merged.syncPolicy = {
      preferredDeviceId: nextPolicy.preferredDeviceId || (prevShared.syncPolicy && prevShared.syncPolicy.preferredDeviceId) || null,
      devices: Array.isArray(nextPolicy.devices) && nextPolicy.devices.length ? nextPolicy.devices : ((prevShared.syncPolicy && prevShared.syncPolicy.devices) || []),
      share: Object.assign(
        {},
        baseShared.syncPolicy && ensurePlainObject(baseShared.syncPolicy.share) ? baseShared.syncPolicy.share : {},
        prevShared.syncPolicy && ensurePlainObject(prevShared.syncPolicy.share) ? prevShared.syncPolicy.share : {},
        ensurePlainObject(nextPolicy.share) ? nextPolicy.share : {}
      )
    };
  } else {
    merged.syncPolicy = prevShared.syncPolicy || baseShared.syncPolicy || { preferredDeviceId:null, devices:[], share:{} };
  }

  return merged;
}

function mergeDeviceStateInput(prevDevice = {}, nextDevice = {}, options = {}) {
  const normalizeDeviceProfile = typeof options.normalizeDeviceProfile === 'function'
    ? options.normalizeDeviceProfile
    : (value) => value || {};
  const prevNormalized = normalizeDeviceProfile(prevDevice);
  const merged = assignSafeRecord({}, prevNormalized, nextDevice || {});

  merged.collapsedFolders = Array.isArray(nextDevice.collapsedFolders)
    ? sanitizeCollapsedFolders(nextDevice.collapsedFolders)
    : (prevNormalized.collapsedFolders || []);

  if (ensurePlainObject(nextDevice.theme)) {
    merged.theme = sanitizeThemeBucket(nextDevice.theme);
  } else {
    merged.theme = prevNormalized.theme;
  }

  if (ensurePlainObject(nextDevice.prefs)) {
    merged.prefs = normalizeDevicePrefs(nextDevice.prefs);
  } else {
    merged.prefs = prevNormalized.prefs;
  }

  merged.updatedAt = Date.now();
  return merged;
}

module.exports = {
  STATE_NORMALIZER_MERGE_SPLIT_PASS,
  mergeSharedStateInput,
  mergeDeviceStateInput
};
