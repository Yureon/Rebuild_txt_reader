#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const express = require('express');

const { createAccountService } = require('../../server/services/account-service');
const { createSignupCodeService, TXT_READER_MULTI_SIGNUP_CODE_PASS } = require('../../server/services/signup-code-service');
const { createAdminUsersRouter } = require('../../server/routes/admin-users-routes');
const { createAuthRouter, TXT_READER_MULTI_REGISTER_ROUTE_PASS } = require('../../server/routes/auth-routes');
const { CURRENT_REBUILD_VERSION_NUMBER } = require('./current-rebuild-version');

const PASS = 'v397-signup-code-register-smoke-pass';

function read(rel) { return fs.readFileSync(path.join(__dirname, '../..', rel), 'utf8'); }
function jsonFetch(url, options = {}) {
  return fetch(url, options).then(async (response) => ({ status: response.status, body: await response.json() }));
}

async function runSignupCodeRegisterSmoke() {
  const auth = read('server/routes/auth-routes.js');
  const admin = read('server/routes/admin-users-routes.js');
  const login = read('public/login.html');
  const loginScript = read('public/scripts/login.js');
  const page = read('public/admin/users.html');
  const adminScript = read('public/scripts/admin-users.js') + '\n' + read('public/scripts/admin/signup-actions.js');
  const middleware = read('server/middleware/auth.js');
  const paths = read('server/config/paths.js');
  assert.ok(middleware.includes("'/api/register'"), 'register endpoint must be public before auth gate');
  assert.ok(auth.includes("router.post('/register'"), 'public register route missing');
  assert.ok(auth.includes('signupCodeService.consumeCodeForRegistration'), 'register route must atomically consume signup code');
  assert.ok(auth.includes('auth.register.success'), 'register success audit missing');
  assert.ok(admin.includes("router.post('/admin/signup-codes'"), 'admin signup code create route missing');
  assert.ok(admin.includes("router.delete('/admin/signup-codes/:codeId'"), 'admin signup code delete route missing');
  assert.ok(login.includes('회원가입') && loginScript.includes("fetch('/api/register'"), 'login page register UI must be wired');
  assert.ok(page.includes(`data-current-build="v${CURRENT_REBUILD_VERSION_NUMBER}"`), 'current Owner console badge missing');
  assert.ok(page.includes('signup-code-form') && adminScript.includes('/api/admin/signup-codes'), 'owner signup code UI missing');
  assert.ok(paths.includes('SIGNUP_CODES_PATH'), 'signup code path missing');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-signup-'));
  const accountsPath = path.join(dir, 'accounts.json');
  const signupCodesPath = path.join(dir, 'signup-codes.json');
  const accountService = createAccountService({ accountsPath, logger: { error() {} } });
  const signupCodeService = createSignupCodeService({ signupCodesPath, logger: { error() {} } });
  accountService.load();
  signupCodeService.load();
  const auditEvents = [];
  const auditLogService = { appendEvent: (type, event) => { auditEvents.push({ type, event }); return { ok: true }; } };
  const ownerSession = { kind: 'owner', userId: '__owner__', role: 'owner' };
  const app = express();
  app.use(express.json());
  app.use('/api', createAdminUsersRouter({
    sessionStore: { getSession: (token) => token === 'owner-token' ? ownerSession : null },
    accountService,
    libraryService: { getLibraryCached: () => [] },
    userStateServiceManager: {},
    setNoStore: (res) => res.set('Cache-Control', 'no-store'),
    requireSameOrigin: (req, res, next) => next(),
    requireCsrf: (req, res, next) => req.get('x-csrf-token') === 'csrf-token' ? next() : res.status(403).json({ error: 'csrf blocked' }),
    auditLogService,
    signupCodeService
  }));
  app.use('/api', createAuthRouter({
    sessionStore: { createSession: () => 'user-token', issueCsrfToken: () => 'user-csrf', validateSession: () => false, deleteSession() {}, deleteCsrfToken() {} },
    loginLimiter: { check: () => true, reset() {} },
    registerLimiter: { check: () => true, reset() {} },
    requireSameOrigin: (req, res, next) => next(),
    requireCsrf: (req, res, next) => next(),
    setNoStore: (res) => res.set('Cache-Control', 'no-store'),
    accountService,
    signupCodeService,
    auditLogService
  }));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const create = await jsonFetch(`${base}/api/admin/signup-codes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: '__Host-session_token=owner-token', 'X-CSRF-Token': 'csrf-token' },
      body: JSON.stringify({ label: 'tester invite', maxUses: 1, libraryAccess: { mode: 'folders', folders: ['판타지/작가A'] } })
    });
    assert.strictEqual(create.status, 201, 'signup code create must return 201');
    assert.strictEqual(create.body.pass, TXT_READER_MULTI_SIGNUP_CODE_PASS, 'signup code pass mismatch');
    assert.ok(create.body.signupCode, 'raw signup code must be returned once on create');
    const stored = JSON.parse(fs.readFileSync(signupCodesPath, 'utf8'));
    assert.ok(stored.codes[0].codeHash && !JSON.stringify(stored).includes(create.body.signupCode), 'raw signup code must not be stored');

    const register = await jsonFetch(`${base}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Reader-Code', password: 'reader-password', passwordConfirm: 'reader-password', signupCode: create.body.signupCode })
    });
    assert.strictEqual(register.status, 201, 'register must return 201');
    assert.strictEqual(register.body.pass, TXT_READER_MULTI_REGISTER_ROUTE_PASS, 'register pass mismatch');
    const user = accountService.findUserById('reader-code');
    assert.ok(user, 'registered user must exist');
    assert.deepStrictEqual(user.libraryAccess, { mode: 'folders', folders: ['판타지/작가A'] }, 'code library access must be applied to registered user');
    assert.ok(accountService.authenticateUser('reader-code', 'reader-password'), 'registered user must be able to authenticate');

    const reuse = await jsonFetch(`${base}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Reader-Reuse', password: 'reader-password', passwordConfirm: 'reader-password', signupCode: create.body.signupCode })
    });
    assert.strictEqual(reuse.status, 400, 'one-time signup code must reject reuse');
    assert.ok(auditEvents.some((event) => event.type === 'admin.signup_code.create'), 'admin signup code create audit missing');
    assert.ok(auditEvents.some((event) => event.type === 'auth.register.success'), 'register success audit missing');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return { pass: PASS };
}

if (require.main === module) runSignupCodeRegisterSmoke().then((r) => console.log(JSON.stringify(r))).catch((err) => { console.error(err); process.exit(1); });
module.exports = { runSignupCodeRegisterSmoke };
