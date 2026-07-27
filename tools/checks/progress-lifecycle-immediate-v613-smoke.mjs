#!/usr/bin/env node
import assert from 'node:assert/strict';
import { syncProgressState } from '../../public/scripts/rebuild/features/reader/progress.mjs';
let releaseNormal;
const normalGate=new Promise(resolve=>{releaseNormal=resolve});
const calls=[];
const app={state:{sharedVersion:1,progress:{},shared:{},progressSyncRequest:null},api:{async patchProgressNovel(_id,_payload,options){calls.push({keepalive:options.keepalive===true});if(!options.keepalive)await normalGate;return{sharedVersion:2}}}};
const snapshot={novelId:'n1',episodeId:null,chunk:1,ratio:0.1,ts:1};
const normal=syncProgressState(app,{snapshot,signature:'normal'});
await new Promise(resolve=>setTimeout(resolve,0));
const lifecycle=syncProgressState(app,{snapshot:{...snapshot,ratio:0.2},signature:'lifecycle',keepalive:true,lifecycle:true});
await new Promise(resolve=>setTimeout(resolve,0));
assert.deepEqual(calls,[{keepalive:false},{keepalive:true}],'lifecycle request must start without waiting for normal sync');
releaseNormal();
assert.equal((await lifecycle).synced,true);
assert.equal((await normal).synced,true);
console.log(JSON.stringify({pass:'v613-progress-lifecycle-immediate-smoke-pass',calls}));
