const express = require('express');
const path = require('path');
const { BUILD_ID } = require('./version-contract');
const { PORT, HOST, LIBRARY_PATH, DEPLOYMENT_MODE, REQUIRE_STRICT_ORIGIN, LIBRARY_DEEP_SIGNATURE_CHECK_TTL_MS, LIBRARY_DEEP_SIGNATURE_CHECK_MAX_TTL_MS, LIBRARY_SIGNATURE_CHECK_CONCURRENCY, MAX_TEXT_FILE_BYTES, CONTENT_FILE_CACHE_MAX_BYTES, CONTENT_FILE_CACHE_MAX_ENTRIES, CONTENT_WORKER_THREADS_ENABLED, CONTENT_WORKER_POOL_SIZE, CONTENT_WORKER_QUEUE_MAX, CONTENT_WORKER_IDLE_TTL_MS, CONTENT_MAIN_THREAD_FALLBACK_MAX_BYTES, CONTENT_DISK_CACHE_MIN_BYTES, FOLDER_BLOCK_MANIFEST_RADIUS, DISK_CACHE_AUTO_PRUNE_ENABLED, DISK_CACHE_PRUNE_USAGE_PCT, DISK_CACHE_PRUNE_TARGET_USAGE_PCT, DISK_CACHE_PRUNE_MIN_FREE_MB, DISK_CACHE_PRUNE_TARGET_FREE_MB, DISK_CACHE_PRUNE_INTERVAL_MS, DISK_CACHE_PRUNE_MIN_FILE_AGE_MS, DISK_CACHE_PRUNE_MAX_DELETE_PER_RUN, FILEOPS_MUTATION_QUEUE_MAX, FILEOPS_MUTATION_WAIT_TIMEOUT_MS, FILEOPS_MUTATION_WATCHDOG_MS, METADATA_FETCH_ENABLED, METADATA_PLAYWRIGHT_ENABLED, METADATA_PLAYWRIGHT_HEADLESS, METADATA_PLAYWRIGHT_NO_SANDBOX, METADATA_PLAYWRIGHT_EXECUTABLE_PATH, METADATA_PLAYWRIGHT_TIMEOUT_MS, METADATA_PLAYWRIGHT_SETTLE_MS, METADATA_PLAYWRIGHT_COLLECTOR_IDLE_TTL_MS, METADATA_REQUEST_TIMEOUT_MS, METADATA_RESPONSE_MAX_BYTES, METADATA_COVER_MAX_BYTES, METADATA_COVER_CACHE_MAX_BYTES, METADATA_COVER_ORPHAN_MIN_AGE_MS, METADATA_COVER_PRUNE_INTERVAL_MS, METADATA_COVER_PRUNE_MAX_DELETE_PER_RUN, METADATA_REQUEST_INTERVAL_MS, METADATA_QUEUE_CONCURRENCY, METADATA_QUEUE_MAX, METADATA_AUTO_APPLY_THRESHOLD, resolveTrustProxyValue, assertProductionSecretPolicy } = require('./config/env');
const paths = require('./config/paths');
const { ensureRuntimeDirectories } = require('./config/runtime-dirs');
const { encodeStableId } = require('./utils/stable-id');
const { getAllowedOrigins } = require('./config/origins');
const { createSessionStore } = require('./services/session-store');
const { createAccountService } = require('./services/account-service');
const { createUserStateServiceManager } = require('./services/user-state-service');
const { createLoginLimiter, createApiWriteLimiter } = require('./services/rate-limit');
const {
  getSessionTokenFromReq,
  createAuthGate,
  createSameOriginMiddleware,
  createCsrfMiddleware
} = require('./middleware/auth');
const { applySecurityHeaders } = require('./middleware/security');
const { setNoStore, createStaticCacheOptions, applyVersionedRebuildAssetCache } = require('./middleware/cache-policy');
const { createPrecompressedStaticMiddleware } = require('./middleware/precompressed-static');
const { createAuthRouter } = require('./routes/auth-routes');
const { createStateRouter } = require('./routes/state-routes');
const { createThemeBootstrapRouter } = require('./routes/theme-bootstrap-routes');
const { createSyncStateService } = require('./services/sync-state-service');
const { createStateWriteService } = require('./services/state-write-service');
const { createSyncPolicyService } = require('./services/sync-policy-service');
const { createContentService } = require('./services/content-service');
const { createLibraryService } = require('./services/library-service');
const { createLibraryContentFingerprintService } = require('./services/library-content-fingerprint-service');
const { createLibraryVariantPreferenceService } = require('./services/library-variant-preference-service');
const { createNovelsRouter } = require('./routes/novels-routes');
const { createMetadataStoreService } = require('./services/metadata-store-service');
const { createMetadataPlaywrightService } = require('./services/metadata-playwright-service');
const { getMetadataProvider } = require('./services/metadata-provider-registry');
const { createMetadataTransportService } = require('./services/metadata-transport-service');
const { createMetadataCoverService } = require('./services/metadata-cover-service');
const { createMetadataService } = require('./services/metadata-service');
const { createMetadataRouter } = require('./routes/metadata-routes');
const { createFileopsService } = require('./services/fileops-service');
const { createFileopsRouter } = require('./routes/fileops-routes');
const { createFontService } = require('./services/font-service');
const { createFontRouter } = require('./routes/font-routes');
const { createRecoveryService } = require('./services/recovery-service');
const { createAuditLogService } = require('./services/audit-log-service');
const { createSignupCodeService } = require('./services/signup-code-service');
const { createAdminDiagnosticsService } = require('./services/admin-diagnostics-service');
const { createRecoveryRouter } = require('./routes/recovery-routes');
const { createDiagnosticsRouter } = require('./routes/diagnostics-routes');
const { createBlockManifestService } = require('./services/block-manifest-service');
const { createDiskCacheJanitorService } = require('./services/disk-cache-janitor-service');
const { createSearchPerformanceService } = require('./services/search-performance-service');
const { createSiteLanguageService } = require('./services/site-language-service');
const { createSiteLanguageRouter } = require('./routes/site-language-routes');
const { createBlockManifestRouter } = require('./routes/block-manifest-routes');
const { createUserAccessRouter } = require('./routes/user-access-routes');
const { createAdminUsersRouter, requireOwnerSession } = require('./routes/admin-users-routes');
const { getUserLibraryAccessFromRequest, createAccessibleNovelIdSet, isNovelAllowed, filterDeviceProfileByLibraryAccess, filterProgressByAllowedNovelIds, filterSharedStatePatchByAllowedNovelIds, filterStateResponseByAllowedNovelIds } = require('./services/library-access-service');
const stateNormalizer = require('./services/state-normalizer');
const { createApiErrorMiddleware } = require('./utils/async-route');
const { settleShutdownOperations } = require('./utils/shutdown');

