#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createSyncStateService, SYNC_STATE_LIFECYCLE_PASS } = require('../../server/services/sync-state-service');

const PASS = 'v591-sync-state-lifecycle-smoke-pass';
const MARKER = 'v591-sync-state-lifecycle-pass';
assert.strictEqual(SYNC_STATE_LIFECYCLE_PASS, MARKER);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-lifecycle-v591-'));
  const syncPath = path.join(root, 'state.json');
  const snapshotDir = path.join(root, 'snapshots');
  let writes = 0;
  let snapshotWrites = 0;
  const writeJson = (filePath, value, callback) => {
    writes += 1;
    setImmediate(() => {
      if (String(filePath).startsWith(snapshotDir)) {
        snapshotWrites += 1;
        const error = Object.assign(new Error('injected snapshot failure'), { code:'EIO' });
        callback(error);
        return;
      }
      fs.mkdirSync(path.dirname(filePath), { recursive:true });
      fs.writeFileSync(filePath, JSON.stringify(value));
      callback(null);
    });
  };
  const logs = [];
  const service = createSyncStateService({
    syncPath,
    snapshotDir,
    createEmptyState:() => ({ value:0 }),
    normalizeState:value => ({ value:Number(value && value.value) || 0 }),
    writeJson,
    logger:{ error:(...args) => logs.push(args.join(' ')) }
  });
  try {
    service.set({ value:1 });
    service.saveSoon();
    let status = service.getPersistenceStatus();
    assert.strictEqual(status.pass, MARKER);
    assert.strictEqual(status.timers.save, true);
    assert.strictEqual(status.timerRefs.save, false, 'save timer must be unrefed');
    await wait(180);
    status = service.getPersistenceStatus();
    assert.strictEqual(status.timers.snapshot, true);
    assert.strictEqual(status.timerRefs.snapshot, false, 'snapshot timer must be unrefed');
    await wait(1250);
    status = service.getPersistenceStatus();
    assert.strictEqual(snapshotWrites, 1);
    assert.strictEqual(status.lastSnapshotAt, 0, 'failed snapshot must not be marked successful');
    assert.strictEqual(status.snapshotWriteFailures, 1);
    assert(status.lastSnapshotError.includes('injected snapshot failure'));

    service.set({ value:2 });
    service.saveSoon();
    const writesBeforeClose = writes;
    const closeResult = await service.close();
    assert.strictEqual(closeResult, true);
    const writesAfterClose = writes;
    assert(writesAfterClose > writesBeforeClose, 'close must flush final state');
    await wait(200);
    assert.strictEqual(writes, writesAfterClose, 'no delayed save may run after close');
    status = service.getPersistenceStatus();
    assert.strictEqual(status.stopped, true);
    assert.deepStrictEqual(status.timers, { save:false, retry:false, snapshot:false, progressJournalCompact:false });
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(syncPath, 'utf8')), { value:2 });
    console.log(JSON.stringify({ pass:PASS, marker:MARKER, writes, snapshotWrites, logs:logs.length }));
  } finally {
    fs.rmSync(root, { recursive:true, force:true });
  }
})().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
