const { assertCondition, requireHeader } = require('./server-smoke-assertions.js');
const { createFakeRes, createReq, invokeExpressJsonRoute, invokeExpressRouteHandler, requireJsonRouteErrorResult, requireJsonRouteResult, requireWithMockedExpressRouter } = require('./server-smoke-fixtures.js');

const SERVER_DIAGNOSTICS_BLOCK_MANIFEST_SERVICE_SMOKE_PASS = 'v223-server-diagnostics-block-manifest-service-behavior-smoke-pass';
const SERVER_DIAGNOSTICS_BLOCK_MANIFEST_ROUTE_BEHAVIOR_PASS = 'v225-server-diagnostics-block-manifest-route-behavior-pass';
const SERVER_DIAGNOSTICS_BLOCK_MANIFEST_JSON_ROUTE_FIXTURE_PASS = 'v226-server-diagnostics-block-manifest-json-route-fixture-pass';
const SERVER_BLOCK_MANIFEST_ROUTE_ERROR_FIXTURE_PASS = 'v233-server-block-manifest-route-error-fixture-pass';
const SERVER_BLOCK_MANIFEST_ROUTE_JSON_ASSERT_FIXTURE_PASS = 'v235-server-block-manifest-route-json-assert-pass';
const SERVER_BLOCK_MANIFEST_ROUTE_JSON_ERROR_ASSERT_PASS = 'v236-server-block-manifest-route-json-error-assert-pass';

