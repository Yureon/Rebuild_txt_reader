#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname,'../..');
const read = rel => fs.readFileSync(path.join(root,rel),'utf8');
const current = require('./current-rebuild-version');
const required = [
  'release-verify-current-coverage-v641-smoke.js',
  'v641-audit-security-durability-smoke.js',
  'v641-metadata-manual-clear-smoke.js',
  'v641-owner-library-extension-smoke.js',
  'v641-packaging-gates-smoke.js',
  'source-size-budget-v641-smoke.js',
  'version-contract-import-order-v641-smoke.js',
  'package-inventory-exclude-v641-smoke.js'
];
const runner = read('tools/run_smoke_tests.js');
const verifier = read('tools/release_verify.js');
for (const file of required) {
  assert(runner.includes(`tools/checks/${file}`), `runner missing ${file}`);
  assert(verifier.includes(`tools/checks/${file}`), `release verifier missing ${file}`);
}
assert(current.CURRENT_REBUILD_VERSION_NUMBER >= 641);
assert.equal(current.CURRENT_REBUILD_VERSION,`rebuild-v${current.CURRENT_REBUILD_VERSION_NUMBER}`);
assert.equal(current.CURRENT_REBUILD_PACKAGE,`txt_reader_v${current.CURRENT_REBUILD_VERSION_NUMBER}.zip`);
assert.equal(current.CURRENT_REBUILD_MANIFEST,`package-manifest-v${current.CURRENT_REBUILD_VERSION_NUMBER}.json`);
assert.equal(current.CURRENT_REBUILD_RELEASE_NOTES,`txt_reader_v${current.CURRENT_REBUILD_VERSION_NUMBER}_change_report.md`);
assert.equal(current.CURRENT_REBUILD_MANIFEST_DIFF,`package-manifest-diff-v${current.CURRENT_REBUILD_VERSION_NUMBER}.md`);
assert.equal(Number(JSON.parse(read('package.json')).version.split('.')[1]),current.CURRENT_REBUILD_VERSION_NUMBER - 600);
assert.equal(JSON.parse(read('public/version.json')).buildId,'rebuild-v675');
assert(read('docs/audit-resolution.md').includes('v641-audit-owner-library-extension-doc-pass'));
assert(!fs.existsSync(path.join(root,'public/admin/users-static.html')));
console.log(JSON.stringify({ pass:'v641-release-verify-current-coverage-pass', required:required.length }));
