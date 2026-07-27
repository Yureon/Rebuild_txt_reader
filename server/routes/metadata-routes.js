const fs = require('fs');
const { pipeline } = require('stream/promises');
const express = require('express');
const { createAsyncSafeRouter } = require('../utils/async-route');
const { getSessionTokenFromReq } = require('../middleware/auth');
const { getUserLibraryAccessFromRequest, filterLibraryByAccess } = require('../services/library-access-service');
const { buildLibraryVariantPresentation } = require('../services/library-variant-service');

const METADATA_ROUTES_PASS = 'v643-metadata-locale-provider-settings-pass';
const METADATA_TARGETED_RESOLVE_PASS = 'v648-metadata-targeted-resolve-pass';
const METADATA_NOVEL_PATCH_PASS = 'v648-metadata-novel-patch-pass';

function createMetadataRouter(options = {}) {
  const router = createAsyncSafeRouter();
  const metadataService = options.metadataService;
  const coverService = options.coverService;
  const libraryService = options.libraryService;
  const sessionStore = options.sessionStore;
  const accountService = options.accountService;
  const playwrightService = options.playwrightService;
  const libraryContentFingerprintService = options.libraryContentFingerprintService || null;
  const libraryVariantPreferenceService = options.libraryVariantPreferenceService || null;
  const requireSameOrigin = options.requireSameOrigin || ((_req,_res,next) => next());
  const requireCsrf = options.requireCsrf || ((_req,_res,next) => next());
  const checkApiWriteLimit = options.checkApiWriteLimit || (() => true);
  if (!metadataService || !coverService || !libraryService || !sessionStore || !accountService || !playwrightService) throw new Error('metadata router dependencies are required');
  const coverStatus = typeof coverService.getStatus === 'function' ? coverService.getStatus() : {};
  const manualCoverMaxBytes = Math.max(64 * 1024, Math.min(20 * 1024 * 1024, Number(coverStatus.manualUploadMaxBytes) || 5 * 1024 * 1024));

  const coverAccessScopeCache = new Map();
  const coverAccessScopeCacheMax = 16;
  const coverAccessScopeTtlMs = 10 * 60 * 1000;
  function coverAccessScopeKey(access) {
    const normalizedFolders = Array.isArray(access && access.folders) ? access.folders.map(String).sort() : [];
    const cacheStatus = typeof libraryService.getCacheStatus === 'function' ? libraryService.getCacheStatus() : null;
    const generation = Number(cacheStatus && cacheStatus.libraryCache && cacheStatus.libraryCache.signatureGeneration) || 0;
    return `${String(access && access.mode || 'none')}|${normalizedFolders.join('\n')}|${generation}`;
  }
  async function getCoverAccessScope(access) {
    const key = coverAccessScopeKey(access);
    const hit = coverAccessScopeCache.get(key);
    if (hit && Date.now() - hit.createdAt <= coverAccessScopeTtlMs) {
      coverAccessScopeCache.delete(key);
      coverAccessScopeCache.set(key, hit);
      return hit.scope;
    }
    if (hit) coverAccessScopeCache.delete(key);
    const library = typeof libraryService.getLibraryCachedForRequestAsync === 'function' ? await libraryService.getLibraryCachedForRequestAsync() : typeof libraryService.getLibraryCachedAsync === 'function' ? await libraryService.getLibraryCachedAsync() : libraryService.getLibraryCached();
    const filtered = filterLibraryByAccess(library, access);
    const scope = typeof metadataService.createCoverAccessScope === 'function'
      ? metadataService.createCoverAccessScope(filtered)
      : filtered;
    coverAccessScopeCache.set(key, { createdAt:Date.now(), scope });
    while (coverAccessScopeCache.size > coverAccessScopeCacheMax) coverAccessScopeCache.delete(coverAccessScopeCache.keys().next().value);
    return scope;
  }

  function setNoStore(res) { res.setHeader('Cache-Control', 'no-store'); }

  function requestedSiteLanguage(req) {
    const explicit = String(req && req.headers && req.headers['x-txt-reader-site-language'] || '').trim().toLowerCase();
    if (explicit) return explicit.slice(0, 48);
    const accepted = String(req && req.headers && req.headers['accept-language'] || '').trim().toLowerCase();
    const preferred = accepted ? accepted.split(',')[0].split(';')[0].trim().slice(0, 48) : '';
    // RFC 9110 wildcard means any language is acceptable. Use the application's
    // Korean default instead of treating Node/CLI clients that send "*" as a
    // non-Korean site selection.
    return !preferred || preferred === '*' ? 'ko' : preferred;
  }
  function metadataLocaleAvailable(req) {
    const language = requestedSiteLanguage(req);
    return language === 'ko' || language.startsWith('ko-') || language === 'site:ko';
  }
  function metadataLocalePayload(req) {
    return {
      metadataAvailableForLocale:metadataLocaleAvailable(req),
      requestedSiteLanguage:requestedSiteLanguage(req),
      localeRestriction:'ko-only'
    };
  }
  function requireMetadataKoreanLocale(req, res, next) {
    if (!metadataLocaleAvailable(req)) {
      setNoStore(res);
      return res.status(403).json({
        ok:false,
        error:'metadata_locale_unsupported',
        message:'현재 메타데이터 공급자는 한국어 사이트 언어에서만 사용할 수 있습니다.',
        ...metadataLocalePayload(req),
        pass:METADATA_ROUTES_PASS
      });
    }
    next();
  }

  function appendVaryCookie(res) {
    const current = String(res.getHeader('Vary') || '').split(',').map(value => value.trim()).filter(Boolean);
    if (!current.some(value => value.toLowerCase() === 'cookie') && !current.includes('*')) current.push('Cookie');
    if (current.length) res.setHeader('Vary', current.join(', '));
  }
  function currentSession(req) { return sessionStore.getSession(getSessionTokenFromReq(req)); }
  function resolveSessionContext(req, res, allowOwner = true) {
    const session = currentSession(req);
    if (allowOwner && session && session.kind === 'owner') return { session, access:{ mode:'all', folders:[] }, filtered:null };
    const auth = getUserLibraryAccessFromRequest(req, { sessionStore, accountService });
    if (!auth.ok) {
      res.status(auth.status || 403).json({ ok:false, error:auth.error || 'library_access_denied' });
      return null;
    }
    return { session:auth.session, access:auth.access, filtered:null };
  }

  async function resolveContext(req, res, allowOwner = true) {
    const session = currentSession(req);
    if (allowOwner && session && session.kind === 'owner') {
      const library = typeof libraryService.getLibraryCachedForRequestAsync === 'function' ? await libraryService.getLibraryCachedForRequestAsync() : typeof libraryService.getLibraryCachedAsync === 'function' ? await libraryService.getLibraryCachedAsync() : libraryService.getLibraryCached();
      return { session, access:{ mode:'all', folders:[] }, filtered:Array.isArray(library) ? library : [] };
    }
    const auth = getUserLibraryAccessFromRequest(req, { sessionStore, accountService });
    if (!auth.ok) {
      res.status(auth.status || 403).json({ ok:false, error:auth.error || 'library_access_denied' });
      return null;
    }
    const library = typeof libraryService.getLibraryCachedForRequestAsync === 'function' ? await libraryService.getLibraryCachedForRequestAsync() : typeof libraryService.getLibraryCachedAsync === 'function' ? await libraryService.getLibraryCachedAsync() : libraryService.getLibraryCached();
    const filtered = auth.access && auth.access.mode === 'all' ? library : filterLibraryByAccess(library, auth.access);
    return { session:auth.session, access:auth.access, filtered:Array.isArray(filtered) ? filtered : [] };
  }
  function directNovelByAlias(filtered, requestedId) {
    const id = String(requestedId || '');
    if (!id) return null;
    for (const novel of Array.isArray(filtered) ? filtered : []) {
      if (!novel || typeof novel !== 'object') continue;
      if (String(novel.id || '') === id) return novel;
      if ((Array.isArray(novel.progressAliases) ? novel.progressAliases : []).some(alias => String(alias || '') === id)) return novel;
    }
    return null;
  }
  async function resolveNovel(req, res, allowOwner = true, existingContext = null) {
    const ctx = existingContext || await resolveContext(req, res, allowOwner);
    if (!ctx) return null;
    const requestedId = String(req.params.novelId || '');
    const direct = directNovelByAlias(ctx.filtered, requestedId);
    if (direct) {
      const novel = typeof metadataService.enrichNovel === 'function' ? metadataService.enrichNovel(direct) : direct;
      return { ...ctx, novel, sourceNovel:direct, presentation:null, resolvePass:METADATA_TARGETED_RESOLVE_PASS, resolveMode:'direct-alias' };
    }
    // Compatibility fallback for historical virtual/group aliases that are not
    // present on the raw catalog. Normal shelf representatives resolve above
    // without mapping and regrouping the complete 80k-file library.
    const enriched = typeof metadataService.enrichNovel === 'function' ? ctx.filtered.map(item => metadataService.enrichNovel(item)) : ctx.filtered;
    const presentation = buildLibraryVariantPresentation(enriched, {
      fingerprintService:libraryContentFingerprintService,
      preferenceService:libraryVariantPreferenceService,
      queueFingerprintWork:false
    });
    const novel = presentation.byAlias.get(requestedId) || null;
    if (!novel) {
      res.status(404).json({ ok:false, error:'novel_not_found' });
      return null;
    }
    const sourceNovel = directNovelByAlias(ctx.filtered, novel.id) || novel;
    return { ...ctx, novel, sourceNovel, presentation, resolvePass:METADATA_TARGETED_RESOLVE_PASS, resolveMode:'presentation-fallback' };
  }
  function buildNovelPatch(novel, applied = null) {
    const enriched = typeof metadataService.enrichNovel === 'function' ? metadataService.enrichNovel(novel) : novel;
    const aliases = Array.from(new Set([
      enriched && enriched.id,
      ...(Array.isArray(enriched && enriched.progressAliases) ? enriched.progressAliases : []),
      ...(Array.isArray(applied && applied.aliases) ? applied.aliases : [])
    ].map(value => String(value || '')).filter(Boolean))).slice(0, 512);
    return {
      pass:METADATA_NOVEL_PATCH_PASS,
      id:String(enriched && enriched.id || novel && novel.id || ''),
      progressAliases:aliases,
      title:String(enriched && enriched.title || ''),
      author:String(enriched && enriched.author || ''),
      description:String(enriched && (enriched.description || enriched.synopsis) || ''),
      synopsis:String(enriched && (enriched.synopsis || enriched.description) || ''),
      genres:Array.isArray(enriched && enriched.genres) ? enriched.genres.slice(0,24) : [],
      tags:Array.isArray(enriched && enriched.tags) ? enriched.tags.slice(0,40) : [],
      publicationStatus:String(enriched && enriched.publicationStatus || ''),
      publicationYear:Number.isFinite(Number(enriched && enriched.publicationYear)) ? Number(enriched.publicationYear) : null,
      sourceLanguage:String(enriched && enriched.sourceLanguage || ''),
      coverUrl:String(enriched && (enriched.coverUrl || enriched.cover) || ''),
      metadata:enriched && enriched.metadata || null
    };
  }
  function canAccessMetadata(ctx) {
    if (!ctx || !ctx.session) return false;
    if (ctx.session.kind === 'owner') return true;
    if (ctx.session.kind !== 'user') return false;
    const permissions = typeof accountService.getUserAppPermissions === 'function'
      ? accountService.getUserAppPermissions(ctx.session.userId)
      : {};
    return permissions && permissions.metadataAccess === true;
  }
  function canEdit(ctx) {
    if (!canAccessMetadata(ctx)) return false;
    if (ctx.session.kind === 'owner') return true;
    return ctx.session.kind === 'user' && ctx.access && ctx.access.mode === 'all';
  }
  function actorKey(ctx) {
    const session = ctx && ctx.session || {};
    return `${String(session.kind || 'session')}:${String(session.userId || session.id || session.token || 'owner')}`;
  }
  function jobRequesterId(ctx) {
    const session = ctx && ctx.session || {};
    return String(session.userId || session.id || 'owner');
  }
  function canAccessJob(ctx, job) {
    if (!ctx || !ctx.session || !job) return false;
    if (ctx.session.kind === 'owner') return true;
    const actor = jobRequesterId(ctx);
    const requesters = Array.from(new Set([...(Array.isArray(job.requesters) ? job.requesters : []), job.requestedBy].map(value => String(value || '').trim()).filter(Boolean)));
    return requesters.includes(actor);
  }
  function publicJobForContext(ctx, job) {
    if (!job || typeof job !== 'object') return job || null;
    if (ctx && ctx.session && ctx.session.kind === 'owner') return job;
    const { requestedBy, requesters, dedupeKey, ...safeJob } = job;
    return safeJob;
  }
  function queueStatusForContext(ctx) {
    if (ctx && ctx.session && ctx.session.kind === 'owner') return metadataService.queueStatus();
    const jobs = metadataService.listJobsForRequester ? metadataService.listJobsForRequester(jobRequesterId(ctx), 500) : [];
    const queued = jobs.filter(job => job.status === 'queued').length;
    const running = jobs.filter(job => job.status === 'running').length;
    return { scoped:true, active:running, queued, running, total:jobs.length };
  }
  function validateBrowserCaptureBody(body) {
    const root = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
    const allowedRoot = new Set(['pairingToken','capture']);
    if (Object.keys(root).some(key => !allowedRoot.has(key))) throw Object.assign(new Error('브라우저 캡처 요청에 허용되지 않은 항목이 있습니다.'), { code:'METADATA_BROWSER_CAPTURE_INVALID' });
    const capture = root.capture && typeof root.capture === 'object' && !Array.isArray(root.capture) ? root.capture : null;
    if (!capture) throw Object.assign(new Error('브라우저 캡처 데이터가 필요합니다.'), { code:'METADATA_BROWSER_CAPTURE_INVALID' });
    const allowed = new Set(['pageUrl','title','originalTitle','author','synopsis','genres','tags','publicationStatus','publicationYear','sourceLanguage','coverUrl','capturedAt','evidence']);
    if (Object.keys(capture).some(key => !allowed.has(key))) throw Object.assign(new Error('Cookie, 원본 HTML 또는 허용되지 않은 캡처 항목은 전송할 수 없습니다.'), { code:'METADATA_BROWSER_CAPTURE_INVALID' });
    const serialized = JSON.stringify(capture);
    if (Buffer.byteLength(serialized,'utf8') > 64 * 1024) throw Object.assign(new Error('브라우저 캡처 데이터가 너무 큽니다.'), { code:'METADATA_BROWSER_CAPTURE_INVALID' });
    if (!String(capture.pageUrl || '').trim() || !String(capture.title || '').trim()) throw Object.assign(new Error('브라우저 캡처에는 작품 상세 URL과 제목이 필요합니다.'), { code:'METADATA_BROWSER_CAPTURE_INVALID' });
    return { pairingToken:String(root.pairingToken || ''), capture };
  }
  function requireViewerLight(req, res, next) {
    const ctx = resolveSessionContext(req, res, true);
    if (!ctx) return;
    if (!canAccessMetadata(ctx)) return res.status(403).json({ ok:false, error:'metadata_access_required', message:'메타데이터 화면 접근 권한이 필요합니다.' });
    req.metadataContext = ctx;
    next();
  }
  function requireEditorLight(req, res, next) {
    const ctx = resolveSessionContext(req, res, true);
    if (!ctx) return;
    if (!canAccessMetadata(ctx)) return res.status(403).json({ ok:false, error:'metadata_access_required', message:'메타데이터 화면 접근 권한이 필요합니다.' });
    if (!canEdit(ctx)) return res.status(403).json({ ok:false, error:'metadata_editor_required', message:'메타데이터 변경은 전체 라이브러리 접근 사용자 또는 소유자만 가능합니다.' });
    req.metadataContext = ctx;
    next();
  }

  async function requireViewer(req, res, next) {
    try {
      const ctx = await resolveContext(req, res, true);
      if (!ctx) return;
      if (!canAccessMetadata(ctx)) return res.status(403).json({ ok:false, error:'metadata_access_required', message:'메타데이터 화면 접근 권한이 필요합니다.' });
      req.metadataContext = ctx;
      next();
    } catch (error) {
      return sendError(res, error);
    }
  }
  async function requireEditor(req, res, next) {
    try {
      const ctx = await resolveContext(req, res, true);
      if (!ctx) return;
      if (!canAccessMetadata(ctx)) return res.status(403).json({ ok:false, error:'metadata_access_required', message:'메타데이터 화면 접근 권한이 필요합니다.' });
      if (!canEdit(ctx)) return res.status(403).json({ ok:false, error:'metadata_editor_required', message:'메타데이터 변경은 전체 라이브러리 접근 사용자 또는 소유자만 가능합니다.' });
      req.metadataContext = ctx;
      next();
    } catch (error) {
      return sendError(res, error);
    }
  }

  function requireOwner(req, res, next) {
    const session = currentSession(req);
    if (!session || session.kind !== 'owner') return res.status(403).json({ ok:false, error:'owner_required', message:'공유 Playwright 로그인 프로필은 소유자만 관리할 수 있습니다.' });
    req.metadataOwnerSession = session;
    next();
  }

  function requireMetadataOwner(req, res, next) {
    const session = currentSession(req);
    if (!session || session.kind !== 'owner') return res.status(403).json({ ok:false, error:'owner_required', message:'메타데이터 저장소 관리는 소유자만 실행할 수 있습니다.' });
    req.metadataOwnerSession = session;
    next();
  }

  async function metadataMaintenanceContext() {
    const library = typeof libraryService.getLibraryCachedForRequestAsync === 'function'
      ? await libraryService.getLibraryCachedForRequestAsync()
      : typeof libraryService.getLibraryCachedAsync === 'function'
        ? await libraryService.getLibraryCachedAsync()
        : libraryService.getLibraryCached();
    const activeNovelIds = [];
    for (const novel of Array.isArray(library) ? library : []) {
      if (novel && novel.id) activeNovelIds.push(String(novel.id));
      for (const alias of Array.isArray(novel && novel.progressAliases) ? novel.progressAliases : []) if (alias) activeNovelIds.push(String(alias));
    }
    return { activeNovelIds:Array.from(new Set(activeNovelIds)).slice(0, 500000) };
  }

  function metadataCleanupPolicy(body = {}) {
    const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
    const allowed = new Set(['olderThanDays','orphanOlderThanDays','keepPerWork','keepPerProvider']);
    if (Object.keys(input).some(key => !allowed.has(key))) throw Object.assign(new Error('메타데이터 정리 요청에 허용되지 않은 항목이 있습니다.'), { code:'METADATA_MAINTENANCE_INVALID' });
    return {
      olderThanDays:Number(input.olderThanDays),
      orphanOlderThanDays:Number(input.orphanOlderThanDays),
      keepPerWork:Number(input.keepPerWork),
      keepPerProvider:Number(input.keepPerProvider)
    };
  }

  function publicCleanupResult(result) {
    if (!result || typeof result !== 'object') return result;
    const { removals, ...safe } = result;
    return { ...safe, sample:Array.isArray(result.sample) ? result.sample.slice(0, 50) : [] };
  }

  function providerListForSession(session, req = null) {
    if (req && !metadataLocaleAvailable(req)) return [];
    const owner = !!(session && session.kind === 'owner');
    return metadataService.listProviders().map(provider => {
      if (owner || !provider || typeof provider !== 'object') return provider;
      const profile = provider.browserProfile && typeof provider.browserProfile === 'object' ? provider.browserProfile : null;
      if (!profile) return provider;
      return {
        ...provider,
        browserProfile:{
          supported:profile.supported === true,
          configured:profile.configured === true,
          status:String(profile.status || (profile.configured ? 'unknown' : 'not_configured')),
          pass:profile.pass || undefined
        }
      };
    });
  }

  function writeGuard(scope, max = 30, windowMs = 60_000) {
    return (req,res,next) => {
      if (!checkApiWriteLimit(req, scope, max, windowMs)) return res.status(429).json({ ok:false, error:'rate_limited' });
      next();
    };
  }
  function classifyMetadataError(code) {
    const value = String(code || 'METADATA_ERROR').toUpperCase();
    if (value.includes('SESSION_NOT_FOUND') || value.endsWith('_NOT_FOUND')) return { status:404 };
    if (value.includes('FORBIDDEN')) return { status:403 };
    if (value.includes('QUEUE_FULL')) return { status:503, retryAfter:30 };
    if (value.includes('TOO_LARGE')) return { status:413 };
    if (value.includes('CAPTCHA') || value.includes('ACCESS_BLOCKED') || value.includes('PROVIDER_BLOCKED') || value.includes('TEMPORARY_BLOCK')) return { status:429, retryAfter:60 };
    if (value.includes('TIMEOUT') || value.includes('TEMPORARY') || value.includes('UNAVAILABLE')) return { status:503, retryAfter:30 };
    if (value.includes('LOGIN_REQUIRED') || value.includes('AGE_VERIFICATION_REQUIRED') || value.includes('VERIFICATION_REQUIRED') || value.includes('INCOMPLETE') || value.includes('ACTIVE') || value.includes('DISABLED')) return { status:409 };
    if (value.includes('METADATA_COVER_UNSUPPORTED_FORMAT')) return { status:415 };
    if (value.includes('URL_BLOCKED') || value.includes('HOST_BLOCKED') || value.includes('PATH_BLOCKED') || value.includes('REDIRECT_BLOCKED') || value.includes('SSRF_BLOCKED') || value.includes('INVALID') || value.includes('UNSUPPORTED')) return { status:400 };
    return { status:500 };
  }
  function sendError(res, error) {
    const code = String(error && error.code || 'METADATA_ERROR');
    const classification = classifyMetadataError(code);
    const status = classification.status;
    if (classification.retryAfter) res.setHeader('Retry-After', String(classification.retryAfter));
    if (status >= 500 && !classification.retryAfter) {
      console.error(error);
      return res.status(status).json({ ok:false, error:'internal_server_error', message:'metadata request failed', pass:METADATA_ROUTES_PASS });
    }
    return res.status(status).json({ ok:false, error:code.toLowerCase(), message:String(error && error.message || 'metadata request failed').slice(0,1000), retryAfter:classification.retryAfter || undefined, pass:METADATA_ROUTES_PASS });
  }

  async function prepareManualMetadataInput(body) {
    const source = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
    for (const field of ['coverUrl','coverRemoteUrl']) {
      if (Object.prototype.hasOwnProperty.call(source, field)) {
        throw Object.assign(new Error('외부 수동 표지 URL은 클라이언트에서 지정할 수 없습니다.'), { code:'METADATA_COVER_INVALID' });
      }
    }
    const legacyLocalUrlPresent = Object.prototype.hasOwnProperty.call(source, 'coverUrlLocal');
    const legacyLocalUrl = legacyLocalUrlPresent ? String(source.coverUrlLocal || '').trim() : '';
    const input = { ...source };
    delete input.coverUrlLocal;
    const requestedAssetId = String(source.coverAssetId || '').trim();
    if (!requestedAssetId) {
      if (legacyLocalUrlPresent) throw Object.assign(new Error('수동 표지 URL에는 coverAssetId가 필요합니다.'), { code:'METADATA_COVER_INVALID' });
      return { input, asset:null };
    }
    if (!/^[a-fA-F0-9]{64}$/.test(requestedAssetId)) {
      throw Object.assign(new Error('표지 asset ID는 64자리 SHA-256 hex여야 합니다.'), { code:'METADATA_COVER_INVALID' });
    }
    const assetId = requestedAssetId.toLowerCase();
    const expectedLegacyUrl = `/api/metadata/covers/${assetId}`;
    if (legacyLocalUrlPresent && legacyLocalUrl !== expectedLegacyUrl) {
      throw Object.assign(new Error('legacy 수동 표지 URL이 asset ID와 일치하지 않습니다.'), { code:'METADATA_COVER_INVALID' });
    }
    const asset = typeof coverService.verifyAssetAsync === 'function'
      ? await coverService.verifyAssetAsync(assetId)
      : (typeof coverService.findAssetAsync === 'function' ? await coverService.findAssetAsync(assetId) : coverService.findAsset(assetId));
    if (!asset || String(asset.assetId || '').toLowerCase() !== assetId) {
      throw Object.assign(new Error('검증된 표지 asset을 찾을 수 없습니다.'), { code:'METADATA_COVER_INVALID' });
    }
    const canonicalUrl = typeof coverService.canonicalAssetUrl === 'function'
      ? coverService.canonicalAssetUrl(assetId)
      : `/api/metadata/covers/${assetId}`;
    if (!canonicalUrl) throw Object.assign(new Error('표지 asset URL을 생성할 수 없습니다.'), { code:'METADATA_COVER_INVALID' });
    input.coverAssetId = assetId;
    input.coverUrlLocal = canonicalUrl;
    delete input.coverUrl;
    delete input.coverRemoteUrl;
    return { input, asset:{ ...asset, assetId, url:canonicalUrl } };
  }

  router.get('/metadata/storage', requireMetadataOwner, async (_req,res) => {
    setNoStore(res);
    const storage = typeof metadataService.metadataStorageStats === 'function' ? metadataService.metadataStorageStats() : null;
    if (!storage) throw Object.assign(new Error('메타데이터 저장소 통계를 사용할 수 없습니다.'), { code:'METADATA_MAINTENANCE_UNAVAILABLE' });
    res.json({ ok:true, storage });
  });

  router.post('/metadata/storage/cleanup/preview', requireSameOrigin, requireCsrf, writeGuard('metadata-storage-preview', 20), requireMetadataOwner, async (req,res) => {
    setNoStore(res);
    const policy = metadataCleanupPolicy(req.body);
    const context = await metadataMaintenanceContext();
    const result = typeof metadataService.planMetadataCandidateCleanup === 'function'
      ? await metadataService.planMetadataCandidateCleanup(policy, context)
      : null;
    if (!result) throw Object.assign(new Error('메타데이터 후보 정리 미리보기를 사용할 수 없습니다.'), { code:'METADATA_MAINTENANCE_UNAVAILABLE' });
    res.json({ ok:true, result:publicCleanupResult(result) });
  });

  router.post('/metadata/storage/cleanup', requireSameOrigin, requireCsrf, writeGuard('metadata-storage-cleanup', 4, 60 * 60 * 1000), requireMetadataOwner, async (req,res) => {
    setNoStore(res);
    const policy = metadataCleanupPolicy(req.body);
    const context = await metadataMaintenanceContext();
    const result = await metadataService.cleanupMetadataCandidates(policy, context);
    res.json({ ok:true, result:publicCleanupResult(result) });
  });

  router.post('/metadata/storage/rewrite', requireSameOrigin, requireCsrf, writeGuard('metadata-storage-rewrite', 4, 60 * 60 * 1000), requireMetadataOwner, async (_req,res) => {
    setNoStore(res);
    const storage = await metadataService.rewriteMetadataCompressedStore();
    res.json({ ok:true, storage });
  });

  router.get('/metadata/providers', requireViewerLight, async (req,res) => {
    setNoStore(res);
    const ctx = req.metadataContext;
    res.json({ ok:true, pass:METADATA_ROUTES_PASS, enabled:metadataService.enabled, canAccess:true, canEdit:canEdit(ctx), canManageBrowserProfiles:!!(ctx.session && ctx.session.kind === 'owner'), canManageProviderSettings:!!(ctx.session && ctx.session.kind === 'owner'), providers:providerListForSession(ctx.session, req), queue:queueStatusForContext(ctx), manualCoverMaxBytes, ...metadataLocalePayload(req) });
  });

  router.get('/novels/:novelId/metadata', requireViewer, async (req,res) => {
    setNoStore(res);
    const ctx = await resolveNovel(req,res,true,req.metadataContext); if (!ctx) return;
    if (!canAccessMetadata(ctx)) return res.status(403).json({ ok:false, error:'metadata_access_required', message:'메타데이터 화면 접근 권한이 필요합니다.' });
    const metadata = metadataService.getNovelMetadata(ctx.novel);
    res.json({ ok:true, novelId:ctx.novel.id, canAccess:true, canEdit:canEdit(ctx), canManageProviderSettings:!!(ctx.session && ctx.session.kind === 'owner'), ...metadata, providers:providerListForSession(ctx.session, req), manualCoverMaxBytes, ...metadataLocalePayload(req) });
  });

  router.post('/novels/:novelId/metadata/collect', requireSameOrigin, requireCsrf, writeGuard('metadata-collect', 20), requireEditor, requireMetadataKoreanLocale, async (req,res) => {
    setNoStore(res);
    try {
      const ctx = await resolveNovel(req,res,true,req.metadataContext); if (!ctx) return;
      const job = await metadataService.collect(ctx.novel, { url:req.body && req.body.url, providerIds:req.body && req.body.providerIds }, ctx.session.userId || ctx.session.id || 'owner');
      res.status(202).json({ ok:true, pass:METADATA_ROUTES_PASS, job:publicJobForContext(ctx, job) });
    } catch (error) { sendError(res,error); }
  });

  router.post('/novels/:novelId/metadata/browser-capture/pairing', requireSameOrigin, requireCsrf, writeGuard('metadata-browser-capture-pairing', 20), requireEditor, requireMetadataKoreanLocale, async (req,res) => {
    setNoStore(res);
    try {
      const ctx = await resolveNovel(req,res,true,req.metadataContext); if (!ctx) return;
      const pairing = metadataService.createBrowserCapturePairing(ctx.novel, actorKey(ctx));
      res.json({ ok:true, pass:METADATA_ROUTES_PASS, pairing });
    } catch (error) { sendError(res,error); }
  });

  router.post('/novels/:novelId/metadata/browser-capture/import', requireSameOrigin, requireCsrf, writeGuard('metadata-browser-capture-import', 30), requireEditor, requireMetadataKoreanLocale, async (req,res) => {
    setNoStore(res);
    try {
      const ctx = await resolveNovel(req,res,true,req.metadataContext); if (!ctx) return;
      const input = validateBrowserCaptureBody(req.body);
      const result = await metadataService.importBrowserCapture(ctx.novel, actorKey(ctx), input.pairingToken, input.capture);
      res.status(201).json({
        ok:true,
        pass:METADATA_ROUTES_PASS,
        candidate:result.candidate,
        applied:result.applied || null,
        autoApplied:!!result.autoApplied,
        autoApplyReason:result.autoApplyReason || null,
        autoApplyPass:result.autoApplyPass || null,
        providerId:result.provider && result.provider.id,
        providerName:result.provider && result.provider.name,
        evidence:result.evidence,
        warnings:result.warnings || []
      });
    } catch (error) { sendError(res,error); }
  });

  router.post('/metadata/collect-missing', requireSameOrigin, requireCsrf, writeGuard('metadata-collect-missing', 4, 5*60_000), requireEditor, requireMetadataKoreanLocale, async (req,res) => {
    setNoStore(res);
    try {
      const presentation = buildLibraryVariantPresentation(req.metadataContext.filtered);
      const result = await metadataService.collectMissing(presentation.items, { providerIds:req.body && req.body.providerIds }, req.metadataContext.session.userId || 'owner');
      res.status(result.job ? 202 : 200).json({
        ok:true,
        pass:METADATA_ROUTES_PASS,
        count:Number(result.count) || 0,
        reused:!!result.reused,
        recoveredApplied:Number(result.recoveredApplied) || 0,
        pendingCandidates:Number(result.pendingCandidates) || 0,
        autoApplyPass:result.autoApplyPass || null,
        job:publicJobForContext(req.metadataContext, result.job),
        jobs:result.job ? [publicJobForContext(req.metadataContext, result.job)] : []
      });
    } catch (error) { sendError(res,error); }
  });

  router.post('/metadata/apply-pending', requireSameOrigin, requireCsrf, writeGuard('metadata-apply-pending', 4, 5*60_000), requireEditor, requireMetadataKoreanLocale, async (req,res) => {
    setNoStore(res);
    try {
      const presentation = buildLibraryVariantPresentation(req.metadataContext.filtered);
      const result = await metadataService.applyPending(presentation.items, req.metadataContext.session.userId || 'owner');
      res.status(result.job ? 202 : 200).json({
        ok:true,
        pass:result.pass || METADATA_ROUTES_PASS,
        count:Number(result.count) || 0,
        reused:!!result.reused,
        manualReview:Number(result.manualReview) || 0,
        job:publicJobForContext(req.metadataContext, result.job),
        jobs:result.job ? [publicJobForContext(req.metadataContext, result.job)] : []
      });
    } catch (error) { sendError(res,error); }
  });

  router.post('/novels/:novelId/metadata/apply', requireSameOrigin, requireCsrf, writeGuard('metadata-apply', 60), requireEditor, async (req,res) => {
    setNoStore(res);
    try {
      const ctx = await resolveNovel(req,res,true,req.metadataContext); if (!ctx) return;
      const candidateGroupId = String(req.body && req.body.candidateGroupId || '');
      const candidateId = String(req.body && req.body.candidateId || '');
      if (!!candidateGroupId === !!candidateId) throw Object.assign(new Error('candidateId 또는 candidateGroupId 중 하나만 필요합니다.'), { code:'METADATA_CANDIDATE_INVALID' });
      if (candidateGroupId) {
        const result = await metadataService.applyCandidateGroup(ctx.novel, candidateGroupId, req.body && req.body.fields);
        const applied = result && result.applied || null;
        return res.json({ ok:true, pass:result && result.group && result.group.pass || METADATA_ROUTES_PASS, resolvePass:ctx.resolvePass, applied, candidateGroup:result && result.group || null, novelPatch:buildNovelPatch(ctx.sourceNovel || ctx.novel, applied) });
      }
      const applied = await metadataService.applyCandidate(ctx.novel, candidateId, req.body && req.body.fields);
      res.json({ ok:true, pass:METADATA_ROUTES_PASS, resolvePass:ctx.resolvePass, applied, novelPatch:buildNovelPatch(ctx.sourceNovel || ctx.novel, applied) });
    } catch (error) { sendError(res,error); }
  });

  router.put('/novels/:novelId/metadata/manual', requireSameOrigin, requireCsrf, writeGuard('metadata-manual', 60), requireEditor, async (req,res) => {
    setNoStore(res);
    try {
      const ctx = await resolveNovel(req,res,true,req.metadataContext); if (!ctx) return;
      const prepared = await prepareManualMetadataInput(req.body || {});
      const saved = await metadataService.saveManualMetadata(ctx.novel, prepared.input);
      const applied = typeof metadataService.getAppliedRecord === 'function'
        ? metadataService.getAppliedRecord(ctx.novel)
        : saved;
      if (prepared.asset) {
        const data = applied && applied.data || {};
        const durableAssetId = String(data.coverAssetId || '').toLowerCase();
        const durableCoverUrl = String(data.coverUrl || '');
        if (durableAssetId === prepared.asset.assetId && durableCoverUrl === prepared.asset.url) {
          try {
            if (typeof coverService.releaseAssetLeaseDurably === 'function') await coverService.releaseAssetLeaseDurably(prepared.asset.assetId);
            else if (typeof coverService.releaseAssetLease === 'function') coverService.releaseAssetLease(prepared.asset.assetId);
          } catch (_error) {
            // The reference is durable. Lease cleanup failure is recoverable via
            // its bounded expiry and must not convert a successful edit to 500.
          }
        }
      }
      res.json({ ok:true, pass:METADATA_ROUTES_PASS, resolvePass:ctx.resolvePass, applied, novelPatch:buildNovelPatch(ctx.sourceNovel || ctx.novel, applied) });
    } catch (error) { sendError(res,error); }
  });

  router.post(
    '/novels/:novelId/metadata/manual-cover',
    requireSameOrigin,
    requireCsrf,
    writeGuard('metadata-manual-cover', 20, 5*60_000),
    requireEditor,
    express.raw({ type:['application/octet-stream','image/*'], limit:manualCoverMaxBytes }),
    async (req,res) => {
      setNoStore(res);
      try {
        const ctx = await resolveNovel(req,res,true,req.metadataContext); if (!ctx) return;
        if (!Buffer.isBuffer(req.body) || !req.body.length) throw Object.assign(new Error('표지 이미지 파일을 선택하십시오.'), { code:'METADATA_COVER_INVALID' });
        if (typeof coverService.cacheUploadedCover !== 'function') throw Object.assign(new Error('수동 표지 업로드를 사용할 수 없습니다.'), { code:'METADATA_COVER_UNSUPPORTED' });
        let filename = String(req.headers['x-cover-filename'] || '');
        try { filename = decodeURIComponent(filename); } catch {}
        const cover = await coverService.cacheUploadedCover(req.body, {
          contentType:String(req.headers['x-cover-original-type'] || req.headers['content-type'] || ''),
          filename:filename.slice(0, 240)
        });
        res.json({ ok:true, pass:METADATA_ROUTES_PASS, cover });
      } catch (error) { sendError(res,error); }
    }
  );

  router.delete('/novels/:novelId/metadata/candidate-groups/:candidateGroupId', requireSameOrigin, requireCsrf, writeGuard('metadata-candidate-group-delete', 30), requireEditor, async (req,res) => {
    setNoStore(res);
    try {
      const ctx = await resolveNovel(req,res,true,req.metadataContext); if (!ctx) return;
      const result = await metadataService.removeCandidateGroup(ctx.novel, req.params.candidateGroupId);
      res.json({ ok:true, removed:true, candidateGroup:result && result.group || null, removedCount:Number(result && result.removedCount) || 0, pass:result && result.pass || METADATA_ROUTES_PASS });
    } catch (error) { sendError(res,error); }
  });

  router.delete('/novels/:novelId/metadata/candidates/:candidateId', requireSameOrigin, requireCsrf, writeGuard('metadata-candidate-delete', 60), requireEditor, async (req,res) => {
    setNoStore(res);
    try {
      const ctx = await resolveNovel(req,res,true,req.metadataContext); if (!ctx) return;
      const candidate = await metadataService.removeCandidate(ctx.novel, req.params.candidateId);
      res.json({ ok:true, removed:true, candidateId:candidate && candidate.id, pass:METADATA_ROUTES_PASS });
    } catch (error) { sendError(res,error); }
  });

  router.delete('/novels/:novelId/metadata', requireSameOrigin, requireCsrf, writeGuard('metadata-delete', 30), requireEditor, async (req,res) => {
    setNoStore(res);
    try {
      const ctx = await resolveNovel(req,res,true,req.metadataContext); if (!ctx) return;
      const removed = await metadataService.removeApplied(ctx.novel);
      res.json({ ok:true, removed, pass:METADATA_ROUTES_PASS, resolvePass:ctx.resolvePass, novelPatch:buildNovelPatch(ctx.sourceNovel || ctx.novel, null) });
    } catch (error) { sendError(res,error); }
  });

  router.get('/metadata/jobs', requireEditorLight, async (req,res) => {
    setNoStore(res);
    const ctx = req.metadataContext; if (!ctx) return;
    const limit = req.query && req.query.limit;
    const jobs = ctx.session.kind === 'owner'
      ? metadataService.listJobs(limit)
      : (metadataService.listJobsForRequester ? metadataService.listJobsForRequester(jobRequesterId(ctx), limit) : metadataService.listJobs(500).filter(job => canAccessJob(ctx, job)).slice(0, Math.max(1, Math.min(500, Number(limit) || 100))));
    res.json({ ok:true, pass:METADATA_ROUTES_PASS, queue:queueStatusForContext(ctx), jobs:jobs.map(job => publicJobForContext(ctx, job)) });
  });

  router.get('/metadata/jobs/:jobId', requireEditorLight, async (req,res) => {
    setNoStore(res);
    const ctx = req.metadataContext; if (!ctx) return;
    const job = metadataService.getJob(req.params.jobId);
    if (!job || !canAccessJob(ctx, job)) return res.status(404).json({ ok:false, error:'metadata_job_not_found' });
    res.json({ ok:true, pass:METADATA_ROUTES_PASS, job:publicJobForContext(ctx, job) });
  });

  router.post('/metadata/jobs/:jobId/cancel', requireSameOrigin, requireCsrf, writeGuard('metadata-cancel', 60), requireEditorLight, async (req,res) => {
    setNoStore(res);
    const ctx = req.metadataContext; if (!ctx) return;
    const existing = metadataService.getJob(req.params.jobId);
    if (!existing || !canAccessJob(ctx, existing)) return res.status(404).json({ ok:false, error:'metadata_job_not_found' });
    const job = await metadataService.cancelJob(req.params.jobId);
    if (!job) return res.status(404).json({ ok:false, error:'metadata_job_not_found' });
    res.json({ ok:true, pass:METADATA_ROUTES_PASS, job:publicJobForContext(ctx, job) });
  });

  router.post('/metadata/providers/:providerId/probe', requireSameOrigin, requireCsrf, writeGuard('metadata-provider-probe', 20, 5*60_000), requireEditorLight, requireMetadataKoreanLocale, async (req,res) => {
    setNoStore(res);
    try {
      const diagnostic = await metadataService.probeProvider(req.params.providerId, req.body && req.body.query);
      res.json({ ok:true, pass:METADATA_ROUTES_PASS, diagnostic });
    } catch (error) { sendError(res,error); }
  });

  router.put('/metadata/providers/:providerId', requireSameOrigin, requireCsrf, writeGuard('metadata-provider-settings', 30), requireOwner, requireMetadataKoreanLocale, async (req,res) => {
    setNoStore(res);
    try {
      const settings = await metadataService.setProviderSettings(req.params.providerId, req.body || {});
      res.json({ ok:true, pass:METADATA_ROUTES_PASS, settings, providers:metadataService.listProviders() });
    } catch (error) { sendError(res,error); }
  });

  router.post('/metadata/providers/custom', requireSameOrigin, requireCsrf, writeGuard('metadata-provider-custom-create', 20), requireOwner, requireMetadataKoreanLocale, async (req,res) => {
    setNoStore(res);
    try {
      const provider = await metadataService.saveProviderDefinition(req.body && req.body.id, req.body || {});
      res.status(201).json({ ok:true, pass:METADATA_ROUTES_PASS, provider, providers:metadataService.listProviders() });
    } catch (error) { sendError(res,error); }
  });

  router.put('/metadata/providers/:providerId/definition', requireSameOrigin, requireCsrf, writeGuard('metadata-provider-definition', 30), requireOwner, requireMetadataKoreanLocale, async (req,res) => {
    setNoStore(res);
    try {
      const provider = await metadataService.saveProviderDefinition(req.params.providerId, req.body || {});
      res.json({ ok:true, pass:METADATA_ROUTES_PASS, provider, providers:metadataService.listProviders() });
    } catch (error) { sendError(res,error); }
  });

  router.delete('/metadata/providers/:providerId/definition', requireSameOrigin, requireCsrf, writeGuard('metadata-provider-definition-delete', 20), requireOwner, requireMetadataKoreanLocale, async (req,res) => {
    setNoStore(res);
    try {
      const providerId = String(req.params.providerId || '');
      const existing = metadataService.listProviders().find(item => String(item.id || '') === providerId);
      if (!existing) throw Object.assign(new Error('metadata provider not found'), { code:'METADATA_PROVIDER_NOT_FOUND' });
      if (existing.providerKind === 'custom') await metadataService.removeCustomProvider(providerId);
      else await metadataService.resetProviderDefinition(providerId);
      res.json({ ok:true, pass:METADATA_ROUTES_PASS, removed:existing.providerKind === 'custom', providers:metadataService.listProviders() });
    } catch (error) { sendError(res,error); }
  });

  router.post('/metadata/providers/:providerId/browser-login/start', requireSameOrigin, requireCsrf, writeGuard('metadata-browser-login-start', 8, 5*60_000), requireOwner, requireMetadataKoreanLocale, async (req,res) => {
    setNoStore(res);
    try {
      const session = await playwrightService.startLogin(req.params.providerId, { targetUrl:req.body && req.body.targetUrl });
      res.status(201).json({ ok:true, pass:METADATA_ROUTES_PASS, session });
    } catch (error) { sendError(res,error); }
  });

  router.get('/metadata/providers/:providerId/browser-login/session', requireOwner, requireMetadataKoreanLocale, async (req,res) => {
    setNoStore(res);
    try {
      const session = playwrightService.getLoginSession(req.params.providerId, req.query && req.query.sessionId);
      res.json({ ok:true, pass:METADATA_ROUTES_PASS, session });
    } catch (error) { sendError(res,error); }
  });

  router.get('/metadata/providers/:providerId/browser-login/screenshot', requireOwner, requireMetadataKoreanLocale, async (req,res) => {
    setNoStore(res);
    try {
      const result = await playwrightService.screenshot(req.params.providerId, req.query && req.query.sessionId);
      res.setHeader('Content-Type','image/png');
      res.setHeader('X-Content-Type-Options','nosniff');
      res.setHeader('X-Metadata-Browser-Location', encodeURIComponent(result.summary.currentUrl || ''));
      res.send(result.buffer);
    } catch (error) { sendError(res,error); }
  });

  router.post('/metadata/providers/:providerId/browser-login/action', requireSameOrigin, requireCsrf, writeGuard('metadata-browser-login-action', 240, 60_000), requireOwner, requireMetadataKoreanLocale, async (req,res) => {
    setNoStore(res);
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const session = await playwrightService.interact(req.params.providerId, body.sessionId, body);
      res.json({ ok:true, pass:METADATA_ROUTES_PASS, session });
    } catch (error) { sendError(res,error); }
  });

  router.post('/metadata/providers/:providerId/browser-login/finish', requireSameOrigin, requireCsrf, writeGuard('metadata-browser-login-finish', 20, 5*60_000), requireOwner, requireMetadataKoreanLocale, async (req,res) => {
    setNoStore(res);
    try {
      const profile = await playwrightService.finishLogin(req.params.providerId, req.body && req.body.sessionId);
      res.json({ ok:true, pass:METADATA_ROUTES_PASS, profile, providers:metadataService.listProviders() });
    } catch (error) { sendError(res,error); }
  });

  router.delete('/metadata/providers/:providerId/browser-login/session', requireSameOrigin, requireCsrf, writeGuard('metadata-browser-login-cancel', 20), requireOwner, requireMetadataKoreanLocale, async (req,res) => {
    setNoStore(res);
    try {
      const profile = await playwrightService.cancelLogin(req.params.providerId, req.body && req.body.sessionId);
      res.json({ ok:true, pass:METADATA_ROUTES_PASS, profile });
    } catch (error) { sendError(res,error); }
  });

  router.delete('/metadata/providers/:providerId/browser-profile', requireSameOrigin, requireCsrf, writeGuard('metadata-browser-profile-delete', 10, 5*60_000), requireOwner, requireMetadataKoreanLocale, async (req,res) => {
    setNoStore(res);
    try {
      const profile = await playwrightService.clearProfile(req.params.providerId);
      res.json({ ok:true, pass:METADATA_ROUTES_PASS, profile, providers:metadataService.listProviders() });
    } catch (error) { sendError(res,error); }
  });

  router.get('/metadata/covers/:assetId', async (req,res) => {
    try {
      const lightCtx = resolveSessionContext(req,res,true); if (!lightCtx) return;
      const fullLibraryAccess = lightCtx.session && lightCtx.session.kind === 'owner' || lightCtx.access && lightCtx.access.mode === 'all';
      let allowed = fullLibraryAccess ? metadataService.hasCoverAsset(req.params.assetId) : false;
      if (!fullLibraryAccess) {
        const scope = await getCoverAccessScope(lightCtx.access);
        allowed = typeof metadataService.canAccessCoverWithScope === 'function'
          ? metadataService.canAccessCoverWithScope(req.params.assetId, scope)
          : metadataService.canAccessCover(req.params.assetId, scope);
      }
      if (!allowed) return res.status(404).end();
      const opened = typeof coverService.openAssetForRead === 'function'
        ? await coverService.openAssetForRead(req.params.assetId)
        : null;
      if (!opened) return res.status(404).end();
      try {
        const etag = `"${String(req.params.assetId || '')}"`;
        res.setHeader('Content-Type', opened.mime);
        res.setHeader('Content-Length', String(opened.stat.size));
        res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
        appendVaryCookie(res);
        res.setHeader('ETag', etag);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Txt-Reader-Asset', 'metadata-cover-v677-nofollow');
        const inm = String(req.get('if-none-match') || '').trim();
        if (inm && inm.split(',').map(value => value.trim()).some(value => value === '*' || value === etag)) return res.status(304).end();
        if (req.method === 'HEAD') return res.status(200).end();
        res.status(200);
        await pipeline(opened.handle.createReadStream({ start:0, autoClose:false }), res);
        return undefined;
      } finally {
        await opened.close().catch(() => {});
      }
    } catch (error) {
      if (res.headersSent) { res.destroy(error); return undefined; }
      return sendError(res, error);
    }
  });

  return router;
}

module.exports = { METADATA_ROUTES_PASS, createMetadataRouter };
