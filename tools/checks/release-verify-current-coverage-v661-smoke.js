#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const current = require('./current-rebuild-version');
const required = [
  'release-verify-current-coverage-v661-smoke.js',
  'v661-audit-fixes-env-docs-smoke.mjs',
  'fileops-async-serialization-v592-smoke.js',
  'library-mutation-journal-v649-smoke.js',
  'metadata-queue-async-durability-v603-smoke.js',
  'library-cleanup-real-fixture-v628-smoke.js',
  'account-auth-async-v603-smoke.js',
  'v660-read-data-reader-tabs-isolation-smoke.mjs'
];
const runner = read('tools/run_smoke_tests.js');
const verifier = read('tools/release_verify.js');
for (const file of required.slice(0,2)) {
  assert(runner.includes(`tools/checks/${file}`), `runner missing ${file}`);
  assert(verifier.includes(`tools/checks/${file}`), `release verifier missing ${file}`);
}
for (const file of required.slice(2)) assert(fs.existsSync(path.join(root, 'tools/checks', file)), `related regression missing ${file}`);
assert.equal(current.CURRENT_REBUILD_VERSION_NUMBER, 674);
assert.equal(current.CURRENT_REBUILD_VERSION, 'rebuild-v675');
assert.equal(current.CURRENT_REBUILD_PACKAGE, 'txt_reader_v675.zip');
assert.equal(current.CURRENT_REBUILD_MANIFEST, 'package-manifest-v675.json');
assert.equal(current.CURRENT_REBUILD_RELEASE_NOTES, 'txt_reader_v675_change_report.md');
assert.equal(current.CURRENT_REBUILD_MANIFEST_DIFF, 'package-manifest-diff-v675.md');
assert.equal(current.CURRENT_REBUILD_DOCS.releaseFeature, 'docs/release-notes.md');
assert.equal(JSON.parse(read('package.json')).version, '6.75.0');
assert.equal(JSON.parse(read('public/version.json')).buildId, 'rebuild-v675');
assert(read('tools/sync_version_contract.js').includes('v674-central-version-contract-pass'));
assert(read('tools/generate_dependency_inventory.js').includes('v674-dependency-license-inventory-pass'));
assert(read('docs/release-notes.md').includes('v674-release-notes-pass'));
assert(read('docs/project-status-roadmap.md').includes('v674-project-status-pass'));
assert(read('docs/handoff.md').includes('v674-handoff-pass'));
assert(read('docs/next-session-handoff-prompt.md').includes('v674-next-session-handoff-pass'));
assert(read('docs/release-history.md').includes('v671-release-history-pass'));
assert(read('docs/smoke-tests.md').includes('v674-smoke-current-pass'));
assert(read('docs/security.md').includes('v669-security-provider-cooldown-pass'));
assert(read('docs/api-contract.md').includes('v667-api-contract-pass'));
assert(read('docs/storage-architecture.md').includes('v666-storage-durability-pass'));
assert(read('.env.example').includes('FILEOPS_MUTATION_QUEUE_MAX=64'));
console.log(JSON.stringify({ pass:'v661-release-verify-current-coverage-pass', required:required.length }));
