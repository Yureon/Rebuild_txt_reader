const { BUILD_ID: TXT_READER_BUILD } = require('../version-contract');
const VERSIONED_REBUILD_ASSET_CACHE_PASS = 'v434-versioned-rebuild-asset-cache-pass';

function setNoStore(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Cloudflare-CDN-Cache-Control', 'no-store');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-TXT-Reader-Build', TXT_READER_BUILD);
}

function getBuildVersionedStaticRequest(req) {
  if (!req) return null;
  const method = String(req.method || '').toUpperCase();
  if (method && method !== 'GET' && method !== 'HEAD') return null;
  let url;
  try { url = new URL(String(req.originalUrl || req.url || ''), 'http://local.invalid'); }
  catch (_error) { return null; }
  const version = String(url.searchParams.get('v') || '');
  if (!/^rebuild-v\d+$/.test(version)) return null;
  const pathname = String(url.pathname || '');
  const versionedPath = pathname.startsWith('/scripts/')
    || pathname.startsWith('/styles/')
    || pathname.startsWith('/fragments/')
    || pathname.startsWith('/workers/')
    || pathname.startsWith('/icon/');
  return versionedPath ? { pathname, version } : null;
}

function isExecutableBuildAssetPath(pathname) {
  const value = String(pathname || '');
  return value.startsWith('/scripts/')
    || value.startsWith('/fragments/')
    || value.startsWith('/workers/')
    || /\.(?:m?js|cjs|wasm|html)$/i.test(value);
}

function rejectStaleBuildAsset(req, res) {
  const asset = getBuildVersionedStaticRequest(req);
  if (!asset || asset.version === TXT_READER_BUILD) return false;
  setNoStore(res);
  res.setHeader('X-TXT-Reader-Requested-Build', asset.version);
  if (!isExecutableBuildAssetPath(asset.pathname)) {
    res.setHeader('X-TXT-Reader-Stale-Build-Forwarded', '1');
    return false;
  }
  res.status(409);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-TXT-Reader-Reload-Required', '1');
  res.end(JSON.stringify({
    ok:false,
    error:'reload_required',
    activeBuild:TXT_READER_BUILD,
    requestedBuild:asset.version
  }));
  return true;
}

function isVersionedStaticAssetRequest(req) {
  const asset = getBuildVersionedStaticRequest(req);
  return !!(asset && asset.version === TXT_READER_BUILD);
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
  if (rejectStaleBuildAsset(req, res)) return;
  if (isVersionedStaticAssetRequest(req)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Versioned-Static-Asset', VERSIONED_REBUILD_ASSET_CACHE_PASS);
    if (isVersionedRebuildAssetRequest(req)) res.setHeader('X-Versioned-Rebuild-Asset', VERSIONED_REBUILD_ASSET_CACHE_PASS);
  }
  if (typeof next === 'function') return next();
}

function applyStaticCachePolicy(res, filePath) {
  res.setHeader('X-TXT-Reader-Build', TXT_READER_BUILD);
  const normalizedPath = String(filePath || '').replace(/\\/g, '/');
  if (normalizedPath.endsWith('.mjs') || normalizedPath.endsWith('.js')) {
    res.type('text/javascript; charset=utf-8');
  }
  if (normalizedPath.endsWith('/sw.js')) res.setHeader('Service-Worker-Allowed', '/');
  if (res.getHeader && res.getHeader('X-TXT-Reader-Stale-Build-Forwarded')) {
    setNoStore(res);
    return;
  }

  if (
    normalizedPath.endsWith('/index.html') ||
    normalizedPath.endsWith('/library.html') ||
    normalizedPath.endsWith('/metadata.html') ||
    normalizedPath.endsWith('/site.html') ||
    normalizedPath.endsWith('/mobile.html') ||
    normalizedPath.endsWith('/login.html') ||
    normalizedPath.endsWith('/offline.html') ||
    normalizedPath.endsWith('/sw.js') ||
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
    normalizedPath.includes('/public/styles/') ||
    normalizedPath.includes('/public/fragments/') ||
    normalizedPath.includes('/public/icon/')
  ) {
    if (res.getHeader && res.getHeader('X-Versioned-Static-Asset')) return;
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
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
  TXT_READER_BUILD,
  getBuildVersionedStaticRequest,
  rejectStaleBuildAsset,
  isExecutableBuildAssetPath,
  setNoStore,
  isVersionedStaticAssetRequest,
  isVersionedRebuildAssetRequest,
  applyVersionedRebuildAssetCache,
  applyStaticCachePolicy,
  createStaticCacheOptions
};
