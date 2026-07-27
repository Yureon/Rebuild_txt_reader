#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadLibraryCatalogRuntime } from '../../public/scripts/rebuild/features/library-catalog-loader.mjs';

const storage = new Map();
globalThis.localStorage = {
  getItem:key => storage.get(key) ?? null,
  setItem:(key,value) => storage.set(key,String(value))
};
storage.set('txt-reader.multi.userAccessSnapshot.v1:reader-a', JSON.stringify({signature:'reader-a:1:folders'}));

let detailResolve;
const detailPromise = new Promise(resolve => { detailResolve = resolve; });
const calls=[];
const app={
  state:{libraryViewMode:'shelf'},
  els:{},
  api:{
    async userAccessSnapshot(options={}) {
      calls.push({...options});
      if (options.includeNovelIds) return detailPromise;
      return {ok:true,userId:'reader-a',accessVersion:2,libraryAccess:{mode:'folders',folders:['A']},allNovelsAccessible:false,accessSignature:'reader-a:2:folders',appPermissions:{fullSearch:true,metadataAccess:false}};
    }
  }
};
let shelfLoaded=false;
const loadResult=await loadLibraryCatalogRuntime(app,{source:'test'},{
  async loadShelfPage(){shelfLoaded=true;return ['visible'];},
  status(){},
  toast(){}
});
assert.equal(shelfLoaded,true,'shelf must load without waiting for the full access ID list');
assert.deepEqual(loadResult,['visible']);
assert.equal(calls.length,2,'permission change must schedule a second detailed request');
assert.equal(calls[1].includeNovelIds,true);
assert.ok(app.state.userAccessReconcilePromise instanceof Promise);
const routeSource=fs.readFileSync('server/routes/user-access-routes.js','utf8');
assert.ok(routeSource.includes("includeNovelIds = String(req.query?.includeNovelIds || '') === '1'"));
assert.ok(routeSource.includes('else if (includeNovelIds)'),'restricted snapshots must avoid catalog loading by default');
detailResolve({ok:true,userId:'reader-a',accessVersion:2,libraryAccess:{mode:'folders',folders:['A']},accessibleNovelIds:[],accessibleNovelIdsIncluded:true,accessSignature:'reader-a:2:folders'});
await app.state.userAccessReconcilePromise;
console.log(JSON.stringify({pass:'v612-library-access-snapshot-nonblocking-smoke-pass',calls:calls.length}));
