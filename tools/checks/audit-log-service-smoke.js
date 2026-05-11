#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

function read(rel) { return fs.readFileSync(path.join(__dirname, '../..', rel), 'utf8'); }

function runAuditLogServiceSmoke() {
  const serviceSource = read('server/services/audit-log-service.js');
  const app = read('server/app.js');
  const adminRoutes = read('server/routes/admin-users-routes.js');
  const fontRoutes = read('server/routes/font-routes.js');
  const docs = read('docs/multi-user-access-control.md');
  assert.ok(serviceSource.includes('v395-audit-log-service-pass'), 'audit pass marker missing');
  assert.ok(serviceSource.includes('appendEvent'), 'appendEvent missing');
  assert.ok(serviceSource.includes('[redacted]'), 'audit redaction missing');
  assert.ok(app.includes('createAuditLogService') && app.includes('paths.AUDIT_LOG_PATH'), 'app must wire audit service');
  assert.ok(adminRoutes.includes('admin.user.create') && adminRoutes.includes('admin.user.delete') && adminRoutes.includes('admin.user.sessions_revoke'), 'admin audit events missing');
  assert.ok(fontRoutes.includes('font.upload') && fontRoutes.includes('font.delete'), 'font audit events missing');
  assert.ok(docs.includes('v395-audit-log-service-smoke-pass'), 'docs audit marker missing');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-audit-'));
  const { createAuditLogService } = require('../../server/services/audit-log-service');
  const svc = createAuditLogService({ auditLogPath: path.join(tmp, 'audit-log.jsonl'), logger: { error() {} }, now: () => '2026-05-05T00:00:00.000Z' });
  const result = svc.appendEvent('admin.user.password_reset', {
    actor: { kind: 'owner', userId: '__owner__' },
    target: { userId: 'reader-a', username: 'reader-a' },
    details: { password: 'secret-password', token: 'csrf-token', sessionVersion: 3 }
  });
  assert.strictEqual(result.ok, true, 'audit append must succeed');
  const lines = fs.readFileSync(path.join(tmp, 'audit-log.jsonl'), 'utf8').trim().split(/\n+/);
  assert.strictEqual(lines.length, 1, 'audit log must contain one line');
  const event = JSON.parse(lines[0]);
  assert.strictEqual(event.type, 'admin.user.password_reset', 'event type mismatch');
  assert.strictEqual(event.details.password, '[redacted]', 'password must be redacted');
  assert.strictEqual(event.details.token, '[redacted]', 'token must be redacted');
  const status = svc.getStatus();
  assert.strictEqual(status.writable, true, 'audit log dir must be writable');
  return { pass: 'v395-audit-log-service-smoke-pass' };
}

if (require.main === module) console.log(JSON.stringify(runAuditLogServiceSmoke()));
module.exports = { runAuditLogServiceSmoke };
