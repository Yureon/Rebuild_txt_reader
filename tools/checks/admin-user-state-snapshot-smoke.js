#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..', '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

async function runAdminUserStateSnapshotSmoke() {
  const route = read('server/routes/admin-users-routes.js');
  const serviceSource = read('server/services/user-state-service.js');
  const page = read('public/admin/users.html') + '\n' + read('public/scripts/admin-users.js') + '\n' + read('public/scripts/admin/state-actions.js');
  const doc = read('docs/multi-user-access-control.md');

  assert.ok(route.includes('/admin/users/:userId/state/snapshots'), 'snapshot list/create endpoint missing');
  assert.ok(route.includes('/admin/users/:userId/state/snapshots/:snapshotId'), 'snapshot download endpoint missing');
  assert.ok(route.includes("confirmText !== 'RESTORE'"), 'restore confirm guard missing');
  assert.ok(route.includes('ownerOnly, requireSameOrigin, requireCsrf'), 'snapshot mutation routes must require owner+origin+csrf');
  assert.ok(route.includes('admin.user.state_snapshot_create'), 'snapshot create audit missing');
  assert.ok(route.includes('admin.user.state_snapshot_download'), 'snapshot download audit missing');
  assert.ok(route.includes('admin.user.state_snapshot_restore'), 'snapshot restore audit missing');
  assert.ok(route.includes('beforeSnapshotId:stateResult'), 'delete reset must report before snapshot');
  assert.ok(serviceSource.includes('createSnapshotForUserId'), 'snapshot create service missing');
  assert.ok(serviceSource.includes('listSnapshotsForUserId'), 'snapshot list service missing');
  assert.ok(serviceSource.includes('restoreSnapshotForUserId'), 'snapshot restore service missing');
  assert.ok(route.includes('before_delete_reset'), 'delete reset snapshot reason missing');
  assert.ok(serviceSource.includes('before_restore'), 'restore must preserve current state first');
  assert.ok(page.includes('create-user-snapshot-btn'), 'admin UI snapshot create button missing');
  assert.ok(page.includes('user-state-snapshot-list'), 'admin UI snapshot list missing');
  assert.ok(page.includes('restoreUserStateSnapshot'), 'admin UI snapshot restore handler missing');
  assert.ok(doc.includes('v401-admin-user-state-snapshot-smoke-pass'), 'doc marker missing');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-state-snap-'));
  const { createUserStateServiceManager } = require(path.join(root, 'server/services/user-state-service'));
  const manager = createUserStateServiceManager({ userDataDir: path.join(tmp, 'user-data'), logger: { error(){} } });
  const before = await manager.createSnapshotForUserId('reader-a', 'manual_test', { source: 'smoke' });
  assert.ok(before.snapshot && before.snapshot.id.endsWith('.json'), 'created snapshot id invalid');
  const reset = await manager.resetStateForUserId('reader-a');
  assert.ok(reset.beforeSnapshot && reset.beforeSnapshot.id, 'reset must create before snapshot');
  const list = await manager.listSnapshotsForUserId('reader-a');
  assert.ok(list.snapshots.length >= 2, 'snapshot list should include manual and before reset snapshots');
  const downloaded = await manager.readSnapshotForUserId('reader-a', before.snapshot.id);
  assert.ok(downloaded.state && downloaded.snapshot.id === before.snapshot.id, 'snapshot download must return state');
  const restored = await manager.restoreSnapshotForUserId('reader-a', before.snapshot.id);
  assert.ok(restored.beforeSnapshot && restored.restoredSnapshot.id === before.snapshot.id, 'restore must create before snapshot and restore selected snapshot');

  const finalList = await manager.listSnapshotsForUserId('reader-a');
  await manager.closeAll();
  return { pass: 'v401-admin-user-state-snapshot-smoke-pass', snapshotCount: finalList.snapshots.length };
}

if (require.main === module) runAdminUserStateSnapshotSmoke().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
module.exports = { runAdminUserStateSnapshotSmoke };
