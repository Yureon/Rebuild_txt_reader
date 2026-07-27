#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

async function run() {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'txt-reader-audit-async-v603-'));
  const auditPath = path.join(tmp, 'audit-log.jsonl');
  const { createAuditLogService, sanitizeDetails } = require('../../server/services/audit-log-service');
  const polluted = JSON.parse('{"safe":"ok","__proto__":{"polluted":true},"constructor":"bad","password":"secret"}');
  const sanitized = sanitizeDetails(polluted);
  assert.strictEqual(Object.getPrototypeOf(sanitized), null, 'sanitized audit detail maps must have a null prototype');
  assert.strictEqual(sanitized.safe, 'ok');
  assert.strictEqual(sanitized.password, '[redacted]');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(sanitized, '__proto__'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(sanitized, 'constructor'), false);
  assert.strictEqual({}.polluted, undefined, 'audit sanitation must not pollute Object.prototype');

  const service = createAuditLogService({ auditLogPath:auditPath, logger:{ error() {} } });
  service.appendEvent('audit.async.test', { actor:{ userId:'u1' }, details:polluted });
  await service.flush();

  const original = {
    existsSync:fs.existsSync,
    statSync:fs.statSync,
    openSync:fs.openSync,
    readSync:fs.readSync
  };
  try {
    fs.existsSync = () => { throw new Error('sync exists forbidden'); };
    fs.statSync = () => { throw new Error('sync stat forbidden'); };
    fs.openSync = () => { throw new Error('sync open forbidden'); };
    fs.readSync = () => { throw new Error('sync read forbidden'); };
    const status = await service.getStatusAsync();
    const events = await service.readEventsAsync({ eventType:'audit.async.test', limit:10 });
    const exported = await service.exportEventsAsync({ eventType:'audit.async.test', limit:10 });
    assert.strictEqual(status.ok, true, 'async audit status must succeed without sync filesystem calls');
    assert.strictEqual(events.ok, true);
    assert.strictEqual(events.count, 1);
    assert.strictEqual(events.events[0].details.password, '[redacted]');
    assert.strictEqual(exported.jsonl.split(/\n/).filter(Boolean).length, 1);
  } finally {
    Object.assign(fs, original);
    await service.stop();
    await fs.promises.rm(tmp, { recursive:true, force:true });
  }
  console.log(JSON.stringify({ pass:'v603-audit-log-async-security-pass' }));
}

if (require.main === module) run().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
module.exports = { run };
