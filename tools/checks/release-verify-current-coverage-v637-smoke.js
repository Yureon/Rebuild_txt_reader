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
const required = [
  'release-verify-current-coverage-v637-smoke.js',
  'service-worker-client-state-v637-smoke.js',
  'update-button-idempotency-v637-smoke.js',
  'stale-executable-policy-v637-smoke.js',
  'metadata-manual-cover-v637-smoke.js'
];
for (const file of required) {
  assert(runner.includes(`tools/checks/${file}`), `quick runner missing v637 check: ${file}`);
  assert(verifier.includes(`tools/checks/${file}`), `release verifier missing v637 check: ${file}`);
}
assert(current.CURRENT_REBUILD_VERSION_NUMBER >= 637);
assert.equal(current.CURRENT_REBUILD_VERSION, `rebuild-v${current.CURRENT_REBUILD_VERSION_NUMBER}`);
assert.equal(current.CURRENT_REBUILD_PACKAGE, `txt_reader_v${current.CURRENT_REBUILD_VERSION_NUMBER}.zip`);
assert.equal(current.CURRENT_REBUILD_MANIFEST, `package-manifest-v${current.CURRENT_REBUILD_VERSION_NUMBER}.json`);
assert.equal(current.CURRENT_REBUILD_RELEASE_NOTES, `txt_reader_v${current.CURRENT_REBUILD_VERSION_NUMBER}_change_report.md`);
assert.equal(current.CURRENT_REBUILD_MANIFEST_DIFF, `package-manifest-diff-v${current.CURRENT_REBUILD_VERSION_NUMBER}.md`);
const packageVersion = JSON.parse(read('package.json')).version.split('.').map(Number);
assert(packageVersion[0] === 6 && packageVersion[1] >= 37);
const sw = read('public/sw.js');
assert(sw.includes(`const BUILD = '${current.CURRENT_REBUILD_VERSION}'`));
assert(sw.includes('CLIENT_STATE_CACHE'));
assert(sw.includes('waitForCurrentClientBuild'));
assert(sw.includes("status:'unknown'"));
const register = read('public/scripts/service-worker-register.js');
assert(register.includes(`WORKER_URL = '/sw-rebuild-v${current.CURRENT_REBUILD_VERSION_NUMBER}.js'`));
assert(register.includes('applyAuthorizationInFlight'));
assert(!register.includes("primary.addEventListener('click'"));
const cachePolicy = read('server/middleware/cache-policy.js');
assert(cachePolicy.includes("error:'reload_required'"));
assert(cachePolicy.includes("pathname.startsWith('/workers/')"));
const routes = read('server/routes/metadata-routes.js');
assert(routes.includes('prepareManualMetadataInput'));
assert(routes.includes('getAppliedRecord'));
const cover = read('server/services/metadata-cover-service.js');
assert(cover.includes('verifyAssetAsync'));
assert(cover.includes('canonicalAssetUrl'));
console.log(JSON.stringify({ pass:'v637-release-verify-current-coverage-pass', required:required.length }));
