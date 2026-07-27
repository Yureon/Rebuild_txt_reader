const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '../..', rel), 'utf8');
}

function runAdminUserSessionRevokeSmoke() {
  const route = read('server/routes/admin-users-routes.js');
  const account = read('server/services/account-service.js');
  const auth = read('server/middleware/auth.js');
  const page = read('public/admin/users.html') + '\n' + read('public/scripts/admin-users.js') + '\n' + read('public/scripts/admin/actions.js');
  const docs = read('docs/multi-user-access-control.md');
  assert.ok(route.includes("/admin/users/:userId/sessions/revoke"), 'session revoke endpoint missing');
  assert.ok(route.includes("confirmText !== 'REVOKE'"), 'session revoke confirm missing');
  assert.ok(route.includes('v394-admin-user-session-revoke-route-pass'), 'session revoke route marker missing');
  assert.ok(account.includes('function revokeUserSessions('), 'account service revokeUserSessions missing');
  assert.ok((/beforeEnabled\s*!==\s*afterEnabled/.test(account) || /beforeEnabled\s*!==\s*nextEnabled/.test(account)) && /sessionVersion\s*=\s*Math\.max/.test(account), 'enabled toggle must bump sessionVersion');
  assert.ok(auth.includes('isUserSessionCurrent(session)'), 'auth gate must validate current user sessions');
  assert.ok(page.includes('세션 강제 만료') && page.includes('revokeUserSessions'), 'admin UI session revoke missing');
  assert.ok(docs.includes('v394-admin-user-session-revoke-smoke-pass'), 'doc marker missing');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-session-revoke-'));
  const { createAccountService } = require('../../server/services/account-service');
  const svc = createAccountService({ accountsPath: path.join(tmp, 'accounts.json'), logger: { error() {} } });
  svc.load();
  svc.createUser({ username: 'session-user', password: 'password123', libraryAccess: { mode: 'all', folders: [] } }, (err) => { if (err) throw err; });
  const first = svc.findUserById('session-user');
  assert.strictEqual(first.sessionVersion, 1, 'initial sessionVersion must be 1');
  svc.revokeUserSessions('session-user', (err) => { if (err) throw err; });
  const revoked = svc.findUserById('session-user');
  assert.strictEqual(revoked.sessionVersion, 2, 'explicit revoke must bump sessionVersion');
  assert.strictEqual(svc.isUserSessionCurrent({ kind: 'user', userId: 'session-user', sessionVersion: 1 }), false, 'old session must be invalid after revoke');
  assert.strictEqual(svc.isUserSessionCurrent({ kind: 'user', userId: 'session-user', sessionVersion: 2 }), true, 'current sessionVersion must be valid');
  svc.updateUser('session-user', { enabled: false }, (err) => { if (err) throw err; });
  const disabled = svc.findUserById('session-user');
  assert.strictEqual(disabled.sessionVersion, 3, 'disable must bump sessionVersion');
  svc.updateUser('session-user', { enabled: true }, (err) => { if (err) throw err; });
  const reenabled = svc.findUserById('session-user');
  assert.strictEqual(reenabled.sessionVersion, 4, 'reenable must bump sessionVersion so old disabled-era sessions cannot revive');
  assert.strictEqual(svc.isUserSessionCurrent({ kind: 'user', userId: 'session-user', sessionVersion: 2 }), false, 'pre-disable session must remain invalid after re-enable');
  return { pass: 'v394-admin-user-session-revoke-smoke-pass' };
}

if (require.main === module) console.log(JSON.stringify(runAdminUserSessionRevokeSmoke()));
module.exports = { runAdminUserSessionRevokeSmoke };
