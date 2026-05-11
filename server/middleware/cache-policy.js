const VERSIONED_REBUILD_ASSET_CACHE_PASS = 'v434-versioned-rebuild-asset-cache-pass';

function setNoStore(res) {
  res.setHeader('Cache-Control', 'no-store');
}

function isVersionedRebuildAssetRequest(req) {
  if (!req) return false;
  const method = String(req.method || '').toUpperCase();
  if (method && method !== 'GET' && method !== 'HEAD') return false;
  const rawUrl = String(req.originalUrl || req.url || '');
  let url;
  try {
    url = new URL(rawUrl, 'http://local.invalid');
  } catch (_e) {
    return false;
  }
  const pathname = url.pathname || '';
  const version = url.searchParams.get('v') || '';
  return pathname.startsWith('/scripts/rebuild/')
    && /\.(mjs|js)$/.test(pathname)
    && /^rebuild-v\d+$/.test(version);
}

function applyVersionedRebuildAssetCache(req, res, next) {
  if (isVersionedRebuildAssetRequest(req)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Versioned-Rebuild-Asset', VERSIONED_REBUILD_ASSET_CACHE_PASS);
  }
  if (typeof next === 'function') return next();
}

function applyStaticCachePolicy(res, filePath) {
  const normalizedPath = String(filePath || '').replace(/\\/g, '/');
  if (normalizedPath.endsWith('.mjs') || normalizedPath.endsWith('.js')) {
    res.type('text/javascript; charset=utf-8');
  }

  if (
    normalizedPath.endsWith('/index.html') ||
    normalizedPath.endsWith('/site.html') ||
    normalizedPath.endsWith('/mobile.html') ||
    normalizedPath.endsWith('/login.html') ||
    normalizedPath.includes('/public/scripts/app-split/')
  ) {
    setNoStore(res);
    return;
  }

  if (normalizedPath.includes('/public/scripts/rebuild/')) {
    if (res.getHeader && res.getHeader('X-Versioned-Rebuild-Asset')) return;
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    return;
  }

  if (
    normalizedPath.endsWith('/public/styles/app.css') ||
    normalizedPath.includes('/public/fragments/') ||
    normalizedPath.includes('/public/icon/')
  ) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return;
  }

  if (normalizedPath.endsWith('/public/manifest.json') || normalizedPath.endsWith('/public/browserconfig.xml')) {
    res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
    return;
  }

  if (
    normalizedPath.endsWith('/public/scripts/esm/app.bundle.mjs') ||
    normalizedPath.includes('/public/scripts/esm/parts/') ||
    normalizedPath.endsWith('/public/scripts/esm/bootstrap.mjs') ||
    normalizedPath.endsWith('/public/scripts/esm/manifest.mjs') ||
    normalizedPath.endsWith('/public/scripts/esm/manifest.json')
  ) {
    setNoStore(res);
  }
}

function createStaticCacheOptions() {
  return {
    setHeaders: applyStaticCachePolicy
  };
}

module.exports = {
  VERSIONED_REBUILD_ASSET_CACHE_PASS,
  setNoStore,
  isVersionedRebuildAssetRequest,
  applyVersionedRebuildAssetCache,
  applyStaticCachePolicy,
  createStaticCacheOptions
};
