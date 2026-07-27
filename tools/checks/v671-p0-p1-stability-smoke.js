#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { performance } = require('perf_hooks');
const {
  mergeProgressSnapshotDelta,
  MAX_PROGRESS_POSITIONS,
  PROGRESS_RETENTION_PASS
} = require('../../server/services/state-normalizer-progress');
const {
  createMetadataQueueService,
  METADATA_QUEUE_TRANSACTIONAL_ENQUEUE_PASS,
  METADATA_QUEUE_ASYNC_CHECKPOINT_PASS
} = require('../../server/services/metadata-queue-service');
const {
  parseHtml,
  queryAll,
  CONFIGURABLE_PROVIDER_BUDGET_PASS
} = require('../../server/services/metadata-configurable-provider');
const {
  createMetadataStoreService,
  METADATA_CANDIDATE_SHARD_PASS,
  METADATA_UNION_FIND_COMPACTION_PASS,
  METADATA_CLEANUP_BACKGROUND_PLAN_PASS
} = require('../../server/services/metadata-store-service');
const {
  atomicWriteCompressedJsonAsync,
  loadCompressedJsonWithBackup
} = require('../../server/repositories/compressed-json-file-store');
const { atomicWriteJsonAsync } = require('../../server/repositories/json-file-store');
const {
  createLibraryService,
  LIBRARY_ASYNC_MUTATION_JOURNAL_PASS
} = require('../../server/services/library-service');
const {
  createAuditLogService,
  TXT_READER_MULTI_AUDIT_LOG_BATCH_PASS
} = require('../../server/services/audit-log-service');

const PASS = 'v671-p0-p1-stability-smoke-pass';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const silentLogger = { warn(){}, error(){} };

function tempDir(prefix) { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }
function isoDaysAgo(days) { return new Date(Date.now() - days * 86400000).toISOString(); }

function candidateFixture(index, overrides = {}) {
  const novelId = overrides.novelId || `novel-${index}`;
  const workKey = overrides.workKey || `work-${index}`;
  return {
    id:overrides.id || `candidate-${index}`,
    novelId,
    aliases:overrides.aliases || [novelId],
    workKey,
    providerId:overrides.providerId || 'fixture-provider',
    sourceUrl:`https://example.test/${index}`,
    remoteId:String(index),
    matchScore:0.9,
    direct:false,
    createdAt:overrides.createdAt || isoDaysAgo(60),
    updatedAt:overrides.updatedAt || isoDaysAgo(60),
    data:{ title:overrides.title || `작품 ${index}`, author:'작가', synopsis:overrides.synopsis || `소개 ${index}` }
  };
}

async function testProgressRetention() {
  const positions = {};
  for (let index = 0; index < MAX_PROGRESS_POSITIONS; index += 1) {
    positions[`pos-old-${index}-single`] = { ratio:0.1, ts:index + 1 };
  }
  const merged = mergeProgressSnapshotDelta({ lastRead:null, byNovel:{}, readMeta:{}, positions }, {
    novelId:'new-novel', episodeId:null, chunk:3, totalChunks:10, ratio:0.42, ts:Date.now()
  }, 'new-novel');
  assert(merged, 'progress delta must merge');
  assert.equal(Object.keys(merged.progress.positions).length, MAX_PROGRESS_POSITIONS, 'progress positions must remain bounded');
  assert(merged.progress.positions['pos-new-novel-single'], 'new base locator must be retained');
  assert(Object.prototype.hasOwnProperty.call(merged.progress.positions, 'pos-new-novel-single-3'), 'new chunk locator must be retained');
  return { pass:PROGRESS_RETENTION_PASS, positions:Object.keys(merged.progress.positions).length };
}

