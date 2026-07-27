#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const current = require('./current-rebuild-version');

const currentRegressions = [
  'release-verify-current-coverage-v674-smoke.js',
  'v674-progress-local-compaction-smoke.mjs',
  'v674-reader-prefetch-cancel-race-smoke.mjs',
  'v674-library-bounded-fallback-smoke.mjs',
  'v674-service-worker-navigation-state-failure-smoke.js',
  'v674-server-filesystem-durability-smoke.js',
  'v674-server-device-profile-cap-smoke.js',
  'v674-metadata-playwright-dns-pinning-smoke.js',
  'v674-cross-platform-gate-contract-smoke.js'
];
const inherited = [
  'v673-metadata-applied-index-smoke.js',
  'v673-metadata-applied-shard-smoke.js',
  'v673-metadata-candidate-shard-race-smoke.js',
  'v673-metadata-sparse-shard-init-smoke.js',
  'v673-library-shelf-hot-path-smoke.js',
  'v673-library-variant-coarse-bucket-smoke.js',
  'v673-disk-cache-bounded-candidate-smoke.js',
  'v672-metadata-cpu-optimization-smoke.js',
  'v671-p0-p1-stability-smoke.js',
  'metadata-provider-completion-cooldown-v669-smoke.js',
  'v668-library-shell-isolation-smoke.mjs',
  'v666-non-auth-autofill-guard-smoke.js'
];

const runner = read('tools/run_smoke_tests.js');
const verifier = read('tools/release_verify.js');
for (const file of currentRegressions) {
  assert(fs.existsSync(path.join(root, 'tools/checks', file)), `missing ${file}`);
  assert(runner.includes(`tools/checks/${file}`), `runner missing ${file}`);
  assert(verifier.includes(`tools/checks/${file}`), `release verifier missing ${file}`);
}
for (const file of inherited) {
  assert(fs.existsSync(path.join(root, 'tools/checks', file)), `inherited regression missing ${file}`);
}

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
  ['README.md', 'v674-readme-current-pass'],
  ['docs/README.md', 'v674-doc-index-pass'],
  ['docs/release-notes.md', 'v674-release-notes-pass'],
  ['docs/project-status-roadmap.md', 'v674-project-status-pass'],
  ['docs/handoff.md', 'v674-handoff-pass'],
  ['docs/next-session-handoff-prompt.md', 'v674-next-session-handoff-pass'],
  ['docs/release-history.md', 'v674-release-history-pass'],
  ['docs/smoke-tests.md', 'v674-smoke-current-pass'],
  ['docs/audit-resolution.md', 'v674-audit-resolution-pass'],
  ['docs/performance-cache.md', 'v674-performance-hot-path-pass'],
  ['docs/storage-architecture.md', 'v674-storage-durability-bounded-state-pass'],
  ['docs/web-metadata.md', 'v674-web-metadata-dns-pinning-pass'],
  ['docs/operations-checklist.md', 'v674-operations-current-pass'],
  ['docs/pwa-offline.md', 'v674-pwa-navigation-best-effort-pass'],
  ['docs/security.md', 'v674-security-dns-proxy-boundary-pass'],
  ['docs/deployment-guide.md', 'v674-deployment-current-pass'],
  ['docs/user-data-isolation.md', 'v674-user-data-bounded-scope-pass']
]) {
  assert(read(doc).includes(marker), `${doc} missing ${marker}`);
}

const progressStorage = read('public/scripts/rebuild/core/progress-storage.mjs');
const progress = read('public/scripts/rebuild/features/reader/progress.mjs');
const prefetch = read('public/scripts/rebuild/features/reader/prefetch-queue.mjs');
const libraryFull = read('public/scripts/rebuild/features/library-full-renderer.mjs');
const libraryTree = read('public/scripts/rebuild/features/library-tree-renderer.mjs');
const libraryVirtual = read('public/scripts/rebuild/features/library-virtual-render-runtime.mjs');
const sw = read('public/sw.js');

assert(progressStorage.includes('v674-progress-incremental-local-fallback-pass'));
assert(progressStorage.includes('primeLocalProgressFallback'));
assert(progress.indexOf('progressSnapshotSignature') < progress.indexOf('persistProgress(app'));
assert(prefetch.includes('if (p.controller === controller) p.controller = null'));
assert(libraryFull.includes('v674-library-bounded-full-fallback-pass'));
assert(libraryTree.includes('v674-library-bookmark-count-index-pass'));
assert(libraryTree.includes('v674-library-collapsed-episode-lazy-pass'));
assert(libraryVirtual.includes('v674-library-virtual-bounded-failure-pass'));
assert(sw.includes('v674-service-worker-navigation-state-best-effort-pass'));
assert(sw.includes("const BUILD = 'rebuild-v675'"));

console.log(JSON.stringify({
  pass:'v674-release-verify-current-coverage-pass',
  currentRegressions:currentRegressions.length,
  inherited:inherited.length
}));
