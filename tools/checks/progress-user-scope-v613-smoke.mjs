#!/usr/bin/env node
import assert from 'node:assert/strict';
class LocalStorageMock { constructor(){this.map=new Map()} get length(){return this.map.size} key(i){return [...this.map.keys()][i]??null} getItem(k){return this.map.get(String(k))??null} setItem(k,v){this.map.set(String(k),String(v))} removeItem(k){this.map.delete(String(k))} }
globalThis.localStorage=new LocalStorageMock();
const records=new Map();
const db={
  objectStoreNames:{contains:()=>true}, close(){},
  transaction(_name,mode){
    const tx={error:null,objectStore(){return{
      put(value,key){records.set(String(key),value);queueMicrotask(()=>tx.oncomplete?.());return{}},
      get(key){const req={result:null,error:null};queueMicrotask(()=>{req.result=records.get(String(key));req.onsuccess?.()});return req},
      delete(key){records.delete(String(key));queueMicrotask(()=>tx.oncomplete?.());return{}}
    }}};return tx;
  }
};
globalThis.indexedDB={open(){const req={result:db,error:null};queueMicrotask(()=>{req.onupgradeneeded?.();req.onsuccess?.()});return req}};
const storage=await import('../../public/scripts/rebuild/core/storage.mjs');
const progress=await import('../../public/scripts/rebuild/core/progress-storage.mjs');
storage.setStorageScope('alice');
await progress.queueProgressStateSave({lastRead:{novelId:'alice-book',ts:1}},{immediate:true});
assert.equal((await progress.loadProgressStateFromIndexedDb()).lastRead.novelId,'alice-book');
storage.setStorageScope('bob');
assert.equal(await progress.loadProgressStateFromIndexedDb(),null,'bob must not read alice progress record');
await progress.queueProgressStateSave({lastRead:{novelId:'bob-book',ts:2}},{immediate:true});
storage.setStorageScope('alice');
assert.equal((await progress.loadProgressStateFromIndexedDb()).lastRead.novelId,'alice-book');
assert.ok(records.has('current::alice')&&records.has('current::bob'));
console.log(JSON.stringify({pass:'v613-progress-user-scope-smoke-pass',keys:[...records.keys()].sort()}));
