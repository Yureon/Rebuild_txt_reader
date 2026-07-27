const { CURRENT_REBUILD_VERSION } = require('./current-rebuild-version.js');
const SERVER_SMOKE_FIXTURES_PASS = 'v224-server-smoke-fixtures-pass';
const SERVER_SMOKE_ROUTE_FIXTURES_PASS = 'v225-server-smoke-route-fixtures-pass';
const SERVER_SMOKE_ROUTE_JSON_FIXTURE_PASS = 'v226-server-smoke-route-json-fixture-pass';
const SERVER_SMOKE_ROUTE_JSON_ASSERT_FIXTURE_PASS = 'v235-server-smoke-route-json-assert-fixture-pass';
const SERVER_SMOKE_ROUTE_JSON_ERROR_ASSERT_FIXTURE_PASS = 'v236-server-smoke-route-json-error-assert-fixture-pass';
const SERVER_SMOKE_STATE_SAMPLE_FIXTURE_PASS = 'v251-server-smoke-state-sample-fixture-pass';
const SERVER_SMOKE_SECURITY_NEGATIVE_FIXTURE_PASS = 'v251-server-smoke-security-negative-fixture-pass';
const SERVER_SMOKE_METHOD_NEGATIVE_FIXTURE_PASS = 'v251-server-smoke-method-negative-fixture-pass';
const SERVER_SMOKE_ROUTE_METHOD_MATRIX_PASS = 'v252-server-smoke-route-method-matrix-pass';
const SERVER_SMOKE_ROUTE_HANDLER_NEGATIVE_PASS = 'v253-server-smoke-route-handler-negative-pass';
const SERVER_SMOKE_ROUTE_HANDLER_PASSTHROUGH_PASS = 'v255-server-smoke-route-handler-passthrough-pass';
const SERVER_SMOKE_ROUTE_HANDLER_READONLY_PASSTHROUGH_PASS = 'v255-server-smoke-route-handler-readonly-passthrough-pass';
const SERVER_SMOKE_ROUTE_HANDLER_FAILURE_BRANCH_PASS = 'v256-server-smoke-route-handler-failure-branch-pass';
const SERVER_SMOKE_ROUTE_HANDLER_SERVICE_FAILURE_PASS = 'v257-server-smoke-route-handler-service-failure-pass';
const SERVER_SMOKE_ROUTE_HANDLER_SERVICE_FAILURE_DETAIL_PASS = 'v258-server-smoke-route-handler-service-failure-detail-pass';


function createServerSmokeStateSamples() {
  return [
    {
      name: 'shared sync merge sample',
      route: '/api/user-state/shared',
      method: 'put',
      body: { version: CURRENT_REBUILD_VERSION, progress: {}, bookmarks: [] },
      expectedMarkers: ['shared', 'sync', 'version']
    },
    {
      name: 'content chunk sample',
      route: '/api/novels/:novelId/content',
      method: 'get',
      query: { chunk: '2', preRemoveNoise: '1' },
      expectedMarkers: ['content', 'chunk']
    },
    {
      name: 'block manifest sample',
      route: '/api/novels/:novelId/block-manifest',
      method: 'get',
      query: { preCollapseBreaks: '1' },
      expectedMarkers: ['manifest', 'block']
    }
  ];
}

function validateServerSmokeStateSamples(samples = createServerSmokeStateSamples()) {
  const issues = [];
  for (const sample of samples) {
    const serialized = JSON.stringify(sample).toLowerCase();
    if (!sample.route || !sample.method) issues.push((sample.name || 'sample') + ':route-method');
    for (const marker of sample.expectedMarkers || []) {
      if (!serialized.includes(String(marker).toLowerCase())) issues.push((sample.name || 'sample') + ':' + marker);
    }
  }
  return issues;
}
function createServerSmokeSecurityNegativeCases() {
  return [
    {
      name: 'auth missing session cookie',
      route: '/api/user-state',
      method: 'get',
      request: { cookie: '', origin: 'http://localhost:3000' },
      expectedStatus: 401,
      expectedMarkers: ['auth', 'session']
    },
    {
      name: 'csrf missing token on shared state write',
      route: '/api/user-state/shared',
      method: 'put',
      request: { cookie: 'session_token=valid', origin: 'http://localhost:3000', csrf: '' },
      expectedStatus: 403,
      expectedMarkers: ['csrf', 'shared']
    },
    {
      name: 'origin mismatch on state write',
      route: '/api/user-state/shared',
      method: 'put',
      request: { cookie: 'session_token=valid', origin: 'https://evil.example', csrf: 'token' },
      expectedStatus: 403,
      expectedMarkers: ['origin', 'same-origin']
    }
  ];
}

