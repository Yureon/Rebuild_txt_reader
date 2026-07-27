#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..', '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
const ops = read('public/scripts/admin/ops.js');
const css = read('public/styles/admin-users.css');
const runSmoke = read('tools/run_smoke_tests.js');
const releaseVerify = read('tools/release_verify.js');
assert.ok(ops.includes('v437-admin-io-diagnostics-table-pass'), 'admin io diagnostics table marker missing');
assert.ok(ops.includes('renderIoDiagnosticsTable'), 'io diagnostics table renderer missing');
assert.ok(ops.includes('d.ioDiagnostics'), 'admin diagnostics renderer must consume ioDiagnostics');
assert.ok(ops.includes('library') && ops.includes('content') && ops.includes('blockManifest'), 'io diagnostics scopes must be rendered');
assert.ok(ops.includes("renderDetailBlock('진단 원본 JSON', d)"), 'raw diagnostics JSON detail must remain available');
assert.ok(css.includes('diagnostics-io-table'), 'io diagnostics table CSS missing');
assert.ok(runSmoke.includes('admin-io-diagnostics-table-smoke.js'), 'run_smoke_tests must include io diagnostics table smoke');
assert.ok(releaseVerify.includes('admin-io-diagnostics-table-smoke.js'), 'release verify must include io diagnostics table smoke');
assert.ok(!ops.includes('session_token') && !ops.includes('inviteCode'), 'io diagnostics UI renderer must not add sensitive token/code fields');
console.log(JSON.stringify({ pass: 'v437-admin-io-diagnostics-table-smoke-pass' }));
