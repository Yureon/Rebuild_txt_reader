const fs = require('fs');
const path = require('path');
const { requireAllMarkers } = require('./check-utils.js');

const SERVER_FILEOPS_SERVICE_BOUNDARY_SMOKE_PASS = 'v216-server-fileops-service-boundary-smoke-pass';

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function runServerFileopsServiceBoundarySmoke(projectRoot) {
  if (!projectRoot) throw new Error('runServerFileopsServiceBoundarySmoke requires projectRoot');
  const service = read(projectRoot, 'server/services/fileops-service.js');
  const routes = read(projectRoot, 'server/routes/fileops-routes.js');

  requireAllMarkers(service, [
    'createFileopsService',
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
    ['renameFolder', 'invalidateLibraryCache', 'clearAllFileCache', 'notifyMutation'],
    ['renameNovel', 'clearNovelCachesByInfo', 'fs.renameSync', 'notifyMutation'],
    ['deleteNovel', 'fs.rmSync', 'fs.unlinkSync', 'cleanupEmptyParents', 'notifyMutation'],
    ['moveFolder', 'isSubPath', 'scanLibrary', 'invalidatePathCaches', 'notifyMutation'],
    ['deleteFolder', 'fs.rmSync', 'cleanupEmptyParents', 'notifyMutation']
  ].forEach(([fn, ...markers]) => {
    const start = service.indexOf('function ' + fn + '(');
    if (start < 0) throw new Error('Missing fileops service function: ' + fn);
    const next = service.indexOf('\n  function ', start + 10);
    const body = service.slice(start, next < 0 ? service.length : next);
    markers.forEach((marker) => {
      if (!body.includes(marker)) throw new Error('Missing fileops boundary marker in ' + fn + ': ' + marker);
    });
  });

  [
    ['moveNovel', 'clearNovelCachesByInfo', 'fs.renameSync', 'clearAllFileCache', 'notifyMutation'],
    ['moveEpisode', 'clearNovelCachesByInfo', 'fs.renameSync', 'cleanupEmptyParents', 'notifyMutation'],
    ['renameEpisode', 'clearFileCachePath(oldAbs)', 'clearFileCachePath(newAbs)', 'notifyMutation'],
    ['deleteEpisode', 'fs.unlinkSync', 'cleanupEmptyParents', 'clearFileCachePath(abs)', 'notifyMutation']
  ].forEach(([fn, ...markers]) => {
    const start = service.indexOf('function ' + fn + '(');
    if (start < 0) throw new Error('Missing fileops service function: ' + fn);
    const next = service.indexOf('\n  function ', start + 10);
    const body = service.slice(start, next < 0 ? service.length : next);
    markers.forEach((marker) => {
      if (!body.includes(marker)) throw new Error('Missing fileops direct mutation marker in ' + fn + ': ' + marker);
    });
  });

  requireAllMarkers(routes, [
    'createFileopsRouter',
    'requireSameOrigin',
    'requireCsrf',
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
