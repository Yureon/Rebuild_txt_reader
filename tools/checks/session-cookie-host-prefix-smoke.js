#!/usr/bin/env node
const assert = require('assert');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const auth = require(path.join(ROOT, 'server/middleware/auth.js'));
const authRoutes = require(path.join(ROOT, 'server/routes/auth-routes.js'));
const { createApiWriteLimiter } = require(path.join(ROOT, 'server/services/rate-limit.js'));

const PASS = 'v346-session-cookie-host-prefix-smoke-pass';

function withNodeEnv(value, fn) {
  const previous = process.env.NODE_ENV;
  if (value == null) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = value;
  try {
    return fn();
  } finally {
    if (previous == null) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
}

function createReq(cookie) {
  return {
    headers: { cookie: String(cookie || '') },
    socket: { remoteAddress: '127.0.0.1' }
  };
}

function assertCookieAttribute(cookie, attr, message) {
  assert.ok(String(cookie).split(';').map(part => part.trim()).includes(attr), message || `missing ${attr}`);
}

function runSessionCookieHostPrefixSmoke() {
  const productionCookie = withNodeEnv('production', () => authRoutes.createSessionCookie('prod-token', 604800));
  assert.ok(productionCookie.startsWith(`${auth.HOST_SESSION_COOKIE_NAME}=prod-token;`), 'production login must use __Host-session_token');
  assertCookieAttribute(productionCookie, 'Path=/', '__Host cookie must be scoped to Path=/');
  assertCookieAttribute(productionCookie, 'HttpOnly', '__Host cookie must be HttpOnly');
  assertCookieAttribute(productionCookie, 'SameSite=Strict', '__Host cookie must keep SameSite=Strict');
  assertCookieAttribute(productionCookie, 'Secure', '__Host cookie must be Secure');
  assert.ok(!/Domain=/i.test(productionCookie), '__Host cookie must not set Domain');

  const developmentCookie = withNodeEnv('development', () => authRoutes.createSessionCookie('dev-token', 604800));
  assert.ok(developmentCookie.startsWith(`${auth.LEGACY_SESSION_COOKIE_NAME}=dev-token;`), 'development login must keep legacy session_token');
  assert.ok(!String(developmentCookie).includes('; Secure'), 'development legacy cookie must remain HTTP-local compatible');

  const clearCookies = withNodeEnv('production', () => authRoutes.createSessionClearCookies());
  assert.ok(Array.isArray(clearCookies) && clearCookies.length === 2, 'logout must clear host-prefixed and legacy cookies');
  assert.ok(clearCookies.some(cookie => String(cookie).startsWith(`${auth.HOST_SESSION_COOKIE_NAME}=;`) && String(cookie).includes('Max-Age=0') && String(cookie).includes('; Secure')), 'logout must clear __Host-session_token securely');
  assert.ok(clearCookies.some(cookie => String(cookie).startsWith(`${auth.LEGACY_SESSION_COOKIE_NAME}=;`) && String(cookie).includes('Max-Age=0')), 'logout must clear legacy session_token');

  assert.strictEqual(
    auth.getSessionTokenFromReq(createReq(`${auth.LEGACY_SESSION_COOKIE_NAME}=legacy; ${auth.HOST_SESSION_COOKIE_NAME}=host`)),
    'host',
    'auth parser must prefer __Host-session_token over legacy session_token'
  );
  assert.strictEqual(
    auth.getSessionTokenFromReq(createReq(`${auth.LEGACY_SESSION_COOKIE_NAME}=legacy`)),
    'legacy',
    'auth parser must still accept legacy session_token'
  );

  const limiter = createApiWriteLimiter({ maxEntries: 10, pruneIntervalMs: 1000 });
  assert.strictEqual(limiter.check(createReq(`${auth.HOST_SESSION_COOKIE_NAME}=host-rate-token`), 'scope', 10, 60000), true, 'API write limiter must accept host-prefixed session cookie');
  assert.ok(Array.from(limiter.buckets.keys()).some(key => key.includes('host-rate-token')), 'API write limiter key must include host-prefixed session token fragment');
  assert.strictEqual(limiter.check(createReq(`${auth.LEGACY_SESSION_COOKIE_NAME}=legacy-rate-token`), 'scope', 10, 60000), true, 'API write limiter must keep legacy session cookie compatibility');
  assert.ok(Array.from(limiter.buckets.keys()).some(key => key.includes('legacy-rate-token')), 'API write limiter key must include legacy session token fragment');

  return { pass: PASS };
}

if (require.main === module) {
  console.log(JSON.stringify(runSessionCookieHostPrefixSmoke()));
}

module.exports = {
  PASS,
  runSessionCookieHostPrefixSmoke
};
