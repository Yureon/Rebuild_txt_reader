#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { performance } = require('perf_hooks');
const {
  createMetadataStoreService,
  METADATA_APPLIED_SHARD_V2_PASS
} = require('../../server/services/metadata-store-service');
const {
  createMetadataAppliedShardStore,
  shardIndexForId
} = require('../../server/services/metadata-applied-shard-store');
const { atomicWriteCompressedJsonAsync } = require('../../server/repositories/compressed-json-file-store');

const PASS = 'v673-metadata-applied-shard-smoke-pass';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v673-applied-shards-'));
process.on('exit', () => fs.rmSync(tmp, { recursive:true, force:true }));

function sha(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

(async () => {
  const storePath = path.join(tmp, 'work-metadata.json');
  const compressedStorePath = `${storePath}.gz`;
  const appliedStorePath = path.join(tmp, 'work-metadata-applied.json.gz');
  const writes = [];
  const writer = async (filePath, value, options) => {
    writes.push(path.relative(tmp, filePath).split(path.sep).join('/'));
    return atomicWriteCompressedJsonAsync(filePath, value, options);
  };
  let store = createMetadataStoreService({
    storePath,
    compressedStorePath,
    appliedStorePath,
    appliedShardDir:path.join(tmp, 'metadata-applied-shards'),
    writeCompressed:writer,
    compressionLevel:1,
    logger:{ warn(){} }
  });

  const fixtureRecords = 20000;
  for (let index = 0; index < fixtureRecords; index += 1) {
    const novel = { id:`novel-${index}`, title:`적용 샤드 작품 ${index}`, author:`작가 ${index % 127}` };
    store.saveManualMetadata(novel, { fields:['title','author','synopsis'], title:novel.title, author:novel.author, synopsis:`소개 ${index} `.repeat(8) });
  }
  await store.flush();
  const mainHash = sha(compressedStorePath);
  writes.length = 0;

  const targetNovel = { id:'novel-12345', title:'적용 샤드 작품 12345', author:`작가 ${12345 % 127}` };
  const samples = [];
  for (let index = 0; index < 5; index += 1) {
    const before = writes.length;
    const startedAt = performance.now();
    await store.saveManualMetadataDurably(targetNovel, {
      fields:['title','author','synopsis'],
      title:targetNovel.title,
      author:targetNovel.author,
      synopsis:`수정 ${index} `.repeat(12)
    });
    samples.push(performance.now() - startedAt);
    const mutationWrites = writes.slice(before);
    assert.strictEqual(mutationWrites.length, 2, 'one applied shard and one small manifest must be written per applied-only edit');
    assert(mutationWrites.some(name => name.startsWith('metadata-applied-shards/')), 'applied record shard must be written');
    assert(mutationWrites.includes('work-metadata-applied.json.gz'), 'applied manifest must be written');
    assert.strictEqual(sha(compressedStorePath), mainHash, 'applied-only edit must not rewrite the main metadata manifest');
  }
  const averageMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const maxMs = Math.max(...samples);
  assert(averageMs < 100, `bounded applied shard edit should remain below 100ms average on local fixture, got ${averageMs.toFixed(2)}ms`);
  const status = store.getPersistenceStatus();
  assert.strictEqual(status.appliedStorageMode, 'sharded-v2');
  assert.strictEqual(status.appliedShardV2Pass, METADATA_APPLIED_SHARD_V2_PASS);
  await store.close();

  store = createMetadataStoreService({
    storePath,
    compressedStorePath,
    appliedStorePath,
    appliedShardDir:path.join(tmp, 'metadata-applied-shards'),
    compressionLevel:1,
    logger:{ warn(){} }
  });
  assert.strictEqual(store.getAppliedForNovel(targetNovel)?.data?.synopsis, '수정 4 '.repeat(12).trim(), 'sharded applied edit must survive restart');
  assert.strictEqual(store.getPersistenceStatus().appliedLoadedSource, 'compressed-primary');
  await store.close();

  // A mutation arriving while a shard write is in flight must keep the shard
  // dirty; the first snapshot cannot clear a newer dirty version.
  const raceDir = path.join(tmp, 'race-shards');
  let releaseWrite;
  let writeStarted;
  const writeStartedPromise = new Promise(resolve => { writeStarted = resolve; });
  const releasePromise = new Promise(resolve => { releaseWrite = resolve; });
  let delayed = true;
  const raceWriter = async (filePath, value, options) => {
    if (delayed) {
      delayed = false;
      writeStarted();
      await releasePromise;
    }
    return atomicWriteCompressedJsonAsync(filePath, value, options);
  };
  const raceStore = createMetadataAppliedShardStore({ baseDir:raceDir, shardCount:8, compressionLevel:1, writeCompressed:raceWriter });
  raceStore.initializeEmpty();
  const firstId = 'race-first';
  let secondId = 'race-second';
  while (shardIndexForId(secondId, 8) !== shardIndexForId(firstId, 8)) secondId += 'x';
  const applied = {
    [firstId]:{ id:firstId, data:{ title:'first' } }
  };
  raceStore.markRecord(firstId);
  const firstFlush = raceStore.flush(applied, 1, 1);
  await writeStartedPromise;
  applied[secondId] = { id:secondId, data:{ title:'second' } };
  raceStore.markRecord(secondId);
  releaseWrite();
  await firstFlush;
  assert.strictEqual(raceStore.getStats().dirtyShards, 1, 'new mutation during write must keep shard dirty');
  const manifest = await raceStore.flush(applied, 2, 2);
  assert.strictEqual(raceStore.getStats().dirtyShards, 0);
  const reloadedRace = createMetadataAppliedShardStore({ baseDir:raceDir, shardCount:8, compressionLevel:1 });
  const loaded = reloadedRace.load(manifest, {});
  assert(loaded.applied[firstId] && loaded.applied[secondId], 'second flush must persist both same-shard records');

  console.log(JSON.stringify({
    pass:PASS,
    fixtureAppliedRecords:fixtureRecords,
    averageEditMs:Number(averageMs.toFixed(2)),
    maxEditMs:Number(maxMs.toFixed(2)),
    writesPerEdit:2,
    mainManifestRewrites:0,
    concurrentDirtyVersionProtected:true
  }));
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
