const assert = require('assert');
const { createSameOriginMiddleware } = require('../../server/middleware/auth');
const { normalizeOrigin } = require('../../server/config/origins');

const PASS = 'v343-strict-origin-fetch-metadata-smoke-pass';

function runCase({ method = 'POST', headers = {}, requireStrictOrigin = true, allowed = ['https://reader.example.com'] } = {}) {
  const req = {
    method,
    path: '/api/login',
    get(name) { return headers[String(name).toLowerCase()] || ''; }
  };
  let statusCode = 0;
  let nextCalled = false;
  const res = {
    status(code) { statusCode = code; return this; },
    json(payload) { return this; }
  };
  const mw = createSameOriginMiddleware({
    requireStrictOrigin,
    getAllowedOrigins: () => allowed.map(normalizeOrigin)
  });
  mw(req, res, () => { nextCalled = true; });
  return { statusCode, nextCalled };
}

assert.ok(runCase({ headers: { origin: 'https://reader.example.com' } }).nextCalled, 'allowed origin should pass');
assert.strictEqual(runCase({ headers: { origin: 'https://evil.example' } }).statusCode, 403, 'wrong origin should be blocked');
assert.ok(runCase({ headers: { referer: 'https://reader.example.com/login.html' } }).nextCalled, 'allowed referer should pass');
assert.strictEqual(runCase({ headers: { referer: 'https://evil.example/login.html' } }).statusCode, 403, 'wrong referer should be blocked');
assert.strictEqual(runCase({ headers: { 'sec-fetch-site': 'cross-site' } }).statusCode, 403, 'cross-site unsafe fetch metadata should be blocked');
assert.ok(runCase({ headers: { 'sec-fetch-site': 'same-origin' } }).nextCalled, 'same-origin fetch metadata should pass when origin is omitted');
assert.ok(runCase({ headers: { 'sec-fetch-site': 'same-site' } }).nextCalled, 'same-site fetch metadata should pass when origin is omitted');
assert.strictEqual(runCase({ headers: {} }).statusCode, 403, 'strict mode should block unsafe requests without origin/referer/fetch metadata');
assert.ok(runCase({ method: 'GET', headers: {} }).nextCalled, 'safe methods should pass without origin headers');
assert.ok(runCase({ headers: {}, requireStrictOrigin: false }).nextCalled, 'compat mode should pass missing origin headers');

console.log(JSON.stringify({ pass: PASS }));
