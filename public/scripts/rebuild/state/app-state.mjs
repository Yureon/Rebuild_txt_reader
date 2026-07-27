import { deviceName, stableDeviceId } from '../core/utils.mjs';
import { loadLocal, saveLocal } from '../core/storage.mjs';
import { defaultShortcuts, normalizeShortcutMap } from '../features/settings/shortcut-model.mjs';
import { normalizeFontFamilyValue } from '../features/settings/font-resources.mjs';
import { normalizeSafeViewportProfiles } from '../features/settings/functional-runtime.mjs';
import { normalizeCustomCss } from '../features/settings/custom-css-utils.mjs';
import { normalizeSiteLanguage, normalizeSiteCustomLanguages } from '../features/settings/site-language-runtime.mjs';
import { CURRENT_BUILD_ID } from '../version.mjs';

const PREPROCESS_KEYS = ['removeNoise','chapterSpacing','collapseBreaks','splitDense','dialogueBreak','paragraphOptimize','aggressive'];

let progressRuntime;
const loadProgressPersistence=()=>progressRuntime||=import('../core/progress-persistence.mjs').catch(e=>{progressRuntime=null;throw e});

const THEME_COLOR_KEYS = ['bg','surface','text','accent','readerBg','readerText'];
const DEFAULT_THEME_COLORS = { bg:'#f1ece3', surface:'#fffaf2', text:'#201a15', accent:'#7a4f2d', readerBg:'#fbf6ed', readerText:'#2a2118' };

const BUILT_IN_THEME_COLOR_MIGRATIONS = Object.freeze({
  graphite:Object.freeze({
    from:Object.freeze({ bg:'#1a1b1e', surface:'#212227', text:'#e8e0d8', accent:'#e0a060', readerBg:'#18191c', readerText:'#e0d8cc' }),
    to:Object.freeze({ bg:'#17191d', surface:'#22252b', text:'#ebe3d9', accent:'#dca05d', readerBg:'#15171a', readerText:'#e1d9ce' })
  }),
  charcoal:Object.freeze({
    from:Object.freeze({ bg:'#141516', surface:'#1e1f20', text:'#eee8df', accent:'#d99552', readerBg:'#101112', readerText:'#ded8cf' }),
    to:Object.freeze({ bg:'#121416', surface:'#1d2023', text:'#eee8df', accent:'#d99552', readerBg:'#0f1113', readerText:'#ded8cf' })
  }),
  'moss-dark':Object.freeze({
    from:Object.freeze({ bg:'#181c17', surface:'#20241d', text:'#e4e2d8', accent:'#d59a5a', readerBg:'#141811', readerText:'#d9d7cc' }),
    to:Object.freeze({ bg:'#151a16', surface:'#20261f', text:'#e5e2d8', accent:'#d29a5d', readerBg:'#121612', readerText:'#dad7cc' })
  })
});

function migrateBuiltInThemeColors(presetId, colors) {
  const migration = BUILT_IN_THEME_COLOR_MIGRATIONS[String(presetId || '')];
  if (!migration || !colors) return colors;
  const exact = THEME_COLOR_KEYS.every(key => String(colors[key] || '').toLowerCase() === migration.from[key].toLowerCase());
  return exact ? { ...migration.to } : colors;
}

function normalizeThemeColorValue(value, fallback) {
  const text = String(value || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(text)) return text;
  if (/^#[0-9a-fA-F]{3}$/.test(text)) {
    return '#' + text.slice(1).split('').map(ch => ch + ch).join('');
  }
  return fallback;
}

function normalizeThemeColors(input = null) {
  if (!input || typeof input !== 'object') return null;
  const out = {};
  THEME_COLOR_KEYS.forEach(key => { out[key] = normalizeThemeColorValue(input[key], DEFAULT_THEME_COLORS[key]); });
  return out;
}

function normalizeCustomThemes(input = []) {
  const list = Array.isArray(input) ? input : [];
  const out = [];
  const seen = new Set();
  list.slice(0, 24).forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const id = String(item.id || `custom-theme-${index + 1}`).trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
    if (!id || seen.has(id)) return;
    const colors = normalizeThemeColors(item.colors || item.themeColors || item);
    if (!colors) return;
    seen.add(id);
    out.push({
      id,
      name: String(item.name || '').trim().slice(0, 40) || '\uC774\uB984 \uC5C6\uB294 \uD14C\uB9C8',
      colors,
      updatedAt: Math.max(0, Number(item.updatedAt) || 0)
    });
  });
  return out;
}

function defaultPreprocessOptions() {
  return {
    removeNoise: false,
    chapterSpacing: true,
    collapseBreaks: false,
    splitDense: false,
    dialogueBreak: false,
    paragraphOptimize: false,
    aggressive: false
  };
}

function defaultPreprocessPresets() {
  return [
    { id: 'preset-basic', name: '\uAE30\uBCF8 \uC815\uB9AC', builtIn: true, options: defaultPreprocessOptions(), updatedAt: 0 },
    { id: 'preset-readable', name: '\uAC00\uB3C5\uC131 \uAC15\uD654', builtIn: true, options: { removeNoise:false, chapterSpacing:true, collapseBreaks:true, splitDense:true, dialogueBreak:true, paragraphOptimize:true, aggressive:false }, updatedAt: 0 },
    { id: 'preset-clean', name: '\uAD11\uACE0\u00B7\uACF5\uC9C0 \uC81C\uAC70', builtIn: true, options: { removeNoise:true, chapterSpacing:true, collapseBreaks:true, splitDense:false, dialogueBreak:false, paragraphOptimize:false, aggressive:true }, updatedAt: 0 }
  ];
}

function defaultPreprocessApplyKeys() {
  return PREPROCESS_KEYS.reduce((out, key) => { out[key] = true; return out; }, {});
}

function normalizePreprocessOptions(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  return PREPROCESS_KEYS.reduce((out, key) => { out[key] = !!src[key]; return out; }, {});
}

function normalizePreprocessApplyKeys(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const out = defaultPreprocessApplyKeys();
  PREPROCESS_KEYS.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(src, key)) out[key] = !!src[key];
  });
  if (!PREPROCESS_KEYS.some(key => out[key])) out.chapterSpacing = true;
  return out;
}

function normalizePreprocessPresets(input = []) {
  const defaults = defaultPreprocessPresets();
  const byId = new Map(defaults.map(preset => [preset.id, preset]));
  const list = Array.isArray(input) ? input : [];
  list.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const id = String(item.id || `preset-custom-${index + 1}`).trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
    if (!id) return;
    const existing = byId.get(id);
    const builtIn = !!item.builtIn && !!existing;
    byId.set(id, {
      id,
      name: builtIn ? existing.name : (String(item.name || '').trim().slice(0, 40) || '\uC774\uB984 \uC5C6\uB294 \uD504\uB9AC\uC14B'),
      builtIn,
      options: normalizePreprocessOptions(item.options || item.preprocess || {}),
      updatedAt: Math.max(0, Number(item.updatedAt) || 0)
    });
  });
  return Array.from(byId.values()).slice(0, 24);
}

const DEFAULT_PREFS = {
  themeMode: 'light',
  siteLanguage: 'auto',
  siteCustomLanguages: [],
  uiFontSize: 15,
  readerFontSize: 18,
  lineHeight: 2.1,
  width: 700,
  padH: 28,
  padV: 40,
  brightness: 100,
  readerBg: '#fbf6ed',
  readerText: '#2a2118',
  fontFamily: 'var(--font-rd)',
  fontFamilyShared: 'var(--font-rd)',
  fontFamilyDevice: '',
  animationsMs: 220,
  showClock: true,
  showProgress: true,
  showNetwork: true,
  safeClockPos: 'left',
  safeProgressPos: 'right',
  safeNetworkPos: 'auto',
  safeRemainingShow: false,
  safeViewportAutoFit: false,
  safeTopInsetExtra: 0,
  safeBottomInsetExtra: 0,
  safeViewportProfileId: '',
  safeViewportProfiles: [],
  clockHour12: false,
  clockAmPm: false,
  timezone: 'Asia/Seoul',
  timezoneOffset: 540,
  tapNavEnabled: true,
  tapDirection: 'vertical',
  tapScrollPercent: 90,
  tapAnim: true,
  tapSpeed: 400,
  swipeNav: true,
  swipeThreshold: 50,
  readerEpisodeBoundaryMode: 'manual',
  libraryVirtualRenderer: true,
  preprocess: defaultPreprocessOptions(),
  preprocessPresetId: 'preset-basic',
  preprocessPresetApplyKeys: defaultPreprocessApplyKeys(),
  preprocessPresets: defaultPreprocessPresets(),
  themeColors: null,
  themePresetId: 'paper',
  themeCustomThemes: [],
  readerCache: true,
  customCssShared: '',
  customCssDevice: '',
  shortcuts: defaultShortcuts()
};

function mergePrefs(base, patch) {
  const incoming = patch || {};
  const next = { ...base, ...incoming };
  delete next.readerEpisodeBoundaryOpening;
  delete next.readerEpisodeBoundaryCooldownUntil;
  next.preprocess = normalizePreprocessOptions({ ...base.preprocess, ...(incoming.preprocess || {}) });
  next.preprocessPresets = normalizePreprocessPresets(incoming.preprocessPresets || base.preprocessPresets);
  next.preprocessPresetApplyKeys = normalizePreprocessApplyKeys(incoming.preprocessPresetApplyKeys || base.preprocessPresetApplyKeys);
  const presetId = String(incoming.preprocessPresetId || base.preprocessPresetId || '').trim();
  next.preprocessPresetId = next.preprocessPresets.some(preset => preset.id === presetId) ? presetId : (next.preprocessPresets[0]?.id || 'preset-basic');
  const sharedFont = normalizeFontFamilyValue(incoming.fontFamilyShared || incoming.fontFamily || base.fontFamilyShared || base.fontFamily, 'var(--font-rd)');
  next.fontFamily = sharedFont;
  next.fontFamilyShared = sharedFont;
  next.fontFamilyDevice = normalizeFontFamilyValue(incoming.fontFamilyDevice || base.fontFamilyDevice || '', '');
  next.shortcuts = normalizeShortcutMap(incoming.shortcuts || base.shortcuts);
  const boundaryMode = String(incoming.readerEpisodeBoundaryMode ?? base.readerEpisodeBoundaryMode ?? 'manual');
  next.readerEpisodeBoundaryMode = (boundaryMode === 'scrollBeyond' || boundaryMode === 'scroll-beyond' || boundaryMode === 'scroll') ? 'scrollBeyond' : 'manual';
  delete next.libraryDndHoverOpenDelay;
  next.libraryVirtualRenderer = !!(incoming.libraryVirtualRenderer ?? base.libraryVirtualRenderer ?? false);
  next.themeColors = normalizeThemeColors(incoming.themeColors || base.themeColors) || null;
  next.themeCustomThemes = normalizeCustomThemes(incoming.themeCustomThemes || base.themeCustomThemes || []);
  next.safeViewportProfiles = normalizeSafeViewportProfiles(incoming.safeViewportProfiles || base.safeViewportProfiles || []);
  const safeProfileId = String(incoming.safeViewportProfileId || base.safeViewportProfileId || '').trim();
  next.safeViewportProfileId = next.safeViewportProfiles.some(profile => profile.id === safeProfileId) ? safeProfileId : '';
  next.customCssShared = normalizeCustomCss(incoming.customCssShared ?? base.customCssShared ?? '');
  next.customCssDevice = normalizeCustomCss(incoming.customCssDevice ?? base.customCssDevice ?? '');
  next.siteCustomLanguages = normalizeSiteCustomLanguages(incoming.siteCustomLanguages || base.siteCustomLanguages || []);
  next.siteLanguage = normalizeSiteLanguage(incoming.siteLanguage ?? base.siteLanguage ?? 'auto');
  const themePresetId = String(incoming.themePresetId || base.themePresetId || '').trim();
  next.themePresetId = themePresetId || (next.themeColors ? 'custom-current' : 'paper');
  next.themeColors = migrateBuiltInThemeColors(next.themePresetId, next.themeColors);
  if (next.themeColors) {
    next.readerBg = next.themeColors.readerBg;
    next.readerText = next.themeColors.readerText;
  }
  return next;
}