assertProductionSecretPolicy();

const app = express();
app.disable('x-powered-by');
const KO_NUMERIC_COLLATOR = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });

const PUBLIC_ICON_ALIASES = new Map([
  ['/favicon.ico', 'icon/favicon.ico'],
  ['/apple-touch-icon.png', 'icon/apple-icon-180x180.png'],
  ['/apple-touch-icon-precomposed.png', 'icon/apple-icon-180x180.png']
]);
const PUBLIC_ICON_ALIAS_PASS = 'v524-public-icon-alias-before-auth-pass';

function sendPublicIconAlias(req, res, next) {
  const rel = PUBLIC_ICON_ALIASES.get(req.path);
  if (!rel) return next();
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.setHeader('Vary', 'Accept-Encoding');
  res.setHeader('X-Public-Icon-Alias', PUBLIC_ICON_ALIAS_PASS);
  return res.sendFile(path.join(paths.PUBLIC_DIR, rel));
}

const SESSION_STORE_PATH = paths.SESSION_STORE_PATH;
const CHUNK_INDEX_DIR = paths.CHUNK_INDEX_DIR;
const CONTENT_CHUNK_PAYLOAD_DIR = paths.CONTENT_CHUNK_PAYLOAD_DIR;
const NORMALIZED_CONTENT_CACHE_DIR = paths.NORMALIZED_CONTENT_CACHE_DIR;
const BLOCK_MANIFEST_CACHE_DIR = paths.BLOCK_MANIFEST_CACHE_DIR;
const SNAPSHOT_DIR = paths.SNAPSHOT_DIR;
const SYNC_SNAPSHOT_PREFIX = 'sync-state';

app.set('trust proxy', resolveTrustProxyValue(DEPLOYMENT_MODE));

ensureRuntimeDirectories();

// 보안 헤더는 body parser보다 먼저 적용해 malformed/oversized JSON 오류 응답도
// 동일한 CSP, HSTS, COOP 정책을 유지합니다.
app.use(applySecurityHeaders);

// 요청 본문 크기 제한: 기본값(100kb)이 CSS 80KB + 메타데이터를 충분히 수용하면서
// 대용량 페이로드를 통한 DoS 공격을 방어합니다.
app.use(express.json({ limit: '256kb' }));

// ─── 보안/세션/요청 제한 조립 ──────────────────────────────────────
const sessionStore = createSessionStore({
  storePath: SESSION_STORE_PATH,
  ttlMs: 7 * 24 * 60 * 60 * 1000,
  logger: console
});
sessionStore.load();
sessionStore.startCleanup();

const accountService = createAccountService({ accountsPath: paths.ACCOUNTS_PATH, logger: console });
accountService.load();

