const path = require('path');
const crypto = require('crypto');
const { createAsyncSafeRouter } = require('../utils/async-route');
const {
  getUserLibraryAccessFromRequest,
  filterLibraryByAccess,
  assertNovelAllowed,
  assertEpisodeAllowed
} = require('../services/library-access-service');
const { metadataProviderMatchesFilter } = require('../services/metadata-filter-service');
const {
  LIBRARY_VARIANT_GROUPING_PASS,
  LIBRARY_VARIANT_PRESENTATION_PASS,
  buildLibraryVariantPresentation
} = require('../services/library-variant-service');

const NOVELS_CONDITIONAL_CACHE_PASS = 'v434-novels-conditional-cache-pass';
const CONTENT_CHUNK_CONDITIONAL_CACHE_PASS = 'v434-content-chunk-conditional-cache-pass';
const LIBRARY_CATALOG_PERFORMANCE_PASS = 'v453-library-catalog-performance-pass';
const NOVELS_API_PAYLOAD_BUDGET_PASS = 'v453-novels-api-payload-budget-pass';
const NOVELS_API_RESPONSE_CACHE_BUDGET_PASS = 'v453-novels-api-response-cache-budget-pass';
const CONTENT_FULL_SEARCH_PERMISSION_PASS = 'v551-content-full-search-permission-pass';
const LIBRARY_SHELF_API_PASS = 'v566-library-shelf-api-pass';
const LIBRARY_SHELF_CURSOR_PASS = 'v566-library-shelf-cursor-pass';
const NOVEL_EPISODE_SUMMARY_API_PASS = 'v566-novel-episode-summary-api-pass';
const LIBRARY_SHELF_QUERY_CACHE_PASS = 'v567-library-shelf-query-cache-pass';
const CONTENT_WORKER_OVERLOAD_PASS = 'v567-content-worker-overload-pass';
const LIBRARY_SEPARATE_PAGE_PASS = 'v574-library-separate-page-pass';
const LIBRARY_TREE_API_PASS = 'v575-library-tree-api-pass';
const LIBRARY_TREE_CURSOR_PASS = 'v677-library-tree-cursor-pass';
const LIBRARY_STATE_REVISION_SPLIT_PASS = 'v677-library-state-revision-split-pass';
const LIBRARY_FOLDER_FILTER_CURSOR_PASS = 'v677-library-folder-filter-cursor-pass';
const LIBRARY_SHELF_FILTERS_PASS = 'v575-library-shelf-filters-pass';
const LIBRARY_SHELF_TAG_PAGE_PASS = 'v602-library-shelf-tag-page-pass';
const LIBRARY_SHELF_TAG_CURSOR_PASS = 'v602-library-shelf-tag-cursor-pass';
const LIBRARY_SHELF_FOCUS_PASS = 'v575-library-shelf-focus-pass';
const LIBRARY_SHELF_STABILITY_PASS = 'v646-library-shelf-stability-pass';
const LIBRARY_SHELF_HOT_PATH_PASS = 'v673-library-shelf-hot-path-pass';

function sendAclFailure(res, auth) {
  return res.status(auth && auth.status || 403).json({
    ok: false,
    error: auth && auth.error || 'library_access_denied',
    message: auth && auth.error === 'reader_user_session_required'
      ? 'Reader API requires a normal user session. Owner sessions are limited to the management console.'
      : 'Library access denied for this user.'
  });
}

function sendRouteError(res, err) {
  if (err && (err.code === 'TEXT_FILE_TOO_LARGE' || Number(err.status || err.statusCode) === 413)) {
    return res.status(413).json({ ok: false, error: 'text_file_too_large', message: 'TXT 파일이 MAX_TEXT_FILE_BYTES 한도를 초과했습니다.', maxBytes: err.maxBytes || 0, size: err.size || 0, pass: err.pass || '' });
  }
  if (err && err.code === 'CONTENT_WORKER_QUEUE_FULL') {
    res.setHeader('Retry-After', String(Math.max(1, Number(err.retryAfterSeconds) || 1)));
    return res.status(503).json({ ok:false, error:'content_worker_busy', message:'대용량 TXT 처리 대기열이 가득 찼습니다. 잠시 후 다시 시도해 주세요.', pass:err.pass || CONTENT_WORKER_OVERLOAD_PASS, maxQueuedTasks:Math.max(0, Number(err.maxQueuedTasks) || 0) });
  }
  if (err && err.code === 'CONTENT_WORKER_LARGE_FILE_FAILED') {
    res.setHeader('Retry-After', String(Math.max(1, Number(err.retryAfterSeconds) || 2)));
    return res.status(503).json({ ok:false, error:'content_worker_failed', message:'대용량 TXT 처리 워커가 실패해 안전상 메인 스레드 재처리를 중단했습니다.', pass:err.pass || CONTENT_WORKER_OVERLOAD_PASS, size:Math.max(0, Number(err.size) || 0) });
  }
  if (err && (err.code === 'LIBRARY_COLD_BUILD_PENDING' || err.code === 'LIBRARY_COLD_BUILD_BACKOFF' || err.code === 'LIBRARY_COLD_BUILD_FAILED' || err.code === 'LIBRARY_SHELF_BUSY')) {
    const retryAfter = Math.max(1, Number(err.retryAfterSeconds) || 1);
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(503).json({
      ok:false,
      error:err.code === 'LIBRARY_SHELF_BUSY' ? 'library_shelf_busy' : 'library_warming',
      message:err.code === 'LIBRARY_SHELF_BUSY'
        ? '서재 요청이 몰려 현재 요청을 제한했습니다. 잠시 후 다시 시도해 주세요.'
        : ['LIBRARY_COLD_BUILD_BACKOFF','LIBRARY_COLD_BUILD_FAILED'].includes(err.code)
          ? '서재 저장소 연결이 불안정해 반복 전체 스캔을 잠시 중단했습니다. 마지막 정상 목록을 복구하거나 잠시 후 다시 시도해 주세요.'
          : '서재 색인을 준비하고 있습니다. 잠시 후 다시 시도해 주세요.',
      retryAfterSeconds:retryAfter,
      pass:err.pass || LIBRARY_SHELF_STABILITY_PASS
    });
  }
  if (err && (err.code === 'LIBRARY_ACCESS_DENIED' || Number(err.status || err.statusCode) === 403)) {
    return res.status(403).json({ ok: false, error: 'library_access_denied', message: 'Library access denied for this user.' });
  }
  console.error(err);
  return res.status(500).json({ error:'internal_server_error', message:'request failed' });
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const key of Object.keys(value).sort()) out[key] = stableClone(value[key]);
  return out;
}

function stableHash(value) {
  return sha256(JSON.stringify(stableClone(value)));
}

function appendVaryHeader(res, value) {
  const target = String(value || '').trim();
  if (!target) return;
  const current = res.getHeader('Vary');
  if (!current) {
    res.setHeader('Vary', target);
    return;
  }
  const parts = String(current).split(',').map(item => item.trim()).filter(Boolean);
  const lower = new Set(parts.map(item => item.toLowerCase()));
  if (!lower.has(target.toLowerCase()) && !lower.has('*')) {
    parts.push(target);
    res.setHeader('Vary', parts.join(', '));
  }
}

function clientHasMatchingEtag(req, etag) {
  const inm = String(req && req.headers && req.headers['if-none-match'] || '').trim();
  if (!inm || !etag) return false;
  const candidates = inm.split(',').map(item => item.trim());
  return candidates.includes('*') || candidates.includes(etag);
}

function buildAuthCacheScope(auth, accountService) {
  const userId = String(auth && auth.session && auth.session.userId || '__test__');
  let accessVersion = 1;
  if (accountService && typeof accountService.getUserAccessSnapshot === 'function') {
    const snapshot = accountService.getUserAccessSnapshot(userId);
    accessVersion = Math.max(1, Number(snapshot && snapshot.accessVersion || 1));
  }
  const accessSig = stableHash(auth && auth.access || {});
  return { userId, accessVersion, accessSig };
}

function buildWeakEtag(payload) {
  return 'W/"' + stableHash(payload) + '"';
}

function encodeShelfCursor(offset = 0) {
  return Buffer.from(JSON.stringify({ pass: LIBRARY_SHELF_CURSOR_PASS, offset: Math.max(0, Number(offset) || 0) }), 'utf8').toString('base64url');
}

function decodeShelfCursor(value = '') {
  if (!value) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
    if (parsed && parsed.pass === LIBRARY_SHELF_CURSOR_PASS) return Math.max(0, Number(parsed.offset) || 0);
  } catch {}
  return 0;
}

function encodeTreeCursor(offset = 0, revision = '') {
  return Buffer.from(JSON.stringify({ pass:LIBRARY_TREE_CURSOR_PASS, offset:Math.max(0, Number(offset) || 0), revision:String(revision || '').slice(0,160) }), 'utf8').toString('base64url');
}
function decodeTreeCursor(value = '') {
  if (!value) return { offset:0, revision:'', valid:false };
  try {
    const parsed = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
    if (parsed && parsed.pass === LIBRARY_TREE_CURSOR_PASS) return { offset:Math.max(0, Number(parsed.offset) || 0), revision:String(parsed.revision || ''), valid:true };
  } catch {}
  return { offset:0, revision:'', valid:false };
}
function encodeFolderFilterCursor(offset = 0, revision = '', query = '') {
  return Buffer.from(JSON.stringify({ pass:LIBRARY_FOLDER_FILTER_CURSOR_PASS, offset:Math.max(0, Number(offset) || 0), revision:String(revision || '').slice(0,160), query:String(query || '').slice(0,160) }), 'utf8').toString('base64url');
}
function decodeFolderFilterCursor(value = '') {
  if (!value) return { offset:0, revision:'', query:'', valid:false };
  try {
    const parsed = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
    if (parsed && parsed.pass === LIBRARY_FOLDER_FILTER_CURSOR_PASS) return { offset:Math.max(0, Number(parsed.offset) || 0), revision:String(parsed.revision || ''), query:String(parsed.query || ''), valid:true };
  } catch {}
  return { offset:0, revision:'', query:'', valid:false };
}

function normalizeShelfTagQuery(value) { return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, 80).toLocaleLowerCase('ko-KR'); }

function encodeShelfTagCursor(offset = 0, options = {}) {
  return Buffer.from(JSON.stringify({
    pass:LIBRARY_SHELF_TAG_CURSOR_PASS,
    offset:Math.max(0, Number(offset) || 0),
    revision:String(options.revision || '').slice(0, 160),
    minCount:Math.max(1, Math.floor(Number(options.minCount) || 1)),
    query:normalizeShelfTagQuery(options.query)
  }), 'utf8').toString('base64url');
}

function decodeShelfTagCursor(value = '') {
  if (!value) return { offset:0, revision:'', minCount:1, query:'', valid:false };
  try {
    const parsed = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
    if (parsed && parsed.pass === LIBRARY_SHELF_TAG_CURSOR_PASS) {
      return {
        offset:Math.max(0, Number(parsed.offset) || 0),
        revision:String(parsed.revision || '').slice(0, 160),
        minCount:Math.max(1, Math.floor(Number(parsed.minCount) || 1)),
        query:normalizeShelfTagQuery(parsed.query),
        valid:true
      };
    }
  } catch {}
  return { offset:0, revision:'', minCount:1, query:'', valid:false };
}