async function testTransactionalQueue() {
  const root = tempDir('v671-queue-durable-');
  try {
    const storePath = path.join(root, 'queue.json');
    let executions = 0;
    const queue = createMetadataQueueService({
      storePath,
      logger:silentLogger,
      writeJsonAsync:async () => { throw Object.assign(new Error('injected EIO'), { code:'EIO' }); },
      handler:async () => { executions += 1; return { ok:true }; }
    });
    await assert.rejects(() => queue.enqueueDurable({ type:'collect', novel:{ id:'n1' } }), /injected EIO/);
    await wait(40);
    assert.equal(executions, 0, 'failed durable enqueue must never execute');
    assert.equal(queue.all().length, 0, 'failed durable enqueue must not publish a job');
    const status = queue.status();
    assert.equal(status.transactionalEnqueuePass, METADATA_QUEUE_TRANSACTIONAL_ENQUEUE_PASS);
    return { pass:METADATA_QUEUE_TRANSACTIONAL_ENQUEUE_PASS, executions };
  } finally { fs.rmSync(root, { recursive:true, force:true }); }
}

async function testQueueCheckpointCoalescing() {
  const root = tempDir('v671-queue-checkpoint-');
  try {
    const storePath = path.join(root, 'queue.json');
    const jobs = Array.from({ length:2000 }, (_, index) => ({
      id:`job-${index}`, type:'collect', status:'queued', progress:0, message:'대기', attempts:0,
      cancelRequested:false, createdAt:new Date(index).toISOString(), updatedAt:new Date(index).toISOString(),
      novel:{ id:`n-${index}` }, requesters:[], dedupeKey:`key-${index}`
    }));
    fs.writeFileSync(storePath, JSON.stringify({ schemaVersion:1, jobs }));
    let writes = 0;
    const queue = createMetadataQueueService({
      storePath,
      logger:silentLogger,
      writeJsonAsync:async (filePath, value) => { writes += 1; await wait(15); return atomicWriteJsonAsync(filePath, value); },
      handler:async () => ({ ok:true })
    });
    const first = queue.all()[0];
    const started = performance.now();
    for (let index = 0; index < 50; index += 1) queue.update(first, { status:index % 2 ? 'queued' : 'cancelled', message:`m${index}` });
    const callMs = performance.now() - started;
    await queue.flush();
    const persistence = queue.status().persistence;
    assert(callMs < 50, `queue updates blocked for ${callMs.toFixed(1)}ms`);
    assert(persistence.coalescedCheckpointUpdates > 0, 'checkpoint updates must coalesce');
    assert(writes <= 3, `expected bounded checkpoints, got ${writes}`);
    await queue.stop();
    return { pass:METADATA_QUEUE_ASYNC_CHECKPOINT_PASS, writes, callMs:Number(callMs.toFixed(1)) };
  } finally { fs.rmSync(root, { recursive:true, force:true }); }
}

async function testSelectorBudgets() {
  const html = '<div>'.repeat(700) + '<span class="target">x</span>' + '</div>'.repeat(700);
  const started = performance.now();
  assert.throws(() => parseHtml(html), error => error && error.code === 'METADATA_SELECTOR_DEPTH_LIMIT');
  const elapsedMs = performance.now() - started;
  const root = parseHtml('<main>' + '<section><span class="target">x</span></section>'.repeat(1000) + '</main>');
  assert.equal(queryAll(root, 'main section .target').length, 1000);
  assert(elapsedMs < 250, `depth rejection took ${elapsedMs.toFixed(1)}ms`);
  return { pass:CONFIGURABLE_PROVIDER_BUDGET_PASS, elapsedMs:Number(elapsedMs.toFixed(1)) };
}

async function testCandidateShardsAndCleanup() {
  const root = tempDir('v671-meta-shards-');
  try {
    const storePath = path.join(root, 'metadata.json');
    const candidates = {};
    for (let index = 0; index < 3000; index += 1) candidates[`candidate-${index}`] = candidateFixture(index);
    fs.writeFileSync(storePath, JSON.stringify({
      schemaVersion:1, revision:1, revisions:{ applied:0, candidates:1, settings:0 },
      maintenance:{ candidateCompactionVersion:2 }, settings:{ providers:{}, providerDefinitions:{} }, candidates, applied:{}
    }));
    let writes = 0;
    const writeCompressed = async (...args) => { writes += 1; return atomicWriteCompressedJsonAsync(...args); };
    let store = createMetadataStoreService({ storePath, writeCompressed, logger:silentLogger, maxCandidates:10000 });
    await store.flush();
    assert.equal(store.getStorageStats().candidateCount, 3000);
    assert.equal(store.candidateShardPass, METADATA_CANDIDATE_SHARD_PASS);
    const main = loadCompressedJsonWithBackup(`${storePath}.gz`, null);
    assert(main.ok && Object.keys(main.data.candidates || {}).length === 0, 'main metadata checkpoint must not contain candidate payloads');
    assert.equal(main.data.candidateShards.shardCount, 32);
    writes = 0;
    store.updateCandidateCover('candidate-10', { assetId:'a'.repeat(64), url:'/api/metadata/covers/' + 'a'.repeat(64), mime:'image/png' });
    await store.flush();
    assert(writes <= 2, `single candidate mutation rewrote ${writes} files`);

    let pulses = 0;
    const pulse = setInterval(() => { pulses += 1; }, 0);
    const plan = await store.buildCandidateCleanupPlanAsync({ olderThanDays:1, orphanOlderThanDays:1, keepPerWork:0, keepPerProvider:0 }, { activeNovelIds:[] });
    clearInterval(pulse);
    assert.equal(plan.backgroundPlanPass, METADATA_CLEANUP_BACKGROUND_PLAN_PASS);
    assert(plan.removeCount > 0);
    assert(plan.sample.length <= 50);
    assert(!Object.prototype.hasOwnProperty.call(plan, 'removals'), 'large cleanup plans must not materialize full removal objects');
    assert(pulses > 0, 'cleanup planning must yield to the event loop');
    await store.close();

    store = createMetadataStoreService({ storePath, logger:silentLogger, maxCandidates:10000 });
    assert.equal(store.getStorageStats().candidateCount, 3000, 'candidate shards must restore all candidates');
    await store.close();
    return { pass:METADATA_CANDIDATE_SHARD_PASS, candidates:3000, writes, cleanup:plan.removeCount, pulses };
  } finally { fs.rmSync(root, { recursive:true, force:true }); }
}

async function testUnionFindCompaction() {
  const root = tempDir('v671-meta-compact-');
  try {
    const storePath = path.join(root, 'metadata.json');
    const candidates = {};
    for (let index = 0; index < 1500; index += 1) {
      candidates[`c-${index}`] = candidateFixture(index, {
        id:`c-${index}`,
        novelId:'',
        workKey:'',
        aliases:[`chain-${index}`, `chain-${index + 1}`],
        synopsis:'same content',
        title:'same title',
        providerId:'same-provider'
      });
    }
    fs.writeFileSync(storePath, JSON.stringify({
      schemaVersion:1, revision:1, revisions:{ applied:0, candidates:1, settings:0 },
      maintenance:{ candidateCompactionVersion:0 }, settings:{ providers:{}, providerDefinitions:{} }, candidates, applied:{}
    }));
    const started = performance.now();
    const store = createMetadataStoreService({ storePath, logger:silentLogger, maxCandidates:5000 });
    const elapsedMs = performance.now() - started;
    assert.equal(store.unionFindCompactionPass, METADATA_UNION_FIND_COMPACTION_PASS);
    assert.equal(store.getStorageStats().candidateCount, 1, 'chain-overlap candidates must compact to one component');
    assert(elapsedMs < 1500, `union-find compaction took ${elapsedMs.toFixed(1)}ms`);
    await store.close();
    return { pass:METADATA_UNION_FIND_COMPACTION_PASS, elapsedMs:Number(elapsedMs.toFixed(1)) };
  } finally { fs.rmSync(root, { recursive:true, force:true }); }
}

async function testWorkerUnavailableFailClosed() {
  const root = tempDir('v671-content-worker-');
  try {
    const filePath = path.join(root, 'large.txt');
    fs.writeFileSync(filePath, '가'.repeat(4096), 'utf8');
    const Module = require('module');
    const originalLoad = Module._load;
    Module._load = function(request, parent, isMain) {
      if (request === 'iconv-lite') return {
        encodingExists:() => true,
        decode:buffer => Buffer.from(buffer).toString('utf8')
      };
      return originalLoad.call(this, request, parent, isMain);
    };
    let createContentService;
    let failClosedPass;
    try {
      ({ createContentService, CONTENT_WORKER_UNAVAILABLE_FAIL_CLOSED_PASS:failClosedPass } = require('../../server/services/content-service'));
    } finally {
      Module._load = originalLoad;
    }
    const service = createContentService({
      chunkIndexDir:path.join(root, 'indexes'),
      workerThreadsEnabled:false,
      mainThreadFallbackMaxBytes:128,
      diskCacheMinBytes:1024 * 1024
    });
    await assert.rejects(() => service.getCachedFileEntryAsync(filePath, {}), error =>
      error && error.statusCode === 503 && error.pass === failClosedPass);
    await service.stop?.();
    return { pass:failClosedPass };
  } finally { fs.rmSync(root, { recursive:true, force:true }); }
}

