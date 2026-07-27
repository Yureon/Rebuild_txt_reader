#!/usr/bin/env node
import assert from 'node:assert/strict';
import { installPrefetchQueue, scheduleReaderPrefetch } from '../../public/scripts/rebuild/features/reader/prefetch-queue.mjs';
globalThis.window = { setTimeout, clearTimeout, dispatchEvent() {} };
Object.defineProperty(globalThis, 'navigator', { configurable:true, value:{ connection:{ effectiveType:'4g', saveData:false } } });
globalThis.requestIdleCallback = callback => setTimeout(() => callback({ didTimeout:false, timeRemaining:() => 50 }), 0);
globalThis.cancelIdleCallback = clearTimeout;
async function waitFor(predicate, label, timeout = 1500) { const end=Date.now()+timeout; while(Date.now()<end){ if(predicate()) return; await new Promise(r=>setTimeout(r,5)); } throw new Error(`timeout: ${label}`); }
let calls = 0;
const app = {
  readerPrefetchOperationTimeoutMs:100,
  state:{ current:{ novel:{id:'watchdog'}, episode:null, chunk:1, totalChunks:3 }, prefs:{readerCache:true,preprocess:{}}, loadedChunks:new Map(), readerSessionId:1, errors:[] },
  api:{ content() { calls += 1; if (calls === 1) return new Promise(() => {}); return Promise.resolve({ currentChunk:2, content:'replacement content' }); } }
};
installPrefetchQueue(app);
scheduleReaderPrefetch(app, 1, { radius:1, direction:'forward' });
await waitFor(() => calls === 1, 'first call');
scheduleReaderPrefetch(app, 2, { radius:1, direction:'forward' });
await waitFor(() => app.readerPrefetch.state.stats.timedOut === 1, 'watchdog timeout');
await waitFor(() => calls >= 2, 'replacement call');
await waitFor(() => app.readerPrefetch.state.running === false, 'pump release');
assert.equal(app.readerPrefetch.state.stats.lastTimeoutStage, 'network');
assert.equal(app.readerPrefetch.state.controller, null);
assert(app.readerPrefetch.state.stats.watchdogPass === 'v675-reader-prefetch-watchdog-pass');
console.log(JSON.stringify({ pass:'v675-reader-prefetch-watchdog-smoke-pass', calls, timedOut:app.readerPrefetch.state.stats.timedOut, replacementRan:true }));
