#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const {
  createFileopsService,
  FILEOPS_QUEUE_CONTROL_PASS,
  FILEOPS_DURABLE_JOURNAL_PASS
} = require('../../server/services/fileops-service');
const { createLibraryService } = require('../../server/services/library-service');
const {
  createMetadataQueueService,
  METADATA_QUEUE_DURABLE_ENQUEUE_PASS
} = require('../../server/services/metadata-queue-service');
const {
  createLibraryCleanupService,
  LIBRARY_CLEANUP_PLAN_CACHE_PASS
} = require('../../server/services/library-cleanup-service');
const {
  createAccountService,
  LOGIN_TELEMETRY_ASYNC_PASS
} = require('../../server/services/account-service');
const {
  assertNoHistoricalReleaseArtifacts,
  STALE_RELEASE_ARTIFACT_GATE_PASS
} = require('../package_rebuild');

function fileopsLibraryStub(libraryPath, journal = {}) {
  return {
    libraryPath,
    getLibraryCachedAsync:async () => [],
    getLibraryCachedForRequestAsync:async () => [],
    invalidateLibraryCache() { return { ok:true }; },
    beginLibraryMutation:journal.begin,
    commitLibraryMutation:journal.commit,
    abortLibraryMutation:journal.abort,
    sanitizeNodeName:value => String(value || '').trim(),
    normalizeTxtBaseName:value => String(value || '').trim(),
    safeJoinUnderLibrary:rel => path.join(libraryPath, rel || ''),
    categoryPathToRelDir:value => String(value || ''),
    sendFsError() {},
    clearFileCachePath() {},
    clearAllFileCache() {},
    isSubPath:(parent, child) => path.resolve(child).startsWith(path.resolve(parent) + path.sep),
    getNovelStorageInfo() { throw new Error('unused'); },
    getEpisodeStorageInfo() { throw new Error('unused'); },
    clearNovelCachesByInfo() {}
  };
}

async function testFileopsQueueAndJournal(tmp) {
  const libraryPath = path.join(tmp, 'fileops');
  fs.mkdirSync(path.join(libraryPath, 'A'), { recursive:true });
  const service = createFileopsService({
    libraryService:fileopsLibraryStub(libraryPath),
    mutationQueueMax:1,
    mutationWaitTimeoutMs:1000,
    mutationWatchdogMs:5000,
    logger:{ warn(){} }
  });
  const originalRename = fs.promises.rename;
  let releaseFirst;
  const blocker = new Promise(resolve => { releaseFirst = resolve; });
  let firstSeen = false;
  fs.promises.rename = async (...args) => {
    if (!firstSeen) {
      firstSeen = true;
      await blocker;
    }
    return originalRename(...args);
  };
  try {
    const first = service.renameFolder({ categoryPath:'A', newName:'A1' });
    while (service.getStatus().activeMutations !== 1) await sleep(5);
    const controller = new AbortController();
    const second = service.renameFolder({ categoryPath:'A', newName:'A2', signal:controller.signal });
    while (service.getStatus().waitingMutations !== 1) await sleep(5);
    await assert.rejects(
      service.renameFolder({ categoryPath:'A', newName:'A3' }),
      error => error.code === 'FILEOPS_MUTATION_QUEUE_FULL' && error.statusCode === 503 && error.retryAfterSeconds === 3
    );
    controller.abort();
    await assert.rejects(second, error => error.code === 'FILEOPS_REQUEST_ABORTED' && error.statusCode === 499);
    releaseFirst();
    await first;
    const status = service.getStatus();
    assert.equal(status.queueControlPass, FILEOPS_QUEUE_CONTROL_PASS);
    assert.equal(status.rejectedQueueFull, 1);
    assert.equal(status.rejectedAborted, 1);
    assert.equal(status.activeMutations, 0);
    assert.equal(status.waitingMutations, 0);
  } finally {
    fs.promises.rename = originalRename;
    releaseFirst?.();
  }

  const commitRoot = path.join(tmp, 'commit-fail');
  fs.mkdirSync(path.join(commitRoot, 'B'), { recursive:true });
  const commitService = createFileopsService({
    libraryService:fileopsLibraryStub(commitRoot, {
      begin:() => ({ id:'commit-token' }),
      commit:() => ({ statePersisted:false }),
      abort:() => true
    })
  });
  await assert.rejects(
    commitService.renameFolder({ categoryPath:'B', newName:'B1' }),
    error => error.code === 'LIBRARY_MUTATION_COMMIT_PERSIST_FAILED'
      && error.statusCode === 503
      && error.recoveryRequired === true
      && error.fileOperationApplied === true
      && error.pass === FILEOPS_DURABLE_JOURNAL_PASS
  );
  assert.equal(fs.existsSync(path.join(commitRoot, 'B1')), true);

  const errorRoot = path.join(tmp, 'abort-fail');
  fs.mkdirSync(path.join(errorRoot, 'C'), { recursive:true });
  const abortService = createFileopsService({
    libraryService:fileopsLibraryStub(errorRoot, {
      begin:() => ({ id:'abort-token' }),
      commit:() => ({ statePersisted:true }),
      abort:() => false
    })
  });
  const savedRename = fs.promises.rename;
  fs.promises.rename = async () => { throw Object.assign(new Error('simulated filesystem failure'), { code:'EIO' }); };
  try {
    await assert.rejects(
      abortService.renameFolder({ categoryPath:'C', newName:'C1' }),
      error => error.code === 'LIBRARY_MUTATION_ABORT_PERSIST_FAILED'
        && error.statusCode === 503
        && error.recoveryRequired === true
        && error.fileOperationApplied === false
    );
  } finally {
    fs.promises.rename = savedRename;
  }
}

