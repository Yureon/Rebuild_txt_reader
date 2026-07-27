#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMetadataStoreService, METADATA_EQUIVALENT_GROUP_PASS } = require('../../server/services/metadata-store-service');
const { createMetadataService } = require('../../server/services/metadata-service');

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v638-metadata-groups-'));
  try {
    const store = createMetadataStoreService({ storePath:path.join(root, 'metadata.json') });
    const service = createMetadataService({
      store,
      transport:{ async fetchProvider(){ throw new Error('network must not be used'); } },
      coverService:{ async cacheRemoteCover(){ return null; } },
      queuePath:path.join(root, 'queue.json'),
      bulkDir:path.join(root, 'batches'),
      enabled:true,
      concurrency:1,
      maxJobs:8,
      maxAttempts:1,
      pollMs:20
    });
    try {
      const novel = { id:'group-novel', title:'같은 작품', author:'작가', progressAliases:['group-novel'] };
      const naver = { id:'builtin-naver-series', name:'네이버 시리즈', adapterKey:'naver-series-webnovel-v1', revision:1 };
      const kakao = { id:'builtin-kakaopage', name:'카카오페이지', adapterKey:'kakaopage-webnovel-v1', revision:1 };
      const shared = {
        title:'같은 작품', author:'작가', synopsis:'동일한 작품 소개입니다.', genres:['판타지','현대'], tags:['성장','회귀'],
        publicationStatus:'완결', publicationYear:2026, sourceLanguage:'ko'
      };
      const naverCandidate = store.saveCandidate(novel, naver, {
        ...shared,
        coverAssetId:'a'.repeat(64), coverUrlLocal:'/api/metadata/covers/' + 'a'.repeat(64),
        sourceUrl:'https://series.naver.com/novel/detail.series?productNo=1', remoteId:'1'
      }, { matchScore:0.97 });
      const kakaoCandidate = store.saveCandidate(novel, kakao, {
        ...shared,
        genres:['현대','판타지'], tags:['회귀','성장'],
        coverAssetId:'b'.repeat(64), coverUrlLocal:'/api/metadata/covers/' + 'b'.repeat(64),
        sourceUrl:'https://page.kakao.com/content/2', remoteId:'2'
      }, { matchScore:0.97 });
      await store.flush();

      const detail = service.getNovelMetadata(novel);
      assert.equal(detail.candidateCount, 2);
      assert.equal(detail.candidateGroupCount, 1, 'equivalent metadata from different providers must form one group');
      assert.equal(detail.groupedCandidateCount, 1);
      assert.equal(detail.candidateGroups.length, 1);
      const group = detail.candidateGroups[0];
      assert.equal(group.count, 2);
      assert.equal(group.providers.length, 2, 'provider provenance must be retained');
      assert.equal(group.coverVariantCount, 2, 'different cover variants must remain visible');
      assert.equal(group.pass, METADATA_EQUIVALENT_GROUP_PASS);
      assert.equal(group.representativeId, naverCandidate.id, 'equal scores must use provider priority for the representative');

      const appliedResult = await service.applyCandidateGroup(novel, group.id, ['title','synopsis','cover']);
      assert.equal(appliedResult.applied.candidateId, naverCandidate.id);
      assert.equal(appliedResult.applied.data.coverAssetId, 'a'.repeat(64));
      assert.equal(appliedResult.group.count, 2);

      const removed = await service.removeCandidateGroup(novel, group.id);
      assert.equal(removed.removedCount, 2, 'group deletion must remove all equivalent candidates atomically');
      const after = service.getNovelMetadata(novel);
      assert.equal(after.candidateCount, 0);
      assert.equal(after.candidateGroups.length, 0);
      assert.equal(after.applied.data.title, shared.title, 'removing candidates must not remove already applied metadata');
      assert.equal(after.applied.candidateId, '', 'removed group references must be detached from applied metadata');
      assert.notEqual(naverCandidate.id, kakaoCandidate.id);
      const pageSource = fs.readFileSync(path.join(__dirname, '../../public/scripts/rebuild/metadata-page.mjs'), 'utf8');
      const modalSource = fs.readFileSync(path.join(__dirname, '../../public/scripts/rebuild/features/library-metadata-runtime.mjs'), 'utf8');
      const apiSource = fs.readFileSync(path.join(__dirname, '../../public/scripts/rebuild/core/api.mjs'), 'utf8');
      assert(pageSource.includes('candidateGroups') && pageSource.includes('묶음 전체 삭제'));
      assert(modalSource.includes('metadataCandidateGroupId') && modalSource.includes('동일 정보'));
      assert(apiSource.includes('deleteMetadataCandidateGroup'));

      console.log(JSON.stringify({ pass:METADATA_EQUIVALENT_GROUP_PASS, candidates:2, groups:1, removed:2, uiGrouped:true }));
    } finally {
      await service.stop();
    }
  } finally {
    fs.rmSync(root, { recursive:true, force:true });
  }
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });
