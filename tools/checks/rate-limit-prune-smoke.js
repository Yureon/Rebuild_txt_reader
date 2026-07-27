#!/usr/bin/env node
const assert = require('assert');
const {
  createLoginLimiter,
  createApiWriteLimiter,
  pruneExpiredEntries,
  trimMapByResetAt
} = require('../../server/services/rate-limit');

const PASS = 'v341-rate-limit-prune-smoke-pass';

(function testStandalonePruneHelpers() {
  const map = new Map([
    ['expired-a', { count: 1, resetAt: 10 }],
    ['live-a', { count: 1, resetAt: 1000 }],
    ['expired-b', { count: 1, resetAt: 20 }]
  ]);
  assert.strictEqual(pruneExpiredEntries(map, 100), 2, 'expired entries should be pruned');
  assert.deepStrictEqual(Array.from(map.keys()), ['live-a'], 'live entries should remain');

  map.set('older', { count: 1, resetAt: 200 });
  map.set('newer', { count: 1, resetAt: 300 });
  assert.strictEqual(trimMapByResetAt(map, 2), 1, 'overflow trim should remove oldest resetAt entry');
  assert.strictEqual(map.has('older'), false, 'oldest entry should be trimmed first');
})();

(function testLoginLimiterPrunesExpiredAndCaps() {
  const limiter = createLoginLimiter({ max: 2, windowMs: 1000, maxEntries: 3, pruneIntervalMs: 1000 });
  limiter.attempts.set('old-1', { count: 1, resetAt: 1 });
  limiter.attempts.set('old-2', { count: 1, resetAt: 2 });
  limiter.attempts.set('live-1', { count: 1, resetAt: Date.now() + 10000 });
  assert.ok(limiter.prune(Date.now()) >= 2, 'login limiter should expose explicit prune');
  assert.strictEqual(limiter.attempts.has('old-1'), false, 'expired login attempt should be gone');
  assert.strictEqual(limiter.attempts.has('live-1'), true, 'live login attempt should remain');

  limiter.check('ip-a');
  limiter.check('ip-b');
  limiter.check('ip-c');
  limiter.check('ip-d');
  assert.ok(limiter.attempts.size <= 3, 'login limiter should enforce maxEntries cap');
})();

(function testApiWriteLimiterPrunesExpiredAndCaps() {
  const limiter = createApiWriteLimiter({ maxEntries: 2, pruneIntervalMs: 1000 });
  limiter.buckets.set('old-api', { count: 1, resetAt: 1 });
  limiter.buckets.set('live-api', { count: 1, resetAt: Date.now() + 10000 });
  assert.ok(limiter.prune(Date.now()) >= 1, 'api limiter should expose explicit prune');
  assert.strictEqual(limiter.buckets.has('old-api'), false, 'expired api bucket should be gone');

  const makeReq = (ip, token) => ({
    headers: {
      'x-forwarded-for': ip,
      cookie: `session_token=${token}`
    },
    socket: { remoteAddress: ip }
  });
  limiter.check(makeReq('10.0.0.1', 'a'.repeat(32)), 'state', 10, 60000);
  limiter.check(makeReq('10.0.0.2', 'b'.repeat(32)), 'state', 10, 60000);
  limiter.check(makeReq('10.0.0.3', 'c'.repeat(32)), 'state', 10, 60000);
  assert.ok(limiter.buckets.size <= 2, 'api limiter should enforce maxEntries cap');
})();

console.log(JSON.stringify({ pass: PASS }));
