#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
const serviceSource = fs.readFileSync(path.join(projectRoot, 'server/services/disk-cache-janitor-service.js'), 'utf-8');
const appSource = fs.readFileSync(path.join(projectRoot, 'server/app.js'), 'utf-8');
const envSource = fs.readFileSync(path.join(projectRoot, 'server/config/env.js'), 'utf-8');
const diagnosticsSource = fs.readFileSync(path.join(projectRoot, 'server/services/admin-diagnostics-service.js'), 'utf-8');
const docsSource = fs.readFileSync(path.join(projectRoot, 'docs/performance-cache.md'), 'utf-8');

assert.ok(serviceSource.includes('v538-disk-cache-auto-prune-pass'), 'disk cache janitor marker missing');
assert.ok(serviceSource.includes('v538-disk-cache-protected-data-pass'), 'protected data marker missing');
assert.ok(serviceSource.includes('v565-disk-cache-healthy-scan-skip-pass'), 'healthy full-scan skip marker missing');
assert.ok(serviceSource.includes('healthyFullScanSkips'), 'healthy full-scan skip diagnostics missing');
assert.ok(serviceSource.includes('fs.statfsSync'), 'filesystem usage check must use statfsSync');
assert.ok(appSource.includes('chunk_indexes'), 'chunk index cache scope must be configured in app');
assert.ok(appSource.includes('createDiskCacheJanitorService'), 'app must create disk cache janitor service');
assert.ok(appSource.includes("{ label: 'chunk_indexes', dir: CHUNK_INDEX_DIR }"), 'chunk_indexes must be a pruning target');
assert.ok(appSource.includes("{ label: 'content_chunks', dir: CONTENT_CHUNK_PAYLOAD_DIR }"), 'content_chunks must be a pruning target');
assert.ok(appSource.includes("{ label: 'block_manifests', dir: BLOCK_MANIFEST_CACHE_DIR }"), 'block_manifests must be a pruning target');
assert.ok(!appSource.includes("userDataDir: paths.USER_DATA_DIR,\n  enabled: DISK_CACHE_AUTO_PRUNE_ENABLED"), 'user data must not be configured as a pruning target');
assert.ok(envSource.includes('DISK_CACHE_PRUNE_USAGE_PCT'), 'env usage pct setting missing');
assert.ok(envSource.includes('DISK_CACHE_PRUNE_MIN_FREE_MB'), 'env min free setting missing');
assert.ok(diagnosticsSource.includes('diskCacheJanitor'), 'admin diagnostics must expose disk cache janitor status');
assert.ok(diagnosticsSource.includes('v538-disk-cache-auto-prune-diagnostics-pass'), 'admin diagnostics marker missing');
assert.ok(docsSource.includes('v538 disk cache auto-prune'), 'performance-cache docs missing v538 section');

const { createDiskCacheJanitorService } = require(path.join(projectRoot, 'server/services/disk-cache-janitor-service'));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-cache-prune-'));
const dataDir = path.join(tempRoot, 'data');
const chunkIndexes = path.join(dataDir, 'chunk_indexes');
const contentChunks = path.join(dataDir, 'content_chunks');
const blockManifests = path.join(dataDir, 'block_manifests');
const userData = path.join(dataDir, 'user-data');
for (const dir of [chunkIndexes, contentChunks, blockManifests, userData]) fs.mkdirSync(dir, { recursive: true });
const stale = Date.now() - 120000;
for (const file of [path.join(chunkIndexes, 'a.json'), path.join(contentChunks, 'b.json'), path.join(blockManifests, 'c.json')]) {
  fs.writeFileSync(file, 'cache');
  fs.utimesSync(file, stale / 1000, stale / 1000);
}
const protectedFile = path.join(userData, 'state.json');
fs.writeFileSync(protectedFile, 'must-stay');
const service = createDiskCacheJanitorService({
  dataDir,
  cacheDirs: [
    { label: 'chunk_indexes', dir: chunkIndexes },
    { label: 'content_chunks', dir: contentChunks },
    { label: 'block_manifests', dir: blockManifests }
  ],
  enabled: true,
  usagePct: 1,
  targetUsagePct: 1,
  minFreeMb: Number.MAX_SAFE_INTEGER / (1024 * 1024),
  targetFreeMb: Number.MAX_SAFE_INTEGER / (1024 * 1024),
  minFileAgeMs: 0,
  maxDeletePerRun: 10,
  intervalMs: 60000,
  logger: { warn() {} }
});

const healthyService = createDiskCacheJanitorService({
  dataDir,
  cacheDirs: [
    { label: 'chunk_indexes', dir: chunkIndexes },
    { label: 'content_chunks', dir: contentChunks },
    { label: 'block_manifests', dir: blockManifests }
  ],
  enabled: true,
  usagePct: 99,
  targetUsagePct: 98,
  minFreeMb: 0,
  targetFreeMb: 0,
  intervalMs: 60000,
  logger: { warn() {} }
});
const healthyResult = healthyService.pruneOnce(false);
assert.strictEqual(healthyResult.metrics.summaryScans, 0, 'healthy periodic check must not recursively scan cache directories');
assert.ok(healthyResult.metrics.healthyFullScanSkips >= 1, 'healthy periodic check must record the skipped full scan');

const result = service.pruneOnce(true);
assert.ok(result && result.marker === 'v538-disk-cache-auto-prune-pass', 'prune result marker mismatch');
assert.strictEqual(fs.existsSync(path.join(chunkIndexes, 'a.json')), false, 'chunk index cache file should be pruned');
assert.strictEqual(fs.existsSync(path.join(contentChunks, 'b.json')), false, 'content chunk cache file should be pruned');
assert.strictEqual(fs.existsSync(path.join(blockManifests, 'c.json')), false, 'block manifest cache file should be pruned');
assert.strictEqual(fs.existsSync(protectedFile), true, 'user data file must not be pruned');
fs.rmSync(tempRoot, { recursive: true, force: true });

console.log(JSON.stringify({ ok: true, pass: 'v538-disk-cache-auto-prune-smoke-pass' }));
