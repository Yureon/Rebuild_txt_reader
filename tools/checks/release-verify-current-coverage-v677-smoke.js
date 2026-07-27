#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const current = require('./current-rebuild-version');

const currentRegressions = [
  'release-verify-current-coverage-v677-smoke.js',
  'v677-active-check-registration-smoke.js',
  'v677-metadata-hard-cap-incremental-smoke.js',
  'v677-library-tree-folder-cursor-smoke.js',
  'v677-cover-audit-nofollow-smoke.js',
  'v677-package-format-parser-smoke.js',
  'v677-runtime-dependency-install-smoke.js'
];
const inherited = [
  'v676-compose-environment-yaml-smoke.js',
  'v676-trusted-proxy-validation-smoke.js',
  'v676-metadata-bounded-resident-smoke.js',
  'v676-reader-prefetch-orphan-circuit-smoke.mjs',
  'v676-modal-stack-runtime-smoke.mjs',
  'v676-font-io-error-propagation-smoke.js',
  'v676-progress-journal-symlink-smoke.js',
  'v676-extension-shortcut-responsive-smoke.js',
  'v676-metadata-folder-continuity-smoke.mjs',
  'v675-progress-delta-journal-smoke.js',
  'v675-reader-prefetch-watchdog-smoke.mjs',
  'v675-service-worker-dual-failure-smoke.js',
  'v674-server-filesystem-durability-smoke.js'
];

const runner = read('tools/run_smoke_tests.js');
const verifier = read('tools/release_verify.js');
for (const file of currentRegressions) {
  assert(fs.existsSync(path.join(root, 'tools/checks', file)), `missing ${file}`);
  assert(runner.includes(`tools/checks/${file}`), `runner missing ${file}`);
  assert(verifier.includes(`tools/checks/${file}`), `release verifier missing ${file}`);
}
for (const file of inherited) assert(fs.existsSync(path.join(root, 'tools/checks', file)), `inherited regression missing ${file}`);

assert.equal(current.CURRENT_REBUILD_VERSION_NUMBER, 677);
assert.equal(current.CURRENT_REBUILD_VERSION, 'rebuild-v677');
assert.equal(current.CURRENT_REBUILD_PACKAGE, 'txt_reader_v677.zip');
assert.equal(current.CURRENT_REBUILD_MANIFEST, 'package-manifest-v677.json');
assert.equal(current.CURRENT_REBUILD_RELEASE_NOTES, 'txt_reader_v677_change_report.md');
assert.equal(current.CURRENT_REBUILD_MANIFEST_DIFF, 'package-manifest-diff-v677.md');
assert.equal(JSON.parse(read('package.json')).version, '6.77.0');
assert.equal(JSON.parse(read('public/version.json')).buildId, 'rebuild-v677');
assert(read('tools/sync_version_contract.js').includes('v677-central-version-contract-pass'));
assert(read('tools/generate_dependency_inventory.js').includes('v677-dependency-license-inventory-pass'));

for (const [doc, marker] of [
  ['README.md', 'v677-readme-current-pass'],
  ['docs/README.md', 'v677-doc-index-pass'],
  ['docs/release-notes.md', 'v677-release-notes-pass'],
  ['docs/project-status-roadmap.md', 'v677-project-status-pass'],
  ['docs/handoff.md', 'v677-handoff-pass'],
  ['docs/next-session-handoff-prompt.md', 'v677-next-session-handoff-pass'],
  ['docs/release-history.md', 'v677-release-history-pass'],
  ['docs/smoke-tests.md', 'v677-smoke-current-pass'],
  ['docs/audit-resolution.md', 'v677-audit-resolution-pass'],
  ['docs/performance-cache.md', 'v677-performance-hot-path-pass'],
  ['docs/storage-architecture.md', 'v677-storage-bound-pass'],
  ['docs/web-metadata.md', 'v677-web-metadata-hard-bound-pass'],
  ['docs/operations-checklist.md', 'v677-operations-current-pass'],
  ['docs/security.md', 'v677-security-nofollow-pass'],
  ['docs/deployment-guide.md', 'v677-deployment-runtime-gate-pass'],
  ['docs/user-data-isolation.md', 'v677-user-data-state-revision-pass']
]) assert(read(doc).includes(marker), `${doc} missing ${marker}`);

const metadata = read('server/services/metadata-store-service.js');
const shards = read('server/services/metadata-candidate-shard-store.js');
const novels = read('server/routes/novels-routes.js');
const cover = read('server/services/metadata-cover-service.js');
const audit = read('server/services/audit-log-service.js');
const libraryRuntime = read('public/scripts/rebuild/features/library-shelf-runtime.mjs');
const metadataPage = read('public/scripts/rebuild/metadata-page.mjs');
const api = read('public/scripts/rebuild/core/api.mjs');
const parser = read('tools/checks/v677-package-format-parser-smoke.js');
const staticIntegrity = read('tools/run_v677_static_integrity.js');
assert(metadata.includes('v677-metadata-hard-resident-bound-pass'));
assert(metadata.includes('v677-metadata-incremental-eviction-pass'));
assert(metadata.includes('v677-metadata-applied-provenance-pass'));
assert(shards.includes('hardBounded:true'));
assert(novels.includes('v677-library-tree-cursor-pass'));
assert(novels.includes('v677-library-state-revision-split-pass'));
assert(novels.includes('v677-library-folder-filter-cursor-pass'));
assert(libraryRuntime.includes('v677-library-tree-paged-catalog-pass'));
assert(metadataPage.includes('loadFolderFilters') && api.includes('/api/novels/shelf/filter-folders'));
assert(cover.includes('v677-metadata-cover-nofollow-read-pass') && cover.includes('O_NOFOLLOW'));
assert(audit.includes('v677-audit-log-nofollow-pass') && audit.includes('O_NOFOLLOW'));
assert(parser.includes('v677-package-format-parser-smoke-pass'));
assert(staticIntegrity.includes("scanRoots = ['.']"));

console.log(JSON.stringify({ pass:'v677-release-verify-current-coverage-pass', currentRegressions:currentRegressions.length, inherited:inherited.length }));
