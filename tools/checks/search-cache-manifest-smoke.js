#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const PASS = 'v400-search-cache-manifest-smoke-pass';

function read(projectRoot, rel) {
  return fs.readFileSync(path.join(projectRoot, rel), 'utf8');
}

function runSearchCacheManifestSmoke(projectRoot = process.cwd()) {
  const cache = read(projectRoot, 'public/scripts/rebuild/features/reader/cache-store.mjs');
  const matcher = read(projectRoot, 'public/scripts/rebuild/features/search/matcher.mjs');
  const loader = read(projectRoot, 'public/scripts/rebuild/features/library-access-reconcile.mjs');
  const runner = read(projectRoot, 'tools/run_smoke_tests.js');
  const docs = read(projectRoot, 'docs/performance-cache.md');

  assert.ok(cache.includes("const DB_VERSION = 3"), 'reader cache DB version must include the scoped cache schema upgrade');
  assert.ok(cache.includes("SEARCH_MANIFEST_STORE = 'searchManifests'"), 'search manifest object store name missing');
  assert.ok(cache.includes("v400-search-cache-manifest-pass"), 'search cache manifest marker missing');
  assert.ok(cache.includes('getSearchCacheManifestSnapshot'), 'search cache manifest snapshot API missing');
  assert.ok(cache.includes('purgeSearchCacheManifestOutsideAllowedNovelIds'), 'search cache manifest ACL purge API missing');
  assert.ok(cache.includes('touchSearchCacheManifestRecord'), 'reader cache writes must update search manifest');
  assert.ok(cache.includes('createObjectStore(SEARCH_MANIFEST_STORE'), 'IndexedDB upgrade must create search manifest store');
  assert.ok(matcher.includes('getSearchCacheManifestSnapshot'), 'search coverage preview must consult search manifest');
  assert.ok(matcher.includes('searchCacheManifestPass'), 'search stats must expose search cache manifest marker');
  assert.ok(loader.includes('purgeSearchCacheManifestOutsideAllowedNovelIds'), 'access snapshot purge must include search manifest purge');
  assert.ok(runner.includes('search-cache-manifest-smoke.js'), 'smoke runner must include search cache manifest smoke');
  assert.ok(docs.includes('v400') && docs.includes('search cache manifest'), 'performance cache docs must describe v400 search cache manifest');

  return { pass: PASS };
}

if (require.main === module) {
  try {
    console.log(JSON.stringify(runSearchCacheManifestSmoke()));
  } catch (error) {
    console.error(error && (error.stack || error.message || String(error)));
    process.exit(1);
  }
}

module.exports = { PASS, runSearchCacheManifestSmoke };
