#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildLibraryPageUrlForReader, readLibraryNavigationContext, novelMatchesNavigationTarget } from '../../public/scripts/rebuild/features/library-navigation-context.mjs';
import { libraryShelfFilterCount, libraryShelfFilterSignature, toggleLibraryShelfFilterValue } from '../../public/scripts/rebuild/features/library-shelf-filters.mjs';
import { loadFullLibraryCatalogRuntime, loadLibraryShelfPageRuntime } from '../../public/scripts/rebuild/features/library-shelf-runtime.mjs';
import { applyLibraryCatalogState } from '../../public/scripts/rebuild/features/library-load-state.mjs';
import { persistLibraryUi } from '../../public/scripts/rebuild/state/app-state.mjs';
import { setStorageScope, getScopedStorageKey } from '../../public/scripts/rebuild/core/storage.mjs';

const locationObject = { origin:'https://reader.example', href:'https://reader.example/site.html?novelId=old&episodeId=old-ep' };
const readerApp = { state:{ current:{ novel:{ id:'novel-42' }, episode:{ id:'episode-7' } } } };
const url = buildLibraryPageUrlForReader(readerApp, { locationObject, view:'shelf' });
assert.equal(url, '/library.html?focusNovelId=novel-42&focusEpisodeId=episode-7&view=shelf&from=reader');
const context = readLibraryNavigationContext({ origin:'https://reader.example', href:`https://reader.example${url}` });
assert.equal(context.novelId, 'novel-42');
assert.equal(context.episodeId, 'episode-7');
assert.equal(context.shelfPending, true);
assert.equal(context.treePending, true);
assert.equal(novelMatchesNavigationTarget({ id:'representative', progressAliases:['novel-42'] }, context), true);

let filters = toggleLibraryShelfFilterValue({}, 'authors', '홍길동');
filters = toggleLibraryShelfFilterValue(filters, 'categories', '판타지');
filters = toggleLibraryShelfFilterValue(filters, 'publicationStatuses', 'complete');
assert.equal(libraryShelfFilterCount(filters), 3);
assert.match(libraryShelfFilterSignature(filters), /authors:홍길동/);
filters = toggleLibraryShelfFilterValue(filters, 'authors', '홍길동');
assert.equal(libraryShelfFilterCount(filters), 2);

