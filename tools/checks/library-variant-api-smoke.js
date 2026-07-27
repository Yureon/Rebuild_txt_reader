#!/usr/bin/env node
const assert = require('assert');
const express = require('express');
const { once } = require('events');
const {
  createNovelsRouter,
  LIBRARY_VARIANT_PRESENTATION_PASS,
  LIBRARY_SHELF_API_PASS
} = require('../../server/routes/novels-routes');

function single(id, title, categoryPath) {
  return { id, title, singlePath:`${categoryPath}/${title}.txt`, categoryPath, category:[categoryPath], isMultiFile:false, episodes:[] };
}

async function run() {
  const library = [
    single('old', '검신 귀환 1-100', '옛날'),
    single('preferred', '검신 귀환 1-220完 @작가', '최신'),
    single('copy', '검신 귀환 1-220完 @작가-1', '복사본'),
    single('solo', '독립 작품', '기타')
  ];
  const app = express();
  app.use(createNovelsRouter({
    libraryPath:'/virtual',
    libraryService:{
      getLibraryCached:() => library,
      setLibraryMetaHeaders:res => res.setHeader('X-Library-Signature', 'variant-api')
    },
    contentService:{},
    sessionStore:{ getSession:token => token === 'token' ? { kind:'user', userId:'reader' } : null },
    accountService:{
      getUserLibraryAccess:() => ({ mode:'all', folders:[] }),
      getUserAccessSnapshot:() => ({ accessVersion:1 })
    },
    userStateServiceManager:{
      readShelfStateForUserId:() => ({
        favorites:['copy'],
        recents:[{ novelId:'old', ts:200 }]
      })
    },
    setNoStore:res => res.setHeader('Cache-Control','no-store')
  }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { cookie:'session_token=token' };
  try {
    const shelfResponse = await fetch(`${base}/novels/shelf`, { headers });
    assert.equal(shelfResponse.status, 200);
    const shelf = await shelfResponse.json();
    assert.equal(shelf.pass, LIBRARY_SHELF_API_PASS);
    assert.equal(shelf.variantPresentationPass, LIBRARY_VARIANT_PRESENTATION_PASS);
    assert.equal(shelf.items.length, 2);
    assert.equal(shelf.hiddenVariantCount, 2);
    const grouped = shelf.items.find(item => item.id === 'preferred');
    assert.ok(grouped);
    assert.equal(grouped.hiddenVariantCount, 2);
    assert.deepEqual(new Set(grouped.progressAliases), new Set(['old','preferred','copy']));
    assert.equal(grouped.variants.find(item => item.id === 'old').relation, 'superseded');
    assert.equal(grouped.variants.find(item => item.id === 'copy').relation, 'duplicate-copy');
    assert.equal(grouped.variants.find(item => item.id === 'solo'), undefined);
    assert.equal(grouped.variants.find(item => item.id === 'solo')?.rangeStart ?? null, null);

    const favorites = await (await fetch(`${base}/novels/shelf?scope=favorites`, { headers })).json();
    assert.deepEqual(favorites.items.map(item => item.id), ['preferred']);
    const recents = await (await fetch(`${base}/novels/shelf?scope=recent`, { headers })).json();
    assert.deepEqual(recents.items.map(item => item.id), ['preferred']);

    const aliasMeta = await (await fetch(`${base}/novels/old/meta`, { headers })).json();
    assert.equal(aliasMeta.novel.id, 'preferred');
    const variants = await (await fetch(`${base}/novels/copy/variants`, { headers })).json();
    assert.equal(variants.novelId, 'preferred');
    assert.equal(variants.variants.length, 3);

    const raw = await (await fetch(`${base}/novels`, { headers })).json();
    assert.deepEqual(new Set(raw.map(item => item.id)), new Set(['old','preferred','copy','solo']), 'raw file catalog must remain ungrouped for management and ACL paths');

    console.log(JSON.stringify({ pass:'v574-library-variant-api-smoke-pass', shelf:shelf.items.length, raw:raw.length }));
  } finally {
    server.close();
    await once(server, 'close');
  }
}
run().catch(error => { console.error(error && error.stack || error); process.exitCode=1; });
