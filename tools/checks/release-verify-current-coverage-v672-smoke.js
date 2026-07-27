#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const current = require('./current-rebuild-version');
const required = [
  'release-verify-current-coverage-v672-smoke.js',
  'v672-metadata-cpu-optimization-smoke.js',
  'v671-p0-p1-stability-smoke.js',
  'v670-settings-language-advanced-smoke.mjs',
  'metadata-provider-completion-cooldown-v669-smoke.js',
  'release-verify-current-coverage-v668-smoke.js',
  'v668-library-shell-isolation-smoke.mjs',
  'release-verify-current-coverage-v667-smoke.js',
  'v667-ui-metadata-provider-smoke.js',
  'v666-non-auth-autofill-guard-smoke.js',
  'v665-manual-cover-recognition-smoke.js',
  'v664-library-resume-explorer-quick-smoke.mjs',
  'csp-inline-script-smoke.js',
  'csp-inline-style-smoke.js',
  'precompressed-static-smoke.js',
  'public-asset-allowlist-smoke.js'
];
const runner = read('tools/run_smoke_tests.js');
const verifier = read('tools/release_verify.js');
for (const file of required.slice(0,4)) {
  assert(runner.includes(`tools/checks/${file}`), `runner missing ${file}`);
  assert(verifier.includes(`tools/checks/${file}`), `release verifier missing ${file}`);
}
for (const file of required.slice(4)) assert(fs.existsSync(path.join(root, 'tools/checks', file)), `related regression missing ${file}`);
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
  ['docs/README.md','v674-doc-index-pass'],
  ['docs/release-notes.md','v674-release-notes-pass'],
  ['docs/project-status-roadmap.md','v674-project-status-pass'],
  ['docs/handoff.md','v674-handoff-pass'],
  ['docs/next-session-handoff-prompt.md','v674-next-session-handoff-pass'],
  ['docs/release-history.md','v672-release-history-pass'],
  ['docs/smoke-tests.md','v674-smoke-current-pass'],
  ['docs/security.md','v669-security-provider-cooldown-pass'],
  ['docs/audit-resolution.md','v674-audit-resolution-pass']
]) assert(read(doc).includes(marker), `${doc} missing ${marker}`);
const libraryShell = read('public/fragments/library-shell.html');
const readerShell = read('public/fragments/app-shell.html');
const runtime = read('public/scripts/rebuild/core/app-shell.mjs');
assert(libraryShell.includes('v668-library-shell-isolation-pass'));
assert(read('server/services/metadata-service.js').includes('v669-metadata-provider-completion-cooldown-pass'));
assert(read('server/services/metadata-service.js').includes('nextAllowedAtByProvider.set(key, completedAt + cooldownMs)'));
assert(read('public/scripts/admin/metadata.mjs').includes('수집 완료 후 쿨타임 기준(초)'));
assert(!libraryShell.includes('reader-load-skeleton'));
assert(!libraryShell.includes('id="main"'));
assert(readerShell.includes('reader-load-skeleton'));
assert(readerShell.includes('id="main"'));
assert(runtime.includes("library: '/fragments/library-shell.html?v=rebuild-v675'"));
assert(runtime.includes("site: '/fragments/app-shell.html?v=rebuild-v675'"));
assert(runtime.includes('v668-profile-shell-isolation-pass'));

const metadataService = read('server/services/metadata-service.js');
const metadataStore = read('server/services/metadata-store-service.js');
const metadataAdapters = read('server/services/metadata-site-adapters.js');
const metadataPlaywright = read('server/services/metadata-playwright-service.js');
assert(metadataService.includes('v672-metadata-low-cpu-collection-pass'));
assert(metadataService.includes('Public/static requests use the lightweight HTTP transport'));
assert(metadataStore.includes('v672-metadata-incremental-index-pass'));
assert(metadataStore.includes('Full index rebuilds'));
assert(metadataAdapters.includes('v672-metadata-adapter-cpu-guard-pass'));
assert(metadataAdapters.includes('JSON_DOCUMENT_MAX_TOTAL_BYTES'));
assert(metadataPlaywright.includes('v672-metadata-playwright-low-cpu-pass'));
assert(metadataPlaywright.includes('collectorIdleTtlMs'));
assert(read('.env.example').includes('METADATA_PLAYWRIGHT_COLLECTOR_IDLE_TTL_MS=90000'));

const index = read('public/index.html');
assert(index.includes('v668-entry-router-before-paint-pass'));
assert(!/entry-router\.js[^>]*\bdefer\b/.test(index));
console.log(JSON.stringify({ pass:'v672-release-verify-current-coverage-pass', required:required.length }));