async function testFsErrorContract(tmp) {
  const libraryPath = path.join(tmp, 'library-error');
  fs.mkdirSync(libraryPath, { recursive:true });
  const service = createLibraryService({ libraryPath, encodeStableId:value => Buffer.from(String(value)).toString('base64url') });
  const response = {
    statusCode:0,
    headers:{},
    body:null,
    status(value) { this.statusCode = value; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    json(value) { this.body = value; return value; }
  };
  service.sendFsError(response, Object.assign(new Error('queue overloaded'), {
    code:'FILEOPS_MUTATION_QUEUE_FULL', statusCode:503, retryAfterSeconds:7, retryable:true
  }));
  assert.equal(response.statusCode, 503);
  assert.equal(response.headers['Retry-After'], '7');
  assert.equal(response.body.error, 'FILEOPS_MUTATION_QUEUE_FULL');
  assert.equal(response.body.retryable, true);
}

async function testMetadataDurableEnqueue(tmp) {
  let resolveWrite;
  let writeStarted = 0;
  const delayedWrite = () => {
    writeStarted += 1;
    return new Promise(resolve => { resolveWrite = resolve; });
  };
  const queue = createMetadataQueueService({
    storePath:path.join(tmp, 'metadata-queue.json'),
    handler:async () => ({}),
    writeJsonSync(file, data) { fs.writeFileSync(file, JSON.stringify(data)); },
    writeJsonAsync:delayedWrite,
    logger:{ error(){} }
  });
  let settled = false;
  const pending = queue.enqueueDurable({ type:'collect', novel:{ id:'novel-1' } }, { deferSchedule:true })
    .then(value => { settled = true; return value; });
  while (!writeStarted) await sleep(5);
  assert.equal(settled, false, 'durable enqueue must not acknowledge before persistence');
  resolveWrite();
  const job = await pending;
  assert.equal(job.status, 'queued');
  assert.equal(queue.durableEnqueuePass, METADATA_QUEUE_DURABLE_ENQUEUE_PASS);

  const failingQueue = createMetadataQueueService({
    storePath:path.join(tmp, 'metadata-queue-fail.json'),
    handler:async () => ({}),
    writeJsonSync(file, data) { fs.writeFileSync(file, JSON.stringify(data)); },
    writeJsonAsync:async () => { throw new Error('simulated persistence failure'); },
    logger:{ error(){} }
  });
  await assert.rejects(
    failingQueue.enqueueDurable({ type:'collect', novel:{ id:'novel-2' } }, { deferSchedule:true }),
    error => error.code === 'METADATA_QUEUE_PERSIST_FAILED'
      && error.statusCode === 503
      && error.retryAfterSeconds === 5
      && error.pass === METADATA_QUEUE_DURABLE_ENQUEUE_PASS
  );
}

async function testCleanupPlanCache(tmp) {
  const libraryPath = path.join(tmp, 'cleanup');
  fs.mkdirSync(libraryPath, { recursive:true });
  fs.writeFileSync(path.join(libraryPath, '테스트작품 1-10.txt'), 'a');
  fs.writeFileSync(path.join(libraryPath, '테스트작품 1-20.txt'), 'b');
  const base = createLibraryService({
    libraryPath,
    encodeStableId:value => Buffer.from(String(value)).toString('base64url')
  });
  const library = base.buildLibrary();
  const cleanup = createLibraryCleanupService({
    planCacheTtlMs:15000,
    preferenceService:{ setRepresentative:async () => ({ ok:true }) },
    libraryService:{
      getLibraryCachedAsync:async () => library,
      safeJoinUnderLibrary:relativePath => path.join(libraryPath, relativePath)
    }
  });
  const [first, joined] = await Promise.all([cleanup.buildPlan(), cleanup.buildPlan()]);
  assert.equal(first.planHash, joined.planHash);
  const cached = await cleanup.buildPlan();
  assert.equal(cached.planHash, first.planHash);
  const status = cleanup.getPlanStatus(first.planHash);
  assert.equal(status.pass, LIBRARY_CLEANUP_PLAN_CACHE_PASS);
  assert.equal(status.planBuilds, 1);
  assert.equal(status.cacheMatches, true);
  assert(status.cacheHits + status.inflightJoins >= 2);
  await assert.rejects(
    cleanup.setRepresentative(first.groups[0].preferenceKey, first.groups[0].canonical.id, 'stale-plan-hash'),
    error => error.code === 'LIBRARY_CLEANUP_PLAN_STALE' && error.statusCode === 409
  );
}

async function testLoginTelemetry(tmp) {
  const accountsPath = path.join(tmp, 'accounts.json');
  fs.writeFileSync(accountsPath, JSON.stringify({ version:1, users:[{
    id:'reader', username:'reader', passwordHash:'not-used', enabled:true,
    sessionVersion:1, accessVersion:1, createdAt:new Date(0).toISOString(), updatedAt:new Date(0).toISOString(),
    libraryAccess:{ mode:'none', folders:[] }, folderMutationAccess:{ moveFolders:[], deleteFolders:[] }, appPermissions:{}
  }] }));
  let syncWrites = 0;
  let telemetryPath = '';
  const service = createAccountService({
    accountsPath,
    writeJsonSync() { syncWrites += 1; },
    writeJsonAsync:async (file) => { telemetryPath = file; await sleep(10); }
  });
  service.load();
  const result = await service.recordSuccessfulLoginAsync('reader');
  await service.flushLoginTelemetry();
  assert.equal(service.loginTelemetryPass, LOGIN_TELEMETRY_ASYNC_PASS);
  assert.equal(syncWrites, 0, 'login telemetry must not rewrite the account document synchronously');
  assert(telemetryPath.endsWith('accounts.json.login-telemetry.json'));
  assert(result.lastLoginAt);
  const route = read('server/routes/auth-routes.js');
  assert(route.includes('recordSuccessfulLoginAsync(user.id).catch'));
  assert.equal(route.includes('await accountService.recordSuccessfulLoginAsync'), false);
}

function testReadDataBatchingAndDocs(tmp) {
  const modal = read('public/scripts/rebuild/features/bookmarks/read-data-modal.mjs');
  assert(modal.includes("READ_DATA_INCREMENTAL_RENDER_PASS = 'v661-read-data-incremental-render-pass'"));
  assert(modal.includes('const READ_DATA_BATCH_SIZE = 80'));
  assert(modal.includes('appendReadDataLoadMore'));
  assert(modal.includes('ontoggle:'));
  const css = read('public/styles/deferred-ui.css');
  assert(css.includes('.rdm-load-more'));

  const appCss = read('public/styles/app.css');
  const shell = read('public/fragments/app-shell.html');
  assert(appCss.includes('data-selector-consolidation-pass="v140"'));
  assert(shell.includes('data-selector-consolidation-pass="v140"'));

  const env = read('.env.example');
  const keys = env.split(/\r?\n/).map(line => line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1]).filter(Boolean);
  assert.equal(new Set(keys).size, keys.length, '.env.example must not contain duplicate variables');
  assert.equal(/(?:변천|버전\s*(?:별|이후|부터)|v\d{3})/u.test(env), false, '.env.example contains release-history prose');
  for (const key of ['FILEOPS_MUTATION_QUEUE_MAX','FILEOPS_MUTATION_WAIT_TIMEOUT_MS','FILEOPS_MUTATION_WATCHDOG_MS']) {
    assert(keys.includes(key), `missing ${key}`);
  }
  for (const marker of [
    'v680-project-status-pass','v680-handoff-pass','v680-next-session-handoff-pass',
    'v676-release-history-pass','v676-smoke-current-pass','v676-audit-resolution-pass'
  ]) {
    assert(read(marker.includes('project-status') ? 'docs/project-status-roadmap.md'
      : marker.includes('next-session') ? 'docs/next-session-handoff-prompt.md'
      : marker.includes('handoff-pass') ? 'docs/handoff.md'
      : marker.includes('release-history') ? 'docs/release-history.md'
      : marker.includes('smoke-current') ? 'docs/smoke-tests.md'
      : 'docs/audit-resolution.md').includes(marker), `missing ${marker}`);
  }

  const packageRoot = path.join(tmp, 'package-gate');
  fs.mkdirSync(packageRoot, { recursive:true });
  fs.writeFileSync(path.join(packageRoot, 'txt_reader_v660_validation.json'), '{}');
  assert.throws(
    () => assertNoHistoricalReleaseArtifacts(packageRoot, 661),
    error => error.code === 'STALE_RELEASE_ARTIFACTS' && error.pass === STALE_RELEASE_ARTIFACT_GATE_PASS
  );
  fs.rmSync(path.join(packageRoot, 'txt_reader_v660_validation.json'));
  fs.writeFileSync(path.join(packageRoot, 'txt_reader_v661_validation.json'), '{}');
  const gate = assertNoHistoricalReleaseArtifacts(packageRoot, 661);
  assert.equal(gate.pass, STALE_RELEASE_ARTIFACT_GATE_PASS);
}

async function run() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v661-audit-'));
  try {
    await testFileopsQueueAndJournal(tmp);
    await testFsErrorContract(tmp);
    await testMetadataDurableEnqueue(tmp);
    await testCleanupPlanCache(tmp);
    await testLoginTelemetry(tmp);
    testReadDataBatchingAndDocs(tmp);
    const fileopsRoutes = read('server/routes/fileops-routes.js');
    for (const type of ['library.folder.rename','library.novel.rename','library.novel.delete','library.novel.move','library.episode.move','library.folder.move','library.episode.rename','library.episode.delete','library.folder.delete']) {
      assert(fileopsRoutes.includes(type), `missing audit event ${type}`);
    }
    assert(fileopsRoutes.includes('req.fileopsSignal'));
    assert(fileopsRoutes.includes("`${descriptor.type}.failed`"));
    const cleanupClient = read('public/scripts/admin/library-cleanup.js');
    assert(cleanupClient.includes('/admin/library-cleanup/status'));
    assert(cleanupClient.includes('planHash:String(plan && plan.planHash'));
    console.log(JSON.stringify({
      pass:'v661-audit-fixes-env-docs-smoke-pass',
      queueControlPass:FILEOPS_QUEUE_CONTROL_PASS,
      durableJournalPass:FILEOPS_DURABLE_JOURNAL_PASS,
      metadataDurablePass:METADATA_QUEUE_DURABLE_ENQUEUE_PASS,
      cleanupCachePass:LIBRARY_CLEANUP_PLAN_CACHE_PASS,
      loginTelemetryPass:LOGIN_TELEMETRY_ASYNC_PASS,
      assertions:73
    }, null, 2));
  } finally {
    fs.rmSync(tmp, { recursive:true, force:true });
  }
}

run().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
