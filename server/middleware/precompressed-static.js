const fs = require('fs');
const path = require('path');
const { applyStaticCachePolicy } = require('./cache-policy');

const PRECOMPRESSED_STATIC_METADATA_CACHE_PASS = 'v450-precompressed-static-metadata-cache-pass';
const PRECOMPRESSED_STATIC_ASYNC_IO_PASS = 'v591-precompressed-static-async-io-pass';
const DEFAULT_STATIC_METADATA_CACHE_TTL_MS = 5000;
const DEFAULT_STATIC_METADATA_CACHE_MAX = 2048;

const ENCODINGS = [
  { token: 'br', suffix: '.br', header: 'br' },
  { token: 'gzip', suffix: '.gz', header: 'gzip' }
];

const CONTENT_TYPES = new Map([
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.svg', 'image/svg+xml']
]);

function isGetOrHead(method) {
  const normalized = String(method || '').toUpperCase();
  return normalized === 'GET' || normalized === 'HEAD';
}

function parseAcceptEncoding(header) {
  const out = new Map();
  String(header || '').split(',').forEach(part => {
    const [rawToken, ...params] = part.trim().split(';');
    const token = rawToken.trim().toLowerCase();
    if (!token) return;
    let q = 1;
    for (const param of params) {
      const trimmed = param.trim().toLowerCase();
      if (!trimmed.startsWith('q=')) continue;
      const parsed = Number(trimmed.slice(2));
      q = Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0;
    }
    out.set(token, q);
  });
  return out;
}


function isIdentityEncodingAccepted(acceptHeader) {
  const raw = String(acceptHeader || '').trim();
  if (!raw) return true;
  const accepted = parseAcceptEncoding(raw);
  if (accepted.has('identity')) return Number(accepted.get('identity')) > 0;
  if (accepted.has('*')) return Number(accepted.get('*')) > 0;
  return true;
}

function createStaticMetadataCache(options = {}) {
  const ttlMs = Number.isFinite(Number(options.ttlMs)) ? Math.max(0, Number(options.ttlMs)) : DEFAULT_STATIC_METADATA_CACHE_TTL_MS;
  const maxEntries = Number.isFinite(Number(options.maxEntries)) ? Math.max(16, Number(options.maxEntries)) : DEFAULT_STATIC_METADATA_CACHE_MAX;
  const entries = new Map();
  const pending = new Map();
  const metrics = { hits: 0, misses: 0, statCalls: 0, asyncStatCalls: 0, asyncInflightJoins: 0, evictions: 0 };

  function get(cacheKey) {
    const now = Date.now();
    const hit = entries.get(cacheKey);
    if (hit && (ttlMs <= 0 || now - hit.at <= ttlMs)) {
      metrics.hits += 1;
      entries.delete(cacheKey);
      entries.set(cacheKey, hit);
      return hit.value;
    }
    if (hit) entries.delete(cacheKey);
    metrics.misses += 1;
    return undefined;
  }

  function set(cacheKey, value) {
    if (ttlMs <= 0) return value;
    entries.set(cacheKey, { at: Date.now(), value });
    while (entries.size > maxEntries) {
      const oldest = entries.keys().next().value;
      if (oldest == null) break;
      entries.delete(oldest);
      metrics.evictions += 1;
    }
    return value;
  }

  return {
    pass: PRECOMPRESSED_STATIC_METADATA_CACHE_PASS,
    asyncIoPass: PRECOMPRESSED_STATIC_ASYNC_IO_PASS,
    get,
    set,
    getPending(cacheKey){ return pending.get(cacheKey); },
    setPending(cacheKey, value){ pending.set(cacheKey, value); return value; },
    deletePending(cacheKey){ pending.delete(cacheKey); },
    clear(){ entries.clear(); pending.clear(); },
    status(){ return { pass: PRECOMPRESSED_STATIC_METADATA_CACHE_PASS, asyncIoPass: PRECOMPRESSED_STATIC_ASYNC_IO_PASS, entries: entries.size, pending: pending.size, ttlMs, maxEntries, metrics: { ...metrics } }; },
    metrics
  };
}

