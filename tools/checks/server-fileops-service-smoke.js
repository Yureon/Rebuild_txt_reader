const fs = require('fs');
const path = require('path');
const { requireAllMarkers } = require('./check-utils.js');

const SERVER_FILEOPS_SERVICE_BOUNDARY_SMOKE_PASS = 'v216-server-fileops-service-boundary-smoke-pass';

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function functionBody(source, name) {
  const start = source.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('Missing fileops service function: ' + name);
  const next = source.indexOf('\n  function ', start + 10);
  return source.slice(start, next < 0 ? source.length : next);
}

function runServerFileopsServiceBoundarySmoke(projectRoot) {
  if (!projectRoot) throw new Error('runServerFileopsServiceBoundarySmoke requires projectRoot');
  const service = read(projectRoot, 'server/services/fileops-service.js');
  const routes = read(projectRoot, 'server/routes/fileops-routes.js');

  requireAllMarkers(service, [
    'createFileopsService',
    'v592-fileops-async-io-pass',
    'v627-fileops-stable-path-lock-pass',
    'runMutation',
    'getLibraryCachedAsync',
    'notifyMutation',
    'findNovel',
    'renameFolder',
    'renameNovel',
    'deleteNovel',
    'moveNovel',
    'moveEpisode',
    'moveFolder',
    'renameEpisode',
    'deleteEpisode',
    'deleteFolder',
    'ensureExists',
    'ensureNotExists',
    'safeJoinUnderLibrary',
    'clearAllFileCache',
    'clearNovelCachesByInfo',
    'cleanupEmptyParents',
    'sendFsError'
  ], 'v216 fileops-service mutation boundary smoke');

  [
    ['renameFolder', 'performDurableFsMutation', 'fs.promises.rename', 'clearAllFileCache', 'notifyMutation'],
    ['renameNovel', 'clearNovelCachesByInfo', 'fs.promises.rename', 'notifyMutation'],
    ['deleteNovel', 'fs.promises.rm', 'fs.promises.unlink', 'cleanupEmptyParents', 'notifyMutation'],
    ['moveFolder', 'isSubPath', 'fs.promises.rename', 'clearAllFileCache', 'notifyMutation'],
    ['deleteFolder', 'fs.promises.rm', 'cleanupEmptyParents', 'notifyMutation'],
    ['moveNovel', 'clearNovelCachesByInfo', 'fs.promises.rename', 'clearAllFileCache', 'notifyMutation'],
    ['moveEpisode', 'clearNovelCachesByInfo', 'fs.promises.rename', 'cleanupEmptyParents', 'notifyMutation'],
    ['renameEpisode', 'clearFileCachePath(oldAbs)', 'clearFileCachePath(newAbs)', 'notifyMutation'],
    ['deleteEpisode', 'fs.promises.unlink', 'cleanupEmptyParents', 'clearFileCachePath(abs)', 'notifyMutation']
  ].forEach(([fn, ...markers]) => {
    const body = functionBody(service, fn);
    markers.forEach((marker) => {
      if (!body.includes(marker)) throw new Error('Missing fileops async boundary marker in ' + fn + ': ' + marker);
    });
  });

  if (functionBody(service, 'moveFolder').includes('scanLibrary')) {
    throw new Error('moveFolder must not recursively scan a tree before clearing the complete file cache');
  }
  if (/\b(?:renameSync|rmSync|unlinkSync|readdirSync|existsSync)\b/.test(service)) {
    throw new Error('request-path fileops service must not use synchronous filesystem mutations');
  }

  requireAllMarkers(routes, [
    'createFileopsRouter',
    'requireSameOrigin',
    'requireCsrf',
    'return async (req, res)',
    'await handler(req)',
    'fileopsService.renameFolder',
    'fileopsService.renameNovel',
    'fileopsService.deleteNovel',
    'fileopsService.moveNovel',
    'fileopsService.moveEpisode',
    'fileopsService.moveFolder',
    'fileopsService.renameEpisode',
    'fileopsService.deleteEpisode',
    'fileopsService.deleteFolder'
  ], 'v216 fileops-route service delegation smoke');

  return { pass: SERVER_FILEOPS_SERVICE_BOUNDARY_SMOKE_PASS };
}

module.exports = {
  SERVER_FILEOPS_SERVICE_BOUNDARY_SMOKE_PASS,
  runServerFileopsServiceBoundarySmoke
};