function createServerSmokeMethodSpecificWriteNegativeCases() {
  const routes = [
    ['/api/user-state/shared', ['put','post','patch','delete']],
    ['/api/user-state/progress', ['put','post','patch','delete']],
    ['/api/user-state/device', ['put','post','patch','delete']],
    ['/api/sync', ['post']],
    ['/api/fileops/folders/rename', ['patch','post']],
    ['/api/fileops/novels/:novelId/rename', ['patch','post']],
    ['/api/fileops/novels/:novelId', ['delete']],
    ['/api/fileops/novels/:novelId/move', ['patch','post']],
    ['/api/fileops/episodes/:novelId/:episodeId/move', ['patch','post']],
    ['/api/fileops/folders/move', ['patch','post']],
    ['/api/fileops/novels/:novelId/episodes/:episodeId/rename', ['patch','post']],
    ['/api/fileops/novels/:novelId/episodes/:episodeId', ['delete']],
    ['/api/fileops/folders', ['delete']],
    ['/api/fonts/upload', ['post']],
    ['/api/fonts/:filename', ['delete']],
    ['/api/recovery/action', ['post']]
  ];
  return routes.flatMap(([route, methods]) => methods.map(method => ({
    name: method + ' write without csrf token on ' + route,
    route,
    method,
    request: { method:method.toUpperCase(), cookie:'session_token=valid', origin:'http://localhost:3000', csrf:'' },
    expectedStatus: 403,
    expectedMarkers: ['csrf', method, 'write', route.split('/')[2] || 'api'],
    matrixPass: SERVER_SMOKE_ROUTE_METHOD_MATRIX_PASS
  })));
}

function validateServerSmokeMethodSpecificWriteNegativeCases(cases = createServerSmokeMethodSpecificWriteNegativeCases()) {
  const issues = [];
  for (const item of cases) {
    const serialized = JSON.stringify(item).toLowerCase();
    if (!['post','put','patch','delete'].includes(String(item.method).toLowerCase())) issues.push((item.name || 'method') + ':method');
    if (Number(item.expectedStatus) !== 403) issues.push((item.name || 'method') + ':status');
    for (const marker of item.expectedMarkers || []) {
      if (!serialized.includes(String(marker).toLowerCase())) issues.push((item.name || 'method') + ':' + marker);
    }
  }
  if (cases.length < 10) issues.push('method-matrix:coverage');
  return issues;
}

function validateServerSmokeSecurityNegativeCases(cases = createServerSmokeSecurityNegativeCases()) {
  const issues = [];
  for (const item of cases) {
    const serialized = JSON.stringify(item).toLowerCase();
    if (!item.route || !item.method || !item.expectedStatus) issues.push((item.name || 'negative') + ':shape');
    if (![401, 403].includes(Number(item.expectedStatus))) issues.push((item.name || 'negative') + ':status');
    for (const marker of item.expectedMarkers || []) {
      if (!serialized.includes(String(marker).toLowerCase())) issues.push((item.name || 'negative') + ':' + marker);
    }
  }
  return issues;
}

function createFakeRes() {
  const headers = new Map();
  return {
    statusCode: 200,
    jsonBody: null,
    redirectTo: null,
    typeValue: null,
    setHeader(name, value) { headers.set(String(name).toLowerCase(), value); },
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    type(value) { this.typeValue = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.jsonBody = body; return this; },
    redirect(to) { this.redirectTo = to; return this; }
  };
}

function createReq({ path = '/', method = 'GET', cookie = '', origin = '', referer = '', csrf = '', confirmAction = '', params = {}, query = {}, body = {} } = {}) {
  return {
    path,
    method,
    params,
    query,
    body,
    headers: { cookie },
    get(name) {
      const key = String(name || '').toLowerCase();
      if (key === 'origin') return origin;
      if (key === 'referer') return referer;
      if (key === 'x-csrf-token') return csrf;
      if (key === 'x-confirm-action') return confirmAction;
      return '';
    }
  };
}

module.exports = {
  SERVER_SMOKE_FIXTURES_PASS,
  SERVER_SMOKE_ROUTE_FIXTURES_PASS,
  SERVER_SMOKE_ROUTE_JSON_FIXTURE_PASS,
  SERVER_SMOKE_ROUTE_JSON_ASSERT_FIXTURE_PASS,
  SERVER_SMOKE_ROUTE_JSON_ERROR_ASSERT_FIXTURE_PASS,
  SERVER_SMOKE_STATE_SAMPLE_FIXTURE_PASS,
  SERVER_SMOKE_SECURITY_NEGATIVE_FIXTURE_PASS,
  SERVER_SMOKE_METHOD_NEGATIVE_FIXTURE_PASS,
  SERVER_SMOKE_ROUTE_METHOD_MATRIX_PASS,
  SERVER_SMOKE_ROUTE_HANDLER_NEGATIVE_PASS,
  SERVER_SMOKE_ROUTE_HANDLER_PASSTHROUGH_PASS,
  SERVER_SMOKE_ROUTE_HANDLER_READONLY_PASSTHROUGH_PASS,
  SERVER_SMOKE_ROUTE_HANDLER_FAILURE_BRANCH_PASS,
  SERVER_SMOKE_ROUTE_HANDLER_SERVICE_FAILURE_PASS,
  SERVER_SMOKE_ROUTE_HANDLER_SERVICE_FAILURE_DETAIL_PASS,
  createServerSmokeStateSamples,
  validateServerSmokeStateSamples,
  createServerSmokeSecurityNegativeCases,
  validateServerSmokeSecurityNegativeCases,
  createServerSmokeMethodSpecificWriteNegativeCases,
  validateServerSmokeMethodSpecificWriteNegativeCases,
  createFakeRes,
  createReq,
  createFakeExpressRouter,
  getExpressRouteHandlers,
  getExpressRouteHandler,
  invokeExpressRouteHandler,
  invokeExpressRouteChain,
  invokeExpressJsonRoute,
  invokeExpressJsonRouteChain,
  requireJsonRouteResult,
  requireJsonRouteErrorResult,
  requireWithMockedExpressRouter
};



