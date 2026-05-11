#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

function runAuditLogRetentionSmoke() {
  const source = read('server/services/audit-log-service.js');
  assert.ok(source.includes('readTailText'), 'audit log must use tail reader');
  assert.ok(source.includes('rotateIfNeeded'), 'audit log rotate function missing');
  assert.ok(source.includes('DEFAULT_MAX_AUDIT_LOG_BYTES'), 'audit log max byte default missing');
  assert.ok(source.includes('truncatedTail'), 'audit query must report tail truncation');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-audit-retention-'));
  try {
    const { createAuditLogService } = require(path.join(root, 'server/services/audit-log-service'));
    const auditLogPath = path.join(tmp, 'audit-log.jsonl');
    const svc = createAuditLogService({ auditLogPath, logger: { error() {} }, maxLogBytes: 1024, readWindowBytes: 512 });
    for (let i = 0; i < 900; i += 1) {
      svc.appendEvent('test.event', { target: { userId: `u${i}` }, details: { index: i, payload: 'x'.repeat(60) } });
    }
    const status = svc.getStatus();
    assert.ok(status.sizeBytes <= status.maxLogBytes + 512, 'active audit log should stay near rotation limit');
    assert.ok(status.rotatedExists, 'rotated audit log should exist after limit is exceeded');
    const events = svc.readEvents({ limit: 5 });
    assert.strictEqual(events.ok, true, 'tail audit query should succeed');
    assert.strictEqual(events.count, 5, 'tail audit query must respect limit');
    assert.ok(events.windowBytes <= 64 * 1024, 'tail audit query must respect normalized read window');
    assert.ok(Object.prototype.hasOwnProperty.call(events, 'truncatedTail'), 'tail audit query must report truncation flag');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return { pass: 'v404-audit-log-retention-smoke-pass' };
}

if (require.main === module) console.log(JSON.stringify(runAuditLogRetentionSmoke()));
module.exports = { runAuditLogRetentionSmoke };