const previousLocalStorage = globalThis.localStorage;
const stored = new Map();
globalThis.localStorage = {
  getItem(key){ return stored.has(key) ? stored.get(key) : null; },
  setItem(key, value){ stored.set(key, String(value)); },
  removeItem(key){ stored.delete(key); }
};
try {
  setStorageScope('navigation-test-user');
  const persistedFilters = { publicationStatuses:['complete'], authors:['기존 작가'], categories:['기존 폴더'], tags:[], groupKinds:['series'] };
  const navigationUiState = {
    expandedEpisodeNovels:new Set(), collapsedFolders:new Set(), libraryViewMode:'files',
    libraryShelfScope:'all', libraryShelfSort:'title', libraryShelfFilters:{},
    libraryNavigationPersistedUi:{ scope:'favorites', sort:'recent', filters:persistedFilters }
  };
  persistLibraryUi(navigationUiState);
  assert.equal(JSON.parse(stored.get(getScopedStorageKey('libraryShelfScope'))), 'favorites');
  assert.equal(JSON.parse(stored.get(getScopedStorageKey('libraryShelfSort'))), 'recent');
  assert.deepEqual(JSON.parse(stored.get(getScopedStorageKey('libraryShelfFilters'))), persistedFilters);
  navigationUiState.libraryNavigationPersistedUi = null;
  navigationUiState.libraryShelfFilters = filters;
  persistLibraryUi(navigationUiState);
  assert.deepEqual(JSON.parse(stored.get(getScopedStorageKey('libraryShelfFilters'))), filters);
} finally {
  if (previousLocalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = previousLocalStorage;
}

const shelfCalls = [];
const shelfApp = {
  state:{
    libraryShelfScope:'all', libraryShelfSort:'title', libraryFilter:'', libraryShelfFilters:filters,
    libraryShelfItems:[], libraryShelfNextCursor:'', libraryShelfTotal:0, libraryShelfCounts:{},
    libraryShelfLoading:false, libraryShelfAbortController:null, libraryShelfRequestSerial:0,
    libraryShelfLoadedKey:'', libraryShelfError:'', libraryFullCatalogLoaded:false,
    libraryCatalogMode:'shelf', novels:[], novelById:new Map(), favorites:new Set(), progress:{},
    libraryNavigationTarget:{ ...context }
  },
  api:{
    async novelShelf(args) {
      shelfCalls.push(args);
      return { items:[{ id:'representative', title:'대상 작품', isMultiFile:false, progressAliases:['novel-42'] }], total:1, counts:{all:1,favorites:0,recent:0}, focus:{found:true,index:0,offset:0} };
    }
  }
};
let shelfRenderOptions = null;
await loadLibraryShelfPageRuntime(shelfApp, { reset:true }, { renderLibrary(_app, options){ shelfRenderOptions = options; }, syncLibraryChrome(){}, toast(){} });
assert.equal(shelfCalls.length, 1);
assert.equal(shelfCalls[0].focusNovelId, 'novel-42');
assert.deepEqual(shelfCalls[0].filters.categories, ['판타지']);
assert.equal(shelfRenderOptions.followActive, true);
assert.equal(shelfRenderOptions.resetScroll, false);
assert.equal(shelfApp.state.libraryNavigationTarget.shelfPending, false);

let novelsCalls = 0;
let treeCalls = 0;
let episodeCalls = 0;
const treeApp = {
  state:{
    libraryFullCatalogLoaded:false, libraryFullCatalogRequest:null, libraryShelfLoading:false,
    libraryShelfError:'', libraryNavigationTarget:{ ...context }, novels:[], novelById:new Map(),
    collapsedFolders:new Set(['장르','장르>판타지']), expandedEpisodeNovels:new Set(),
    favorites:new Set(), progress:{}, libraryTreeModelCache:null
  },
  api:{
    async novels(){ novelsCalls += 1; return []; },
    async novelTree(){ treeCalls += 1; return { items:[{ id:'representative', title:'대상 작품', category:['장르','판타지'], categoryPath:'장르 > 판타지', isMultiFile:true, episodeCount:2, episodes:[], episodesLoaded:false, progressAliases:['representative','novel-42'] }] }; },
    async novelEpisodes(){ episodeCalls += 1; return { episodes:[{ id:'episode-6', title:'6화' }, { id:'episode-7', title:'7화' }] }; }
  },
  els:{}
};
let treeRenderOptions = null;
await loadFullLibraryCatalogRuntime(treeApp, { resetScroll:true }, {
  applyLibraryCatalogState,
  renderLibrary(_app, options){ treeRenderOptions = options; },
  syncLibraryChrome(){}, showLoading(){}, status(){}, toast(){ throw new Error('tree load should not toast'); }
});
assert.equal(treeCalls, 1);
assert.equal(novelsCalls, 0, 'compact tree endpoint must replace the full episode catalog');
assert.equal(episodeCalls, 1, 'only the focused novel episodes should be loaded');
assert.equal(treeApp.state.current.novel.id, 'representative');
assert.equal(treeApp.state.current.episode.id, 'episode-7');
assert.equal(treeApp.state.collapsedFolders.has('장르'), false);
assert.equal(treeApp.state.collapsedFolders.has('장르>판타지'), false);
assert.equal(treeApp.state.expandedEpisodeNovels.has('representative'), true);
assert.equal(treeRenderOptions.followActive, true);
assert.equal(treeRenderOptions.resetScroll, false);

console.log(JSON.stringify({ pass:'v575-library-navigation-filter-tree-smoke-pass', treeCalls, episodeCalls }));
