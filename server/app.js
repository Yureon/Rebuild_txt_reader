const express = require('express');
const path = require('path');
const { PORT, HOST, LIBRARY_PATH, DEPLOYMENT_MODE, REQUIRE_STRICT_ORIGIN, LIBRARY_DEEP_SIGNATURE_CHECK_TTL_MS, MAX_TEXT_FILE_BYTES, CONTENT_FILE_CACHE_MAX_BYTES, CONTENT_FILE_CACHE_MAX_ENTRIES, CONTENT_WORKER_THREADS_ENABLED, CONTENT_WORKER_POOL_SIZE, FOLDER_BLOCK_MANIFEST_RADIUS, DISK_CACHE_AUTO_PRUNE_ENABLED, DISK_CACHE_PRUNE_USAGE_PCT, DISK_CACHE_PRUNE_TARGET_USAGE_PCT, DISK_CACHE_PRUNE_MIN_FREE_MB, DISK_CACHE_PRUNE_TARGET_FREE_MB, DISK_CACHE_PRUNE_INTERVAL_MS, DISK_CACHE_PRUNE_MIN_FILE_AGE_MS, DISK_CACHE_PRUNE_MAX_DELETE_PER_RUN, resolveTrustProxyValue } = require('./config/env');
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
const { createSyncStateService } = require('./services/sync-state-service');
const { createStateWriteService } = require('./services/state-write-service');
const { createSyncPolicyService } = require('./services/sync-policy-service');
const { createContentService } = require('./services/content-service');
const { createLibraryService } = require('./services/library-service');
const { createNovelsRouter } = require('./routes/novels-routes');
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
const { getUserLibraryAccessFromRequest, filterStateResponseByLibraryAccess } = require('./services/library-access-service');
const stateNormalizer = require('./services/state-normalizer');

const app = express();
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
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('X-Public-Icon-Alias', PUBLIC_ICON_ALIAS_PASS);
  return res.sendFile(path.join(paths.PUBLIC_DIR, rel));
}

const SESSION_STORE_PATH = paths.SESSION_STORE_PATH;
const CHUNK_INDEX_DIR = paths.CHUNK_INDEX_DIR;
const CONTENT_CHUNK_PAYLOAD_DIR = paths.CONTENT_CHUNK_PAYLOAD_DIR;
const BLOCK_MANIFEST_CACHE_DIR = paths.BLOCK_MANIFEST_CACHE_DIR;
const SNAPSHOT_DIR = paths.SNAPSHOT_DIR;
const SYNC_SNAPSHOT_PREFIX = 'sync-state';

app.set('trust proxy', resolveTrustProxyValue(DEPLOYMENT_MODE));

ensureRuntimeDirectories();

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

function filterStateForCurrentLibraryAccess(req, response) {
  const auth = getUserLibraryAccessFromRequest(req, { sessionStore, accountService });
  if (!auth.ok) return response;
  return filterStateResponseByLibraryAccess(response, libraryService.getLibraryCached(), auth.access);
}

// ─── 보안 인증 미들웨어 ─────────────────────────────────────────────
app.use(applySecurityHeaders);

// login.html 자체는 무조건 접근 허용하되 보안 헤더는 먼저 적용합니다.
app.get('/login.html', (req, res) => {
  setNoStore(res);
  return res.sendFile(path.join(paths.PUBLIC_DIR, 'login.html'));
});

app.get('/healthz', (req, res) => {
  setNoStore(res);
  return res.status(200).json({ ok: true, status: 'ok' });
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
  requireSameOrigin,
  requireCsrf,
  setNoStore,
  accountService,
  signupCodeService,
  auditLogService
}));

app.get('/admin/users.html', (req, res) => {
  const token = getSessionTokenFromReq(req);
  const session = sessionStore.getSession ? sessionStore.getSession(token) : null;
  setNoStore(res);
  if (!session || session.kind !== 'owner') return res.redirect('/login.html');
  return res.sendFile(path.join(paths.PUBLIC_DIR, 'admin', 'users.html'));
});

app.use(applyVersionedRebuildAssetCache);
app.use(createPrecompressedStaticMiddleware(paths.PUBLIC_DIR));
app.use(express.static(paths.PUBLIC_DIR, createStaticCacheOptions()));

// ─── 라이브러리/본문 서비스 ────────────────────────────────────────
const contentService = createContentService({
  chunkIndexDir: CHUNK_INDEX_DIR,
  chunkPayloadDir: CONTENT_CHUNK_PAYLOAD_DIR,
  maxTextFileBytes: MAX_TEXT_FILE_BYTES,
  fileCacheMaxBytes: CONTENT_FILE_CACHE_MAX_BYTES,
  fileCacheMax: CONTENT_FILE_CACHE_MAX_ENTRIES,
  workerThreadsEnabled: CONTENT_WORKER_THREADS_ENABLED,
  workerPoolSize: CONTENT_WORKER_POOL_SIZE
});
const libraryService = createLibraryService({
  libraryPath: LIBRARY_PATH,
  encodeStableId,
  collator: KO_NUMERIC_COLLATOR,
  contentService,
  libraryDeepSignatureCheckTtlMs: LIBRARY_DEEP_SIGNATURE_CHECK_TTL_MS
});

const userStateServiceManager = createUserStateServiceManager({ userDataDir: paths.USER_DATA_DIR, logger: console });

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
  signupCodeService
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
  logger: console
});

const fileopsService = createFileopsService({
  libraryService,
  logger: console,
  onMutation: () => blockManifestService.clearManifestCache()
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
  snapshotDir: SNAPSHOT_DIR,
  snapshotPrefix: SYNC_SNAPSHOT_PREFIX,
  createEmptyState: stateNormalizer.createEmptyUserState,
  normalizeState: stateNormalizer.normalizeUserState,
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

app.use('/api', createStateRouter({
  setNoStore,
  requireSameOrigin,
  requireCsrf,
  checkApiWriteLimit,
  stateWriteService,
  requireUserSession,
  filterStateResponse: filterStateForCurrentLibraryAccess,
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
  accountService
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
  diskCacheJanitorService
});

app.use('/api', createDiagnosticsRouter({
  setNoStore,
  requireOwnerSession: requireOwnerOnly,
  adminDiagnosticsService,
  auditLogService,
  searchPerformanceService
}));

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

module.exports = {
  app,
  start
};
