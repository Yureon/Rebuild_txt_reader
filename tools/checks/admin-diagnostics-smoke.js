#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

function read(rel) { return fs.readFileSync(path.join(__dirname, '../..', rel), 'utf8'); }

async function runAdminDiagnosticsSmoke() {
  const route = read('server/routes/diagnostics-routes.js');
  const serviceSource = read('server/services/admin-diagnostics-service.js');
  const app = read('server/app.js');
  const page = read('public/admin/users.html') + '\n' + read('public/scripts/admin-users.js');
  const docs = read('docs/multi-user-access-control.md');
  assert.ok(route.includes("/admin/diagnostics") && route.includes('requireOwnerSession'), 'owner-only diagnostics route missing');
  assert.ok(serviceSource.includes('v411-admin-diagnostics-grade-pass'), 'diagnostics grade marker missing');
  assert.ok(serviceSource.includes('createAdminDiagnosticsService') && serviceSource.includes('libraryPath'), 'diagnostics service fields missing');
  assert.ok(app.includes('createAdminDiagnosticsService') && app.includes('adminDiagnosticsService'), 'app must wire admin diagnostics service');
  assert.ok(page.includes('admin-diagnostics-btn') && page.includes('/api/admin/diagnostics'), 'admin diagnostics UI missing');
  assert.ok(docs.includes('owner-only diagnostics') || read('docs/security.md').includes('v411 diagnostics security boundary'), 'docs diagnostics marker missing');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-diagnostics-'));
  const paths = {
    DATA_DIR: path.join(tmp, 'data'),
    ACCOUNTS_PATH: path.join(tmp, 'data', 'accounts.json'),
    USER_DATA_DIR: path.join(tmp, 'data', 'user-data'),
    FONT_DIR: path.join(tmp, 'data', 'fonts'),
    SESSION_STORE_PATH: path.join(tmp, 'data', 'sessions.json')
  };
  const libraryPath = path.join(tmp, 'library');
  fs.mkdirSync(libraryPath, { recursive: true });
  const { createAdminDiagnosticsService } = require('../../server/services/admin-diagnostics-service');
  const svc = createAdminDiagnosticsService({
    paths,
    env: { LIBRARY_PATH: libraryPath, DEPLOYMENT_MODE: 'direct', APP_ORIGIN: 'http://127.0.0.1:3000', ADMIN_PW: 'long-enough-password', REQUIRE_STRICT_ORIGIN: false, HOST: '', PORT: 3000, resolveTrustProxyValue: () => false },
    sessionStore: { sessionMeta: new Map([['owner-token', { kind:'owner' }], ['user-token', { kind:'user' }]]) },
    accountService: { listUsers: () => [{ id:'reader-a' }] },
    auditLogService: { getStatus: () => ({ ok:true, writable:true, pass:'v395-audit-log-service-pass' }) },
    libraryService: { getLibraryCached: () => [{ id:'n1' }, { id:'n2' }] }
  });
  const req = { protocol:'http', secure:false, get:(name) => name === 'host' ? '127.0.0.1:3000' : '' };
  const body = await svc.buildDiagnostics(req);
  assert.strictEqual(body.pass, 'v411-admin-diagnostics-grade-pass', 'diagnostics pass mismatch');
  assert.ok(body.summary && body.summary.grade, 'diagnostics summary grade missing');
  assert.ok(Array.isArray(body.findings) && body.findings.length, 'diagnostics findings missing');
  assert.ok(Array.isArray(body.checklist) && body.checklist.length, 'diagnostics checklist missing');
  assert.strictEqual(body.storage.dataDir.ok, true, 'data dir must be writable');
  assert.strictEqual(body.storage.libraryPath.ok, true, 'library path must be readable');
  assert.strictEqual(body.accounts.userCount, 1, 'user count mismatch');
  assert.strictEqual(body.sessions.total, 2, 'session count mismatch');
  assert.strictEqual(body.library.cachedNovelCount, 2, 'library count mismatch');
  return { pass: 'v411-admin-diagnostics-smoke-pass' };
}

if (require.main === module) runAdminDiagnosticsSmoke().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exit(1); });
module.exports = { runAdminDiagnosticsSmoke };