const auditLogService = createAuditLogService({ auditLogPath: paths.AUDIT_LOG_PATH, logger: console });
const signupCodeService = createSignupCodeService({ signupCodesPath: paths.SIGNUP_CODES_PATH, logger: console });
signupCodeService.load();
const siteLanguageService = createSiteLanguageService({
  siteLanguagesDir: paths.SITE_LANGUAGES_DIR,
  bundledSiteLanguagesDir: paths.SITE_LANGUAGE_PACKS_DIR,
  logger: console
});

const loginLimiter = createLoginLimiter({ max: 10, windowMs: 15 * 60 * 1000 });
const loginIpLimiter = createLoginLimiter({ max: 60, windowMs: 15 * 60 * 1000 });
const registerLimiter = createLoginLimiter({ max: 8, windowMs: 15 * 60 * 1000 });
const registerIpLimiter = createLoginLimiter({ max: 30, windowMs: 15 * 60 * 1000 });
const passwordChangeLimiter = createLoginLimiter({ max: 5, windowMs: 15 * 60 * 1000 });
const passwordChangeIpLimiter = createLoginLimiter({ max: 20, windowMs: 15 * 60 * 1000 });
const apiWriteLimiter = createApiWriteLimiter();
const requireSameOrigin = createSameOriginMiddleware({ getAllowedOrigins, requireStrictOrigin: REQUIRE_STRICT_ORIGIN });
const requireCsrf = createCsrfMiddleware({ sessionStore });
const requireOwnerOnly = requireOwnerSession(sessionStore);

function checkApiWriteLimit(req, scope, maxCount, windowMs) {
  return apiWriteLimiter.check(req, scope, maxCount, windowMs);
}

function requireUserSession(req, res, next) {
  const token = getSessionTokenFromReq(req);
  const session = sessionStore.getSession(token);
  if (!session || session.kind !== 'user') {
    return res.status(403).json({ ok: false, error: 'reader_user_session_required', message: 'Reader API requires a normal user session.' });
  }
  req.userSession = session;
  return next();
}

async function getStateLibraryAccessContext(req) {
  if (req && req.stateLibraryAccessContextPromise) return req.stateLibraryAccessContextPromise;
  const resolveContext = async () => {
    const auth = getUserLibraryAccessFromRequest(req, { sessionStore, accountService });
    if (!auth.ok || auth.access.mode === 'all') return { unrestricted:true, access:auth.access, allowedNovelIds:null, knownNovelIds:null };
    if (auth.access.mode === 'none') return { unrestricted:false, access:auth.access, allowedNovelIds:new Set(), knownNovelIds:new Set() };
    const library = typeof libraryService.getLibraryCachedForRequestAsync === 'function'
      ? await libraryService.getLibraryCachedForRequestAsync()
      : typeof libraryService.getLibraryCachedAsync === 'function'
        ? await libraryService.getLibraryCachedAsync()
        : libraryService.getLibraryCached();
    return { unrestricted:false, access:auth.access, allowedNovelIds:createAccessibleNovelIdSet(library, auth.access), knownNovelIds:new Set((Array.isArray(library) ? library : []).map(novel => novel && novel.id).filter(Boolean)) };
  };
  const promise = resolveContext();
  if (req) req.stateLibraryAccessContextPromise = promise;
  return promise;
}

async function filterStateForCurrentLibraryAccess(req, response) {
  const context = await getStateLibraryAccessContext(req);
  if (context.unrestricted) return response;
  return filterStateResponseByAllowedNovelIds(response, context.allowedNovelIds, context.access, context.knownNovelIds);
}

async function filterStateInputForCurrentLibraryAccess(req, kind, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  if (kind === 'progress-delta') {
    const snapshot = body.snapshot && typeof body.snapshot === 'object' && !Array.isArray(body.snapshot) ? body.snapshot : null;
    const novelId = String(snapshot?.novelId || '');
    if (!snapshot || !novelId) return { ...body, snapshot:null, _accessDenied:true };
    const auth = getUserLibraryAccessFromRequest(req, { sessionStore, accountService });
    if (!auth.ok || auth.access.mode === 'none') return { ...body, snapshot:null, _accessDenied:true };
    if (auth.access.mode === 'all') return body;
    const novel = typeof libraryService.getNovelByIdCachedAsync === 'function'
      ? await libraryService.getNovelByIdCachedAsync(novelId)
      : (await (typeof libraryService.getLibraryCachedForRequestAsync === 'function' ? libraryService.getLibraryCachedForRequestAsync() : libraryService.getLibraryCachedAsync())).find(item => String(item?.id || '') === novelId);
    return novel && isNovelAllowed(auth.access, novel) ? body : { ...body, snapshot:null, _accessDenied:true };
  }
  const context = await getStateLibraryAccessContext(req);
  if (context.unrestricted) return body;
  if (kind === 'shared') return filterSharedStatePatchByAllowedNovelIds(body, context.allowedNovelIds, context.knownNovelIds);
  if (kind === 'progress') {
    return Object.prototype.hasOwnProperty.call(body, 'progress')
      ? { ...body, progress:filterProgressByAllowedNovelIds(body.progress || {}, context.allowedNovelIds, context.knownNovelIds) }
      : body;
  }
  if (kind === 'device') return filterDeviceProfileByLibraryAccess(body, context.access);
  return body;
}

