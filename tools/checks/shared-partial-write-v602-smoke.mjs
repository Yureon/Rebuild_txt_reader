#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { persistAndSync } from '../../public/scripts/rebuild/features/bookmarks/model.mjs';
import { applyServerStateData } from '../../public/scripts/rebuild/features/sync/server-state-hydration.mjs';
import { syncProgressState } from '../../public/scripts/rebuild/features/reader/progress.mjs';
import { mergeSharedPatch, putSharedPatch } from '../../public/scripts/rebuild/features/sync/shared-state-write.mjs';

const memory = new Map();
globalThis.localStorage = {
  getItem:key => memory.has(key) ? memory.get(key) : null,
  setItem:(key,value) => memory.set(key,String(value)),
  removeItem:key => memory.delete(key)
};

let captured = null;
const staleProgress = { lastRead:{ novelId:'old', ts:1 }, byNovel:{ old:{ ts:1 } }, positions:{}, readMeta:{} };
const app = {
  state:{
    shared:{ progress:staleProgress, viewerPrefs:{ fontSize:20 }, syncPolicy:{ share:{ progress:true } } },
    bookmarks:[{ id:'b1', novelId:'n1', ts:10 }],
    recents:[], favorites:new Set(['n1']), userTags:['사용자'], novelUserTags:{n1:['사용자']},
    sharedBookDataSyncRequest:null
  },
  api:{
    async putShared(payload) {
      captured = payload;
      return { shared:mergeSharedPatch(app.state.shared,payload), sharedVersion:4 };
    }
  }
};
const result = await persistAndSync(app);
assert.equal(result.synced,true);
assert(captured && Array.isArray(captured.bookmarks));
assert.equal(captured.syncVersion,0,'partial write must send the current server version as its optimistic base');
for (const forbidden of ['progress','viewerPrefs','syncPolicy','theme']) assert(!Object.prototype.hasOwnProperty.call(captured,forbidden), `partial book write leaked ${forbidden}`);
assert.equal(app.state.shared.progress, staleProgress, 'local merge must preserve progress without retransmitting it');

const hydrationApp = { state:{
  bookmarks:[{id:'stale'}], recents:[{novelId:'stale'}], favorites:new Set(['stale']), userTags:[], novelUserTags:{},
  progress:{lastRead:null,byNovel:{},positions:{},readMeta:{}}, prefs:{preprocess:{}}, collapsedFolders:new Set()
} };
applyServerStateData(hydrationApp, { shared:{ bookmarks:[], recents:[], favorites:[], userTags:[], novelUserTags:{} }, device:null }, { mergeContent:true });
assert.deepEqual(hydrationApp.state.bookmarks,[], 'empty remote bookmarks must clear stale local data');
assert.deepEqual(hydrationApp.state.recents,[], 'empty remote recents must clear stale local data');


const require = createRequire(import.meta.url);
const normalizer = require('../../server/services/state-normalizer');
const { createStateWriteService } = require('../../server/services/state-write-service');
let serverState = normalizer.createEmptyUserState();
normalizer.markSharedSyncVersion(serverState, 5);
normalizer.markSharedSyncUpdatedAt(serverState, 100);
const stateWriteService = createStateWriteService({
  syncStateService:{ get:()=>serverState, set:value=>(serverState=value), saveSoon:()=>true },
  normalizer
});
const accepted = stateWriteService.saveSharedState({ favorites:['n2'], syncVersion:5, updatedAt:200 });
assert.equal(accepted.sharedVersion,6,'shared partial write must advance the global shared version');
const skipped = stateWriteService.saveSharedState({ favorites:['stale'], syncVersion:4, updatedAt:300 });
assert.equal(skipped.skipped,true,'stale shared base version must be rejected even with a newer client clock');
assert.deepEqual(serverState.shared.favorites,['n2']);

const progressVersions = [];
const progressApp = {
  state:{ sharedVersion:4, progress:{lastRead:{novelId:'n',ts:2},byNovel:{},positions:{},readMeta:{}}, progressSyncRequest:null, shared:{} },
  api:{ async putProgress(payload) {
    progressVersions.push(payload.syncVersion);
    if (progressVersions.length === 1) return { skipped:true, reason:'stale_shared_version', sharedVersion:5, shared:{progress:{lastRead:{novelId:'remote',ts:1},byNovel:{},positions:{},readMeta:{}}} };
    return { skipped:false, sharedVersion:6, shared:{progress:payload.progress} };
  } }
};
const progressResult = await syncProgressState(progressApp);
assert.equal(progressResult.synced,true,'progress save must retry once after a stale version response');
assert.deepEqual(progressVersions,[5,6]);
assert.equal(progressApp.state.sharedVersion,6);
assert.equal(progressApp.state.progressSyncRequest,null);

