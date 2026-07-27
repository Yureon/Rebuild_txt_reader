#!/usr/bin/env node
import assert from 'node:assert/strict';
import { loadLibraryShelfPageRuntime } from '../../public/scripts/rebuild/features/library-shelf-runtime.mjs';

function deferredShelf(signal, payload) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(payload), payload.delay);
    signal?.addEventListener?.('abort', () => {
      clearTimeout(timer);
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    }, { once:true });
  });
}

const calls = [];
const app = {
  state: {
    libraryShelfScope:'all',
    libraryShelfSort:'title',
    libraryFilter:'first',
    libraryShelfItems:[],
    libraryShelfNextCursor:'',
    libraryShelfTotal:0,
    libraryShelfCounts:{},
    libraryShelfLoading:false,
    libraryShelfAbortController:null,
    libraryShelfRequestSerial:0,
    libraryShelfLoadedKey:'',
    libraryShelfError:'',
    libraryFullCatalogLoaded:false,
    libraryCatalogMode:'shelf',
    novels:[],
    novelById:new Map()
  },
  api: {
    novelShelf(args, options) {
      calls.push(args.query);
      if (args.query === 'first') return deferredShelf(options?.signal, { delay:60, items:[{ id:'old', title:'Old', isMultiFile:false }], total:1, counts:{ all:1, favorites:0, recent:0 } });
      return deferredShelf(options?.signal, { delay:5, items:[{ id:'new', title:'New', isMultiFile:false }], total:1, counts:{ all:1, favorites:0, recent:0 } });
    }
  }
};
const deps = { renderLibrary(){}, syncLibraryChrome(){}, toast(){ throw new Error('aborted request must not toast'); } };
const first = loadLibraryShelfPageRuntime(app, { reset:true }, deps);
app.state.libraryFilter = 'second';
const second = loadLibraryShelfPageRuntime(app, { reset:true }, deps);
const [firstResult, secondResult] = await Promise.all([first, second]);
assert.equal(firstResult.loaded, false);
assert.equal(firstResult.reason, 'superseded-error');
assert.equal(secondResult.loaded, true);
assert.deepEqual(calls, ['first', 'second']);
assert.deepEqual(app.state.libraryShelfItems.map(item => item.id), ['new']);
assert.equal(app.state.libraryShelfLoading, false);
assert.equal(app.state.libraryShelfAbortController, null);
console.log('v566-library-shelf-request-race-smoke-pass');
