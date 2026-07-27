#!/usr/bin/env node
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { buildLibraryVariantPresentation } = require('../../server/services/library-variant-service');
const { createSearchPerformanceService } = require('../../server/services/search-performance-service');
const { isHistoricalReleaseArtifact } = require('../package_rebuild');

const root = path.resolve(__dirname, '../..');
const sharedHash = crypto.createHash('sha256').update('same-content').digest('hex');
const novels = Array.from({ length:1000 }, (_, index) => ({
  id:`duplicate-${index}`,
  title:'대량 동일본 1-100完',
  author:'동일작가',
  description:'대량 동일본 선형 처리 회귀',
  metadata:{},
  singlePath:`copies/대량 동일본 1-100完-${index}.txt`,
  contentFingerprint:{ prefixHash:sharedHash, middleHash:sharedHash, prefixSketch:'', middleSketch:'', bytes:100000, mtimeMs:index + 1, replacementRatio:0 }
}));
const startedAt = Date.now();
const presentation = buildLibraryVariantPresentation(novels, { queueFingerprintWork:false });
const elapsedMs = Date.now() - startedAt;
assert.equal(presentation.largeGroupPass, 'v649-library-variant-large-group-linear-pass');
assert.equal(presentation.items.length, 1);
assert.equal(presentation.items[0].progressAliases.length, 1000);
assert.equal(presentation.items[0].variantMemberIds.length, 1000);
assert.equal(presentation.byAlias.size, 1000);
assert(elapsedMs < 10000, `large exact-content group took too long: ${elapsedMs}ms`);

const performanceService = createSearchPerformanceService({ env:{ SEARCH_PERFORMANCE_PROFILE:'balanced', SEARCH_SERVER_CORES:'4' } });
const originalExists = fs.existsSync;
const originalRead = fs.readFileSync;
fs.existsSync = () => { throw new Error('request-path existsSync called'); };
fs.readFileSync = () => { throw new Error('request-path readFileSync called'); };
try {
  const snapshot = performanceService.getProfile();
  assert.equal(snapshot.snapshotPass, 'v649-search-profile-snapshot-pass');
} finally {
  fs.existsSync = originalExists;
  fs.readFileSync = originalRead;
}

const routes = fs.readFileSync(path.join(root, 'server/routes/novels-routes.js'), 'utf8');
assert(!/progressAliases[^\n]*slice\(0,\s*128\)/.test(routes));
assert(!/variantMemberIds[^\n]*slice\(0,\s*128\)/.test(routes));
assert.equal(isHistoricalReleaseArtifact('dependency-inventory-v648.json', 649), true);
assert.equal(isHistoricalReleaseArtifact('txt_reader_v648_validation.json', 649), true);
assert.equal(isHistoricalReleaseArtifact('dependency-inventory-v649.json', 649), false);
assert.equal(isHistoricalReleaseArtifact('txt_reader_v649_validation.json', 649), false);

const runner = fs.readFileSync(path.join(root, 'tools/run_smoke_tests.js'), 'utf8');
for (const marker of ['explicitStaticOnly', "'static-only'", 'result.status === 77']) assert(runner.includes(marker), `smoke runner missing ${marker}`);
const inventoryGenerator = fs.readFileSync(path.join(root, 'tools/generate_dependency_inventory.js'), 'utf8');
assert(inventoryGenerator.includes('licenseInventoryComplete'));
assert(inventoryGenerator.includes('unresolved dependency licenses'));

console.log(JSON.stringify({
  pass:'v649-audit-fixes-smoke-pass',
  largeGroupMembers:1000,
  largeGroupElapsedMs:elapsedMs,
  aliasCount:presentation.byAlias.size,
  requestPathSyncFsReads:0
}));
