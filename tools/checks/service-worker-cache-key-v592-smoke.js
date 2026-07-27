#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
const PASS = 'v592-service-worker-cache-key-smoke-pass';
for (const token of [
  "v592-service-worker-cache-key-normalization-pass",
  'STATIC_CACHE_MAX_ENTRIES = 512',
  'function normalizedStaticCacheRequest(request)',
  "url.search = ''",
  "url.hash = ''",
  'cache.match(cacheRequest)',
  'cache.put(cacheRequest, response.clone())',
  'trimStaticCache(cache)'
]) assert.ok(source.includes(token), `missing service-worker cache hardening token: ${token}`);
assert.ok(!source.includes('caches.match(request)'), 'static lookup must not search stale caches or preserve arbitrary query variants');
assert.ok(!source.includes('cache.put(request,'), 'raw query-bearing requests must not become cache keys');
assert.ok(source.includes("response.type === 'basic'") && source.includes('!response.redirected') && source.includes('sameResource'), 'redirected/auth responses must remain excluded');
console.log(JSON.stringify({ pass:PASS }));
