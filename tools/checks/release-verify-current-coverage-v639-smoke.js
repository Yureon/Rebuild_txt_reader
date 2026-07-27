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
  'release-verify-current-coverage-v639-smoke.js',
  'login-public-assets-v639-smoke.js',
  'metadata-equivalent-group-cover-v639-smoke.js',
  'scroll-to-top-overlay-v639-smoke.js'
];
for (const file of required) {
  assert(runner.includes(`tools/checks/${file}`), `quick runner missing v639 check: ${file}`);
  assert(verifier.includes(`tools/checks/${file}`), `release verifier missing v639 check: ${file}`);
}
assert(current.CURRENT_REBUILD_VERSION_NUMBER >= 639);
assert.equal(current.CURRENT_REBUILD_VERSION, 'rebuild-v675');
assert.equal(current.CURRENT_REBUILD_PACKAGE, `txt_reader_v${current.CURRENT_REBUILD_VERSION_NUMBER}.zip`);
assert.equal(current.CURRENT_REBUILD_MANIFEST, `package-manifest-v${current.CURRENT_REBUILD_VERSION_NUMBER}.json`);
assert.equal(current.CURRENT_REBUILD_RELEASE_NOTES, `txt_reader_v${current.CURRENT_REBUILD_VERSION_NUMBER}_change_report.md`);
assert.equal(current.CURRENT_REBUILD_MANIFEST_DIFF, `package-manifest-diff-v${current.CURRENT_REBUILD_VERSION_NUMBER}.md`);
assert.equal(JSON.parse(read('package.json')).version, '6.75.0');
assert(read('server/middleware/auth.js').includes("'/scripts/scroll-to-top.js'") && read('server/middleware/auth.js').includes("'/styles/scroll-to-top.css'"));
const service = read('server/services/metadata-service.js');
const store = read('server/services/metadata-store-service.js');
assert(service.includes('coverRepresentativeId') && service.includes('publicMetadataSourceUrl'));
assert(store.includes('applyCandidateGroupDurably') && store.includes('METADATA_FIELDS_INVALID'));
assert(/v(?:639-scroll-to-top-overlay|641-scroll-to-top-persistent|645-scroll-to-top-reader-suppression)-pass/.test(read('public/scripts/scroll-to-top.js')));
assert(read('public/styles/scroll-to-top.css').includes('scroll-top-overlay-active'));
console.log(JSON.stringify({ pass:'v639-release-verify-current-coverage-pass', required:required.length }));
