const fs = require('fs');
const path = require('path');
const { requireAllMarkers } = require('./check-utils.js');

const SERVER_SERVICE_BOUNDARY_SMOKE_PASS = 'v211-server-service-boundary-smoke-pass';

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function requireMutationRouteGuards(source, routes) {
  routes.forEach((route) => {
    const idx = source.indexOf(route);
    if (idx < 0) throw new Error('Missing guarded mutation route: ' + route);
    const window = source.slice(idx, idx + 260);
    if (!window.includes('requireSameOrigin') || !window.includes('requireCsrf')) {
      throw new Error('Mutation route must keep same-origin and CSRF middleware: ' + route);
    }
  });
}

function runServerServiceBoundarySmoke(projectRoot) {
  if (!projectRoot) throw new Error('runServerServiceBoundarySmoke requires projectRoot');
  const contentService = read(projectRoot, 'server/services/content-service.js');
  const libraryService = read(projectRoot, 'server/services/library-service.js');
  const fontService = read(projectRoot, 'server/services/font-service.js');
  const fontRoutes = read(projectRoot, 'server/routes/font-routes.js');
  const fileopsRoutes = read(projectRoot, 'server/routes/fileops-routes.js');
  const securityMiddleware = read(projectRoot, 'server/middleware/security.js');
  const cachePolicy = read(projectRoot, 'server/middleware/cache-policy.js');

  requireAllMarkers(contentService, [
    'readFileAutoEncoding',
    'parsePreprocessOptionsFromQuery',
    'serializePreprocessOptions',
    'formatNovelText',
    'DEFAULT_FILE_CACHE_MAX_BYTES',
    'dirtyChunkIndexes'
  ], 'v211 content-service boundary smoke');

  requireAllMarkers(libraryService, [
    'sanitizeNodeName',
    'normalizeTxtBaseName',
    'shouldTreatDirectoryAsEpisodeNovel',
    'getDirectoryNovelModeOverride',
    'DIR_SCAN_CACHE_MAX',
    'LIBRARY_CACHE_TTL'
  ], 'v211 library-service boundary smoke');

  requireAllMarkers(fontService, [
    'safeFontName',
    'resolveCandidate',
    'isPathInside',
    'ALLOWED_FONT_EXTENSIONS',
    'FONT_LIBRARY_MAX_TOTAL_BYTES'
  ], 'v211 font-service boundary smoke');

  requireAllMarkers(fontRoutes, [
    "router.get('/fonts/file/:filename'",
    'validateSession',
    "Cache-Control', 'private, max-age=3600'",
    'Content-Disposition',
    'express.raw({ type: \'application/octet-stream\''
  ], 'v211 font-route auth/cache smoke');

  requireMutationRouteGuards(fileopsRoutes, [
    "router.patch('/folders/rename'",
    "router.patch('/novels/:novelId/rename'",
    "router.delete('/novels/:novelId'",
    "router.patch('/novels/:novelId/move'",
    "router.patch('/episodes/:novelId/:episodeId/move'",
    "router.patch('/folders/move'",
    "router.patch('/novels/:novelId/episodes/:episodeId/rename'",
    "router.delete('/novels/:novelId/episodes/:episodeId'",
    "router.delete('/folders'"
  ]);

  requireAllMarkers(securityMiddleware, [
    "default-src 'self'",
    "frame-ancestors 'none'",
    'X-Frame-Options',
    'Cross-Origin-Resource-Policy',
    'Content-Security-Policy'
  ], 'v211 security middleware boundary smoke');

  requireAllMarkers(cachePolicy, [
    'setNoStore',
    '/site.html',
    '/mobile.html',
    '/public/scripts/rebuild/',
    '/public/styles/app.css',
    'createStaticCacheOptions'
  ], 'v211 static cache policy boundary smoke');

  return { pass: SERVER_SERVICE_BOUNDARY_SMOKE_PASS };
}

module.exports = {
  SERVER_SERVICE_BOUNDARY_SMOKE_PASS,
  runServerServiceBoundarySmoke
};
