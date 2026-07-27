#!/usr/bin/env node
const assert = require('assert');
const express = require('express');
const { once } = require('events');
const { createNovelsRouter } = require('../../server/routes/novels-routes');

async function run() {
  const library = [{ id:'n1', title:'원본 제목', singlePath:'/library/판타지/원본 제목.txt', categoryPath:'판타지', category:['판타지'], isMultiFile:false, episodes:[] }];
  let revision = 1;
  const metadataService = {
    getRevision:() => revision,
    enrichNovel:novel => ({
      ...novel,
      title:'메타 제목', author:'메타 작가', description:'인터넷에서 수집한 소개글', synopsis:'인터넷에서 수집한 소개글',
      genres:['현대판타지'], tags:['성장','재벌'], publicationStatus:'completed', publicationYear:2025,
      coverUrl:'/api/metadata/covers/' + 'a'.repeat(64), metadata:{ providerId:'builtin-test', updatedAt:'2026-07-20T00:00:00.000Z' }
    })
  };
  const app = express();
  app.use(createNovelsRouter({
    libraryPath:'/library',
    libraryService:{ getLibraryCached:() => library, setLibraryMetaHeaders:res => res.setHeader('X-Library-Signature','metadata-shelf') },
    contentService:{}, metadataService,
    sessionStore:{ getSession:token => token === 'token' ? { kind:'user', userId:'reader' } : null },
    accountService:{ getUserLibraryAccess:() => ({ mode:'all', folders:[] }), getUserAccessSnapshot:() => ({ accessVersion:1 }) },
    userStateServiceManager:{ readShelfStateForUserId:() => ({ favorites:[], recents:[] }) },
    setNoStore:res => res.setHeader('Cache-Control','no-store')
  }));
  const server = app.listen(0, '127.0.0.1');
  await once(server,'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { cookie:'session_token=token' };
  try {
    const shelfRes = await fetch(`${base}/novels/shelf?tag=%EC%84%B1%EC%9E%A5&q=%EC%9E%AC%EB%B2%8C`, { headers });
    assert.equal(shelfRes.status, 200);
    const shelf = await shelfRes.json();
    assert.equal(shelf.items.length, 1);
    const item = shelf.items[0];
    assert.equal(item.title, '메타 제목');
    assert.equal(item.author, '메타 작가');
    assert.equal(item.description, '인터넷에서 수집한 소개글');
    assert.deepStrictEqual(item.tags, ['성장','재벌']);
    assert.deepStrictEqual(item.genres, ['현대판타지']);
    assert.equal(item.coverUrl, '/api/metadata/covers/' + 'a'.repeat(64));
    assert.equal(item.publicationStatus, 'completed');
    assert.equal(item.metadata.providerId, 'builtin-test');
    assert.equal(shelf.metadataRevision, 1);

    const filters = await (await fetch(`${base}/novels/shelf/filters`, { headers })).json();
    assert(filters.facets.tags.some(entry => entry.value === '성장'));
    assert(filters.facets.tags.some(entry => entry.value === '현대판타지'));
    assert(filters.facets.authors.some(entry => entry.value === '메타 작가'));

    const tree = await (await fetch(`${base}/novels/tree`, { headers })).json();
    assert.equal(tree.items[0].title, '메타 제목');
    assert.equal(tree.items[0].coverUrl, '/api/metadata/covers/' + 'a'.repeat(64));
    assert(tree.items[0].tags.includes('성장'));

    const firstEtag = shelfRes.headers.get('etag');
    revision = 2;
    const secondRes = await fetch(`${base}/novels/shelf?tag=%EC%84%B1%EC%9E%A5&q=%EC%9E%AC%EB%B2%8C`, { headers:{ ...headers, 'if-none-match':firstEtag } });
    assert.equal(secondRes.status, 200, 'metadata revision must invalidate shelf ETag/cache');
    const second = await secondRes.json();
    assert.equal(second.metadataRevision, 2);

    console.log(JSON.stringify({ pass:'v576-metadata-shelf-enrichment-smoke-pass', revision:second.metadataRevision }));
  } finally {
    server.close();
    await once(server,'close');
  }
}
run().catch(error => { console.error(error && error.stack || error); process.exitCode=1; });
