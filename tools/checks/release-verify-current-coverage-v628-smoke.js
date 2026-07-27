#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const runner = read('tools/run_smoke_tests.js');
const verifier = read('tools/release_verify.js');
const current = require('./current-rebuild-version');
const required = [
  'release-verify-current-coverage-v628-smoke.js',
  'library-cleanup-real-fixture-v628-smoke.js',
  'library-cleanup-admin-route-v628-smoke.js',
  'smoke-runner-command-timeout-v628-smoke.js'
];
for (const file of required) {
  assert(runner.includes(`tools/checks/${file}`), `quick runner missing v628 check: ${file}`);
  assert(verifier.includes(`tools/checks/${file}`), `release verifier missing v628 check: ${file}`);
}
assert(current.CURRENT_REBUILD_VERSION_NUMBER >= 628);
assert(Number(current.CURRENT_REBUILD_VERSION.replace('rebuild-v', '')) >= 628);
assert(current.CURRENT_REBUILD_PACKAGE.startsWith('txt_reader_v'));
assert(current.CURRENT_REBUILD_MANIFEST.startsWith('package-manifest-v'));
assert(Number(JSON.parse(read('package.json')).version.split('.')[1]) >= 28);
assert(read('server/services/library-variant-service.js').includes('v628-library-variant-range-shape-pass'));
assert(/v(?:628-library-cleanup-script|630-library-cleanup-powershell-script)-pass/u.test(read('server/services/library-cleanup-service.js')));
assert(read('server/routes/admin-users-routes.js').includes('/admin/library-cleanup/script'));
assert(read('public/admin/users.html').includes('data-admin-tab="cleanup"'));
const buildMatch = read('public/sw.js').match(/const BUILD = 'rebuild-v(\d+)'/);
assert(buildMatch && Number(buildMatch[1]) >= 628, 'service worker build must be v628 or newer');
console.log(JSON.stringify({ pass:'v628-release-verify-current-coverage-pass', required:required.length }));
