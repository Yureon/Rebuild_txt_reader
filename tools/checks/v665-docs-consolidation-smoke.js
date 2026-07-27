#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const docsDir = path.join(root, 'docs');
const canonical = [
  'README.md','api-contract.md','audit-resolution.md','deployment-guide.md','handoff.md',
  'library-metadata-grouping.md','multi-user-access-control.md','next-session-handoff-prompt.md',
  'normalized-content-cache.md','operations-checklist.md','performance-cache.md',
  'production-diagnostics.md','project-status-roadmap.md','proxy-tunnel-setup.md','pwa-offline.md',
  'reader-anchoring-stability-contract.md','reader-search-baseline.md','release-history.md',
  'release-notes.md','security.md','smoke-tests.md','storage-architecture.md',
  'user-data-isolation.md','web-metadata.md'
];
const removedVersionDocs = [
  'cdn-worker-and-stale-assets-v633.md','deploy-stabilization-metadata-groups-scroll-v638.md',
  'library-load-stability-v646.md','library-mobile-entry-load-v644.md',
  'library-similarity-metadata-storage-v642.md','metadata-cover-v634.md','metadata-ssn-owner-ui-v640.md',
  'owner-library-metadata-localization-v643.md','predeploy-exhaustive-audit-v639.md',
  'reader-search-library-ui-v645.md','reader-search-settings-fix-v647.md',
  'service-worker-cloudflare-v632.md','service-worker-forward-upgrade-v631.md',
  'update-coordination-cover-integrity-v637.md','update-coordination-cover-lease-v636.md',
  'update-cover-fixes-v635.md','v641-audit-owner-library-extension.md','v641-audit-resolution-matrix.md',
  'v661-audit-durability-performance.md','v662-deferred-ui-530-recovery.md',
  'v663-assets-csp-cover.md','v664-library-resume-explorer.md'
];

for (const file of canonical) assert(fs.existsSync(path.join(docsDir, file)), `canonical document missing: ${file}`);
for (const file of removedVersionDocs) assert(!fs.existsSync(path.join(docsDir, file)), `duplicate version document remains: ${file}`);
const index = fs.readFileSync(path.join(docsDir, 'README.md'), 'utf8');
for (const file of canonical.filter(file => file !== 'README.md')) {
  if (['multi-user-access-control.md','normalized-content-cache.md'].includes(file)) continue;
  assert(index.includes(file), `document index missing ${file}`);
}
const allText = [
  'README.md',
  ...fs.readdirSync(docsDir).filter(file => file.endsWith('.md')).map(file => `docs/${file}`),
  ...fs.readdirSync(path.join(root, 'tools', 'checks')).filter(file => /\.(?:js|mjs)$/u.test(file)).map(file => `tools/checks/${file}`)
];
for (const rel of allText) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  for (const removed of removedVersionDocs) assert(!text.includes(`docs/${removed}`), `stale document reference in ${rel}: ${removed}`);
}
assert(index.includes('버전별 단일 기능 문서'));
assert(fs.readFileSync(path.join(docsDir, 'release-notes.md'), 'utf8').includes('v676-release-notes-pass'));
assert(fs.readFileSync(path.join(docsDir, 'audit-resolution.md'), 'utf8').includes('v676-audit-resolution-pass'));
console.log(JSON.stringify({ pass:'v665-docs-consolidation-pass', canonical:canonical.length, removed:removedVersionDocs.length }));
