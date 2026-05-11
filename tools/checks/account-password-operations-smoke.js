#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { createAccountService, verifyPassword } = require('../../server/services/account-service');
const { createSessionStore } = require('../../server/services/session-store');

const PASS = 'v402-account-password-operations-smoke-pass';

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '../..', rel), 'utf8');
}

function runAccountPasswordOperationsSmoke() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v402-password-'));
  const accountsPath = path.join(root, 'accounts.json');
  const sessionsPath = path.join(root, 'sessions.json');
  const accountService = createAccountService({ accountsPath, logger: { error() {} } });
  accountService.load();
  let created = null;
  accountService.createUser({ username: 'reader-a', password: 'old-password-1', enabled: true, libraryAccess: { mode: 'all', folders: [] } }, (err, user) => {
    assert.ifError(err);
    created = user;
  });
  assert.ok(created && created.sessionVersion === 1, 'created user must start at session version 1');
  const sessionStore = createSessionStore({ storePath: sessionsPath, ttlMs: 60000, logger: { error() {} } });
  sessionStore.load();
  const token = sessionStore.createSession({ kind: 'user', userId: created.id, username: created.username, role: 'reader', sessionVersion: created.sessionVersion });
  let changed = null;
  accountService.changePassword(created.id, 'old-password-1', 'new-password-2', (err, user) => {
    assert.ifError(err);
    changed = user;
  });
  assert.ok(changed && changed.sessionVersion === 2, 'self password change must increment session version');
  assert.ok(changed.lastPasswordChangedAt, 'self password change timestamp must be recorded');
  assert.strictEqual(accountService.isUserSessionCurrent(sessionStore.getSession(token)), false, 'old session version must be stale before session update');
  sessionStore.updateSession(token, { sessionVersion: changed.sessionVersion });
  assert.strictEqual(accountService.isUserSessionCurrent(sessionStore.getSession(token)), true, 'current session can be kept by updating session metadata');
  let tempPayload = null;
  accountService.resetPasswordWithTemporary(created.id, (err, payload) => {
    assert.ifError(err);
    tempPayload = payload;
  });
  assert.ok(tempPayload && tempPayload.temporaryPassword, 'temporary password must be returned once to owner reset caller');
  assert.ok(tempPayload.user.sessionVersion === 3, 'owner reset must increment session version');
  const raw = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));
  const stored = raw.users.find(u => u.id === created.id);
  assert.ok(stored && verifyPassword(tempPayload.temporaryPassword, stored.passwordHash), 'temporary password must match stored scrypt hash');
  assert.ok(stored.lastPasswordResetAt, 'owner reset timestamp must be recorded');

  const authRoutes = read('server/routes/auth-routes.js');
  const adminRoutes = read('server/routes/admin-users-routes.js');
  const adminPage = read('public/admin/users.html') + '\n' + read('public/scripts/admin-users.js');
  const shell = read('public/fragments/app-shell.html');
  const dataTools = read('public/scripts/rebuild/features/settings/data-tools.mjs');
  const api = read('public/scripts/rebuild/core/api.mjs');
  assert.ok(authRoutes.includes("router.post('/account/password'"), 'self password route missing');
  assert.ok(authRoutes.includes('TXT_READER_MULTI_SELF_PASSWORD_CHANGE_PASS'), 'self password route marker missing');
  assert.ok(adminRoutes.includes('generateTemporary'), 'owner temporary password route branch missing');
  assert.ok(adminPage.includes('generate-temp-password-btn'), 'owner console temporary password button missing');
  assert.ok(shell.includes('account-password-change-btn'), 'reader settings password change UI missing');
  assert.ok(dataTools.includes('changeAccountPassword'), 'settings password handler missing');
  assert.ok(api.includes('changeAccountPassword'), 'ApiClient password method missing');
  return { pass: PASS, finalSessionVersion: tempPayload.user.sessionVersion };
}

if (require.main === module) console.log(JSON.stringify(runAccountPasswordOperationsSmoke()));
module.exports = { runAccountPasswordOperationsSmoke };
