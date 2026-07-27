#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  createMetadataCandidateShardStore,
  shardIndexForId
} = require('../../server/services/metadata-candidate-shard-store');
const { atomicWriteCompressedJsonAsync } = require('../../server/repositories/compressed-json-file-store');

const PASS = 'v673-metadata-candidate-shard-race-smoke-pass';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v673-candidate-race-'));
process.on('exit', () => fs.rmSync(tmp, { recursive:true, force:true }));

(async () => {
  let releaseWrite;
  let writeStarted;
  const started = new Promise(resolve => { writeStarted = resolve; });
  const release = new Promise(resolve => { releaseWrite = resolve; });
  let delayed = true;
  const writer = async (filePath, value, options) => {
    if (delayed) {
      delayed = false;
      writeStarted();
      await release;
    }
    return atomicWriteCompressedJsonAsync(filePath, value, options);
  };
  const store = createMetadataCandidateShardStore({ baseDir:tmp, shardCount:8, compressionLevel:1, writeCompressed:writer });
  const firstId = 'candidate-first';
  let secondId = 'candidate-second';
  while (shardIndexForId(secondId, 8) !== shardIndexForId(firstId, 8)) secondId += 'x';
  const candidates = { [firstId]:{ id:firstId, data:{ title:'first' } } };
  store.load(null, candidates);
  const firstFlush = store.flush(candidates, 1, 1);
  await started;
  candidates[secondId] = { id:secondId, data:{ title:'second' } };
  store.markCandidate(secondId);
  releaseWrite();
  await firstFlush;
  assert.strictEqual(store.getStats().dirtyShards, 1, 'new same-shard mutation must survive an in-flight write');
  const manifest = await store.flush(candidates, 2, 2);
  assert.strictEqual(store.getStats().dirtyShards, 0);
  const reloaded = createMetadataCandidateShardStore({ baseDir:tmp, shardCount:8, compressionLevel:1 });
  const loaded = reloaded.load(manifest, {});
  assert(loaded.candidates[firstId] && loaded.candidates[secondId]);
  console.log(JSON.stringify({ pass:PASS, sameShard:true, dirtyVersionProtected:true }));
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });
