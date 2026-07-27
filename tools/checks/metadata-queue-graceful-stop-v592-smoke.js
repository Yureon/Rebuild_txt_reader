#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  createMetadataQueueService,
  METADATA_QUEUE_GRACEFUL_STOP_PASS,
  METADATA_QUEUE_RESTART_RESUME_PASS
} = require('../../server/services/metadata-queue-service');

const PASS = 'v592-metadata-queue-graceful-stop-smoke-pass';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-metadata-queue-stop-v592-'));
process.on('exit', () => fs.rmSync(tmp, { recursive:true, force:true }));
const waitFor = async (check, timeout = 3000) => {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeout) throw new Error('waitFor timeout');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
};

(async () => {
  assert.strictEqual(METADATA_QUEUE_GRACEFUL_STOP_PASS, 'v592-metadata-queue-graceful-stop-pass');
  const queuePath = path.join(tmp, 'queue.json');
  let cleanupFinished = false;
  const queue = createMetadataQueueService({
    storePath:queuePath,
    pollMs:10,
    maxAttempts:1,
    handler:async (_job, context) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve({ ok:true }), 5000);
      context.signal.addEventListener('abort', () => {
        clearTimeout(timer);
        setTimeout(() => {
          cleanupFinished = true;
          reject(context.signal.reason);
        }, 80);
      }, { once:true });
    })
  });
  const job = queue.enqueue({ type:'collect', novel:{ id:'n1', title:'종료 테스트' } });
  queue.start();
  await waitFor(() => queue.get(job.id)?.status === 'running');

  let resolved = false;
  const stopPromise = queue.stop().then(value => { resolved = true; return value; });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.strictEqual(resolved, false, 'stop must wait for the active handler cleanup path');
  const result = await stopPromise;
  assert.strictEqual(cleanupFinished, true);
  assert.strictEqual(result.pass, METADATA_QUEUE_GRACEFUL_STOP_PASS);
  assert.strictEqual(queue.get(job.id).status, 'queued');
  assert.strictEqual(queue.get(job.id).message, '서버 재시작 후 재개 대기');
  assert.strictEqual(queue.get(job.id).attempts, 0);
  assert.strictEqual(result.pass, METADATA_QUEUE_GRACEFUL_STOP_PASS);
  assert.strictEqual(queue.status().restartResumePass, METADATA_QUEUE_RESTART_RESUME_PASS);
  assert.strictEqual(queue.status().activeRuns, 0);
  const saved = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  assert.strictEqual(saved.jobs[0].status, 'queued', 'restart-resumable state must be durable before stop resolves');
  console.log(JSON.stringify({ pass:PASS, marker:METADATA_QUEUE_GRACEFUL_STOP_PASS }));
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
