#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const runner = read('tools/run_smoke_tests.js');
const verifier = read('tools/release_verify.js');
const current = require('./current-rebuild-version.js');
const required = [
  'release-verify-current-coverage-v627-smoke.js',
  'v627-reaudit-fixes-smoke.js',
  'metadata-live-score-competition-v627-smoke.js',
  'fileops-stale-lock-v627-smoke.js'
];
for (const file of required) {
  assert(runner.includes(`tools/checks/${file}`), `quick runner missing v627 check: ${file}`);
  assert(verifier.includes(`tools/checks/${file}`), `release verifier missing v627 check: ${file}`);
}
assert(current.CURRENT_REBUILD_VERSION_NUMBER >= 627);
assert(Number(current.CURRENT_REBUILD_VERSION.replace('rebuild-v','')) >= 627);
assert(current.CURRENT_REBUILD_PACKAGE.startsWith('txt_reader_v'));
assert(current.CURRENT_REBUILD_MANIFEST.startsWith('package-manifest-v'));
assert(Number(JSON.parse(read('package.json')).version.split('.')[1]) >= 27);
const login = read('public/login.html');
assert(login.includes('service-worker-register.js') && login.includes('data-update-ui="silent"'), 'login must load only the silent build handshake runtime');
assert(read('server/services/system-update-permission-service.js').includes('v627-system-update-dual-permission-pass'));
assert(read('server/routes/user-access-routes.js').includes("router.get('/system-update/authorization'"));
assert(read('public/sw.js').includes('TXT_READER_SYSTEM_UPDATE_DENIED'));
assert(read('server/services/metadata-service.js').includes('v627-metadata-score-first-live-competition-pass'));
assert(read('server/services/fileops-service.js').includes('v627-fileops-stable-path-lock-pass'));
assert(read('docs/smoke-tests.md').includes('v627-reaudit-patch-pass'));
console.log(JSON.stringify({ pass:'v627-release-verify-current-coverage-pass', required:required.length }));