// ─── 보안 인증 미들웨어 ─────────────────────────────────────────────
// login.html 자체는 무조건 접근 허용하되 보안 헤더는 먼저 적용합니다.
app.get('/login.html', (req, res) => {
  setNoStore(res);
  return res.sendFile(path.join(paths.PUBLIC_DIR, 'login.html'));
});

app.get('/healthz', (req, res) => {
  setNoStore(res);
  return res.status(200).json({ ok: true, status: 'ok', build: BUILD_ID });
});


function sendCurrentServiceWorker(res) {
  setNoStore(res);
  res.setHeader('Service-Worker-Allowed', '/');
  res.type('text/javascript; charset=utf-8');
  return res.sendFile(path.join(paths.PUBLIC_DIR, 'sw.js'));
}

app.get('/sw.js', (req, res) => {
  return sendCurrentServiceWorker(res);
});

// The path, rather than only a query string, changes with every build. This
// prevents a CDN configured to ignore query strings from pinning an old worker.
app.get(`/sw-${BUILD_ID}.js`, (req, res) => {
  return sendCurrentServiceWorker(res);
});

// Keep the update coordinator outside /scripts/. An older active Service Worker
// intercepts versioned /scripts requests and can otherwise block the very code
// that installs and activates the next worker.
app.get('/service-worker-register.js', (req, res) => {
  setNoStore(res);
  res.type('text/javascript; charset=utf-8');
  return res.sendFile(path.join(paths.PUBLIC_DIR, 'scripts', 'service-worker-register.js'));
});

app.get('/offline.html', (req, res) => {
  setNoStore(res);
  return res.sendFile(path.join(paths.PUBLIC_DIR, 'offline.html'));
});

// 브라우저/PWA가 로그인 전에도 관례 경로 아이콘을 요청할 수 있으므로 auth gate 전에 정확한 alias만 허용합니다.
app.use(sendPublicIconAlias);

app.use(createAuthGate({ sessionStore, accountService }));

// ─── 인증 API ──────────────────────────────────────────────────────
app.use('/api', createAuthRouter({
  sessionStore,
  loginLimiter,
  loginIpLimiter,
  registerLimiter,
  registerIpLimiter,
  passwordChangeLimiter,
  passwordChangeIpLimiter,
  requireSameOrigin,
  requireCsrf,
  setNoStore,
  accountService,
  signupCodeService,
  auditLogService
}));

// Login responses use build-unique entry paths so even an old cached login page
// is forced onto current HTML immediately after authentication.
app.get(`/library-${BUILD_ID}.html`, (req, res) => {
  setNoStore(res);
  return res.sendFile(path.join(paths.PUBLIC_DIR, 'library.html'));
});

app.get(`/admin/users-${BUILD_ID}.html`, (req, res) => {
  const token = getSessionTokenFromReq(req);
  const session = sessionStore.getSession ? sessionStore.getSession(token) : null;
  setNoStore(res);
  if (!session || session.kind !== 'owner') return res.redirect('/login.html');
  return res.sendFile(path.join(paths.PUBLIC_DIR, 'admin', 'users.html'));
});

app.get('/admin/users.html', (req, res) => {
  const token = getSessionTokenFromReq(req);
  const session = sessionStore.getSession ? sessionStore.getSession(token) : null;
  setNoStore(res);
  if (!session || session.kind !== 'owner') return res.redirect('/login.html');
  return res.sendFile(path.join(paths.PUBLIC_DIR, 'admin', 'users.html'));
});

app.get('/metadata.html', (req, res) => {
  const token = getSessionTokenFromReq(req);
  const session = sessionStore.getSession ? sessionStore.getSession(token) : null;
  setNoStore(res);
  const allowed = !!(session && (session.kind === 'owner' || (session.kind === 'user' && typeof accountService.canUserMetadataAccess === 'function' && accountService.canUserMetadataAccess(session.userId))));
  if (!allowed) return res.redirect(303, '/library.html?notice=metadata_access_required');
  return res.sendFile(path.join(paths.PUBLIC_DIR, 'metadata.html'));
});

