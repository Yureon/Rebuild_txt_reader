#!/usr/bin/env node
const assert = require('assert');
const {
  TXT_READER_MULTI_LIBRARY_API_ACL_PASS,
  filterLibraryByAccess,
  isNovelAllowed,
  assertNovelAllowed,
  assertEpisodeAllowed,
  filterStateResponseByLibraryAccess
} = require('../../server/services/library-access-service');

function runLibraryApiAclSmoke() {
  const library = [
    { id: 'allowed-single', title: 'Allowed Single', isMultiFile: false, singlePath: '판타지/작가A/작품1.txt', episodes: [] },
    { id: 'prefix-trap', title: 'Trap', isMultiFile: false, singlePath: '판타지/작가A_다른폴더/작품2.txt', episodes: [] },
    { id: 'denied-single', title: 'Denied', isMultiFile: false, singlePath: '판타지/작가B/작품3.txt', episodes: [] },
    { id: 'allowed-series', title: 'Series', isMultiFile: true, singlePath: null, episodes: [
      { id: 'ep-1', title: '001', path: '무협/시리즈/001.txt' },
      { id: 'ep-2', title: '002', path: '무협/시리즈/002.txt' }
    ] }
  ];
  const access = { mode: 'folders', folders: ['판타지/작가A', '무협'] };
  const filtered = filterLibraryByAccess(library, access);
  assert.deepStrictEqual(filtered.map(n => n.id), ['allowed-single', 'allowed-series']);
  assert.ok(isNovelAllowed(access, library[0]));
  assert.throws(() => assertNovelAllowed(access, library[1]), /library access denied/);
  assert.throws(() => assertEpisodeAllowed({ mode: 'folders', folders: ['판타지'] }, library[3], library[3].episodes[0]), /library access denied/);

  const state = {
    shared: {
      favorites: ['allowed-single', 'denied-single', 'allowed-series'],
      bookmarks: [
        { id: 'b1', novelId: 'allowed-single' },
        { id: 'b2', novelId: 'denied-single' }
      ],
      recents: [
        { id: 'r1', novelId: 'allowed-series' },
        { id: 'r2', novelId: 'prefix-trap' }
      ],
      progress: {
        lastRead: { novelId: 'denied-single', chunk: 1 },
        byNovel: {
          'allowed-single': { chunk: 1 },
          'denied-single': { chunk: 2 }
        },
        readMeta: {
          good: { novelId: 'allowed-series' },
          bad: { novelId: 'prefix-trap' }
        },
        positions: {}
      },
      lastOpenedNovelId: 'denied-single'
    }
  };
  const filteredState = filterStateResponseByLibraryAccess(state, library, access);
  assert.deepStrictEqual(filteredState.shared.favorites, ['allowed-single', 'allowed-series']);
  assert.strictEqual(filteredState.shared.bookmarks.length, 1);
  assert.strictEqual(filteredState.shared.recents.length, 1);
  assert.strictEqual(filteredState.shared.progress.lastRead, null);
  assert.deepStrictEqual(Object.keys(filteredState.shared.progress.byNovel), ['allowed-single']);
  assert.deepStrictEqual(Object.keys(filteredState.shared.progress.readMeta), ['good']);
  assert.strictEqual(filteredState.shared.lastOpenedNovelId, null);
  return { pass: TXT_READER_MULTI_LIBRARY_API_ACL_PASS };
}

if (require.main === module) console.log(JSON.stringify(runLibraryApiAclSmoke()));
module.exports = { runLibraryApiAclSmoke };
