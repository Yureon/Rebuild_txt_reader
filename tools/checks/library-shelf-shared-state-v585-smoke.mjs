#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { persistAndSync, SHARED_BOOK_DATA_SYNC_PASS } from '../../public/scripts/rebuild/features/bookmarks/model.mjs';
import { toggleLibraryFavoriteRuntime } from '../../public/scripts/rebuild/features/library-favorites-runtime.mjs';
import { rememberRecent } from '../../public/scripts/rebuild/features/reader/progress.mjs';

const librarySource = fs.readFileSync('public/scripts/rebuild/features/library.mjs','utf8');
for (const token of [
  "import('./bookmarks/model.mjs')",
  'r.syncPromise=persistSharedBookData(app)',
  "if(scope==='favorites'||scope==='recent')await persistSharedBookData(app)",
  'return setLibraryShelfScopeRuntime(app,scope'
]) assert(librarySource.includes(token), `library shared-state wiring missing: ${token}`);
const scopeBody = librarySource.slice(librarySource.indexOf('async function setLibraryShelfScope'), librarySource.indexOf('function renderLibrary', librarySource.indexOf('async function setLibraryShelfScope')));
assert(scopeBody.indexOf('await persistSharedBookData(app)') < scopeBody.indexOf('setLibraryShelfScopeRuntime'), 'server shelf scope must load after shared state sync');

const writes = [];
const app = {
  api:{ async putShared(shared){ writes.push(structuredClone(shared)); return { shared:structuredClone({ ...app.state.shared, ...shared }), sharedVersion:(app.state.sharedVersion || 0) + 1 }; } },
  state:{
    shared:{ prefs:{ keep:true }, bookmarks:[], recents:[], favorites:[] }, bookmarks:[], recents:[], favorites:new Set(),
    novelById:new Map([['novel-1',{ id:'novel-1', title:'테스트', progressAliases:['novel-1'] }]]),
    libraryShelfItems:[{ id:'novel-1', title:'테스트', progressAliases:['novel-1'] }],
    current:{ novel:{ id:'novel-1', title:'테스트', isMultiFile:false }, episode:null, title:'테스트' }
  }
};
const changed = toggleLibraryFavoriteRuntime(app,'novel-1',{});
assert.equal(changed.isFavorite,true);
const favoriteSync = await persistAndSync(app);
assert.equal(favoriteSync.pass,SHARED_BOOK_DATA_SYNC_PASS);
assert.deepEqual(writes.at(-1).favorites,['novel-1']);
assert.equal(Object.prototype.hasOwnProperty.call(writes.at(-1),'prefs'),false,'partial shelf writes must not retransmit unrelated shared state');
assert.equal(app.state.shared.prefs.keep,true,'unrelated local shared state must survive the partial write');

rememberRecent(app);
await new Promise(resolve=>setTimeout(resolve,0));
await app.state.sharedBookDataSyncRequest;
assert.equal(writes.at(-1).recents[0].novelId,'novel-1');
assert.equal(writes.at(-1).favorites[0],'novel-1');
console.log(JSON.stringify({ pass:'v585-library-shelf-shared-state-smoke-pass', writes:writes.length }));
