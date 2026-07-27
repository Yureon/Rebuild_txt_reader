#!/usr/bin/env node
'use strict';
const assert = require('assert');
const Module = require('module');

const routes = new Map();
const fakeRouter = {
  get(routePath, ...handlers) { routes.set(`GET ${routePath}`, handlers[handlers.length - 1]); return this; },
  post() { return this; }, put() { return this; }, patch() { return this; }, delete() { return this; }, use() { return this; }, param() { return this; }
};
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (parent && /server[\\/]routes[\\/]novels-routes\.js$/u.test(parent.filename || '')) {
    if (request === '../utils/async-route') return { createAsyncSafeRouter:() => fakeRouter };
    if (request === '../services/library-access-service') return {
      getUserLibraryAccessFromRequest:() => ({ ok:true, session:{ kind:'user', userId:'v677-user' }, access:{ mode:'all', folders:[] } }),
      filterLibraryByAccess:library => library,
      assertNovelAllowed(){}, assertEpisodeAllowed(){}
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const { createNovelsRouter, LIBRARY_TREE_CURSOR_PASS, LIBRARY_FOLDER_FILTER_CURSOR_PASS, LIBRARY_STATE_REVISION_SPLIT_PASS } = require('../../server/routes/novels-routes');
Module._load = originalLoad;

function response() {
  const headers = new Map();
  return {
    statusCode:200, body:null, writableEnded:false,
    setHeader(name, value) { headers.set(String(name).toLowerCase(), value); },
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; this.writableEnded = true; return this; },
    end() { this.writableEnded = true; return this; }, headers
  };
}
function novel(index) {
  return {
    id:`novel-${index}`,
    title:`작품 ${String(index).padStart(6, '0')}`,
    author:`작가 ${index % 100}`,
    singlePath:`root/f${index}/work-${index}.txt`,
    categoryPath:`root/f${index}`,
    category:['root', `f${index}`],
    isMultiFile:false,
    progressAliases:[`novel-${index}`],
    tags:[], genres:[], episodes:[]
  };
}

(async () => {
  const total = 80_000;
  const library = Array.from({ length:total }, (_, index) => novel(index));
  const shared = { favorites:[], recents:[], userTags:[], novelUserTags:{}, sharedVersion:1, sharedUpdatedAt:1 };
  const libraryService = {
    getLibraryCached:() => library,
    getShelfTitleCatalog:() => library,
    setLibraryMetaHeaders(res) { res.setHeader('X-Library-Signature', 'v677-80k'); }
  };
  createNovelsRouter({
    libraryPath:'/fixture', libraryService, contentService:{}, sessionStore:{},
    accountService:{ getUserAccessSnapshot:() => ({ accessVersion:1 }) },
    userStateServiceManager:{ readShelfStateForUserId:() => shared }, setNoStore(){}
  });
  const tree = routes.get('GET /novels/tree');
  const folders = routes.get('GET /novels/shelf/filter-folders');
  assert.equal(typeof tree, 'function');
  assert.equal(typeof folders, 'function');

  const first = response();
  await tree({ query:{ limit:'1000' }, headers:{} }, first);
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.cursorPass, LIBRARY_TREE_CURSOR_PASS);
  assert.equal(first.body.stateRevisionPass, LIBRARY_STATE_REVISION_SPLIT_PASS);
  assert.equal(first.body.items.length, 1000);
  assert.equal(first.body.total, total);
  assert(first.body.hasMore && first.body.nextCursor);
  const payloadBytes = Buffer.byteLength(JSON.stringify(first.body));
  assert(payloadBytes < 2 * 1024 * 1024, `tree page payload too large: ${payloadBytes}`);

  const firstEtag = first.getHeader('etag');
  shared.favorites.push({ novelId:'novel-1' });
  shared.sharedVersion += 1;
  const unchangedTree = response();
  await tree({ query:{ limit:'1000' }, headers:{ 'if-none-match':firstEtag } }, unchangedTree);
  assert.equal(unchangedTree.statusCode, 304, 'favorite-only change invalidated tree page');

  const folderFirst = response();
  await folders({ query:{ limit:'500' }, headers:{} }, folderFirst);
  assert.equal(folderFirst.statusCode, 200);
  assert.equal(folderFirst.body.pass, LIBRARY_FOLDER_FILTER_CURSOR_PASS);
  assert.equal(folderFirst.body.items.length, 500);
  assert.equal(folderFirst.body.total, total + 1); // root + every unique child folder
  assert(folderFirst.body.nextCursor);
  const folderEtag = folderFirst.getHeader('etag');
  shared.favorites.push({ novelId:'novel-2' });
  shared.sharedVersion += 1;
  const unchangedFolders = response();
  await folders({ query:{ limit:'500' }, headers:{ 'if-none-match':folderEtag } }, unchangedFolders);
  assert.equal(unchangedFolders.statusCode, 304, 'favorite-only change invalidated folder facets');
  const folderSecond = response();
  await folders({ query:{ limit:'500', cursor:folderFirst.body.nextCursor }, headers:{} }, folderSecond);
  assert.equal(folderSecond.statusCode, 200);
  assert.equal(folderSecond.body.items.length, 500);
  assert(!folderSecond.body.items.some(item => folderFirst.body.items.some(firstItem => firstItem.value === item.value)), 'folder pages overlap');

  const selected = response();
  await folders({ query:{ q:'f79999', selected:'root/f79999', limit:'20' }, headers:{} }, selected);
  assert(selected.body.items.some(item => item.value === 'root/f79999'), 'selected/search folder outside first 500 missing');

  console.log(JSON.stringify({
    pass:'v677-library-tree-folder-cursor-smoke-pass',
    catalogTotal:total,
    firstPage:first.body.items.length,
    payloadBytes,
    favoriteTreeStatus:unchangedTree.statusCode,
    folderTotal:folderFirst.body.total,
    favoriteFolderStatus:unchangedFolders.statusCode,
    selectedFound:true
  }));
})().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
