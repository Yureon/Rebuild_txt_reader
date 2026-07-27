#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMetadataStoreService } = require('../../server/services/metadata-store-service');
const { createMetadataCoverService } = require('../../server/services/metadata-cover-service');
const { createMetadataService, computeRandomRequestDelayMs, BULK_JOB_TYPE } = require('../../server/services/metadata-service');

function waitFor(check, timeoutMs = 9000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      try {
        const result = check();
        if (result) return resolve(result);
      } catch (error) { return reject(error); }
      if (Date.now() - started > timeoutMs) return reject(new Error('metadata fallback smoke timeout'));
      setTimeout(tick, 20);
    };
    tick();
  });
}

function createDependencies(root, transport) {
  const store = createMetadataStoreService({ storePath:path.join(root, 'metadata.json') });
  const cover = createMetadataCoverService({ coverDir:path.join(root, 'covers'), transport });
  return { store, cover };
}

async function runFallback(root) {
  const fixtureRoot = path.join(__dirname, '../fixtures/metadata/kakaopage-webnovel-v1/r11');
  const fixture = name => fs.readFileSync(path.join(fixtureRoot, name), 'utf8');
  const png = Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0,73,69,78,68]);
  const calls = [];
  let virtualNow = 0;
  const transport = {
    async fetchProvider(provider, url, options = {}) {
      calls.push({ providerId:provider.id, url, kind:options.kind || 'request', at:virtualNow });
      if (provider.id === 'builtin-naver-series') throw new Error('simulated naver failure');
      if (provider.id !== 'builtin-kakaopage') throw new Error(`unexpected fallback provider ${provider.id}`);
      if (options.kind === 'cover') return { body:png, contentType:'image/png', finalUrl:url };
      if (url.includes('/search/series')) return { body:fixture('search-primary.json'), contentType:'application/json', finalUrl:url };
      if (url.includes('/content/overview')) return { body:fixture('detail-overview.json'), contentType:'application/json', finalUrl:url };
      if (url.includes('/content/about')) return { body:fixture('detail-about.json'), contentType:'application/json', finalUrl:url };
      throw new Error(`unexpected URL ${url}`);
    }
  };
  const { store, cover } = createDependencies(path.join(root, 'fallback'), transport);
  store.setProviderSettings('builtin-ssn', { enabled:false });
  const service = createMetadataService({
    store,
    transport,
    coverService:cover,
    queuePath:path.join(root, 'fallback', 'queue.json'),
    bulkDir:path.join(root, 'fallback', 'batches'),
    enabled:true,
    requestIntervalMs:250,
    now:() => virtualNow,
    delay:async ms => { virtualNow += ms; },
    random:() => 0,
    concurrency:1,
    maxJobs:32,
    maxAttempts:1,
    pollMs:20,
    autoApplyThreshold:0.94
  });
  try {
    const novel = { id:'fallback-novel', title:'요리의 신이 강림했다', author:'김촌지', progressAliases:['fallback-novel'] };
    const job = await service.collect(novel, { providerIds:['builtin-naver-series'] }, 'owner');
    const finished = await waitFor(() => {
      const current = service.getJob(job.id);
      return current && ['completed','failed'].includes(current.status) ? current : null;
    });
    assert.equal(finished.status, 'completed', finished.lastError);
    assert.equal(finished.result.providerId, 'builtin-kakaopage');
    assert.equal(finished.result.fallbackUsed, true);
    assert(finished.result.attempts.some(item => item.providerId === 'builtin-naver-series' && item.status === 'failed'));
    assert(finished.result.attempts.some(item => item.providerId === 'builtin-kakaopage' && item.status === 'candidate'));
    assert.deepEqual(Array.from(new Set(calls.map(call => call.providerId))), ['builtin-naver-series','builtin-kakaopage']);
    const metadataRequests = calls.filter(call => call.kind !== 'cover');
    const firstNaver = metadataRequests.find(call => call.providerId === 'builtin-naver-series');
    const firstKakao = metadataRequests.find(call => call.providerId === 'builtin-kakaopage');
    assert(firstNaver && firstKakao, 'fallback must attempt both providers');
    assert.equal(firstKakao.at, firstNaver.at, 'provider A completion cooldown must not delay the first request to provider B');
    const applied = service.getNovelMetadata(novel).applied;
    assert(applied && applied.data.title === novel.title, 'fallback candidate should be applied');
    return calls.length;
  } finally { await service.stop(); }
}

async function runUnlimitedBulk(root) {
  let transportCalls = 0;
  const transport = { async fetchProvider() { transportCalls += 1; throw new Error('cancelled bulk must not reach transport'); } };
  const base = path.join(root, 'bulk');
  const { store, cover } = createDependencies(base, transport);
  const bulkDir = path.join(base, 'batches');
  const service = createMetadataService({
    store,
    transport,
    coverService:cover,
    queuePath:path.join(base, 'queue.json'),
    bulkDir,
    enabled:true,
    requestIntervalMs:250,
    concurrency:1,
    maxJobs:32,
    maxAttempts:1,
    pollMs:10000
  });
  try {
    const novels = Array.from({ length:701 }, (_, index) => ({
      id:`bulk-${index + 1}`,
      title:`대량 작품 ${index + 1}`,
      author:'테스트 작가',
      categoryPath:`테스트/${Math.floor(index / 100)}`,
      progressAliases:[`bulk-${index + 1}`]
    }));
    const result = await service.collectMissing(novels, { providerIds:['builtin-naver-series'] }, 'owner');
    assert.equal(result.count, 701, 'bulk collection must not clamp to 500');
    assert(result.job && result.job.type === BULK_JOB_TYPE);
    assert.equal(service.queueStatus().bulkActive, 1);
    const batches = fs.readdirSync(bulkDir).filter(name => name.endsWith('.jsonl'));
    assert.equal(batches.length, 1, 'one durable batch file must represent the whole collection');
    const batchPath = path.join(bulkDir, batches[0]);
    assert.equal(fs.readFileSync(batchPath, 'utf8').trim().split('\n').length, 701);
    if (process.platform !== 'win32') assert.equal(fs.statSync(batchPath).mode & 0o777, 0o600);
    const duplicate = await service.collectMissing(novels, { providerIds:['builtin-naver-series'] }, 'owner');
    assert.equal(duplicate.reused, true);
    assert.equal(duplicate.job.id, result.job.id);
    await service.cancelJob(result.job.id);
    assert.equal(fs.existsSync(batchPath), false, 'cancelling a queued bulk job must remove its batch file');
    assert.equal(transportCalls, 0);
    return result.count;
  } finally { await service.stop(); }
}

async function run() {
  assert.equal(computeRandomRequestDelayMs(3000, 0), 4500);
  assert.equal(computeRandomRequestDelayMs(3000, 0.999999), 6000);
  assert.equal(computeRandomRequestDelayMs(3000, 0.5), 5250);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metadata-v578-'));
  try {
    const calls = await runFallback(root);
    const bulkCount = await runUnlimitedBulk(root);
    console.log(JSON.stringify({ pass:'v578-metadata-bulk-fallback-smoke-pass', calls, bulkCount, delayRange:[4500,6000], cooldownScope:'same-provider-after-collection' }));
  } finally { fs.rmSync(root, { recursive:true, force:true }); }
}

run().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
