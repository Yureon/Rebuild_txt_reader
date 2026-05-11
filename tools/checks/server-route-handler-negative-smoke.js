const { CURRENT_REBUILD_VERSION } = require('./current-rebuild-version.js');
const path = require('path');
const {
  SERVER_SMOKE_ROUTE_HANDLER_NEGATIVE_PASS,
  SERVER_SMOKE_ROUTE_HANDLER_PASSTHROUGH_PASS,
  SERVER_SMOKE_ROUTE_HANDLER_READONLY_PASSTHROUGH_PASS,
  SERVER_SMOKE_ROUTE_HANDLER_FAILURE_BRANCH_PASS,
  SERVER_SMOKE_ROUTE_HANDLER_SERVICE_FAILURE_PASS,
  SERVER_SMOKE_ROUTE_HANDLER_SERVICE_FAILURE_DETAIL_PASS,
  createReq,
  createFakeRes,
  invokeExpressRouteChain,
  requireWithMockedExpressRouter
} = require('./server-smoke-fixtures.js');

function createRejectingMiddleware(label, statusCode = 403) {
  return (req, res, next) => {
    const shouldReject = label === 'origin' ? req.get('origin') === 'https://evil.example' : !req.get('x-csrf-token');
    if (shouldReject) return res.status(statusCode).json({ error: label + ' rejected' });
    return next();
  };
}

function createStateWriteService() {
  return {
    getUserStateResponse: () => ({ ok:true }),
    saveSharedState: () => ({ ok:true, route:'shared' }),
    saveProgressState: () => ({ ok:true, route:'progress' }),
    saveDeviceState: () => ({ ok:true, route:'device' }),
    getLegacySyncState: () => ({ ok:true })
  };
}

function createFileopsService() {
  const ok = () => ({ ok:true });
  return {
    sendFsError: (res, error) => res.status(error?.status || 500).json({ error:error?.message || 'fs error' }),
    renameFolder: ok,
    renameNovel: ok,
    deleteNovel: ok,
    moveNovel: ok,
    moveEpisode: ok,
    moveFolder: ok,
    renameEpisode: ok,
    deleteEpisode: ok,
    deleteFolder: ok
  };
}

function createFontService() {
  return {
    getFontListResponse: () => ({ fonts:[] }),
    uploadFont: () => ({ success:true }),
    deleteFont: () => ({ success:true }),
    getFontFileForResponse: () => ({ filename:'sample.woff2', mimeType:'font/woff2', filePath:'/tmp/sample.woff2' })
  };
}

function createFailingStateWriteService() {
  const fail = (label) => { const error = new Error(label + ' failed'); error.statusCode = 503; throw error; };
  return {
    getUserStateResponse: () => fail('state read'),
    saveSharedState: () => fail('shared state'),
    saveProgressState: () => fail('progress state'),
    saveDeviceState: () => fail('device state'),
    getLegacySyncState: () => fail('legacy sync read')
  };
}

function createFailingFileopsService() {
  const fail = (label) => { const error = new Error(label + ' failed'); error.status = 500; throw error; };
  return {
    sendFsError: (res, error) => res.status(error?.status || 500).json({ error:error?.message || 'fs error' }),
    renameFolder: () => fail('rename folder'),
    renameNovel: () => fail('rename novel'),
    deleteNovel: () => fail('delete novel'),
    moveNovel: () => fail('move novel'),
    moveEpisode: () => fail('move episode'),
    moveFolder: () => fail('move folder'),
    renameEpisode: () => fail('rename episode'),
    deleteEpisode: () => fail('delete episode'),
    deleteFolder: () => fail('delete folder')
  };
}

function createFontSessionStore(kind = 'user', userId = 'reader-a') {
  return { validateSession: () => true, getSession: () => ({ kind, userId, username:userId, role:kind === 'owner' ? 'owner' : 'reader' }) };
}
function getFontSessionTokenFromReq() { return 'font-session-token'; }

function createFailingFontService() {
  const fail = (label) => { const error = new Error(label + ' failed'); error.status = 500; throw error; };
  return {
    getFontListResponse: () => fail('font list'),
    uploadFont: () => fail('font upload'),
    deleteFont: () => fail('font delete'),
    getFontFileForResponse: () => fail('font file')
  };
}

async function assertAccepted(router, routePath, method, reqOptions, context, expectedStatus = 200) {
  const res = createFakeRes();
  await invokeExpressRouteChain(router, routePath, createReq({ method:method.toUpperCase(), ...reqOptions }), res, method);
  if (res.statusCode !== expectedStatus) throw new Error(context + ' expected ' + expectedStatus + ' but got ' + res.statusCode);
  if (expectedStatus === 200 && !res.jsonBody) throw new Error(context + ' expected json success body');
  return res;
}



async function assertServiceThrows(router, routePath, method, reqOptions, context) {
  const res = createFakeRes();
  try {
    await invokeExpressRouteChain(router, routePath, createReq({ method:method.toUpperCase(), ...reqOptions }), res, method);
  } catch (error) {
    if (!String(error?.message || '').includes('failed')) throw new Error(context + ' threw unexpected error: ' + (error?.message || error));
    return { context, thrown:true, error:String(error.message || error) };
  }
  throw new Error(context + ' expected thrown service failure');
}

async function assertServiceFailure(router, routePath, method, reqOptions, context, expectedStatus = 500) {
  const res = createFakeRes();
  await invokeExpressRouteChain(router, routePath, createReq({ method:method.toUpperCase(), ...reqOptions }), res, method);
  if (res.statusCode !== expectedStatus) throw new Error(context + ' expected service failure status ' + expectedStatus + ' but got ' + res.statusCode);
  if (!res.jsonBody || typeof res.jsonBody.error !== 'string' || !res.jsonBody.error.includes('failed')) throw new Error(context + ' expected service failure json error');
  return { context, statusCode: res.statusCode, error: res.jsonBody.error };
}

async function assertRejected(router, routePath, method, reqOptions, context) {
  const res = createFakeRes();
  await invokeExpressRouteChain(router, routePath, createReq({ method:method.toUpperCase(), ...reqOptions }), res, method);
  if (res.statusCode !== 403) throw new Error(context + ' expected 403 but got ' + res.statusCode);
  if (!res.jsonBody?.error) throw new Error(context + ' expected json error body');
  return res;
}

