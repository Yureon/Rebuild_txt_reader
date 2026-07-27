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
  'release-verify-current-coverage-v630-smoke.js',
  'library-cleanup-ui-v630-smoke.js',
  'metadata-manual-candidate-delete-v630-smoke.js',
  'library-cleanup-real-fixture-v628-smoke.js',
  'library-cleanup-admin-route-v628-smoke.js'
];
for (const file of required) {
  assert(runner.includes(`tools/checks/${file}`), `quick runner missing v630 check: ${file}`);
  assert(verifier.includes(`tools/checks/${file}`), `release verifier missing v630 check: ${file}`);
}
assert(current.CURRENT_REBUILD_VERSION_NUMBER >= 630);
assert.equal(current.CURRENT_REBUILD_VERSION, `rebuild-v${current.CURRENT_REBUILD_VERSION_NUMBER}`);
assert.equal(current.CURRENT_REBUILD_PACKAGE, `txt_reader_v${current.CURRENT_REBUILD_VERSION_NUMBER}.zip`);
assert.equal(current.CURRENT_REBUILD_MANIFEST, `package-manifest-v${current.CURRENT_REBUILD_VERSION_NUMBER}.json`);
assert.equal(current.CURRENT_REBUILD_RELEASE_NOTES, `txt_reader_v${current.CURRENT_REBUILD_VERSION_NUMBER}_change_report.md`);
assert.equal(current.CURRENT_REBUILD_MANIFEST_DIFF, `package-manifest-diff-v${current.CURRENT_REBUILD_VERSION_NUMBER}.md`);
assert(Number(JSON.parse(read('package.json')).version.split('.')[1]) >= 30);
assert(read('server/services/library-cleanup-service.js').includes('v630-library-cleanup-powershell-script-pass'));
assert(read('server/routes/metadata-routes.js').includes('/metadata/candidates/:candidateId'));
assert(read('server/routes/metadata-routes.js').includes('/metadata/manual'));
assert(read('public/sw.js').includes(`const BUILD = 'rebuild-v${current.CURRENT_REBUILD_VERSION_NUMBER}'`));
assert(read('public/admin/users.html').includes('data-library-cleanup-ui-pass="v642-library-cleanup-similarity-ui-pass"'));
console.log(JSON.stringify({ pass:'v630-release-verify-current-coverage-pass', required:required.length }));
