#!/usr/bin/env node
const assert = require('assert');
const express = require('express');
const { once } = require('events');
const { createNovelsRouter } = require('../../server/routes/novels-routes');

async function run() {
  const library=Array.from({length:620},(_,i)=>({ id:`novel-${i}`, title:`태그 작품 ${i}`, singlePath:`허용/태그-${i}.txt`, categoryPath:'허용', category:['허용'], isMultiFile:false, episodes:[], tags:[`태그-${String(i).padStart(4,'0')}`], shelfSearchKey:`태그 작품 ${i}` }));
  const app=express();
  app.use(createNovelsRouter({
    libraryPath:'/virtual', libraryService:{getLibraryCached:()=>library,setLibraryMetaHeaders:res=>res.setHeader('X-Library-Signature','tag-page-v602')}, contentService:{},
    sessionStore:{getSession:token=>token==='token'?{kind:'user',userId:'reader'}:null},
    accountService:{getUserLibraryAccess:()=>({mode:'all',folders:[]}),getUserAccessSnapshot:()=>({accessVersion:1})},
    userStateServiceManager:{readShelfStateForUserId:()=>({favorites:[],recents:[],userTags:[],novelUserTags:{}})}, setNoStore:res=>res.setHeader('Cache-Control','no-store')
  }));
  const server=app.listen(0,'127.0.0.1'); await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`; const headers={cookie:'session_token=token'};
  try {
    const first=await (await fetch(`${base}/novels/shelf/filters`,{headers})).json();
    assert.equal(first.facets.tags.length,500);
    assert.equal(first.tagPage.total,620);
    assert.equal(first.tagPage.hasMore,true);
    const second=await (await fetch(`${base}/novels/shelf/filter-tags?limit=500&minCount=1&cursor=${encodeURIComponent(first.tagPage.nextCursor)}`,{headers})).json();
    assert.equal(second.items.length,120);
    assert.equal(second.hasMore,false);
    assert.equal(new Set([...first.facets.tags,...second.items].map(item=>item.value)).size,620,'all tag names must be reachable');
    const one=await (await fetch(`${base}/novels/shelf/filter-tags?limit=1&minCount=1`,{headers})).json();
    assert.equal(one.items.length,1,'tag page limit contract must accept one item');
    const mismatched=await (await fetch(`${base}/novels/shelf/filter-tags?limit=5&minCount=2&cursor=${encodeURIComponent(first.tagPage.nextCursor)}`,{headers})).json();
    assert.equal(mismatched.cursorReset,true,'cursor from a different threshold must reset safely');
    assert.equal(mismatched.items.length,0,'minCount prefix must avoid scanning unrelated sparse tags');
    console.log(JSON.stringify({pass:'v602-library-tag-pagination-smoke-pass',total:first.tagPage.total,page2:second.items.length}));
  } finally { server.close(); await once(server,'close'); }
}
run().catch(error=>{console.error(error.stack||error);process.exit(1)});
