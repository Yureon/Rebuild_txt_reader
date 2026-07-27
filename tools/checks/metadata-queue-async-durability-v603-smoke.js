#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { atomicWriteJsonAsync } = require('../../server/repositories/json-file-store');
const { createMetadataQueueService } = require('../../server/services/metadata-queue-service');

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v603-queue-async-'));
  try {
    const storePath = path.join(root, 'queue.json');
    let shouldFail = false;
    let writes = 0;
    const queue = createMetadataQueueService({
      storePath,
      progressPersistDelayMs:1000,
      writeJsonAsync:async (filePath, value) => {
        writes += 1;
        await new Promise(resolve => setTimeout(resolve, 40));
        if (shouldFail) throw new Error('simulated queue persistence failure');
        return atomicWriteJsonAsync(filePath, value);
      },
      handler:async () => ({ ok:true })
    });
    const started = Date.now();
    const job = queue.enqueue({ type:'collect', novel:{ id:'n1' } }, { deferSchedule:true });
    assert(Date.now() - started < 30, 'enqueue must not block on disk persistence');
    await queue.flush();
    assert.strictEqual(JSON.parse(fs.readFileSync(storePath, 'utf8')).jobs[0].id, job.id);

    shouldFail = true;
    queue.update(job, { status:'cancelled', message:'취소됨' });
    await assert.rejects(() => queue.flush(), /simulated queue persistence failure/);
    assert.strictEqual(queue.status().persistence.dirty, true);
    shouldFail = false;
    await queue.flush();
    assert.strictEqual(JSON.parse(fs.readFileSync(storePath, 'utf8')).jobs[0].status, 'cancelled');
    await queue.stop();
    assert(writes >= 3);
    console.log(JSON.stringify({ pass:'v603-metadata-queue-async-durability-smoke-pass', writes }));
  } finally {
    fs.rmSync(root, { recursive:true, force:true });
  }
}
run().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