function eligibleShelfTagCount(entries = [], minCount = 1) {
  const items = Array.isArray(entries) ? entries : [];
  const threshold = Math.max(1, Math.floor(Number(minCount) || 1));
  let low = 0;
  let high = items.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const count = Math.max(0, Number(items[middle] && items[middle].count) || 0);
    if (count >= threshold) low = middle + 1;
    else high = middle;
  }
  return low;
}

function setPrivateRevalidationHeaders(res, etag) {
  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
  res.setHeader('ETag', etag);
  appendVaryHeader(res, 'Cookie');
}

function sendConditionalJson(req, res, body, etag, markerHeader, markerValue) {
  setPrivateRevalidationHeaders(res, etag);
  if (markerHeader && markerValue) res.setHeader(markerHeader, markerValue);
  if (clientHasMatchingEtag(req, etag)) return res.status(304).end();
  return res.status(200).json(body);
}

function buildNovelsEtag(body, auth, accountService, librarySignature, options = {}) {
  const scope = options.scope || buildAuthCacheScope(auth, accountService);
  const bodyHash = options.bodyHash || stableHash(body || []);
  return buildWeakEtag({
    pass: NOVELS_CONDITIONAL_CACHE_PASS,
    scope,
    librarySignature: String(librarySignature || ''),
    bodyHash
  });
}



function createRequestAbortContext(req, res) {
  const controller = new AbortController();
  let cleaned = false;
  const abort = () => {
    if (!cleaned && !controller.signal.aborted) controller.abort();
  };
  const onResponseClose = () => {
    if (!res.writableEnded) abort();
  };
  if (req && typeof req.once === 'function') req.once('aborted', abort);
  if (res && typeof res.once === 'function') res.once('close', onResponseClose);
  return {
    signal: controller.signal,
    cleanup() {
      cleaned = true;
      if (req && typeof req.off === 'function') req.off('aborted', abort);
      if (res && typeof res.off === 'function') res.off('close', onResponseClose);
    }
  };
}

function isAbortError(err) {
  return !!(err && (err.name === 'AbortError' || err.code === 'CONTENT_WORKER_TASK_ABORTED'));
}

function isSearchScanRequest(req) {
  const header = typeof req.get === 'function' ? req.get('X-Search-Scan') : '';
  const query = req && req.query ? req.query.searchScan : '';
  return String(header || query || '').trim() === '1' || String(header || query || '').toLowerCase() === 'true';
}

function isFullSearchAllowedForAuth(auth, accountService) {
  if (!auth || !auth.session) return false;
  if (auth.session.userId === '__test__') return true;
  if (accountService && typeof accountService.canUserFullSearch === 'function') return accountService.canUserFullSearch(auth.session.userId);
  const snapshot = accountService && typeof accountService.getUserAccessSnapshot === 'function' ? accountService.getUserAccessSnapshot(auth.session.userId) : null;
  return !snapshot || !snapshot.appPermissions || snapshot.appPermissions.fullSearch !== false;
}

function sendFullSearchDenied(res) {
  res.setHeader('X-Full-Search-Permission', CONTENT_FULL_SEARCH_PERMISSION_PASS);
  return res.status(403).json({ ok:false, error:'full_search_permission_denied', message:'전체검색 권한이 없습니다.', pass:CONTENT_FULL_SEARCH_PERMISSION_PASS });
}

function buildContentChunkEtag(body, auth, accountService, scope) {
  return buildWeakEtag({
    pass: CONTENT_CHUNK_CONDITIONAL_CACHE_PASS,
    scope: buildAuthCacheScope(auth, accountService),
    novelId: scope && scope.novelId || '',
    episodeId: scope && scope.episodeId || '',
    singleFile: !!(scope && scope.singleFile),
    chunkIndex: Number(scope && scope.chunkIndex || 1),
    totalChunks: Number(scope && scope.totalChunks || 1),
    fileStatSig: String(scope && scope.fileStatSig || ''),
    fileTextHash: String(scope && scope.fileTextHash || ''),
    preprocessSig: String(scope && scope.preprocessSig || ''),
    bodyHash: stableHash(body || {})
  });
}

