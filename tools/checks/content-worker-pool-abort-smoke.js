#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PASS = 'v541-content-worker-pool-abort-smoke-pass';
const SERVER_POOL_PASS = 'v541-content-server-worker-pool-pass';
const REQUEST_ABORT_PASS = 'v541-content-request-abort-pass';
const SEARCH_ABORT_PASS = 'v541-search-worker-abort-terminate-pass';

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

async function run(projectRoot = path.resolve(__dirname, '..', '..')) {
  const contentServiceSource = read(projectRoot, 'server/services/content-service.js');
  const poolSource = read(projectRoot, 'server/services/content-entry-worker-pool.js');
  const workerSource = read(projectRoot, 'server/workers/content-entry-worker.js');
  const routesSource = read(projectRoot, 'server/routes/novels-routes.js');
  const envSource = read(projectRoot, 'server/config/env.js');
  const appSource = read(projectRoot, 'server/app.js');
  const envExample = read(projectRoot, '.env.example');
  const matcherSource = read(projectRoot, 'public/scripts/rebuild/features/search/matcher.mjs');

  assert.ok(contentServiceSource.includes(SERVER_POOL_PASS), 'content service must expose worker-pool pass marker');
  assert.ok(contentServiceSource.includes(REQUEST_ABORT_PASS), 'content service must expose request-abort pass marker');
  assert.ok(contentServiceSource.includes('createContentEntryWorkerPool'), 'content service must create the content worker pool');
  assert.ok(contentServiceSource.includes('waitForInflightRecord'), 'content service must attach abort-aware waiters to inflight file builds');
  assert.ok(contentServiceSource.includes('record.waiters === 0') && contentServiceSource.includes('abortController.abort()'), 'inflight file build must abort when all callers are gone');
  assert.ok(poolSource.includes('worker.terminate()'), 'worker pool must terminate running worker on abort');
  assert.ok(workerSource.includes('v541-content-entry-worker-pass'), 'content worker must expose v541 worker marker');
  assert.ok(routesSource.includes('createRequestAbortContext') && routesSource.includes('signal: abortContext.signal'), 'content routes must pass request abort signal');
  assert.ok(envSource.includes('CONTENT_WORKER_THREADS_ENABLED') && envSource.includes('CONTENT_WORKER_POOL_SIZE') && envSource.includes('CONTENT_WORKER_QUEUE_MAX') && envSource.includes('CONTENT_MAIN_THREAD_FALLBACK_MAX_BYTES'), 'env must expose worker-pool controls');
  assert.ok(appSource.includes('workerThreadsEnabled: CONTENT_WORKER_THREADS_ENABLED') && appSource.includes('workerPoolSize: CONTENT_WORKER_POOL_SIZE') && appSource.includes('workerQueueMax: CONTENT_WORKER_QUEUE_MAX') && appSource.includes('mainThreadFallbackMaxBytes: CONTENT_MAIN_THREAD_FALLBACK_MAX_BYTES'), 'app must wire worker-pool env to content service');
  assert.ok(envExample.includes('CONTENT_WORKER_THREADS_ENABLED=1') && envExample.includes('CONTENT_WORKER_POOL_SIZE=0') && envExample.includes('CONTENT_WORKER_QUEUE_MAX=8') && envExample.includes('CONTENT_MAIN_THREAD_FALLBACK_MAX_BYTES=8388608'), '.env.example must document worker-pool controls');
  assert.ok(matcherSource.includes(SEARCH_ABORT_PASS), 'frontend search worker must terminate on abort');

  let dependenciesAvailable = true;
  try {
    require.resolve('iconv-lite', { paths: [projectRoot] });
  } catch (error) {
    dependenciesAvailable = false;
  }
  if (!dependenciesAvailable) {
    return { pass: PASS, staticOnly: true, reason: 'runtime dependencies are not installed' };
  }

  const { createContentService } = require(path.join(projectRoot, 'server/services/content-service.js'));
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-worker-pool-'));
  const chunkIndexDir = path.join(tempRoot, 'chunks');
  const chunkPayloadDir = path.join(tempRoot, 'payloads');
  const libraryRoot = path.join(tempRoot, 'library');
  fs.mkdirSync(chunkIndexDir, { recursive: true });
  fs.mkdirSync(chunkPayloadDir, { recursive: true });
  fs.mkdirSync(libraryRoot, { recursive: true });
  const novelPath = path.join(libraryRoot, 'novel.txt');
  fs.writeFileSync(novelPath, Array.from({ length: 120 }, (_, i) => `제 ${i + 1}화\n본문 ${i + 1}입니다. 다음 문장입니다.`).join('\n\n'), 'utf8');

  let contentService = null;
  try {
    contentService = createContentService({ chunkIndexDir, chunkPayloadDir, chunkSize: 256, workerPoolSize: 2, fileCacheMax: 4, fileCacheMaxBytes: 4 * 1024 * 1024 });
    const aborted = new AbortController();
    aborted.abort();
    await assert.rejects(
      () => contentService.getContentChunkAsync(novelPath, {}, 1, { signal: aborted.signal }),
      (error) => error && error.name === 'AbortError',
      'pre-aborted content request must reject as AbortError'
    );

    const payload = await contentService.getContentChunkAsync(novelPath, {}, 1, { searchScan: true });
    assert.ok(payload && typeof payload.content === 'string' && payload.content.includes('본문'), 'worker-backed content payload must be returned');
    assert.strictEqual(payload.searchScanLoadMitigationPass, 'v537-search-scan-content-load-mitigation-pass', 'search-scan payload write bypass marker must be preserved');
    const status = contentService.getCacheStatus();
    assert.strictEqual(status.contentServerWorkerPoolPass, SERVER_POOL_PASS, 'diagnostics must include server worker-pool marker');
    assert.strictEqual(status.contentRequestAbortPass, REQUEST_ABORT_PASS, 'diagnostics must include request-abort marker');
    assert.ok(status.contentWorkerPool && status.contentWorkerPool.enabled, 'diagnostics must expose enabled worker pool');
    assert.ok(Number(status.metrics.contentWorkerTasksStarted) >= 1, 'worker task counter must increment');
    assert.ok(Number(status.metrics.contentWorkerTasksCompleted) >= 1, 'worker completion counter must increment');

    return { pass: PASS, workerPoolPass: status.contentWorkerPoolPass, workers: status.contentWorkerPool.maxWorkers };
  } finally {
    try { contentService && contentService.closeWorkerPool && contentService.closeWorkerPool(); } catch {}
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

module.exports = { PASS, run };

if (require.main === module) {
  run().then(result => { console.log(JSON.stringify(result)); if (result && result.staticOnly) process.exitCode = 77; }).catch(error => {
    console.error(error && error.stack || error);
    process.exit(1);
  });
}
