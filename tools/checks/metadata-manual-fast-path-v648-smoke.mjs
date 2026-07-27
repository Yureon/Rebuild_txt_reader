#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createMetadataStoreService, METADATA_APPLIED_SHARD_PASS } = require('../../server/services/metadata-store-service');
const { atomicWriteCompressedJsonAsync } = require('../../server/repositories/compressed-json-file-store');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v648-manual-fast-'));
process.on('exit', () => fs.rmSync(dir, { recursive:true, force:true }));

const storePath = path.join(dir, 'work-metadata.json');
const compressedStorePath = `${storePath}.gz`;
const appliedStorePath = path.join(dir, 'work-metadata-applied.json.gz');
const novel = { id:'novel-1', title:'공급자 적용 작품', author:'작가', progressAliases:['novel-1','copy-1'] };
const provider = { id:'builtin-test', name:'Test', adapter:{ revision:1 } };
let store = createMetadataStoreService({ storePath, compressedStorePath, appliedStorePath, compressionLevel:1, logger:{ warn(){} } });
const candidate = store.saveCandidate(novel, provider, {
  title:'공급자 제목', author:'작가', synopsis:'소개'.repeat(4000), genres:['판타지'], tags:['완결'], publicationStatus:'완결'
}, { matchScore:0.99 });
await store.flush();
const mainAfterCandidate = sha(compressedStorePath);
await store.applyCandidateDurably(novel, candidate.id, ['title','author','synopsis','genres','tags','publicationStatus']);
const mainAfterApply = sha(compressedStorePath);
assert.equal(mainAfterApply, mainAfterCandidate, 'provider apply must not recompress the full candidate store');
assert(fs.existsSync(appliedStorePath), 'applied metadata shard must be durable');
await store.saveManualMetadataDurably(novel, { fields:['title','synopsis'], title:'수동 수정 제목', synopsis:'수동 소개' });
assert.equal(sha(compressedStorePath), mainAfterCandidate, 'manual edit must not rewrite the full candidate gzip');
assert.equal(store.getAppliedForNovel(novel)?.providerId, 'manual');
assert.equal(store.getAppliedForNovel(novel)?.data?.title, '수동 수정 제목');
assert.equal(store.getPersistenceStatus().appliedShardPass, METADATA_APPLIED_SHARD_PASS);
await store.close();

store = createMetadataStoreService({ storePath, compressedStorePath, appliedStorePath, compressionLevel:1, logger:{ warn(){} } });
assert.equal(store.getAppliedForNovel(novel)?.data?.title, '수동 수정 제목', 'applied shard must survive restart');
assert.equal(store.getPersistenceStatus().appliedLoadedSource, 'compressed-primary');
await store.close();



// Applied-only writes have no monolith fallback and must roll memory back on
// failure. Once the storage error clears, flushing the restored state must be
// safe and restart-stable.
{
  const failureDir = path.join(dir, 'applied-failure');
  fs.mkdirSync(failureDir, { recursive:true });
  const failureStorePath = path.join(failureDir, 'work-metadata.json');
  const failureCompressedPath = `${failureStorePath}.gz`;
  const failureAppliedPath = path.join(failureDir, 'work-metadata-applied.json.gz');
  let failApplied = false;
  const writer = async (filePath, value, options) => {
    if (failApplied && filePath === failureAppliedPath) throw Object.assign(new Error('simulated applied shard failure'), { code:'ENOSPC' });
    return atomicWriteCompressedJsonAsync(filePath, value, options);
  };
  let failureStore = createMetadataStoreService({ storePath:failureStorePath, compressedStorePath:failureCompressedPath, appliedStorePath:failureAppliedPath, writeCompressed:writer, compressionLevel:1, logger:{ warn(){} } });
  const failureCandidate = failureStore.saveCandidate(novel, provider, { title:'실패 복구 후보', author:'작가' }, { matchScore:0.99 });
  await failureStore.flush();
  failApplied = true;
  await assert.rejects(() => failureStore.applyCandidateDurably(novel, failureCandidate.id, ['title','author']), /simulated applied shard failure/);
  assert.equal(failureStore.getAppliedForNovel(novel), null, 'failed applied-only mutation must roll memory back');
  failApplied = false;
  await failureStore.flush();
  await failureStore.close();
  failureStore = createMetadataStoreService({ storePath:failureStorePath, compressedStorePath:failureCompressedPath, appliedStorePath:failureAppliedPath, compressionLevel:1, logger:{ warn(){} } });
  assert.equal(failureStore.getAppliedForNovel(novel), null, 'failed applied-only mutation must remain rolled back after restart');
  await failureStore.close();
}

