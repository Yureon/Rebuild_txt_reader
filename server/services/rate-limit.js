const { getSessionTokenFromCookieHeader } = require('../middleware/auth');
const net = require('net');
const { createTrustedProxyPredicate, normalizeIp, V676_TRUSTED_PROXY_SOURCE_PASS } = require('./trusted-proxy-policy');
function firstHeaderIp(value) {
  for (const token of String(value || '').split(',')) {
    const ip = normalizeIp(token);
    if (net.isIP(ip)) return ip;
  }
  return '';
}

function normalizeHeaderName(value) {
  return String(value || '').trim().toLowerCase();
}

function getClientIp(req, options = {}) {
  const headers = (req && req.headers) || {};
  const mode = String(options.deploymentMode || process.env.DEPLOYMENT_MODE || 'direct').trim().toLowerCase();
  const configuredHeader = normalizeHeaderName(options.clientIpHeader || process.env.CLIENT_IP_HEADER || '');
  const rawSocketIp = (req && req.socket && req.socket.remoteAddress) || '';
  const socketIp = net.isIP(normalizeIp(rawSocketIp)) ? normalizeIp(rawSocketIp) : 'unknown';
  const requestIp = firstHeaderIp(req && req.ip || '');

  if (mode === 'cloudflare-tunnel' || mode === 'trusted-proxy') {
    const predicate = options.isTrustedProxySource || createTrustedProxyPredicate(options.trustedProxyCidrs || process.env.TRUSTED_PROXY_CIDRS);
    if (!predicate(socketIp)) return socketIp;
    if (mode === 'cloudflare-tunnel') return firstHeaderIp(headers['cf-connecting-ip']) || requestIp || socketIp;
    if (configuredHeader) return firstHeaderIp(headers[configuredHeader]) || requestIp || socketIp;
    return requestIp || socketIp;
  }

  return socketIp;
}

function pruneExpiredEntries(map, now) {
  if (!map || typeof map.entries !== 'function') return 0;
  let removed = 0;
  for (const [key, rec] of map.entries()) {
    if (!rec || Number(rec.resetAt) <= now) {
      map.delete(key);
      removed += 1;
    }
  }
  return removed;
}

function trimMapByResetAt(map, maxEntries) {
  if (!map || !Number.isFinite(maxEntries) || maxEntries < 1 || map.size <= maxEntries) return 0;
  const overflow = map.size - maxEntries;
  const entries = Array.from(map.entries())
    .sort((a, b) => Number((a[1] && a[1].resetAt) || 0) - Number((b[1] && b[1].resetAt) || 0));
  let removed = 0;
  for (const [key] of entries) {
    if (removed >= overflow) break;
    if (map.delete(key)) removed += 1;
  }
  return removed;
}

function createPruner(map, options = {}) {
  const maxEntries = Math.max(1, Number(options.maxEntries || 5000));
  const pruneIntervalMs = Math.max(1000, Number(options.pruneIntervalMs || 60000));
  let lastPrunedAt = 0;

  function prune(now = Date.now(), force = false) {
    if (!force && now - lastPrunedAt < pruneIntervalMs && map.size <= maxEntries) return 0;
    lastPrunedAt = now;
    return pruneExpiredEntries(map, now) + trimMapByResetAt(map, maxEntries);
  }

  return { prune, maxEntries, pruneIntervalMs };
}

function normalizeLoginName(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_.@-]+/gi, '_').slice(0, 96) || 'anonymous';
}

function createLoginLimiter(options = {}) {
  const attempts = new Map();
  const max = Math.max(1, Number(options.max || 10));
  const windowMs = Math.max(1000, Number(options.windowMs || (15 * 60 * 1000)));
  const pruner = createPruner(attempts, {
    maxEntries: options.maxEntries || 2000,
    pruneIntervalMs: options.pruneIntervalMs || Math.min(windowMs, 60000)
  });

  function check(ip, identity = '') {
    const key = [String(ip || 'unknown'), normalizeLoginName(identity)].join(':');
    const now = Date.now();
    pruner.prune(now);
    const rec = attempts.get(key);
    if (!rec || now > rec.resetAt) {
      attempts.set(key, { count: 1, resetAt: now + windowMs });
      pruner.prune(now, attempts.size > pruner.maxEntries);
      return true;
    }
    if (rec.count >= max) return false;
    rec.count += 1;
    return true;
  }

  function reset(ip, identity = '') {
    attempts.delete([String(ip || 'unknown'), normalizeLoginName(identity)].join(':'));
  }

  function prune(now = Date.now()) {
    return pruner.prune(now, true);
  }

  return { check, reset, prune, attempts };
}

function createApiWriteLimiter(options = {}) {
  const buckets = new Map();
  const pruner = createPruner(buckets, {
    maxEntries: options.maxEntries || 5000,
    pruneIntervalMs: options.pruneIntervalMs || 60000
  });

  function check(req, scope, maxCount, windowMs) {
    const ip = getClientIp(req);
    const cookie = String((req && req.headers && req.headers.cookie) || '');
    const token = String(getSessionTokenFromCookieHeader(cookie) || '');
    const key = [String(scope || 'api-write'), ip, token.slice(0, 24)].join(':');
    const now = Date.now();
    const limit = Math.max(1, Number(maxCount) || 120);
    const win = Math.max(1000, Number(windowMs) || (60 * 1000));
    pruner.prune(now);
    const rec = buckets.get(key);
    if (!rec || now > rec.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + win });
      pruner.prune(now, buckets.size > pruner.maxEntries);
      return true;
    }
    if (rec.count >= limit) return false;
    rec.count += 1;
    return true;
  }

  function prune(now = Date.now()) {
    return pruner.prune(now, true);
  }

  return { check, prune, buckets };
}

module.exports = {
  V675_TRUSTED_PROXY_SOURCE_PASS:V676_TRUSTED_PROXY_SOURCE_PASS,
  V676_TRUSTED_PROXY_SOURCE_PASS,
  firstHeaderIp,
  getClientIp,
  pruneExpiredEntries,
  trimMapByResetAt,
  normalizeLoginName,
  createLoginLimiter,
  createApiWriteLimiter
};