async function runServerRouteHandlerNegativeSmoke(projectRoot) {
  if (!projectRoot) throw new Error('runServerRouteHandlerNegativeSmoke requires projectRoot');
  const stateRoutes = requireWithMockedExpressRouter(path.join(projectRoot, 'server/routes/state-routes.js'));
  const fileopsRoutes = requireWithMockedExpressRouter(path.join(projectRoot, 'server/routes/fileops-routes.js'));
  const fontRoutes = requireWithMockedExpressRouter(path.join(projectRoot, 'server/routes/font-routes.js'));
  const recoveryRoutes = requireWithMockedExpressRouter(path.join(projectRoot, 'server/routes/recovery-routes.js'));
  const diagnosticsRoutes = requireWithMockedExpressRouter(path.join(projectRoot, 'server/routes/diagnostics-routes.js'));
  const blockManifestRoutes = requireWithMockedExpressRouter(path.join(projectRoot, 'server/routes/block-manifest-routes.js'));

  const stateRouter = stateRoutes.createStateRouter({
    setNoStore: (res) => res.setHeader('Cache-Control', 'no-store'),
    requireSameOrigin: createRejectingMiddleware('origin'),
    requireCsrf: createRejectingMiddleware('csrf'),
    checkApiWriteLimit: () => true,
    stateWriteService: createStateWriteService()
  });
  const fileopsRouter = fileopsRoutes.createFileopsRouter({
    requireSameOrigin: createRejectingMiddleware('origin'),
    requireCsrf: createRejectingMiddleware('csrf'),
    fileopsService: createFileopsService()
  });
  const fontRouter = fontRoutes.createFontRouter({
    requireSameOrigin: createRejectingMiddleware('origin'),
    requireCsrf: createRejectingMiddleware('csrf'),
    checkApiWriteLimit: () => true,
    sessionStore: createFontSessionStore(),
    getSessionTokenFromReq: getFontSessionTokenFromReq,
    fontService: createFontService()
  });
  const recoveryRouter = recoveryRoutes.createRecoveryRouter({
    setNoStore: (res) => res.setHeader('Cache-Control', 'no-store'),
    recoveryService: { getRecoveryStatus: () => ({ ok:true, degraded:false, v:'v255' }) }
  });
  const diagnosticsRouter = diagnosticsRoutes.createDiagnosticsRouter({
    setNoStore: (res) => res.setHeader('Cache-Control', 'no-store'),
    now: () => 1234567890
  });
  const blockManifestRouter = blockManifestRoutes.createBlockManifestRouter({
    setNoStore: (res) => res.setHeader('Cache-Control', 'no-store'),
    libraryService: { setLibraryMetaHeaders: (res) => res.setHeader('X-Library-Meta', 'ok') },
    blockManifestService: {
      getSingleManifest: async () => ({ status:200, body:{ ok:true, route:'single' } }),
      getEpisodeManifest: async () => ({ status:200, body:{ ok:true, route:'episode' } })
    }
  });

  const failingStateRouter = stateRoutes.createStateRouter({
    setNoStore: (res) => res.setHeader('Cache-Control', 'no-store'),
    requireSameOrigin: createRejectingMiddleware('origin'),
    requireCsrf: createRejectingMiddleware('csrf'),
    checkApiWriteLimit: () => true,
    stateWriteService: createFailingStateWriteService()
  });
  const failingFileopsRouter = fileopsRoutes.createFileopsRouter({
    requireSameOrigin: createRejectingMiddleware('origin'),
    requireCsrf: createRejectingMiddleware('csrf'),
    fileopsService: createFailingFileopsService()
  });
  const failingFontRouter = fontRoutes.createFontRouter({
    requireSameOrigin: createRejectingMiddleware('origin'),
    requireCsrf: createRejectingMiddleware('csrf'),
    checkApiWriteLimit: () => true,
    sessionStore: createFontSessionStore(),
    getSessionTokenFromReq: getFontSessionTokenFromReq,
    fontService: createFailingFontService()
  });

  const failingBlockManifestRouter = blockManifestRoutes.createBlockManifestRouter({
    setNoStore: (res) => res.setHeader('Cache-Control', 'no-store'),
    libraryService: { setLibraryMetaHeaders: (res) => res.setHeader('X-Library-Meta', 'ok') },
    blockManifestService: {
      getSingleManifest: async () => { throw new Error('single manifest failed'); },
      getEpisodeManifest: async () => { throw new Error('episode manifest failed'); }
    }
  });

  const cases = [
    [stateRouter, '/user-state/shared', 'put', { origin:'http://localhost:3000', csrf:'' }, 'state shared csrf'],
    [stateRouter, '/user-state/device', 'put', { origin:'https://evil.example', csrf:'token' }, 'state device origin'],
    [stateRouter, '/sync', 'post', { origin:'http://localhost:3000', csrf:'' }, 'legacy sync csrf'],
    [fileopsRouter, '/folders/rename', 'patch', { origin:'http://localhost:3000', csrf:'' }, 'fileops folder csrf'],
    [fileopsRouter, '/novels/:novelId', 'delete', { origin:'https://evil.example', csrf:'token', params:{ novelId:'n1' } }, 'fileops delete origin'],
    [fontRouter, '/fonts/upload', 'post', { origin:'http://localhost:3000', csrf:'' }, 'font upload csrf'],
    [fontRouter, '/fonts/:filename', 'delete', { origin:'https://evil.example', csrf:'token', params:{ filename:'sample.woff2' } }, 'font delete origin']
  ];
  for (const item of cases) await assertRejected(...item);

  const validRequest = { origin:'http://localhost:3000', csrf:'token' };
  const renameConfirm = { confirmAction:'fileops-rename' };
  const moveConfirm = { confirmAction:'fileops-move' };
  const deleteConfirm = { confirmAction:'fileops-delete' };
  const passthroughCases = [
    [stateRouter, '/user-state/shared', 'put', { ...validRequest, body:{ version:'rebuild-v256' } }, 'state shared passthrough'],
    [stateRouter, '/user-state/progress', 'put', { ...validRequest, body:{ novelId:'n1', chunk:1 } }, 'state progress passthrough'],
    [fileopsRouter, '/folders/rename', 'patch', { ...validRequest, ...renameConfirm, body:{ categoryPath:'old', newName:'new' } }, 'fileops folder rename passthrough'],
    [fontRouter, '/fonts/upload', 'post', { ...validRequest, body:Buffer.from('font') }, 'font upload passthrough']
  ];
  for (const item of passthroughCases) await assertAccepted(...item);
  await assertAccepted(stateRouter, '/sync', 'post', validRequest, 'legacy sync disabled passthrough', 410);

  const readonlyCases = [
    [recoveryRouter, '/recovery-status', 'get', {}, 'recovery status readonly passthrough'],
    [diagnosticsRouter, '/time', 'get', {}, 'diagnostics time readonly passthrough'],
    [blockManifestRouter, '/novels/:novelId/block-manifest', 'get', { params:{ novelId:'n1' }, query:{ preCollapseBreaks:'1' } }, 'single block manifest readonly passthrough'],
    [blockManifestRouter, '/novels/:novelId/episodes/:episodeId/block-manifest', 'get', { params:{ novelId:'n1', episodeId:'e1' }, query:{} }, 'episode block manifest readonly passthrough']
  ];
  for (const item of readonlyCases) await assertAccepted(...item);

  const failureBranchCases = [
    [failingBlockManifestRouter, '/novels/:novelId/block-manifest', 'get', { params:{ novelId:'n1' }, query:{} }, 'single block manifest failure branch'],
    [failingBlockManifestRouter, '/novels/:novelId/episodes/:episodeId/block-manifest', 'get', { params:{ novelId:'n1', episodeId:'e1' }, query:{} }, 'episode block manifest failure branch']
  ];
  for (const item of failureBranchCases) await assertAccepted(item[0], item[1], item[2], item[3], item[4], 500);

  const serviceFailureCases = [
    [failingStateRouter, '/user-state', 'get', {}, 'state read service failure', 503],
    [failingStateRouter, '/user-state/shared', 'put', { ...validRequest, body:{ version:CURRENT_REBUILD_VERSION } }, 'state shared service failure', 503],
    [failingStateRouter, '/user-state/progress', 'put', { ...validRequest, body:{ novelId:'n1', chunk:1 } }, 'state progress service failure', 503],
    [failingStateRouter, '/user-state/device', 'put', { ...validRequest, body:{ deviceId:'d1' } }, 'state device service failure', 503],
    [failingStateRouter, '/sync', 'get', {}, 'state legacy sync service failure', 503],
    [failingFileopsRouter, '/folders/rename', 'patch', { ...validRequest, ...renameConfirm, body:{ categoryPath:'old', newName:'new' } }, 'fileops folder rename service failure', 500],
    [failingFileopsRouter, '/novels/:novelId/rename', 'patch', { ...validRequest, ...renameConfirm, params:{ novelId:'n1' }, body:{ title:'t' } }, 'fileops novel rename service failure', 500],
    [failingFileopsRouter, '/novels/:novelId', 'delete', { ...validRequest, ...deleteConfirm, params:{ novelId:'n1' }, body:{ confirmText:'DELETE' } }, 'fileops novel delete service failure', 500],
    [failingFileopsRouter, '/novels/:novelId/move', 'patch', { ...validRequest, ...moveConfirm, params:{ novelId:'n1' }, body:{ targetCategoryPath:'cat' } }, 'fileops novel move service failure', 500],
    [failingFileopsRouter, '/episodes/:novelId/:episodeId/move', 'patch', { ...validRequest, ...moveConfirm, params:{ novelId:'n1', episodeId:'e1' }, body:{ targetCategoryPath:'cat' } }, 'fileops episode move service failure', 500],
    [failingFileopsRouter, '/folders/move', 'patch', { ...validRequest, ...moveConfirm, body:{ categoryPath:'old', targetCategoryPath:'new' } }, 'fileops folder move service failure', 500],
    [failingFileopsRouter, '/novels/:novelId/episodes/:episodeId/rename', 'patch', { ...validRequest, ...renameConfirm, params:{ novelId:'n1', episodeId:'e1' }, body:{ title:'ep' } }, 'fileops episode rename service failure', 500],
    [failingFileopsRouter, '/novels/:novelId/episodes/:episodeId', 'delete', { ...validRequest, ...deleteConfirm, params:{ novelId:'n1', episodeId:'e1' }, body:{ confirmText:'DELETE' } }, 'fileops episode delete service failure', 500],
    [failingFileopsRouter, '/folders', 'delete', { ...validRequest, ...deleteConfirm, body:{ categoryPath:'old', confirmText:'DELETE' } }, 'fileops folder delete service failure', 500],
    [failingFontRouter, '/fonts/upload', 'post', { ...validRequest, body:Buffer.from('font') }, 'font upload service failure', 500],
    [failingFontRouter, '/fonts/:filename', 'delete', { ...validRequest, params:{ filename:'sample.woff2' } }, 'font delete service failure', 500],
    [failingFontRouter, '/fonts/file/:filename', 'get', { params:{ filename:'sample.woff2' } }, 'font file service failure', 500]
  ];
  const originalConsoleError = console.error;
  const serviceFailureDetails = [];
  const unhandledServiceFailureCases = [
    [failingFontRouter, '/fonts', 'get', {}, 'font list service failure unwrapped']
  ];
  console.error = () => {};
  try {
    for (const item of serviceFailureCases) serviceFailureDetails.push(await assertServiceFailure(item[0], item[1], item[2], item[3], item[4], item[5]));
    for (const item of unhandledServiceFailureCases) serviceFailureDetails.push(await assertServiceThrows(item[0], item[1], item[2], item[3], item[4]));
  } finally {
    console.error = originalConsoleError;
  }

  return {
    pass: SERVER_SMOKE_ROUTE_HANDLER_NEGATIVE_PASS,
    passthroughPass: SERVER_SMOKE_ROUTE_HANDLER_PASSTHROUGH_PASS,
    readonlyPassthroughPass: SERVER_SMOKE_ROUTE_HANDLER_READONLY_PASSTHROUGH_PASS,
    failureBranchPass: SERVER_SMOKE_ROUTE_HANDLER_FAILURE_BRANCH_PASS,
    serviceFailurePass: SERVER_SMOKE_ROUTE_HANDLER_SERVICE_FAILURE_PASS,
    serviceFailureDetailPass: SERVER_SMOKE_ROUTE_HANDLER_SERVICE_FAILURE_DETAIL_PASS,
    cases: cases.length,
    passthroughCases: passthroughCases.length + 1,
    readonlyCases: readonlyCases.length,
    failureBranchCases: failureBranchCases.length,
    serviceFailureCases: serviceFailureCases.length,
    unhandledServiceFailureCases: unhandledServiceFailureCases.length,
    serviceFailureDetails
  };
}

module.exports = { SERVER_SMOKE_ROUTE_HANDLER_NEGATIVE_PASS, SERVER_SMOKE_ROUTE_HANDLER_PASSTHROUGH_PASS, SERVER_SMOKE_ROUTE_HANDLER_READONLY_PASSTHROUGH_PASS, SERVER_SMOKE_ROUTE_HANDLER_FAILURE_BRANCH_PASS, SERVER_SMOKE_ROUTE_HANDLER_SERVICE_FAILURE_PASS, SERVER_SMOKE_ROUTE_HANDLER_SERVICE_FAILURE_DETAIL_PASS, runServerRouteHandlerNegativeSmoke };
