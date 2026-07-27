#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createContentEntryWorkerPool, CONTENT_ENTRY_WORKER_POOL_PASS, CONTENT_WORKER_QUEUE_BUDGET_PASS, CONTENT_WORKER_IDLE_UNREF_PASS } = require('../../server/services/content-entry-worker-pool');

const PASS = 'v567-content-worker-resource-budget-smoke-pass';

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v567-worker-'));
  const workerScript = path.join(root, 'worker.js');
  fs.writeFileSync(workerScript, `
    const { parentPort } = require('worker_threads');
    parentPort.on('message', message => setTimeout(() => parentPort.postMessage({ id:message.id, ok:true, result:{ value:message.payload.value } }), 60));
  `, 'utf8');
  const pool = createContentEntryWorkerPool({ workerScript, maxWorkers:1, maxQueuedTasks:1, idleWorkerTtlMs:5000 });
  try {
    assert.equal(pool.maxWorkers, 1);
    assert.equal(pool.maxQueuedTasks, 1);
    const first = pool.runTask({ value:1 });
    const second = pool.runTask({ value:2 });
    await assert.rejects(
      () => pool.runTask({ value:3 }),
      error => error && error.code === 'CONTENT_WORKER_QUEUE_FULL' && error.status === 503,
      'third task must be rejected instead of growing an unbounded queue'
    );
    assert.deepEqual(await first, { value:1 });
    assert.deepEqual(await second, { value:2 });
    const status = pool.getStatus();
    assert.equal(status.pass, CONTENT_ENTRY_WORKER_POOL_PASS);
    assert.equal(status.queueBudgetPass, CONTENT_WORKER_QUEUE_BUDGET_PASS);
    assert.equal(status.idleUnrefPass, CONTENT_WORKER_IDLE_UNREF_PASS);
    assert.equal(status.maxWorkers, 1);
    assert.equal(status.maxQueuedTasks, 1);
    assert.equal(status.metrics.rejectedQueueFullTasks, 1);
    return { pass:PASS, maxWorkers:status.maxWorkers, maxQueuedTasks:status.maxQueuedTasks };
  } finally {
    pool.close();
    fs.rmSync(root, { recursive:true, force:true });
  }
}

if (require.main === module) run().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exit(1); });
module.exports = { PASS, run };
