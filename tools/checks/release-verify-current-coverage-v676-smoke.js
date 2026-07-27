#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const current = require('./current-rebuild-version');

const currentRegressions = [
  'release-verify-current-coverage-v676-smoke.js',
  'v676-active-check-registration-smoke.js',
  'v676-compose-environment-yaml-smoke.js',
  'v676-trusted-proxy-validation-smoke.js',
  'v676-metadata-bounded-resident-smoke.js',
  'v676-reader-prefetch-orphan-circuit-smoke.mjs',
  'v676-modal-stack-runtime-smoke.mjs',
  'v676-font-io-error-propagation-smoke.js',
  'v676-progress-journal-symlink-smoke.js',
  'v676-extension-shortcut-responsive-smoke.js',
  'v676-metadata-folder-continuity-smoke.mjs'
];
const inherited = [
  'v675-progress-delta-journal-smoke.js',
  'v675-metadata-compact-index-smoke.js',
  'v675-trusted-proxy-source-smoke.js',
  'v675-reader-prefetch-watchdog-smoke.mjs',
  'v675-service-worker-dual-failure-smoke.js',
  'v675-font-symlink-boundary-smoke.js',
  'v675-modal-focus-manager-smoke.mjs',
  'v675-profile-skeleton-smoke.mjs',
  'v674-progress-local-compaction-smoke.mjs',
  'v674-reader-prefetch-cancel-race-smoke.mjs',
  'v674-library-bounded-fallback-smoke.mjs',
  'v674-service-worker-navigation-state-failure-smoke.js',
  'v674-server-filesystem-durability-smoke.js',
  'v674-server-device-profile-cap-smoke.js',
  'v674-metadata-playwright-dns-pinning-smoke.js'
];

const runner = read('tools/run_smoke_tests.js');
const verifier = read('tools/release_verify.js');
for (const file of currentRegressions) {
  assert(fs.existsSync(path.join(root, 'tools/checks', file)), `missing ${file}`);
  assert(runner.includes(`tools/checks/${file}`), `runner missing ${file}`);
  assert(verifier.includes(`tools/checks/${file}`), `release verifier missing ${file}`);
}
for (const file of inherited) assert(fs.existsSync(path.join(root, 'tools/checks', file)), `inherited regression missing ${file}`);

assert.equal(current.CURRENT_REBUILD_VERSION_NUMBER, 676);
assert.equal(current.CURRENT_REBUILD_VERSION, 'rebuild-v676');
assert.equal(current.CURRENT_REBUILD_PACKAGE, 'txt_reader_v676.zip');
assert.equal(current.CURRENT_REBUILD_MANIFEST, 'package-manifest-v676.json');
assert.equal(current.CURRENT_REBUILD_RELEASE_NOTES, 'txt_reader_v676_change_report.md');
assert.equal(current.CURRENT_REBUILD_MANIFEST_DIFF, 'package-manifest-diff-v676.md');
assert.equal(JSON.parse(read('package.json')).version, '6.76.0');
assert.equal(JSON.parse(read('public/version.json')).buildId, 'rebuild-v676');
assert(read('tools/sync_version_contract.js').includes('v676-central-version-contract-pass'));
assert(read('tools/generate_dependency_inventory.js').includes('v676-dependency-license-inventory-pass'));

for (const [doc, marker] of [
  ['README.md', 'v676-readme-current-pass'],
  ['docs/README.md', 'v676-doc-index-pass'],
  ['docs/release-notes.md', 'v676-release-notes-pass'],
  ['docs/project-status-roadmap.md', 'v676-project-status-pass'],
  ['docs/handoff.md', 'v676-handoff-pass'],
  ['docs/next-session-handoff-prompt.md', 'v676-next-session-handoff-pass'],
  ['docs/release-history.md', 'v676-release-history-pass'],
  ['docs/smoke-tests.md', 'v676-smoke-current-pass'],
  ['docs/audit-resolution.md', 'v676-audit-resolution-pass'],
  ['docs/performance-cache.md', 'v676-performance-hot-path-pass'],
  ['docs/storage-architecture.md', 'v676-storage-progress-journal-pass'],
  ['docs/web-metadata.md', 'v676-web-metadata-bounded-load-pass'],
  ['docs/operations-checklist.md', 'v676-operations-current-pass'],
  ['docs/pwa-offline.md', 'v676-pwa-dual-failure-pass'],
  ['docs/security.md', 'v676-security-proxy-font-journal-pass'],
  ['docs/deployment-guide.md', 'v676-deployment-proxy-cidrs-pass'],
  ['docs/user-data-isolation.md', 'v676-user-data-progress-scope-pass'],
  ['extensions/metadata-login-helper/README.md', 'v676-extension-shortcut-pass']
]) assert(read(doc).includes(marker), `${doc} missing ${marker}`);

const syncState = read('server/services/sync-state-service.js');
const metadata = read('server/services/metadata-store-service.js');
const shards = read('server/services/metadata-candidate-shard-store.js');
const proxy = read('server/services/trusted-proxy-policy.js');
const rate = read('server/services/rate-limit.js');
const prefetch = read('public/scripts/rebuild/features/reader/prefetch-queue.mjs');
const sw = read('public/sw.js');
const font = read('server/services/font-service.js');
const modal = read('public/scripts/rebuild/features/ui/modal-focus-manager.mjs');
const metadataPage = read('public/scripts/rebuild/metadata-page.mjs');
const extensionManifest = JSON.parse(read('extensions/metadata-login-helper/manifest.json'));
assert(syncState.includes('v676-progress-journal-nofollow-pass') && syncState.includes('O_NOFOLLOW'));
assert(metadata.includes('v676-metadata-bounded-shard-load-pass'));
assert(shards.includes('createBoundedCandidateSelector') && shards.includes('loadBounded'));
assert(proxy.includes('v676-trusted-proxy-validation-pass') && rate.includes('net.isIP'));
assert(prefetch.includes('v676-reader-prefetch-orphan-circuit-pass'));
assert(sw.includes('v675-offline-dual-failure-pass') && sw.includes("const BUILD = 'rebuild-v676'"));
assert(font.includes('O_NOFOLLOW'));
assert(modal.includes('v676-modal-stack-focus-manager-pass'));
assert(metadataPage.includes('metadata-work-folder-filter') && metadataPage.includes('preserveLoadedCount'));
assert(extensionManifest.commands?._execute_action?.suggested_key?.default);

console.log(JSON.stringify({ pass:'v676-release-verify-current-coverage-pass', currentRegressions:currentRegressions.length, inherited:inherited.length }));
