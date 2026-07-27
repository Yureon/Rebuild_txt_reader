'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const {
  METADATA_CANDIDATE_DEDUP_PASS,
  createMetadataStoreService,
  normalizeWorkKey,
  metadataContentFingerprint
} = require('../../server/services/metadata-store-service');

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v615-metadata-dedup-'));
  try {
    const storePath = path.join(root, 'metadata.json');
    const novel = { id:'novel-a', title:'중복 작품', author:'작가', progressAliases:['novel-a-old'] };
    const provider = { id:'builtin-provider-a', name:'Provider A', adapterKey:'provider-a', revision:1 };
    const otherProvider = { id:'builtin-provider-b', name:'Provider B', adapterKey:'provider-b', revision:1 };
    const base = {
      title:'중복 작품', author:'작가', synopsis:'동일한 소개 문장', genres:['판타지','현대'], tags:['성장','회귀'],
      publicationStatus:'연재중', publicationYear:2026, sourceLanguage:'ko', coverUrl:'https://img.example/cover.jpg',
      sourceUrl:'https://provider.example/work/1', remoteId:'remote-1'
    };

    const store = createMetadataStoreService({ storePath, maxCandidates:100, maxCandidatesPerWork:30 });
    const first = store.saveCandidate(novel, provider, base, { jobId:'job-1', matchScore:0.91 });
    const duplicate = store.saveCandidate(novel, provider, {
      ...base,
      genres:['현대','판타지'],
      tags:['회귀','성장'],
      sourceUrl:'https://provider.example/work/alternate',
      remoteId:'remote-alternate',
      rawSha256:'different-transport-body'
    }, { jobId:'job-2', matchScore:0.97 });
    assert.strictEqual(duplicate.id, first.id, 'same provider and normalized metadata content must reuse the candidate id');
    assert.strictEqual(store.listCandidatesForNovel(novel, 100).length, 1, 'same-provider duplicate content must display once');
    assert.strictEqual(store.listCandidatesForNovel(novel, 100)[0].jobId, 'job-2', 'reused candidate must keep the latest collection metadata');

    const other = store.saveCandidate(novel, otherProvider, base, { jobId:'job-3', matchScore:0.95 });
    assert.notStrictEqual(other.id, first.id, 'same content from a different provider must remain a separate candidate');
    assert.strictEqual(store.listCandidatesForNovel(novel, 100).length, 2);

    const changed = store.saveCandidate(novel, provider, {
      ...base,
      synopsis:'내용이 실제로 변경된 소개 문장',
      sourceUrl:'https://provider.example/work/2',
      remoteId:'remote-2'
    }, { jobId:'job-4', matchScore:0.92 });
    assert.notStrictEqual(changed.id, first.id, 'different metadata content from the same provider must remain reviewable');
    assert.strictEqual(store.listCandidatesForNovel(novel, 100).length, 3);
    await store.flush();
    await store.close();

    const fingerprint = metadataContentFingerprint(base);
    const oldDuplicateStore = path.join(root, 'legacy-duplicates.json');
    const workKey = normalizeWorkKey(novel.title, novel.author);
    fs.writeFileSync(oldDuplicateStore, JSON.stringify({
      schemaVersion:1,
      revision:7,
      settings:{ providers:{} },
      candidates:{
        legacy_a:{
          id:'legacy_a', novelId:novel.id, aliases:[novel.id], workKey, providerId:provider.id, providerName:provider.name,
          adapterKey:provider.adapterKey, adapterRevision:1, matchScore:0.8, direct:false, query:'a', data:{
            title:base.title, originalTitle:null, author:base.author, synopsis:base.synopsis, genres:base.genres, tags:base.tags,
            publicationStatus:base.publicationStatus, publicationYear:base.publicationYear, sourceLanguage:'ko',
            coverRemoteUrl:base.coverUrl, coverAssetId:null, coverUrl:null, sourceUrl:base.sourceUrl, remoteId:'legacy-1', rawSha256:''
          }, sourceUrl:base.sourceUrl, remoteId:'legacy-1', createdAt:'2026-01-01T00:00:00.000Z', updatedAt:'2026-01-01T00:00:00.000Z', jobId:'legacy-job-1'
        },
        legacy_b:{
          id:'legacy_b', novelId:novel.id, aliases:[novel.id,'novel-a-old'], workKey, providerId:provider.id, providerName:provider.name,
          adapterKey:provider.adapterKey, adapterRevision:1, matchScore:0.99, direct:true, query:'b', contentFingerprint:fingerprint, data:{
            title:base.title, originalTitle:null, author:base.author, synopsis:base.synopsis, genres:['현대','판타지'], tags:['회귀','성장'],
            publicationStatus:base.publicationStatus, publicationYear:base.publicationYear, sourceLanguage:'ko',
            coverRemoteUrl:base.coverUrl, coverAssetId:'a'.repeat(64), coverUrl:'/api/metadata/covers/' + 'a'.repeat(64), sourceUrl:'https://provider.example/work/legacy-b', remoteId:'legacy-2', rawSha256:'different'
          }, sourceUrl:'https://provider.example/work/legacy-b', remoteId:'legacy-2', createdAt:'2026-01-02T00:00:00.000Z', updatedAt:'2026-01-02T00:00:00.000Z', jobId:'legacy-job-2'
        }
      },
      applied:{
        applied_a:{ id:'applied_a', novelId:novel.id, aliases:[novel.id], workKey, providerId:provider.id, candidateId:'legacy_a', sourceUrl:base.sourceUrl, fields:['title'], data:{ title:base.title }, createdAt:'2026-01-03T00:00:00.000Z', updatedAt:'2026-01-03T00:00:00.000Z' }
      }
    }, null, 2));

    const migrated = createMetadataStoreService({ storePath:oldDuplicateStore, maxCandidates:100, maxCandidatesPerWork:30 });
    const migratedCandidates = migrated.listCandidatesForNovel(novel, 100);
    assert.strictEqual(migratedCandidates.length, 1, 'legacy same-provider duplicate candidates must compact during load');
    assert.strictEqual(migrated.getAppliedForNovel(novel).candidateId, migratedCandidates[0].id, 'applied candidate reference must remain valid after compaction');
    assert.strictEqual(migratedCandidates[0].data.coverAssetId, 'a'.repeat(64), 'compaction must retain the cached cover asset');
    await migrated.flush();
    const compressedStore = `${oldDuplicateStore}.gz`;
    assert.ok(fs.existsSync(compressedStore), 'legacy metadata store must migrate to the compressed primary');
    assert.ok(!fs.existsSync(oldDuplicateStore), 'legacy plaintext metadata store must be removed after durable migration');
    const persisted = JSON.parse(zlib.gunzipSync(fs.readFileSync(compressedStore)).toString('utf8'));
    assert.strictEqual(Object.keys(persisted.candidates || {}).length, 0, 'candidate payload must not remain duplicated in the main manifest');
    assert.ok(persisted.candidateShards && Number(persisted.candidateShards.candidateRevision) > 0, 'main manifest must commit the candidate shard revision');
    await migrated.close();
    const reloaded = createMetadataStoreService({ storePath:oldDuplicateStore, maxCandidates:100, maxCandidatesPerWork:30 });
    assert.strictEqual(reloaded.listCandidatesForNovel(novel, 100).length, 1, 'compacted candidate must survive shard restart');
    await reloaded.close();

    console.log(JSON.stringify({ pass:METADATA_CANDIDATE_DEDUP_PASS, candidates:3, migratedCandidates:1 }));
  } finally {
    fs.rmSync(root, { recursive:true, force:true });
  }
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });
