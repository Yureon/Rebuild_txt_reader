#!/usr/bin/env node
const assert = require('assert');
const express = require('express');
const { once } = require('events');
const {
  createNovelsRouter,
  LIBRARY_SHELF_API_PASS,
  LIBRARY_TREE_API_PASS,
  LIBRARY_SHELF_FILTERS_PASS,
  LIBRARY_SHELF_FOCUS_PASS,
  NOVEL_EPISODE_SUMMARY_API_PASS
} = require('../../server/routes/novels-routes');

function makeLibrary() {
  const novels = [];
  for (let index = 1; index <= 15; index += 1) {
    const id = `allowed-${String(index).padStart(2, '0')}`;
    novels.push({
      id,
      title: index === 14 ? '작품 14 완' : `작품 ${String(index).padStart(2, '0')}`,
      isMultiFile: index === 1,
      singlePath: index === 1 ? null : `허용/${id}.txt`,
      categoryPath: index % 2 ? '허용 > 판타지' : '허용 > 현대',
      category: ['허용', index % 2 ? '판타지' : '현대'],
      author: index === 1 ? '작가'.repeat(100) : (index % 3 === 0 ? '홍길동' : '김독자'),
      description: index === 1 ? '설명'.repeat(400) : '',
      coverUrl: index === 1 ? 'https://example.invalid/external.jpg' : '',
      episodes: index === 1
        ? [
            { id: 'ep-1', title: '1화', path: '허용/작품01/001.txt' },
            { id: 'ep-2', title: '2화', path: '허용/작품01/002.txt' }
          ]
        : []
    });
  }
  novels.push({
    id: 'denied-01',
    title: '접근 불가',
    isMultiFile: false,
    singlePath: '차단/denied.txt',
    categoryPath: '차단',
    category: ['차단'],
    episodes: []
  });
  return novels.reverse();
}