app.use(applyVersionedRebuildAssetCache);
app.use(createPrecompressedStaticMiddleware(paths.PUBLIC_DIR));
app.use(express.static(paths.PUBLIC_DIR, createStaticCacheOptions()));

// ─── 라이브러리/본문 서비스 ────────────────────────────────────────
const contentService = createContentService({
  chunkIndexDir: CHUNK_INDEX_DIR,
  chunkPayloadDir: CONTENT_CHUNK_PAYLOAD_DIR,
  normalizedContentDir: NORMALIZED_CONTENT_CACHE_DIR,
  maxTextFileBytes: MAX_TEXT_FILE_BYTES,
  fileCacheMaxBytes: CONTENT_FILE_CACHE_MAX_BYTES,
  fileCacheMax: CONTENT_FILE_CACHE_MAX_ENTRIES,
  workerThreadsEnabled: CONTENT_WORKER_THREADS_ENABLED,
  workerPoolSize: CONTENT_WORKER_POOL_SIZE,
  workerQueueMax: CONTENT_WORKER_QUEUE_MAX,
  workerIdleTtlMs: CONTENT_WORKER_IDLE_TTL_MS,
  mainThreadFallbackMaxBytes: CONTENT_MAIN_THREAD_FALLBACK_MAX_BYTES,
  diskCacheMinBytes: CONTENT_DISK_CACHE_MIN_BYTES
});
const libraryService = createLibraryService({
  libraryPath: LIBRARY_PATH,
  encodeStableId,
  collator: KO_NUMERIC_COLLATOR,
  contentService,
  libraryDeepSignatureCheckTtlMs: LIBRARY_DEEP_SIGNATURE_CHECK_TTL_MS,
  libraryDeepSignatureCheckMaxTtlMs: LIBRARY_DEEP_SIGNATURE_CHECK_MAX_TTL_MS,
  librarySignatureCheckConcurrency: LIBRARY_SIGNATURE_CHECK_CONCURRENCY,
  libraryRequestColdWaitMs: process.env.LIBRARY_REQUEST_COLD_WAIT_MS,
  catalogCachePath:paths.LIBRARY_CATALOG_CACHE_PATH,
  catalogCacheCompressionLevel:process.env.LIBRARY_CATALOG_CACHE_COMPRESSION_LEVEL,
  catalogCacheWriteDelayMs:process.env.LIBRARY_CATALOG_CACHE_WRITE_DELAY_MS,
  coldFailureBackoffBaseMs:process.env.LIBRARY_COLD_FAILURE_BACKOFF_BASE_MS,
  coldFailureBackoffMaxMs:process.env.LIBRARY_COLD_FAILURE_BACKOFF_MAX_MS,
  allowSynchronousColdBuild:false
});
void libraryService.warmLibraryCache().catch(error => {
  console.warn('library async warm-up failed:', error && error.message || error);
});

const libraryContentFingerprintService = createLibraryContentFingerprintService({
  cachePath:paths.LIBRARY_CONTENT_FINGERPRINT_PATH,
  libraryService,
  concurrency:process.env.LIBRARY_FINGERPRINT_CONCURRENCY,
  queueMax:process.env.LIBRARY_FINGERPRINT_QUEUE_MAX,
  sampleBytes:process.env.LIBRARY_FINGERPRINT_SAMPLE_BYTES,
  sampleChars:process.env.LIBRARY_FINGERPRINT_SAMPLE_CHARS,
  maxEntries:process.env.LIBRARY_FINGERPRINT_MAX_ENTRIES,
  freshnessMs:process.env.LIBRARY_FINGERPRINT_FRESHNESS_MS,
  backgroundBatch:process.env.LIBRARY_FINGERPRINT_BACKGROUND_BATCH,
  compressionLevel:process.env.LIBRARY_FINGERPRINT_COMPRESSION_LEVEL,
  logger:console
});
const libraryVariantPreferenceService = createLibraryVariantPreferenceService({
  storePath:paths.LIBRARY_VARIANT_PREFERENCE_PATH,
  logger:console
});

const userStateServiceManager = createUserStateServiceManager({ userDataDir: paths.USER_DATA_DIR, logger: console });

