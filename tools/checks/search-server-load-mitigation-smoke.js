#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const search = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/search.mjs'), 'utf8');
const matcher = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/search/matcher.mjs'), 'utf8');
const profile = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/search/search-performance-profile.mjs'), 'utf8');
const content = fs.readFileSync(path.join(root, 'server/services/content-service.js'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'server/routes/novels-routes.js'), 'utf8');
const runner = fs.readFileSync(path.join(root, 'tools/run_smoke_tests.js'), 'utf8');
const env = fs.readFileSync(path.join(root, 'server/config/env.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'server/app.js'), 'utf8');
const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');

const PASS = 'v539-search-server-load-mitigation-smoke-pass';
const SEARCH_PASS = 'v549-search-auto-server-profile-pass';
const SEARCH_SCAN_PASS = 'v537-search-scan-content-load-mitigation-pass';

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

async function runContentServiceSearchScanSmoke() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-search-scan-'));
  const chunkIndexDir = path.join(tmp, 'chunk-index');
  const chunkPayloadDir = path.join(tmp, 'chunk-payload');
  const filePath = path.join(tmp, 'novel.txt');
  fs.mkdirSync(chunkIndexDir, { recursive: true });
  fs.mkdirSync(chunkPayloadDir, { recursive: true });
  fs.writeFileSync(filePath, Array.from({ length: 80 }, (_, i) => `line-${i} needle`).join('\n'), 'utf8');
  const { createContentService, CONTENT_SEARCH_SCAN_LOAD_MITIGATION_PASS } = require('../../server/services/content-service.js');
  const service = createContentService({ chunkIndexDir, chunkPayloadDir, chunkSize: 120, chunkBoundaryLookahead: 240 });
  const scanPayload = await service.getContentChunkAsync(filePath, {}, 2, { searchScan: true });
  assert.strictEqual(CONTENT_SEARCH_SCAN_LOAD_MITIGATION_PASS, SEARCH_SCAN_PASS, 'content-service must export v537 search scan marker');
  assert.strictEqual(scanPayload.searchScanLoadMitigationPass, SEARCH_SCAN_PASS, 'search scan chunk payload must expose mitigation marker');
  assert.strictEqual(listFiles(chunkPayloadDir).length, 0, 'search scan cold chunk requests must not write chunk payload disk files');
  const statusAfterScan = service.getCacheStatus();
  assert.strictEqual(statusAfterScan.searchScanLoadMitigationPass, SEARCH_SCAN_PASS, 'diagnostics must expose search scan mitigation marker');
  assert.strictEqual(statusAfterScan.searchScanLastMarker, SEARCH_SCAN_PASS, 'diagnostics must expose last search scan marker outside numeric metrics');
  assert.strictEqual(statusAfterScan.metrics.searchScanRequests, 1, 'diagnostics must count search scan requests');
  assert.strictEqual(statusAfterScan.metrics.searchScanPayloadWriteSkipped, 1, 'diagnostics must count skipped search scan payload writes');
  await service.getContentChunkAsync(filePath, {}, 2, { searchScan: false });
  assert.ok(listFiles(chunkPayloadDir).length > 0, 'normal reader chunk requests must still write chunk payload disk cache');
  fs.rmSync(tmp, { recursive: true, force: true });
}

(async () => {
  assert.ok(search.includes("SEARCH_BLOCK_MANIFEST_LAZY_PASS = 'v537-search-block-manifest-lazy-pass'"), 'search module must expose lazy block manifest marker');
  assert.ok(!search.includes('ensureBlockManifest'), 'search module must not force block manifest build before full search');
  assert.ok(search.includes("searchBlockManifestPolicy = 'lazy-on-reader-jump'"), 'search stats must record lazy manifest policy');
  assert.ok(matcher.includes(`SEARCH_SERVER_LOAD_MITIGATION_PASS`), 'matcher must import server load mitigation marker');
  assert.ok(matcher.includes("SEARCH_SCAN_REQUEST_HEADER = 'X-Search-Scan'"), 'matcher must mark search scan content requests');
  assert.ok(matcher.includes('SEARCH_FULL_SCAN_CONCURRENCY_MAX = 3'), 'full scan concurrency cap must retain default cap 3 before server auto overrides');
  assert.ok(matcher.includes('SEARCH_LIVE_FULL_SCAN_CONCURRENCY_MAX = 3'), 'live search concurrency cap must retain default cap 3 before server auto overrides');
  assert.ok(matcher.includes('SEARCH_MULTI_EPISODE_TARGET_CONCURRENCY_MAX = 2'), 'multi episode concurrency cap must retain default cap 2 before server auto overrides');
  assert.ok(matcher.includes('[SEARCH_SCAN_REQUEST_HEADER]: \'1\''), 'network full scan requests must send X-Search-Scan');
  assert.ok(profile.includes(`SEARCH_SERVER_LOAD_MITIGATION_PASS = '${SEARCH_PASS}'`), 'adaptive profile must expose v549 auto server search profile pass');
  assert.ok(profile.includes('full: { min: 1, max: 3, step: 1 }'), 'adaptive full scan limit must use v548 relaxed bounded profile');
  assert.ok(profile.includes('multi: { min: 1, max: 2, step: 1 }'), 'multi episode limit must use v548 relaxed bounded profile');
  assert.ok(profile.includes('workerBatch: { min: 2, max: 5, step: 1 }'), 'worker batch limit must remain client-local and auto-configurable in v549');
  assert.ok(content.includes(`CONTENT_SEARCH_SCAN_LOAD_MITIGATION_PASS = '${SEARCH_SCAN_PASS}'`), 'content service must expose search scan mitigation pass');
  assert.ok(env.includes('CONTENT_FILE_CACHE_MAX_BYTES'), 'env config must expose content file cache max bytes');
  assert.ok(env.includes('MAX_TEXT_FILE_BYTES + (32 * 1024 * 1024)'), 'content file cache default must exceed max text file bytes');
  assert.ok(app.includes('fileCacheMaxBytes: CONTENT_FILE_CACHE_MAX_BYTES'), 'app must pass content file cache byte limit to content service');
  assert.ok(app.includes('fileCacheMax: CONTENT_FILE_CACHE_MAX_ENTRIES'), 'app must pass content file cache entry limit to content service');
  assert.ok(envExample.includes('CONTENT_FILE_CACHE_MAX_BYTES=134217728'), '.env.example must document content file cache byte limit');
  assert.ok(content.includes('searchScanPayloadWriteSkipped'), 'content service diagnostics must count skipped search scan writes');
  assert.ok(content.includes('search scan request skipped sync chunk payload disk write'), 'content service must skip sync chunk payload writes for search scan cold misses');
  assert.ok(routes.includes('function isSearchScanRequest(req)'), 'novels routes must detect search scan requests');
  assert.ok(routes.includes("req.get('X-Search-Scan')"), 'novels routes must accept X-Search-Scan header');
  assert.ok(routes.includes(`X-Content-Search-Scan', '${SEARCH_SCAN_PASS}'`), 'novels routes must expose search scan response marker');
  assert.ok(runner.includes("nodeCmd('tools/checks/search-server-load-mitigation-smoke.js')"), 'smoke runner must include v537 search server mitigation smoke');
  await runContentServiceSearchScanSmoke();
  console.log(PASS);
})().catch(error => {
  console.error(error && (error.stack || error.message || String(error)));
  process.exit(1);
});
