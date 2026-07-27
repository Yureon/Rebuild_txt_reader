#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

class LocalStorageMock {
  constructor(){ this.map = new Map(); }
  getItem(key){ return this.map.get(String(key)) ?? null; }
  setItem(key,value){ this.map.set(String(key),String(value)); }
  removeItem(key){ this.map.delete(String(key)); }
}
globalThis.localStorage = new LocalStorageMock();

const shelfSource = fs.readFileSync('public/scripts/rebuild/features/library-shelf-runtime.mjs','utf8');
const routeSource = fs.readFileSync('server/routes/novels-routes.js','utf8');
const fingerprintSource = fs.readFileSync('server/services/library-content-fingerprint-service.js','utf8');
const metadataSource = fs.readFileSync('server/services/metadata-store-service.js','utf8');
const librarySource = fs.readFileSync('server/services/library-service.js','utf8');

assert(shelfSource.includes('v646-library-shelf-request-stability-pass'));
assert(shelfSource.includes("['library_warming','library_shelf_busy']"));
assert(shelfSource.includes("source:'shelf-load-stale-preserved'"));
assert(shelfSource.includes('app.state.libraryShelfRequestPromise === sharedPromise'));
assert(routeSource.includes("getPresentationRevision"), 'shelf cache must use applied metadata revision only');
assert(routeSource.includes('LIBRARY_SHELF_BUILD_MAX_PENDING'));
assert(routeSource.includes('libraryPresentationTasks'));
assert(routeSource.includes("error.code = 'LIBRARY_SHELF_BUSY'"));
assert(routeSource.includes("err.code === 'LIBRARY_COLD_BUILD_BACKOFF'"));
assert(routeSource.includes("err.code === 'LIBRARY_COLD_BUILD_FAILED'"));
assert(librarySource.includes('createColdBuildFailedError'));
assert(librarySource.includes('async function getLibraryCachedAsync()'));
assert(librarySource.includes('throw createColdBuildBackoffError(now)')); 
assert(librarySource.includes('v646-library-durable-catalog-pass'));
assert(librarySource.includes('v646-library-cold-failure-backoff-pass'));
assert(librarySource.includes('restoreDurableCatalogSnapshot'));
assert(metadataSource.includes('candidateShardStore.markCandidates') && metadataSource.includes('METADATA_CANDIDATE_SHARD_PASS'));
assert(/markDirty\('applied',\s*\[\],\s*\[recordId\]\)/.test(metadataSource), 'applied mutations must mark the exact applied shard record dirty');
assert(fingerprintSource.includes('v646-library-fingerprint-semantic-revision-pass'));
const unchangedBranch = fingerprintSource.slice(
  fingerprintSource.indexOf('if (existing && existing.bytes === bytes'),
  fingerprintSource.indexOf('const handle = await fs.promises.open', fingerprintSource.indexOf('if (existing && existing.bytes === bytes'))
);
assert(!unchangedBranch.includes('revision += 1'), 'mtime/size verification must not invalidate every shelf presentation');
assert(unchangedBranch.includes('metrics.verificationUpdates += 1'));

const { loadLibraryShelfPageRuntime, LIBRARY_SHELF_REQUEST_STABILITY_PASS } = await import('../../public/scripts/rebuild/features/library-shelf-runtime.mjs');

function createApp(api) {
  return {
    api,
    els:{ novelList:null },
    state:{
      libraryShelfScope:'all',
      libraryShelfSort:'title',
      libraryFilter:'',
      libraryShelfFilters:{},
      libraryShelfItems:[],
      libraryShelfNextCursor:'',
      libraryShelfLoading:false,
      libraryShelfRequestPromise:null,
      libraryShelfRequestKey:'',
      libraryShelfRequestSerial:0,
      libraryShelfDroppedCount:0,
      libraryShelfLoadedCount:0,
      libraryShelfDomLimit:480,
      novelById:new Map(),
      favorites:new Set(),
      progress:{},
      current:null
    }
  };
}

const renderSources = [];
const deps = {
  syncLibraryChrome(){},
  renderLibrary(_app, options={}) { renderSources.push(options.source || ''); },
  toast(){}
};

let calls = 0;
let release;
const firstPayload = new Promise(resolve => { release = resolve; });
const app = createApp({ novelShelf(){ calls += 1; return firstPayload; } });
const first = loadLibraryShelfPageRuntime(app, { reset:true }, deps);
const joined = loadLibraryShelfPageRuntime(app, { reset:true }, deps);
assert.strictEqual(first, joined, 'identical reset requests must share one client promise');
assert.equal(calls, 1);
release({ items:[{ id:'a', title:'A', isMultiFile:false }], total:1, nextCursor:'', counts:{ all:1 } });
const result = await first;
assert.equal(result.pass, LIBRARY_SHELF_REQUEST_STABILITY_PASS);
assert.equal(app.state.libraryShelfItems.length, 1);

let retryCalls = 0;
app.api = {
  async novelShelf() {
    retryCalls += 1;
    if (retryCalls === 1) {
      const error = new Error('warming');
      error.status = 503;
      error.code = 'library_warming';
      throw error;
    }
    return { items:[{ id:'b', title:'B', isMultiFile:false }], total:1, nextCursor:'', counts:{ all:1 } };
  }
};
const originalRandom = Math.random;
Math.random = () => 0;
try {
  await loadLibraryShelfPageRuntime(app, { reset:true }, deps);
} finally {
  Math.random = originalRandom;
}
assert.equal(retryCalls, 2, 'transient warm-up response must use a bounded retry');
assert.equal(app.state.libraryShelfItems[0].id, 'b');

app.api = {
  async novelShelf() {
    const error = new Error('bad request');
    error.status = 400;
    error.code = 'bad_request';
    throw error;
  }
};
await assert.rejects(loadLibraryShelfPageRuntime(app, { reset:true, preserveScroll:true }, deps));
assert.equal(app.state.libraryShelfItems[0].id, 'b', 'transient/failed refresh must not erase the last visible shelf');
assert(renderSources.includes('shelf-load-stale-preserved'));

console.log(JSON.stringify({ pass:'v646-library-request-resilience-pass', coalescedCalls:calls, retryCalls, stalePreserved:true }));