async function testAsyncLibraryJournal() {
  const root = tempDir('v671-library-journal-');
  try {
    const libraryPath = path.join(root, 'library');
    const cachePath = path.join(root, 'data', 'catalog.json.gz');
    fs.mkdirSync(libraryPath, { recursive:true });
    fs.writeFileSync(path.join(libraryPath, 'A.txt'), 'A');
    let writes = 0;
    const service = createLibraryService({
      libraryPath,
      encodeStableId:value => Buffer.from(String(value)).toString('base64url'),
      catalogCachePath:cachePath,
      writeMutationStateAsync:async (filePath, value) => { writes += 1; await wait(30); return atomicWriteJsonAsync(filePath, value); }
    });
    service.getLibraryCached();
    let pulse = false;
    setTimeout(() => { pulse = true; }, 0);
    const beginPromise = service.beginLibraryMutation({ reason:'fixture', paths:['A.txt'] });
    assert(beginPromise && typeof beginPromise.then === 'function', 'journal begin must be asynchronous');
    const token = await beginPromise;
    assert(pulse, 'async journal must not block timers during fsync');
    const committed = await service.commitLibraryMutation(token);
    assert.equal(committed.asyncJournalPass, LIBRARY_ASYNC_MUTATION_JOURNAL_PASS);
    assert.equal(committed.statePersisted, true);
    assert(writes >= 2);
    await service.closeDurableCatalogCache();
    return { pass:LIBRARY_ASYNC_MUTATION_JOURNAL_PASS, writes };
  } finally { fs.rmSync(root, { recursive:true, force:true }); }
}

async function testBoundedAuditBatch() {
  const root = tempDir('v671-audit-batch-');
  try {
    const filePath = path.join(root, 'audit.jsonl');
    const service = createAuditLogService({
      auditLogPath:filePath,
      logger:silentLogger,
      queueMax:64,
      batchMax:16,
      batchDelayMs:1000,
      fsyncIntervalMs:1000
    });
    const results = [];
    for (let index = 0; index < 100; index += 1) results.push(service.appendEvent('telemetry.fixture', { details:{ index } }));
    const strict = service.appendEvent('library.novel.delete', { details:{ novelId:'n1' } });
    assert(strict.queued && strict.strict, 'strict audit event must displace non-strict telemetry when bounded queue is full');
    await service.flush();
    const status = service.getStatus();
    assert.equal(status.batchPass, TXT_READER_MULTI_AUDIT_LOG_BATCH_PASS);
    assert(status.queueMetrics.maxPending <= 64);
    assert(status.queueMetrics.rejected > 0 || status.queueMetrics.evicted > 0);
    assert(status.queueMetrics.batches < status.queueMetrics.written, 'audit events must be batch-written');
    assert.equal(status.pendingWrites, 0);
    await service.stop();
    return { pass:TXT_READER_MULTI_AUDIT_LOG_BATCH_PASS, ...status.queueMetrics };
  } finally { fs.rmSync(root, { recursive:true, force:true }); }
}

async function run() {
  const results = {};
  results.progress = await testProgressRetention();
  results.transactionalQueue = await testTransactionalQueue();
  results.queueCheckpoint = await testQueueCheckpointCoalescing();
  results.selectorBudget = await testSelectorBudgets();
  results.candidateShards = await testCandidateShardsAndCleanup();
  results.compaction = await testUnionFindCompaction();
  results.workerFailClosed = await testWorkerUnavailableFailClosed();
  results.libraryJournal = await testAsyncLibraryJournal();
  results.auditBatch = await testBoundedAuditBatch();
  return { pass:PASS, assertions:10, results };
}

if (require.main === module) run().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
module.exports = { PASS, run };
