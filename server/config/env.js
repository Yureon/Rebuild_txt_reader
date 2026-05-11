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
const REQUIRE_STRICT_ORIGIN = parseBooleanFlag(process.env.REQUIRE_STRICT_ORIGIN, process.env.NODE_ENV === 'production');
const LIBRARY_DEEP_SIGNATURE_CHECK_TTL_MS = parseNonNegativeInteger(process.env.LIBRARY_DEEP_SIGNATURE_CHECK_TTL_MS, 2000);
const MAX_TEXT_FILE_BYTES = parseNonNegativeInteger(process.env.MAX_TEXT_FILE_BYTES, 100 * 1024 * 1024);
const CONTENT_FILE_CACHE_MAX_BYTES = parseNonNegativeInteger(process.env.CONTENT_FILE_CACHE_MAX_BYTES, Math.max(128 * 1024 * 1024, MAX_TEXT_FILE_BYTES + (32 * 1024 * 1024)));
const CONTENT_FILE_CACHE_MAX_ENTRIES = parseBoundedInteger(process.env.CONTENT_FILE_CACHE_MAX_ENTRIES, 16, 1, 256);
const CONTENT_WORKER_THREADS_ENABLED = parseBooleanFlag(process.env.CONTENT_WORKER_THREADS_ENABLED, true);
const CONTENT_WORKER_POOL_SIZE = parseBoundedInteger(process.env.CONTENT_WORKER_POOL_SIZE, 0, 0, 32);
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

function resolveTrustProxyValue(mode = DEPLOYMENT_MODE) {
  const fallback = mode === 'direct' ? false : 1;
  return parseTrustProxy(process.env.TRUST_PROXY, fallback);
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
  REQUIRE_STRICT_ORIGIN,
  LIBRARY_DEEP_SIGNATURE_CHECK_TTL_MS,
  MAX_TEXT_FILE_BYTES,
  CONTENT_FILE_CACHE_MAX_BYTES,
  CONTENT_FILE_CACHE_MAX_ENTRIES,
  CONTENT_WORKER_THREADS_ENABLED,
  CONTENT_WORKER_POOL_SIZE,
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
  joinConfiguredOrigins,
  normalizeDeploymentMode,
  parseNonNegativeInteger,
  parseBoundedInteger,
  parseBooleanFlag,
  resolveTrustProxyValue
};
