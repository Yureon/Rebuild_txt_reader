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
  'release-verify-current-coverage-v638-smoke.js',
  'login-silent-handshake-v638-smoke.js',
  'service-worker-client-state-bounds-v638-smoke.js',
  'metadata-manual-cover-legacy-v638-smoke.js',
  'metadata-equivalent-candidate-groups-v638-smoke.js',
  'scroll-to-top-v638-smoke.js'
];
for (const file of required) {
  assert(runner.includes(`tools/checks/${file}`), `quick runner missing v638 check: ${file}`);
  assert(verifier.includes(`tools/checks/${file}`), `release verifier missing v638 check: ${file}`);
}
assert(current.CURRENT_REBUILD_VERSION_NUMBER >= 638);
assert.equal(current.CURRENT_REBUILD_VERSION, `rebuild-v${current.CURRENT_REBUILD_VERSION_NUMBER}`);
assert.equal(current.CURRENT_REBUILD_PACKAGE, `txt_reader_v${current.CURRENT_REBUILD_VERSION_NUMBER}.zip`);
assert.equal(current.CURRENT_REBUILD_MANIFEST, `package-manifest-v${current.CURRENT_REBUILD_VERSION_NUMBER}.json`);
assert.equal(current.CURRENT_REBUILD_RELEASE_NOTES, `txt_reader_v${current.CURRENT_REBUILD_VERSION_NUMBER}_change_report.md`);
assert.equal(current.CURRENT_REBUILD_MANIFEST_DIFF, `package-manifest-diff-v${current.CURRENT_REBUILD_VERSION_NUMBER}.md`);
assert(Number(JSON.parse(read('package.json')).version.split('.')[1]) >= 38);
const sw = read('public/sw.js');
const register = read('public/scripts/service-worker-register.js');
assert(sw.includes("const BUILD = 'rebuild-v675'"));
assert(sw.includes('CLIENT_STATE_MAX_RECORDS = 256'));
assert(sw.includes('event.replacesClientId'));
assert(register.includes("WORKER_URL = '/sw-rebuild-v675.js'"));
assert(register.includes("dataset.updateUi === 'silent'"));
assert(read('public/login.html').includes('data-update-ui="silent"'));
assert(read('server/services/metadata-service.js').includes('METADATA_EQUIVALENT_GROUP_PASS'));
assert(/v(?:639-scroll-to-top-overlay|641-scroll-to-top-persistent|645-scroll-to-top-reader-suppression)-pass/.test(read('public/scripts/scroll-to-top.js')));
assert(read('tools/package_rebuild.js').includes('full package inventory comparison by path, byte size, and SHA-256'));
assert(!read('tools/package_rebuild.js').includes('changed-file manifest entries only'));
console.log(JSON.stringify({ pass:'v638-release-verify-current-coverage-pass', required:required.length }));
