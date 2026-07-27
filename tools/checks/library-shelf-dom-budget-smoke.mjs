#!/usr/bin/env node
import assert from 'node:assert/strict';
import { loadLibraryShelfPageRuntime, LIBRARY_SHELF_DOM_LIMIT, LIBRARY_SHELF_DOM_BUDGET_PASS } from '../../public/scripts/rebuild/features/library-shelf-runtime.mjs';
const PAGE = 48;
let call = 0;
const app = {
  state:{
    libraryShelfScope:'all', libraryShelfSort:'title', libraryFilter:'', libraryShelfNextCursor:'', libraryShelfLoading:false,
    libraryShelfAbortController:null, libraryShelfRequestSerial:0, libraryShelfItems:[], libraryShelfTotal:0, libraryShelfCounts:{},
    libraryShelfLoadedKey:'', libraryCatalogMode:'shelf', libraryFullCatalogLoaded:false, libraryShelfDomLimit:LIBRARY_SHELF_DOM_LIMIT,
    libraryShelfLoadedCount:0, libraryShelfDroppedCount:0, libraryShelfPrunedLastCount:0, libraryShelfPrunedNovelMapCount:0,
    novelById:new Map(), novels:[], favorites:new Set(['novel-1']), current:{ novel:{ id:'novel-2' } }, progress:{ lastRead:null },
    libraryFilteredNovelsCache:null, libraryVirtualRowsCache:null
  },
  api:{
    async novelShelf(){
      const start = call * PAGE + 1;
      call += 1;
      const items = Array.from({ length:PAGE }, (_, index) => ({ id:`novel-${start + index}`, title:`Novel ${start + index}`, isMultiFile:false, episodes:[], episodesLoaded:true }));
      return { items, total:PAGE * 11, nextCursor:call < 11 ? `cursor-${call}` : '', counts:{ all:PAGE * 11, favorites:1, recent:0 } };
    }
  }
};
const deps = { syncLibraryChrome(){}, renderLibrary(){} };
await loadLibraryShelfPageRuntime(app, { reset:true }, deps);
for (let index = 1; index < 11; index += 1) await loadLibraryShelfPageRuntime(app, { reset:false }, deps);
assert.equal(app.state.libraryShelfLoadedCount, 528);
assert.equal(app.state.libraryShelfItems.length, LIBRARY_SHELF_DOM_LIMIT);
assert.equal(app.state.libraryShelfDroppedCount, 48);
assert.ok(app.state.libraryShelfPrunedNovelMapCount >= 46, 'pruned catalog entries must be removed from the map');
assert.ok(app.state.novelById.has('novel-1'), 'favorite pruned item must remain protected');
assert.ok(app.state.novelById.has('novel-2'), 'current pruned item must remain protected');
assert.ok(app.state.novelById.size <= LIBRARY_SHELF_DOM_LIMIT + 2, 'catalog map must remain bounded apart from protected items');
console.log(JSON.stringify({ pass:'v569-library-shelf-dom-budget-smoke-pass', marker:LIBRARY_SHELF_DOM_BUDGET_PASS, retained:app.state.libraryShelfItems.length, map:app.state.novelById.size, dropped:app.state.libraryShelfDroppedCount }));