async function runLibraryShelfApiSmoke() {
  const library = makeLibrary();
  let stateReads = 0;
  const app = express();
  app.use(createNovelsRouter({
    libraryPath: '/virtual-library',
    libraryService: {
      getLibraryCached: () => library,
      setLibraryMetaHeaders: res => {
        res.setHeader('X-Library-Signature', 'shelf-fixture-signature');
        res.setHeader('X-Library-Build-Count', '1');
      }
    },
    contentService: {},
    sessionStore: {
      getSession: token => token === 'fixture-token' ? { kind: 'user', userId: 'reader-a' } : null
    },
    accountService: {
      getUserLibraryAccess: () => ({ mode: 'folders', folders: ['허용'] }),
      getUserAccessSnapshot: () => ({ accessVersion: 3 })
    },
    userStateServiceManager: {
      readShelfStateForUserId(userId) {
        stateReads += 1;
        assert.strictEqual(userId, 'reader-a');
        return {
          favorites: ['allowed-01', 'allowed-03', 'denied-01'],
          recents: [
            { novelId: 'allowed-04', ts: 400 },
            { novelId: 'denied-01', ts: 300 },
            { novelId: 'allowed-02', ts: 200 }
          ]
        };
      }
    },
    setNoStore: res => res.setHeader('Cache-Control', 'no-store')
  }));

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  const headers = { cookie: 'session_token=fixture-token' };

  try {
    const firstResponse = await fetch(`${base}/novels/shelf?limit=12`, { headers });
    assert.strictEqual(firstResponse.status, 200);
    assert.strictEqual(firstResponse.headers.get('x-library-shelf-api'), LIBRARY_SHELF_API_PASS);
    assert.strictEqual(firstResponse.headers.get('x-library-shelf-cache'), 'miss');
    assert.strictEqual(firstResponse.headers.get('x-library-shelf-query-cache'), 'v567-library-shelf-query-cache-pass');
    const etag = firstResponse.headers.get('etag');
    assert.ok(etag, 'shelf response must include ETag');
    const first = await firstResponse.json();
    assert.strictEqual(first.pass, LIBRARY_SHELF_API_PASS);
    assert.strictEqual(first.queryCachePass, 'v567-library-shelf-query-cache-pass');
    assert.strictEqual(first.items.length, 12);
    assert.strictEqual(first.total, 15);
    assert.ok(first.nextCursor, 'first page must include a cursor');
    assert.deepStrictEqual(first.counts, { all: 15, favorites: 2, recent: 2 });
    assert.ok(first.items.every(item => !Object.prototype.hasOwnProperty.call(item, 'episodes')), 'shelf payload must omit episode arrays');
    assert.strictEqual(first.items[0].id, 'allowed-01');
    assert.strictEqual(first.items[0].episodeCount, 2);
    assert.strictEqual(first.items[0].episodesLoaded, false);
    assert.strictEqual(first.items[0].coverUrl, '', 'external cover URLs must not escape the existing CSP/proxy boundary');
    assert.ok(first.items[0].author.length <= 160);
    assert.ok(first.items[0].description.length <= 360);

    const focusResponse = await fetch(`${base}/novels/shelf?limit=12&focusNovelId=allowed-14`, { headers });
    assert.strictEqual(focusResponse.status, 200);
    const focused = await focusResponse.json();
    assert.strictEqual(focused.focus.pass, LIBRARY_SHELF_FOCUS_PASS);
    assert.strictEqual(focused.focus.found, true);
    assert.strictEqual(focused.focus.offset, 12);
    assert.ok(focused.items.some(item => item.id === 'allowed-14'), 'focus page must contain the requested novel');

    const filtersResponse = await fetch(`${base}/novels/shelf/filters`, { headers });
    assert.strictEqual(filtersResponse.status, 200);
    assert.strictEqual(filtersResponse.headers.get('x-library-shelf-filters'), LIBRARY_SHELF_FILTERS_PASS);
    const filterPayload = await filtersResponse.json();
    assert.ok(filterPayload.facets.authors.some(item => item.value === '김독자'));
    assert.ok(filterPayload.facets.categories.some(item => item.value === '판타지'));
    assert.ok(filterPayload.facets.publicationStatuses.some(item => item.value === 'complete'));

    const filteredResponse = await fetch(`${base}/novels/shelf?author=${encodeURIComponent('홍길동')}&category=${encodeURIComponent('현대')}`, { headers });
    const filtered = await filteredResponse.json();
    assert.ok(filtered.items.length > 0);
    assert.ok(filtered.items.every(item => item.author === '홍길동' && item.category.includes('현대')));

    const treeResponse = await fetch(`${base}/novels/tree`, { headers });
    assert.strictEqual(treeResponse.status, 200);
    assert.strictEqual(treeResponse.headers.get('x-library-tree-api'), LIBRARY_TREE_API_PASS);
    const treePayload = await treeResponse.json();
    assert.strictEqual(treePayload.pass, LIBRARY_TREE_API_PASS);
    assert.strictEqual(treePayload.items.length, 15);
    assert.ok(treePayload.items.every(item => Array.isArray(item.episodes) && item.episodes.length === 0));
    assert.strictEqual(treePayload.items.find(item => item.id === 'allowed-01').episodesLoaded, false);

    const secondResponse = await fetch(`${base}/novels/shelf?limit=12&cursor=${encodeURIComponent(first.nextCursor)}`, { headers });
    const second = await secondResponse.json();
    assert.strictEqual(second.items.length, 3);
    assert.strictEqual(second.nextCursor, '');

    const favoriteResponse = await fetch(`${base}/novels/shelf?scope=favorites`, { headers });
    const favorites = await favoriteResponse.json();
    assert.deepStrictEqual(favorites.items.map(item => item.id), ['allowed-01', 'allowed-03']);

    const recentResponse = await fetch(`${base}/novels/shelf?scope=recent`, { headers });
    const recents = await recentResponse.json();
    assert.deepStrictEqual(recents.items.map(item => item.id), ['allowed-04', 'allowed-02']);

    const episodeResponse = await fetch(`${base}/novels/allowed-01/episodes`, { headers });
    assert.strictEqual(episodeResponse.status, 200);
    assert.strictEqual(episodeResponse.headers.get('x-novel-episode-summary-api'), NOVEL_EPISODE_SUMMARY_API_PASS);
    const episodePayload = await episodeResponse.json();
    assert.deepStrictEqual(episodePayload.episodes.map(item => item.id), ['ep-1', 'ep-2']);

    const deniedResponse = await fetch(`${base}/novels/denied-01/episodes`, { headers });
    assert.strictEqual(deniedResponse.status, 403);

    const notModified = await fetch(`${base}/novels/shelf?limit=12`, {
      headers: { ...headers, 'if-none-match': etag }
    });
    assert.strictEqual(notModified.status, 304);
    assert.strictEqual(notModified.headers.get('x-library-shelf-cache'), 'hit');
    assert.ok(stateReads >= 5, 'user shelf state must be read for scoped counts and ordering');

    return { pass: LIBRARY_SHELF_API_PASS, pages: 2, stateReads };
  } finally {
    server.close();
    await once(server, 'close');
  }
}

if (require.main === module) {
  runLibraryShelfApiSmoke().then(result => console.log(JSON.stringify(result))).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { runLibraryShelfApiSmoke };
