#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const PASS = 'v411-admin-operational-diagnostics-smoke-pass';

function runAdminOperationalDiagnosticsSmoke(root = path.join(__dirname, '..', '..')) {
  const serviceSource = fs.readFileSync(path.join(root, 'server/services/admin-diagnostics-service.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'public/admin/users.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'public/scripts/admin-users.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'public/scripts/admin/ops.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'public/scripts/admin/sections.js'), 'utf8');
  assert.ok(serviceSource.includes('v411-admin-diagnostics-grade-pass'), 'diagnostics grade marker missing');
  assert.ok(serviceSource.includes('v411-admin-diagnostics-remediation-pass'), 'diagnostics remediation marker missing');
  assert.ok(html.includes('admin-diagnostics-output'), 'diagnostics output panel missing');
  assert.ok(js.includes('renderAdminDiagnostics') && js.includes('diagnostics-fix'), 'diagnostics render/fix UI missing');
  assert.ok(js.includes('aria-selected') && js.includes('location.hash'), 'admin tab hash/aria-selected persistence missing');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v411-diagnostics-'));
  const libraryPath = path.join(tmp, 'library');
  fs.mkdirSync(libraryPath, { recursive: true });
  const { createAdminDiagnosticsService } = require(path.join(root, 'server/services/admin-diagnostics-service'));
  const svc = createAdminDiagnosticsService({
    paths: {
      DATA_DIR: path.join(tmp, 'data'),
      ACCOUNTS_PATH: path.join(tmp, 'data', 'accounts.json'),
      SIGNUP_CODES_PATH: path.join(tmp, 'data', 'signup-codes.json'),
      USER_DATA_DIR: path.join(tmp, 'data', 'user-data'),
      FONT_DIR: path.join(tmp, 'data', 'fonts'),
      SESSION_STORE_PATH: path.join(tmp, 'data', 'sessions.json')
    },
    env: { LIBRARY_PATH: libraryPath, DEPLOYMENT_MODE:'trusted-proxy', APP_ORIGIN:'https://reader.example.com', ADMIN_PW:'long-enough-password', REQUIRE_STRICT_ORIGIN:true, HOST:'0.0.0.0', PORT:3000, resolveTrustProxyValue: () => 1 },
    sessionStore: { sessionMeta: new Map([['o', { kind:'owner' }], ['u', { kind:'user' }]]) },
    accountService: { listUsers: () => [{ id:'reader' }] },
    auditLogService: { getStatus: () => ({ ok:true, writable:true }) },
    libraryService: { getLibraryCached: () => [{ id:'n1' }] }
  });
  const req = { protocol:'https', secure:true, get:(name) => ({ host:'reader.example.com', 'x-forwarded-proto':'https', origin:'https://reader.example.com' }[String(name).toLowerCase()] || '') };
  const body = svc.buildDiagnostics(req);
  assert.strictEqual(body.pass, 'v411-admin-diagnostics-grade-pass');
  assert.ok(body.summary && body.summary.grade === 'ok', 'expected ok diagnostics summary');
  assert.ok(Array.isArray(body.findings) && body.findings.length >= 6, 'findings missing');
  assert.ok(Array.isArray(body.checklist) && body.checklist.length === body.findings.length, 'checklist missing');
  assert.ok(body.findings.every(item => item.remediationPass === 'v411-admin-diagnostics-remediation-pass'), 'remediation markers missing');
  return { pass: PASS };
}

if (require.main === module) console.log(JSON.stringify(runAdminOperationalDiagnosticsSmoke()));
module.exports = { PASS, runAdminOperationalDiagnosticsSmoke };
