#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  createMetadataStoreService,
  METADATA_MANUAL_EDIT_PASS,
  METADATA_CANDIDATE_DELETE_PASS
} = require('../../server/services/metadata-store-service');

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v630-metadata-edit-'));
  const storePath = path.join(root, 'metadata.json');
  try {
    const novel = { id:'novel-a', title:'원본 제목', author:'원본 작가', progressAliases:['novel-a-old'] };
    const other = { id:'novel-b', title:'다른 작품', author:'다른 작가' };
    const provider = { id:'provider-a', name:'공급자 A', adapterKey:'fixture', adapter:{ revision:1 } };
    const store = createMetadataStoreService({ storePath });
    const candidate = store.saveCandidate(novel, provider, {
      title:'수집 제목', author:'수집 작가', synopsis:'수집 소개', tags:['수집'], sourceUrl:'https://example.invalid/a'
    }, { matchScore:.98 });
    store.applyCandidate(novel, candidate.id, ['title','author','synopsis','tags']);
    assert.throws(
      () => store.removeCandidate(other, candidate.id),
      error => error && error.code === 'METADATA_CANDIDATE_FORBIDDEN',
      'a candidate must not be deleted through another novel'
    );
    const removed = await store.removeCandidateDurably(novel, candidate.id);
    assert.equal(removed.id, candidate.id);
    assert.equal(store.listCandidatesForNovel(novel, 30).length, 0);
    assert.equal(store.getAppliedForNovel(novel).data.title, '수집 제목', 'deleting a candidate must preserve applied metadata');
    assert.equal(store.getAppliedForNovel(novel).candidateId, '', 'deleted candidates must not leave a dangling applied reference');

    const manual = await store.saveManualMetadataDurably(novel, {
      title:'직접 입력 제목',
      synopsis:'직접 입력 소개',
      genres:['판타지', ' 판타지 '],
      tags:['직접 입력'],
      publicationYear:2026,
      fields:['title','synopsis','genres','tags','publicationYear']
    });
    assert.equal(manual.providerId, 'manual');
    assert.equal(manual.data.title, '직접 입력 제목');
    assert.equal(manual.data.author, '수집 작가', 'blank manual fields must preserve existing metadata');
    assert.deepEqual(manual.data.genres, ['판타지']);
    await store.close();

    const reopened = createMetadataStoreService({ storePath });
    assert.equal(reopened.getAppliedForNovel(novel).data.title, '직접 입력 제목');
    assert.equal(reopened.getAppliedForNovel(novel).providerId, 'manual');
    await reopened.close();

    const routes = fs.readFileSync(path.join(__dirname, '../../server/routes/metadata-routes.js'), 'utf8');
    const api = fs.readFileSync(path.join(__dirname, '../../public/scripts/rebuild/core/api.mjs'), 'utf8');
    const page = fs.readFileSync(path.join(__dirname, '../../public/scripts/rebuild/metadata-page.mjs'), 'utf8');
    const modal = fs.readFileSync(path.join(__dirname, '../../public/scripts/rebuild/features/library-metadata-runtime.mjs'), 'utf8');
    assert.ok(routes.includes("router.put('/novels/:novelId/metadata/manual'"));
    assert.ok(routes.includes("router.delete('/novels/:novelId/metadata/candidates/:candidateId'"));
    assert.ok(api.includes('saveManualNovelMetadata') && api.includes('deleteMetadataCandidate'));
    for (const source of [page, modal]) {
      assert.ok(source.includes("'save-manual'"));
      assert.ok(source.includes("'delete-candidate'"));
    }

    console.log(JSON.stringify({
      pass:'v630-metadata-manual-candidate-delete-smoke-pass',
      manualEditPass:METADATA_MANUAL_EDIT_PASS,
      candidateDeletePass:METADATA_CANDIDATE_DELETE_PASS
    }));
  } finally {
    fs.rmSync(root, { recursive:true, force:true });
  }
}

run().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
