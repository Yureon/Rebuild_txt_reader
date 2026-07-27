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
  'release-verify-current-coverage-v635-smoke.js',
  'service-worker-update-activation-v635-smoke.js',
  'metadata-cover-update-safety-v635-smoke.js'
]) {
  assert(runner.includes(`tools/checks/${file}`), `quick runner missing v635 check: ${file}`);
  assert(verifier.includes(`tools/checks/${file}`), `release verifier missing v635 check: ${file}`);
}
assert(current.CURRENT_REBUILD_VERSION_NUMBER >= 635);
assert.equal(current.CURRENT_REBUILD_VERSION, `rebuild-v${current.CURRENT_REBUILD_VERSION_NUMBER}`);
assert.equal(current.CURRENT_REBUILD_PACKAGE, `txt_reader_v${current.CURRENT_REBUILD_VERSION_NUMBER}.zip`);
assert.equal(current.CURRENT_REBUILD_MANIFEST, `package-manifest-v${current.CURRENT_REBUILD_VERSION_NUMBER}.json`);
const packageVersion = JSON.parse(read('package.json')).version.split('.').map(Number);
assert(packageVersion[0] === 6 && packageVersion[1] >= 35);
assert(read('public/sw.js').includes(`const BUILD = '${current.CURRENT_REBUILD_VERSION}'`));
assert(read('server/app.js').includes('app.get(`/sw-${BUILD_ID}.js`'));
assert(read('public/scripts/service-worker-register.js').includes(`/sw-rebuild-v${current.CURRENT_REBUILD_VERSION_NUMBER}.js`));
assert(read('public/scripts/service-worker-register.js').includes('waitForInstalledWorker'));
assert(read('server/services/metadata-cover-service.js').includes('leaseAsset'));
assert(read('server/services/metadata-site-adapters.js').includes('novelpiaAdultCoverHidden'));
console.log(JSON.stringify({ pass: 'v635-release-verify-current-coverage-pass', required: 3 }));
