#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMetadataStoreService } = require('../../server/services/metadata-store-service');
const { createMetadataQueueService } = require('../../server/services/metadata-queue-service');
const { atomicWriteJsonAsync } = require('../../server/repositories/json-file-store');

function waitFor(check, timeoutMs = 3000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      try { if (check()) return resolve(); } catch (error) { return reject(error); }
      if (Date.now() - started > timeoutMs) return reject(new Error('waitFor timeout'));
      setTimeout(tick, 20);
    };
    tick();
  });
}

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metadata-store-queue-'));
  try {
    const storePath = path.join(root, 'metadata.json');
    const store = createMetadataStoreService({ storePath, maxCandidates:5, maxCandidatesPerWork:3 });
    const provider = { id:'builtin-test', name:'테스트', adapterKey:'test-v1', adapter:{ revision:1 } };
    const novelA = { id:'a', title:'작품 A', author:'작가', progressAliases:['a','a-old'] };
    const novelB = { id:'b', title:'작품 B', author:'다른 작가', progressAliases:['b'] };
    const candidate = store.saveCandidate(novelA, provider, {
      title:'작품 A', author:'작가', synopsis:'소개', genres:['판타지'], tags:['성장'], publicationStatus:'completed',
      coverAssetId:'a'.repeat(64), coverUrlLocal:`/api/metadata/covers/${'a'.repeat(64)}`, coverUrl:'https://images.example/cover.jpg',
      sourceUrl:'https://example.invalid/work/a', remoteId:'1'
    }, { matchScore:0.99 });
    assert.throws(() => store.applyCandidate(novelB, candidate.id, ['title']), error => error && error.code === 'METADATA_CANDIDATE_FORBIDDEN');
    const applied = store.applyCandidate(novelA, candidate.id, ['title','author','synopsis','genres','tags','publicationStatus','cover']);
    assert.equal(applied.data.title, '작품 A');
    assert.equal(store.enrichNovel({ ...novelA, title:'원래 제목' }).description, '소개');
    assert.equal(store.hasCoverAsset('a'.repeat(64)), true);
    assert.equal(store.hasCoverAsset('b'.repeat(64)), false);
    assert.equal(store.canAccessCover('a'.repeat(64), [novelA]), true);
    assert.equal(store.canAccessCover('a'.repeat(64), [novelB]), false);
    await store.flush();
    if (process.platform !== 'win32') assert.equal(fs.statSync(`${storePath}.gz`).mode & 0o777, 0o600);

    for (let i = 0; i < 8; i += 1) store.saveCandidate(novelA, provider, { title:`작품 A ${i}`, sourceUrl:`https://example.invalid/${i}` }, { matchScore:0.5 });
    assert(store.listCandidatesForNovel(novelA, 100).length <= 6, 'per-work candidate retention must be bounded while preserving applied candidate');


    const queuePath = path.join(root, 'queue.json');
    let started = 0;
    let batchWrites = 0;
    const queue = createMetadataQueueService({
      storePath:queuePath,
      writeJsonAsync:async (filePath, value) => { batchWrites += 1; return atomicWriteJsonAsync(filePath, value); },
      pollMs:20,
      maxAttempts:1,
      maxJobs:32,
      handler:async (_job, context) => {
        started += 1;
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 1500);
          context.signal.addEventListener('abort', () => { clearTimeout(timer); reject(context.signal.reason); }, { once:true });
        });
        return { ok:true };
      }
    });
    const input = { type:'collect', mode:'search', novel:{ id:'a', title:'작품 A' }, providerIds:['p2','p1'] };
    const secondInput = { type:'collect', mode:'search', novel:{ id:'b', title:'작품 B' }, providerIds:['p1'] };
    const batch = queue.enqueueMany([input, { ...input, providerIds:['p1','p2'] }, secondInput]);
    await queue.flush();
    assert.equal(batch[0].id, batch[1].id, 'same job inside a batch must coalesce');
    assert.notEqual(batch[0].id, batch[2].id);
    assert.equal(batchWrites, 1, 'batch enqueue must persist the queue once');
    queue.cancel(batch[2].id);
    queue.start();
    const first = batch[0];
    const duplicate = queue.enqueue({ ...input, providerIds:['p1','p2'] });
    assert.equal(first.id, duplicate.id, 'same active collection must coalesce');
    await waitFor(() => queue.get(first.id)?.status === 'running');
    queue.cancel(first.id);
    await waitFor(() => queue.get(first.id)?.status === 'cancelled');
    assert.equal(started, 1);
    await queue.stop();
    const queueRaw = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
    assert.equal(queueRaw.jobs[0].status, 'cancelled');
    if (process.platform !== 'win32') assert.equal(fs.statSync(queuePath).mode & 0o777, 0o600);

    await store.close();
    console.log(JSON.stringify({ pass:'v576-metadata-store-queue-smoke-pass', revision:store.getRevision(), started }));
  } finally {
    fs.rmSync(root, { recursive:true, force:true });
  }
}
run().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
