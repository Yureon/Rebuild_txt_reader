#!/usr/bin/env node
import assert from 'node:assert/strict';
class LocalStorageMock { constructor(){this.map=new Map()} get length(){return this.map.size} key(i){return [...this.map.keys()][i]??null} getItem(k){return this.map.get(String(k))??null} setItem(k,v){this.map.set(String(k),String(v))} removeItem(k){this.map.delete(String(k))} }
globalThis.localStorage=new LocalStorageMock();
const calls=[];
const base={ok:true,userId:'restricted-user',accessVersion:2,libraryAccess:{mode:'folders',folders:['allowed']},allNovelsAccessible:false,accessSignature:'restricted-user:2:folders'};
const detailed={...base,accessibleNovelIds:['allowed-book'],accessibleNovelIdsIncluded:true};
const api={async userAccessSnapshot(options={}){calls.push({...options});return options.includeNovelIds?detailed:base}};
const bootstrapModule=await import('../../public/scripts/rebuild/core/user-scope-bootstrap.mjs');
const boot=await bootstrapModule.bootstrapUserScope(api);
const app={api,state:{progress:{lastRead:{novelId:'blocked-book'},byNovel:{'blocked-book':{novelId:'blocked-book'}},positions:{'pos-blocked-book-single':{}},readMeta:{}},favorites:new Set(['blocked-book']),recents:[],bookmarks:[],novelUserTags:{}}};
await bootstrapModule.initializeAccessBootstrap(app,boot);
assert.equal(calls.some(call=>call.includeNovelIds===true),true,'first restricted boot must fetch detailed novel ids');
assert.equal(app.state.progress.lastRead,null,'blocked local progress must be removed before restore');
assert.equal(app.state.favorites.size,0);
assert.deepEqual(app.state.userAccessSnapshot.accessibleNovelIds,['allowed-book']);

const redirects=[];
await assert.rejects(
  () => bootstrapModule.bootstrapUserScope({ async userAccessSnapshot(){ const error=new Error('unauthorized'); error.status=401; throw error; } }, { locationObject:{ replace(target){ redirects.push(target); } } }),
  error => error?.code === 'CLIENT_AUTH_REDIRECT' && error?.redirectTarget === '/login.html'
);
await assert.rejects(
  () => bootstrapModule.bootstrapUserScope({ async userAccessSnapshot(){ const error=new Error('owner'); error.status=403; error.code='reader_user_session_required'; throw error; } }, { locationObject:{ replace(target){ redirects.push(target); } } }),
  error => error?.code === 'CLIENT_AUTH_REDIRECT' && error?.redirectTarget === '/admin/users.html'
);
assert.deepEqual(redirects,['/login.html','/admin/users.html']);
console.log(JSON.stringify({pass:'v614-access-bootstrap-redirect-smoke-pass',calls,redirects}));
