#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMetadataStoreService } = require('../../server/services/metadata-store-service');
const { atomicWriteCompressedJsonAsync } = require('../../server/repositories/compressed-json-file-store');

const PASS = 'v673-metadata-sparse-shard-init-smoke-pass';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v673-sparse-shards-'));
process.on('exit', () => fs.rmSync(tmp, { recursive:true, force:true }));

(async () => {
  const storePath = path.join(tmp, 'work-metadata.json');
  const writes = [];
  const writer = async (filePath, value, options) => {
    writes.push(path.relative(tmp, filePath).split(path.sep).join('/'));
    return atomicWriteCompressedJsonAsync(filePath, value, options);
  };
  let store = createMetadataStoreService({ storePath, writeCompressed:writer, compressionLevel:1, logger:{ warn(){} } });
  const novel = { id:'one', title:'첫 후보', author:'작가' };
  const provider = { id:'fixture', name:'Fixture', adapter:{ revision:1 } };
  store.saveCandidate(novel, provider, { title:'첫 후보', author:'작가', remoteId:'one', sourceUrl:'https://example.invalid/one' }, { matchScore:0.99 });
  await store.flush();
  const candidateWrites = writes.filter(name => name.startsWith('metadata-candidate-shards/'));
  assert.strictEqual(candidateWrites.length, 1, `first candidate should write one shard, wrote ${candidateWrites.length}`);
  assert.strictEqual(writes.filter(name => name === 'work-metadata.json.gz').length, 1, 'first candidate should publish one main manifest');
  assert.strictEqual(writes.filter(name => name.startsWith('metadata-applied-shards/')).length, 0, 'empty applied state must not write applied shards');
  assert.strictEqual(writes.filter(name => name === 'work-metadata-applied.json.gz').length, 0, 'empty applied state must not write an applied manifest');
  await store.close();

  store = createMetadataStoreService({ storePath, compressionLevel:1, logger:{ warn(){} } });
  assert.strictEqual(store.listCandidatesForNovel(novel).length, 1, 'sparse candidate shard must survive restart');
  await store.close();
  console.log(JSON.stringify({ pass:PASS, candidateShardWrites:1, appliedShardWrites:0, totalDataWrites:writes.length }));
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });
