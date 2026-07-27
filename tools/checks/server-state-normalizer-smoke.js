const SERVER_STATE_NORMALIZER_SMOKE_PASS = 'v200-server-state-normalizer-smoke-pass';
const SERVER_STATE_NORMALIZER_HELPER_SMOKE_PASS = 'v202-server-state-normalizer-helper-smoke-pass';
const SERVER_STATE_NORMALIZER_VALIDATION_SMOKE_PASS = 'v203-server-state-normalizer-validation-smoke-pass';
const SERVER_STATE_NORMALIZER_SYNC_META_SMOKE_PASS = 'v204-server-state-normalizer-sync-meta-smoke-pass';
const SERVER_STATE_NORMALIZER_MERGE_SMOKE_PASS = 'v205-server-state-normalizer-merge-smoke-pass';
const SERVER_STATE_NORMALIZER_MERGE_DIRECT_SMOKE_PASS = 'v206-server-state-normalizer-merge-direct-smoke-pass';
const SERVER_STATE_NORMALIZER_DIRECT_HELPER_SMOKE_PASS = 'v207-server-state-normalizer-direct-helper-smoke-pass';
const SERVER_STATE_NORMALIZER_FOCUSED_HELPER_SMOKE_PASS = 'v208-server-state-normalizer-focused-helper-smoke-pass';
const SERVER_STATE_NORMALIZER_VALIDATION_EDGE_SMOKE_PASS = 'v209-server-state-normalizer-validation-edge-smoke-pass';
const SERVER_STATE_NORMALIZER_PROGRESS_MERGE_SMOKE_PASS = 'v210-server-state-normalizer-progress-merge-smoke-pass';

