#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMetadataStoreService } = require('../../server/services/metadata-store-service');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v675-meta-'));
  const legacyCandidates = {};
  for (let i = 0; i < 1200; i += 1) {
    const id = `candidate-${i}`;
    legacyCandidates[id] = {
      id, novelId:`novel-${i}`, aliases:[`novel-${i}`], workKey:`work-${i}`,
      providerId:'builtin-test', providerName:'Test', matchScore:0.9,
      data:{ title:`고유 작품 ${i}`, author:`작가 ${i}`, remoteId:`remote-${i}`, sourceUrl:`https://example.test/work/${i}` },
      contentFingerprint:`content-${i}`, remoteId:`remote-${i}`, sourceUrl:`https://example.test/work/${i}`,
      createdAt:new Date(1700000000000 + i).toISOString(), updatedAt:new Date(1700000000000 + i).toISOString()
    };
  }
  fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify({
    schemaVersion:1, revision:1, revisions:{applied:0,candidates:1,settings:0},
    maintenance:{candidateCompactionVersion:2}, settings:{providers:{},providerDefinitions:{}},
    candidates:legacyCandidates, applied:{}
  }));
  const service = createMetadataStoreService({
    storePath:path.join(dir, 'metadata.json'),
    compressedStorePath:path.join(dir, 'metadata.json.gz'),
    appliedStorePath:path.join(dir, 'applied.json.gz'),
    candidateShardDir:path.join(dir, 'candidate-shards'),
    appliedShardDir:path.join(dir, 'applied-shards'),
    maxCandidates:1000,
    maxCandidatesPerWork:5,
    logger:{ warn(){}, error(){} }
  });
  const stats = service.getStorageStats();
  assert.equal(stats.compactIndexPass, 'v675-metadata-compact-index-pass');
  assert.equal(stats.startupBoundPass, 'v675-metadata-startup-bound-pass');
  assert(stats.candidateCount <= stats.candidateLimit, `candidate count ${stats.candidateCount} must be bounded by ${stats.candidateLimit}`);
  assert(stats.indexEntries.aliases <= stats.candidateCount * 2);
  assert(stats.indexEntries.workKeys <= stats.candidateCount);
  await service.close();
  fs.rmSync(dir, { recursive:true, force:true });
  console.log(JSON.stringify({ pass:'v675-metadata-compact-index-smoke-pass', input:1200, retained:stats.candidateCount, limit:stats.candidateLimit, indexEntries:stats.indexEntries }));
})().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
