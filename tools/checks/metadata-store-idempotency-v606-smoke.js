'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMetadataStoreService } = require('../../server/services/metadata-store-service');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v606-metadata-store-'));
  try {
    const storePath = path.join(dir, 'metadata.json');
    const store = createMetadataStoreService({ storePath, maxCandidates:500, maxCandidatesPerWork:30 });
    const novel = { id:'novel-a', title:'동일 작품', author:'작가' };
    const provider = { id:'provider-a', name:'Provider A', adapterKey:'a', revision:1 };
    const extracted = { title:'동일 작품', author:'작가', remoteId:'remote-1', sourceUrl:'https://example.invalid/work/1', tags:['회귀'] };
    const first = store.saveCandidate(novel, provider, extracted, { jobId:'job-1', matchScore:0.8 });
    await new Promise(resolve => setTimeout(resolve, 2));
    const other = store.saveCandidate(novel, provider, { ...extracted, remoteId:'remote-2', sourceUrl:'https://example.invalid/work/2' }, { jobId:'job-other', matchScore:0.7 });
    await new Promise(resolve => setTimeout(resolve, 2));
    const second = store.saveCandidate(novel, provider, { ...extracted, synopsis:'갱신 설명' }, { jobId:'job-2', matchScore:0.9 });
    assert.strictEqual(second.id, first.id, 'retrying the same provider work must reuse the candidate id');
    assert.strictEqual(store.listCandidatesForNovel(novel, 100).length, 2, 'a later content change for one merged remote identity must split into a separate reviewable candidate');
    assert.strictEqual(store.listCandidatesForNovel(novel, 100)[0].id, first.id, 'refreshed reusable candidate must return to the top of the recency list');
    assert.strictEqual(store.listCandidatesForNovel(novel, 100)[0].data.synopsis, '갱신 설명');
    assert.strictEqual(other.id, first.id, 'same-provider identical content must reuse the existing candidate');
    await store.flush();
    const applied = await store.applyCandidateDurably(novel, second.id, ['title','author','synopsis','tags']);
    assert.strictEqual(applied.candidateId, second.id);

    const compressedStorePath = `${storePath}.gz`;
    const appliedStorePath = path.join(dir, 'work-metadata-applied.json.gz');
    fs.rmSync(compressedStorePath, { force:true });
    fs.mkdirSync(compressedStorePath);
    fs.rmSync(appliedStorePath, { force:true });
    fs.mkdirSync(appliedStorePath);
    await assert.rejects(() => store.removeAppliedDurably(novel));
    assert.ok(store.getAppliedForNovel(novel), 'failed durable removal must restore the in-memory applied record');
    const previousSettings = store.getProviderSettings(provider.id);
    await assert.rejects(() => store.setProviderSettingsDurably(provider.id, { enabled:false }));
    assert.deepStrictEqual(store.getProviderSettings(provider.id), previousSettings, 'failed provider setting save must roll back memory state');

    const invalidPath = path.join(dir, 'invalid-store');
    fs.mkdirSync(`${invalidPath}.gz`);
    const invalidAppliedPath = path.join(dir, 'invalid-applied.json.gz');
    fs.mkdirSync(invalidAppliedPath);
    const failingStore = createMetadataStoreService({ storePath:invalidPath, appliedStorePath:invalidAppliedPath });
    const failingCandidate = failingStore.saveCandidate(novel, provider, extracted, { jobId:'job-fail' });
    await assert.rejects(() => failingStore.applyCandidateDurably(novel, failingCandidate.id, ['title']));
    assert.strictEqual(failingStore.getAppliedForNovel(novel), null, 'failed durable apply must not remain visible in memory');

    console.log(JSON.stringify({ pass:'v606-metadata-store-idempotency-pass', candidateId:first.id, appliedShardFailure:true }));
  } finally {
    fs.rmSync(dir, { recursive:true, force:true });
  }
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });
