#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const current = require('./current-rebuild-version');
const currentRegressions = [
  'release-verify-current-coverage-v673-smoke.js',
  'v673-metadata-applied-index-smoke.js',
  'v673-metadata-applied-shard-smoke.js',
  'v673-metadata-candidate-shard-race-smoke.js',
  'v673-metadata-sparse-shard-init-smoke.js',
  'v673-library-shelf-hot-path-smoke.js',
  'v673-library-variant-coarse-bucket-smoke.js',
  'v673-disk-cache-bounded-candidate-smoke.js'
];
const inherited = [
  'v672-metadata-cpu-optimization-smoke.js',
  'v671-p0-p1-stability-smoke.js',
  'metadata-provider-completion-cooldown-v669-smoke.js',
  'v668-library-shell-isolation-smoke.mjs',
  'v666-non-auth-autofill-guard-smoke.js',
  'csp-inline-script-smoke.js',
  'csp-inline-style-smoke.js',
  'precompressed-static-smoke.js',
  'public-asset-allowlist-smoke.js'
];
const runner = read('tools/run_smoke_tests.js');
const verifier = read('tools/release_verify.js');
for (const file of currentRegressions) {
  assert(fs.existsSync(path.join(root, 'tools/checks', file)), `missing ${file}`);
  assert(runner.includes(`tools/checks/${file}`), `runner missing ${file}`);
  assert(verifier.includes(`tools/checks/${file}`), `release verifier missing ${file}`);
}
for (const file of inherited) assert(fs.existsSync(path.join(root, 'tools/checks', file)), `inherited regression missing ${file}`);

assert.equal(current.CURRENT_REBUILD_VERSION_NUMBER, 674);
assert.equal(current.CURRENT_REBUILD_VERSION, 'rebuild-v675');
assert.equal(current.CURRENT_REBUILD_PACKAGE, 'txt_reader_v675.zip');
assert.equal(current.CURRENT_REBUILD_MANIFEST, 'package-manifest-v675.json');
assert.equal(current.CURRENT_REBUILD_RELEASE_NOTES, 'txt_reader_v675_change_report.md');
assert.equal(current.CURRENT_REBUILD_MANIFEST_DIFF, 'package-manifest-diff-v675.md');
assert.equal(JSON.parse(read('package.json')).version, '6.75.0');
assert.equal(JSON.parse(read('public/version.json')).buildId, 'rebuild-v675');
assert(read('tools/sync_version_contract.js').includes('v674-central-version-contract-pass'));
assert(read('tools/generate_dependency_inventory.js').includes('v674-dependency-license-inventory-pass'));

for (const [doc, marker] of [
  ['README.md','v674-readme-current-pass'],
  ['docs/README.md','v674-doc-index-pass'],
  ['docs/release-notes.md','v674-release-notes-pass'],
  ['docs/project-status-roadmap.md','v674-project-status-pass'],
  ['docs/handoff.md','v674-handoff-pass'],
  ['docs/next-session-handoff-prompt.md','v674-next-session-handoff-pass'],
  ['docs/release-history.md','v674-release-history-pass'],
  ['docs/smoke-tests.md','v674-smoke-current-pass'],
  ['docs/audit-resolution.md','v674-audit-resolution-pass'],
  ['docs/performance-cache.md','v674-performance-hot-path-pass'],
  ['docs/storage-architecture.md','v674-storage-durability-bounded-state-pass'],
  ['docs/web-metadata.md','v674-web-metadata-dns-pinning-pass'],
  ['docs/operations-checklist.md','v674-operations-current-pass']
]) assert(read(doc).includes(marker), `${doc} missing ${marker}`);

const metadataStore = read('server/services/metadata-store-service.js');
const appliedShard = read('server/services/metadata-applied-shard-store.js');
const candidateShard = read('server/services/metadata-candidate-shard-store.js');
const novelsRoutes = read('server/routes/novels-routes.js');
const variants = read('server/services/library-variant-service.js');
const janitor = read('server/services/disk-cache-janitor-service.js');
assert(metadataStore.includes('v673-metadata-applied-incremental-index-pass'));
assert(metadataStore.includes('appliedRecordIdsByCandidateId'));
assert(appliedShard.includes('v673-metadata-applied-shard-v2-pass'));
assert(appliedShard.includes('dirtyVersions'));
assert(candidateShard.includes('dirtyVersions'));
assert(candidateShard.includes('initializeEmpty'));
assert(novelsRoutes.includes('v673-library-shelf-hot-path-pass'));
assert(novelsRoutes.indexOf('if (clientHasMatchingEtag(req, etag))') < novelsRoutes.indexOf('decorateSerializedNovelWithUserTags'));
assert(variants.includes('v673-library-variant-coarse-bucket-pass'));
assert(variants.includes("title.slice(-6)"));
assert(janitor.includes('v673-disk-cache-bounded-candidate-pass'));
assert(janitor.includes('createBoundedCandidateHeap'));

const libraryShell = read('public/fragments/library-shell.html');
const readerShell = read('public/fragments/app-shell.html');
const runtime = read('public/scripts/rebuild/core/app-shell.mjs');
assert(libraryShell.includes('v668-library-shell-isolation-pass'));
assert(!libraryShell.includes('reader-load-skeleton'));
assert(!libraryShell.includes('id="main"'));
assert(readerShell.includes('reader-load-skeleton'));
assert(readerShell.includes('id="main"'));
assert(runtime.includes("library: '/fragments/library-shell.html?v=rebuild-v675'"));
assert(runtime.includes("site: '/fragments/app-shell.html?v=rebuild-v675'"));

console.log(JSON.stringify({ pass:'v673-release-verify-current-coverage-pass', currentRegressions:currentRegressions.length, inherited:inherited.length }));
