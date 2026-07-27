#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { performance } = require('perf_hooks');
const { createMetadataStoreService } = require('../../server/services/metadata-store-service');
const adapters = require('../../server/services/metadata-site-adapters');
const { METADATA_LOW_CPU_COLLECTION_PASS } = require('../../server/services/metadata-service');
const { METADATA_PLAYWRIGHT_LOW_CPU_PASS } = require('../../server/services/metadata-playwright-service');

function candidate(index, now) {
  return {
    id:`candidate-${index}`,
    novelId:`novel-${index}`,
    aliases:[`novel:novel-${index}`, `path:/novels/${index}.txt`],
    workKey:`title ${index}\u0000author`,
    providerId:`provider-${index % 6}`,
    providerName:'provider',
    remoteId:`remote-${index}`,
    sourceUrl:`https://example.com/work/${index}`,
    sourceIdentityPairs:[{ remoteId:`remote-${index}`, sourceUrl:`https://example.com/work/${index}` }],
    sourceIdentities:[`remote:remote-${index}`],
    contentFingerprint:`fingerprint-${index}`,
    data:{ title:`Title ${index}`, author:'Author', synopsis:`Synopsis ${index}`, remoteId:`remote-${index}`, sourceUrl:`https://example.com/work/${index}` },
    matchScore:0.9,
    direct:false,
    createdAt:now,
    updatedAt:now
  };
}

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'v672-metadata-cpu-'));
  try {
    const storePath = path.join(root, 'metadata.json');
    const candidates = {};
    const now = new Date().toISOString();
    for (let index = 0; index < 10_000; index += 1) candidates[`candidate-${index}`] = candidate(index, now);
    fs.writeFileSync(storePath, JSON.stringify({
      schemaVersion:1,
      revision:1,
      revisions:{ applied:0, candidates:1, settings:0 },
      maintenance:{ candidateCompactionVersion:2 },
      settings:{ providers:{}, providerDefinitions:{} },
      candidates,
      applied:{}
    }));
    const store = createMetadataStoreService({ storePath, maxCandidates:20_000, logger:{ warn(){}, error(){}, info(){} } });
    assert.equal(store.incrementalIndexPass, 'v672-metadata-incremental-index-pass');
    const samples = [];
    for (let index = 0; index < 5; index += 1) {
      const started = performance.now();
      store.saveCandidate(
        { id:`new-${index}`, title:`New ${index}`, author:'Author', singlePath:`/new-${index}.txt` },
        { id:'provider-1', name:'Provider 1' },
        { title:`New ${index}`, author:'Author', synopsis:'new', remoteId:`new-remote-${index}`, sourceUrl:`https://example.com/new/${index}` },
        { matchScore:0.95 }
      );
      samples.push(performance.now() - started);
    }
    const averageMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    assert(averageMs < 50, `10k-candidate incremental save took ${averageMs.toFixed(1)}ms average`);

    assert.equal(adapters.METADATA_ADAPTER_CPU_GUARD_PASS, 'v672-metadata-adapter-cpu-guard-pass');
    const adapterSource = fs.readFileSync(path.join(process.cwd(), 'server/services/metadata-site-adapters.js'), 'utf8');
    assert(!/queue\.shift\(\)/u.test(adapterSource), 'metadata object traversal must not use Array.shift');
    assert(adapterSource.includes('JSON_DOCUMENT_MAX_TOTAL_BYTES'));

    const serviceSource = fs.readFileSync(path.join(process.cwd(), 'server/services/metadata-service.js'), 'utf8');
    assert(serviceSource.includes('Public/static requests use the lightweight HTTP transport'));
    assert.equal(METADATA_LOW_CPU_COLLECTION_PASS, 'v672-metadata-low-cpu-collection-pass');
    assert.equal(METADATA_PLAYWRIGHT_LOW_CPU_PASS, 'v672-metadata-playwright-low-cpu-pass');
    assert(fs.readFileSync(path.join(process.cwd(), '.env.example'), 'utf8').includes('METADATA_PLAYWRIGHT_COLLECTOR_IDLE_TTL_MS=90000'));

    console.log(JSON.stringify({
      pass:'v672-metadata-cpu-optimization-pass',
      candidates:10_000,
      averageSaveMs:Number(averageMs.toFixed(2)),
      maxSaveMs:Number(Math.max(...samples).toFixed(2)),
      lowCpuCollectionPass:METADATA_LOW_CPU_COLLECTION_PASS,
      playwrightLowCpuPass:METADATA_PLAYWRIGHT_LOW_CPU_PASS
    }));
  } finally {
    fs.rmSync(root, { recursive:true, force:true });
  }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
