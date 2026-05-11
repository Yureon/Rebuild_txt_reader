#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..', '..');
const PASS = 'v450-precompressed-static-metadata-cache-smoke-pass';
const MARKER = 'v450-precompressed-static-metadata-cache-pass';

const middlewarePath = path.join(root, 'server/middleware/precompressed-static.js');
const source = fs.readFileSync(middlewarePath, 'utf8');
assert.ok(source.includes("PRECOMPRESSED_STATIC_METADATA_CACHE_PASS = '" + MARKER + "'"), 'metadata cache marker missing');
assert.ok(source.includes('createStaticMetadataCache'), 'metadata cache factory missing');
assert.ok(source.includes('getFileStatCached'), 'cached stat helper missing');
assert.ok(source.includes('X-Precompressed-Static-Metadata-Cache'), 'metadata cache response header missing');
assert.ok(!source.includes('fs.existsSync(filePath)'), 'request hot path should not call existsSync(filePath)');

const mod = require(middlewarePath);
assert.strictEqual(mod.PRECOMPRESSED_STATIC_METADATA_CACHE_PASS, MARKER, 'exported marker mismatch');
assert.strictEqual(typeof mod.createStaticMetadataCache, 'function', 'cache factory export missing');
assert.strictEqual(typeof mod.getFileStatCached, 'function', 'cached stat export missing');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'precompressed-cache-'));
try {
  const file = path.join(dir, 'main.mjs');
  fs.writeFileSync(file, 'export const ok = true;\n');
  fs.writeFileSync(file + '.br', 'br-sidecar');
  fs.writeFileSync(file + '.gz', 'gz-sidecar');
  const cache = mod.createStaticMetadataCache({ ttlMs: 60000, maxEntries: 8 });
  const first = mod.chooseEncoding('br, gzip', file, cache);
  assert.ok(first && first.encodedPath.endsWith('.br') && first.stat, 'first br choice failed');
  const statCallsAfterFirst = cache.status().metrics.statCalls;
  const second = mod.chooseEncoding('br, gzip', file, cache);
  assert.ok(second && second.encodedPath.endsWith('.br') && second.stat, 'second br choice failed');
  const status = cache.status();
  assert.strictEqual(status.pass, MARKER, 'cache status marker mismatch');
  assert.strictEqual(status.metrics.statCalls, statCallsAfterFirst, 'second chooseEncoding should reuse cached stat');
  assert.ok(status.metrics.hits >= 1, 'metadata cache hit not recorded');
  mod.getFileStatCached(file, cache);
  const callsAfterOriginal = cache.status().metrics.statCalls;
  mod.getFileStatCached(file, cache);
  assert.strictEqual(cache.status().metrics.statCalls, callsAfterOriginal, 'original file stat should be cached');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(JSON.stringify({ pass: PASS, marker: MARKER }));
