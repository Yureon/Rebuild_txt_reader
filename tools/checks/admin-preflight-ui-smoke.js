#!/usr/bin/env node
const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('public/admin/users.html', 'utf8');
const js = fs.readFileSync('public/scripts/admin-users.js', 'utf8') + '\n' + fs.readFileSync('public/scripts/admin/ops.js', 'utf8');
const docs = fs.readFileSync('docs/operations-checklist.md', 'utf8');

assert.ok(html.includes('admin-preflight-btn'), 'preflight button missing');
assert.ok(js.includes('runDeploymentPreflight'), 'preflight function missing');
assert.ok(js.includes('/healthz') && js.includes('/api/time') && js.includes('/api/admin/diagnostics'), 'preflight endpoint wiring missing');
assert.ok(js.includes('v417-admin-preflight-check-pass'), 'preflight marker missing');
assert.ok(docs.includes('v411 배포 전 점검 버튼'), 'operations preflight docs missing');
console.log('v417-admin-preflight-ui-smoke-pass');
