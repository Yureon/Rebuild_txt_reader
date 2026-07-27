#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '../..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

const serverSmoke = read('tools/smoke_server_http.js');
const runSmoke = read('tools/run_smoke_tests.js');
const releaseVerify = read('tools/release_verify.js');
const smokeDocs = read('docs/smoke-tests.md');
const perfDocs = read('docs/performance-cache.md');

assert.ok(serverSmoke.includes('v438-reader-api-cold-warm-cache-smoke-pass'), 'server HTTP smoke marker missing');
assert.ok(serverSmoke.includes('timedJsonFetch'), 'timed reader API request helper missing');
assert.ok(serverSmoke.includes('compareColdWarmTiming'), 'cold/warm timing comparator missing');
assert.ok(serverSmoke.includes('process.hrtime.bigint()'), 'timing must use monotonic high-resolution clock');
assert.ok(serverSmoke.includes('content cold request') && serverSmoke.includes('content warm request'), 'content cold/warm requests missing');
assert.ok(serverSmoke.includes('block manifest cold request') && serverSmoke.includes('block manifest warm request'), 'block-manifest cold/warm requests missing');
assert.ok(serverSmoke.includes('warm request is unexpectedly slow'), 'warm regression guard missing');
assert.ok(serverSmoke.includes('readerApiColdWarmCache'), 'server smoke output must expose cold/warm metrics');
assert.ok(!serverSmoke.includes('reader/virtual-layout.mjs'), 'cold/warm smoke must not depend on reader virtual layout');
assert.ok(!serverSmoke.includes('reader/chunk-window.mjs'), 'cold/warm smoke must not depend on chunk window internals');

assert.ok(runSmoke.includes('reader-api-cold-warm-cache-smoke.js'), 'cache smoke must include cold/warm static smoke');
assert.ok(releaseVerify.includes('reader-api-cold-warm-cache-smoke.js'), 'release verify must include cold/warm static smoke');
assert.ok(smokeDocs.includes('reader-api-cold-warm-cache-smoke.js'), 'smoke docs must mention cold/warm smoke');
assert.ok(perfDocs.includes('v438 reader API cold/warm smoke'), 'performance docs must mention v438 cold/warm smoke');

console.log(JSON.stringify({ pass: 'v438-reader-api-cold-warm-cache-static-smoke-pass' }));
