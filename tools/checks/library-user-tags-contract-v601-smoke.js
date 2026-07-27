#!/usr/bin/env node
const assert = require('assert');
const express = require('express');
const { once } = require('events');
const { createNovelsRouter } = require('../../server/routes/novels-routes');

async function run() {
  let shelfState = { favorites:[], recents:[], userTags:['판타지','완결'], novelUserTags:{ 'novel-a':['판타지'], 'novel-b':['완결'] } };
  const library = [
    { id:'novel-a', title:'태그 작품', singlePath:'허용/태그 작품.txt', categoryPath:'허용', category:['허용'], isMultiFile:false, episodes:[], tags:['메타태그'], progressAliases:['novel-a','novel-a-old'], shelfSearchKey:'태그 작품 메타태그' },
    { id:'novel-b', title:'일반 작품', singlePath:'허용/일반 작품.txt', categoryPath:'허용', category:['허용'], isMultiFile:false, episodes:[], tags:[], shelfSearchKey:'일반 작품' }
  ];
  const app = express();
  app.use(createNovelsRouter({
    libraryPath:'/virtual',
    libraryService:{ getLibraryCached:()=>library, setLibraryMetaHeaders:res=>res.setHeader('X-Library-Signature','user-tags-v601') },
    contentService:{},
    sessionStore:{ getSession:token=>token === 'token' ? {kind:'user',userId:'reader'} : null },
    accountService:{ getUserLibraryAccess:()=>({mode:'all',folders:[]}), getUserAccessSnapshot:()=>({accessVersion:1}) },
    userStateServiceManager:{
      readShelfStateForUserId:()=>shelfState
    },
    setNoStore:res=>res.setHeader('Cache-Control','no-store')
  }));
  const server = app.listen(0,'127.0.0.1');
  await once(server,'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = {cookie:'session_token=token'};
  try {
    const searched = await (await fetch(`${base}/novels/shelf?q=${encodeURIComponent('판타지')}`,{headers})).json();
    assert.deepStrictEqual(searched.items.map(item=>item.id),['novel-a'], 'custom user tag must participate in shelf search');
    const firstFacetResponse = await fetch(`${base}/novels/shelf/filters`,{headers});
    const facets = await firstFacetResponse.json();
    assert.strictEqual(firstFacetResponse.headers.get('x-library-shelf-filters-cache'),'miss');
    assert.strictEqual(facets.total, 2, 'facet API must expose total novel count');
    assert.deepStrictEqual(facets.userTags, ['판타지','완결'], 'facet API must expose user-defined tags');
    assert.strictEqual(facets.tagDistribution.distinct, 3, 'facet API must summarize the full distinct tag distribution');
    assert.strictEqual(facets.tagDistribution.histogram.reduce((sum,item)=>sum+item.tags,0), 3, 'tag distribution histogram must cover every distinct tag');
    assert(facets.facets.tags.some(item=>item.value === '판타지' && item.count === 1));
    const secondFacetResponse = await fetch(`${base}/novels/shelf/filters`,{headers});
    assert.strictEqual(secondFacetResponse.headers.get('x-library-shelf-filters-cache'),'hit', 'unchanged facet request should reuse the bounded response cache');
    shelfState = { favorites:[], recents:[], userTags:['판타지','완결','신규'], novelUserTags:{ 'novel-a':['판타지','신규'], 'novel-b':['완결'] } };
    const changedFacetResponse = await fetch(`${base}/novels/shelf/filters`,{headers});
    const changedFacets = await changedFacetResponse.json();
    assert.strictEqual(changedFacetResponse.headers.get('x-library-shelf-filters-cache'),'miss', 'user-tag state change must invalidate the facet response cache');
    assert(changedFacets.facets.tags.some(item=>item.value === '신규' && item.count === 1));
    assert.strictEqual(changedFacets.tagDistribution.distinct, 4);
    console.log(JSON.stringify({pass:'v601-library-user-tags-contract-smoke-pass',total:facets.total,userTags:facets.userTags.length,cache:'miss-hit-miss'}));
  } finally {
    server.close();
    await once(server,'close');
  }
}
run().catch(error=>{console.error(error.stack||error);process.exit(1)});
