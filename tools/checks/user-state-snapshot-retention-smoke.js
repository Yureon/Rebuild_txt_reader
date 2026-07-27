#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

async function runUserStateSnapshotRetentionSmoke() {
  const source = read('server/services/user-state-service.js');
  assert.ok(source.includes('v404-user-state-snapshot-retention-pass'), 'snapshot retention marker missing');
  assert.ok(source.includes('pruneSnapshotsForUserId'), 'snapshot prune function missing');
  assert.ok(source.includes('DEFAULT_MAX_SNAPSHOTS_PER_USER'), 'snapshot count retention default missing');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-state-retention-'));
  let manager = null;
  try {
    const { createUserStateServiceManager } = require(path.join(root, 'server/services/user-state-service'));
    manager = createUserStateServiceManager({ userDataDir: path.join(tmp, 'user-data'), logger: { error() {} }, maxSnapshotsPerUser: 5, maxSnapshotBytesPerUser: 1024 * 1024 });
    const manual = await manager.createSnapshotForUserId('reader-a', 'manual_keep', { source: 'smoke' });
    for (let i = 0; i < 10; i += 1) {
      await manager.createSnapshotForUserId('reader-a', 'before_reset', { index: i });
    }
    const list = await manager.listSnapshotsForUserId('reader-a');
    assert.ok(list.snapshots.length <= 5, 'snapshot retention must cap count');
    assert.strictEqual(list.retention.maxSnapshotsPerUser, 5, 'retention metadata should expose count limit');
    assert.ok(list.snapshots.some((item) => item.id === manual.snapshot.id), 'manual snapshot should be preserved while automatic snapshots are pruned first');
    assert.ok((await manager.pruneSnapshotsForUserId('reader-a')).pass === 'v404-user-state-snapshot-retention-pass', 'manual prune must return retention marker');
  } finally {
    if (manager) await manager.closeAll();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return { pass: 'v404-user-state-snapshot-retention-smoke-pass' };
}

if (require.main === module) runUserStateSnapshotRetentionSmoke().then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.stack||error);process.exitCode=1;});
module.exports = { runUserStateSnapshotRetentionSmoke };