function getFileStatCached(filePath, metadataCache = null) {
  const key = 'stat:' + String(filePath || '');
  if (metadataCache && typeof metadataCache.get === 'function') {
    const cached = metadataCache.get(key);
    if (cached !== undefined) return cached;
  }
  if (metadataCache && metadataCache.metrics) metadataCache.metrics.statCalls += 1;
  let value = null;
  try {
    const stat = fs.statSync(filePath);
    value = stat && stat.isFile && stat.isFile() ? stat : null;
  } catch (_e) {
    value = null;
  }
  if (metadataCache && typeof metadataCache.set === 'function') metadataCache.set(key, value);
  return value;
}

function acceptedEncodingCandidates(acceptHeader) {
  const accepted = parseAcceptEncoding(acceptHeader);
  const wildcard = accepted.get('*');
  return ENCODINGS
    .map((encoding, preference) => {
      const direct = accepted.get(encoding.token);
      const q = direct == null ? wildcard : direct;
      return { ...encoding, q:Number(q), preference };
    })
    .filter(encoding => Number.isFinite(encoding.q) && encoding.q > 0)
    .sort((a, b) => b.q - a.q || a.preference - b.preference);
}

function chooseEncoding(acceptHeader, filePath, metadataCache = null) {
  for (const encoding of acceptedEncodingCandidates(acceptHeader)) {
    const encodedPath = filePath + encoding.suffix;
    const stat = getFileStatCached(encodedPath, metadataCache);
    if (stat) return { ...encoding, encodedPath, stat };
  }
  return null;
}

async function getFileStatCachedAsync(filePath, metadataCache = null) {
  const key = 'stat:' + String(filePath || '');
  if (metadataCache && typeof metadataCache.get === 'function') {
    const cached = metadataCache.get(key);
    if (cached !== undefined) return cached;
  }
  if (metadataCache && typeof metadataCache.getPending === 'function') {
    const inflight = metadataCache.getPending(key);
    if (inflight) {
      if (metadataCache.metrics) metadataCache.metrics.asyncInflightJoins += 1;
      return inflight;
    }
  }
  if (metadataCache && metadataCache.metrics) metadataCache.metrics.asyncStatCalls += 1;
  const task = fs.promises.stat(filePath)
    .then(stat => stat && stat.isFile && stat.isFile() ? stat : null)
    .catch(() => null)
    .then(value => {
      if (metadataCache && typeof metadataCache.set === 'function') metadataCache.set(key, value);
      return value;
    })
    .finally(() => {
      if (metadataCache && typeof metadataCache.deletePending === 'function') metadataCache.deletePending(key);
    });
  if (metadataCache && typeof metadataCache.setPending === 'function') metadataCache.setPending(key, task);
  return task;
}

async function chooseEncodingAsync(acceptHeader, filePath, metadataCache = null) {
  for (const encoding of acceptedEncodingCandidates(acceptHeader)) {
    const encodedPath = filePath + encoding.suffix;
    const stat = await getFileStatCachedAsync(encodedPath, metadataCache);
    if (stat) return { ...encoding, encodedPath, stat };
  }
  return null;
}

function resolvePublicPath(rootDir, requestPath) {
  let pathname = String(requestPath || '/').split('?')[0] || '/';
  try { pathname = decodeURIComponent(pathname); } catch { return null; }
  if (pathname.includes('\0')) return null;
  const relative = pathname.replace(/^\/+/, '');
  const full = path.resolve(rootDir, relative);
  const root = path.resolve(rootDir);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return full;
}

function buildWeakEtag(stat) {
  const mtime = Math.trunc(Number(stat.mtimeMs) || 0).toString(16);
  const size = Number(stat.size) || 0;
  return `W/"${size.toString(16)}-${mtime}"`;
}

function isNotModified(req, stat, etag) {
  const inm = String(req.headers['if-none-match'] || '').trim();
  if (inm) {
    const candidates = inm.split(',').map(v => v.trim());
    return candidates.includes('*') || candidates.includes(etag);
  }
  const ims = String(req.headers['if-modified-since'] || '').trim();
  if (!ims) return false;
  const since = Date.parse(ims);
  if (!Number.isFinite(since)) return false;
  return Math.floor(stat.mtimeMs / 1000) <= Math.floor(since / 1000);
}

