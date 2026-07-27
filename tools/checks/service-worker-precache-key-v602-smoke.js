#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const source = fs.readFileSync('public/sw.js','utf8');
assert(source.includes("cache:'reload'"),'precache install must bypass stale HTTP cache');
assert(source.includes('cache.put(normalizedStaticCacheRequest(request), response.clone())'),'precache and runtime lookups must use the same normalized key');
assert(!source.includes('cache.addAll(PRECACHE_URLS)'),'query-bearing addAll keys must not bypass normalized runtime lookups');
console.log('v602-service-worker-precache-key-smoke-pass');
