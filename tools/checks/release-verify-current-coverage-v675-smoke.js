#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const current = require('./current-rebuild-version');

const currentRegressions = [
  'release-verify-current-coverage-v675-smoke.js',
  'v675-progress-delta-journal-smoke.js',
  'v675-metadata-compact-index-smoke.js',
  'v675-trusted-proxy-source-smoke.js',
  'v675-reader-prefetch-watchdog-smoke.mjs',
  'v675-service-worker-dual-failure-smoke.js',
  'v675-font-symlink-boundary-smoke.js',
  'v675-modal-focus-manager-smoke.mjs',
  'v675-profile-skeleton-smoke.mjs'
];
const inherited = [
  'release-verify-current-coverage-v674-smoke.js',
  'v674-progress-local-compaction-smoke.mjs',
  'v674-reader-prefetch-cancel-race-smoke.mjs',
  'v674-library-bounded-fallback-smoke.mjs',
  'v674-service-worker-navigation-state-failure-smoke.js',
  'v674-server-filesystem-durability-smoke.js',
  'v674-server-device-profile-cap-smoke.js',
  'v674-metadata-playwright-dns-pinning-smoke.js',
  'v674-cross-platform-gate-contract-smoke.js',
  'v673-metadata-applied-index-smoke.js',
  'v673-metadata-applied-shard-smoke.js',
  'v673-metadata-candidate-shard-race-smoke.js',
  'v673-metadata-sparse-shard-init-smoke.js',
  'v672-metadata-cpu-optimization-smoke.js',
  'v671-p0-p1-stability-smoke.js'
];

const runner = read('tools/run_smoke_tests.js');
const verifier = read('tools/release_verify.js');
for (const file of currentRegressions) {
  assert(fs.existsSync(path.join(root, 'tools/checks', file)), `missing ${file}`);
  assert(runner.includes(`tools/checks/${file}`), `runner missing ${file}`);
  assert(verifier.includes(`tools/checks/${file}`), `release verifier missing ${file}`);
}
for (const file of inherited) assert(fs.existsSync(path.join(root, 'tools/checks', file)), `inherited regression missing ${file}`);

assert.equal(current.CURRENT_REBUILD_VERSION_NUMBER, 675);
assert.equal(current.CURRENT_REBUILD_VERSION, 'rebuild-v675');
assert.equal(current.CURRENT_REBUILD_PACKAGE, 'txt_reader_v675.zip');
assert.equal(current.CURRENT_REBUILD_MANIFEST, 'package-manifest-v675.json');
assert.equal(current.CURRENT_REBUILD_RELEASE_NOTES, 'txt_reader_v675_change_report.md');
assert.equal(current.CURRENT_REBUILD_MANIFEST_DIFF, 'package-manifest-diff-v675.md');
assert.equal(JSON.parse(read('package.json')).version, '6.75.0');
assert.equal(JSON.parse(read('public/version.json')).buildId, 'rebuild-v675');
assert(read('tools/sync_version_contract.js').includes('v675-central-version-contract-pass'));
assert(read('tools/generate_dependency_inventory.js').includes('v675-dependency-license-inventory-pass'));

for (const [doc, marker] of [
  ['README.md', 'v675-readme-current-pass'],
  ['docs/README.md', 'v675-doc-index-pass'],
  ['docs/release-notes.md', 'v675-release-notes-pass'],
  ['docs/project-status-roadmap.md', 'v675-project-status-pass'],
  ['docs/handoff.md', 'v675-handoff-pass'],
  ['docs/next-session-handoff-prompt.md', 'v675-next-session-handoff-pass'],
  ['docs/release-history.md', 'v675-release-history-pass'],
  ['docs/smoke-tests.md', 'v675-smoke-current-pass'],
  ['docs/audit-resolution.md', 'v675-audit-resolution-pass'],
  ['docs/performance-cache.md', 'v675-performance-hot-path-pass'],
  ['docs/storage-architecture.md', 'v675-storage-progress-journal-pass'],
  ['docs/web-metadata.md', 'v675-web-metadata-compact-index-pass'],
  ['docs/operations-checklist.md', 'v675-operations-current-pass'],
  ['docs/pwa-offline.md', 'v675-pwa-dual-failure-pass'],
  ['docs/security.md', 'v675-security-proxy-font-boundary-pass'],
  ['docs/deployment-guide.md', 'v675-deployment-proxy-cidrs-pass'],
  ['docs/user-data-isolation.md', 'v675-user-data-progress-scope-pass']
]) assert(read(doc).includes(marker), `${doc} missing ${marker}`);

const syncState = read('server/services/sync-state-service.js');
const stateWrite = read('server/services/state-write-service.js');
const meta = read('server/services/metadata-store-service.js');
const proxy = read('server/services/trusted-proxy-policy.js');
const rate = read('server/services/rate-limit.js');
const prefetch = read('public/scripts/rebuild/features/reader/prefetch-queue.mjs');
const sw = read('public/sw.js');
const font = read('server/services/font-service.js');
const modal = read('public/scripts/rebuild/features/ui/modal-focus-manager.mjs');
const library = read('public/library.html');
const site = read('public/site.html');
assert(syncState.includes('v675-progress-delta-journal-pass'));
assert(stateWrite.includes('appendProgressJournal'));
assert(meta.includes('v675-metadata-compact-index-pass') && meta.includes('v675-metadata-startup-bound-pass'));
assert(proxy.includes('v675-trusted-proxy-source-pass') && rate.includes('isTrustedProxySource'));
assert(prefetch.includes('v675-reader-prefetch-watchdog-pass'));
assert(sw.includes('v675-offline-dual-failure-pass') && sw.includes("const BUILD = 'rebuild-v675'"));
assert(font.includes('v675-font-nofollow-pass') && font.includes('O_NOFOLLOW'));
assert(modal.includes('v675-modal-focus-manager-pass'));
assert(library.includes('v675-library-entry-skeleton-pass') && !library.includes('reader-skeleton-paper'));
assert(site.includes('v675-current-reader-skeleton-pass') && site.includes('reader-skeleton-paper'));

console.log(JSON.stringify({ pass:'v675-release-verify-current-coverage-pass', currentRegressions:currentRegressions.length, inherited:inherited.length }));