const metadataStoreService = createMetadataStoreService({
  storePath: paths.METADATA_STORE_PATH,
  appliedStorePath: paths.METADATA_APPLIED_STORE_PATH,
  logger: console,
  maxCandidates: process.env.METADATA_MAX_CANDIDATES,
  maxCandidatesPerWork: process.env.METADATA_MAX_CANDIDATES_PER_WORK,
  maxCandidateResidentBytes: process.env.METADATA_MAX_CANDIDATE_RESIDENT_BYTES,
  compressionLevel: process.env.METADATA_STORE_COMPRESSION_LEVEL
});
const metadataPlaywrightService = createMetadataPlaywrightService({
  profilesDir:paths.METADATA_BROWSER_PROFILE_DIR,
  statePath:paths.METADATA_BROWSER_PROFILE_STATE_PATH,
  providerResolver:getMetadataProvider,
  enabled:METADATA_PLAYWRIGHT_ENABLED,
  headless:METADATA_PLAYWRIGHT_HEADLESS,
  noSandbox:METADATA_PLAYWRIGHT_NO_SANDBOX,
  executablePath:METADATA_PLAYWRIGHT_EXECUTABLE_PATH || undefined,
  timeoutMs:METADATA_PLAYWRIGHT_TIMEOUT_MS,
  settleMs:METADATA_PLAYWRIGHT_SETTLE_MS,
  collectorIdleTtlMs:METADATA_PLAYWRIGHT_COLLECTOR_IDLE_TTL_MS,
  maxBytes:METADATA_RESPONSE_MAX_BYTES,
  logger:console
});
const metadataTransportService = createMetadataTransportService({
  timeoutMs: METADATA_REQUEST_TIMEOUT_MS,
  maxBytes: METADATA_RESPONSE_MAX_BYTES,
  maxImageBytes: METADATA_COVER_MAX_BYTES
});
const metadataCoverService = createMetadataCoverService({
  coverDir: paths.METADATA_COVER_DIR,
  transport: metadataTransportService,
  isAssetReferenced: assetId => metadataStoreService.hasCoverAsset(assetId),
  maxCacheBytes: METADATA_COVER_CACHE_MAX_BYTES,
  minOrphanAgeMs: METADATA_COVER_ORPHAN_MIN_AGE_MS,
  pruneIntervalMs: METADATA_COVER_PRUNE_INTERVAL_MS,
  maxDeletePerRun: METADATA_COVER_PRUNE_MAX_DELETE_PER_RUN,
  manualUploadMaxBytes: METADATA_COVER_MAX_BYTES,
  logger: console
});
const metadataService = createMetadataService({
  store: metadataStoreService,
  transport: metadataTransportService,
  coverService: metadataCoverService,
  playwrightService:metadataPlaywrightService,
  queuePath: paths.METADATA_QUEUE_PATH,
  bulkDir: paths.METADATA_BULK_DIR,
  enabled: METADATA_FETCH_ENABLED,
  requestIntervalMs: METADATA_REQUEST_INTERVAL_MS,
  concurrency: METADATA_QUEUE_CONCURRENCY,
  maxJobs: METADATA_QUEUE_MAX,
  autoApplyThreshold: METADATA_AUTO_APPLY_THRESHOLD,
  logger: console
});

app.use('/api', createSiteLanguageRouter({
  sessionStore,
  siteLanguageService,
  setNoStore,
  requireSameOrigin,
  requireCsrf,
  auditLogService
}));

app.use('/api', createAdminUsersRouter({
  sessionStore,
  accountService,
  libraryService,
  setNoStore,
  requireSameOrigin,
  requireCsrf,
  userStateServiceManager,
  auditLogService,
  signupCodeService,
  metadataService,
  libraryContentFingerprintService,
  libraryVariantPreferenceService,
  libraryFingerprintEntryDelayMs:process.env.LIBRARY_FINGERPRINT_ENTRY_DELAY_MS
}));

const blockManifestService = createBlockManifestService({
  libraryPath: LIBRARY_PATH,
  libraryService,
  contentService,
  manifestDiskCacheDir: BLOCK_MANIFEST_CACHE_DIR,
  folderSignatureCacheTtlMs: 5000,
  folderManifestHotCacheTtlMs: 5000,
  folderBlockManifestRadius: FOLDER_BLOCK_MANIFEST_RADIUS,
  episodeDiskCacheDuringFolderBuild: true
});

const searchPerformanceService = createSearchPerformanceService({ env: process.env });

const diskCacheJanitorService = createDiskCacheJanitorService({
  dataDir: paths.DATA_DIR,
  cacheDirs: [
    { label: 'chunk_indexes', dir: CHUNK_INDEX_DIR },
    { label: 'content_chunks', dir: CONTENT_CHUNK_PAYLOAD_DIR },
    { label: 'normalized_content', dir: NORMALIZED_CONTENT_CACHE_DIR },
    { label: 'block_manifests', dir: BLOCK_MANIFEST_CACHE_DIR }
  ],
  enabled: DISK_CACHE_AUTO_PRUNE_ENABLED,
  usagePct: DISK_CACHE_PRUNE_USAGE_PCT,
  targetUsagePct: DISK_CACHE_PRUNE_TARGET_USAGE_PCT,
  minFreeMb: DISK_CACHE_PRUNE_MIN_FREE_MB,
  targetFreeMb: DISK_CACHE_PRUNE_TARGET_FREE_MB,
  intervalMs: DISK_CACHE_PRUNE_INTERVAL_MS,
  minFileAgeMs: DISK_CACHE_PRUNE_MIN_FILE_AGE_MS,
  maxDeletePerRun: DISK_CACHE_PRUNE_MAX_DELETE_PER_RUN,
  isPathProtected: (candidatePath) => contentService.isDiskCachePathInUse(candidatePath),
  logger: console
});

