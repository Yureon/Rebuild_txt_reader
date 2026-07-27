#!/usr/bin/env node
const assert = require('assert');
const path = require('path');
const current = require('./current-rebuild-version.js');
const { runPackageRebuild } = require('../package_rebuild.js');
assert.ok(current.CURRENT_REBUILD_VERSION_NUMBER >= 594);
assert.equal(current.CURRENT_REBUILD_MANIFEST, `package-manifest-v${current.CURRENT_REBUILD_VERSION_NUMBER}.json`);
assert.equal(current.CURRENT_REBUILD_RELEASE_NOTES, `txt_reader_v${current.CURRENT_REBUILD_VERSION_NUMBER}_change_report.md`);
assert.equal(current.CURRENT_REBUILD_MANIFEST_DIFF, `package-manifest-diff-v${current.CURRENT_REBUILD_VERSION_NUMBER}.md`);
const result = runPackageRebuild(current.buildCurrentRebuildPackageDryRunArgs([]), path.resolve(__dirname, '..', '..'));
assert.equal(result.consolidatedRelease, true);
assert.equal(result.scaffoldDocs, false);
assert.ok(result.manifestPlan.outputPath.endsWith(current.CURRENT_REBUILD_MANIFEST));
assert.ok(result.releaseNotePlan.outputPath.endsWith(current.CURRENT_REBUILD_RELEASE_NOTES));
assert.ok(result.manifestDiffDocPlan.outputPath.endsWith(current.CURRENT_REBUILD_MANIFEST_DIFF));
assert.ok(result.docs.includes('docs/storage-architecture.md') && result.docs.includes('docs/pwa-offline.md'));
assert.ok(!result.docs.some(file => /rebuild-phase\d+|release-notes-v\d+/.test(file)), 'consolidated release must not plan missing versioned docs');
console.log(JSON.stringify({ pass:'current-release-output-path-pass' }));
