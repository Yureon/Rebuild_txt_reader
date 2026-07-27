#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMetadataStoreService } = require('../../server/services/metadata-store-service');
const { createMetadataService } = require('../../server/services/metadata-service');

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v639-group-cover-'));
  const store = createMetadataStoreService({ storePath:path.join(root, 'metadata.json') });
  const service = createMetadataService({
    store,
    transport:{ async fetchProvider(){ throw new Error('network must not be used'); } },
    coverService:{ async cacheRemoteCover(){ return null; } },
    queuePath:path.join(root, 'queue.json'), bulkDir:path.join(root, 'batches'),
    enabled:true, concurrency:1, maxJobs:8, maxAttempts:1, pollMs:20
  });
  try {
    const novel = { id:'group-cover-novel', title:'표지 결합 작품', author:'작가', progressAliases:['group-cover-novel'] };
    const naver = { id:'builtin-naver-series', name:'네이버 시리즈', adapterKey:'naver-series-webnovel-v1', revision:1 };
    const kakao = { id:'builtin-kakaopage', name:'카카오페이지', adapterKey:'kakaopage-webnovel-v1', revision:1 };
    const shared = { title:novel.title, author:novel.author, synopsis:'같은 소개', genres:['판타지'], tags:['성장'], publicationStatus:'완결', publicationYear:2026, sourceLanguage:'ko' };
    const textWinner = store.saveCandidate(novel, naver, {
      ...shared, sourceUrl:'javascript:alert(1)', remoteId:'unsafe-source'
    }, { matchScore:0.99 });
    const coverWinner = store.saveCandidate(novel, kakao, {
      ...shared,
      coverAssetId:'c'.repeat(64), coverUrlLocal:'/api/metadata/covers/' + 'c'.repeat(64),
      sourceUrl:'https://page.kakao.com/content/639', remoteId:'639'
    }, { matchScore:0.98 });
    await store.flush();

    const detail = service.getNovelMetadata(novel);
    assert.equal(detail.candidateGroups.length, 1);
    const group = detail.candidateGroups[0];
    assert.equal(group.representativeId, textWinner.id, 'highest score must remain the text representative');
    assert.equal(group.coverRepresentativeId, coverWinner.id, 'best cover-bearing member must be tracked separately');
    assert.equal(group.data.coverAssetId, 'c'.repeat(64), 'group presentation must expose an available cover');
    assert.equal(group.providers.find(item => item.candidateId === textWinner.id).sourceUrl, '', 'unsafe source URL must not be exposed');

    const result = await service.applyCandidateGroup(novel, group.id, ['title','cover']);
    assert.equal(result.applied.candidateId, textWinner.id);
    assert.equal(result.applied.coverCandidateId, coverWinner.id);
    assert.equal(result.applied.data.coverAssetId, 'c'.repeat(64));
    assert.equal(result.applied.data.coverUrl, '/api/metadata/covers/' + 'c'.repeat(64));

    await assert.rejects(
      () => service.applyCandidate(novel, textWinner.id, ['cover']),
      error => error && error.code === 'METADATA_FIELDS_INVALID',
      'server must reject applying a field the selected candidate does not contain'
    );
    const persisted = store.getAppliedForNovel(novel);
    assert.equal(persisted.data.coverAssetId, 'c'.repeat(64), 'rejected apply must not clear the existing cover');

    const removed = await service.removeCandidateGroup(novel, group.id);
    assert.equal(removed.removedCount, 2);
    const detached = store.getAppliedForNovel(novel);
    assert.equal(detached.candidateId, '');
    assert.equal(detached.coverCandidateId, '', 'removed cover candidate provenance must be detached');
    assert.equal(detached.data.coverAssetId, 'c'.repeat(64), 'candidate cleanup must not delete already applied cover data');

    console.log(JSON.stringify({ pass:'v639-metadata-group-cover-pass', representative:textWinner.id, coverRepresentative:coverWinner.id, unsafeSourceHidden:true, provenanceDetached:true }));
  } finally {
    await service.stop();
    fs.rmSync(root, { recursive:true, force:true });
  }
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });
