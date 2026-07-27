'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createContentEntryWorkerPool } = require('../../server/services/content-entry-worker-pool');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v606-worker-close-'));
  try {
    const workerScript = path.join(dir, 'worker.js');
    fs.writeFileSync(workerScript, "const { parentPort } = require('worker_threads'); parentPort.on('message', () => { setInterval(() => {}, 1000); });", 'utf8');
    const pool = createContentEntryWorkerPool({ maxWorkers:1, maxQueuedTasks:2, workerScript, idleWorkerTtlMs:60000 });
    const running = pool.runTask({ slow:true });
    const runningRejection = assert.rejects(running, error => error && error.code === 'CONTENT_WORKER_TASK_ABORTED');
    await new Promise(resolve => setTimeout(resolve, 40));
    const closeResult = await pool.close();
    await runningRejection;
    assert.strictEqual(closeResult.closed, true);
    assert.strictEqual(closeResult.workersTerminated, 1);
    assert.strictEqual(closeResult.terminationFailures, 0);
    assert.strictEqual(await pool.close(), closeResult, 'worker-pool close must be idempotent');

    const abortController = new AbortController();
    const abortPool = createContentEntryWorkerPool({ maxWorkers:1, maxQueuedTasks:2, workerScript, idleWorkerTtlMs:60000 });
    const aborted = abortPool.runTask({ slow:true }, { signal:abortController.signal });
    await new Promise(resolve => setTimeout(resolve, 30));
    abortController.abort();
    await assert.rejects(aborted, error => error && error.code === 'CONTENT_WORKER_TASK_ABORTED');
    const queued = abortPool.runTask({ afterAbort:true });
    const queuedRejection = assert.rejects(queued, error => error && error.code === 'CONTENT_WORKER_TASK_ABORTED');
    await new Promise(resolve => setTimeout(resolve, 10));
    const duringTermination = abortPool.getStatus();
    assert.ok(duringTermination.terminatingWorkers <= 1);
    assert.ok(duringTermination.workers + duringTermination.terminatingWorkers <= 1, 'terminating workers must count toward the configured capacity');
    const abortClose = await abortPool.close();
    await queuedRejection;
    assert.strictEqual(abortClose.terminationFailures, 0);

    const appSource = fs.readFileSync(path.join(__dirname, '../../server/app.js'), 'utf8');
    assert.ok(appSource.includes('await contentService.closeWorkerPool(); await contentService.flushChunkIndexWrites();'), 'app shutdown must close worker pool before durable chunk-index flush');
    assert.ok(appSource.includes('settleShutdownOperations(operations)'), 'app shutdown must await every registered close operation');
    assert.ok(appSource.includes("'content-worker-pool'"), 'worker termination must participate in shutdown failure reporting');
    console.log(JSON.stringify({ pass:'v606-content-worker-shutdown-pass', closeResult }));
  } finally {
    fs.rmSync(dir, { recursive:true, force:true });
  }
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });
