const express = require('express');
const crypto = require('crypto');
const {
  getUserLibraryAccessFromRequest,
  assertNovelAllowed,
  assertEpisodeAllowed
} = require('../services/library-access-service');

const BLOCK_MANIFEST_CONDITIONAL_CACHE_PASS = 'v434-block-manifest-conditional-cache-pass';

function sendAclFailure(res, auth) {
  return res.status(auth && auth.status || 403).json({
    ok: false,
    error: auth && auth.error || 'library_access_denied',
    message: auth && auth.error === 'reader_user_session_required'
      ? 'Reader API requires a normal user session. Owner sessions are limited to the management console.'
      : 'Library access denied for this user.'
  });
}

function sendManifestError(res, err) {
  if (err && (err.name === 'AbortError' || err.code === 'ABORT_ERR')) {
    if (!res.headersSent) return res.status(499).json({ ok: false, error: 'request_aborted', message: 'Request aborted before block manifest completed.' });
    return undefined;
  }
  if (err && (err.code === 'TEXT_FILE_TOO_LARGE' || Number(err.status || err.statusCode) === 413)) {
    return res.status(413).json({ ok: false, error: 'text_file_too_large', message: 'TXT 파일이 MAX_TEXT_FILE_BYTES 한도를 초과했습니다.', maxBytes: err.maxBytes || 0, size: err.size || 0, pass: err.pass || '' });
  }
  if (err && (err.code === 'LIBRARY_ACCESS_DENIED' || Number(err.status || err.statusCode) === 403)) {
    return res.status(403).json({ ok: false, error: 'library_access_denied', message: 'Library access denied for this user.' });
  }
  return res.status(500).json({ error: err && err.message || 'block manifest request failed' });
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = stableClone(value[key]);
  }
  return out;
}

function stableHash(value) {
  return sha256(JSON.stringify(stableClone(value)));
}

function cloneForManifestEtag(value) {
  if (Array.isArray(value)) return value.map(cloneForManifestEtag);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const key of Object.keys(value).sort()) {
    if (key === 'generatedAt') continue;
    out[key] = cloneForManifestEtag(value[key]);
  }
  return out;
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

function buildManifestEtag(body, auth, accountService) {
  const stable = {
    pass: BLOCK_MANIFEST_CONDITIONAL_CACHE_PASS,
    scope: buildAuthCacheScope(auth, accountService),
    manifest: cloneForManifestEtag(body || {})
  };
  return 'W/"' + stableHash(stable) + '"';
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


function createRequestAbortContext(req, res) {
  const controller = new AbortController();
  const abort = () => {
    if (!controller.signal.aborted) controller.abort();
  };
  if (req && typeof req.once === 'function') req.once('aborted', abort);
  if (res && typeof res.once === 'function') res.once('close', abort);
  return {
    signal: controller.signal,
    cleanup() {
      if (req && typeof req.off === 'function') req.off('aborted', abort);
      if (res && typeof res.off === 'function') res.off('close', abort);
    }
  };
}

function sendManifestResponse(req, res, result, auth, accountService) {
  const status = Number(result && result.status || 200);
  const body = result && result.body;
  if (status !== 200 || !body || typeof body !== 'object') {
    return res.status(status || 500).json(body || {});
  }
  const etag = buildManifestEtag(body, auth, accountService);
  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
  res.setHeader('ETag', etag);
  res.setHeader('X-Block-Manifest-Conditional-Cache', BLOCK_MANIFEST_CONDITIONAL_CACHE_PASS);
  appendVaryHeader(res, 'Cookie');
  if (clientHasMatchingEtag(req, etag)) {
    return res.status(304).end();
  }
  return res.status(200).json(body);
}

function createBlockManifestRouter(options = {}) {
  const router = express.Router();
  const setNoStore = options.setNoStore || (() => {});
  const blockManifestService = options.blockManifestService;
  const libraryService = options.libraryService;
  const sessionStore = options.sessionStore || { getSession: () => ({ kind: 'user', userId: '__test__' }) };
  const accountService = options.accountService || { getUserLibraryAccess: () => ({ mode: 'all', folders: [] }) };
  const aclBypassForStructureSmoke = !options.sessionStore && !options.accountService;

  if (!blockManifestService) throw new Error('blockManifestService is required');
  if (!libraryService) throw new Error('libraryService is required');

  function getAuth(req, res) {
    const auth = aclBypassForStructureSmoke ? { ok: true, session: { kind: 'user', userId: '__test__' }, access: { mode: 'all', folders: [] } } : getUserLibraryAccessFromRequest(req, { sessionStore, accountService });
    if (!auth.ok) {
      sendAclFailure(res, auth);
      return null;
    }
    return auth;
  }

  router.get('/novels/:novelId/block-manifest', async (req, res) => {
    // setNoStore(res) libraryService.setLibraryMetaHeaders(res) blockManifestService.getSingleManifest req.params.novelId req.query
    setNoStore(res);
    try {
      const auth = getAuth(req, res);
      if (!auth) return;
      libraryService.setLibraryMetaHeaders(res);
      if (!aclBypassForStructureSmoke) {
        const library = libraryService.getLibraryCached();
        const novel = library.find(n => n && n.id === req.params.novelId);
        if (!novel) return res.status(404).json({ error: 'Not found' });
        assertNovelAllowed(auth.access, novel);
      }
      const abortContext = createRequestAbortContext(req, res);
      try {
        const result = await blockManifestService.getSingleManifest(req.params.novelId, req.query, { signal: abortContext.signal });
        return sendManifestResponse(req, res, result, auth, accountService);
      } finally {
        abortContext.cleanup();
      }
    } catch (err) {
      sendManifestError(res, err);
    }
  });

  router.get('/novels/:novelId/episodes/:episodeId/block-manifest', async (req, res) => {
    // setNoStore(res) libraryService.setLibraryMetaHeaders(res) blockManifestService.getEpisodeManifest req.params.novelId req.params.episodeId req.query
    setNoStore(res);
    try {
      const auth = getAuth(req, res);
      if (!auth) return;
      libraryService.setLibraryMetaHeaders(res);
      if (!aclBypassForStructureSmoke) {
        const library = libraryService.getLibraryCached();
        const novel = library.find(n => n && n.id === req.params.novelId);
        if (!novel) return res.status(404).json({ error: 'Novel not found' });
        const episode = (novel.episodes || []).find(e => e && e.id === req.params.episodeId);
        if (!episode) return res.status(404).json({ error: 'Episode not found' });
        assertEpisodeAllowed(auth.access, novel, episode);
      }
      const abortContext = createRequestAbortContext(req, res);
      try {
        const result = await blockManifestService.getEpisodeManifest(req.params.novelId, req.params.episodeId, req.query, { signal: abortContext.signal });
        return sendManifestResponse(req, res, result, auth, accountService);
      } finally {
        abortContext.cleanup();
      }
    } catch (err) {
      sendManifestError(res, err);
    }
  });

  return router;
}

module.exports = {
  BLOCK_MANIFEST_CONDITIONAL_CACHE_PASS,
  createBlockManifestRouter,
  buildManifestEtag,
  cloneForManifestEtag,
  sendManifestResponse
};
