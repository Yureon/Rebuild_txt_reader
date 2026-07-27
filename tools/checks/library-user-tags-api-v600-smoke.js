#!/usr/bin/env node
const assert = require('assert');
const express = require('express');
const { once } = require('events');
const { createNovelsRouter } = require('../../server/routes/novels-routes');

async function run() {
  const library = [
    { id:'novel-a', title:'태그 작품', singlePath:'허용/태그 작품.txt', categoryPath:'허용', category:['허용'], isMultiFile:false, episodes:[], tags:['메타태그'], progressAliases:['novel-a','novel-a-old'] },
    { id:'novel-b', title:'일반 작품', singlePath:'허용/일반 작품.txt', categoryPath:'허용', category:['허용'], isMultiFile:false, episodes:[], tags:[] }
  ];
  const app = express();
  app.use(createNovelsRouter({
    libraryPath:'/virtual',
    libraryService:{ getLibraryCached:()=>library, setLibraryMetaHeaders:res=>res.setHeader('X-Library-Signature','user-tags-v600') },
    contentService:{},
    sessionStore:{ getSession:token=>token === 'token' ? {kind:'user',userId:'reader'} : null },
    accountService:{ getUserLibraryAccess:()=>({mode:'all',folders:[]}), getUserAccessSnapshot:()=>({accessVersion:1}) },
    userStateServiceManager:{
      readShelfStateForUserId:()=>({
        favorites:[], recents:[], userTags:['판타지','완결'], novelUserTags:{ 'novel-a':['판타지'], 'novel-b':['완결'] }
      })
    },
    setNoStore:res=>res.setHeader('Cache-Control','no-store')
  }));
  const server = app.listen(0,'127.0.0.1');
  await once(server,'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = {cookie:'session_token=token'};
  try {
    const shelf = await (await fetch(`${base}/novels/shelf`,{headers})).json();
    const tagged = shelf.items.find(item=>item.id === 'novel-a');
    assert.deepStrictEqual(tagged.userTags,['판타지']);
    assert.deepStrictEqual(tagged.tags,['메타태그','판타지']);
    const filtered = await (await fetch(`${base}/novels/shelf?tag=${encodeURIComponent('완결')}`,{headers})).json();
    assert.deepStrictEqual(filtered.items.map(item=>item.id),['novel-b']);
    const facets = await (await fetch(`${base}/novels/shelf/filters`,{headers})).json();
    assert(facets.facets.tags.some(item=>item.value === '판타지'));
    assert(facets.facets.tags.some(item=>item.value === '완결'));
    const tree = await (await fetch(`${base}/novels/tree`,{headers})).json();
    assert.deepStrictEqual(tree.items.find(item=>item.id === 'novel-b').userTags,['완결']);
    console.log(JSON.stringify({pass:'v600-library-user-tags-api-smoke-pass',shelf:shelf.items.length,facets:facets.facets.tags.length}));
  } finally {
    server.close();
    await once(server,'close');
  }
}
run().catch(error=>{console.error(error.stack||error);process.exit(1)});
