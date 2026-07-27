#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const bootstrap = fs.readFileSync('server/bootstrap.js', 'utf8');
const app = fs.readFileSync('server/app.js', 'utf8');
const closeIndex = bootstrap.indexOf('try { await closePromise; }');
const stopIndex = bootstrap.indexOf('await stop();');
assert(closeIndex >= 0 && stopIndex > closeIndex, 'HTTP requests must drain before persistence services stop');
assert(!bootstrap.includes('Promise.all([closePromise, stopPromise])'), 'request drain and service stop must not race');
assert(bootstrap.includes('if (closeError) throw closeError;'));
assert(app.includes('metadataPlaywrightService.stop()'));
assert(app.includes('auditLogService.stop()'));
console.log(JSON.stringify({ pass:'v593-graceful-shutdown-request-drain-smoke-pass' }));
