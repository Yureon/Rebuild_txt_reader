const { requireAllMarkers } = require('./check-utils.js');
const { assertCondition, requireHeader, requireNextCalled, requireStatus } = require('./server-smoke-assertions.js');
const { createFakeRes, createReq, createServerSmokeSecurityNegativeCases, createServerSmokeMethodSpecificWriteNegativeCases } = require('./server-smoke-fixtures.js');

const SERVER_MIDDLEWARE_SMOKE_PASS = 'v224-server-middleware-fixtures-helper-pass';
const SERVER_MIDDLEWARE_NEGATIVE_DIRECT_SMOKE_PASS = 'v251-server-middleware-negative-direct-smoke-pass';
const SERVER_MIDDLEWARE_METHOD_NEGATIVE_DIRECT_SMOKE_PASS = 'v251-server-middleware-method-negative-direct-smoke-pass';

function runServerMethodNegativeDirectCases(auth, sessionStore) {
  const csrf = auth.createCsrfMiddleware({ sessionStore });
  const results = [];
  for (const item of createServerSmokeMethodSpecificWriteNegativeCases()) {
    const res = createFakeRes();
    csrf(createReq({ path:item.route, ...(item.request || {}) }), res, () => {});
    requireStatus(res, item.expectedStatus, 'method negative direct middleware case failed: ' + item.name);
    results.push({ name:item.name, method:item.method, status:res.statusCode });
  }
  return { pass: SERVER_MIDDLEWARE_METHOD_NEGATIVE_DIRECT_SMOKE_PASS, cases:results.length, results };
}

function runServerSecurityNegativeDirectCases(auth, sessionStore) {
  const sameOrigin = auth.createSameOriginMiddleware({ getAllowedOrigins: () => ['http://localhost:3000'] });
  const csrf = auth.createCsrfMiddleware({ sessionStore });
  const gate = auth.createAuthGate({ sessionStore });
  const results = [];
  for (const item of createServerSmokeSecurityNegativeCases()) {
    const res = createFakeRes();
    const req = createReq({ path:item.route, ...(item.request || {}) });
    if ((item.expectedMarkers || []).includes('origin')) {
      sameOrigin(req, res, () => {});
    } else if ((item.expectedMarkers || []).includes('csrf')) {
      csrf(req, res, () => {});
    } else {
      gate(req, res, () => {});
    }
    requireStatus(res, item.expectedStatus, 'negative direct middleware case failed: ' + item.name);
    results.push({ name:item.name, status:res.statusCode });
  }
  return { pass: SERVER_MIDDLEWARE_NEGATIVE_DIRECT_SMOKE_PASS, cases:results.length, results };
}

