#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const env = fs.readFileSync(path.join(root, 'server/config/env.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'server/app.js'), 'utf8');
const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
const performanceDocs = fs.readFileSync(path.join(root, 'docs/performance-cache.md'), 'utf8');
const releaseHistory = fs.readFileSync(path.join(root, 'docs/release-history.md'), 'utf8');
const runner = fs.readFileSync(path.join(root, 'tools/run_smoke_tests.js'), 'utf8');
const PASS = 'v539-search-content-cache-limit-smoke-pass';

assert.ok(env.includes('CONTENT_FILE_CACHE_MAX_BYTES'), 'env must define CONTENT_FILE_CACHE_MAX_BYTES');
assert.ok(env.includes('CONTENT_FILE_CACHE_MAX_ENTRIES'), 'env must define CONTENT_FILE_CACHE_MAX_ENTRIES');
assert.ok(env.includes('Math.max(128 * 1024 * 1024, MAX_TEXT_FILE_BYTES + (32 * 1024 * 1024))'), 'default content file cache bytes must be at least max text size plus headroom');
assert.ok(app.includes('fileCacheMaxBytes: CONTENT_FILE_CACHE_MAX_BYTES'), 'app must pass fileCacheMaxBytes to createContentService');
assert.ok(app.includes('fileCacheMax: CONTENT_FILE_CACHE_MAX_ENTRIES'), 'app must pass fileCacheMax to createContentService');
assert.ok(envExample.includes('CONTENT_FILE_CACHE_MAX_BYTES=134217728'), '.env.example must document cache byte limit');
assert.ok(envExample.includes('CONTENT_FILE_CACHE_MAX_ENTRIES=16'), '.env.example must document cache entry limit');
assert.ok(performanceDocs.includes('v539 full-search CPU load mitigation'), 'performance docs must describe v539 cache/concurrency mitigation');
assert.ok(releaseHistory.includes('# v539 - full-search CPU load mitigation'), 'release history must include v539 entry');
assert.ok(runner.includes("nodeCmd('tools/checks/search-content-cache-limit-smoke.js')"), 'runner must include content cache limit smoke');
console.log(JSON.stringify({ pass: PASS }));
