#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '../..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

const contentSource = read('server/services/content-service.js');
const librarySource = read('server/services/library-service.js');
const blockManifestSource = read('server/services/block-manifest-service.js');
const runSmoke = read('tools/run_smoke_tests.js');
const releaseVerify = read('tools/release_verify.js');
const smokeDocs = read('docs/smoke-tests.md');
const perfDocs = read('docs/performance-cache.md');

assert.ok(contentSource.includes('v439-cache-strategy-adjustment-pass'), 'content strategy marker missing');
assert.ok(contentSource.includes('buildCachedFileEntryFromSignature'), 'known-signature content load helper missing');
assert.ok(contentSource.includes('fileCacheKnownSignatureLoads'), 'known-signature load counter missing');
assert.ok(!/return\s+getCachedFileEntry\(filePath, options\)/.test(contentSource), 'async miss path must not recurse into sync cache loader');
assert.ok(librarySource.includes('v439-library-cache-strategy-pass'), 'library strategy marker missing');
assert.ok(librarySource.includes('now - (libraryCache.lastDeepSignatureCheckAt || 0) < LIBRARY_DEEP_SIGNATURE_CHECK_TTL'), 'library hot path must reuse deep-signature TTL before root stat');
assert.ok(blockManifestSource.includes('v439-block-manifest-cache-strategy-pass'), 'block-manifest strategy marker missing');
assert.ok(blockManifestSource.includes('manifestCacheHits') && blockManifestSource.includes('manifestCacheEvictions'), 'block-manifest cache strategy metrics missing');
assert.ok(runSmoke.includes('cache-strategy-adjustment-smoke.js'), 'cache smoke must include v439 strategy smoke');
assert.ok(releaseVerify.includes('cache-strategy-adjustment-smoke.js'), 'release verify must include v439 strategy smoke');
assert.ok(smokeDocs.includes('cache-strategy-adjustment-smoke.js'), 'smoke docs must mention v439 strategy smoke');
assert.ok(perfDocs.includes('v439 measured cache strategy adjustment'), 'performance docs must mention v439 strategy adjustment');
assert.ok(!contentSource.includes('reader/virtual-layout.mjs'), 'content cache strategy must not depend on reader virtual layout');
assert.ok(!librarySource.includes('reader/virtual-layout.mjs'), 'library cache strategy must not depend on reader virtual layout');
assert.ok(!blockManifestSource.includes('reader/virtual-layout.mjs'), 'block-manifest cache strategy must not depend on reader virtual layout');


