const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '../..', rel), 'utf8');
}

function runAdminUserDeletePolicySmoke() {
  const route = read('server/routes/admin-users-routes.js');
  const account = read('server/services/account-service.js');
  const page = read('public/admin/users.html') + '\n' + read('public/scripts/admin-users.js') + '\n' + read('public/scripts/admin/actions.js');
  const docs = read('docs/multi-user-access-control.md');
  assert.ok(route.includes("router.delete('/admin/users/:userId'"), 'delete endpoint missing');
  assert.ok(route.includes('DELETE:<username>') && route.includes('v393-admin-user-delete-policy-route-pass'), 'delete confirm marker missing');
  assert.ok(account.includes('function deleteUser('), 'account service deleteUser missing');
  assert.ok(page.includes('delete-user-btn') && page.includes('deleteUserAccount'), 'admin UI delete controls missing');
  assert.ok(docs.includes('v393-admin-user-delete-policy-smoke-pass'), 'doc marker missing');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-delete-policy-'));
  const { createAccountService } = require('../../server/services/account-service');
  const svc = createAccountService({ accountsPath: path.join(tmp, 'accounts.json'), logger: { error() {} } });
  svc.load();
  svc.createUser({ username: 'delete-me', password: 'password123', libraryAccess: { mode: 'none', folders: [] } }, (err) => { if (err) throw err; });
  let wrongErr = null;
  svc.deleteUser('delete-me', { confirmText: 'DELETE:wrong' }, (err) => { wrongErr = err; });
  assert.ok(wrongErr && wrongErr.code === 'DELETE_CONFIRM_REQUIRED', 'wrong confirm must be rejected');
  svc.deleteUser('delete-me', { confirmText: 'DELETE:delete-me' }, (err) => { if (err) throw err; });
  assert.strictEqual(svc.findUserById('delete-me'), null, 'user must be deleted');
  return { pass: 'v393-admin-user-delete-policy-smoke-pass' };
}

if (require.main === module) console.log(JSON.stringify(runAdminUserDeletePolicySmoke()));
module.exports = { runAdminUserDeletePolicySmoke };
