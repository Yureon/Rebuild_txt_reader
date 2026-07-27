#!/usr/bin/env node
import assert from 'node:assert/strict';

class LocalStorageMock {
  constructor(){ this.map=new Map(); }
  get length(){ return this.map.size; }
  key(i){ return [...this.map.keys()][i] ?? null; }
  getItem(k){ return this.map.has(String(k)) ? this.map.get(String(k)) : null; }
  setItem(k,v){ this.map.set(String(k),String(v)); }
  removeItem(k){ this.map.delete(String(k)); }
}
globalThis.localStorage = new LocalStorageMock();
const storage = await import('../../public/scripts/rebuild/core/storage.mjs');
localStorage.setItem('txt-reader.rebuild.progress', JSON.stringify({ lastRead:{ novelId:'legacy-private' } }));
localStorage.setItem('txt-reader.rebuild.deviceId','dev_12345678');
storage.setStorageScope('alice');
assert.equal(storage.saveLocal('progress',{ lastRead:{ novelId:'alice-book' } }),true);
storage.setStorageScope('bob');
assert.equal(storage.loadLocal('progress',null),null,'bob must not see alice local state');
storage.saveLocal('progress',{ lastRead:{ novelId:'bob-book' } });
storage.setStorageScope('alice');
assert.equal(storage.loadLocal('progress',null).lastRead.novelId,'alice-book');
const migration=storage.purgeUnscopedUserStorage('alice');
assert.equal(localStorage.getItem('txt-reader.rebuild.progress'),null,'legacy unowned state must be removed');
assert.equal(localStorage.getItem('txt-reader.rebuild.deviceId'),'dev_12345678','device identity must remain browser-global');
assert.equal(storage.getScopedStorageKey('progress'),'txt-reader.rebuild.scope.alice.progress');
console.log(JSON.stringify({pass:'v613-user-scoped-storage-smoke-pass',removed:migration.removed}));