const fileopsService = createFileopsService({
  libraryService,
  logger: console,
  onMutation: () => blockManifestService.clearManifestCache(),
  mutationQueueMax: FILEOPS_MUTATION_QUEUE_MAX,
  mutationWaitTimeoutMs: FILEOPS_MUTATION_WAIT_TIMEOUT_MS,
  mutationWatchdogMs: FILEOPS_MUTATION_WATCHDOG_MS
});

app.use('/api', createFileopsRouter({
  fileopsService,
  requireSameOrigin,
  requireCsrf,
  requireOwnerSession: requireOwnerOnly,
  sessionStore,
  accountService,
  auditLogService
}));

// ─── 공유 폰트 라이브러리 API ─────────────────────────────────────
const fontService = createFontService({
  fontDir: paths.FONT_DIR,
  fontMetaPath: paths.FONT_META_PATH,
  userDataDir: paths.USER_DATA_DIR,
  legacyFontDir: paths.LEGACY_FONT_DIR,
  legacyFontMetaPath: paths.LEGACY_FONT_META_PATH
});

app.use('/api', createFontRouter({
  fontService,
  requireSameOrigin,
  requireCsrf,
  checkApiWriteLimit,
  sessionStore,
  getSessionTokenFromReq,
  requireOwnerSession: requireOwnerOnly,
  auditLogService
}));

// ─── 동기화(Sync) API ──────────────────────────────────────────────
const fsSyncPath = paths.SYNC_DATA_PATH;

const syncStateService = createSyncStateService({
  syncPath: fsSyncPath,
  legacySyncPath: paths.LEGACY_SYNC_DATA_PATH,
  snapshotDir: SNAPSHOT_DIR,
  snapshotPrefix: SYNC_SNAPSHOT_PREFIX,
  createEmptyState: stateNormalizer.createEmptyUserState,
  normalizeState: stateNormalizer.normalizeUserState,
  applyProgressJournalEntry: stateNormalizer.applyProgressJournalEntry,
  logger: console
});

const syncPolicyService = createSyncPolicyService({
  normalizer: stateNormalizer
});

const stateWriteService = createStateWriteService({
  syncStateService,
  normalizer: stateNormalizer,
  syncPolicyService
});

app.use('/api', createThemeBootstrapRouter({
  setNoStore,
  sessionStore,
  getSessionTokenFromReq,
  userStateServiceManager
}));

app.use('/api', createStateRouter({
  setNoStore,
  requireSameOrigin,
  requireCsrf,
  checkApiWriteLimit,
  stateWriteService,
  requireUserSession,
  filterStateResponse: filterStateForCurrentLibraryAccess,
  filterStateInput: filterStateInputForCurrentLibraryAccess,
  resolveStateWriteService: (req) => {
    const token = getSessionTokenFromReq(req);
    const session = sessionStore.getSession(token);
    return userStateServiceManager.getForSession(session);
  }
}));


app.use('/api', createUserAccessRouter({
  setNoStore,
  sessionStore,
  accountService,
  libraryService
}));

app.use('/api', createNovelsRouter({
  setNoStore,
  libraryPath: LIBRARY_PATH,
  libraryService,
  contentService,
  sessionStore,
  accountService,
  userStateServiceManager,
  metadataService,
  libraryContentFingerprintService,
  libraryVariantPreferenceService,
  libraryFingerprintEntryDelayMs:process.env.LIBRARY_FINGERPRINT_ENTRY_DELAY_MS,
  libraryShelfBuildConcurrency:process.env.LIBRARY_SHELF_BUILD_CONCURRENCY,
  libraryShelfBuildMaxPending:process.env.LIBRARY_SHELF_BUILD_MAX_PENDING
}));

app.use('/api', createMetadataRouter({
  metadataService,
  coverService: metadataCoverService,
  libraryService,
  sessionStore,
  accountService,
  requireSameOrigin,
  requireCsrf,
  checkApiWriteLimit,
  playwrightService:metadataPlaywrightService,
  libraryContentFingerprintService,
  libraryVariantPreferenceService
}));

// ─── 블럭 매니페스트 API ──────────────────────────────────────────
app.use('/api', createBlockManifestRouter({
  blockManifestService,
  libraryService,
  setNoStore,
  sessionStore,
  accountService
}));