function runServerStateNormalizerSmoke(normalizer) {
  if (!normalizer || typeof normalizer.normalizeUserState !== 'function') {
    throw new Error('state-normalizer smoke requires normalizeUserState');
  }
  const raw = {
    version: 1,
    unknownLegacy: { keep: true },
    syncMeta: {
      sharedUpdatedAt: '42',
      sharedVersion: '7',
      deviceUpdatedAt: { 'device-alpha-001': '100', bad: 'x' },
      deviceVersions: { 'device-alpha-001': '3' }
    },
    shared: {
      favorites: ['novel-a', 'novel-a', 'novel-b'],
      bookmarks: [{ novelId:'novel-a', episodeId:'ep-1', title:'T', pos:0.25, createdAt:'10' }],
      recents: [{ id:'novel-a', title:'Novel A', time:'11' }],
      searchHistory: ['alpha', 'beta'],
      progress: {
        lastRead: { novelId:'novel-a', episodeId:'ep-1', chunk:'2', pos:0.5, updatedAt:'15' },
        byNovel: { 'novel-a': { episodeId:'ep-1', chunk:'2', pos:0.5 } },
        positions: { 'pos-novel-a-ep-1': { chunk:'2', pos:0.5 } }
      },
      theme: { activeThemeId:'custom', themes:{ custom:{ name:'Custom', colors:{ bg:'#fff', accent:'bad\ncolor' }, customCss:'body{}' } } },
      viewerPrefs: { fontSize:'22', safeAreaProfile:'phone', unknownKey:'drop-me' },
      syncPolicy: { preferredDeviceId:'device-alpha-001', devices:[{ id:'device-alpha-001', name:'Alpha', lastSeenAt:'20' }], share:{ progress:true, theme:true } }
    },
    deviceProfiles: {
      'device-alpha-001': { collapsedFolders:['/A','/A','/B'], prefs:{ themeScope:'device', topBarVisible:false }, theme:{ activeThemeId:'default', themes:{} }, updatedAt:30 }
    }
  };
  const state = normalizer.normalizeUserState(raw);
  if (!state || state.version !== 1) throw new Error('normalized state shape invalid');
  if (!state.legacy || !state.legacy.unknownLegacy) throw new Error('legacy unknown key was not retained');
  if (normalizer.getSharedSyncUpdatedAt(state) !== 42) throw new Error('shared sync timestamp normalization changed');
  if (normalizer.getSharedSyncVersion(state) !== 7) throw new Error('shared sync version normalization changed');
  if (normalizer.getDeviceSyncUpdatedAt(state, 'device-alpha-001') !== 100) throw new Error('device sync timestamp normalization changed');
  if (!state.shared.progress.lastRead || state.shared.progress.lastRead.chunk !== 2) throw new Error('progress snapshot normalization changed');
  if (!Array.isArray(state.shared.favorites) || state.shared.favorites.length !== 2) throw new Error('favorite sanitizer changed');
  if (!state.shared.theme || state.shared.theme.activeThemeId !== 'custom') throw new Error('theme bucket sanitizer changed');
  if (!state.shared.viewerPrefs || state.shared.viewerPrefs.unknownKey !== undefined) throw new Error('viewer prefs allow-list changed');
  if (!state.deviceProfiles['device-alpha-001'] || state.deviceProfiles['device-alpha-001'].collapsedFolders.length !== 2) throw new Error('device profile sanitizer changed');
  const sharedValidation = normalizer.validateSharedState(state.shared);
  if (!sharedValidation.ok) throw new Error('normalized shared state failed validation: ' + sharedValidation.error);
  const deviceValidation = normalizer.validateDeviceState(state.deviceProfiles['device-alpha-001']);
  if (!deviceValidation.ok) throw new Error('normalized device state failed validation: ' + deviceValidation.error);
  const merged = normalizer.mergeSharedState(state.shared, { favorites:['novel-c'], progress:state.shared.progress, syncPolicy:{ share:{ progress:false } } });
  if (!merged.favorites.includes('novel-c') || merged.syncPolicy.share.progress !== false) throw new Error('shared merge policy smoke failed');
  const profile = normalizer.getDeviceProfileForResponse(state, 'device-alpha-001');
  if (!profile || !Array.isArray(profile.collapsedFolders)) throw new Error('device profile response smoke failed');
  const listHelpers = require('../../server/services/state-normalizer-lists.js');
  if (!listHelpers.STATE_NORMALIZER_LISTS_SPLIT_PASS || !String(listHelpers.STATE_NORMALIZER_LISTS_SPLIT_PASS).includes('v202')) throw new Error('state normalizer list split marker missing');
  const listBookmarks = listHelpers.sanitizeBookmarkList([{ novelId:'novel-z', chunk:'9', ratio:2, note:'ok' }, { bad:true }]);
  if (listBookmarks.length !== 1 || listBookmarks[0].ratio !== 1 || listBookmarks[0].chunk !== 9) throw new Error('list bookmark helper smoke failed');
  const listRecents = listHelpers.sanitizeRecentList([{ novelId:'novel-z', episodeId:'ep-z', title:'Recent', ts:'99' }]);
  if (listRecents.length !== 1 || listRecents[0].type !== 'episode') throw new Error('list recent helper smoke failed');
  const collapsed = listHelpers.sanitizeCollapsedFolders(['/A', '/A', '', '/B']);
  if (collapsed.length !== 2) throw new Error('collapsed folder helper smoke failed');
  const validationHelpers = require('../../server/services/state-normalizer-validation.js');
  if (!validationHelpers.STATE_NORMALIZER_VALIDATION_SPLIT_PASS || !String(validationHelpers.STATE_NORMALIZER_VALIDATION_SPLIT_PASS).includes('v203')) throw new Error('state normalizer validation split marker missing');
  if (validationHelpers.validateSharedState({ bookmarks:new Array(1001) }).ok) throw new Error('shared validation helper smoke failed');
  if (validationHelpers.validateSharedState({ favorites:'not-array' }).ok) throw new Error('shared favorites validation edge smoke failed');
  if (validationHelpers.validateSharedState({ searchHistory:new Array(101) }).ok) throw new Error('shared searchHistory validation edge smoke failed');
  if (validationHelpers.validateSharedState({ syncPolicy:{ devices:new Array(21) } }).ok) throw new Error('shared syncPolicy devices validation edge smoke failed');
  if (validationHelpers.validateSharedState({ viewerPrefs:Object.fromEntries(Array.from({ length:81 }, (_, i) => ['k' + i, i])) }).ok) throw new Error('shared viewerPrefs validation edge smoke failed');
  if (validationHelpers.validateDeviceState({ deviceId:'bad id' }).ok) throw new Error('device validation helper smoke failed');
  if (validationHelpers.validateDeviceState({ collapsedFolders:new Array(5001) }).ok) throw new Error('device collapsedFolders validation edge smoke failed');
  if (validationHelpers.validateDeviceState({ theme:{ themes:Object.fromEntries(Array.from({ length:21 }, (_, i) => ['t' + i, {}])) } }).ok) throw new Error('device theme validation edge smoke failed');
  if (validationHelpers.validateDeviceState({ prefs:Object.fromEntries(Array.from({ length:81 }, (_, i) => ['p' + i, i])) }).ok) throw new Error('device prefs validation edge smoke failed');
  const progressHelpers = require('../../server/services/state-normalizer-progress.js');
  const progressSnap = progressHelpers.normalizeProgressSnapshotInput({ novelId:'novel-h', chunk:'3', ratio:0.33 }, null, null);
  if (!progressSnap || progressSnap.chunk !== 3 || progressSnap.ratio !== 0.33) throw new Error('progress helper direct smoke failed');
  const syncHelpers = require('../../server/services/state-normalizer-sync-policy.js');

  const syncMetaHelpers = require('../../server/services/state-normalizer-sync-meta.js');
  if (!syncMetaHelpers.STATE_NORMALIZER_SYNC_META_SPLIT_PASS || !String(syncMetaHelpers.STATE_NORMALIZER_SYNC_META_SPLIT_PASS).includes('v204')) throw new Error('state normalizer sync meta split marker missing');
  const syncMeta = syncMetaHelpers.normalizeSyncMetaInput({ sharedUpdatedAt:'12', sharedVersion:'2', deviceUpdatedAt:{ 'device-helper-002':'44' }, deviceVersions:{ 'device-helper-002':'5' } });
  if (syncMeta.sharedUpdatedAt !== 12 || syncMeta.sharedVersion !== 2 || syncMeta.deviceUpdatedAt['device-helper-002'] !== 44 || syncMeta.deviceVersions['device-helper-002'] !== 5) throw new Error('sync meta helper direct smoke failed');


  const mergeHelpers = require('../../server/services/state-normalizer-merge.js');
  if (!mergeHelpers.STATE_NORMALIZER_MERGE_SPLIT_PASS || !String(mergeHelpers.STATE_NORMALIZER_MERGE_SPLIT_PASS).includes('v205')) throw new Error('state normalizer merge split marker missing');
  const mergedSharedDirect = mergeHelpers.mergeSharedStateInput(state.shared, { recents:[{ novelId:'novel-direct', title:'Direct', ts:5 }], syncPolicy:{ share:{ bookmarks:false } } }, { baseShared: normalizer.createEmptyUserState().shared, normalizeSyncPolicyInput: normalizer.normalizeSyncPolicyInput });
  if (!mergedSharedDirect.recents.length || mergedSharedDirect.syncPolicy.share.bookmarks !== false) throw new Error('merge helper shared direct smoke failed');
  const mergedDeviceDirect = mergeHelpers.mergeDeviceStateInput(state.deviceProfiles['device-alpha-001'], { collapsedFolders:['/direct','/direct'], prefs:{ searchByFilename:true } }, { normalizeDeviceProfile: normalizer.normalizeDeviceProfile });
  if (mergedDeviceDirect.collapsedFolders.length !== 1 || mergedDeviceDirect.prefs.searchByFilename !== true) throw new Error('merge helper device direct smoke failed');

  const mergedSharedThemePreserved = mergeHelpers.mergeSharedStateInput(state.shared, { theme:null, viewerPrefs:{ fontSize:'24' } }, { baseShared: normalizer.createEmptyUserState().shared, normalizeSyncPolicyInput: normalizer.normalizeSyncPolicyInput });
  if (mergedSharedThemePreserved.theme.activeThemeId !== 'custom' || String(mergedSharedThemePreserved.viewerPrefs.fontSize) !== '24') throw new Error('merge helper shared preservation direct smoke failed');
  const mergedDeviceThemeDirect = mergeHelpers.mergeDeviceStateInput(state.deviceProfiles['device-alpha-001'], { collapsedFolders:['/x','/y'], theme:{ activeThemeId:'device-custom', themes:{ 'device-custom':{ name:'D', colors:{ bg:'#000' } } } } }, { normalizeDeviceProfile: normalizer.normalizeDeviceProfile });
  if (mergedDeviceThemeDirect.collapsedFolders.length !== 2 || mergedDeviceThemeDirect.theme.activeThemeId !== 'device-custom') throw new Error('merge helper device theme direct smoke failed');


  const metaState = normalizer.createEmptyUserState();
  syncMetaHelpers.markSharedSyncUpdatedAt(metaState, 1234);
  syncMetaHelpers.markSharedSyncVersion(metaState, 9);
  syncMetaHelpers.markDeviceSyncUpdatedAt(metaState, 'device-v207', 5678);
  syncMetaHelpers.markDeviceSyncVersion(metaState, 'device-v207', 4);
  if (syncMetaHelpers.getSharedSyncUpdatedAt(metaState) !== 1234 || syncMetaHelpers.getSharedSyncVersion(metaState) !== 9) throw new Error('sync meta mark/get shared helper smoke failed');
  if (syncMetaHelpers.getDeviceSyncUpdatedAt(metaState, 'device-v207') !== 5678 || syncMetaHelpers.getDeviceSyncVersion(metaState, 'device-v207') !== 4) throw new Error('sync meta mark/get device helper smoke failed');

  const mergedSharedFallbackDirect = mergeHelpers.mergeSharedStateInput(state.shared, { progress:null, favorites:null, searchHistory:['a','a','b'] }, { baseShared: normalizer.createEmptyUserState().shared, normalizeSyncPolicyInput: normalizer.normalizeSyncPolicyInput });
  if (!mergedSharedFallbackDirect.progress.lastRead || mergedSharedFallbackDirect.searchHistory.length !== 2 || mergedSharedFallbackDirect.favorites.length !== state.shared.favorites.length) throw new Error('merge helper fallback/preservation smoke failed');
  const mergedDevicePrefsDirect = mergeHelpers.mergeDeviceStateInput(state.deviceProfiles['device-alpha-001'], { prefs:{ searchByFilename:true, settingsMainTab:'viewer' } }, { normalizeDeviceProfile: normalizer.normalizeDeviceProfile });
  if (mergedDevicePrefsDirect.prefs.searchByFilename !== true || mergedDevicePrefsDirect.prefs.settingsMainTab !== 'viewer') throw new Error('merge helper device prefs smoke failed');

  const syncPolicy = syncHelpers.normalizeSyncPolicyInput({ preferredDeviceId:'device-helper-001', devices:[{ id:'device-helper-001', name:'Helper' }], share:{ progress:false } }, { basePolicy: normalizer.createEmptyUserState().shared.syncPolicy });
  if (syncPolicy.preferredDeviceId !== 'device-helper-001' || syncPolicy.share.progress !== false) throw new Error('sync-policy helper direct smoke failed');

  const clampedProgressSnap = progressHelpers.normalizeProgressSnapshotInput({ novelId:'novel-clamp', chunk:'-3', totalChunks:'0', ratio:9, ts:-1, sourceSavedAt:-4 }, null, null);
  if (!clampedProgressSnap || clampedProgressSnap.chunk !== 1 || clampedProgressSnap.totalChunks !== 1 || clampedProgressSnap.ratio !== 1 || clampedProgressSnap.ts !== 0) throw new Error('progress clamp edge smoke failed');
  const normalizedPositions = progressHelpers.normalizeProgressStateInput({ positions:{ 'pos-novel-clamp-single':{ chunk:'-2', ratio:2, documentRatio:-1 }, invalid:{ ratio:0.5 } } });
  if (!normalizedPositions.positions['pos-novel-clamp-single'] || normalizedPositions.positions.invalid) throw new Error('progress position boundary smoke failed');
  const orderedFavorites = normalizer.sanitizeStringList(['c','b','c','a'], 10, 80);
  if (orderedFavorites.join(',') !== 'c,b,a') throw new Error('string list order preservation smoke failed');

  const themeHelpers = require('../../server/services/state-normalizer-theme.js');
  const focusedTheme = themeHelpers.sanitizeThemeBucket({ activeThemeId:'focus', themes:{ focus:{ '--reader-bg':'#111111', '--reader-text':'#eeeeee', badKey:'drop' } } });
  if (focusedTheme.activeThemeId !== 'focus' || !focusedTheme.themes.focus || focusedTheme.themes.focus['--reader-bg'] !== '#111111' || focusedTheme.themes.focus.badKey !== undefined) throw new Error('theme helper focused smoke failed');
  const focusedPrefs = themeHelpers.normalizeViewerPrefs({ fontSize:'28', lineHeight:'2.1', themeScope:'device', unknown:'drop' });
  if (String(focusedPrefs.fontSize) !== '28' || focusedPrefs.unknown !== undefined) throw new Error('viewer prefs focused smoke failed');
  const progressState = progressHelpers.normalizeProgressStateInput({ lastRead:{ novelId:'novel-focus', chunk:'4', ratio:0.8 }, byNovel:{ 'novel-focus':{ chunk:'4', ratio:0.8 } }, positions:{ 'pos-novel-focus-single':{ chunk:'5', ratio:0.9 } }, readMeta:{ 'novel-focus':{ updatedAt:'77' } } });
  if (progressState.lastRead.chunk !== 4 || progressState.byNovel['novel-focus'].ratio !== 0.8 || progressState.positions['pos-novel-focus-single'].chunk !== 5) throw new Error('progress state focused smoke failed');
  const listSearchHistory = normalizer.sanitizeStringList(['  one  ', 'two', 'one', '', 'x'.repeat(300)], 3, 10);
  if (listSearchHistory.length !== 2 || listSearchHistory[0] !== 'one' || listSearchHistory[1] !== 'two') throw new Error('string list focused smoke failed');

  return { pass: SERVER_STATE_NORMALIZER_SMOKE_PASS, helperPass: SERVER_STATE_NORMALIZER_HELPER_SMOKE_PASS, validationPass: SERVER_STATE_NORMALIZER_VALIDATION_SMOKE_PASS, syncMetaPass: SERVER_STATE_NORMALIZER_SYNC_META_SMOKE_PASS, mergePass: SERVER_STATE_NORMALIZER_MERGE_SMOKE_PASS, mergeDirectPass: SERVER_STATE_NORMALIZER_MERGE_DIRECT_SMOKE_PASS, directHelperPass: SERVER_STATE_NORMALIZER_DIRECT_HELPER_SMOKE_PASS, focusedHelperPass: SERVER_STATE_NORMALIZER_FOCUSED_HELPER_SMOKE_PASS, validationEdgePass: SERVER_STATE_NORMALIZER_VALIDATION_EDGE_SMOKE_PASS, progressMergePass: SERVER_STATE_NORMALIZER_PROGRESS_MERGE_SMOKE_PASS };
}

module.exports = {
  SERVER_STATE_NORMALIZER_SMOKE_PASS,
  SERVER_STATE_NORMALIZER_HELPER_SMOKE_PASS,
  SERVER_STATE_NORMALIZER_VALIDATION_SMOKE_PASS,
  SERVER_STATE_NORMALIZER_SYNC_META_SMOKE_PASS,
  SERVER_STATE_NORMALIZER_MERGE_SMOKE_PASS,
  SERVER_STATE_NORMALIZER_MERGE_DIRECT_SMOKE_PASS,
  SERVER_STATE_NORMALIZER_DIRECT_HELPER_SMOKE_PASS,
  SERVER_STATE_NORMALIZER_FOCUSED_HELPER_SMOKE_PASS,
  SERVER_STATE_NORMALIZER_VALIDATION_EDGE_SMOKE_PASS,
  SERVER_STATE_NORMALIZER_PROGRESS_MERGE_SMOKE_PASS,
  runServerStateNormalizerSmoke
};