function normalizeLibraryVirtualAutoFallback(input = null) {
  const src = input && typeof input === 'object' ? input : {};
  const at = Math.max(0, Number(src.at) || 0);
  const version = String(src.version || '').slice(0, 80);
  const expired = !at || Date.now() - at > 7 * 24 * 60 * 60 * 1000;
  const buildMismatch = version !== CURRENT_BUILD_ID;
  return {
    active: !!src.active && !expired && !buildMismatch,
    reason: String(expired ? 'expired-fallback-record' : buildMismatch ? 'build-changed' : src.reason || '').slice(0, 160),
    category: String(src.category || '').slice(0, 80),
    source: String(src.source || '').slice(0, 120),
    message: String(src.message || '').slice(0, 240),
    stack: String(src.stack || '').slice(0, 2000),
    at,
    version: version || CURRENT_BUILD_ID,
    mode: String(src.mode || 'auto-full-fallback').slice(0, 80),
    pass: String(src.pass || 'v641-library-virtual-fallback-lifecycle-pass').slice(0, 120),
    expired,
    buildMismatch
  };
}

export function normalizeLibraryShelfFilters(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const normalizeList = (value, allowed = null, limit = 24) => {
    const list = Array.isArray(value) ? value : value == null || value === '' ? [] : [value];
    const out = [];
    const seen = new Set();
    for (const item of list) {
      const text = String(item || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
      if (!text || seen.has(text) || (allowed && !allowed.has(text))) continue;
      seen.add(text);
      out.push(text);
      if (out.length >= limit) break;
    }
    return out;
  };
  return {
    publicationStatuses: normalizeList(source.publicationStatuses || source.statuses || source.status, new Set(['complete','ongoing']), 4),
    authors: normalizeList(source.authors || source.author, null, 24),
    categories: normalizeList(source.categories || source.category, null, 24),
    tags: normalizeList(source.tags || source.tag, null, 40),
    groupKinds: normalizeList(source.groupKinds || source.groups || source.group, new Set(['single','series','sequence','variants']), 8)
  };
}

export function normalizeLibraryTagFacetMinCount(value = 'auto') {
  const text = String(value == null ? 'auto' : value).trim().toLowerCase();
  if (!text || text === 'auto') return 'auto';
  const number = Math.floor(Number(text));
  if (!Number.isFinite(number)) return 'auto';
  const normalized = String(Math.max(1, Math.min(50, number)));
  return new Set(['1','2','3','4','5','10']).has(normalized) ? normalized : 'auto';
}


export function normalizeUserTagName(value) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^#+/, '')
    .trim()
    .slice(0, 40);
}

export function normalizeUserTagList(input = []) {
  const out = [];
  const seen = new Set();
  for (const value of (Array.isArray(input) ? input : [])) {
    const tag = normalizeUserTagName(value);
    const key = tag.toLocaleLowerCase('ko-KR');
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= 100) break;
  }
  return out;
}

export function isSafeStateRecordKey(value = '') {
  const key = String(value || '').trim();
  return !!key && key !== '__proto__' && key !== 'prototype' && key !== 'constructor';
}

export function copySafeStateRecord(input = {}) {
  const out = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  for (const [key, value] of Object.entries(input)) {
    if (isSafeStateRecordKey(key)) out[key] = value;
  }
  return out;
}

export function mergeSafeStateRecord(target = {}, input = {}) {
  const out = target && typeof target === 'object' && !Array.isArray(target) ? target : {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  for (const [key, value] of Object.entries(input)) {
    if (isSafeStateRecordKey(key)) out[key] = value;
  }
  return out;
}

export function normalizeNovelUserTags(input = {}, allowedTags = null) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const allowed = allowedTags ? new Map(normalizeUserTagList(allowedTags).map(tag => [tag.toLocaleLowerCase('ko-KR'), tag])) : null;
  const out = {};
  let count = 0;
  for (const [rawNovelId, rawTags] of Object.entries(source)) {
    const novelId = String(rawNovelId || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200);
    if (!isSafeStateRecordKey(novelId) || !Array.isArray(rawTags)) continue;
    const tags = [];
    const seen = new Set();
    for (const value of rawTags) {
      const normalized = normalizeUserTagName(value);
      const key = normalized.toLocaleLowerCase('ko-KR');
      const tag = allowed ? allowed.get(key) : normalized;
      if (!tag || seen.has(key)) continue;
      seen.add(key);
      tags.push(tag);
      if (tags.length >= 20) break;
    }
    if (!tags.length) continue;
    out[novelId] = tags;
    count += 1;
    if (count >= 5000) break;
  }
  return out;
}

