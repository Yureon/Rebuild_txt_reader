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
  'release-verify-current-coverage-v625-smoke.js',
  'security-reaudit-v625-smoke.js',
  'metadata-playwright-secure-fast-v625-smoke.js',
  'metadata-performance-v625-smoke.js'
];
for (const file of required) {
  assert(runner.includes(`tools/checks/${file}`), `quick runner missing v625 check: ${file}`);
  assert(verifier.includes(`tools/checks/${file}`), `release verifier missing v625 check: ${file}`);
}
assert(current.CURRENT_REBUILD_VERSION_NUMBER >= 625);
assert(Number(current.CURRENT_REBUILD_VERSION.replace('rebuild-v','')) >= 625);
assert(Number(JSON.parse(read('package.json')).version.split('.')[1]) >= 25);
assert(/v625-metadata-playwright-secure-fast-path-pass|v627-metadata-playwright-pinned-dns-quota-pass/.test(read('server/services/metadata-playwright-service.js')));
assert(read('server/services/metadata-service.js').includes('strong_unique_primary_detail'));
assert(read('server/services/session-store.js').includes('v625-session-store-secret-required-pass'));
assert(read('server/services/fileops-service.js').includes('v625-fileops-commit-boundary-pass'));
assert(read('docs/security.md').includes('v625-security-reaudit-fixes-pass'));
assert(read('docs/web-metadata.md').includes('v625-metadata-adaptive-fast-path-pass'));
console.log(JSON.stringify({ pass:'v625-release-verify-current-coverage-pass', required:required.length }));
