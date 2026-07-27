#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { performance } = require('perf_hooks');

const routes = new Map();
const fakeRouter = {
  get(routePath, ...handlers) { routes.set(`GET ${routePath}`, handlers[handlers.length - 1]); return this; },
  post(routePath, ...handlers) { routes.set(`POST ${routePath}`, handlers[handlers.length - 1]); return this; },
  put(routePath, ...handlers) { routes.set(`PUT ${routePath}`, handlers[handlers.length - 1]); return this; },
  patch(routePath, ...handlers) { routes.set(`PATCH ${routePath}`, handlers[handlers.length - 1]); return this; },
  delete(routePath, ...handlers) { routes.set(`DELETE ${routePath}`, handlers[handlers.length - 1]); return this; },
  use() { return this; },
  param() { return this; }
};

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (parent && /server[\\/]routes[\\/]novels-routes\.js$/u.test(parent.filename || '')) {
    if (request === '../utils/async-route') return { createAsyncSafeRouter:() => fakeRouter };
    if (request === '../services/library-access-service') {
      return {
        getUserLibraryAccessFromRequest:() => ({ ok:true, session:{ kind:'user', userId:'benchmark-user' }, access:{ mode:'all', folders:[] } }),
        filterLibraryByAccess:library => library,
        assertNovelAllowed(){},
        assertEpisodeAllowed(){}
      };
    }
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { createNovelsRouter, LIBRARY_SHELF_HOT_PATH_PASS } = require('../../server/routes/novels-routes');
Module._load = originalLoad;

function createResponse() {
  const headers = new Map();
  return {
    statusCode:200,
    body:null,
    writableEnded:false,
    setHeader(name, value) { headers.set(String(name).toLowerCase(), value); },
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; this.writableEnded = true; return this; },
    end() { this.writableEnded = true; return this; },
    headers
  };
}

function createNovel(index) {
  return {
    id:`novel-${index}`,
    title:`작품 ${String(index).padStart(6, '0')}`,
    author:`작가 ${index % 200}`,
    singlePath:`category/work-${index}.txt`,
    categoryPath:`category/${index % 50}`,
    category:['category', String(index % 50)],
    isMultiFile:false,
    progressAliases:[`novel-${index}`],
    description:`설명 ${index} `.repeat(12),
    synopsis:`소개 ${index} `.repeat(12),
    tags:[`장르-${index % 20}`],
    genres:[`분류-${index % 10}`],
    episodes:[]
  };
}

function legacyDecorateAll(items, shared) {
  return items.map(novel => {
    const definitions = new Map(shared.userTags.map(value => {
      const tag = String(value).trim().slice(0, 40);
      return [tag.toLocaleLowerCase('ko-KR'), tag];
    }));
    const userTags = [];
    for (const id of novel.progressAliases) {
      for (const value of shared.novelUserTags[id] || []) {
        const key = String(value).trim().slice(0, 40).toLocaleLowerCase('ko-KR');
        const tag = definitions.get(key);
        if (tag && !userTags.includes(tag)) userTags.push(tag);
      }
    }
    const tags = [...novel.tags, ...userTags];
    const shelfSearchKey = [novel.title, novel.author, novel.description, novel.synopsis, novel.categoryPath, ...novel.category, ...tags, ...novel.genres, ...userTags]
      .join(' ').replace(/\s+/g, ' ').trim().slice(0, 32768).toLocaleLowerCase('ko-KR');
    return { ...novel, userTags, tags, shelfSearchKey };
  });
}