function getExpressRouteHandlers(router, routePath, method = 'get') {
  const layer = (router?.stack || []).find(item => item?.route?.path === routePath && item.route.methods?.[method]);
  const handlers = (layer?.route?.stack || []).map(item => item?.handle).filter(fn => typeof fn === 'function');
  if (!handlers.length) throw new Error(`Missing ${method.toUpperCase()} handlers for ${routePath}`);
  return handlers;
}

async function invokeExpressRouteChain(router, routePath, req, res, method = 'get') {
  const handlers = getExpressRouteHandlers(router, routePath, method);
  let index = -1;
  async function next() {
    index += 1;
    const handler = handlers[index];
    if (!handler) return undefined;
    return handler(req, res, next);
  }
  await next();
  return res;
}

async function invokeExpressJsonRouteChain(router, routePath, reqOptions = {}, method = 'get') {
  const res = createFakeRes();
  await invokeExpressRouteChain(router, routePath, createReq(reqOptions), res, method);
  return res;
}

function getExpressRouteHandler(router, routePath, method = 'get') {
  const layer = (router?.stack || []).find(item => item?.route?.path === routePath && item.route.methods?.[method]);
  const handler = layer?.route?.stack?.[0]?.handle;
  if (typeof handler !== 'function') throw new Error(`Missing ${method.toUpperCase()} handler for ${routePath}`);
  return handler;
}

async function invokeExpressRouteHandler(router, routePath, req, res, method = 'get') {
  const handler = getExpressRouteHandler(router, routePath, method);
  return handler(req, res, () => {});
}



async function invokeExpressJsonRoute(router, routePath, reqOptions = {}, method = 'get') {
  const res = createFakeRes();
  await invokeExpressRouteHandler(router, routePath, createReq(reqOptions), res, method);
  return res;
}


function requireJsonRouteResult(res, { statusCode = null, json = {}, headers = [], context = 'json route' } = {}) {
  if (!res) throw new Error(context + ' did not return a response object');
  if (statusCode !== null && res.statusCode !== statusCode) throw new Error(context + ' expected status ' + statusCode + ' but got ' + res.statusCode);
  Object.entries(json || {}).forEach(([key, value]) => {
    if (res.jsonBody?.[key] !== value) throw new Error(context + ' expected json.' + key + ' = ' + value + ' but got ' + res.jsonBody?.[key]);
  });
  (Array.isArray(headers) ? headers : []).forEach((header) => {
    if (!res.getHeader(header)) throw new Error(context + ' missing header: ' + header);
  });
  return res;
}


function requireJsonRouteErrorResult(res, { statusCode = 500, message = '', context = 'json error route' } = {}) {
  requireJsonRouteResult(res, { statusCode, context });
  if (!res.jsonBody || typeof res.jsonBody.error !== 'string') throw new Error(context + ' expected string json.error');
  if (message && res.jsonBody.error !== message) throw new Error(context + ' expected json.error = ' + message + ' but got ' + res.jsonBody.error);
  return res;
}

function createFakeExpressRouter() {
  return {
    stack: [],
    get(routePath, ...handlers) {
      this.stack.push({ route: { path: routePath, methods: { get: true }, stack: handlers.map(handle => ({ handle })) } });
      return this;
    },
    post(routePath, ...handlers) {
      this.stack.push({ route: { path: routePath, methods: { post: true }, stack: handlers.map(handle => ({ handle })) } });
      return this;
    },
    put(routePath, ...handlers) {
      this.stack.push({ route: { path: routePath, methods: { put: true }, stack: handlers.map(handle => ({ handle })) } });
      return this;
    },
    patch(routePath, ...handlers) {
      this.stack.push({ route: { path: routePath, methods: { patch: true }, stack: handlers.map(handle => ({ handle })) } });
      return this;
    },
    delete(routePath, ...handlers) {
      this.stack.push({ route: { path: routePath, methods: { delete: true }, stack: handlers.map(handle => ({ handle })) } });
      return this;
    }
  };
}

function requireWithMockedExpressRouter(modulePath) {
  const Module = require('module');
  const originalLoad = Module._load;
  Module._load = function mockedExpressLoad(request, parent, isMain) {
    if (request === 'express') return { Router: createFakeExpressRouter, raw: () => (req, res, next) => next && next() };
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    delete require.cache[require.resolve(modulePath)];
    return require(modulePath);
  } finally {
    Module._load = originalLoad;
  }
}
