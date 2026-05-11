const path = require('path');
const crypto = require('crypto');
const express = require('express');
const {
  getUserLibraryAccessFromRequest,
  filterLibraryByAccess,
  assertNovelAllowed,
  assertEpisodeAllowed
} = require('../services/library-access-service');

const NOVELS_CONDITIONAL_CACHE_PASS = 'v434-novels-conditional-cache-pass';
const CONTENT_CHUNK_CONDITIONAL_CACHE_PASS = 'v434-content-chunk-conditional-cache-pass';
const LIBRARY_CATALOG_PERFORMANCE_PASS = 'v453-library-catalog-performance-pass';
const NOVELS_API_PAYLOAD_BUDGET_PASS = 'v453-novels-api-payload-budget-pass';
const NOVELS_API_RESPONSE_CACHE_BUDGET_PASS = 'v453-novels-api-response-cache-budget-pass';
const CONTENT_FULL_SEARCH_PERMISSION_PASS = 'v551-content-full-search-permission-pass';

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
  if (err && (err.code === 'LIBRARY_ACCESS_DENIED' || Number(err.status || err.statusCode) === 403)) {
    return res.status(403).json({ ok: false, error: 'library_access_denied', message: 'Library access denied for this user.' });
  }
  console.error(err);
  return res.status(500).json({ error: err && err.message || 'request failed' });
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
  return inm.split(',').map(item => item.trim()).includes(etag);
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
  const router = express.Router();
  const setNoStore = options.setNoStore || (() => {});
  const libraryPath = options.libraryPath;
  const libraryService = options.libraryService;
  const contentService = options.contentService;
  const sessionStore = options.sessionStore || { getSession: () => ({ kind: 'user', userId: '__test__' }) };
  const accountService = options.accountService || { getUserLibraryAccess: () => ({ mode: 'all', folders: [] }) };
  const aclBypassForStructureSmoke = !options.sessionStore && !options.accountService;
  const novelsResponseCache = new Map();
  const NOVELS_RESPONSE_CACHE_MAX = Math.max(0, Number(options.novelsResponseCacheMax) || 128);
  const NOVELS_RESPONSE_CACHE_MAX_BYTES = Math.max(0, Number(options.novelsResponseCacheMaxBytes) || 16 * 1024 * 1024);
  const NOVELS_RESPONSE_CACHE_ENTRY_MAX_BYTES = Math.max(0, Number(options.novelsResponseCacheEntryMaxBytes) || 2 * 1024 * 1024);
  let novelsResponseCacheBytes = 0;

  if (!libraryPath) throw new Error('libraryPath is required');
  if (!libraryService) throw new Error('libraryService is required');
  if (!contentService) throw new Error('contentService is required');

  function getAuthorizedLibrary(req, res) {
    const auth = aclBypassForStructureSmoke ? { ok: true, session: { kind: 'user', userId: '__test__' }, access: { mode: 'all', folders: [] } } : getUserLibraryAccessFromRequest(req, { sessionStore, accountService });
    if (!auth.ok) {
      sendAclFailure(res, auth);
      return null;
    }
    const library = libraryService.getLibraryCached();
    libraryService.setLibraryMetaHeaders(res);
    return { auth, library, filtered: filterLibraryByAccess(library, auth.access) };
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
    const cacheKey = stableHash({ pass: LIBRARY_CATALOG_PERFORMANCE_PASS, scope, librarySignature: String(librarySignature || ''), libraryBuildCount: Number(libraryBuildCount) || 0 });
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
    const body = filtered.map(serializeNovelMeta);
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
    };
  }

  router.get('/novels', (req, res) => {
    setNoStore(res);
    try {
      const ctx = getAuthorizedLibrary(req, res);
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
      const ctx = getAuthorizedLibrary(req, res);
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
      const ctx = getAuthorizedLibrary(req, res);
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
  createNovelsRouter,
  buildNovelsEtag,
  buildContentChunkEtag,
  buildAuthCacheScope,
  clientHasMatchingEtag
};