const serialPayloads = [];
let releaseFirst;
const serialApp = {
  state:{ shared:{ viewerPrefs:{ fontSize:20 } }, sharedVersion:8, sharedSyncRequest:null },
  api:{ async putShared(payload) {
    serialPayloads.push(payload);
    if (serialPayloads.length === 1) await new Promise(resolve => { releaseFirst = resolve; });
    return { sharedVersion:payload.syncVersion + 1, shared:mergeSharedPatch(serialApp.state.sharedConfirmed || {}, payload) };
  } }
};
const firstPatch = putSharedPatch(serialApp, { viewerPrefs:{ fontSize:21 } });
const secondPatch = putSharedPatch(serialApp, { favorites:['n2'] });
await new Promise(resolve => setImmediate(resolve));
assert.equal(serialPayloads.length,1,'shared patches must be serialized globally');
releaseFirst();
const [firstSerialResult, secondSerialResult] = await Promise.all([firstPatch,secondPatch]);
assert.equal(firstSerialResult.synced,true);
assert.equal(secondSerialResult.synced,true);
assert.deepEqual(serialPayloads.map(item=>item.syncVersion),[8,9]);
assert.equal(serialApp.state.shared.viewerPrefs.fontSize,21);
assert.deepEqual(serialApp.state.shared.favorites,['n2']);
assert.equal(serialApp.state.sharedSyncRequest,null);

let lostSharedServerVersion = 2;
let lostSharedCalls = 0;
const lostSharedVersions = [];
const lostSharedApp = {
  state:{shared:{favorites:[]},sharedVersion:2,sharedSyncRequest:null},
  api:{async putShared(payload){
    lostSharedCalls += 1;
    lostSharedVersions.push(payload.syncVersion);
    if(lostSharedCalls===1){lostSharedServerVersion=3;throw new Error('response-lost-after-commit');}
    if(payload.syncVersion < lostSharedServerVersion)return{skipped:true,reason:'stale_shared_version',sharedVersion:lostSharedServerVersion,shared:{favorites:['n3']}};
    lostSharedServerVersion=payload.syncVersion+1;
    return{skipped:false,sharedVersion:lostSharedServerVersion,shared:mergeSharedPatch({favorites:['n3']},payload)};
  }}
};
const lostSharedResult=await putSharedPatch(lostSharedApp,{favorites:['n4']});
assert.equal(lostSharedResult.synced,true,'shared patch must recover after a committed request loses its response');
assert.deepEqual(lostSharedVersions,[2,2,3]);
assert.deepEqual(lostSharedApp.state.shared.favorites,['n4']);

const lostProgressVersions=[];
let lostProgressServerVersion=10;
let lostProgressCalls=0;
const lostProgressApp={state:{sharedVersion:10,progress:{lastRead:{novelId:'n5'},byNovel:{},positions:{},readMeta:{}},shared:{},progressSyncRequest:null},api:{async putProgress(payload){
  lostProgressCalls+=1;lostProgressVersions.push(payload.syncVersion);
  if(lostProgressCalls===1){lostProgressServerVersion=11;throw new Error('response-lost-after-commit');}
  if(payload.syncVersion<=lostProgressServerVersion)return{skipped:true,reason:'stale_shared_version',sharedVersion:lostProgressServerVersion,shared:{progress:payload.progress}};
  lostProgressServerVersion=payload.syncVersion;return{skipped:false,sharedVersion:lostProgressServerVersion,shared:{progress:payload.progress}};
}}};
const lostProgressResult=await syncProgressState(lostProgressApp);
assert.equal(lostProgressResult.synced,true,'progress must recover after a committed request loses its response');
assert.deepEqual(lostProgressVersions,[11,11,12]);

for (const file of [
  'public/scripts/rebuild/features/recovery/local-maintenance-actions.mjs',
  'public/scripts/rebuild/features/recovery/import-writeback.mjs'
]) {
  const source = fs.readFileSync(file,'utf8');
  assert(source.includes('putSharedPatch'), `${file} must use serialized shared patch writes`);
  assert(!source.includes('app.api.putShared('), `${file} still bypasses the shared write serializer`);
}

const mergeSource = fs.readFileSync('server/services/state-normalizer-merge.js','utf8');
assert(mergeSource.includes('assignSafeRecord({}, ensurePlainObject(prevShared.viewerPrefs)'), 'server viewerPrefs patches must merge with current server state');
for (const file of [
  'public/scripts/rebuild/features/sync/device-management.mjs',
  'public/scripts/rebuild/features/settings/theme-editor.mjs',
  'public/scripts/rebuild/features/settings/custom-css.mjs',
  'public/scripts/rebuild/features/settings/fonts.mjs',
  'public/scripts/rebuild/features/settings/preprocess.mjs'
]) {
  const source = fs.readFileSync(file,'utf8');
  assert(source.includes('putSharedPatch'), `${file} must use partial shared writes`);
  assert(!source.includes('...(app.state.shared || {})'), `${file} still spreads full shared state`);
}
console.log(JSON.stringify({pass:'v602-shared-partial-write-smoke-pass',captured:Object.keys(captured).sort()}));