function setVaryAcceptEncoding(res) {
  const current = res.getHeader('Vary');
  if (!current) {
    res.setHeader('Vary', 'Accept-Encoding');
    return;
  }
  const values = String(current).split(',').map(v => v.trim().toLowerCase());
  if (!values.includes('accept-encoding') && !values.includes('*')) {
    res.setHeader('Vary', String(current) + ', Accept-Encoding');
  }
}

function createPrecompressedStaticMiddleware(rootDir, options = {}) {
  if (!rootDir) throw new Error('createPrecompressedStaticMiddleware requires rootDir');
  const metadataCache = options.metadataCache || createStaticMetadataCache(options.metadataCacheOptions || {});
  return function precompressedStatic(req, res, next) {
    if (!isGetOrHead(req.method)) return next();
    const filePath = resolvePublicPath(rootDir, req.path || req.url || '/');
    if (!filePath) return next();

    void (async () => {
      const originalStat = await getFileStatCachedAsync(filePath, metadataCache);
      if (res.destroyed || res.writableEnded) return;
      if (!originalStat) return next();

      const acceptEncoding = req.headers['accept-encoding'];
      const encoding = await chooseEncodingAsync(acceptEncoding, filePath, metadataCache);
      if (res.destroyed || res.writableEnded) return;
      if (!encoding) {
        if (!isIdentityEncodingAccepted(acceptEncoding)) {
          res.statusCode = 406;
          res.setHeader('Cache-Control', 'no-store');
          return res.end('Not Acceptable');
        }
        return next();
      }

      const stat = encoding.stat || await getFileStatCachedAsync(encoding.encodedPath, metadataCache);
      if (res.destroyed || res.writableEnded) return;
      if (!stat) return next();

      const ext = path.extname(filePath).toLowerCase();
      const contentType = CONTENT_TYPES.get(ext) || 'application/octet-stream';
      const etag = buildWeakEtag(stat);

      applyStaticCachePolicy(res, filePath);
      setVaryAcceptEncoding(res);
      res.setHeader('Content-Encoding', encoding.header);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', String(stat.size));
      res.setHeader('ETag', etag);
      res.setHeader('Last-Modified', stat.mtime.toUTCString());
      res.setHeader('X-Precompressed-Static', encoding.header);
      res.setHeader('X-Precompressed-Static-Metadata-Cache', PRECOMPRESSED_STATIC_METADATA_CACHE_PASS);
      res.setHeader('X-Precompressed-Static-Async-Io', PRECOMPRESSED_STATIC_ASYNC_IO_PASS);

      if (isNotModified(req, stat, etag)) {
        res.statusCode = 304;
        res.removeHeader('Content-Length');
        return res.end();
      }

      if (String(req.method).toUpperCase() === 'HEAD') return res.end();
      if (res.destroyed || res.writableEnded) return;
      const stream = fs.createReadStream(encoding.encodedPath);
      const destroyStream = () => { if (!stream.destroyed) stream.destroy(); };
      res.once('close', destroyStream);
      stream.once('close', () => res.removeListener('close', destroyStream));
      stream.once('error', (error) => {
        res.removeListener('close', destroyStream);
        if (!res.headersSent) next(error);
        else res.destroy(error);
      });
      return stream.pipe(res);
    })().catch(next);
  };
}

module.exports = {
  PRECOMPRESSED_STATIC_METADATA_CACHE_PASS,
  PRECOMPRESSED_STATIC_ASYNC_IO_PASS,
  createPrecompressedStaticMiddleware,
  createStaticMetadataCache,
  getFileStatCached,
  getFileStatCachedAsync,
  parseAcceptEncoding,
  acceptedEncodingCandidates,
  isIdentityEncodingAccepted,
  chooseEncoding,
  chooseEncodingAsync,
  isNotModified,
  resolvePublicPath,
  buildWeakEtag
};
