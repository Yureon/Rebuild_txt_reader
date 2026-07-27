#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { buildContentSecurityPolicy } = require('../../server/middleware/security');
const authMiddleware = require('../../server/middleware/auth');

const root = path.resolve(__dirname, '../..');
const PASS = 'v535-security-hardening-smoke-pass';
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

const env = read('server/config/env.js');
assert.ok(env.includes('USER_PASSWORD_MIN_LENGTH'), 'user password minimum env export missing');
assert.ok(env.includes('parseBoundedInteger(process.env.USER_PASSWORD_MIN_LENGTH, 8, 8, 128)'), 'user password minimum must clamp to 8+');
assert.ok(env.includes('ALLOW_CLOUDFLARE_INSIGHTS'), 'Cloudflare CSP opt-in flag missing');
assert.ok(env.includes('ALLOW_BLOB_WORKER'), 'blob worker CSP opt-in flag missing');

const accountService = read('server/services/account-service.js');
assert.ok(accountService.includes("require('../config/env')"), 'account service must read user password policy from env config');
assert.ok(accountService.includes('USER_PASSWORD_MIN_LENGTH'), 'account service must use USER_PASSWORD_MIN_LENGTH');

const app = read('server/app.js');
assert.ok(app.includes('loginIpLimiter = createLoginLimiter({ max: 60'), 'login IP-wide limiter missing');
assert.ok(app.includes('registerIpLimiter = createLoginLimiter({ max: 30'), 'register IP-wide limiter missing');
assert.ok(app.includes('loginIpLimiter,') && app.includes('registerIpLimiter,'), 'auth router must receive IP-wide limiters');

const authRoutes = read('server/routes/auth-routes.js');
assert.ok(authRoutes.includes('v535-auth-ip-wide-rate-limit-pass'), 'IP limiter marker missing');
assert.ok(authRoutes.includes("loginIpLimiter.check(ip, 'all-login')"), 'login route must check IP-wide limiter');
assert.ok(authRoutes.includes("registerIpLimiter.check(ip, 'all-register')"), 'register route must check IP-wide limiter');
assert.ok(authRoutes.includes('loginLimiter.check(ip, id)'), 'existing per-identity login limiter must remain');
assert.ok(authRoutes.includes('createRegisterLimitKey'), 'existing register composite limiter must remain');

const fontRoutes = read('server/routes/font-routes.js');
assert.ok(fontRoutes.includes("limit: '8mb'"), 'font upload raw parser limit must match service cap');
assert.ok(fontRoutes.includes('v535-font-upload-body-limit-pass'), 'font upload body limit marker missing');

const origins = read('server/config/origins.js');
assert.ok(origins.includes('shouldUseHostFallbackOrigin'), 'origin fallback policy helper missing');
assert.ok(origins.includes("process.env.NODE_ENV === 'production' && REQUIRE_STRICT_ORIGIN"), 'production strict origin fallback must be disabled');

const auth = read('server/middleware/auth.js');
assert.ok(auth.includes('origin configuration missing'), 'strict origin fail-closed response missing');
let statusCode = 0;
let payload = null;
const strictOrigin = authMiddleware.createSameOriginMiddleware({
  getAllowedOrigins: () => [],
  requireStrictOrigin: true
});
strictOrigin({
  method: 'POST',
  get: () => ''
}, {
  status(code) { statusCode = code; return this; },
  json(body) { payload = body; return this; }
}, () => { throw new Error('strict origin must fail closed when no origins are configured'); });
assert.strictEqual(statusCode, 503, 'strict origin with empty config must return 503');
assert.strictEqual(payload && payload.error, 'origin configuration missing', 'strict origin error mismatch');

const csp = buildContentSecurityPolicy();
assert.ok(csp.includes("script-src 'self'"), 'default CSP script-src self missing');
assert.ok(csp.includes("worker-src 'self'"), 'default CSP worker-src self missing');
assert.ok(!csp.includes('cloudflareinsights.com') && !csp.includes('static.cloudflareinsights.com'), 'Cloudflare insights must be opt-in by default');
assert.ok(!/worker-src[^;]*blob:/.test(csp), 'blob worker must be opt-in by default');
const relaxedCsp = buildContentSecurityPolicy({ allowCloudflareInsights:true, allowBlobWorker:true });
assert.ok(relaxedCsp.includes('https://static.cloudflareinsights.com'), 'Cloudflare insights opt-in missing');
assert.ok(/worker-src[^;]*blob:/.test(relaxedCsp), 'blob worker opt-in missing');

const diagnostics = read('server/services/admin-diagnostics-service.js');
assert.ok(diagnostics.includes('userPasswordMinLength'), 'admin diagnostics must expose user password minimum');
assert.ok(diagnostics.includes("originGrade = nodeEnv === 'production' && runtime.requireStrictOrigin ? 'error' : 'warn'"), 'admin diagnostics must grade missing production origin as error');

const envExample = read('.env.example');
assert.ok(envExample.includes('USER_PASSWORD_MIN_LENGTH=8'), '.env.example must document user password minimum');
assert.ok(envExample.includes('ALLOW_CLOUDFLARE_INSIGHTS=0'), '.env.example must document Cloudflare CSP flag');
assert.ok(envExample.includes('ALLOW_BLOB_WORKER=0'), '.env.example must document blob worker CSP flag');

console.log(JSON.stringify({ pass: PASS }));
