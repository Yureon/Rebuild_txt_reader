#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '../..');
const PASS = 'v441-modulepreload-cache-policy-boundary-pass';
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
const policy = read('server/middleware/cache-policy.js');
const precompressed = read('server/middleware/precompressed-static.js');
const serverSmoke = read('tools/smoke_server_http.js');
const docs = read('docs/performance-cache.md') + '\n' + read('docs/smoke-tests.md');
const site = read('public/site.html');
const mobile = read('public/mobile.html');
const requiredPreloads = [
  '/scripts/rebuild/core/app-shell.mjs',
  '/scripts/rebuild/main.mjs',
  '/scripts/rebuild/core/api.mjs',
  '/scripts/rebuild/core/utils.mjs',
  '/scripts/rebuild/state/app-state.mjs',
  '/scripts/rebuild/features/ui.mjs',
  '/scripts/rebuild/features/library.mjs',
  '/scripts/rebuild/features/reader.mjs',
  '/scripts/rebuild/features/search.mjs',
  '/scripts/rebuild/features/theme-settings.mjs'
];
for (const html of [site, mobile]) {
  for (const href of requiredPreloads) {
    assert.ok(html.includes(`<link rel="modulepreload" href="${href}">`), `missing queryless modulepreload ${href}`);
    assert.ok(!html.includes(`${href}?v=`), `modulepreload must remain queryless for import URL matching: ${href}`);
  }
}
assert.ok(policy.includes('function isVersionedRebuildAssetRequest'), 'versioned rebuild detector missing');
assert.ok(policy.includes("pathname.startsWith('/scripts/rebuild/')"), 'versioned cache must be scoped to rebuild scripts');
assert.ok(policy.includes('/^rebuild-v\\d+$/.test(version)'), 'versioned cache must require rebuild-v query');
assert.ok(policy.includes("public, max-age=31536000, immutable"), 'versioned rebuild asset must be immutable');
assert.ok(policy.includes("public, max-age=0, must-revalidate"), 'queryless rebuild modules must be revalidated');
assert.ok(precompressed.includes('applyStaticCachePolicy(res, filePath)'), 'precompressed sidecar responses must use the same cache policy');
assert.ok(precompressed.includes('setVaryAcceptEncoding(res)'), 'precompressed sidecar responses must preserve Vary: Accept-Encoding');
assert.ok(serverSmoke.includes('v441-modulepreload-cache-policy-boundary-pass'), 'server HTTP smoke must assert v441 cache boundary marker');
assert.ok(serverSmoke.includes("/scripts/rebuild/main.mjs?v=rebuild-v564"), 'server HTTP smoke must check versioned main module');
assert.ok(serverSmoke.includes("/scripts/rebuild/main.mjs"), 'server HTTP smoke must check queryless main module');
assert.ok(docs.includes(PASS), 'cache docs must mention v441 boundary marker');
console.log(JSON.stringify({ pass: PASS, preloads: requiredPreloads.length }));