function createNovelsRouter(options = {}) {
  const router = createAsyncSafeRouter();
  const setNoStore = options.setNoStore || (() => {});
  const libraryPath = options.libraryPath;
  const libraryService = options.libraryService;
  const contentService = options.contentService;
  const sessionStore = options.sessionStore || { getSession: () => ({ kind: 'user', userId: '__test__' }) };
  const accountService = options.accountService || { getUserLibraryAccess: () => ({ mode: 'all', folders: [] }) };
  const userStateServiceManager = options.userStateServiceManager || null;
  const metadataService = options.metadataService || null;
  const libraryContentFingerprintService = options.libraryContentFingerprintService || null;
  const libraryVariantPreferenceService = options.libraryVariantPreferenceService || null;
  const aclBypassForStructureSmoke = !options.sessionStore && !options.accountService;
  const novelsResponseCache = new Map();
  const shelfResponseCache = new Map();
  const shelfFacetResponseCache = new Map();
  const shelfFacetDatasetCache = new Map();
  const folderFacetDatasetCache = new Map();
  const authorizedLibraryCache = new WeakMap();
  const variantPresentationCache = new WeakMap();
  const variantFingerprintSchedule = new WeakMap();
  const treeCatalogCache = new WeakMap();
  const shelfFacetCache = new WeakMap();
  const NOVELS_RESPONSE_CACHE_MAX = Math.max(0, Number(options.novelsResponseCacheMax) || 128);
  const NOVELS_RESPONSE_CACHE_MAX_BYTES = Math.max(0, Number(options.novelsResponseCacheMaxBytes) || 16 * 1024 * 1024);
  const NOVELS_RESPONSE_CACHE_ENTRY_MAX_BYTES = Math.max(0, Number(options.novelsResponseCacheEntryMaxBytes) || 2 * 1024 * 1024);
  let novelsResponseCacheBytes = 0;
  const SHELF_RESPONSE_CACHE_MAX = Math.max(8, Math.min(512, Number(options.shelfResponseCacheMax) || 96));
  const SHELF_FACET_RESPONSE_CACHE_MAX = Math.max(4, Math.min(128, Number(options.shelfFacetResponseCacheMax) || 32));
  const SHELF_FACET_DATASET_CACHE_MAX = Math.max(2, Math.min(64, Number(options.shelfFacetDatasetCacheMax) || 16));
  const FOLDER_FACET_DATASET_CACHE_MAX = Math.max(2, Math.min(64, Number(options.folderFacetDatasetCacheMax) || 16));
  const LIBRARY_FINGERPRINT_ENTRY_DELAY_MS = Math.max(1000, Math.min(120000, Number(options.libraryFingerprintEntryDelayMs) || 15000));
  const LIBRARY_SHELF_BUILD_CONCURRENCY = Math.max(1, Math.min(4, Number(options.libraryShelfBuildConcurrency) || 1));
  const LIBRARY_SHELF_BUILD_MAX_PENDING = Math.max(LIBRARY_SHELF_BUILD_CONCURRENCY, Math.min(64, Number(options.libraryShelfBuildMaxPending) || 8));
  const libraryPresentationTasks = new Map();
  const libraryPresentationQueue = [];
  let libraryPresentationActive = 0;
  const libraryPresentationMetrics = { started:0, completed:0, failed:0, joined:0, rejected:0, maxPending:0 };

  function drainLibraryPresentationQueue() {
    while (libraryPresentationActive < LIBRARY_SHELF_BUILD_CONCURRENCY && libraryPresentationQueue.length) {
      const item = libraryPresentationQueue.shift();
      libraryPresentationActive += 1;
      libraryPresentationMetrics.started += 1;
      setImmediate(() => {
        Promise.resolve().then(item.task).then(value => {
          libraryPresentationMetrics.completed += 1;
          item.resolve(value);
        }, error => {
          libraryPresentationMetrics.failed += 1;
          item.reject(error);
        }).finally(() => {
          libraryPresentationActive = Math.max(0, libraryPresentationActive - 1);
          drainLibraryPresentationQueue();
        });
      });
    }
  }

  function runLibraryPresentationTask(taskKey, task) {
    const key = String(taskKey || '');
    const existing = key ? libraryPresentationTasks.get(key) : null;
    if (existing) {
      libraryPresentationMetrics.joined += 1;
      return existing;
    }
    const pending = libraryPresentationActive + libraryPresentationQueue.length;
    libraryPresentationMetrics.maxPending = Math.max(libraryPresentationMetrics.maxPending, pending);
    if (pending >= LIBRARY_SHELF_BUILD_MAX_PENDING) {
      libraryPresentationMetrics.rejected += 1;
      const error = new Error('library shelf build queue is full');
      error.code = 'LIBRARY_SHELF_BUSY';
      error.retryAfterSeconds = 1;
      error.pass = LIBRARY_SHELF_STABILITY_PASS;
      return Promise.reject(error);
    }
    let resolveTask;
    let rejectTask;
    const promise = new Promise((resolve, reject) => { resolveTask = resolve; rejectTask = reject; })
      .finally(() => { if (key && libraryPresentationTasks.get(key) === promise) libraryPresentationTasks.delete(key); });
    if (key) libraryPresentationTasks.set(key, promise);
    libraryPresentationQueue.push({ key, task, resolve:resolveTask, reject:rejectTask });
    libraryPresentationMetrics.maxPending = Math.max(libraryPresentationMetrics.maxPending, libraryPresentationActive + libraryPresentationQueue.length);
    drainLibraryPresentationQueue();
    return promise;
  }

  if (!libraryPath) throw new Error('libraryPath is required');
  if (!libraryService) throw new Error('libraryService is required');
  if (!contentService) throw new Error('contentService is required');

  function getMetadataRevision() {
    if (metadataService && typeof metadataService.getPresentationRevision === 'function') return Math.max(0, Number(metadataService.getPresentationRevision()) || 0);
    return metadataService && typeof metadataService.getRevision === 'function' ? Math.max(0, Number(metadataService.getRevision()) || 0) : 0;
  }

  function enrichNovel(novel) {
    return metadataService && typeof metadataService.enrichNovel === 'function' ? metadataService.enrichNovel(novel) : novel;
  }

  function getShelfResponseCache(cacheKey) {
    const hit = shelfResponseCache.get(cacheKey);
    if (!hit) return null;
    shelfResponseCache.delete(cacheKey);
    shelfResponseCache.set(cacheKey, hit);
    return hit;
  }

  function setShelfResponseCache(cacheKey, entry) {
    if (!cacheKey || !entry) return;
    if (shelfResponseCache.has(cacheKey)) shelfResponseCache.delete(cacheKey);
    shelfResponseCache.set(cacheKey, entry);
    while (shelfResponseCache.size > SHELF_RESPONSE_CACHE_MAX) {
      const oldest = shelfResponseCache.keys().next().value;
      if (!oldest) break;
      shelfResponseCache.delete(oldest);
    }
  }

  function getShelfFacetResponseCache(cacheKey) {
    const hit = shelfFacetResponseCache.get(cacheKey);
    if (!hit) return null;
    shelfFacetResponseCache.delete(cacheKey);
    shelfFacetResponseCache.set(cacheKey, hit);
    return hit;
  }

  function setShelfFacetResponseCache(cacheKey, entry) {
    if (!cacheKey || !entry) return;
    if (shelfFacetResponseCache.has(cacheKey)) shelfFacetResponseCache.delete(cacheKey);
    shelfFacetResponseCache.set(cacheKey, entry);
    while (shelfFacetResponseCache.size > SHELF_FACET_RESPONSE_CACHE_MAX) {
      const oldest = shelfFacetResponseCache.keys().next().value;
      if (!oldest) break;
      shelfFacetResponseCache.delete(oldest);
    }
  }

  function getShelfFacetDatasetCache(cacheKey) {
    const hit = shelfFacetDatasetCache.get(cacheKey);
    if (!hit) return null;
    shelfFacetDatasetCache.delete(cacheKey);
    shelfFacetDatasetCache.set(cacheKey, hit);
    return hit;
  }

  function setShelfFacetDatasetCache(cacheKey, entry) {
    if (!cacheKey || !entry) return;
    if (shelfFacetDatasetCache.has(cacheKey)) shelfFacetDatasetCache.delete(cacheKey);
    shelfFacetDatasetCache.set(cacheKey, entry);
    while (shelfFacetDatasetCache.size > SHELF_FACET_DATASET_CACHE_MAX) {
      const oldest = shelfFacetDatasetCache.keys().next().value;
      if (!oldest) break;
      shelfFacetDatasetCache.delete(oldest);
    }
  }

  function getFolderFacetDatasetCache(cacheKey) {
    const hit = folderFacetDatasetCache.get(cacheKey);
    if (!hit) return null;
    folderFacetDatasetCache.delete(cacheKey);
    folderFacetDatasetCache.set(cacheKey, hit);
    return hit;
  }

  function setFolderFacetDatasetCache(cacheKey, entry) {
    if (!cacheKey || !entry) return;
    if (folderFacetDatasetCache.has(cacheKey)) folderFacetDatasetCache.delete(cacheKey);
    folderFacetDatasetCache.set(cacheKey, entry);
    while (folderFacetDatasetCache.size > FOLDER_FACET_DATASET_CACHE_MAX) {
      const oldest = folderFacetDatasetCache.keys().next().value;
      if (!oldest) break;
      folderFacetDatasetCache.delete(oldest);
    }
  }

  async function getAuthorizedLibrary(req, res) {
    const auth = aclBypassForStructureSmoke ? { ok: true, session: { kind: 'user', userId: '__test__' }, access: { mode: 'all', folders: [] } } : getUserLibraryAccessFromRequest(req, { sessionStore, accountService });
    if (!auth.ok) {
      sendAclFailure(res, auth);
      return null;
    }
    const library = typeof libraryService.getLibraryCachedForRequestAsync === 'function'
      ? await libraryService.getLibraryCachedForRequestAsync()
      : typeof libraryService.getLibraryCachedAsync === 'function'
        ? await libraryService.getLibraryCachedAsync()
        : libraryService.getLibraryCached();
    libraryService.setLibraryMetaHeaders(res);
    if (!Array.isArray(library)) return { auth, library:[], filtered:[] };
    if (auth.access && auth.access.mode === 'all') return { auth, library, filtered:library };
    const accessSig = stableHash(auth.access || {});
    let byAccess = authorizedLibraryCache.get(library);
    if (!byAccess) {
      byAccess = new Map();
      authorizedLibraryCache.set(library, byAccess);
    }
    let filtered = byAccess.get(accessSig);
    if (!filtered) {
      filtered = filterLibraryByAccess(library, auth.access);
      byAccess.set(accessSig, filtered);
      while (byAccess.size > 128) byAccess.delete(byAccess.keys().next().value);
    }
    return { auth, library, filtered };
  }



  function deleteNovelsResponseCacheEntry(cacheKey) {
    if (!novelsResponseCache.has(cacheKey)) return;
    const current = novelsResponseCache.get(cacheKey);
    novelsResponseCache.delete(cacheKey);
    novelsResponseCacheBytes = Math.max(0, novelsResponseCacheBytes - Math.max(0, Number(current && current.payloadBytes) || 0));
  }

  function trimNovelsResponseCache() {
    while (novelsResponseCache.size > NOVELS_RESPONSE_CACHE_MAX || (NOVELS_RESPONSE_CACHE_MAX_BYTES > 0 && novelsResponseCacheBytes > NOVELS_RESPONSE_CACHE_MAX_BYTES)) {
      const oldestKey = novelsResponseCache.keys().next().value;
      if (!oldestKey) break;
      deleteNovelsResponseCacheEntry(oldestKey);
    }
  }

  function setNovelsResponseCacheEntry(cacheKey, entry) {
    const payloadBytes = Math.max(0, Number(entry && entry.payloadBytes) || 0);
    if (NOVELS_RESPONSE_CACHE_MAX <= 0 || NOVELS_RESPONSE_CACHE_MAX_BYTES <= 0) return 'cache-budget-disabled';
    if (NOVELS_RESPONSE_CACHE_ENTRY_MAX_BYTES > 0 && payloadBytes > NOVELS_RESPONSE_CACHE_ENTRY_MAX_BYTES) return 'entry-too-large';
    deleteNovelsResponseCacheEntry(cacheKey);
    novelsResponseCache.set(cacheKey, entry);
    novelsResponseCacheBytes += payloadBytes;
    trimNovelsResponseCache();
    return '';
  }

  function getSerializedNovelsBody(filtered, auth, librarySignature, libraryBuildCount = 0) {
    const scope = buildAuthCacheScope(auth, accountService);
    const metadataRevision = getMetadataRevision();
    const cacheKey = stableHash({ pass: LIBRARY_CATALOG_PERFORMANCE_PASS, scope, librarySignature: String(librarySignature || ''), libraryBuildCount: Number(libraryBuildCount) || 0, metadataRevision });
    const cached = novelsResponseCache.get(cacheKey);
    if (cached && Array.isArray(cached.body)) {
      deleteNovelsResponseCacheEntry(cacheKey);
      novelsResponseCache.set(cacheKey, cached);
      novelsResponseCacheBytes += Math.max(0, Number(cached.payloadBytes) || 0);
      if (libraryService && typeof libraryService.recordNovelsApiPayloadMetrics === 'function') {
        libraryService.recordNovelsApiPayloadMetrics({ cacheHit: true, serialized: false, serializeMs: 0, payloadBytes: cached.payloadBytes, novelCount: cached.body.length, responseCacheBytes: novelsResponseCacheBytes });
      }
      return { body: cached.body, bodyHash: cached.bodyHash, payloadBytes: cached.payloadBytes, scope, cacheHit: true, serializeMs: 0, responseCacheBytes: novelsResponseCacheBytes, cacheSkipped: false, cacheSkipReason: '' };
    }
    const startedAt = process.hrtime.bigint();
    const body = filtered.map(enrichNovel).map(serializeNovelMeta);
    const json = JSON.stringify(body);
    const serializeMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const payloadBytes = Buffer.byteLength(json);
    const bodyHash = sha256(json);
    const entry = { body, bodyHash, payloadBytes, createdAt: Date.now() };
    const cacheSkipReason = setNovelsResponseCacheEntry(cacheKey, entry);
    const cacheSkipped = !!cacheSkipReason;
    if (libraryService && typeof libraryService.recordNovelsApiPayloadMetrics === 'function') {
      libraryService.recordNovelsApiPayloadMetrics({ cacheHit: false, serialized: true, serializeMs, payloadBytes, novelCount: body.length, responseCacheBytes: novelsResponseCacheBytes, cacheSkipped, cacheSkipReason });
    }
    return { body, bodyHash, payloadBytes, scope, cacheHit: false, serializeMs, responseCacheBytes: novelsResponseCacheBytes, cacheSkipped, cacheSkipReason };
  }

  function serializeNovelMeta(novel) {
    return {
      id: novel.id,
      title: novel.title,
      fileName: novel.isMultiFile ? novel.title : path.basename(novel.singlePath || '', '.txt'),
      categoryPath: novel.categoryPath || '',
      category: novel.category || [],
      isMultiFile: novel.isMultiFile,
      episodeCount: novel.isMultiFile ? novel.episodes.length : 1,
      episodes: novel.isMultiFile ? novel.episodes.map(e => ({
        id: e.id,
        title: e.title,
        fileName: path.basename(e.path || '', '.txt'),
      })) : [],
      isVirtualEpisodeGroup: !!novel.isVirtualEpisodeGroup,
      episodeGroupingKind: shelfText(novel.episodeGroupingKind, 48),
      episodeGroupingPass: shelfText(novel.episodeGroupingPass, 96),
      coverUrl: shelfCoverUrl(novel.coverUrl || novel.cover || ''),
      author: shelfText(novel.author, 160),
      description: shelfText(novel.description || novel.synopsis, 500),
      genres: (Array.isArray(novel.genres) ? novel.genres : []).slice(0, 24).map(value => shelfText(value, 100)).filter(Boolean),
      tags: (Array.isArray(novel.tags) ? novel.tags : []).slice(0, 40).map(value => shelfText(value, 100)).filter(Boolean),
      userTags: (Array.isArray(novel.userTags) ? novel.userTags : []).slice(0, 20).map(value => shelfText(value, 40)).filter(Boolean),
      publicationStatus:shelfText(novel.publicationStatus, 80),
      publicationYear: Number.isFinite(Number(novel.publicationYear)) ? Number(novel.publicationYear) : null,
      metadata: novel.metadata || null
    };
  }

  function shelfText(value, maxLength = 240) {
    return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, Math.max(0, Number(maxLength) || 0));
  }

  function shelfCoverUrl(value) {
    const raw = shelfText(value, 2048);
    if (!raw) return '';
    if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
    return '';
  }

  function normalizeFacetText(value, maxLength = 160) {
    return shelfText(value, maxLength).replace(/\s+/g, ' ').trim();
  }

  function hasCompleteMarker(novel) {
    if (Array.isArray(novel && novel.variants) && novel.variants.some(item => item && item.complete)) return true;
    const source = [novel && novel.title, novel && novel.fileName, novel && novel.singlePath]
      .map(value => String(value || ''))
      .join(' ');
    return /(?:^|[\s._()\[\]-])(?:완결|완|完)(?=$|[\s._()\[\]-])/u.test(source);
  }

  function shelfGroupKind(novel) {
    if (Number(novel && novel.hiddenVariantCount) > 0 || novel && novel.isVariantGroup) return 'variants';
    if (novel && novel.isVirtualEpisodeGroup) return 'sequence';
    if (novel && novel.isMultiFile) return 'series';
    return 'single';
  }

  function deriveShelfFacets(novel) {
    const author = normalizeFacetText(novel && novel.author, 160);
    const categories = (Array.isArray(novel && novel.category) ? novel.category : String(novel && novel.categoryPath || '').split('>'))
      .map(value => normalizeFacetText(value, 120)).filter(Boolean).slice(0, 24);
    const explicitStatus = normalizeFacetText(novel && novel.publicationStatus, 80).toLocaleLowerCase('ko-KR');
    const publicationStatus = /완결|complete|completed|finished|end/.test(explicitStatus) ? 'complete' : /연재|ongoing|serial|publishing/.test(explicitStatus) ? 'ongoing' : hasCompleteMarker(novel) ? 'complete' : 'ongoing';
    const filterTags = [];
    const seenFilterTags = new Set();
    const appendFilterTags = (values, maxItems) => {
      let appended = 0;
      for (const raw of Array.isArray(values) ? values : []) {
        const value = normalizeFacetText(raw, 100);
        const key = value.toLocaleLowerCase('ko-KR');
        if (!value || seenFilterTags.has(key)) continue;
        seenFilterTags.add(key);
        filterTags.push(value);
        appended += 1;
        if (appended >= maxItems) break;
      }
    };
    // User-defined tags are a direct user contract and must never be displaced by
    // metadata/genre overflow. The remaining per-novel limits match serializers.
    appendFilterTags(novel && novel.userTags, 20);
    appendFilterTags(novel && novel.tags, 40);
    appendFilterTags(novel && novel.genres, 24);
    return {
      publicationStatus,
      author,
      categories,
      filterTags,
      groupKind: shelfGroupKind(novel)
    };
  }

  function buildTreeEpisodeSearchText(novel) {
    if (!novel || !novel.isMultiFile || !Array.isArray(novel.episodes)) return '';
    const maxChars = 32768;
    const labels = [];
    let used = 0;
    for (const item of novel.episodes) {
      const title = shelfText(item && item.title, 240);
      const fileName = shelfText(path.basename(item && item.path || '', '.txt'), 240);
      const value = title && fileName && title !== fileName ? `${title} ${fileName}` : title || fileName;
      if (!value) continue;
      const remaining = maxChars - used - (labels.length ? 1 : 0);
      if (remaining <= 0) break;
      labels.push(value.slice(0, remaining));
      used += Math.min(value.length, remaining) + (labels.length > 1 ? 1 : 0);
      if (used >= maxChars) break;
    }
    return labels.join(' ').toLocaleLowerCase('ko-KR');
  }

  function serializeTreeNovel(novel) {
    return {
      id:String(novel && novel.id || '').slice(0, 200),
      title:shelfText(novel && novel.title, 240),
      fileName:shelfText(novel && novel.isMultiFile ? novel.title : path.basename(novel && novel.singlePath || '', '.txt'), 240),
      categoryPath:shelfText(novel && novel.categoryPath, 480),
      category:(Array.isArray(novel && novel.category) ? novel.category : []).slice(0, 24).map(value => shelfText(value, 120)).filter(Boolean),
      isMultiFile:!!(novel && novel.isMultiFile),
      episodeCount:novel && novel.isMultiFile ? Math.max(0, Number((novel.episodes || []).length) || 0) : 1,
      episodes:[],
      episodesLoaded:!(novel && novel.isMultiFile),
      episodeSearchText:buildTreeEpisodeSearchText(novel),
      progressAliases:(Array.isArray(novel && novel.progressAliases) ? novel.progressAliases : [novel && novel.id]).map(value => shelfText(value, 200)).filter(Boolean),
      isVirtualEpisodeGroup:!!(novel && novel.isVirtualEpisodeGroup),
      episodeGroupingKind:shelfText(novel && novel.episodeGroupingKind, 48),
      episodeGroupingPass:shelfText(novel && novel.episodeGroupingPass, 96),
      author:shelfText(novel && novel.author, 160),
      description:shelfText(novel && (novel.description || novel.synopsis), 500),
      tags:[...(Array.isArray(novel && novel.tags) ? novel.tags : []), ...(Array.isArray(novel && novel.genres) ? novel.genres : [])].slice(0,40).map(value => shelfText(value,100)).filter(Boolean),
      userTags:(Array.isArray(novel && novel.userTags) ? novel.userTags : []).slice(0,20).map(value => shelfText(value,40)).filter(Boolean),
      coverUrl:shelfCoverUrl(novel && (novel.coverUrl || novel.cover || '')),
      metadata:novel && novel.metadata || null
    };
  }

  function getTreeCatalogSource(ctx) {
    if (ctx && ctx.auth && ctx.auth.access && ctx.auth.access.mode === 'all' && typeof libraryService.getShelfTitleCatalog === 'function') {
      const titleCatalog = libraryService.getShelfTitleCatalog();
      if (Array.isArray(titleCatalog) && titleCatalog.length === ctx.library.length) return titleCatalog;
    }
    return Array.isArray(ctx && ctx.filtered) ? ctx.filtered : [];
  }

  function getTreeCatalogPage(source, offset = 0, limit = 1000) {
    if (!Array.isArray(source)) return { items:[], bodyHash:stableHash([]), total:0, offset:0, nextOffset:0 };
    const metadataRevision = getMetadataRevision();
    const total = source.length;
    const safeOffset = Math.max(0, Math.min(total, Number(offset) || 0));
    const safeLimit = Math.max(100, Math.min(2000, Number(limit) || 1000));
    // Tree/explorer is a raw file catalog. Only the requested page is enriched
    // and serialized; card shelf variant grouping remains on its existing
    // presentation path. This prevents a tree request from duplicating all
    // 80k catalog objects in memory before sending the first page.
    const items = source.slice(safeOffset, safeOffset + safeLimit)
      .map(novel => serializeTreeNovel(enrichNovel(novel)));
    return { items, bodyHash:stableHash(items), total, offset:safeOffset, nextOffset:safeOffset + items.length, metadataRevision };
  }

  function serializeShelfNovel(novel) {
    const aliases = (Array.isArray(novel.progressAliases) ? novel.progressAliases : [novel.id])
      .map(value => String(value || '').slice(0, 200)).filter(Boolean);
    const variants = (Array.isArray(novel.variants) ? novel.variants : []).slice(0, 128).map(item => ({
      id:shelfText(item && item.id, 200),
      title:shelfText(item && item.title, 240),
      fileName:shelfText(item && item.fileName, 240),
      categoryPath:shelfText(item && item.categoryPath, 480),
      author:shelfText(item && item.author, 160),
      rangeStart:item && item.rangeStart != null && Number.isFinite(Number(item.rangeStart)) ? Number(item.rangeStart) : null,
      rangeEnd:item && item.rangeEnd != null && Number.isFinite(Number(item.rangeEnd)) ? Number(item.rangeEnd) : null,
      complete:!!(item && item.complete),
      explicitCopy:!!(item && item.explicitCopy),
      relation:shelfText(item && item.relation, 40)
    }));
    return {
      id: String(novel.id || '').slice(0, 200),
      title: shelfText(novel.title, 240),
      fileName: shelfText(novel.isMultiFile ? novel.title : path.basename(novel.singlePath || '', '.txt'), 240),
      categoryPath: shelfText(novel.categoryPath, 480),
      category: (Array.isArray(novel.category) ? novel.category : []).slice(0, 24).map(value => shelfText(value, 120)).filter(Boolean),
      isMultiFile: !!novel.isMultiFile,
      episodeCount: novel.isMultiFile ? (novel.episodes || []).length : 1,
      episodesLoaded: !novel.isMultiFile,
      isVirtualEpisodeGroup: !!novel.isVirtualEpisodeGroup,
      episodeGroupingKind: shelfText(novel.episodeGroupingKind, 48),
      episodeGroupingPass: shelfText(novel.episodeGroupingPass, 96),
      coverUrl: shelfCoverUrl(novel.coverUrl || novel.cover || ''),
      author: shelfText(novel.author, 160),
      description: shelfText(novel.description || novel.synopsis, 360),
      synopsis: shelfText(novel.synopsis || novel.description, 360),
      genres: (Array.isArray(novel.genres) ? novel.genres : []).slice(0, 24).map(value => shelfText(value, 100)).filter(Boolean),
      tags: (Array.isArray(novel.tags) ? novel.tags : []).slice(0, 40).map(value => shelfText(value, 100)).filter(Boolean),
      userTags: (Array.isArray(novel.userTags) ? novel.userTags : []).slice(0, 20).map(value => shelfText(value, 40)).filter(Boolean),
      publicationStatus:shelfText(novel.publicationStatus, 80),
      publicationYear: Number.isFinite(Number(novel.publicationYear)) ? Number(novel.publicationYear) : null,
      sourceLanguage: shelfText(novel.sourceLanguage, 24),
      metadata: novel.metadata || null,
      groupKind:shelfGroupKind(novel),
      variantGroupId:shelfText(novel.variantGroupId, 80),
      variantCount:Math.max(1, Number(novel.variantCount) || aliases.length || 1),
      hiddenVariantCount:Math.max(0, Number(novel.hiddenVariantCount) || 0),
      isVariantGroup:!!novel.isVariantGroup,
      progressAliases:aliases,
      variantMemberIds:aliases,
      variants,
      variantGroupingPass:LIBRARY_VARIANT_GROUPING_PASS
    };
  }

  function scheduleVariantFingerprintWork(filtered, enriched) {
    if (!Array.isArray(filtered) || !libraryContentFingerprintService || typeof libraryContentFingerprintService.requestLibrary !== 'function') return;
    const now = Date.now();
    const current = variantFingerprintSchedule.get(filtered);
    if (current?.timer || now - Math.max(0, Number(current?.lastRunAt) || 0) < Math.max(60000, LIBRARY_FINGERPRINT_ENTRY_DELAY_MS * 4)) return;
    const state = { timer:null, scheduledAt:now, lastRunAt:Math.max(0, Number(current?.lastRunAt) || 0) };
    state.timer = setTimeout(() => {
      state.timer = null;
      state.lastRunAt = Date.now();
      try { libraryContentFingerprintService.requestLibrary(enriched); } catch {}
    }, LIBRARY_FINGERPRINT_ENTRY_DELAY_MS);
    state.timer.unref?.();
    variantFingerprintSchedule.set(filtered, state);
  }

  function getVariantPresentation(filtered) {
    if (!Array.isArray(filtered)) return buildLibraryVariantPresentation([], { queueFingerprintWork:false });
    const metadataRevision = getMetadataRevision();
    const fingerprintRevision = libraryContentFingerprintService && typeof libraryContentFingerprintService.getRevision === 'function'
      ? libraryContentFingerprintService.getRevision()
      : 0;
    const preferenceRevision = libraryVariantPreferenceService && typeof libraryVariantPreferenceService.getRevision === 'function'
      ? libraryVariantPreferenceService.getRevision()
      : 0;
    const cached = variantPresentationCache.get(filtered);
    if (cached && cached.metadataRevision === metadataRevision && cached.fingerprintRevision === fingerprintRevision && cached.preferenceRevision === preferenceRevision) return cached.value;
    const enriched = filtered.map(enrichNovel);
    const value = buildLibraryVariantPresentation(enriched, {
      fingerprintService:libraryContentFingerprintService,
      preferenceService:libraryVariantPreferenceService,
      queueFingerprintWork:false
    });
    scheduleVariantFingerprintWork(filtered, enriched);
    value.metadataRevision = metadataRevision;
    value.fingerprintRevision = fingerprintRevision;
    value.preferenceRevision = preferenceRevision;
    variantPresentationCache.set(filtered, { metadataRevision, fingerprintRevision, preferenceRevision, value });
    return value;
  }

  function variantIdsForNovel(novel) {
    const values = Array.isArray(novel && novel.progressAliases) ? novel.progressAliases : [novel && novel.id];
    return values.map(value => String(value || '')).filter(Boolean);
  }

  function createUserTagContext(shared = {}) {
    const assignments = shared.novelUserTags && typeof shared.novelUserTags === 'object' && !Array.isArray(shared.novelUserTags) ? shared.novelUserTags : {};
    const definitions = new Map((Array.isArray(shared.userTags) ? shared.userTags : []).map(value => {
      const tag = normalizeFacetText(value, 40);
      return [tag.toLocaleLowerCase('ko-KR'), tag];
    }).filter(([key, value]) => key && value));
    return { assignments, definitions, pass:LIBRARY_SHELF_HOT_PATH_PASS };
  }

  function userTagsForNovel(context = {}, novel = {}) {
    const assignments = context.assignments && typeof context.assignments === 'object' && !Array.isArray(context.assignments) ? context.assignments : {};
    const definitions = context.definitions instanceof Map ? context.definitions : new Map();
    const out = [];
    const seen = new Set();
    for (const id of variantIdsForNovel(novel)) {
      for (const value of (Array.isArray(assignments[id]) ? assignments[id] : [])) {
        const key = normalizeFacetText(value, 40).toLocaleLowerCase('ko-KR');
        const tag = definitions.get(key);
        if (!tag || seen.has(key)) continue;
        seen.add(key);
        out.push(tag);
        if (out.length >= 20) return out;
      }
    }
    return out;
  }

  function withUserTags(novel, shared = {}, options = {}) {
    const userTagContext = options.userTagContext || createUserTagContext(shared);
    const userTags = userTagsForNovel(userTagContext, novel);
    const metadataTags = Array.isArray(novel && novel.tags) ? novel.tags : [];
    const tags = [];
    const seen = new Set();
    for (const value of [...metadataTags, ...userTags]) {
      const tag = normalizeFacetText(value, 100);
      const key = tag.toLocaleLowerCase('ko-KR');
      if (!tag || seen.has(key)) continue;
      seen.add(key);
      tags.push(tag);
      if (tags.length >= 40) break;
    }
    const shelfSearchKey = options.includeSearchKey === false ? '' : [
      String(novel && novel.shelfSearchKey || ''),
      novel && novel.title,
      novel && novel.author,
      novel && novel.description,
      novel && novel.synopsis,
      novel && novel.categoryPath,
      ...(Array.isArray(novel && novel.category) ? novel.category : []),
      ...tags,
      ...(Array.isArray(novel && novel.genres) ? novel.genres : []),
      ...userTags
    ]
      .map(value => normalizeFacetText(value, 4000))
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 32768)
      .toLocaleLowerCase('ko-KR');
    return { ...novel, tags, userTags, shelfSearchKey };
  }

  function decorateSerializedNovelWithUserTags(novel, shared = {}, userTagContext = createUserTagContext(shared)) {
    const decorated = withUserTags(novel, shared, { userTagContext, includeSearchKey:false });
    return {
      ...novel,
      tags: decorated.tags,
      userTags: decorated.userTags
    };
  }

  function getSharedStateForAuth(auth) {
    const userId = String(auth && auth.session && auth.session.userId || '');
    if (!userId || userId === '__test__' || !userStateServiceManager) return { favorites: [], recents: [], userTags: [], novelUserTags: {}, sharedVersion:0, sharedUpdatedAt:0 };
    try {
      if (typeof userStateServiceManager.readShelfStateForUserId === 'function') {
        const shelf = userStateServiceManager.readShelfStateForUserId(userId) || {};
        return {
          favorites: Array.isArray(shelf.favorites) ? shelf.favorites : [],
          recents: Array.isArray(shelf.recents) ? shelf.recents : [],
          userTags: Array.isArray(shelf.userTags) ? shelf.userTags : [],
          novelUserTags: shelf.novelUserTags && typeof shelf.novelUserTags === 'object' && !Array.isArray(shelf.novelUserTags) ? shelf.novelUserTags : {},
          sharedVersion:Math.max(0, Number(shelf.sharedVersion) || 0),
          sharedUpdatedAt:Math.max(0, Number(shelf.sharedUpdatedAt) || 0)
        };
      }
      const readState = userStateServiceManager.readNormalizedStateForUserId || userStateServiceManager.getNormalizedStateForUserId;
      if (typeof readState !== 'function') return { favorites: [], recents: [], userTags: [], novelUserTags: {}, sharedVersion:0, sharedUpdatedAt:0 };
      const normalized = readState.call(userStateServiceManager, userId);
      const shared = normalized && normalized.state && normalized.state.shared || {};
      return {
        favorites: Array.isArray(shared.favorites) ? shared.favorites : [],
        recents: Array.isArray(shared.recents) ? shared.recents : [],
        userTags: Array.isArray(shared.userTags) ? shared.userTags : [],
        novelUserTags: shared.novelUserTags && typeof shared.novelUserTags === 'object' && !Array.isArray(shared.novelUserTags) ? shared.novelUserTags : {},
        sharedVersion:Math.max(0, Number(normalized?.state && normalized.state.syncMeta && normalized.state.syncMeta.sharedVersion) || 0),
        sharedUpdatedAt:Math.max(0, Number(normalized?.state && normalized.state.syncMeta && normalized.state.syncMeta.sharedUpdatedAt) || 0)
      };
    } catch {
      return { favorites: [], recents: [], userTags: [], novelUserTags: {}, sharedVersion:0, sharedUpdatedAt:0 };
    }
  }

  function shelfStateCacheRevision(shared = {}, scope = 'all') {
    const kind = String(scope || 'all');
    if (kind === 'tree' || kind === 'facets') return stableHash({ pass:LIBRARY_STATE_REVISION_SPLIT_PASS, userTags:shared.userTags, novelUserTags:shared.novelUserTags });
    if (kind === 'favorites') return stableHash({ pass:LIBRARY_STATE_REVISION_SPLIT_PASS, favorites:shared.favorites });
    if (kind === 'recents') return stableHash({ pass:LIBRARY_STATE_REVISION_SPLIT_PASS, recents:shared.recents });
    return stableHash({ pass:LIBRARY_STATE_REVISION_SPLIT_PASS, favorites:shared.favorites, recents:shared.recents, userTags:shared.userTags, novelUserTags:shared.novelUserTags });
  }

  function normalizeQueryList(value, maxItems = 24, maxLength = 160) {
    const source = Array.isArray(value) ? value : value == null || value === '' ? [] : [value];
    return Array.from(new Set(source.map(item => normalizeFacetText(item, maxLength)).filter(Boolean))).slice(0, maxItems);
  }

  function normalizeFolderFacetPath(value) {
    return normalizeFacetText(value, 480)
      .replace(/\\/g, '/')
      .replace(/\s*>\s*/g, '/')
      .replace(/\/{2,}/g, '/')
      .replace(/^\/+|\/+$/g, '');
  }

  function folderFacetPrefixes(novel) {
    const full = normalizeFolderFacetPath(novel && novel.categoryPath);
    if (!full) return [];
    const parts = full.split('/').filter(Boolean);
    const out = [];
    let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      out.push(current);
    }
    return out.slice(0, 24);
  }

  function normalizeShelfQuery(query = {}) {
    const scope = ['all', 'favorites', 'recent'].includes(String(query.scope || '')) ? String(query.scope) : 'all';
    const search = String(query.search || query.q || query.query || '').trim().toLocaleLowerCase('ko-KR').slice(0, 160);
    const sort = ['title', 'recent'].includes(String(query.sort || '')) ? String(query.sort) : (scope === 'recent' ? 'recent' : 'title');
    const focusNovelId = shelfText(query.focusNovelId || query.focus || '', 200);
    return {
      scope,
      search,
      sort,
      focusNovelId,
      publicationStatuses:normalizeQueryList(query.publicationStatuses || query.status, 4, 32).filter(value => ['complete', 'ongoing'].includes(value)),
      authors:normalizeQueryList(query.authors || query.author, 24, 160),
      categories:normalizeQueryList(query.categories || query.category, 24, 120),
      tags:normalizeQueryList(query.tags || query.tag, 40, 100),
      groupKinds:normalizeQueryList(query.groupKinds || query.group, 8, 32).filter(value => ['single', 'series', 'sequence', 'variants'].includes(value)),
      metadataStatuses:normalizeQueryList(query.metadataStatuses || query.metadataStatus || query.metadata, 2, 16).filter(value => ['applied', 'missing'].includes(value)),
      metadataProviderIds:normalizeQueryList(query.metadataProviderIds || query.metadataProvider || query.provider, 24, 120),
      folders:normalizeQueryList(query.folders || query.folder, 24, 480).map(normalizeFolderFacetPath).filter(Boolean)
    };
  }

  function matchesShelfFacets(novel, query) {
    const facets = deriveShelfFacets(novel);
    if (query.publicationStatuses.length && !query.publicationStatuses.includes(facets.publicationStatus)) return false;
    if (query.authors.length && !query.authors.includes(facets.author)) return false;
    if (query.categories.length && !facets.categories.some(value => query.categories.includes(value))) return false;
    if (query.tags.length && !facets.filterTags.some(value => query.tags.includes(value))) return false;
    if (query.groupKinds.length && !query.groupKinds.includes(facets.groupKind)) return false;
    const metadata = novel && novel.metadata && typeof novel.metadata === 'object' ? novel.metadata : null;
    const hasMetadata = !!metadata;
    if (query.metadataStatuses.length === 1) {
      if (query.metadataStatuses[0] === 'applied' && !hasMetadata) return false;
      if (query.metadataStatuses[0] === 'missing' && hasMetadata) return false;
    }
    if (!metadataProviderMatchesFilter(metadata, query.metadataProviderIds)) return false;
    if (query.folders.length) {
      const folderPath = normalizeFolderFacetPath(novel && novel.categoryPath);
      if (!folderPath || !query.folders.some(folder => folderPath === folder || folderPath.startsWith(`${folder}/`))) return false;
    }
    return true;
  }

  function summarizeTagDistribution(entries = []) {
    const histogram = new Map();
    let totalUsage = 0;
    for (const entry of Array.isArray(entries) ? entries : []) {
      const count = Math.max(0, Math.floor(Number(entry && entry.count) || 0));
      if (count < 1) continue;
      totalUsage += count;
      histogram.set(count, (histogram.get(count) || 0) + 1);
    }
    return {
      distinct:Array.isArray(entries) ? entries.length : 0,
      totalUsage,
      histogram:Array.from(histogram, ([count, tags]) => ({ count, tags })).sort((a, b) => b.count - a.count)
    };
  }

  function getShelfFacets(items) {
    if (!Array.isArray(items)) return { facets:{ authors:[], categories:[], folders:[], tags:[], publicationStatuses:[], groupKinds:[] }, tagDistribution:{ distinct:0, totalUsage:0, histogram:[] } };
    const metadataRevision = getMetadataRevision();
    const cached = shelfFacetCache.get(items);
    if (cached && cached.metadataRevision === metadataRevision) return cached.bundle;

    const maps = {
      authors:new Map(),
      categories:new Map(),
      folders:new Map(),
      tags:new Map(),
      publicationStatuses:new Map(),
      groupKinds:new Map()
    };
    const addValues = (target, values) => {
      const countedForItem = new Set();
      for (const raw of Array.isArray(values) ? values : [values]) {
        const value = normalizeFacetText(raw, 160);
        if (!value || countedForItem.has(value)) continue;
        countedForItem.add(value);
        target.set(value, (target.get(value) || 0) + 1);
      }
    };
    for (const item of items) {
      const derived = deriveShelfFacets(item);
      addValues(maps.authors, derived.author);
      addValues(maps.categories, derived.categories);
      addValues(maps.folders, folderFacetPrefixes(item));
      addValues(maps.tags, derived.filterTags);
      addValues(maps.publicationStatuses, derived.publicationStatus);
      addValues(maps.groupKinds, derived.groupKind);
    }
    const sortedEntries = map => Array.from(map, ([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'ko', { numeric:true, sensitivity:'base' }));
    const tagEntries = sortedEntries(maps.tags);
    const folderEntries = sortedEntries(maps.folders);
    const bundle = {
      facets:{
        authors:sortedEntries(maps.authors).slice(0, 120),
        categories:sortedEntries(maps.categories).slice(0, 160),
        folders:folderEntries.slice(0, 500),
        tags:tagEntries.slice(0, 500),
        publicationStatuses:sortedEntries(maps.publicationStatuses).slice(0, 8),
        groupKinds:sortedEntries(maps.groupKinds).slice(0, 8)
      },
      tagEntries,
      folderEntries,
      tagDistribution:summarizeTagDistribution(tagEntries)
    };
    shelfFacetCache.set(items, { metadataRevision, bundle });
    return bundle;
  }

  function selectShelfNovels(filtered, auth, query = {}, selectionOptions = {}) {
    const normalizedQuery = normalizeShelfQuery(query);
    const { scope, search, sort, focusNovelId } = normalizedQuery;
    const shared = selectionOptions.shared || getSharedStateForAuth(auth);
    const userTagContext = selectionOptions.userTagContext || createUserTagContext(shared);
    const favoriteIds = new Set(shared.favorites.map(String));
    const recentOrder = new Map();
    shared.recents
      .slice()
      .sort((a, b) => (Number(b && b.ts) || 0) - (Number(a && a.ts) || 0))
      .forEach((item, index) => {
        const id = String(item && item.novelId || '');
        if (id && !recentOrder.has(id)) recentOrder.set(id, index);
      });
    const isFavoriteNovel = novel => variantIdsForNovel(novel).some(id => favoriteIds.has(id));
    const recentRankForNovel = novel => variantIdsForNovel(novel).reduce((best, id) => Math.min(best, recentOrder.get(id) ?? Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
    const isRecentNovel = novel => recentRankForNovel(novel) !== Number.MAX_SAFE_INTEGER;

    const titleCatalog = sort === 'title' && Array.isArray(selectionOptions.titleCatalog) ? selectionOptions.titleCatalog : null;
    let items = titleCatalog || filtered;
    if (scope === 'favorites') items = items.filter(isFavoriteNovel);
    if (scope === 'recent') items = items.filter(isRecentNovel);
    const needsUserTagDecoration = !!search || normalizedQuery.tags.length > 0;
    if (needsUserTagDecoration) items = items.map(novel => withUserTags(novel, shared, { userTagContext, includeSearchKey:!!search }));
    if (search) {
      items = items.filter(novel => {
        const haystack = typeof novel.shelfSearchKey === 'string'
          ? novel.shelfSearchKey
          : [novel.title, novel.author, novel.description, novel.synopsis, novel.categoryPath, ...(Array.isArray(novel.category) ? novel.category : []), ...(Array.isArray(novel.tags) ? novel.tags : []), ...(Array.isArray(novel.genres) ? novel.genres : [])].join(' ').toLocaleLowerCase('ko-KR');
        return haystack.includes(search);
      });
    }
    if (normalizedQuery.publicationStatuses.length || normalizedQuery.authors.length || normalizedQuery.categories.length || normalizedQuery.tags.length || normalizedQuery.groupKinds.length || normalizedQuery.metadataStatuses.length || normalizedQuery.metadataProviderIds.length || normalizedQuery.folders.length) {
      items = items.filter(novel => matchesShelfFacets(novel, normalizedQuery));
    }
    if (sort === 'recent') {
      items = items.slice().sort((a, b) => recentRankForNovel(a) - recentRankForNovel(b));
    } else if (!titleCatalog) {
      items = items.slice().sort((a, b) => {
        const titleCmp = String(a.title || '').localeCompare(String(b.title || ''), 'ko', { numeric: true, sensitivity: 'base' });
        if (titleCmp !== 0) return titleCmp;
        return String(a.categoryPath || '').localeCompare(String(b.categoryPath || ''), 'ko', { numeric: true, sensitivity: 'base' });
      });
    }
    let favoriteCount = 0;
    let recentCount = 0;
    for (const novel of filtered) {
      if (isFavoriteNovel(novel)) favoriteCount += 1;
      if (isRecentNovel(novel)) recentCount += 1;
    }
    const focusIndex = focusNovelId ? items.findIndex(novel => variantIdsForNovel(novel).includes(focusNovelId)) : -1;
    return { items, scope, sort, search, favoriteCount, recentCount, shared, userTagContext, focusNovelId, focusIndex, filters:normalizedQuery };
  }

  router.get('/novels/shelf', async (req, res) => {
    setNoStore(res);
    try {
      const ctx = await getAuthorizedLibrary(req, res);
      if (!ctx) return;
      const limit = Math.max(12, Math.min(100, Number(req.query && req.query.limit) || 48));
      const requestedOffset = decodeShelfCursor(req.query && req.query.cursor || '');
      const normalizedQuery = normalizeShelfQuery(req.query || {});
      const shared = getSharedStateForAuth(ctx.auth);
      const librarySignature = String(res.getHeader('X-Library-Signature') || '');
      const authScope = buildAuthCacheScope(ctx.auth, accountService);
      const metadataRevision = getMetadataRevision();
      const cacheKey = stableHash({
        pass: LIBRARY_SHELF_QUERY_CACHE_PASS,
        librarySignature,
        authScope,
        metadataRevision,
        fingerprintRevision:libraryContentFingerprintService && typeof libraryContentFingerprintService.getRevision === 'function' ? libraryContentFingerprintService.getRevision() : 0,
        preferenceRevision:libraryVariantPreferenceService && typeof libraryVariantPreferenceService.getRevision === 'function' ? libraryVariantPreferenceService.getRevision() : 0,
        sharedRevision:shelfStateCacheRevision(shared, normalizedQuery.scope === 'favorites' ? 'favorites' : normalizedQuery.scope === 'recent' ? 'recents' : 'all'),
        favoriteRevision:shelfStateCacheRevision(shared, 'favorites'),
        recentRevision:shelfStateCacheRevision(shared, 'recents'),
        tagRevision:shelfStateCacheRevision(shared, 'tree'),
        query: { ...normalizedQuery, requestedOffset, limit }
      });
      const cached = getShelfResponseCache(cacheKey);
      if (cached) {
        res.setHeader('X-Library-Shelf-Cache', 'hit');
        res.setHeader('X-Library-Shelf-Query-Cache', LIBRARY_SHELF_QUERY_CACHE_PASS);
        return sendConditionalJson(req, res, cached.body, cached.etag, 'X-Library-Shelf-Api', LIBRARY_SHELF_API_PASS);
      }

      const built = await runLibraryPresentationTask(`shelf:${cacheKey}`, () => {
        const revalidated = getShelfResponseCache(cacheKey);
        if (revalidated) return { ...revalidated, source:'joined-cache' };
        const presentation = getVariantPresentation(ctx.filtered);
        const titleCatalog = presentation.items;
        const selected = selectShelfNovels(presentation.items, ctx.auth, normalizedQuery, { shared, titleCatalog });
        const offset = requestedOffset > 0 || !selected.focusNovelId || selected.focusIndex < 0
          ? requestedOffset
          : Math.floor(selected.focusIndex / limit) * limit;
        const page = selected.items.slice(offset, offset + limit)
          .map(novel => withUserTags(novel, selected.shared, { userTagContext:selected.userTagContext, includeSearchKey:false }))
          .map(serializeShelfNovel);
        const nextOffset = offset + page.length;
        const body = {
          ok: true,
          pass: LIBRARY_SHELF_API_PASS,
          stabilityPass:LIBRARY_SHELF_STABILITY_PASS,
          hotPathPass:LIBRARY_SHELF_HOT_PATH_PASS,
          queryCachePass: LIBRARY_SHELF_QUERY_CACHE_PASS,
          variantPresentationPass:LIBRARY_VARIANT_PRESENTATION_PASS,
          hiddenVariantCount:presentation.hiddenVariantCount,
          items: page,
          total: selected.items.length,
          nextCursor: nextOffset < selected.items.length ? encodeShelfCursor(nextOffset) : '',
          scope: selected.scope,
          sort: selected.sort,
          focus:{ pass:LIBRARY_SHELF_FOCUS_PASS, requested:selected.focusNovelId || '', found:selected.focusIndex >= 0, index:selected.focusIndex, offset },
          filters:{ publicationStatuses:selected.filters.publicationStatuses, authors:selected.filters.authors, categories:selected.filters.categories, tags:selected.filters.tags, groupKinds:selected.filters.groupKinds, metadataStatuses:selected.filters.metadataStatuses, metadataProviderIds:selected.filters.metadataProviderIds, folders:selected.filters.folders },
          metadataRevision,
          counts: {
            all: presentation.items.length,
            favorites: selected.favoriteCount,
            recent: selected.recentCount
          }
        };
        const etag = buildWeakEtag({
          pass: LIBRARY_SHELF_API_PASS,
          scope: authScope,
          librarySignature,
          query: { ...selected.filters, offset, limit },
          body
        });
        setShelfResponseCache(cacheKey, { body, etag });
        return { body, etag, source:'built' };
      });
      res.setHeader('X-Library-Shelf-Cache', built.source === 'built' ? 'miss' : 'joined');
      res.setHeader('X-Library-Shelf-Stability', LIBRARY_SHELF_STABILITY_PASS);
      res.setHeader('X-Library-Shelf-Query-Cache', LIBRARY_SHELF_QUERY_CACHE_PASS);
      return sendConditionalJson(req, res, built.body, built.etag, 'X-Library-Shelf-Api', LIBRARY_SHELF_API_PASS);
    } catch (err) {
      sendRouteError(res, err);
    }
  });

  router.get('/novels/tree', async (req, res) => {
    setNoStore(res);
    try {
      const ctx = await getAuthorizedLibrary(req, res);
      if (!ctx) return;
      const librarySignature = String(res.getHeader('X-Library-Signature') || '');
      const treeRevision = stableHash({ signature:librarySignature, metadataRevision:getMetadataRevision(), fingerprintRevision:libraryContentFingerprintService && typeof libraryContentFingerprintService.getRevision === 'function' ? libraryContentFingerprintService.getRevision() : 0, preferenceRevision:libraryVariantPreferenceService && typeof libraryVariantPreferenceService.getRevision === 'function' ? libraryVariantPreferenceService.getRevision() : 0 });
      const decoded = decodeTreeCursor(req.query && req.query.cursor || '');
      const limit = Math.max(100, Math.min(2000, Number(req.query && req.query.limit) || 1000));
      const requestedFocus = shelfText(req.query && (req.query.focusNovelId || req.query.focus) || '', 200);
      let offset = decoded.valid && (!decoded.revision || decoded.revision === treeRevision) ? decoded.offset : 0;
      const treeSource = getTreeCatalogSource(ctx);
      if (!decoded.valid && requestedFocus) {
        const focusIndex = treeSource.findIndex(novel => variantIdsForNovel(novel).includes(requestedFocus));
        if (focusIndex >= 0) offset = Math.floor(focusIndex / limit) * limit;
      }
      const treeTaskKey = stableHash({ pass:LIBRARY_SHELF_STABILITY_PASS, kind:'tree-page', scope:buildAuthCacheScope(ctx.auth, accountService), signature:librarySignature, treeRevision, offset, limit });
      const catalog = await runLibraryPresentationTask(`tree:${treeTaskKey}`, () => getTreeCatalogPage(treeSource, offset, limit));
      const shared = getSharedStateForAuth(ctx.auth);
      const sharedRevision = shelfStateCacheRevision(shared, 'tree');
      const etag = buildWeakEtag({ pass:LIBRARY_TREE_API_PASS, cursorPass:LIBRARY_TREE_CURSOR_PASS, scope:buildAuthCacheScope(ctx.auth, accountService), signature:librarySignature, treeRevision, catalogBodyHash:catalog.bodyHash, sharedRevision, offset:catalog.offset, limit });
      if (clientHasMatchingEtag(req, etag)) return sendConditionalJson(req, res, null, etag, 'X-Library-Tree-Api', LIBRARY_TREE_API_PASS);
      const userTagContext = createUserTagContext(shared);
      const items = catalog.items.map(item => decorateSerializedNovelWithUserTags(item, shared, userTagContext));
      const nextCursor = catalog.nextOffset < catalog.total ? encodeTreeCursor(catalog.nextOffset, treeRevision) : '';
      const body = { ok:true, pass:LIBRARY_TREE_API_PASS, cursorPass:LIBRARY_TREE_CURSOR_PASS, stateRevisionPass:LIBRARY_STATE_REVISION_SPLIT_PASS, hotPathPass:LIBRARY_SHELF_HOT_PATH_PASS, items, total:catalog.total, offset:catalog.offset, limit, nextCursor, hasMore:!!nextCursor, partial:!!nextCursor || catalog.offset > 0 };
      return sendConditionalJson(req, res, body, etag, 'X-Library-Tree-Api', LIBRARY_TREE_API_PASS);
    } catch (err) { sendRouteError(res, err); }
  });

  function shelfFacetCacheIdentity(ctx, res, shared, metadataRevision) {
    return stableHash({
      pass:LIBRARY_SHELF_FILTERS_PASS,
      scope:buildAuthCacheScope(ctx.auth, accountService),
      signature:String(res.getHeader('X-Library-Signature') || ''),
      metadataRevision,
      sharedRevision:shelfStateCacheRevision(shared, 'facets')
    });
  }

  async function getOrBuildShelfFacetDataset(ctx, res, shared, metadataRevision) {
    const cacheKey = shelfFacetCacheIdentity(ctx, res, shared, metadataRevision);
    let dataset = getShelfFacetDatasetCache(cacheKey);
    if (!dataset) {
      dataset = await runLibraryPresentationTask(`facets:${cacheKey}`, () => {
        const revalidated = getShelfFacetDatasetCache(cacheKey);
        if (revalidated) return revalidated;
        const presentation = getVariantPresentation(ctx.filtered);
        const userTagContext = createUserTagContext(shared);
        const taggedItems = presentation.items.map(novel => withUserTags(novel, shared, { userTagContext, includeSearchKey:false }));
        const built = { total:presentation.items.length, facetBundle:getShelfFacets(taggedItems) };
        setShelfFacetDatasetCache(cacheKey, built);
        return built;
      });
    }
    return { cacheKey, dataset };
  }

  async function getOrBuildFolderFacetDataset(ctx, res) {
    const cacheKey = stableHash({
      pass:LIBRARY_FOLDER_FILTER_CURSOR_PASS,
      scope:buildAuthCacheScope(ctx.auth, accountService),
      signature:String(res.getHeader('X-Library-Signature') || '')
    });
    let dataset = getFolderFacetDatasetCache(cacheKey);
    if (!dataset) {
      dataset = await runLibraryPresentationTask(`folder-facets:${cacheKey}`, () => {
        const revalidated = getFolderFacetDatasetCache(cacheKey);
        if (revalidated) return revalidated;
        const counts = new Map();
        for (const novel of Array.isArray(ctx.filtered) ? ctx.filtered : []) {
          const unique = new Set(folderFacetPrefixes(novel));
          for (const value of unique) counts.set(value, (counts.get(value) || 0) + 1);
        }
        const entries = Array.from(counts, ([value,count]) => ({ value, count }))
          .sort((a,b) => b.count - a.count || a.value.localeCompare(b.value, 'ko', { numeric:true, sensitivity:'base' }));
        const built = { entries, totalNovels:Array.isArray(ctx.filtered) ? ctx.filtered.length : 0 };
        setFolderFacetDatasetCache(cacheKey, built);
        return built;
      });
    }
    return { cacheKey, dataset };
  }

  router.get('/novels/shelf/filters', async (req, res) => {
    setNoStore(res);
    try {
      const ctx = await getAuthorizedLibrary(req, res);
      if (!ctx) return;
      const shared = getSharedStateForAuth(ctx.auth);
      const metadataRevision = getMetadataRevision();
      const { cacheKey:facetCacheKey, dataset } = await getOrBuildShelfFacetDataset(ctx, res, shared, metadataRevision);
      const { facetBundle } = dataset;
      let body = getShelfFacetResponseCache(facetCacheKey);
      if (!body) {
        body = {
          ok:true,
          pass:LIBRARY_SHELF_FILTERS_PASS,
          metadataRevision,
          total:Math.max(0, Number(dataset.total) || 0),
          userTags:(Array.isArray(shared.userTags) ? shared.userTags : []).map(value => normalizeFacetText(value, 40)).filter(Boolean).slice(0, 100),
          facets:facetBundle.facets,
          tagDistribution:facetBundle.tagDistribution,
          folderPage:{
            loaded:facetBundle.facets.folders.length,
            total:facetBundle.folderEntries.length,
            nextCursor:facetBundle.facets.folders.length < facetBundle.folderEntries.length ? encodeFolderFilterCursor(facetBundle.facets.folders.length, facetCacheKey, '') : '',
            hasMore:facetBundle.facets.folders.length < facetBundle.folderEntries.length
          },
          tagPage:{
            loaded:facetBundle.facets.tags.length,
            total:facetBundle.tagEntries.length,
            nextCursor:facetBundle.facets.tags.length < facetBundle.tagEntries.length ? encodeShelfTagCursor(facetBundle.facets.tags.length, { revision:facetCacheKey, minCount:1 }) : '',
            hasMore:facetBundle.facets.tags.length < facetBundle.tagEntries.length
          }
        };
        setShelfFacetResponseCache(facetCacheKey, body);
        res.setHeader('X-Library-Shelf-Filters-Cache', 'miss');
      } else {
        res.setHeader('X-Library-Shelf-Filters-Cache', 'hit');
      }
      const etag = buildWeakEtag({ pass:LIBRARY_SHELF_FILTERS_PASS, scope:buildAuthCacheScope(ctx.auth, accountService), signature:String(res.getHeader('X-Library-Signature') || ''), body });
      return sendConditionalJson(req, res, body, etag, 'X-Library-Shelf-Filters', LIBRARY_SHELF_FILTERS_PASS);
    } catch (err) {
      sendRouteError(res, err);
    }
  });

  router.get('/novels/shelf/filter-folders', async (req, res) => {
    setNoStore(res);
    try {
      const ctx = await getAuthorizedLibrary(req, res);
      if (!ctx) return;
      const { cacheKey:facetCacheKey, dataset } = await getOrBuildFolderFacetDataset(ctx, res);
      const query = normalizeFolderFacetPath(req.query && (req.query.q || req.query.query) || '').toLocaleLowerCase('ko-KR');
      const selected = normalizeFolderFacetPath(req.query && req.query.selected || '');
      const decoded = decodeFolderFilterCursor(req.query && req.query.cursor || '');
      const offset = decoded.valid && decoded.revision === facetCacheKey && decoded.query === query ? decoded.offset : 0;
      const limit = Math.max(1, Math.min(500, Number(req.query && req.query.limit) || 500));
      let entries = Array.isArray(dataset.entries) ? dataset.entries : [];
      if (query) entries = entries.filter(item => String(item && item.value || '').toLocaleLowerCase('ko-KR').includes(query));
      let page = entries.slice(offset, offset + limit);
      if (selected && !page.some(item => String(item && item.value || '') === selected)) {
        const selectedEntry = (Array.isArray(dataset.entries) ? dataset.entries : []).find(item => String(item && item.value || '') === selected);
        if (selectedEntry) page = [selectedEntry, ...page].slice(0, limit);
      }
      const nextOffset = offset + Math.min(limit, Math.max(0, entries.length - offset));
      const body = { ok:true, pass:LIBRARY_FOLDER_FILTER_CURSOR_PASS, items:page, total:entries.length, nextCursor:nextOffset < entries.length ? encodeFolderFilterCursor(nextOffset, facetCacheKey, query) : '', hasMore:nextOffset < entries.length, query, selected };
      const etag = buildWeakEtag({ pass:LIBRARY_FOLDER_FILTER_CURSOR_PASS, scope:buildAuthCacheScope(ctx.auth, accountService), revision:facetCacheKey, offset, limit, query, selected, body });
      return sendConditionalJson(req, res, body, etag, 'X-Library-Folder-Filters', LIBRARY_FOLDER_FILTER_CURSOR_PASS);
    } catch (err) { sendRouteError(res, err); }
  });

  router.get('/novels/shelf/filter-tags', async (req, res) => {
    setNoStore(res);
    try {
      const ctx = await getAuthorizedLibrary(req, res);
      if (!ctx) return;
      const shared = getSharedStateForAuth(ctx.auth);
      const metadataRevision = getMetadataRevision();
      const { cacheKey:facetCacheKey, dataset } = await getOrBuildShelfFacetDataset(ctx, res, shared, metadataRevision);
      const minCount = Math.max(1, Math.min(1000000, Math.floor(Number(req.query.minCount) || 1)));
      const query = normalizeShelfTagQuery(req.query.q);
      const eligibleCount = eligibleShelfTagCount(dataset.facetBundle.tagEntries, minCount);
      const eligibleEntries = dataset.facetBundle.tagEntries.slice(0, eligibleCount);
      const matchingEntries = query
        ? eligibleEntries.filter(item => String(item && item.value || '').toLocaleLowerCase('ko-KR').includes(query))
        : eligibleEntries;
      const decodedCursor = decodeShelfTagCursor(req.query.cursor);
      const cursorMatches = decodedCursor.valid && decodedCursor.revision === facetCacheKey && decodedCursor.minCount === minCount && decodedCursor.query === query;
      const requestedOffset = cursorMatches ? decodedCursor.offset : 0;
      const offset = Math.min(matchingEntries.length, requestedOffset);
      const limit = Math.max(1, Math.min(500, Math.floor(Number(req.query.limit) || 500)));
      const items = matchingEntries.slice(offset, Math.min(matchingEntries.length, offset + limit));
      const nextOffset = offset + items.length;
      const body = {
        ok:true,
        pass:LIBRARY_SHELF_TAG_PAGE_PASS,
        minCount,
        query,
        total:matchingEntries.length,
        items,
        cursorReset:!!req.query.cursor && !cursorMatches,
        nextCursor:nextOffset < matchingEntries.length ? encodeShelfTagCursor(nextOffset, { revision:facetCacheKey, minCount, query }) : '',
        hasMore:nextOffset < matchingEntries.length
      };
      const etag = buildWeakEtag({ pass:LIBRARY_SHELF_TAG_PAGE_PASS, scope:buildAuthCacheScope(ctx.auth, accountService), signature:String(res.getHeader('X-Library-Signature') || ''), metadataRevision, facetCacheKey, minCount, query, offset, limit, body });
      return sendConditionalJson(req, res, body, etag, 'X-Library-Shelf-Tag-Page', LIBRARY_SHELF_TAG_PAGE_PASS);
    } catch (err) {
      sendRouteError(res, err);
    }
  });

  router.get('/novels/:novelId/meta', async (req, res) => {
    setNoStore(res);
    try {
      const ctx = await getAuthorizedLibrary(req, res);
      if (!ctx) return;
      const presentation = getVariantPresentation(ctx.filtered);
      const novel = presentation.byAlias.get(String(req.params.novelId || '')) || null;
      if (!novel) return res.status(404).json({ error: 'Novel not found' });
      const shared = getSharedStateForAuth(ctx.auth);
      const body = { ok:true, pass:LIBRARY_SHELF_API_PASS, variantPresentationPass:LIBRARY_VARIANT_PRESENTATION_PASS, novel:serializeShelfNovel(withUserTags(novel, shared)) };
      const etag = buildWeakEtag({ pass:LIBRARY_SHELF_API_PASS, novel:body.novel, signature:String(res.getHeader('X-Library-Signature') || '') });
      return sendConditionalJson(req, res, body, etag, 'X-Library-Shelf-Api', LIBRARY_SHELF_API_PASS);
    } catch (err) {
      sendRouteError(res, err);
    }
  });


  router.get('/novels/:novelId/variants', async (req, res) => {
    setNoStore(res);
    try {
      const ctx = await getAuthorizedLibrary(req, res);
      if (!ctx) return;
      const presentation = getVariantPresentation(ctx.filtered);
      const novel = presentation.byAlias.get(String(req.params.novelId || '')) || null;
      if (!novel) return res.status(404).json({ error:'Novel not found' });
      const serialized = serializeShelfNovel(novel);
      const body = {
        ok:true,
        pass:LIBRARY_VARIANT_PRESENTATION_PASS,
        novelId:serialized.id,
        variantGroupId:serialized.variantGroupId,
        hiddenVariantCount:serialized.hiddenVariantCount,
        variants:serialized.variants
      };
      const etag = buildWeakEtag({ pass:LIBRARY_VARIANT_PRESENTATION_PASS, body, signature:String(res.getHeader('X-Library-Signature') || '') });
      return sendConditionalJson(req, res, body, etag, 'X-Library-Variant-Presentation', LIBRARY_VARIANT_PRESENTATION_PASS);
    } catch (err) {
      sendRouteError(res, err);
    }
  });

  router.get('/novels/:novelId/episodes', async (req, res) => {
    setNoStore(res);
    try {
      const ctx = await getAuthorizedLibrary(req, res);
      if (!ctx) return;
      const novel = ctx.library.find(n => n.id === req.params.novelId);
      if (!novel) return res.status(404).json({ error: 'Novel not found' });
      assertNovelAllowed(ctx.auth.access, novel);
      const episodes = (novel.episodes || []).map(e => ({
        id: e.id,
        title: e.title,
        fileName: path.basename(e.path || '', '.txt')
      }));
      const body = { ok:true, pass:NOVEL_EPISODE_SUMMARY_API_PASS, novelId:novel.id, episodes };
      const etag = buildWeakEtag({ pass:NOVEL_EPISODE_SUMMARY_API_PASS, novelId:novel.id, episodes, signature:String(res.getHeader('X-Library-Signature') || '') });
      return sendConditionalJson(req, res, body, etag, 'X-Novel-Episode-Summary-Api', NOVEL_EPISODE_SUMMARY_API_PASS);
    } catch (err) {
      sendRouteError(res, err);
    }
  });

  router.get('/novels', async (req, res) => {
    setNoStore(res);
    try {
      const ctx = await getAuthorizedLibrary(req, res);
      if (!ctx) return;
      const librarySignature = res.getHeader('X-Library-Signature');
      const libraryBuildCount = res.getHeader('X-Library-Build-Count');
      const serialized = getSerializedNovelsBody(ctx.filtered, ctx.auth, librarySignature, libraryBuildCount);
      res.setHeader('X-Novels-Api-Performance', LIBRARY_CATALOG_PERFORMANCE_PASS);
      res.setHeader('X-Novels-Api-Payload-Budget', NOVELS_API_PAYLOAD_BUDGET_PASS);
      res.setHeader('X-Novels-Api-Response-Cache-Budget', NOVELS_API_RESPONSE_CACHE_BUDGET_PASS);
      res.setHeader('X-Novels-Api-Serialized-Bytes', String(serialized.payloadBytes || 0));
      res.setHeader('X-Novels-Api-Serialized-Ms', String(Math.round((serialized.serializeMs || 0) * 1000) / 1000));
      res.setHeader('X-Novels-Api-Response-Cache', serialized.cacheHit ? 'hit' : 'miss');
      res.setHeader('X-Novels-Api-Response-Cache-Bytes', String(serialized.responseCacheBytes || 0));
      if (serialized.cacheSkipped) res.setHeader('X-Novels-Api-Response-Cache-Skip', String(serialized.cacheSkipReason || 'skipped'));
      const etag = buildNovelsEtag(serialized.body, ctx.auth, accountService, librarySignature, { scope: serialized.scope, bodyHash: serialized.bodyHash });
      return sendConditionalJson(req, res, serialized.body, etag, 'X-Novels-Conditional-Cache', NOVELS_CONDITIONAL_CACHE_PASS);
    } catch (err) {
      sendRouteError(res, err);
    }
  });

  router.get('/novels/:novelId/content', async (req, res) => {
    setNoStore(res);
    const abortContext = createRequestAbortContext(req, res);
    try {
      const ctx = await getAuthorizedLibrary(req, res);
      if (!ctx) return;
      const novel = ctx.library.find(n => n.id === req.params.novelId);
      if (!novel) return res.status(404).json({ error: 'Not found' });
      if (novel.isMultiFile) return res.status(400).json({ error: 'Use episode endpoint' });
      assertNovelAllowed(ctx.auth.access, novel);

      const filePath = path.join(libraryPath, novel.singlePath);
      const preprocessOptions = contentService.parsePreprocessOptionsFromQuery(req.query);
      const preprocessSig = contentService.serializePreprocessOptions(preprocessOptions);
      let chunkIdx = parseInt(req.query.chunk, 10) || 1;
      const searchScan = isSearchScanRequest(req);
      if (searchScan && !isFullSearchAllowedForAuth(ctx.auth, accountService)) return sendFullSearchDenied(res);
      const chunkPayload = await contentService.getContentChunkAsync(filePath, preprocessOptions, chunkIdx, { searchScan, signal: abortContext.signal });
      if (searchScan) res.setHeader('X-Content-Search-Scan', 'v537-search-scan-content-load-mitigation-pass');
      chunkIdx = Math.max(1, Number(chunkPayload.currentChunk) || 1);
      const totalChunks = Math.max(1, Number(chunkPayload.totalChunks) || 1);

      const chunkContent = chunkPayload.content || '';
      const body = { title: novel.title, content: chunkContent, currentChunk: chunkIdx, totalChunks, formatted: true, preprocessOptions, formatStats: chunkPayload.formatStats || {} };
      const etag = buildContentChunkEtag(body, ctx.auth, accountService, {
        novelId: req.params.novelId,
        episodeId: '',
        singleFile: true,
        chunkIndex: chunkIdx,
        totalChunks,
        fileStatSig: chunkPayload.statSig,
        fileTextHash: chunkPayload.textHash,
        preprocessSig
      });
      return sendConditionalJson(req, res, body, etag, 'X-Content-Chunk-Conditional-Cache', CONTENT_CHUNK_CONDITIONAL_CACHE_PASS);
    } catch (err) {
      if (isAbortError(err) && abortContext.signal.aborted) return;
      sendRouteError(res, err);
    } finally {
      abortContext.cleanup();
    }
  });

  router.get('/novels/:novelId/episodes/:episodeId', async (req, res) => {
    setNoStore(res);
    const abortContext = createRequestAbortContext(req, res);
    try {
      const ctx = await getAuthorizedLibrary(req, res);
      if (!ctx) return;
      const novel = ctx.library.find(n => n.id === req.params.novelId);
      if (!novel) return res.status(404).json({ error: 'Novel not found' });

      const episode = (novel.episodes || []).find(e => e.id === req.params.episodeId);
      if (!episode) return res.status(404).json({ error: 'Episode not found' });
      assertEpisodeAllowed(ctx.auth.access, novel, episode);

      const filePath = path.join(libraryPath, episode.path);
      const preprocessOptions = contentService.parsePreprocessOptionsFromQuery(req.query);
      const preprocessSig = contentService.serializePreprocessOptions(preprocessOptions);
      let chunkIdx = parseInt(req.query.chunk, 10) || 1;
      const searchScan = isSearchScanRequest(req);
      if (searchScan && !isFullSearchAllowedForAuth(ctx.auth, accountService)) return sendFullSearchDenied(res);
      const chunkPayload = await contentService.getContentChunkAsync(filePath, preprocessOptions, chunkIdx, { searchScan, signal: abortContext.signal });
      if (searchScan) res.setHeader('X-Content-Search-Scan', 'v537-search-scan-content-load-mitigation-pass');
      chunkIdx = Math.max(1, Number(chunkPayload.currentChunk) || 1);
      const totalChunks = Math.max(1, Number(chunkPayload.totalChunks) || 1);

      const chunkContent = chunkPayload.content || '';
      const body = { title: episode.title, novelTitle: novel.title, content: chunkContent, currentChunk: chunkIdx, totalChunks, formatted: true, preprocessOptions, formatStats: chunkPayload.formatStats || {} };
      const etag = buildContentChunkEtag(body, ctx.auth, accountService, {
        novelId: req.params.novelId,
        episodeId: req.params.episodeId,
        singleFile: false,
        chunkIndex: chunkIdx,
        totalChunks,
        fileStatSig: chunkPayload.statSig,
        fileTextHash: chunkPayload.textHash,
        preprocessSig
      });
      return sendConditionalJson(req, res, body, etag, 'X-Content-Chunk-Conditional-Cache', CONTENT_CHUNK_CONDITIONAL_CACHE_PASS);
    } catch (err) {
      if (isAbortError(err) && abortContext.signal.aborted) return;
      sendRouteError(res, err);
    } finally {
      abortContext.cleanup();
    }
  });

  return router;
}

module.exports = {
  NOVELS_CONDITIONAL_CACHE_PASS,
  LIBRARY_CATALOG_PERFORMANCE_PASS,
  NOVELS_API_PAYLOAD_BUDGET_PASS,
  CONTENT_CHUNK_CONDITIONAL_CACHE_PASS,
  CONTENT_FULL_SEARCH_PERMISSION_PASS,
  LIBRARY_SHELF_API_PASS,
  NOVEL_EPISODE_SUMMARY_API_PASS,
  LIBRARY_SHELF_QUERY_CACHE_PASS,
  CONTENT_WORKER_OVERLOAD_PASS,
  LIBRARY_SEPARATE_PAGE_PASS,
  LIBRARY_TREE_API_PASS,
  LIBRARY_TREE_CURSOR_PASS,
  LIBRARY_STATE_REVISION_SPLIT_PASS,
  LIBRARY_FOLDER_FILTER_CURSOR_PASS,
  LIBRARY_SHELF_FILTERS_PASS,
  LIBRARY_SHELF_FOCUS_PASS,
  LIBRARY_SHELF_HOT_PATH_PASS,
  LIBRARY_VARIANT_GROUPING_PASS,
  LIBRARY_VARIANT_PRESENTATION_PASS,
  createNovelsRouter,
  buildNovelsEtag,
  buildContentChunkEtag,
  buildAuthCacheScope,
  clientHasMatchingEtag
};
