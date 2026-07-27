#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  applyUserTagImport,
  createUserTagRecords,
  normalizeUserTagRecords,
  userTagRecordsToState
} from '../../public/scripts/rebuild/features/bookmarks/read-data-import-user-tags.mjs';
import {
  applyReadDataSnapshot,
  normalizeRollbackSnapshot,
  rollbackCounts
} from '../../public/scripts/rebuild/features/bookmarks/read-data-rollback.mjs';

const store = new Map();
globalThis.localStorage = {
  getItem:key => store.has(key) ? store.get(key) : null,
  setItem:(key,value) => store.set(key,String(value)),
  removeItem:key => store.delete(key)
};

const current = createUserTagRecords(['판타지'], { 'novel-a':['판타지'] });
const incoming = createUserTagRecords(['판타지','완결'], { 'novel-b':['판타지','완결'] });
const merged = applyUserTagImport(current, incoming, 'merge');
const mergedState = userTagRecordsToState(merged);
assert.deepStrictEqual(mergedState.userTags, ['판타지','완결']);
assert.deepStrictEqual(mergedState.novelUserTags, { 'novel-a':['판타지'], 'novel-b':['판타지','완결'] });

const malicious = userTagRecordsToState([{ tag:'판타지', novelIds:['__proto__','prototype','constructor','novel-safe'] }]);
assert.deepStrictEqual(malicious.novelUserTags, { 'novel-safe':['판타지'] });
assert.strictEqual(Object.getPrototypeOf(malicious.novelUserTags), Object.prototype);


const normalized = normalizeRollbackSnapshot({
  schema:'txt-reader-read-data-rollback-v1',
  createdAt:'2026-07-21T00:00:00.000Z',
  favorites:['novel-a'],
  userTags:['판타지','완결'],
  novelUserTags:{ 'novel-a':['판타지'], 'novel-b':['완결'] }
});
assert.deepStrictEqual(normalized.userTags, ['판타지','완결']);
assert.deepStrictEqual(normalized.novelUserTags, { 'novel-a':['판타지'], 'novel-b':['완결'] });
assert.equal(rollbackCounts(normalized).userTags, 2);
assert.equal(normalizeUserTagRecords(normalized).length, 2);

let persisted = 0;
const app = {
  state:{ progress:{}, bookmarks:[], recents:[], favorites:new Set(), userTags:[], novelUserTags:{}, readDataImportPreview:{}, libraryViewMode:'shelf', libraryShelfFacetsLoaded:true, libraryShelfFacets:{tags:[{value:'old',count:1}]} },
  reader:{ persistProgress:()=>{ persisted += 1; } },
  bookmarks:{ persist:()=>{ persisted += 1; }, render:()=>{} },
  library:{ render:()=>{}, loadShelf:async options=>{ app.__shelfReload = options; } }
};
applyReadDataSnapshot(app, normalized);
assert.deepStrictEqual(app.state.userTags, ['판타지','완결']);
assert.deepStrictEqual(app.state.novelUserTags, { 'novel-a':['판타지'], 'novel-b':['완결'] });
assert.equal(app.state.readDataImportPreview, null);
assert(persisted >= 2, 'restored user tags must be persisted and synchronized');
assert.equal(app.state.libraryShelfFacetsLoaded, false, 'tag restore must invalidate shelf facets');
assert.equal(app.__shelfReload?.source, 'read-data-user-tags-updated', 'tag restore must reload the shelf');

const importSource = fs.readFileSync('public/scripts/rebuild/features/bookmarks/read-data-import.mjs','utf8');
const modalSource = fs.readFileSync('public/scripts/rebuild/features/bookmarks/read-data-modal.mjs','utf8');
assert(importSource.includes("policies.userTags !== 'skip'"), 'user-tag import orchestration missing');
assert(importSource.includes('userTagRecords: preview.rollback.userTagRecords'), 'rollback payload must include user tags');
assert(modalSource.includes('novelUserTags: { ...(app.state.novelUserTags || {}) }'), 'read-data export must include user-tag assignments');

console.log(JSON.stringify({ pass:'v601-read-data-user-tags-smoke-pass', definitions:mergedState.userTags.length, assignments:Object.keys(mergedState.novelUserTags).length }));
