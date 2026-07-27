#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

class LocalStorageMock {
  constructor(){ this.map = new Map(); }
  get length(){ return this.map.size; }
  key(index){ return [...this.map.keys()][index] ?? null; }
  getItem(key){ return this.map.get(String(key)) ?? null; }
  setItem(key,value){ this.map.set(String(key),String(value)); }
  removeItem(key){ this.map.delete(String(key)); }
}
globalThis.localStorage = new LocalStorageMock();

const shelf = fs.readFileSync('public/scripts/rebuild/features/library-shelf-runtime.mjs','utf8');
const main = fs.readFileSync('public/scripts/rebuild/main.mjs','utf8');
const routes = fs.readFileSync('server/routes/novels-routes.js','utf8');
const variants = fs.readFileSync('server/services/library-variant-service.js','utf8');
const env = fs.readFileSync('.env.example','utf8');

assert(!shelf.includes("window.setTimeout(() => maybeAutoLoad('render'), 180)"), 'render completion must not recursively request every shelf page');
assert(shelf.includes("on(app.els.novelList, 'wheel', event =>") && shelf.includes('markAutoLoadUserActivity();'), 'wheel intent gate missing');
assert(shelf.includes("on(app.els.novelList, 'touchmove', event =>") && shelf.includes('markAutoLoadUserActivity();'), 'touch intent gate missing');
assert(shelf.includes('activitySerial <= lastRequestActivitySerial'), 'one-request-per-user-activity gate missing');
assert(main.includes("deferRestrictedDetails:profile === 'library'"), 'library profile must defer full restricted ACL IDs');
assert(routes.includes('LIBRARY_FINGERPRINT_ENTRY_DELAY_MS'), 'fingerprint entry delay missing');
assert(routes.includes('queueFingerprintWork:false'), 'request-path presentation must not directly queue fingerprint reads');
assert(variants.includes('options.queueFingerprintWork !== false'), 'variant service queue control missing');
assert(variants.includes('queueRefresh:options.queueFingerprintWork !== false'), 'stale fingerprint refresh must honor the request-path queue gate');
assert(variants.includes("if (options.queueFingerprintWork !== false) options.fingerprintService?.requestCandidates"), 'candidate fingerprint queue must honor the request-path queue gate');
assert(env.includes('LIBRARY_FINGERPRINT_ENTRY_DELAY_MS=15000'), 'fingerprint entry delay env contract missing');

const { initializeAccessBootstrap } = await import('../../public/scripts/rebuild/core/user-scope-bootstrap.mjs');
let detailedCalls = 0;
const base = { ok:true, userId:'restricted-mobile', allNovelsAccessible:false, libraryAccess:{ mode:'folders', folders:['A'] }, accessVersion:2 };
const app = {
  state:{},
  api:{ async userAccessSnapshot(options={}) { if (options.includeNovelIds) detailedCalls += 1; return { ...base, accessibleNovelIds:[], accessibleNovelIdsIncluded:true }; } }
};
const result = await initializeAccessBootstrap(app, { snapshot:base }, { deferRestrictedDetails:true });
assert.equal(result, base);
assert.equal(detailedCalls, 0, 'library boot must not block on the complete accessible ID list');
assert.equal(app.state.userAccessBootstrap?.deferred, true);

const require = createRequire(import.meta.url);
const { buildLibraryVariantPresentation } = require('../../server/services/library-variant-service.js');
const fingerprintCalls = { getCached:0, requestLibrary:0, requestCandidates:0, queueRefresh:[] };
const fingerprintService = {
  getCached(novel, options={}) { fingerprintCalls.getCached += 1; fingerprintCalls.queueRefresh.push(options.queueRefresh); return null; },
  requestLibrary() { fingerprintCalls.requestLibrary += 1; },
  requestCandidates() { fingerprintCalls.requestCandidates += 1; }
};
buildLibraryVariantPresentation([
  { id:'a', title:'부하 검증 1-10', singlePath:'부하 검증 1-10.txt', isMultiFile:false },
  { id:'b', title:'부하 검증 1-10-1', singlePath:'부하 검증 1-10-1.txt', isMultiFile:false }
], { fingerprintService, queueFingerprintWork:false });
assert.equal(fingerprintCalls.requestLibrary, 0, 'request path must not enqueue a library fingerprint batch');
assert.equal(fingerprintCalls.requestCandidates, 0, 'request path must not enqueue candidate fingerprint reads');
assert(fingerprintCalls.getCached >= 2);
assert(fingerprintCalls.queueRefresh.every(value => value === false), 'request path must read cached fingerprints without stale-refresh I/O');

console.log(JSON.stringify({ pass:'v644-library-entry-load-budget-pass', detailedCalls, fingerprintCalls }));