async function runServerDiagnosticsBlockManifestServiceSmoke(projectRoot) {
  if (!projectRoot) throw new Error('runServerDiagnosticsBlockManifestServiceSmoke requires projectRoot');
  const { createBlockManifestService, splitContentBlocks } = require(projectRoot + '/server/services/block-manifest-service.js');

  const library = [
    { id:'single-novel', title:'Single Novel', singlePath:'single.txt', isMultiFile:false },
    { id:'multi-novel', title:'Multi Novel', isMultiFile:true, episodes:[{ id:'ep-1', title:'Episode One', path:'episode-1.txt' }] }
  ];
  const entries = new Map([
    ['/fixture-library/single.txt', { text:'첫 문단입니다.\n\n둘째 문단입니다.', statSig:'single-stat' }],
    ['/fixture-library/episode-1.txt', { text:'에피소드 첫 문단입니다.\n\n에피소드 둘째 문단입니다.', statSig:'episode-stat' }]
  ]);
  const libraryService = {
    getLibraryCached() { return library; },
    safeJoinUnderLibrary(relPath) { return '/fixture-library/' + String(relPath || '').replace(/^\/+/, ''); }
  };
  const contentService = {
    parsePreprocessOptionsFromQuery(query = {}) { return { dense: query.preSplitDense === '1' }; },
    serializePreprocessOptions(options = {}) { return options.dense ? 'dense=1' : 'dense=0'; },
    async getCachedFileEntryAsync(filePath) { return entries.get(filePath); },
    getTotalChunks(entry) { return entry.text.includes('에피소드') ? 2 : 1; },
    getChunkByLine(entry, chunk) {
      if (chunk === 1) return { start:0, end:Math.min(entry.text.length, 12), content:entry.text.slice(0, 12) };
      return { start:12, end:entry.text.length, content:entry.text.slice(12) };
    }
  };
  const service = createBlockManifestService({ libraryPath:'/fixture-library', libraryService, contentService, manifestCacheMax: 2 });

  const single = await service.getSingleManifest('single-novel', { preSplitDense:'1' });
  assertCondition(single.status === 200, 'single manifest smoke must return status 200');
  assertCondition(single.body.sourceType === 'single', 'single manifest must keep sourceType single');
  assertCondition(single.body.preprocessSignature === 'dense=1', 'single manifest must preserve preprocess signature');
  assertCondition(single.body.totalChunks === 1 && single.body.totalBlocks >= 1, 'single manifest must expose chunk/block counts');

  const cachedSingle = await service.getSingleManifest('single-novel', { preSplitDense:'1' });
  assertCondition(cachedSingle.body === single.body, 'manifest cache must reuse identical cached manifest object');
  assertCondition(service.getCacheStatus().manifestCacheEntries === 1, 'manifest cache status must expose one cached entry');

  const episode = await service.getEpisodeManifest('multi-novel', 'ep-1', {});
  assertCondition(episode.status === 200, 'episode manifest smoke must return status 200');
  assertCondition(episode.body.sourceType === 'episode' && episode.body.episodeId === 'ep-1', 'episode manifest must preserve episode identity');
  assertCondition(episode.body.novelTitle === 'Multi Novel', 'episode manifest must preserve parent novel title');
  assertCondition(episode.body.chunks.length === 2, 'episode manifest must expose chunk array from content service');

  const missingNovel = await service.getSingleManifest('missing', {});
  assertCondition(missingNovel.status === 404, 'missing single novel must return 404');
  const multiAggregate = await service.getSingleManifest('multi-novel', {});
  assertCondition(multiAggregate.status === 200 && multiAggregate.body.sourceType === 'multi', 'multi-file single endpoint must return aggregate manifest');
  assertCondition(Array.isArray(multiAggregate.body.episodes) && multiAggregate.body.episodes.length === 1, 'aggregate manifest must expose episode entries');
  assertCondition(multiAggregate.body.totalBlocks >= episode.body.totalBlocks, 'aggregate manifest must expose total block count');
  const missingEpisode = await service.getEpisodeManifest('multi-novel', 'missing-ep', {});
  assertCondition(missingEpisode.status === 404 && missingEpisode.body.error === 'Episode not found', 'missing episode boundary must remain 404');

  service.clearManifestCache();
  assertCondition(service.getCacheStatus().manifestCacheEntries === 0, 'clearManifestCache must clear cache status');
  assertCondition(splitContentBlocks('a\n\nb').length >= 2, 'splitContentBlocks must preserve paragraph block splitting');


  const { createDiagnosticsRouter } = requireWithMockedExpressRouter(projectRoot + '/server/routes/diagnostics-routes.js');
  const { createBlockManifestRouter } = requireWithMockedExpressRouter(projectRoot + '/server/routes/block-manifest-routes.js');
  const diagnosticsRouter = createDiagnosticsRouter({ setNoStore: (res) => res.setHeader('Cache-Control', 'no-store'), now: () => 123456 });
  const timeRes = await invokeExpressJsonRoute(diagnosticsRouter, '/time', { path:'/api/time' });
  assertCondition(timeRes.jsonBody?.ts === 123456, 'diagnostics /time route must use injected clock');
  requireHeader(timeRes, 'Cache-Control', 'diagnostics /time route must apply no-store');

  const routeLibraryService = {
    setLibraryMetaHeaders(res) { res.setHeader('X-Library-Meta', 'fixture'); }
  };
  const routeBlockManifestService = {
    async getSingleManifest(novelId, query) {
      if (novelId === 'boom') throw new Error('route boom');
      return { status: 207, body: { novelId, queryValue: query?.preSplitDense || '', sourceType:'single-route-smoke' } };
    },
    async getEpisodeManifest(novelId, episodeId, query) {
      return { status: 208, body: { novelId, episodeId, queryValue: query?.preSplitDense || '', sourceType:'episode-route-smoke' } };
    }
  };
  const blockManifestRouter = createBlockManifestRouter({
    setNoStore: (res) => res.setHeader('Cache-Control', 'no-store'),
    libraryService: routeLibraryService,
    blockManifestService: routeBlockManifestService
  });
  const singleRouteRes = await invokeExpressJsonRoute(blockManifestRouter, '/novels/:novelId/block-manifest', { params:{ novelId:'single-novel' }, query:{ preSplitDense:'1' } });
  requireJsonRouteResult(singleRouteRes, { statusCode:207, json:{ novelId:'single-novel' }, headers:['Cache-Control', 'X-Library-Meta'], context:'single block-manifest route' });
  const episodeRouteRes = await invokeExpressJsonRoute(blockManifestRouter, '/novels/:novelId/episodes/:episodeId/block-manifest', { params:{ novelId:'multi-novel', episodeId:'ep-1' }, query:{ preSplitDense:'0' } });
  requireJsonRouteResult(episodeRouteRes, { statusCode:208, json:{ episodeId:'ep-1' }, headers:['X-Library-Meta'], context:'episode block-manifest route' });
  const errorRouteRes = await invokeExpressJsonRoute(blockManifestRouter, '/novels/:novelId/block-manifest', { params:{ novelId:'boom' }, query:{} });
  requireJsonRouteErrorResult(errorRouteRes, { statusCode:500, message:'route boom', context:'single block-manifest error route' });

  return { pass: SERVER_DIAGNOSTICS_BLOCK_MANIFEST_SERVICE_SMOKE_PASS, routePass: SERVER_DIAGNOSTICS_BLOCK_MANIFEST_ROUTE_BEHAVIOR_PASS, jsonRouteFixturePass: SERVER_DIAGNOSTICS_BLOCK_MANIFEST_JSON_ROUTE_FIXTURE_PASS, errorFixturePass: SERVER_BLOCK_MANIFEST_ROUTE_ERROR_FIXTURE_PASS, jsonAssertFixturePass: SERVER_BLOCK_MANIFEST_ROUTE_JSON_ASSERT_FIXTURE_PASS, jsonErrorAssertPass: SERVER_BLOCK_MANIFEST_ROUTE_JSON_ERROR_ASSERT_PASS };
}

module.exports = {
  SERVER_DIAGNOSTICS_BLOCK_MANIFEST_SERVICE_SMOKE_PASS,
  SERVER_DIAGNOSTICS_BLOCK_MANIFEST_ROUTE_BEHAVIOR_PASS,
  SERVER_DIAGNOSTICS_BLOCK_MANIFEST_JSON_ROUTE_FIXTURE_PASS,
  SERVER_BLOCK_MANIFEST_ROUTE_ERROR_FIXTURE_PASS,
  SERVER_BLOCK_MANIFEST_ROUTE_JSON_ASSERT_FIXTURE_PASS,
  SERVER_BLOCK_MANIFEST_ROUTE_JSON_ERROR_ASSERT_PASS,
  runServerDiagnosticsBlockManifestServiceSmoke
};
