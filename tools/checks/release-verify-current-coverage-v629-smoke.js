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
  'release-verify-current-coverage-v629-smoke.js',
  'ui-build-badge-v629-smoke.js'
];
for (const file of required) {
  assert(runner.includes(`tools/checks/${file}`), `quick runner missing v629 check: ${file}`);
  assert(verifier.includes(`tools/checks/${file}`), `release verifier missing v629 check: ${file}`);
}
assert(current.CURRENT_REBUILD_VERSION_NUMBER >= 629);
assert.equal(current.CURRENT_REBUILD_VERSION, `rebuild-v${current.CURRENT_REBUILD_VERSION_NUMBER}`);
assert.equal(current.CURRENT_REBUILD_PACKAGE, `txt_reader_v${current.CURRENT_REBUILD_VERSION_NUMBER}.zip`);
assert.equal(current.CURRENT_REBUILD_MANIFEST, `package-manifest-v${current.CURRENT_REBUILD_VERSION_NUMBER}.json`);
assert.equal(current.CURRENT_REBUILD_RELEASE_NOTES, `txt_reader_v${current.CURRENT_REBUILD_VERSION_NUMBER}_change_report.md`);
assert.equal(current.CURRENT_REBUILD_MANIFEST_DIFF, `package-manifest-diff-v${current.CURRENT_REBUILD_VERSION_NUMBER}.md`);
assert(Number(JSON.parse(read('package.json')).version.split('.')[1]) >= 29);
assert(read('public/sw.js').includes(`const BUILD = 'rebuild-v${current.CURRENT_REBUILD_VERSION_NUMBER}'`));
assert(read('public/metadata.html').includes(`class="metadata-build-badge" title="현재 실행 중인 프런트엔드 빌드">v${current.CURRENT_REBUILD_VERSION_NUMBER}</span>`));
console.log(JSON.stringify({ pass:'v629-release-verify-current-coverage-pass', required:required.length }));
