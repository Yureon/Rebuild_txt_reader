
const { createTrustedProxyPredicate, parseTrustedProxyCidrs, V676_TRUSTED_PROXY_SOURCE_PASS } = require('../services/trusted-proxy-policy');

const KNOWN_INSECURE_SECRET_VALUES = new Set([
  'change_this_to_14_chars_or_more',
  'change_this_to_a_long_random_secret_32_chars_or_more',
  'change_this_to_10_chars_or_more',
  'your_password',
  'your_local_password',
  'txt-reader-dev-session-store-secret'
]);

function isKnownInsecureSecret(value) {
  const normalized = String(value == null ? '' : value).trim().toLowerCase();
  return !!normalized && KNOWN_INSECURE_SECRET_VALUES.has(normalized);
}

const PORT = process.env.PORT || 3000;
const HOST = String(process.env.HOST || '').trim();
const LIBRARY_PATH = process.env.LIBRARY_PATH || '/library';

function joinConfiguredOrigins() {
  return [process.env.APP_ORIGIN, process.env.URL]
    .filter(function(value) { return typeof value === 'string' && value.trim(); })
    .join(',')
    .trim();
}

function normalizeDeploymentMode(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'trusted-proxy' || raw === 'cloudflare-tunnel' || raw === 'direct') return raw;
  return 'direct';
}

function parseNonNegativeInteger(value, fallback) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return fallback;
  const num = Number(raw);
  if (Number.isInteger(num) && num >= 0) return num;
  return fallback;
}

function parseBoundedInteger(value, fallback, min, max) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return fallback;
  const num = Number(raw);
  if (!Number.isInteger(num)) return fallback;
  const low = Number.isInteger(min) ? min : num;
  const high = Number.isInteger(max) ? max : num;
  return Math.min(high, Math.max(low, num));
}

function parseBooleanFlag(value, fallback = false) {
  const raw = String(value == null ? '' : value).trim().toLowerCase();
  if (!raw) return !!fallback;
  if (raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes') return true;
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'no') return false;
  return !!fallback;
}

function parseTrustProxy(value, fallback) {
  const raw = String(value == null ? '' : value).trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'no') return false;
  if (raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes') return 1;
  const num = Number(raw);
  if (Number.isInteger(num) && num >= 0) return num;
  return fallback;
}

const DEPLOYMENT_MODE = normalizeDeploymentMode(process.env.DEPLOYMENT_MODE);
const CLIENT_IP_HEADER = String(process.env.CLIENT_IP_HEADER || '').trim().toLowerCase();
const TRUSTED_PROXY_CIDRS = parseTrustedProxyCidrs(process.env.TRUSTED_PROXY_CIDRS);
const REQUIRE_STRICT_ORIGIN = parseBooleanFlag(process.env.REQUIRE_STRICT_ORIGIN, process.env.NODE_ENV === 'production');
const LIBRARY_DEEP_SIGNATURE_CHECK_TTL_MS = parseNonNegativeInteger(process.env.LIBRARY_DEEP_SIGNATURE_CHECK_TTL_MS, 30000);
const LIBRARY_DEEP_SIGNATURE_CHECK_MAX_TTL_MS = parseNonNegativeInteger(process.env.LIBRARY_DEEP_SIGNATURE_CHECK_MAX_TTL_MS, 300000);
const LIBRARY_SIGNATURE_CHECK_CONCURRENCY = parseBoundedInteger(process.env.LIBRARY_SIGNATURE_CHECK_CONCURRENCY, 8, 1, 32);
const MAX_TEXT_FILE_BYTES = parseNonNegativeInteger(process.env.MAX_TEXT_FILE_BYTES, 100 * 1024 * 1024);
const CONTENT_FILE_CACHE_MAX_BYTES = parseNonNegativeInteger(process.env.CONTENT_FILE_CACHE_MAX_BYTES, Math.max(128 * 1024 * 1024, MAX_TEXT_FILE_BYTES + (32 * 1024 * 1024)));
const CONTENT_FILE_CACHE_MAX_ENTRIES = parseBoundedInteger(process.env.CONTENT_FILE_CACHE_MAX_ENTRIES, 16, 1, 256);
const CONTENT_WORKER_THREADS_ENABLED = parseBooleanFlag(process.env.CONTENT_WORKER_THREADS_ENABLED, true);
const CONTENT_WORKER_POOL_SIZE = parseBoundedInteger(process.env.CONTENT_WORKER_POOL_SIZE, 0, 0, 32);
const CONTENT_WORKER_QUEUE_MAX = parseBoundedInteger(process.env.CONTENT_WORKER_QUEUE_MAX, 8, 0, 1024);
const CONTENT_WORKER_IDLE_TTL_MS = parseBoundedInteger(process.env.CONTENT_WORKER_IDLE_TTL_MS, 30000, 1000, 10 * 60 * 1000);
const CONTENT_MAIN_THREAD_FALLBACK_MAX_BYTES = parseNonNegativeInteger(process.env.CONTENT_MAIN_THREAD_FALLBACK_MAX_BYTES, 8 * 1024 * 1024);
const CONTENT_DISK_CACHE_MIN_BYTES = parseNonNegativeInteger(process.env.CONTENT_DISK_CACHE_MIN_BYTES, 1024 * 1024);
const FOLDER_BLOCK_MANIFEST_RADIUS = parseBoundedInteger(process.env.FOLDER_BLOCK_MANIFEST_RADIUS, 5, 0, 200);
const OWNER_PASSWORD_MIN_LENGTH = parseBoundedInteger(process.env.OWNER_PASSWORD_MIN_LENGTH, 14, 10, 128);
const USER_PASSWORD_MIN_LENGTH = parseBoundedInteger(process.env.USER_PASSWORD_MIN_LENGTH, 8, 8, 128);
const ALLOW_CLOUDFLARE_INSIGHTS = parseBooleanFlag(process.env.ALLOW_CLOUDFLARE_INSIGHTS, false);
const ALLOW_BLOB_WORKER = parseBooleanFlag(process.env.ALLOW_BLOB_WORKER, false);
const DISK_CACHE_AUTO_PRUNE_ENABLED = parseBooleanFlag(process.env.DISK_CACHE_AUTO_PRUNE_ENABLED, true);
const DISK_CACHE_PRUNE_USAGE_PCT = parseBoundedInteger(process.env.DISK_CACHE_PRUNE_USAGE_PCT, 85, 1, 99);
const DISK_CACHE_PRUNE_TARGET_USAGE_PCT = parseBoundedInteger(process.env.DISK_CACHE_PRUNE_TARGET_USAGE_PCT, 80, 1, 98);
const DISK_CACHE_PRUNE_MIN_FREE_MB = parseNonNegativeInteger(process.env.DISK_CACHE_PRUNE_MIN_FREE_MB, 2048);
const DISK_CACHE_PRUNE_TARGET_FREE_MB = parseNonNegativeInteger(process.env.DISK_CACHE_PRUNE_TARGET_FREE_MB, 4096);
const DISK_CACHE_PRUNE_INTERVAL_MS = parseBoundedInteger(process.env.DISK_CACHE_PRUNE_INTERVAL_MS, 5 * 60 * 1000, 60 * 1000, 24 * 60 * 60 * 1000);
const DISK_CACHE_PRUNE_MIN_FILE_AGE_MS = parseBoundedInteger(process.env.DISK_CACHE_PRUNE_MIN_FILE_AGE_MS, 60 * 1000, 0, 24 * 60 * 60 * 1000);
const DISK_CACHE_PRUNE_MAX_DELETE_PER_RUN = parseBoundedInteger(process.env.DISK_CACHE_PRUNE_MAX_DELETE_PER_RUN, 5000, 1, 50000);
const FILEOPS_MUTATION_QUEUE_MAX = parseBoundedInteger(process.env.FILEOPS_MUTATION_QUEUE_MAX, 64, 1, 4096);
const FILEOPS_MUTATION_WAIT_TIMEOUT_MS = parseBoundedInteger(process.env.FILEOPS_MUTATION_WAIT_TIMEOUT_MS, 30000, 1000, 10 * 60 * 1000);
const FILEOPS_MUTATION_WATCHDOG_MS = parseBoundedInteger(process.env.FILEOPS_MUTATION_WATCHDOG_MS, 120000, 5000, 24 * 60 * 60 * 1000);

