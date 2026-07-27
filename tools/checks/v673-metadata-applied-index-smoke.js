#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { performance } = require('perf_hooks');
const {
  createMetadataStoreService,
  normalizeWorkKey,
  METADATA_APPLIED_INCREMENTAL_INDEX_PASS
} = require('../../server/services/metadata-store-service');

function appliedRecord(index, candidateId = '', coverCandidateId = '') {
  const novelId = `novel-${index}`;
  const title = `Applied title ${index}`;
  const author = `Author ${index % 97}`;
  return {
    id:`wm-${index}`,
    novelId,
    aliases:[novelId, `path:/library/${index}.txt`],
    workKey:normalizeWorkKey(title, author),
    providerId:'fixture',
    candidateId,
    sourceUrl:'',
    coverProviderId:coverCandidateId ? 'fixture' : '',
    coverCandidateId,
    coverSourceUrl:'',
    fields:['title','author'],
    data:{ title, author, synopsis:`Synopsis ${index}` },
    createdAt:'2026-01-01T00:00:00.000Z',
    updatedAt:'2026-01-01T00:00:00.000Z'
  };
}

function candidate(id, novelIndex) {
  const novelId = `novel-${novelIndex}`;
  const title = `Applied title ${novelIndex}`;
  const author = `Author ${novelIndex % 97}`;
  return {
    id,
    novelId,
    aliases:[novelId, `path:/library/${novelIndex}.txt`],
    workKey:normalizeWorkKey(title, author),
    providerId:'fixture',
    providerName:'Fixture',
    adapterKey:'fixture',
    adapterRevision:1,
    matchScore:0.99,
    direct:false,
    query:title,
    data:{ title, author, synopsis:`Candidate ${id}`, sourceUrl:`https://example.com/${id}`, remoteId:id },
    contentFingerprint:`fingerprint-${id}`,
    sourceUrl:`https://example.com/${id}`,
    remoteId:id,
    sourceIdentityPairs:[{ remoteId:id, sourceUrl:`https://example.com/${id}` }],
    sourceIdentities:[`remote:${id}`],
    createdAt:'2026-01-01T00:00:00.000Z',
    updatedAt:'2026-01-01T00:00:00.000Z',
    jobId:''
  };
}

function legacyFullRebuild(applied) {
  const aliasIndex = new Map();
  const workKeyIndex = new Map();
  for (const [recordId, record] of Object.entries(applied)) {
    for (const alias of Array.isArray(record.aliases) ? record.aliases : []) aliasIndex.set(String(alias), recordId);
    if (record.workKey) workKeyIndex.set(String(record.workKey), recordId);
  }
  return aliasIndex.size + workKeyIndex.size;
}

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'v673-metadata-applied-index-'));
  try {
    const storePath = path.join(root, 'work-metadata.json');
    const applied = {};
    const fixtureCount = 20_000;
    for (let index = 0; index < fixtureCount; index += 1) applied[`wm-${index}`] = appliedRecord(index);
    applied['wm-0'] = appliedRecord(0, 'candidate-primary', 'candidate-primary');
    applied['wm-1'] = appliedRecord(1, '', 'candidate-cover-only');
    const candidates = {
      'candidate-primary':candidate('candidate-primary', 0),
      'candidate-cover-only':candidate('candidate-cover-only', 1)
    };
    fs.writeFileSync(storePath, JSON.stringify({
      schemaVersion:1,
      revision:1,
      revisions:{ applied:1, candidates:1, settings:0 },
      maintenance:{ candidateCompactionVersion:2 },
      settings:{ providers:{}, providerDefinitions:{} },
      candidates,
      applied
    }));

    const baselineSamples = [];
    for (let index = 0; index < 5; index += 1) {
      const started = performance.now();
      assert(legacyFullRebuild(applied) > fixtureCount);
      baselineSamples.push(performance.now() - started);
    }

    const store = createMetadataStoreService({
      storePath,
      maxCandidates:50_000,
      maxCandidatesPerWork:30,
      compressionLevel:1,
      logger:{ warn(){}, error(){}, info(){} }
    });
    assert.equal(store.appliedIncrementalIndexPass, METADATA_APPLIED_INCREMENTAL_INDEX_PASS);

    const novel = { id:'novel-10000', title:'Applied title 10000', author:`Author ${10000 % 97}`, progressAliases:['novel-10000'] };
    assert.equal(store.getAppliedForNovel(novel)?.id, 'wm-10000');
    const mutationSamples = [];
    for (let index = 0; index < 7; index += 1) {
      const started = performance.now();
      store.saveManualMetadata(novel, { fields:['title','synopsis'], title:`Manual ${index}`, synopsis:`Updated ${index}` });
      mutationSamples.push(performance.now() - started);
      assert.equal(store.getAppliedForNovel(novel)?.data?.title, `Manual ${index}`);
    }

    const baselineAverageMs = baselineSamples.reduce((sum, value) => sum + value, 0) / baselineSamples.length;
    const mutationAverageMs = mutationSamples.reduce((sum, value) => sum + value, 0) / mutationSamples.length;
    assert(mutationAverageMs < 25, `20k applied-record mutation averaged ${mutationAverageMs.toFixed(2)}ms`);
    assert(mutationAverageMs < baselineAverageMs * 0.35, `incremental mutation ${mutationAverageMs.toFixed(2)}ms was not materially below full rebuild ${baselineAverageMs.toFixed(2)}ms`);

    const primaryNovel = { id:'novel-0', title:'Applied title 0', author:'Author 0', progressAliases:['novel-0'] };
    store.removeCandidate(primaryNovel, 'candidate-primary');
    assert.equal(store.getAppliedForNovel(primaryNovel)?.candidateId, '');
    assert.equal(store.getAppliedForNovel(primaryNovel)?.coverCandidateId, '');

    const coverNovel = { id:'novel-1', title:'Applied title 1', author:'Author 1', progressAliases:['novel-1'] };
    store.removeCandidate(coverNovel, 'candidate-cover-only');
    assert.equal(store.getAppliedForNovel(coverNovel)?.coverCandidateId, '');
    assert.equal(store.listCandidatesForNovel(coverNovel).length, 0);

    await store.close();
    console.log(JSON.stringify({
      pass:'v673-metadata-applied-index-pass',
      fixtureAppliedRecords:fixtureCount,
      fullRebuildAverageMs:Number(baselineAverageMs.toFixed(2)),
      incrementalMutationAverageMs:Number(mutationAverageMs.toFixed(3)),
      incrementalMutationMaxMs:Number(Math.max(...mutationSamples).toFixed(3)),
      improvementRatio:Number((baselineAverageMs / mutationAverageMs).toFixed(1)),
      linkedCandidateCleanup:true,
      coverOnlyReferenceIndexed:true
    }));
  } finally {
    fs.rmSync(root, { recursive:true, force:true });
  }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
