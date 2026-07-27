#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createBoundedCandidateSelector } = require('../../server/services/metadata-candidate-shard-store');
const { createMetadataStoreService } = require('../../server/services/metadata-store-service');

function candidate(index, workKey = `work-${index}`) {
  return {
    id:`candidate-${index}`,
    novelId:`novel-${index}`,
    aliases:[`novel-${index}`],
    workKey,
    providerId:'test',
    providerName:'Test',
    matchScore:0.9,
    data:{ title:`작품 ${index}`, author:`작가 ${index}`, description:'설명'.repeat(12) },
    createdAt:new Date(1700000000000 + index).toISOString(),
    updatedAt:new Date(1700000000000 + index).toISOString()
  };
}

(async () => {
  const selector = createBoundedCandidateSelector({
    maxCandidates:200,
    maxCandidatesPerWork:7,
    maxCandidateResidentBytes:1024 * 1024,
    protectedIds:new Set(Array.from({length:500}, (_, i) => `candidate-${i}`))
  });
  for (let i = 0; i < 500; i += 1) selector.consider(candidate(i, `work-${Math.floor(i / 20)}`));
  const selected = selector.result();
  assert(selected.hardBounded, 'selector must declare a hard bound');
  assert(selected.retained <= 200, `protected candidates bypassed global cap: ${selected.retained}`);
  assert(selected.logicalBytes <= 1024 * 1024, `protected candidates bypassed byte cap: ${selected.logicalBytes}`);
  const perWork = new Map();
  for (const item of Object.values(selected.candidates)) perWork.set(item.workKey, (perWork.get(item.workKey) || 0) + 1);
  assert(Math.max(...perWork.values()) <= 7, 'protected candidates bypassed per-work cap');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v677-meta-'));
  try {
    const service = createMetadataStoreService({
      storePath:path.join(dir, 'metadata.json'),
      compressedStorePath:path.join(dir, 'metadata.json.gz'),
      appliedStorePath:path.join(dir, 'applied.json.gz'),
      candidateShardDir:path.join(dir, 'candidate-shards'),
      appliedShardDir:path.join(dir, 'applied-shards'),
      maxCandidates:1000,
      maxCandidatesPerWork:10,
      maxCandidateResidentBytes:2 * 1024 * 1024,
      logger:{ warn(){}, error(){} }
    });
    for (let i = 0; i < 1000; i += 1) service.saveCandidate({ id:`novel-${i}`, title:`작품 ${i}`, author:`작가 ${i}` }, { id:'test', name:'Test' }, candidate(i).data, { matchScore:0.9 });
    const nativeSort = Array.prototype.sort;
    let largestSort = 0;
    Array.prototype.sort = function patchedSort(...args) {
      largestSort = Math.max(largestSort, this.length);
      if (this.length > 64) throw new Error(`unexpected full-candidate sort length ${this.length}`);
      return nativeSort.apply(this, args);
    };
    try {
      for (let i = 1000; i < 1060; i += 1) service.saveCandidate({ id:`novel-${i}`, title:`작품 ${i}`, author:`작가 ${i}` }, { id:'test', name:'Test' }, candidate(i).data, { matchScore:0.9 });
    } finally {
      Array.prototype.sort = nativeSort;
    }
    const stats = service.getStorageStats();
    assert.equal(stats.hardResidentBoundPass, 'v677-metadata-hard-resident-bound-pass');
    assert.equal(stats.incrementalEvictionPass, 'v677-metadata-incremental-eviction-pass');
    assert(stats.residentCandidateCount <= 1000, `resident count ${stats.residentCandidateCount}`);
    assert(stats.residentCandidateLogicalBytes <= stats.residentCandidateByteLimit);
    assert(largestSort <= 64, `large sort remained: ${largestSort}`);
    await service.close();
    console.log(JSON.stringify({
      pass:'v677-metadata-hard-cap-incremental-smoke-pass',
      protectedInput:500,
      protectedRetained:selected.retained,
      selectorLogicalBytes:selected.logicalBytes,
      runtimeRetained:stats.residentCandidateCount,
      largestSort
    }));
  } finally {
    fs.rmSync(dir, { recursive:true, force:true });
  }
})().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