let createContentService;
let createLibraryService;
let createBlockManifestService;
try {
  ({ createContentService } = require(path.join(root, 'server/services/content-service.js')));
  ({ createLibraryService } = require(path.join(root, 'server/services/library-service.js')));
  ({ createBlockManifestService } = require(path.join(root, 'server/services/block-manifest-service.js')));
} catch (error) {
  if (error && error.code === 'MODULE_NOT_FOUND') {
    console.log(JSON.stringify({ pass: 'v439-cache-strategy-adjustment-smoke-pass', mode: 'static-only', reason: 'dependencies-not-installed' }));
    process.exit(0);
  }
  throw error;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v439-cache-'));
function returnPromise(value) { return value && typeof value.then === 'function' ? value : Promise.resolve(value); }
try {
  const chunkIndexDir = path.join(tmp, 'chunks');
  fs.mkdirSync(chunkIndexDir, { recursive: true });
  const contentFile = path.join(tmp, 'sample.txt');
  fs.writeFileSync(contentFile, '첫 문장입니다.\n\n' + 'A'.repeat(128) + '\n', 'utf8');
  const contentService = createContentService({ chunkIndexDir, chunkSize: 64, fileCacheMax: 8, fileCacheMaxBytes: 1024 * 1024 });

  returnPromise(contentService.getCachedFileEntryAsync(contentFile, {})).then(async (entry) => {
    assert.ok(entry && typeof entry.text === 'string', 'content async loader returns entry');
    let status = contentService.getCacheStatus();
    assert.strictEqual(status.strategyMarker, 'v439-cache-strategy-adjustment-pass', 'content strategy marker exposed');
    assert.strictEqual(status.metrics.fileCacheMisses, 1, 'first async content load records one cache miss');
    assert.strictEqual(status.metrics.fileCacheKnownSignatureLoads, 1, 'first async content load uses known-signature loader once');
    assert.strictEqual(status.metrics.fileReadCalls, 1, 'first async content load reads file once');
    assert.strictEqual(status.metrics.statSignatureCalls, 1, 'first async content load avoids duplicate stat signatures');

    await contentService.getCachedFileEntryAsync(contentFile, {});
    status = contentService.getCacheStatus();
    assert.ok(status.metrics.fileCacheHits >= 1, 'second async content load hits cache');
    assert.strictEqual(status.metrics.fileReadCalls, 1, 'warm content load does not reread file');

    const libraryDir = path.join(tmp, 'library');
    fs.mkdirSync(libraryDir, { recursive: true });
    fs.writeFileSync(path.join(libraryDir, 'novel.txt'), 'library fixture', 'utf8');
    const libraryService = createLibraryService({
      libraryPath: libraryDir,
      encodeStableId: (value) => Buffer.from(String(value)).toString('base64url'),
      libraryDeepSignatureCheckTtlMs: 5000
    });
    const firstLibrary = libraryService.getLibraryCached();
    assert.ok(Array.isArray(firstLibrary) && firstLibrary.length === 1, 'library fixture loaded');
    const rootCallsAfterBuild = libraryService.getCacheStatus().metrics.rootSignatureCalls;
    const secondLibrary = libraryService.getLibraryCached();
    assert.strictEqual(secondLibrary, firstLibrary, 'library cache returns same hot data object');
    const libraryStatus = libraryService.getCacheStatus();
    assert.strictEqual(libraryStatus.marker, 'v439-library-cache-strategy-pass', 'library strategy marker exposed');
    assert.strictEqual(libraryStatus.metrics.rootSignatureCalls, rootCallsAfterBuild, 'hot library cache hit avoids root stat within deep-signature TTL');
    assert.ok(libraryStatus.metrics.libraryCacheHits >= 1, 'library cache hit counter increments');

    const manifestContentService = {
      parsePreprocessOptionsFromQuery: () => ({}),
      serializePreprocessOptions: () => 'default',
      getCachedFileEntryAsync: async () => ({
        text: '문단 하나입니다.\n\n문단 둘입니다.',
        textHash: 'content-hash',
        statSig: '10:1',
        chunkBounds: [[0, 9], [9, 20]],
        formatStats: {}
      }),
      getTotalChunks: () => 2,
      getChunkByLine: (entry, chunk) => ({ content: chunk === 1 ? '문단 하나입니다.' : '문단 둘입니다.', start: chunk === 1 ? 0 : 9, end: chunk === 1 ? 9 : 20 })
    };
    const manifestLibraryService = {
      getLibraryCached: () => [{ id: 'novel-1', title: 'Novel', isMultiFile: false, singlePath: 'novel.txt', episodes: [] }],
      safeJoinUnderLibrary: (rel) => path.join(libraryDir, rel)
    };
    const blockManifestService = createBlockManifestService({
      libraryPath: libraryDir,
      libraryService: manifestLibraryService,
      contentService: manifestContentService,
      manifestCacheMax: 2
    });
    const firstManifest = await blockManifestService.getSingleManifest('novel-1', {});
    assert.strictEqual(firstManifest.status, 200, 'first manifest status');
    const secondManifest = await blockManifestService.getSingleManifest('novel-1', {});
    assert.strictEqual(secondManifest.status, 200, 'second manifest status');
    const manifestStatus = blockManifestService.getCacheStatus();
    assert.strictEqual(manifestStatus.strategyMarker, 'v439-block-manifest-cache-strategy-pass', 'block-manifest strategy marker exposed');
    assert.ok(manifestStatus.metrics.manifestCacheMisses >= 1, 'manifest miss counter increments');
    assert.ok(manifestStatus.metrics.manifestCacheHits >= 1, 'manifest hit counter increments');

    console.log(JSON.stringify({ pass: 'v439-cache-strategy-adjustment-smoke-pass' }));
  }).catch((error) => {
    console.error(error && error.stack || error);
    process.exitCode = 1;
  }).finally(() => {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  });
} catch (error) {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  throw error;
}
