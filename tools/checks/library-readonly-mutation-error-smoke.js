#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..', '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
const service = read('server/services/library-service.js');
assert.ok(service.includes("err.code === 'EROFS'"), 'server fs error handler must detect read-only filesystem errors');
assert.ok(service.includes('READ_ONLY_LIBRARY'), 'server fs error handler must return stable read-only library code');
assert.ok(service.includes('res.status(423)'), 'read-only library mutations should return a non-500 locked status');
const formatter = read('public/scripts/rebuild/features/library-mutation-formatters.mjs');
assert.ok(formatter.includes('EROFS|read-only|READ_ONLY_LIBRARY'), 'client mutation formatter must recognize read-only library errors');
assert.ok(formatter.includes('쓰기 가능(:rw)'), 'client mutation formatter must explain writable volume requirement');
console.log(JSON.stringify({ pass: 'v369-library-readonly-mutation-error-smoke-pass' }));