(async () => {
  const fixtureCount = 20_000;
  const library = Array.from({ length:fixtureCount }, (_, index) => createNovel(index));
  const userTags = Array.from({ length:200 }, (_, index) => `사용자태그-${index}`);
  const novelUserTags = {};
  for (let index = 0; index < fixtureCount; index += 1) novelUserTags[`novel-${index}`] = [`사용자태그-${index % 200}`];
  const shared = { favorites:[], recents:[], userTags, novelUserTags, sharedVersion:7, sharedUpdatedAt:123456 };

  const libraryService = {
    getLibraryCached:() => library,
    setLibraryMetaHeaders(res) { res.setHeader('X-Library-Signature', 'fixture-signature'); }
  };
  const userStateServiceManager = { readShelfStateForUserId:() => shared };
  const accountService = { getUserAccessSnapshot:() => ({ accessVersion:1 }) };
  createNovelsRouter({
    libraryPath:'/fixture',
    libraryService,
    contentService:{},
    sessionStore:{},
    accountService,
    userStateServiceManager,
    setNoStore(){}
  });

  assert.equal(LIBRARY_SHELF_HOT_PATH_PASS, 'v673-library-shelf-hot-path-pass');
  const shelfHandler = routes.get('GET /novels/shelf');
  const treeHandler = routes.get('GET /novels/tree');
  assert.equal(typeof shelfHandler, 'function');
  assert.equal(typeof treeHandler, 'function');

  const baselineStarted = performance.now();
  const legacy = legacyDecorateAll(library, shared);
  const baselineMs = performance.now() - baselineStarted;
  assert.equal(legacy.length, fixtureCount);

  const shelfReq = { query:{ limit:'48', scope:'all', sort:'title' }, headers:{} };
  const shelfRes = createResponse();
  const shelfStarted = performance.now();
  await shelfHandler(shelfReq, shelfRes);
  const shelfMs = performance.now() - shelfStarted;
  assert.equal(shelfRes.statusCode, 200);
  assert.equal(shelfRes.body?.hotPathPass, LIBRARY_SHELF_HOT_PATH_PASS);
  assert.equal(shelfRes.body?.items?.length, 48);
  assert.equal(shelfRes.body.items[0].userTags.length, 1);
  assert(shelfMs < baselineMs * 0.8, `plain shelf ${shelfMs.toFixed(1)}ms was not materially below legacy decoration ${baselineMs.toFixed(1)}ms`);

  const treeFirstRes = createResponse();
  await treeHandler({ query:{}, headers:{} }, treeFirstRes);
  assert.equal(treeFirstRes.statusCode, 200);
  assert.equal(treeFirstRes.body?.hotPathPass, LIBRARY_SHELF_HOT_PATH_PASS);
  const etag = treeFirstRes.getHeader('ETag');
  assert(etag);

  const treeConditionalRes = createResponse();
  const conditionalStarted = performance.now();
  await treeHandler({ query:{}, headers:{ 'if-none-match':etag } }, treeConditionalRes);
  const conditionalMs = performance.now() - conditionalStarted;
  assert.equal(treeConditionalRes.statusCode, 304);
  assert.equal(treeConditionalRes.body, null);
  assert(conditionalMs < Math.max(50, shelfMs * 0.25), `conditional tree response took ${conditionalMs.toFixed(1)}ms`);

  const source = fs.readFileSync(path.join(process.cwd(), 'server/routes/novels-routes.js'), 'utf8');
  assert(source.includes('const needsUserTagDecoration = !!search || normalizedQuery.tags.length > 0;'));
  assert(source.indexOf('if (clientHasMatchingEtag(req, etag))') < source.indexOf('const items = catalog.items.map(item => decorateSerializedNovelWithUserTags'));
  assert(!source.includes('let items = (titleCatalog || filtered).map(novel => withUserTags(novel, shared));'));

  console.log(JSON.stringify({
    pass:'v673-library-shelf-hot-path-pass',
    fixtureNovels:fixtureCount,
    userTagDefinitions:userTags.length,
    legacyDecorationMs:Number(baselineMs.toFixed(2)),
    plainShelfMs:Number(shelfMs.toFixed(2)),
    improvementRatio:Number((baselineMs / shelfMs).toFixed(1)),
    conditionalTreeMs:Number(conditionalMs.toFixed(2)),
    pageItems:shelfRes.body.items.length
  }));
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
