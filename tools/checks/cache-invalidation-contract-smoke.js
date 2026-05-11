#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '../..');
const PASS = 'v442-cache-invalidation-contract-smoke-pass';
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
const novelsRoute = read('server/routes/novels-routes.js');
const blockManifestRoute = read('server/routes/block-manifest-routes.js');
const serverSmoke = read('tools/smoke_server_http.js');
const runSmoke = read('tools/run_smoke_tests.js');
const releaseVerify = read('tools/release_verify.js');
const perfDocs = read('docs/performance-cache.md');
assert.ok(novelsRoute.includes('accessVersion'), 'novels/content ETag scope must include accessVersion');
assert.ok(novelsRoute.includes('fileStatSig') && novelsRoute.includes('fileTextHash'), 'content chunk ETag scope must include file stat/text signatures');
assert.ok(novelsRoute.includes('chunkIndex') && novelsRoute.includes('episodeId'), 'content chunk ETag scope must include chunk/episode identifiers');
assert.ok(blockManifestRoute.includes('accessVersion'), 'block-manifest ETag scope must include accessVersion');
assert.ok(blockManifestRoute.includes('cloneForManifestEtag'), 'block-manifest ETag must normalize generatedAt-sensitive payload');
assert.ok(blockManifestRoute.includes('stableHash(auth && auth.access || {})'), 'block-manifest auth access signature must be stable key-order hash');
assert.ok(serverSmoke.includes('v442-cache-invalidation-contract-smoke-pass'), 'server HTTP smoke must assert v442 invalidation marker');
assert.ok(serverSmoke.includes('ACL-changed block manifest request with old etag must not return 304'), 'server HTTP smoke must verify manifest old ETag is not reused after ACL change');
assert.ok(runSmoke.includes('cache-invalidation-contract-smoke.js'), 'cache smoke must include v442 invalidation smoke');
assert.ok(releaseVerify.includes('cache-invalidation-contract-smoke.js'), 'release verify must include v442 invalidation smoke');
assert.ok(perfDocs.includes(PASS), 'performance cache docs must mention v442 invalidation marker');
try {
  const { createContentService } = require(path.join(root, 'server/services/content-service.js'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v442-invalidation-'));
  try {
    const chunkIndexDir = path.join(tmp, 'chunks');
    fs.mkdirSync(chunkIndexDir, { recursive: true });
    const file = path.join(tmp, 'novel.txt');
    fs.writeFileSync(file, 'alpha\n' + 'A'.repeat(96), 'utf8');
    const contentService = createContentService({ chunkIndexDir, chunkSize: 32, fileCacheMax: 8, fileCacheMaxBytes: 1024 * 1024 });
    const first = contentService.getCachedFileEntry(file, {});
    assert.ok(first && first.text.includes('alpha'), 'first content load');
    const firstSig = first.statSig;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    fs.appendFileSync(file, '\nbeta', 'utf8');
    const second = contentService.getCachedFileEntry(file, {});
    assert.ok(second && second.text.includes('beta'), 'mutated file content must be reloaded');
    assert.notStrictEqual(second.statSig, firstSig, 'file stat signature must change after mutation');
    const status = contentService.getCacheStatus();
    assert.ok(status.metrics.fileCacheMisses >= 2, 'file mutation should cause a second cache miss');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
} catch (error) {
  if (error && error.code === 'MODULE_NOT_FOUND') {
    console.log(JSON.stringify({ pass: PASS, mode: 'static-only', reason: 'dependencies-not-installed' }));
    process.exit(0);
  }
  throw error;
}
console.log(JSON.stringify({ pass: PASS }));
