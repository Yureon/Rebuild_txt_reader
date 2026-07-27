#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createLibraryService } = require('../../server/services/library-service');

const PASS = 'v648-library-durable-invalidation-smoke-pass';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v648-catalog-'));
  const libraryPath = path.join(root, 'library');
  const cachePath = path.join(root, 'data', 'library-catalog-cache.json.gz');
  fs.mkdirSync(libraryPath, { recursive:true });
  fs.writeFileSync(path.join(libraryPath, 'A.txt'), 'A', 'utf8');
  fs.writeFileSync(path.join(libraryPath, 'B.txt'), 'B', 'utf8');
  const create = () => createLibraryService({
    libraryPath,
    encodeStableId:value => Buffer.from(String(value)).toString('base64url'),
    catalogCachePath:cachePath,
    catalogCacheWriteDelayMs:60_000,
    libraryDeepSignatureCheckTtlMs:60_000
  });
  try {
    const first = create();
    const initial = first.getLibraryCached();
    assert.deepEqual(initial.map(item => item.title).sort(), ['A','B']);
    const a = initial.find(item => item.title === 'A');
    assert.ok(a && a.id);
    assert.equal(await first.flushDurableCatalogCache(), true);
    assert.ok(fs.existsSync(cachePath));

    fs.unlinkSync(path.join(libraryPath, 'A.txt'));
    const invalidation = await first.invalidateLibraryCache({ reason:'deleteNovel', novelIds:[a.id] });
    assert.equal(invalidation.pass, 'v649-library-invalidation-stability-pass');
    assert.deepEqual(first.getLibraryCached().map(item => item.title), ['B'], 'last-known-good catalog must be filtered immediately');
    assert.ok(fs.existsSync(`${cachePath}.state.json`), 'mutation state must be persisted before invalidation resolves');

    // Re-open before a replacement catalog is durably written. The old gzip
    // still contains A, so the state tombstone must suppress resurrection.
    const restored = create();
    const restoredTitles = restored.getLibraryCached().map(item => item.title).sort();
    assert.deepEqual(restoredTitles, ['B']);
    const restoredStatus = restored.getCacheStatus().libraryCache;
    assert.equal(restoredStatus.catalogDirty, true);
    assert.ok(restoredStatus.mutationTombstoneCount >= 1);

    await restored.refreshLibraryCacheAsync('v648-test-refresh');
    assert.deepEqual(restored.getLibraryCached().map(item => item.title), ['B']);
    assert.equal(await restored.flushDurableCatalogCache(), true);
    const settled = create();
    assert.deepEqual(settled.getLibraryCached().map(item => item.title), ['B']);
    const settledStatus = settled.getCacheStatus().libraryCache;
    assert.equal(settledStatus.catalogDirty, false);
    assert.equal(settledStatus.mutationTombstoneCount, 0);
    await first.closeDurableCatalogCache();
    await restored.closeDurableCatalogCache();
    await settled.closeDurableCatalogCache();
    return { pass:PASS, restoredTitles, generation:settledStatus.catalogGeneration };
  } finally {
    await wait(20);
    fs.rmSync(root, { recursive:true, force:true });
  }
}

if (require.main === module) run().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exit(1); });
module.exports = { PASS, run };
