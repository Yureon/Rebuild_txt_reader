#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const {
  createMetadataStoreService,
  METADATA_STORE_ASYNC_PERSISTENCE_PASS
} = require('../../server/services/metadata-store-service');

const PASS = 'v592-metadata-store-async-persistence-smoke-pass';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-metadata-store-v592-'));
process.on('exit', () => fs.rmSync(tmp, { recursive:true, force:true }));

(async () => {
  assert.strictEqual(METADATA_STORE_ASYNC_PERSISTENCE_PASS, 'v592-metadata-store-async-persistence-pass');
  const storePath = path.join(tmp, 'metadata.json');
  const store = createMetadataStoreService({ storePath, maxCandidates:200, maxCandidatesPerWork:200 });
  const provider = { id:'provider-test', name:'Provider Test', adapter:{ revision:1 } };
  const novel = { id:'novel-1', title:'비동기 저장 테스트', author:'작가' };

  for (let index = 0; index < 50; index += 1) {
    store.saveCandidate(novel, provider, {
      title:`비동기 저장 테스트 ${index}`,
      author:'작가',
      sourceUrl:`https://example.invalid/work/${index}`,
      remoteId:String(index)
    }, { matchScore:0.8 });
  }
  const before = store.getPersistenceStatus();
  assert.strictEqual(before.pass, METADATA_STORE_ASYNC_PERSISTENCE_PASS);
  assert.strictEqual(before.mutations, 50);
  assert.strictEqual(before.writes, 0, 'candidate mutations must not rewrite the full JSON file synchronously');
  const compressedStorePath = `${storePath}.gz`;
  assert.strictEqual(fs.existsSync(compressedStorePath), false, 'compressed store file should be created only at an explicit durability boundary');

  await store.flush();
  const after = store.getPersistenceStatus();
  assert.strictEqual(after.writes, 2, 'coalesced mutations must write one dirty candidate shard and one manifest');
  assert.strictEqual(after.dirty, false);
  assert.strictEqual(after.persistedGeneration, after.generation);
  if (process.platform !== 'win32') assert.strictEqual(fs.statSync(compressedStorePath).mode & 0o777, 0o600);
  const saved = JSON.parse(zlib.gunzipSync(fs.readFileSync(compressedStorePath)).toString('utf8'));
  assert.strictEqual(Object.keys(saved.candidates || {}).length, 0, 'candidate payload must not be duplicated in the main manifest');
  assert.ok(saved.candidateShards && Number(saved.candidateShards.candidateRevision) > 0);
  const reloaded = createMetadataStoreService({ storePath, maxCandidates:200, maxCandidatesPerWork:200 });
  assert.strictEqual(reloaded.listCandidatesForNovel(novel, 100).length, 50);
  await reloaded.close();

  const closeResult = await store.close();
  assert.strictEqual(closeResult, true);
  assert.strictEqual(store.getPersistenceStatus().closed, true);
  console.log(JSON.stringify({ pass:PASS, writes:after.writes, mutations:after.mutations }));
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