function runServerMiddlewareDirectSmoke(projectRoot) {
  if (!projectRoot) throw new Error('runServerMiddlewareDirectSmoke requires projectRoot');
  const auth = require(projectRoot + '/server/middleware/auth.js');
  const security = require(projectRoot + '/server/middleware/security.js');
  const cachePolicy = require(projectRoot + '/server/middleware/cache-policy.js');
  const { BUILD_ID } = require(projectRoot + '/server/version-contract.js');

  requireAllMarkers(security.buildContentSecurityPolicy(), [
    "default-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "form-action 'self'"
  ], 'v217 middleware CSP smoke');

  const securityRes = createFakeRes();
  security.applySecurityHeaders(createReq(), securityRes, () => {});
  ['X-Content-Type-Options','X-Frame-Options','Referrer-Policy','Permissions-Policy','Cross-Origin-Resource-Policy','Origin-Agent-Cluster','X-DNS-Prefetch-Control','Content-Security-Policy'].forEach((header) => {
    requireHeader(securityRes, header, 'security middleware missing header: ' + header);
  });

  const cssRes = createFakeRes();
  cachePolicy.applyStaticCachePolicy(cssRes, '/app/public/styles/app.css');
  assertCondition(String(cssRes.getHeader('Cache-Control') || '').includes('must-revalidate'), 'queryless app.css must revalidate');
  assertCondition(!String(cssRes.getHeader('Cache-Control') || '').includes('immutable'), 'queryless app.css must not be immutable');
  const libraryHtmlRes = createFakeRes();
  cachePolicy.applyStaticCachePolicy(libraryHtmlRes, '/app/public/library.html');
  assertCondition(String(libraryHtmlRes.getHeader('Cache-Control') || '').includes('no-store'), 'library.html must keep no-store cache policy');
  const htmlRes = createFakeRes();
  cachePolicy.applyStaticCachePolicy(htmlRes, '/app/public/site.html');
  assertCondition(String(htmlRes.getHeader('Cache-Control') || '').includes('no-store'), 'site.html must keep no-store cache policy');
  const loginRes = createFakeRes();
  cachePolicy.applyStaticCachePolicy(loginRes, '/app/public/login.html');
  assertCondition(String(loginRes.getHeader('Cache-Control') || '').includes('no-store'), 'login.html must keep no-store cache policy');
  assertCondition(loginRes.getHeader('Pragma') === 'no-cache', 'login.html must prevent intermediary cache reuse');
  assertCondition(loginRes.getHeader('X-TXT-Reader-Build') === BUILD_ID, 'static responses must expose the current build identity');
  const manifestRes = createFakeRes();
  cachePolicy.applyStaticCachePolicy(manifestRes, '/app/public/manifest.json');
  assertCondition(String(manifestRes.getHeader('Cache-Control') || '').includes('3600'), 'manifest.json must keep bounded revalidation cache policy');
  const moduleRes = createFakeRes();
  cachePolicy.applyStaticCachePolicy(moduleRes, '/app/public/scripts/rebuild/main.mjs');
  assertCondition(String(moduleRes.getHeader('Cache-Control') || '').includes('must-revalidate'), 'rebuild modules must keep revalidation cache policy');
  assertCondition(String(moduleRes.typeValue || '').includes('text/javascript'), 'mjs static policy must set text/javascript type');

  ['/api/login','/login.html','/manifest.json','/favicon.ico','/apple-touch-icon.png','/apple-touch-icon-precomposed.png','/icon/icon-192.png','/icon/maskable-192.png'].forEach((route) => {
    assertCondition(auth.isPublicAuthPath(route), route + ' must remain public auth path');
  });
  ['/api/user-state','/api/novels','/api/content','/fonts/file/example.woff2','/icon-192.png','/maskable-192.png','/random.png'].forEach((route) => {
    assertCondition(!auth.isPublicAuthPath(route), route + ' must not be public auth path');
  });
  assertCondition(auth.getSessionTokenFromReq(createReq({ cookie:'a=1; session_token=abc123; b=2' })) === 'abc123', 'legacy session token cookie parsing failed');
  assertCondition(auth.getSessionTokenFromReq(createReq({ cookie:'session_token=legacy; __Host-session_token=hosted' })) === 'hosted', 'host-prefixed session token must be preferred over legacy cookie');

  const sessionStore = {
    validateSession(token) { return token === 'ok-session' || token === 'valid'; },
    getCsrfToken(token) { return (token === 'ok-session' || token === 'valid') ? 'csrf-token' : ''; }
  };
  let passed = false;
  auth.createAuthGate({ sessionStore })(createReq({ path:'/api/user-state', cookie:'session_token=ok-session' }), createFakeRes(), () => { passed = true; });
  requireNextCalled(passed, 'auth gate did not pass valid API session');
  const unauthRes = createFakeRes();
  auth.createAuthGate({ sessionStore })(createReq({ path:'/api/user-state' }), unauthRes, () => {});
  requireStatus(unauthRes, 401, 'auth gate must reject unauthenticated API request');

  const pageRedirectRes = createFakeRes();
  auth.createAuthGate({ sessionStore })(createReq({ path:'/site.html' }), pageRedirectRes, () => {});
  assertCondition(pageRedirectRes.redirectTo === '/login.html', 'auth gate must redirect unauthenticated page request to login.html');
  let publicPassed = false;
  auth.createAuthGate({ sessionStore })(createReq({ path:'/manifest.json' }), createFakeRes(), () => { publicPassed = true; });
  requireNextCalled(publicPassed, 'auth gate must pass manifest.json as a public path');

  const sameOrigin = auth.createSameOriginMiddleware({ getAllowedOrigins: () => ['https://reader.example'] });
  const blockedOriginRes = createFakeRes();
  sameOrigin(createReq({ path:'/api/user-state', origin:'https://evil.example' }), blockedOriginRes, () => {});
  requireStatus(blockedOriginRes, 403, 'same-origin middleware must block disallowed origin');
  const blockedRefererRes = createFakeRes();
  sameOrigin(createReq({ path:'/api/user-state', referer:'https://evil.example/path' }), blockedRefererRes, () => {});
  requireStatus(blockedRefererRes, 403, 'same-origin middleware must block disallowed referer');
  let originPassed = false;
  sameOrigin(createReq({ path:'/api/user-state', origin:'https://reader.example' }), createFakeRes(), () => { originPassed = true; });
  requireNextCalled(originPassed, 'same-origin middleware did not pass allowed origin');
  let refererPassed = false;
  sameOrigin(createReq({ path:'/api/user-state', referer:'https://reader.example/books' }), createFakeRes(), () => { refererPassed = true; });
  requireNextCalled(refererPassed, 'same-origin middleware did not pass allowed referer');

  let emptyOriginPassed = false;
  auth.createSameOriginMiddleware({ getAllowedOrigins: () => [] })(createReq({ path:'/api/user-state', origin:'https://any.example' }), createFakeRes(), () => { emptyOriginPassed = true; });
  requireNextCalled(emptyOriginPassed, 'same-origin middleware must pass when no allowed origins are configured');
  const malformedRefererRes = createFakeRes();
  sameOrigin(createReq({ path:'/api/user-state', referer:'not a url' }), malformedRefererRes, () => {});
  requireStatus(malformedRefererRes, 403, 'same-origin middleware must block malformed referer');

  const csrfRes = createFakeRes();
  auth.createCsrfMiddleware({ sessionStore })(createReq({ path:'/api/user-state', cookie:'session_token=ok-session', csrf:'wrong' }), csrfRes, () => {});
  requireStatus(csrfRes, 403, 'csrf middleware must block wrong token');
  let csrfPassed = false;
  auth.createCsrfMiddleware({ sessionStore })(createReq({ path:'/api/user-state', cookie:'session_token=ok-session', csrf:'csrf-token' }), createFakeRes(), () => { csrfPassed = true; });
  requireNextCalled(csrfPassed, 'csrf middleware did not pass valid token');

  const negativeDirect = runServerSecurityNegativeDirectCases(auth, sessionStore);
  const methodNegativeDirect = runServerMethodNegativeDirectCases(auth, sessionStore);

  return { pass: SERVER_MIDDLEWARE_SMOKE_PASS, negativeDirect, methodNegativeDirect };
}

module.exports = {
  SERVER_MIDDLEWARE_SMOKE_PASS,
  SERVER_MIDDLEWARE_NEGATIVE_DIRECT_SMOKE_PASS,
  SERVER_MIDDLEWARE_METHOD_NEGATIVE_DIRECT_SMOKE_PASS,
  runServerMethodNegativeDirectCases,
  runServerSecurityNegativeDirectCases,
  runServerMiddlewareDirectSmoke
};
