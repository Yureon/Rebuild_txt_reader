#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '../..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

const contentService = read('server/services/content-service.js');
const adminDiagnostics = read('server/services/admin-diagnostics-service.js');
const app = read('server/app.js');
const runSmoke = read('tools/run_smoke_tests.js');
const releaseVerify = read('tools/release_verify.js');

assert.ok(contentService.includes("v436-content-cache-io-diagnostics-pass"), 'content cache diagnostics marker exists');
assert.ok(contentService.includes('const metrics = {'), 'metrics object exists');
[
  'statSignatureCalls',
  'fileReadCalls',
  'fileCacheHits',
  'fileCacheMisses',
  'fileCacheInflightJoins',
  'fileCacheInflightLoads',
  'chunkIndexDiskHits',
  'chunkIndexDiskMisses',
  'chunkIndexWriteQueued',
  'chunkIndexWriteFlushed',
  'lastFileReadMs'
].forEach((key) => {
  assert.ok(contentService.includes(key), `content metrics includes ${key}`);
});
assert.ok(contentService.includes('fileCacheInflightEntries'), 'inflight entry count exposed');
assert.ok(contentService.includes('fileCacheLimits'), 'cache limits exposed');
assert.ok(contentService.includes('Object.assign({}, metrics)'), 'diagnostics returns copied metrics');
assert.ok(!/password|session_token|invite code|inviteCode|signupCodes/i.test(contentService), 'content diagnostics does not expose sensitive fields');

assert.ok(adminDiagnostics.includes("v436-io-diagnostics-cache-status-pass"), 'admin diagnostics marker exists');
assert.ok(adminDiagnostics.includes('ioDiagnostics'), 'admin diagnostics exposes ioDiagnostics object');
assert.ok(adminDiagnostics.includes('safeCacheStatus(libraryService)'), 'library cache status connected');
assert.ok(adminDiagnostics.includes('safeCacheStatus(contentService)'), 'content cache status connected');
assert.ok(adminDiagnostics.includes('safeCacheStatus(blockManifestService)'), 'block-manifest cache status connected');
assert.ok(app.includes('contentService') && app.includes('blockManifestService'), 'app passes cache services into diagnostics');

const protectedFile = ['public', 'scripts', 'rebuild', 'features', 'reader', 'virtual-layout.mjs'].join('/');
assert.ok(fs.existsSync(path.join(root, protectedFile)), 'reader virtual layout file exists independently of diagnostics smoke');
assert.ok(!contentService.includes(protectedFile), 'content diagnostics does not require reader virtual layout');

assert.ok(runSmoke.includes('content-cache-io-diagnostics-smoke.js'), 'cache smoke includes content diagnostics smoke');
assert.ok(releaseVerify.includes('content-cache-io-diagnostics-smoke.js'), 'release verify includes content diagnostics smoke');

const metricLiteral = contentService.match(/const metrics = \{([\s\S]*?)\n  \};/);
assert.ok(metricLiteral, 'metric literal found');
metricLiteral[1].split('\n').filter(line => line.includes(':')).forEach((line) => {
  const key = line.split(':')[0].trim();
  if (/Reason$/.test(key)) return;
  const value = line.split(':').slice(1).join(':').replace(/[,\s]/g, '');
  assert.ok(value === '0', `metric counter starts as number zero: ${line.trim()}`);
});

console.log(JSON.stringify({ pass: 'v436-content-cache-io-diagnostics-smoke-pass' }));
