#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  abortReaderPrefetch,
  installPrefetchQueue,
  scheduleReaderPrefetch
} from '../../public/scripts/rebuild/features/reader/prefetch-queue.mjs';

globalThis.window = {
  setTimeout,
  clearTimeout,
  dispatchEvent() {}
};
Object.defineProperty(globalThis, 'navigator', {
  configurable:true,
  value:{ connection:{ effectiveType:'4g', saveData:false } }
});
globalThis.requestIdleCallback = callback => setTimeout(() => callback({ didTimeout:false, timeRemaining:() => 50 }), 0);
globalThis.cancelIdleCallback = handle => clearTimeout(handle);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

async function waitFor(predicate, label, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error(`timeout waiting for ${label}`);
}

const first = deferred();
let calls = 0;
let active = 0;
let maxActive = 0;
let secondSignal = null;
const app = {
  state:{
    current:{
      novel:{ id:'prefetch-race-novel' },
      episode:null,
      chunk:1,
      totalChunks:3
    },
    prefs:{ readerCache:true, preprocess:{} },
    loadedChunks:new Map(),
    readerSessionId:1,
    errors:[]
  },
  api:{
    content(_request, options = {}) {
      calls += 1;
      active += 1;
      maxActive = Math.max(maxActive, active);
      if (calls === 1) {
        return first.promise.finally(() => { active -= 1; });
      }
      secondSignal = options.signal;
      return new Promise((resolve, reject) => {
        const finish = () => {
          active -= 1;
          reject(new DOMException('prefetch cancelled', 'AbortError'));
        };
        if (secondSignal?.aborted) finish();
        else secondSignal?.addEventListener?.('abort', finish, { once:true });
      });
    }
  }
};

installPrefetchQueue(app);
scheduleReaderPrefetch(app, 1, { radius:1, direction:'forward' });
await waitFor(() => calls === 1, 'first prefetch');
assert.equal(app.readerPrefetch.state.running, true);

abortReaderPrefetch(app);
scheduleReaderPrefetch(app, 2, { radius:1, direction:'forward' });
await new Promise(resolve => setTimeout(resolve, 30));
assert.equal(calls, 1, 'a replacement prefetch must wait for the cancelled run to settle');
assert.equal(maxActive, 1, 'prefetch runs must remain single-flight');

first.reject(new DOMException('first prefetch cancelled', 'AbortError'));
await waitFor(() => calls === 2, 'replacement prefetch');
assert(secondSignal && !secondSignal.aborted, 'replacement prefetch must retain its own AbortController');
assert.equal(app.readerPrefetch.state.controller?.signal, secondSignal);

abortReaderPrefetch(app);
assert.equal(secondSignal.aborted, true, 'a later cancel must reach the replacement prefetch');
await waitFor(() => app.readerPrefetch.state.running === false, 'replacement cancellation cleanup');
assert.equal(maxActive, 1);
assert.equal(app.readerPrefetch.state.controller, null);
assert.equal(app.readerPrefetch.state.queue.length, 0);

console.log(JSON.stringify({
  pass:'v674-reader-prefetch-cancel-race-smoke-pass',
  calls,
  maxConcurrent:maxActive,
  replacementAbortReached:true,
  queueBounded:true
}));