// Combined candidate/applied mutations commit the monolith first. When the
// small shard write fails afterwards, the higher monolith applied revision is
// authoritative on restart and the API operation remains durable.
{
  const combinedDir = path.join(dir, 'combined-failure');
  fs.mkdirSync(combinedDir, { recursive:true });
  const combinedStorePath = path.join(combinedDir, 'work-metadata.json');
  const combinedCompressedPath = `${combinedStorePath}.gz`;
  const combinedAppliedPath = path.join(combinedDir, 'work-metadata-applied.json.gz');
  let failApplied = false;
  const writer = async (filePath, value, options) => {
    if (failApplied && filePath === combinedAppliedPath) throw Object.assign(new Error('simulated combined shard failure'), { code:'EIO' });
    return atomicWriteCompressedJsonAsync(filePath, value, options);
  };
  let combinedStore = createMetadataStoreService({ storePath:combinedStorePath, compressedStorePath:combinedCompressedPath, appliedStorePath:combinedAppliedPath, writeCompressed:writer, compressionLevel:1, logger:{ warn(){} } });
  const combinedCandidate = combinedStore.saveCandidate(novel, provider, { title:'결합 트랜잭션 후보', author:'작가' }, { matchScore:0.99 });
  await combinedStore.flush();
  await combinedStore.applyCandidateDurably(novel, combinedCandidate.id, ['title','author']);
  failApplied = true;
  await combinedStore.removeCandidateDurably(novel, combinedCandidate.id);
  assert.equal(combinedStore.getAppliedForNovel(novel)?.candidateId, '', 'combined mutation must update in-memory provenance');
  assert.equal(combinedStore.getPersistenceStatus().appliedShardRepairNeeded, true);
  await combinedStore.close();

  combinedStore = createMetadataStoreService({ storePath:combinedStorePath, compressedStorePath:combinedCompressedPath, appliedStorePath:combinedAppliedPath, compressionLevel:1, logger:{ warn(){} } });
  assert.equal(combinedStore.listCandidatesForNovel(novel).length, 0, 'combined main commit must keep candidate removal');
  assert.equal(combinedStore.getAppliedForNovel(novel)?.candidateId, '', 'newer monolith revision must win over stale shard');
  assert.equal(combinedStore.getPersistenceStatus().appliedLoadedSource, 'compressed-stale');
  await combinedStore.close();
}

const loadState = await import(`${pathToFileURL(path.join(root, 'public/scripts/rebuild/features/library-load-state.mjs')).href}?v648=${Date.now()}`);
const shelfNovel = { id:'novel-1', title:'공급자 제목', author:'작가', progressAliases:['novel-1','copy-1'], metadata:{ providerId:'builtin-test' } };
const state = { libraryShelfItems:[shelfNovel], novels:[shelfNovel], novelById:new Map([['novel-1',shelfNovel]]), current:null };
const patchResult = loadState.applyLibraryNovelPatch(state, {
  id:'novel-1', progressAliases:['novel-1','copy-1'], title:'수동 수정 제목', author:'작가', description:'수동 소개', synopsis:'수동 소개', genres:['판타지'], tags:['완결'], publicationStatus:'완결', publicationYear:null, sourceLanguage:'ko', coverUrl:'', metadata:{ providerId:'manual' }
});
assert.equal(patchResult.updated, 1);
assert.equal(shelfNovel.title, '수동 수정 제목');
assert.equal(shelfNovel.metadata.providerId, 'manual');

const routes = read('server/routes/metadata-routes.js');
assert(routes.includes('directNovelByAlias'));
assert(routes.includes("resolveMode:'direct-alias'"));
assert(routes.includes('novelPatch:buildNovelPatch'));
assert(routes.includes('queueFingerprintWork:false'));
const client = read('public/scripts/rebuild/features/library-metadata-runtime.mjs');
assert(client.includes('refreshLibraryPresentation(controller,response)'));
assert(client.includes('controller.options.refreshLibraryNovel'));
const bridge = read('public/scripts/rebuild/features/library-action-orchestrator-bridge.mjs');
assert(bridge.includes("source:'metadata-item-patched'"));
assert(bridge.includes('applyLibraryNovelPatch(app.state, patch)'));

console.log(JSON.stringify({
  pass:'v648-metadata-manual-fast-path-smoke-pass',
  appliedShard:true,
  mainStoreRewrites:0,
  targetedResolve:true,
  clientItemPatch:true
}));
