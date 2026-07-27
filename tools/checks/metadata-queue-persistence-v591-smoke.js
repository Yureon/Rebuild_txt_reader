#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { atomicWriteJsonAsync } = require('../../server/repositories/json-file-store');
const {
  createMetadataQueueService,
  METADATA_QUEUE_PERSISTENCE_COALESCING_PASS,
  isProgressOnlyPatch
} = require('../../server/services/metadata-queue-service');

const PASS = 'v591-metadata-queue-persistence-smoke-pass';
const MARKER = 'v591-metadata-queue-persistence-coalescing-pass';
assert.strictEqual(METADATA_QUEUE_PERSISTENCE_COALESCING_PASS, MARKER);
assert.strictEqual(isProgressOnlyPatch({ progress:0.5, message:'진행 중' }), true);
assert.strictEqual(isProgressOnlyPatch({ status:'completed' }), false);

async function run() {
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metadata-queue-v591-'));
const storePath = path.join(root, 'queue.json');
let writes = 0;
try {
  const queue = createMetadataQueueService({
    storePath,
    progressPersistDelayMs:5000,
    writeJsonAsync:async (filePath, value) => { writes += 1; return atomicWriteJsonAsync(filePath, value); },
    handler:async () => ({ ok:true })
  });
  const baseWrites = writes;
  const job = queue.enqueue({ type:'collect-bulk', mode:'missing', novel:{ id:'a' } });
  await queue.flush();
  const afterEnqueue = writes;
  assert.strictEqual(afterEnqueue, baseWrites + 1, 'enqueue should persist exactly once');
  for (let index = 0; index < 100; index += 1) {
    queue.update(job, { progress:index / 100, cursor:index, message:`${index}` });
  }
  assert.strictEqual(writes, afterEnqueue, 'progress updates must not rewrite the full queue immediately');
  let status = queue.status();
  assert.strictEqual(status.persistencePass, MARKER);
  assert.strictEqual(status.persistence.pending, true);
  assert.strictEqual(status.persistence.progressUpdates, 100);
  assert(status.persistence.coalescedProgressUpdates >= 99);
  await queue.stop();
  assert.strictEqual(writes, afterEnqueue + 1, 'stop should flush one coalesced progress write');
  status = queue.status();
  assert.strictEqual(status.persistence.pending, false);
  const saved = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  assert.strictEqual(saved.jobs[0].cursor, 99);
  assert.strictEqual(saved.jobs[0].message, '99');
  console.log(JSON.stringify({ pass:PASS, marker:MARKER, writes, persistence:status.persistence }));
} finally {
  fs.rmSync(root, { recursive:true, force:true });
}
}
run().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