export function createState(options = {}) {
  const rawProfile = String(options.profile || 'site').toLowerCase();
  const profile = rawProfile === 'mobile' ? 'mobile' : rawProfile === 'library' ? 'library' : 'site';
  const deviceId = stableDeviceId();
  const localPrefs = loadLocal('prefs', {});
  const localProgress = loadLocal('progress', { lastRead: null, byNovel: {}, positions: {}, readMeta: {} });
  return {
    version: 'rebuild-v682',
    profile,
    deviceId,
    deviceName: deviceName(),
    serverStateHydrated: false,
    prefs: mergePrefs(DEFAULT_PREFS, localPrefs),
    defaults: DEFAULT_PREFS,
    readerEpisodeBoundaryOpening: false,
    readerEpisodeBoundaryCooldownUntil: 0,
    siteLanguages: [],
    siteLanguagesLoaded: false,
    novels: [],
    novelById: new Map(),
    libraryViewMode: ['shelf','files','explorer'].includes(loadLocal('libraryViewMode', 'shelf')) ? loadLocal('libraryViewMode', 'shelf') : 'shelf',
    libraryShelfScope: ['all', 'favorites', 'recent'].includes(loadLocal('libraryShelfScope', 'all')) ? loadLocal('libraryShelfScope', 'all') : 'all',
    libraryShelfSort: ['title', 'recent'].includes(loadLocal('libraryShelfSort', 'title')) ? loadLocal('libraryShelfSort', 'title') : 'title',
    libraryShelfItems: [],
    libraryShelfAppendFrom: -1,
    libraryShelfLoadedCount: 0,
    libraryShelfDroppedCount: 0,
    libraryShelfPrunedLastCount: 0,
    libraryShelfPrunedNovelMapCount: 0,
    libraryShelfDomLimit: 480,
    libraryShelfDensity: ['compact','default','large'].includes(loadLocal('libraryShelfDensity', 'default')) ? loadLocal('libraryShelfDensity', 'default') : 'default',
    libraryShelfNextCursor: '',
    libraryShelfTotal: 0,
    libraryShelfLoading: false,
    libraryShelfAbortController: null,
    libraryShelfCounts: {},
    libraryShelfRequestSerial: 0,
    libraryShelfAutoLoadNotBefore: 0,
    libraryShelfAutoLoadTimer: 0,
    libraryShelfAutoLoadActivitySerial: 0,
    libraryShelfAutoLoadLastRequestActivitySerial: 0,
    libraryShelfLoadedKey: '',
    libraryShelfError: '',
    libraryShelfFilters: normalizeLibraryShelfFilters(loadLocal('libraryShelfFilters', {})),
    libraryTagFacetMinCount: normalizeLibraryTagFacetMinCount(loadLocal('libraryTagFacetMinCount', 'auto')),
    libraryShelfFacets: { authors:[], categories:[], tags:[], publicationStatuses:[], groupKinds:[] },
    libraryTagFilterQuery: '',
    libraryTagRenderOffset: 0,
    libraryShelfTagSearch: { query:'', items:[], total:0, hasMore:false, loading:false, error:'' },
    libraryShelfTagPage: { nextCursor:'', hasMore:false, total:0, minCount:1, loading:false },
    libraryShelfFacetNovelTotal: 0,
    libraryShelfFacetUserTags: [],
    libraryShelfFacetsLoaded: false,
    libraryShelfFacetsLoading: false,
    libraryShelfFacetsError: '',
    libraryShelfFacetsRequest: null,
    libraryNavigationTarget: null,
    libraryNavigationPersistedUi: null,
    libraryFullCatalogRequest: null,
    libraryTreeModelCache: null,
    libraryExplorerPath: String(loadLocal('libraryExplorerPath', '') || ''),
    libraryExplorerCollapsedFolders: new Set((value => Array.isArray(value) ? value : [])(loadLocal('libraryExplorerCollapsedFolders', []))),
    libraryFullCatalogLoaded: false,
    libraryTreeNextCursor: '',
    libraryTreeTotal: 0,
    libraryTreeLoadedCount: 0,
    libraryTreeLoadingMore: false,
    libraryTreePageSize: 1000,
    libraryCatalogMode: 'shelf',
    libraryEpisodeCacheLru: [],
    libraryEpisodeCacheLimit: 12,
    expandedEpisodeNovels: new Set(loadLocal('expandedEpisodeNovels', [])),
    collapsedFolders: new Set(loadLocal('collapsedFolders', [])),
    libraryFilter: '',
    activeLibraryKey: '',
    libraryDragSource: null,
    libraryDragElement: null,
    libraryDropTargetElement: null,
    libraryDragHoverTimer: 0,
    libraryDragHoverKey: '',
    libraryLongPressTimer: 0,
    libraryLongPressPoint: null,
    librarySuppressClick: false,
    libraryVirtualRenderRaf: 0,
    libraryVirtualLastRender: null,
    libraryVirtualLastFallback: null,
    libraryVirtualRenderHistory: [],
    libraryVirtualFallbackHistory: [],
    libraryVirtualTrial: null,
    libraryVirtualTrialResult: null,
    libraryVirtualTrialHistory: [],
    libraryVirtualTrialHistoryFilter: 'all',
    libraryVirtualTrialTimer: 0,
    libraryVirtualSessionOptIn: null,
    libraryVirtualSessionOptInHistory: [],
    libraryVirtualAutoFallback: normalizeLibraryVirtualAutoFallback(loadLocal('libraryVirtualRendererAutoFallback', null)),
    libraryFilteredNovelsCache: null,
    libraryVirtualRowsCache: null,
    libraryVirtualWindowRenderCache: null,
    libraryVirtualLastRenderSkip: null,
    libraryVirtualGateCache: null,
    libraryRowHeightMeasurementLast: null,
    libraryVirtualChecklistHistory: [],
    libraryVirtualChecklistLastSnapshot: null,
    libraryVirtualChecklistLastDiff: null,
    libraryVirtualChecklistDiffFilter: 'all',
    libraryVirtualSettingsReadinessSummary: null,
    libraryVirtualLimitedOptInReadinessLast: null,
    libraryVirtualDiagnosticsLightweightLastTest: null,
    libraryVirtualFinalOptInAuditLast: null,
    libraryVirtualEvidenceFreshnessLast: null,
    libraryVirtualFinalOptInAuditFilter: 'all',
    libraryVirtualManualReviewLastBundleRef: null,
    current: null,
    loadedChunks: new Map(),
    loadingChunks: new Set(),
    chunkTextCache: new Map(),
    chunkFetchAbort: null,
    readerSessionId: 0,
    readerCoordinates: null,
    readerManifestRequest: null,
    readerCacheLastPrune: 0,
    offlineCacheCoverage: null,
    offlineDownloadStatus: null,
    offlineDownloadAbort: null,
    preprocessPreviewAbort: null,
    search: {
      query: '',
      results: [],
      activeIndex: -1,
      highlights: null,
      running: false,
      abortController: null,
      runId: 0,
      resultWindowStart: 0,
      resultScrollRaf: 0,
      resultCallbacks: null,
      remoteDismissed: false,
      remotePosition: loadLocal('searchRemotePosition', null),
      remoteClampRaf: 0,
      lastJumpAt: 0,
      stats: null,
      coveragePreview: null,
      sourceFilter: 'all',
      cacheOnly: true,
      chunkDetailExpanded: false,
      resultFilterSnapshotCache: null,
      resultFilterSnapshotSerial: 0,
      visibleIndexesCache: null,
      resultRenderSignature: '',
      lastStatsEventAt: 0,
      searchPerformancePass: 'v145-search-performance-pass',
      mobileInteractionStabilityPass: 'v146-mobile-interaction-stability-pass',
      fullSearchDiagnosticsPass: 'v150-search-full-scan-diagnostics-pass',
      resultFieldValidationPass: 'v151-search-result-field-validation-pass',
      searchResultJumpValidationPass: 'v151-search-result-jump-validation-pass',
      searchJumpUxPass: 'v152-search-jump-ux-pass',
      searchJumpFailureRecoveryPass: 'v152-search-jump-failure-recovery-pass',
      searchLiveFieldValidationPass: 'v153-search-live-field-validation-pass',
      searchSessionCleanupPass: 'v154-search-session-cleanup-pass',
      searchContextResetPass: 'v155-search-context-reset-pass',
      lastJumpValidation: null,
      lastJumpStatus: null,
      lastJumpFailure: null,
      lastJumpLiveFieldValidation: null,
      lastJumpRetryValidation: null,
      lastJumpSessionCleanup: null,
      lastSearchContextReset: null
    },
    bookmarks: loadLocal('bookmarks', []),
    favorites: new Set(loadLocal('favorites', [])),
    recents: loadLocal('recents', []),
    userTags: normalizeUserTagList(loadLocal('userTags', [])),
    novelUserTags: normalizeNovelUserTags(loadLocal('novelUserTags', {}), loadLocal('userTags', [])),
    readDataImportPreview: null,
    progress: localProgress,
    shared: null,
    device: null,
    syncPolicySummary: null,
    remoteResumeOfferKey: '',
    remoteResumeAcceptedKey: '',
    remoteResumeDismissedKey: '',
    remoteResumeNotifiedKey: '',
    knownDeviceSeenAt: loadLocal('knownDeviceSeenAt', {}),
    knownDeviceToastAt: loadLocal('knownDeviceToastAt', {}),
    serverCommLastToastAt: 0,
    readingStats: { lastRatio: null, lastTs: 0, ratioPerMs: 0 },
    sharedVersion: 0,
    deviceVersion: 0,
    refactorSafetyNetPass: 'v161-refactor-safety-net-pass',
    extractionReadinessPass: 'v161-extraction-readiness-pass',
    recoverySearchDiagnosticsExtractionPass: 'v157-recovery-search-diagnostics-extraction-pass',
    recoveryCacheDiagnosticsExtractionPass: 'v158-recovery-cache-diagnostics-extraction-pass',
    recoveryLibraryDiagnosticsExtractionPass: 'v159-recovery-library-diagnostics-extraction-pass',
    recoveryManualReviewBundleExtractionPass: 'v160-recovery-manual-review-bundle-extraction-pass',
    recoveryExportUtilsExtractionPass: 'v161-recovery-export-utils-extraction-pass',
    recoveryButtonWiringRefactorPass: 'v163-recovery-button-wiring-helper-pass',
    recoveryRuntimeRefactorPass: 'v164-recovery-runtime-context-lazy-panel-pass',
    recoverySummaryRendererRefactorPass: 'v165-recovery-summary-renderer-pass',
    recoveryPolicyChecklistRendererRefactorPass: 'v166-recovery-policy-checklist-renderer-pass',
    recoveryImportScopeRendererRefactorPass: 'v167-recovery-import-scope-renderer-pass',
    recoveryNavigationRefactorPass: 'v168-recovery-navigation-helper-pass',
    recoveryActionUiRefactorPass: 'v168-recovery-action-ui-helper-pass',
    recoveryDomSmokePanelRefactorPass: 'v168-recovery-dom-smoke-panel-pass',
    recoveryDiagnosticsPanelRefactorPass: 'v169-recovery-diagnostics-panel-renderer-pass',
    recoveryLibraryFormattersRefactorPass: 'v170-recovery-library-formatters-pass',
    recoveryLibraryVirtualReportsRefactorPass: 'v171-recovery-library-virtual-reports-pass',
    recoveryCacheManagementPanelRefactorPass: 'v172-recovery-cache-management-panel-pass',
    recoverySearchPanelRefactorPass: 'v172-recovery-search-panel-pass',
    recoveryLibraryDiagnosticsPanelRefactorPass: 'v173-recovery-library-diagnostics-panel-pass',
    recoveryModalLayerPass: 'v175-recovery-modal-layer-helper-pass',
    recoveryCacheActionsRefactorPass: 'v175-recovery-cache-actions-pass',
    recoverySearchActionsRefactorPass: 'v175-recovery-search-actions-pass',
    recoverySnapshotExportRefactorPass: 'v176-recovery-snapshot-export-pass',
    recoveryLocalMaintenanceRefactorPass: 'v176-recovery-local-maintenance-actions-pass',
    syncDeviceManagementRefactorPass: 'v177-sync-device-management-pass',
    remoteResumeRefactorPass: 'v177-remote-resume-pass',
    syncFormattersRefactorPass: 'v177-sync-formatters-pass',
    periodicDeviceSyncRefactorPass: 'v178-periodic-device-sync-pass',
    devtoolsReportControlsRefactorPass: 'v178-devtools-report-controls-pass',
    serverStateHydrationRefactorPass: 'v179-server-state-hydration-pass',
    recoveryImportActionsRefactorPass: 'v180-recovery-import-actions-pass',
    recoveryImportWritebackRefactorPass: 'v181-recovery-import-writeback-pass',
    frontendCheckSplitRefactorPass: 'v182-frontend-check-split-pass',
    frontendCheckRecoveryCenterGuardsPass: 'v183-frontend-check-recovery-center-guards-pass',
    frontendCheckExpandedSplitPass: 'v184-frontend-check-expanded-split-pass',
    libraryVirtualReportsModularPass: 'v185-library-virtual-reports-modular-pass',
    libraryVirtualReportsDiagnosticsSplitPass: 'v186-library-virtual-reports-diagnostics-split-pass',
    libraryVirtualReportsAggregatorSplitPass: 'v187-library-virtual-reports-aggregator-split-pass',
    frontendCheckLibraryVirtualGuardSplitPass: 'v188-library-virtual-guard-split-pass',
    frontendCheckReaderSearchGuardSplitPass: 'v189-reader-search-guard-split-pass',
    frontendCheckSettingsShellQualityGuardSplitPass: 'v190-settings-shell-quality-guard-split-pass',
    readDataModalRuntimeSplitPass: 'v191-read-data-modal-runtime-split-pass',
    settingsControlsRuntimeSplitPass: 'v191-settings-controls-runtime-split-pass',
    frontendCheckSplitHistoryGuardSplitPass: 'v191-frontend-check-split-history-pass',
    readDataImportSplitPass: 'v192-read-data-import-split-pass',
    safeAreaControlsSplitPass: 'v192-safe-area-controls-split-pass',
    readDataImportMergeSplitPass: 'v193-read-data-import-merge-split-pass',
    readDataPreviewSafeProfileSplitPass: 'v194-read-data-preview-safe-profile-split-pass',
    readDataPreviewFilterSplitPass: 'v195-read-data-preview-filter-split-pass',
    readDataGuardSplitPass: 'v195-read-data-guard-split-pass',
    passiveDiagnosticsSplitPass: 'v195-passive-diagnostics-split-pass',
    libraryVirtualFallbackPolicySplitPass: 'v196-library-virtual-fallback-policy-split-pass',
    cssOwnershipIndexPass: 'v196-css-ownership-index-pass',
    recoveryVirtualPassiveReportSplitPass: 'v196-recovery-virtual-passive-report-split-pass',
    libraryVirtualTrialDiagnosticsSplitPass: 'v197-library-virtual-trial-diagnostics-split-pass',
    libraryRowDiagnosticsSplitPass: 'v197-library-row-diagnostics-split-pass',
    libraryActionAuditSummarySplitPass: 'v197-library-action-audit-summary-split-pass',
    searchStatusPanelSplitPass: 'v197-search-status-panel-split-pass',
    readinessPassiveReportsSplitPass: 'v197-library-virtual-readiness-passive-reports-split-pass',
    cssOwnershipGuardPass: 'v197-css-ownership-guard-pass',
    readerCacheLayoutGuardPass: 'v197-reader-cache-layout-guard-pass',
    libraryVirtualRowInspectionSplitPass: 'v198-library-virtual-row-inspection-split-pass',
    searchRemoconUiSplitPass: 'v198-search-remocon-ui-split-pass',
    readerCacheDiagnosticsSplitPass: 'v198-reader-cache-diagnostics-split-pass',
    recoveryLibraryDiagnosticsPanelRenderersSplitPass: 'v198-recovery-library-diagnostics-panel-renderers-split-pass',
    cssOwnershipHardeningPass: 'v198-css-ownership-hardening-pass',
    libraryActionAuditDiagnosticsSplitPass: 'v199-library-action-audit-diagnostics-split-pass',
    searchStatusDetailRowsSplitPass: 'v199-search-status-detail-rows-split-pass',
    readerCachePrunePlanSplitPass: 'v199-reader-cache-prune-plan-split-pass',
    recoveryLibraryDiagnosticsSamplesSplitPass: 'v200-recovery-library-diagnostics-samples-split-pass',
    searchFilterControlsSplitPass: 'v200-search-filter-controls-split-pass',
    cssDuplicateSelectorAuditPass: 'v200-css-duplicate-selector-audit-pass',
    serverStateNormalizerSmokePass: 'v200-server-state-normalizer-smoke-pass',
    recoveryDiagnosticsCopyActionsSplitPass: 'v201-recovery-library-diagnostics-copy-actions-split-pass',
    serverStateNormalizerPureSplitPass: 'v201-server-state-normalizer-pure-split-pass',
    libraryVirtualGateDiagnosticsSplitPass: 'v201-library-virtual-gate-diagnostics-split-pass',
    searchRetryStatusSplitPass: 'v201-search-retry-status-split-pass',
    cssDuplicateSelectorGuardHardeningPass: 'v201-css-duplicate-selector-guard-hardening-pass',
    libraryPrototypeDiagnosticsSplitPass: 'v202-library-prototype-diagnostics-split-pass',
    libraryActionAuditPayloadSplitPass: 'v202-library-action-audit-payload-split-pass',
    recoveryLibraryDiagnosticsStatusRowsSplitPass: 'v202-recovery-library-diagnostics-status-rows-split-pass',
    searchStatusFormattersSplitPass: 'v202-search-status-formatters-split-pass',
    serverStateNormalizerListsSplitPass: 'v202-server-state-normalizer-lists-split-pass',
    serverStateNormalizerHelperSmokePass: 'v202-server-state-normalizer-helper-smoke-pass',
    cssDuplicateSelectorReportPass: 'v202-css-duplicate-selector-report-pass',
    libraryVirtualSessionDiagnosticsSplitPass: 'v203-library-virtual-session-diagnostics-split-pass',
    recoveryLibraryDiagnosticsPanelShellSplitPass: 'v203-recovery-library-diagnostics-panel-shell-split-pass',
    searchAnnouncementFormattersSplitPass: 'v203-search-announcement-formatters-split-pass',
    serverStateNormalizerValidationSplitPass: 'v203-server-state-normalizer-validation-split-pass',
    continuityPromptCadenceRulePass: 'v203-continuity-prompt-cadence-rule-pass',
    libraryVirtualHistoryRecordSplitPass: 'v204-library-virtual-history-record-split-pass',
    searchNavigationUiSplitPass: 'v204-search-navigation-ui-split-pass',
    serverStateNormalizerSyncMetaSplitPass: 'v204-server-state-normalizer-sync-meta-split-pass',
    recoveryLibraryDiagnosticsControlButtonsSplitPass: 'v204-recovery-library-diagnostics-control-buttons-split-pass',
    cssDuplicateSelectorAuditDocPass: 'v204-css-duplicate-selector-audit-doc-pass',
    libraryVirtualRenderCacheSplitPass: 'v205-library-virtual-render-cache-split-pass',
    searchSessionResetHelpersSplitPass: 'v205-search-session-reset-helpers-split-pass',
    recoveryLibraryDiagnosticsExportPayloadSplitPass: 'v205-recovery-library-diagnostics-export-payload-split-pass',
    serverStateNormalizerMergeSplitPass: 'v205-server-state-normalizer-merge-split-pass',
    cssAuditOwnershipDocExtensionPass: 'v205-css-audit-ownership-doc-extension-pass',
    libraryVirtualRenderReportingSplitPass: 'v206-library-virtual-render-reporting-split-pass',
    searchJumpInfoSplitPass: 'v206-search-jump-info-split-pass',
    recoveryLibraryDiagnosticsSectionAssemblySplitPass: 'v206-recovery-library-diagnostics-section-assembly-split-pass',
    serverStateNormalizerMergeDirectSmokePass: 'v206-server-state-normalizer-merge-direct-smoke-pass',
    cssDuplicateSelectorAuditTablePass: 'v206-css-duplicate-selector-audit-table-pass',
    libraryVirtualGateAuditPass: 'v207-library-virtual-gate-audit-pass',
    recoveryLibraryDiagnosticsSectionGroupsPass: 'v207-recovery-library-diagnostics-section-groups-pass',
    serverStateNormalizerDirectHelperSmokePass: 'v207-server-state-normalizer-direct-helper-smoke-pass',
    cssAuditGuardRationalePass: 'v207-css-audit-guard-rationale-pass',
    continuityPromptV207FinalPass: 'v207-continuity-prompt-final-pass',
    libraryVirtualSessionPayloadSplitPass: 'v208-library-virtual-session-payload-pass',
    libraryVirtualPrototypeWindowDiagnosticsPass: 'v208-library-virtual-prototype-window-diagnostics-pass',
    searchResultLabelsSplitPass: 'v208-search-result-labels-pass',
    libraryVirtualGateDetailPass: 'v209-library-virtual-gate-detail-pass',
    recoveryLibraryDiagnosticsCopyGroupsPass: 'v209-recovery-library-diagnostics-copy-groups-pass',
    searchFilterSummarySplitPass: 'v209-search-filter-summary-pass',
    serverStateNormalizerValidationEdgeSmokePass: 'v209-server-state-normalizer-validation-edge-smoke-pass',
    siteSidebarCloseBindingPass: 'v209-site-sidebar-close-binding-pass',
    cssAuditGuardMaintenancePass: 'v209-css-audit-guard-maintenance-pass',
    readerCacheRecordFormattersPass: 'v211-reader-cache-record-formatters-pass',
    appShellInteractionSmokePass: 'v211-app-shell-interaction-smoke-pass',
    preprocessSummaryHelperPass: 'v211-preprocess-summary-helper-pass',
    serverServiceBoundarySmokePass: 'v211-server-service-boundary-smoke-pass',
    cssServiceBoundaryAuditPass: 'v211-css-service-boundary-audit-pass',
    readerCacheUnavailableHelperPass: 'v212-reader-cache-unavailable-helper-pass',
    settingsFontChoiceCardHelperPass: 'v212-settings-font-choice-card-helper-pass',
    recoveryActionBoundarySmokePass: 'v212-recovery-action-boundary-smoke-pass',
    manualReviewBundleConstantsPass: 'v212-manual-review-bundle-constants-pass',
    serverContentPreprocessSmokePass: 'v212-server-content-preprocess-smoke-pass',
    docsLatestIndexPass: 'v212-docs-latest-index-pass',
    cssMaintenanceExpandedAuditPass: 'v212-css-maintenance-expanded-audit-pass',
    readerCacheNovelStatsHelperPass: 'v213-reader-cache-novel-stats-helper-pass',
    settingsThemeColorUtilsPass: 'v213-settings-theme-color-utils-pass',
    manualReviewReviewerSummarySectionsPass: 'v213-manual-review-reviewer-summary-sections-pass',
    serverLibraryServiceDirectSmokePass: 'v213-server-library-service-direct-smoke-pass',
    docsLatestIndexRefreshPass: 'v213-docs-latest-index-refresh-pass',
    cssOwnershipMarkerRefreshPass: 'v213-css-ownership-marker-refresh-pass',
    readerPrefetchSnapshotHelperPass: 'v213-reader-prefetch-snapshot-helper-pass',
    readerPrefetchScheduleHelperPass: 'v214-reader-prefetch-schedule-helper-pass',
    settingsThemeFileUtilsPass: 'v214-settings-theme-file-utils-pass',
    recoveryEvidencePanelRenderersPass: 'v214-library-virtual-evidence-panel-renderers-pass',
    serverFontServiceDirectSmokePass: 'v214-server-font-service-direct-smoke-pass',
    sourceLoaderGroupingHelperPass: 'v214-source-loader-grouping-helper-pass',
    cssOwnershipGuardRefreshPass: 'v214-css-ownership-guard-refresh-pass',
    docsLatestIndexV214Pass: 'v214-docs-latest-index-pass',
    themeDevtoolsStabilizationPass: 'v162-theme-devtools-stabilization-pass',
    errors: [],
    toasts: []
  };
}

export function persistPrefs(state) {
  saveLocal('prefs', state.prefs);
}

export function persistBookData(state) {
  saveLocal('bookmarks', state.bookmarks);
  saveLocal('favorites', Array.from(state.favorites));
  saveLocal('recents', state.recents);
  saveLocal('userTags', normalizeUserTagList(state.userTags));
  saveLocal('novelUserTags', normalizeNovelUserTags(state.novelUserTags, state.userTags));
}

export function persistLibraryUi(state) {
  const retained = state.libraryNavigationPersistedUi && typeof state.libraryNavigationPersistedUi === 'object'
    ? state.libraryNavigationPersistedUi
    : null;
  const shelfScope = retained?.scope ?? state.libraryShelfScope;
  const shelfSort = retained?.sort ?? state.libraryShelfSort;
  const shelfFilters = retained?.filters ?? state.libraryShelfFilters;
  saveLocal('expandedEpisodeNovels', Array.from(state.expandedEpisodeNovels));
  saveLocal('collapsedFolders', Array.from(state.collapsedFolders));
  saveLocal('libraryViewMode', ['shelf','files','explorer'].includes(state.libraryViewMode) ? state.libraryViewMode : 'shelf');
  saveLocal('libraryExplorerPath', String(state.libraryExplorerPath || ''));
  saveLocal('libraryExplorerCollapsedFolders', Array.from(state.libraryExplorerCollapsedFolders || []));
  saveLocal('libraryShelfScope', ['all', 'favorites', 'recent'].includes(shelfScope) ? shelfScope : 'all');
  saveLocal('libraryShelfSort', ['title', 'recent'].includes(shelfSort) ? shelfSort : 'title');
  saveLocal('libraryShelfFilters', normalizeLibraryShelfFilters(shelfFilters));
  saveLocal('libraryTagFacetMinCount', normalizeLibraryTagFacetMinCount(state.libraryTagFacetMinCount));
  saveLocal('libraryShelfDensity', ['compact','default','large'].includes(state.libraryShelfDensity) ? state.libraryShelfDensity : 'default');
}

export function persistProgress(state,options={}){state.progressPersistence={pass:'v612-progress-persistence-status-pass',indexedDbPending:true,updatedAt:Date.now()};const persistencePromise=loadProgressPersistence().then(({persistProgressState})=>persistProgressState(state,options)).catch(error=>{state.progressPersistence={...(state.progressPersistence||{}),localSaved:false,indexedDbPending:false,indexedDbSaved:false,indexedDbError:error?.message||String(error),updatedAt:Date.now()};return{localSaved:false,localCompacted:false,localBytes:0,idbError:error}});return{pending:true,persistencePromise}}