const METADATA_FETCH_ENABLED = parseBooleanFlag(process.env.METADATA_FETCH_ENABLED, true);
const METADATA_PLAYWRIGHT_ENABLED = parseBooleanFlag(process.env.METADATA_PLAYWRIGHT_ENABLED, true);
const METADATA_PLAYWRIGHT_HEADLESS = parseBooleanFlag(process.env.METADATA_PLAYWRIGHT_HEADLESS, true);
const METADATA_PLAYWRIGHT_NO_SANDBOX = parseBooleanFlag(process.env.METADATA_PLAYWRIGHT_NO_SANDBOX, false);
const METADATA_PLAYWRIGHT_EXECUTABLE_PATH = String(process.env.METADATA_PLAYWRIGHT_EXECUTABLE_PATH || '').trim();
const METADATA_PLAYWRIGHT_TIMEOUT_MS = parseBoundedInteger(process.env.METADATA_PLAYWRIGHT_TIMEOUT_MS, 30000, 5000, 120000);
const METADATA_PLAYWRIGHT_SETTLE_MS = parseBoundedInteger(process.env.METADATA_PLAYWRIGHT_SETTLE_MS, 900, 0, 10000);
const METADATA_PLAYWRIGHT_COLLECTOR_IDLE_TTL_MS = parseBoundedInteger(process.env.METADATA_PLAYWRIGHT_COLLECTOR_IDLE_TTL_MS, 90000, 15000, 600000);
const METADATA_REQUEST_TIMEOUT_MS = parseBoundedInteger(process.env.METADATA_REQUEST_TIMEOUT_MS, 10000, 1000, 30000);
const METADATA_RESPONSE_MAX_BYTES = parseBoundedInteger(process.env.METADATA_RESPONSE_MAX_BYTES, 2 * 1024 * 1024, 64 * 1024, 16 * 1024 * 1024);
const METADATA_COVER_MAX_BYTES = parseBoundedInteger(process.env.METADATA_COVER_MAX_BYTES, 5 * 1024 * 1024, 64 * 1024, 20 * 1024 * 1024);
const METADATA_COVER_CACHE_MAX_BYTES = parseBoundedInteger(process.env.METADATA_COVER_CACHE_MAX_BYTES, 2 * 1024 * 1024 * 1024, 16 * 1024 * 1024, Number.MAX_SAFE_INTEGER);
const METADATA_COVER_ORPHAN_MIN_AGE_MS = parseBoundedInteger(process.env.METADATA_COVER_ORPHAN_MIN_AGE_MS, 7 * 24 * 60 * 60 * 1000, 0, 365 * 24 * 60 * 60 * 1000);
const METADATA_COVER_PRUNE_INTERVAL_MS = parseBoundedInteger(process.env.METADATA_COVER_PRUNE_INTERVAL_MS, 6 * 60 * 60 * 1000, 60 * 1000, 30 * 24 * 60 * 60 * 1000);
const METADATA_COVER_PRUNE_MAX_DELETE_PER_RUN = parseBoundedInteger(process.env.METADATA_COVER_PRUNE_MAX_DELETE_PER_RUN, 200, 1, 10000);
const METADATA_REQUEST_INTERVAL_MS = parseBoundedInteger(process.env.METADATA_REQUEST_INTERVAL_MS, 3000, 3000, 60000);
const METADATA_QUEUE_CONCURRENCY = parseBoundedInteger(process.env.METADATA_QUEUE_CONCURRENCY, 1, 1, 4);
const METADATA_QUEUE_MAX = parseBoundedInteger(process.env.METADATA_QUEUE_MAX, 2000, 10, 20000);
const METADATA_AUTO_APPLY_THRESHOLD = Math.max(0.7, Math.min(1, Number(process.env.METADATA_AUTO_APPLY_THRESHOLD) || 0.95));



function assertProductionSecretPolicy(options = {}) {
  if (process.env.NODE_ENV !== 'production') return { ok:true, production:false };
  const adminPassword = String(options.adminPassword == null ? (process.env.LOGINPW || process.env.LoginPW || '') : options.adminPassword).trim();
  if (adminPassword && (adminPassword.length < OWNER_PASSWORD_MIN_LENGTH || isKnownInsecureSecret(adminPassword))) {
    const error = new Error(`LOGINPW must be at least ${OWNER_PASSWORD_MIN_LENGTH} characters and must not use a published example value in production.`);
    error.code = 'PRODUCTION_OWNER_PASSWORD_INSECURE';
    throw error;
  }
  return { ok:true, production:true };
}

function resolveTrustProxyValue(mode = DEPLOYMENT_MODE) {
  if (mode === 'direct') return false;
  const raw = String(process.env.TRUST_PROXY == null ? '' : process.env.TRUST_PROXY).trim().toLowerCase();
  if (raw && ['0','false','off','no'].includes(raw)) return false;
  return createTrustedProxyPredicate(process.env.TRUSTED_PROXY_CIDRS);
}

