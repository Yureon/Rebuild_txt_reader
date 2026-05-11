const { requireAllMarkers } = require('./check-utils.js');
const { readText, requireRoute, requireRouteWindowMarkers, requireRoutes } = require('./server-smoke-assertions.js');

const SERVER_ROUTE_SMOKE_PASS = 'v223-server-route-window-assertion-helper-pass';

function requireGuardedStateMutation(source, route) {
  const idx = source.indexOf(route);
  if (idx < 0) throw new Error('Missing state mutation route: ' + route);
  requireRouteWindowMarkers(source, route, 220, ['requireSameOrigin', 'requireCsrf', 'checkApiWriteLimit'], `v220 guarded state route ${route}`);
}

function runServerRouteDirectSmoke(projectRoot) {
  if (!projectRoot) throw new Error('runServerRouteDirectSmoke requires projectRoot');
  const stateRoutes = readText(projectRoot, 'server/routes/state-routes.js');
  const novelsRoutes = readText(projectRoot, 'server/routes/novels-routes.js');
  const fontRoutes = readText(projectRoot, 'server/routes/font-routes.js');
  const fileopsRoutes = readText(projectRoot, 'server/routes/fileops-routes.js');
  const recoveryRoutes = readText(projectRoot, 'server/routes/recovery-routes.js');
  const diagnosticsRoutes = readText(projectRoot, 'server/routes/diagnostics-routes.js');
  const blockManifestRoutes = readText(projectRoot, 'server/routes/block-manifest-routes.js');

  requireAllMarkers(stateRoutes, ['createStateRouter', 'sendStateError', 'setNoStore', 'stateWriteService'], 'v220 state-route dependency smoke');
  requireRoutes(stateRoutes, ["router.get('/user-state'", "router.get('/sync'"], 'state routes');
  ["router.put('/user-state/shared'", "router.put('/user-state/progress'", "router.put('/user-state/device'"].forEach(route => requireGuardedStateMutation(stateRoutes, route));
  const legacySyncPostIndex = stateRoutes.indexOf("router.post('/sync'");
  if (legacySyncPostIndex < 0) throw new Error('Missing legacy sync POST route');
  requireAllMarkers(stateRoutes.slice(legacySyncPostIndex, legacySyncPostIndex + 180), ['requireSameOrigin', 'requireCsrf'], 'v220 guarded legacy sync POST route');
  if (!stateRoutes.includes("status(410)") || !stateRoutes.includes('legacy sync api disabled')) throw new Error('legacy sync POST must remain disabled with 410');

  requireAllMarkers(novelsRoutes, ['createNovelsRouter', 'libraryService.getLibraryCached', 'contentService.parsePreprocessOptionsFromQuery', 'contentService.getContentChunkAsync', 'chunkPayload.currentChunk', 'chunkPayload.totalChunks'], 'v220 novel-route dependency smoke');
  requireRoutes(novelsRoutes, ["router.get('/novels'", "router.get('/novels/:novelId/content'", "router.get('/novels/:novelId/episodes/:episodeId'"], 'novel routes');
  ['chunkIdx = Math.max(1, Number(chunkPayload.currentChunk) || 1)', 'const totalChunks = Math.max(1, Number(chunkPayload.totalChunks) || 1)'].forEach(marker => {
    if (!novelsRoutes.includes(marker)) throw new Error('novel content routes must clamp chunk index through contentService payload: ' + marker);
  });
  if (!novelsRoutes.includes('Use episode endpoint')) throw new Error('multi-file novel content route must keep episode endpoint boundary');
  if (!novelsRoutes.includes('Novel not found') || !novelsRoutes.includes('Episode not found')) throw new Error('episode route must keep not-found boundaries');

  requireAllMarkers(fontRoutes, ['createFontRouter', 'fontService.getFontListResponse', 'fontService.uploadFont', 'fontService.deleteFont', 'fontService.getFontFileForResponse'], 'v221 font-route dependency smoke');
  requireRoutes(fontRoutes, ["router.get('/fonts'", "router.post('/fonts/upload'", "router.delete('/fonts/:filename'", "router.get('/fonts/file/:filename'"], 'font routes');
  const fontUploadIndex = fontRoutes.indexOf("'/fonts/upload'");
  if (fontUploadIndex < 0) throw new Error('Missing font upload route');
  requireAllMarkers(fontRoutes.slice(fontUploadIndex, fontUploadIndex + 420), ['requireSameOrigin', 'requireCsrf', 'express.raw', 'checkApiWriteLimit'], 'v221 guarded font upload route');
  requireRouteWindowMarkers(fontRoutes, "router.delete('/fonts/:filename'", 220, ['requireSameOrigin', 'requireCsrf'], 'v221 guarded font delete route');
  requireRouteWindowMarkers(fontRoutes, "router.get('/fonts/file/:filename'", 520, ['requireFontSession', 'Cache-Control', 'private, max-age=3600', 'Content-Disposition'], 'v426 scoped font file response route');

  requireAllMarkers(fileopsRoutes, ['createFileopsRouter', 'fileopsService.sendFsError', 'requireSameOrigin middleware', 'requireCsrf middleware'], 'v221 fileops-route dependency smoke');
  requireRoutes(fileopsRoutes, ["router.patch('/folders/rename'", "router.patch('/novels/:novelId/rename'", "router.delete('/novels/:novelId'", "router.patch('/novels/:novelId/move'", "router.patch('/episodes/:novelId/:episodeId/move'", "router.patch('/folders/move'", "router.patch('/novels/:novelId/episodes/:episodeId/rename'", "router.delete('/novels/:novelId/episodes/:episodeId'", "router.delete('/folders'"], 'fileops routes');
  ['renameFolder', 'renameNovel', 'deleteNovel', 'moveNovel', 'moveEpisode', 'moveFolder', 'renameEpisode', 'deleteEpisode', 'deleteFolder'].forEach(marker => {
    if (!fileopsRoutes.includes('fileopsService.' + marker)) throw new Error('fileops route missing service boundary: ' + marker);
  });
  ["router.patch('/folders/rename'", "router.patch('/novels/:novelId/rename'", "router.delete('/novels/:novelId'", "router.patch('/novels/:novelId/move'", "router.patch('/episodes/:novelId/:episodeId/move'", "router.patch('/folders/move'", "router.patch('/novels/:novelId/episodes/:episodeId/rename'", "router.delete('/novels/:novelId/episodes/:episodeId'", "router.delete('/folders'"].forEach(route => {
    requireRouteWindowMarkers(fileopsRoutes, route, 260, ['requireSameOrigin', 'requireCsrf', 'wrap'], 'v221 guarded fileops route ' + route);
  });

  requireAllMarkers(recoveryRoutes, ['createRecoveryRouter', 'recoveryService.getRecoveryStatus', 'setNoStore'], 'v221 recovery-route dependency smoke');
  requireRoute(recoveryRoutes, "router.get('/recovery-status'", 'recovery routes');
  const recoveryIndex = recoveryRoutes.indexOf("router.get('/recovery-status'");
  requireAllMarkers(recoveryRoutes.slice(recoveryIndex, recoveryIndex + 180), ['setNoStore(res)', 'res.json(recoveryService.getRecoveryStatus())'], 'v221 recovery status route no-store smoke');

  requireAllMarkers(diagnosticsRoutes, ['createDiagnosticsRouter', 'setNoStore', "router.get('/time'", 'res.json({ ts: now() })'], 'v222 diagnostics-route smoke');
  const timeIndex = diagnosticsRoutes.indexOf("router.get('/time'");
  requireAllMarkers(diagnosticsRoutes.slice(timeIndex, timeIndex + 160), ['setNoStore(res)', 'res.json({ ts: now() })'], 'v222 diagnostics time no-store route');

  requireAllMarkers(blockManifestRoutes, ['createBlockManifestRouter', 'blockManifestService.getSingleManifest', 'blockManifestService.getEpisodeManifest', 'libraryService.setLibraryMetaHeaders', 'setNoStore(res)'], 'v222 block-manifest route smoke');
  requireRoutes(blockManifestRoutes, ["router.get('/novels/:novelId/block-manifest'", "router.get('/novels/:novelId/episodes/:episodeId/block-manifest'"], 'block manifest routes');
  requireRouteWindowMarkers(blockManifestRoutes, "router.get('/novels/:novelId/block-manifest'", 360, ['setNoStore(res)', 'libraryService.setLibraryMetaHeaders(res)', 'blockManifestService.getSingleManifest', 'req.params.novelId', 'req.query'], 'v222 single block-manifest route boundary');
  requireRouteWindowMarkers(blockManifestRoutes, "router.get('/novels/:novelId/episodes/:episodeId/block-manifest'", 420, ['setNoStore(res)', 'libraryService.setLibraryMetaHeaders(res)', 'blockManifestService.getEpisodeManifest', 'req.params.novelId', 'req.params.episodeId', 'req.query'], 'v222 episode block-manifest route boundary');

  return { pass: SERVER_ROUTE_SMOKE_PASS };
}

module.exports = {
  SERVER_ROUTE_SMOKE_PASS,
  runServerRouteDirectSmoke
};
