#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const app = fs.readFileSync(path.join(root, 'server/app.js'), 'utf8');
const bootstrap = fs.readFileSync(path.join(root, 'server/bootstrap.js'), 'utf8');
const PASS = 'v592-graceful-shutdown-smoke-pass';
for (const token of [
  "v592-graceful-shutdown-flush-pass",
  'const closePromise = new Promise',
  'try { await closePromise; } catch (error) { closeError = error; }',
  'await stop()',
  'server.closeIdleConnections?.()',
  'server.closeAllConnections?.()'
]) assert.ok(bootstrap.includes(token), `missing graceful shutdown token: ${token}`);
assert.ok(app.includes('() => metadataService.stop()'), 'app stop must register metadata queue/store shutdown');
assert.ok(app.includes('() => sessionStore.close()'), 'app stop must register session persistence');
assert.ok(app.includes('() => syncStateService.close()'), 'app stop must register sync-state persistence');
assert.ok(app.includes('settleShutdownOperations(operations)'), 'app stop must await registered shutdown operations');
assert.ok(/auditLogService\.stop\(\)/.test(app), 'app stop must await audit-log persistence');
console.log(JSON.stringify({ pass:PASS }));
