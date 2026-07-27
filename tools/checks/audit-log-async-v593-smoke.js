#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createAuditLogService } = require('../../server/services/audit-log-service');

(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-log-async-v593-'));
  const auditLogPath = path.join(temp, 'audit-log.jsonl');
  const service = createAuditLogService({ auditLogPath, logger:{ error(){} }, maxLogBytes:64 * 1024 });
  const guarded = ['appendFileSync', 'writeFileSync', 'renameSync', 'rmSync', 'statSync'];
  const originals = new Map();
  try {
    for (const name of guarded) {
      originals.set(name, fs[name]);
      fs[name] = () => { throw new Error(`sync audit I/O forbidden: ${name}`); };
    }
    for (let index = 0; index < 120; index += 1) {
      const queued = service.appendEvent('test.async', { target:{ index }, details:{ token:'secret', index } });
      assert.strictEqual(queued.ok, true);
      assert.strictEqual(queued.queued, true);
    }
    for (const [name, fn] of originals) fs[name] = fn;
    const flushed = await service.flush();
    assert.strictEqual(flushed.ok, true);
    assert.strictEqual(flushed.pendingWrites, 0);
    const lines = fs.readFileSync(auditLogPath, 'utf8').trim().split(/\r?\n/u);
    assert.strictEqual(lines.length, 120);
    lines.forEach((line, index) => {
      const event = JSON.parse(line);
      assert.strictEqual(event.target.index, index, 'serialized async writes must preserve event order');
      assert.strictEqual(event.details.token, '[redacted]');
    });
    await service.stop();
    assert.strictEqual(service.appendEvent('after.stop').ok, false, 'audit events must not queue after service stop');

    const source = fs.readFileSync('server/services/audit-log-service.js', 'utf8');
    const app = fs.readFileSync('server/app.js', 'utf8');
    const routes = fs.readFileSync('server/routes/diagnostics-routes.js', 'utf8');
    assert(!source.includes('fs.appendFileSync('));
    assert(source.includes('O_NOFOLLOW') && source.includes('fs.promises.open(auditLogPath') && source.includes('await handle.sync()'));
    assert(app.includes('auditLogService.stop()'));
    assert(routes.includes("typeof auditLogService.flush === 'function') await auditLogService.flush()"));
    console.log(JSON.stringify({ pass:'v593-audit-log-async-smoke-pass', events:lines.length }));
  } finally {
    for (const [name, fn] of originals) fs[name] = fn;
    await service.stop().catch(() => {});
    fs.rmSync(temp, { recursive:true, force:true });
  }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
