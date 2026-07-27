#!/usr/bin/env node
import assert from 'node:assert/strict';
import {installPrefetchQueue,scheduleReaderPrefetch} from '../../public/scripts/rebuild/features/reader/prefetch-queue.mjs';
globalThis.window={setTimeout,clearTimeout,dispatchEvent(){}};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{connection:{effectiveType:'4g',saveData:false}}});
globalThis.requestIdleCallback=callback=>setTimeout(()=>callback({didTimeout:false,timeRemaining:()=>50}),0);
globalThis.cancelIdleCallback=clearTimeout;
const wait=async(fn,label,timeout=2000)=>{const end=Date.now()+timeout;while(Date.now()<end){if(fn())return;await new Promise(r=>setTimeout(r,5));}throw new Error(`timeout ${label}`)};
let calls=0;
const app={readerPrefetchOperationTimeoutMs:100,readerPrefetchMaxActiveOrphans:2,state:{current:{novel:{id:'orphan'},episode:null,chunk:1,totalChunks:20},prefs:{readerCache:true,preprocess:{}},loadedChunks:new Map(),readerSessionId:1,errors:[]},api:{content(){calls+=1;return new Promise(()=>{});}}};
installPrefetchQueue(app);
for(let chunk=1;chunk<=10;chunk++){
  app.state.current.chunk=chunk;
  scheduleReaderPrefetch(app,chunk,{radius:1,direction:'forward'});
  await new Promise(r=>setTimeout(r,130));
}
await wait(()=>app.readerPrefetch.state.activeOrphans===2,'orphan cap');
await wait(()=>!app.readerPrefetch.state.running,'pump stopped');
const before=calls;
for(let chunk=11;chunk<=18;chunk++) scheduleReaderPrefetch(app,chunk,{radius:1,direction:'forward'});
await new Promise(r=>setTimeout(r,200));
assert.equal(calls,before,'circuit must block new orphan-producing work');
assert.equal(app.readerPrefetch.state.queue.length,0);
assert(app.readerPrefetch.state.stats.circuitOpenCount>=1);
assert(app.readerPrefetch.state.stats.skippedCircuitOpen>=1);
assert(calls<=2,`orphan calls must be bounded, got ${calls}`);
console.log(JSON.stringify({pass:'v676-reader-prefetch-orphan-circuit-smoke-pass',calls,activeOrphans:app.readerPrefetch.state.activeOrphans,circuitOpen:true}));
