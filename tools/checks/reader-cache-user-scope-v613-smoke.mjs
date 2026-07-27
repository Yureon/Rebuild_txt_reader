#!/usr/bin/env node
import assert from 'node:assert/strict';
class LocalStorageMock { constructor(){this.map=new Map()} get length(){return this.map.size} key(i){return [...this.map.keys()][i]??null} getItem(k){return this.map.get(String(k))??null} setItem(k,v){this.map.set(String(k),String(v))} removeItem(k){this.map.delete(String(k))} }
globalThis.localStorage=new LocalStorageMock();
const stores={chunks:new Map(),meta:new Map(),searchManifests:new Map()};
function objectStore(name,tx){const map=stores[name];return{
  put(value){map.set(String(value.id),structuredClone(value));queueMicrotask(()=>tx.oncomplete?.());const req={result:value.id,error:null};queueMicrotask(()=>req.onsuccess?.());return req},
  get(key){const req={result:null,error:null};queueMicrotask(()=>{req.result=map.get(String(key));req.onsuccess?.()});return req},
  getAll(){const req={result:null,error:null};queueMicrotask(()=>{req.result=[...map.values()].map(value=>structuredClone(value));req.onsuccess?.()});return req},
  delete(key){map.delete(String(key));const req={result:undefined,error:null};queueMicrotask(()=>{req.onsuccess?.();tx.oncomplete?.()});return req},
  clear(){map.clear();const req={result:undefined,error:null};queueMicrotask(()=>{req.onsuccess?.();tx.oncomplete?.()});return req},
  createIndex(){}, indexNames:{contains:()=>true}
}};
const db={objectStoreNames:{contains:name=>Object.hasOwn(stores,name)},createObjectStore(){return{createIndex(){}}},close(){},transaction(name){const tx={error:null,objectStore:()=>objectStore(name,tx)};return tx}};
globalThis.indexedDB={open(){const req={result:db,error:null,transaction:{objectStore:name=>objectStore(name,{})}};queueMicrotask(()=>{req.onupgradeneeded?.();req.onsuccess?.()});return req}};
globalThis.window={setTimeout,clearTimeout};
const storage=await import('../../public/scripts/rebuild/core/storage.mjs');
const cache=await import('../../public/scripts/rebuild/features/reader/cache-store.mjs');
const current={novel:{id:'novel-1',path:'a.txt',size:10,mtime:1},episode:null,title:'A',totalChunks:1};
const app=userId=>({state:{userId,userAccessSnapshot:{userId,accessVersion:1},prefs:{readerCache:true,preprocess:{}},readerCacheLastPrune:Date.now(),loadedChunks:new Map()}});
storage.setStorageScope('alice');
assert.equal(await cache.writeChunkPayloadToCache(app('alice'),current,1,{content:'alice-secret',totalChunks:1}),true);
storage.setStorageScope('bob');
assert.equal(await cache.readChunkPayloadFromCache(app('bob'),current,1),null,'bob must not read alice chunk');
assert.equal(await cache.writeChunkPayloadToCache(app('bob'),current,1,{content:'bob-text',totalChunks:1}),true);
storage.setStorageScope('alice');
assert.equal((await cache.readChunkPayloadFromCache(app('alice'),current,1)).content,'alice-secret');
assert.equal((await cache.getReaderCacheStats(app('alice'))).entries,1);
assert.equal((await cache.getReaderCacheStats(app('bob'))).entries,1);
console.log(JSON.stringify({pass:'v613-reader-cache-user-scope-smoke-pass',entries:stores.chunks.size}));