// APP_ORIGIN and URL are both accepted for compatibility. When both are set,
// merge them instead of letting APP_ORIGIN shadow URL; deployments often keep
// the internal LAN URL and the external reverse-proxy URL in separate vars.
const APP_ORIGIN = joinConfiguredOrigins();
const ADMIN_ID = process.env.LOGINID || process.env.LoginID;
const ADMIN_PW = process.env.LOGINPW || process.env.LoginPW;

module.exports = {
  PORT,
  HOST,
  LIBRARY_PATH,
  APP_ORIGIN,
  ADMIN_ID,
  ADMIN_PW,
  DEPLOYMENT_MODE,
  CLIENT_IP_HEADER,
  TRUSTED_PROXY_CIDRS,
  V675_TRUSTED_PROXY_SOURCE_PASS:V676_TRUSTED_PROXY_SOURCE_PASS,
  V676_TRUSTED_PROXY_SOURCE_PASS,
  REQUIRE_STRICT_ORIGIN,
  LIBRARY_DEEP_SIGNATURE_CHECK_TTL_MS,
  LIBRARY_DEEP_SIGNATURE_CHECK_MAX_TTL_MS,
  LIBRARY_SIGNATURE_CHECK_CONCURRENCY,
  MAX_TEXT_FILE_BYTES,
  CONTENT_FILE_CACHE_MAX_BYTES,
  CONTENT_FILE_CACHE_MAX_ENTRIES,
  CONTENT_WORKER_THREADS_ENABLED,
  CONTENT_WORKER_POOL_SIZE,
  CONTENT_WORKER_QUEUE_MAX,
  CONTENT_WORKER_IDLE_TTL_MS,
  CONTENT_MAIN_THREAD_FALLBACK_MAX_BYTES,
  CONTENT_DISK_CACHE_MIN_BYTES,
  FOLDER_BLOCK_MANIFEST_RADIUS,
  OWNER_PASSWORD_MIN_LENGTH,
  USER_PASSWORD_MIN_LENGTH,
  ALLOW_CLOUDFLARE_INSIGHTS,
  ALLOW_BLOB_WORKER,
  DISK_CACHE_AUTO_PRUNE_ENABLED,
  DISK_CACHE_PRUNE_USAGE_PCT,
  DISK_CACHE_PRUNE_TARGET_USAGE_PCT,
  DISK_CACHE_PRUNE_MIN_FREE_MB,
  DISK_CACHE_PRUNE_TARGET_FREE_MB,
  DISK_CACHE_PRUNE_INTERVAL_MS,
  DISK_CACHE_PRUNE_MIN_FILE_AGE_MS,
  DISK_CACHE_PRUNE_MAX_DELETE_PER_RUN,
  FILEOPS_MUTATION_QUEUE_MAX,
  FILEOPS_MUTATION_WAIT_TIMEOUT_MS,
  FILEOPS_MUTATION_WATCHDOG_MS,
  METADATA_FETCH_ENABLED,
  METADATA_PLAYWRIGHT_ENABLED,
  METADATA_PLAYWRIGHT_HEADLESS,
  METADATA_PLAYWRIGHT_NO_SANDBOX,
  METADATA_PLAYWRIGHT_EXECUTABLE_PATH,
  METADATA_PLAYWRIGHT_TIMEOUT_MS,
  METADATA_PLAYWRIGHT_SETTLE_MS,
  METADATA_PLAYWRIGHT_COLLECTOR_IDLE_TTL_MS,
  METADATA_REQUEST_TIMEOUT_MS,
  METADATA_RESPONSE_MAX_BYTES,
  METADATA_COVER_MAX_BYTES,
  METADATA_COVER_CACHE_MAX_BYTES,
  METADATA_COVER_ORPHAN_MIN_AGE_MS,
  METADATA_COVER_PRUNE_INTERVAL_MS,
  METADATA_COVER_PRUNE_MAX_DELETE_PER_RUN,
  METADATA_REQUEST_INTERVAL_MS,
  METADATA_QUEUE_CONCURRENCY,
  METADATA_QUEUE_MAX,
  METADATA_AUTO_APPLY_THRESHOLD,
  joinConfiguredOrigins,
  normalizeDeploymentMode,
  parseNonNegativeInteger,
  parseBoundedInteger,
  parseBooleanFlag,
  resolveTrustProxyValue,
  isKnownInsecureSecret,
  assertProductionSecretPolicy,
  KNOWN_INSECURE_SECRET_VALUES
};
