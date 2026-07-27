#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const current = require('./current-rebuild-version.js');
const runner = read('tools/run_smoke_tests.js');
const verifier = read('tools/release_verify.js');
for (const file of [
  'release-verify-current-coverage-v636-smoke.js',
  'service-worker-update-coordination-v636-smoke.js',
  'metadata-cover-lease-durability-v636-smoke.js'
]) {
  assert(runner.includes(`tools/checks/${file}`), `quick runner missing v636 check: ${file}`);
  assert(verifier.includes(`tools/checks/${file}`), `release verifier missing v636 check: ${file}`);
}
assert(current.CURRENT_REBUILD_VERSION_NUMBER >= 636);
assert.equal(current.CURRENT_REBUILD_VERSION, `rebuild-v${current.CURRENT_REBUILD_VERSION_NUMBER}`);
assert.equal(current.CURRENT_REBUILD_PACKAGE, `txt_reader_v${current.CURRENT_REBUILD_VERSION_NUMBER}.zip`);
assert.equal(current.CURRENT_REBUILD_MANIFEST, `package-manifest-v${current.CURRENT_REBUILD_VERSION_NUMBER}.json`);
assert.equal(current.CURRENT_REBUILD_RELEASE_NOTES, `txt_reader_v${current.CURRENT_REBUILD_VERSION_NUMBER}_change_report.md`);
const packageVersion = JSON.parse(read('package.json')).version.split('.').map(Number);
assert(packageVersion[0] === 6 && packageVersion[1] >= 36);
assert(read('public/sw.js').includes(`const BUILD = '${current.CURRENT_REBUILD_VERSION}'`));
assert(read('public/sw.js').includes('TXT_READER_RELOAD_REQUIRED'));
assert(read('server/app.js').includes('app.get(`/sw-${BUILD_ID}.js`'));
assert(read('public/scripts/service-worker-register.js').includes(`/sw-rebuild-v${current.CURRENT_REBUILD_VERSION_NUMBER}.js`));
assert(read('public/scripts/service-worker-register.js').includes('activationAttempt'));
assert(read('server/services/metadata-cover-service.js').includes('releaseAssetLeaseDurably'));
assert(read('server/services/metadata-cover-service.js').includes(".pending-cover-leases.json"));
console.log(JSON.stringify({ pass:'v636-release-verify-current-coverage-pass', required:3 }));
