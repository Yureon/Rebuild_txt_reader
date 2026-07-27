#!/usr/bin/env node
import assert from 'node:assert/strict';

let stored = null;
let putCount = 0;
const db = {
  objectStoreNames:{ contains:()=>true },
  createObjectStore() {},
  transaction(_name, mode) {
    const tx = {
      error:null,
      objectStore() {
        return {
          put(value) {
            putCount += 1;
            stored = value;
            setTimeout(() => tx.oncomplete?.(), mode === 'readwrite' ? 15 : 0);
          },
          get() {
            const request = { result:null, error:null };
            queueMicrotask(() => {
              request.result = stored;
              request.onsuccess?.();
            });
            return request;
          }
        };
      }
    };
    return tx;
  }
};
globalThis.indexedDB = {
  open() {
    const request = { result:db, error:null };
    queueMicrotask(() => {
      request.onupgradeneeded?.();
      request.onsuccess?.();
    });
    return request;
  }
};

const storage = await import('../../public/scripts/rebuild/core/progress-storage.mjs');
const p1 = storage.queueProgressStateSave({ lastRead:{ novelId:'a', ts:1 } });
const p2 = storage.queueProgressStateSave({ lastRead:{ novelId:'b', ts:2 } });
const p3 = storage.queueProgressStateSave({ lastRead:{ novelId:'c', ts:3 } });
const results = await Promise.all([p1,p2,p3]);
assert.equal(putCount,1,'rapid saves must be coalesced into one IndexedDB write');
assert.ok(results.every(result => result.ok === true));
let loaded = await storage.loadProgressStateFromIndexedDb();
assert.equal(loaded.lastRead.novelId,'c','the newest pending state must win');
await storage.queueProgressStateSave({ lastRead:{ novelId:'d', ts:4 } }, { immediate:true });
assert.equal(putCount,2,'lifecycle flush must start an immediate write');
loaded = await storage.loadProgressStateFromIndexedDb();
assert.equal(loaded.lastRead.novelId,'d');
assert.equal(storage.PROGRESS_INDEXED_DB_COALESCE_PASS,'v612-progress-indexeddb-coalesce-pass');
console.log(JSON.stringify({ pass:'v612-progress-storage-coalesce-smoke-pass', putCount, latest:loaded.lastRead.novelId }));
