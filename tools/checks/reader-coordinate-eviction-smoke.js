const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs');

(async () => {
  const root = path.join(__dirname, '../..');
  const coordinatesPath = path.join(root, 'public/scripts/rebuild/features/reader/coordinates.mjs');
  const chunkWindowPath = path.join(root, 'public/scripts/rebuild/features/reader/chunk-window.mjs');
  const coordinatesSource = fs.readFileSync(coordinatesPath, 'utf8');
  const chunkWindowSource = fs.readFileSync(chunkWindowPath, 'utf8');

  assert.ok(coordinatesSource.includes("READER_COORDINATE_EVICTION_PASS = 'v551-reader-coordinate-eviction-pass'"), 'coordinate eviction marker missing');
  assert.ok(coordinatesSource.includes('export function pruneEstimatedCoordinateChunks'), 'coordinate eviction export missing');
  assert.ok(chunkWindowSource.includes("import { pruneEstimatedCoordinateChunks } from './coordinates.mjs';"), 'chunk-window must import coordinate eviction helper');
  assert.ok(chunkWindowSource.includes('const coordinateEviction = pruneEstimatedCoordinateChunks(app, plan.removed);'), 'chunk-window must evict coordinates when chunks are pruned');

  const mod = await import(pathToFileURL(coordinatesPath).href);
  const app = { state: { readerCoordinates: null, current: { totalChunks: 30 } } };

  for (let chunk = 1; chunk <= 24; chunk += 1) {
    mod.registerChunkBlocks(app, chunk, 10 + (chunk % 3));
  }
  const before = mod.ensureCoordinateState(app);
  assert.strictEqual(before.blockCounts.size, 24, 'fixture should register estimated chunk block counts');
  assert.strictEqual(before.blockMeta.size, 24, 'fixture should build estimated block metadata');

  const result = mod.pruneEstimatedCoordinateChunks(app, [1, 2, 3, 4, 5, 6]);
  const after = mod.ensureCoordinateState(app);
  assert.strictEqual(result.pass, mod.READER_COORDINATE_EVICTION_PASS, 'eviction pass marker mismatch');
  assert.strictEqual(result.pruned, 6, 'estimated coordinate eviction should remove pruned chunks');
  assert.strictEqual(after.blockCounts.size, 18, 'estimated blockCounts should shrink with chunk window');
  assert.strictEqual(after.blockMeta.size, 18, 'estimated blockMeta should shrink with chunk window');
  assert.ok(!after.blockCounts.has(1) && !after.blockMeta.has(1), 'removed chunk coordinates should be deleted');
  assert.ok(after.blockCounts.has(7) && after.blockMeta.has(7), 'retained chunk coordinates should remain');

  const exactApp = { state: { readerCoordinates: null, current: { totalChunks: 3 } } };
  mod.applyBlockManifest(exactApp, {
    version: 1,
    totalChunks: 3,
    totalBlocks: 30,
    totalChars: 300,
    chunks: [
      { chunk: 1, blockStart: 0, blockCount: 10, charStart: 0, charEnd: 100 },
      { chunk: 2, blockStart: 10, blockCount: 10, charStart: 100, charEnd: 200 },
      { chunk: 3, blockStart: 20, blockCount: 10, charStart: 200, charEnd: 300 }
    ]
  });
  const exactBefore = mod.ensureCoordinateState(exactApp);
  const exactResult = mod.pruneEstimatedCoordinateChunks(exactApp, [1, 2]);
  const exactAfter = mod.ensureCoordinateState(exactApp);
  assert.strictEqual(exactResult.skipped, 'exact-manifest', 'exact manifest coordinates must not be evicted');
  assert.strictEqual(exactAfter.blockCounts.size, exactBefore.blockCounts.size, 'exact blockCounts must be retained');
  assert.strictEqual(exactAfter.manifestByChunk.size, exactBefore.manifestByChunk.size, 'exact manifestByChunk must be retained');
  assert.ok(exactAfter.manifestByChunk.has(1), 'exact chunk manifest must remain available for slider/jump accuracy');

  console.log('v551-reader-coordinate-eviction-smoke-pass');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
