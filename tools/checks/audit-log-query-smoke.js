#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

function read(rel) { return fs.readFileSync(path.join(__dirname, '../..', rel), 'utf8'); }

async function runAuditLogQuerySmoke() {
  const serviceSource = read('server/services/audit-log-service.js');
  const routeSource = read('server/routes/diagnostics-routes.js');
  const appSource = read('server/app.js');
  const page = read('public/admin/users.html') + '\n' + read('public/scripts/admin-users.js') + '\n' + read('public/scripts/admin/audit-actions.js');
  const docs = read('docs/multi-user-access-control.md') + '\n' + read('docs/release-history.md');

  assert.ok(serviceSource.includes('v403-audit-log-query-pass'), 'v403 audit query marker missing');
  assert.ok(serviceSource.includes('readEvents') && serviceSource.includes('exportEvents'), 'audit read/export methods missing');
  assert.ok(routeSource.includes("/admin/audit-log") && routeSource.includes("/admin/audit-log/export"), 'audit log routes missing');
  assert.ok(routeSource.includes('requireOwnerSession'), 'audit log routes must be owner-only');
  assert.ok(appSource.includes('auditLogService') && appSource.includes('createDiagnosticsRouter'), 'app must wire audit service into diagnostics router');
  assert.ok(page.includes('audit-log-card') && page.includes('/api/admin/audit-log') && page.includes('admin-audit-log-btn'), 'admin audit log UI missing');
  assert.ok(docs.includes('v403-audit-log-query-smoke-pass'), 'docs must mention audit query smoke marker');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-audit-query-'));
  const { createAuditLogService } = require('../../server/services/audit-log-service');
  let counter = 0;
  const svc = createAuditLogService({ auditLogPath: path.join(tmp, 'audit-log.jsonl'), logger: { error() {} }, now: () => `2026-05-05T00:00:0${counter++}.000Z` });
  svc.appendEvent('admin.user.create', { actor:{ kind:'owner', userId:'__owner__' }, target:{ userId:'u1', username:'reader-a' }, details:{ password:'secret', libraryAccess:{ mode:'all' } } });
  svc.appendEvent('admin.user.update', { actor:{ kind:'owner', userId:'__owner__' }, target:{ userId:'u2', username:'reader-b' }, details:{ enabled:false } });
  svc.appendEvent('font.delete', { actor:{ kind:'owner', userId:'__owner__' }, target:{ filename:'sample.woff2' }, details:{ ok:true } });
  await svc.flush();

  const byType = await svc.readEventsAsync({ eventType:'admin.user.update', limit:10 });
  assert.strictEqual(byType.ok, true, 'audit query must succeed');
  assert.strictEqual(byType.count, 1, 'type filter must return one event');
  assert.strictEqual(byType.events[0].target.userId, 'u2', 'type filter target mismatch');
  const byUser = await svc.readEventsAsync({ userId:'u1', limit:10 });
  assert.strictEqual(byUser.count, 1, 'userId filter must return one event');
  assert.strictEqual(byUser.events[0].details.password, '[redacted]', 'queried audit event must keep redaction');
  const byQuery = await svc.readEventsAsync({ q:'sample.woff2', limit:10 });
  assert.strictEqual(byQuery.count, 1, 'text query must return matching event');
  const exported = await svc.exportEventsAsync({ limit:2 });
  assert.ok(exported.jsonl.split(/\n/).filter(Boolean).length === 2, 'export must include limited JSONL lines');
  return { pass: 'v403-audit-log-query-smoke-pass' };
}

if (require.main === module) runAuditLogQuerySmoke().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.stack || error); process.exitCode = 1; });
module.exports = { runAuditLogQuerySmoke };