// ─── 복구/진단 API ──────────────────────────────────────────────────
const recoveryService = createRecoveryService({
  syncDataPath: fsSyncPath,
  sessionStorePath: SESSION_STORE_PATH,
  fontMetaPath: paths.FONT_META_PATH,
  snapshotDir: SNAPSHOT_DIR,
  snapshotPrefix: SYNC_SNAPSHOT_PREFIX,
  libraryService,
  contentService,
  syncStateService
});

app.use('/api', createRecoveryRouter({
  recoveryService,
  setNoStore,
  requireOwnerSession: requireOwnerOnly
}));

const adminDiagnosticsService = createAdminDiagnosticsService({
  paths,
  env: require('./config/env'),
  sessionStore,
  accountService,
  auditLogService,
  libraryService,
  contentService,
  blockManifestService,
  diskCacheJanitorService,
  libraryContentFingerprintService,
  libraryVariantPreferenceService,
  metadataService
});

app.use('/api', createDiagnosticsRouter({
  setNoStore,
  requireOwnerSession: requireOwnerOnly,
  adminDiagnosticsService,
  auditLogService,
  searchPerformanceService
}));

// Keep API failures JSON-shaped, including rejected async handlers under Express 4.
app.use('/api', createApiErrorMiddleware({ logger: console }));

// ───────────────────────────────────────────────────────────────────

diskCacheJanitorService.start();

const fileCachePruneTimer = setInterval(() => {
  try { contentService.pruneFileCache(false); } catch (e) {}
}, 5 * 60 * 1000);
if (typeof fileCachePruneTimer.unref === 'function') fileCachePruneTimer.unref();

function start(port = PORT, host = HOST) {
  const listenHost = String(host || '').trim();
  const onListen = () => {
    const bindLabel = listenHost || '0.0.0.0/default';
    console.log(`📚 웹소설 리더 실행 중: http://${listenHost || 'localhost'}:${port}`);
    console.log(`🌐 배포 모드: ${DEPLOYMENT_MODE} · bind: ${bindLabel}`);
    console.log(`📁 라이브러리 경로: ${LIBRARY_PATH}`);
  };
  return listenHost ? app.listen(port, listenHost, onListen) : app.listen(port, onListen);
}

async function stop() {
  clearInterval(fileCachePruneTimer);
  try { sessionStore.stopCleanup(); } catch {}
  const operations = [
    async () => { const closed = await contentService.closeWorkerPool(); await contentService.flushChunkIndexWrites(); return closed; },
    () => diskCacheJanitorService.stop(),
    () => metadataService.stop(),
    () => metadataCoverService.stop(),
    () => sessionStore.close(),
    () => syncStateService.close(),
    () => userStateServiceManager.closeAll(),
    () => libraryService.closeDurableCatalogCache(),
    () => libraryContentFingerprintService.stop(),
    () => libraryVariantPreferenceService.stop(),
    () => auditLogService.stop()
  ];
  // Deferring each call ensures a synchronous throw is captured without preventing
  // the remaining persistence and worker shutdown operations from running.
  const primaryResults = await settleShutdownOperations(operations);
  // Active metadata jobs may still use a collector context while metadataService.stop()
  // drains the queue. Close Playwright only after that drain has settled.
  const [playwrightResult] = await settleShutdownOperations([() => metadataPlaywrightService.stop()]);
  const results = [...primaryResults.slice(0, 8), playwrightResult, ...primaryResults.slice(8)];
  const names = ['content-worker-pool','disk-cache-janitor','metadata','metadata-cover','session-store','sync-state','user-state','library-catalog-cache','metadata-playwright','library-fingerprint','library-variant-preference','audit-log'];
  const failures = [];
  results.forEach((result, index) => {
    const name = names[index];
    if (result.status === 'rejected') {
      failures.push({ name, error:String(result.reason && result.reason.message || result.reason) });
      return;
    }
    const value = result.value;
    if (value === false || (value && value.ok === false) || (name === 'content-worker-pool' && value && Number(value.terminationFailures) > 0)) failures.push({ name, error:String(value && (value.error || (value.terminationFailures ? `${value.terminationFailures} worker termination(s) failed` : '')) || 'shutdown flush failed') });
    if (name === 'user-state' && Array.isArray(value)) {
      value.filter(item => item && item.success === false).forEach(item => failures.push({ name:`user-state:${item.owner || 'unknown'}`, error:String(item.error || 'shutdown flush failed') }));
    }
  });
  if (failures.length) {
    const error = new Error(`shutdown persistence failed: ${failures.map(item => `${item.name}=${item.error}`).join('; ')}`);
    error.code = 'SHUTDOWN_PERSISTENCE_FAILED';
    error.failures = failures;
    throw error;
  }
  return results;
}

module.exports = {
  app,
  start,
  stop
};
