#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chooseLocalProgressPayload, compactProgressForLocalStorage } from '../../public/scripts/rebuild/core/progress-storage.mjs';
import { syncProgressState } from '../../public/scripts/rebuild/features/reader/progress.mjs';

const require = createRequire(import.meta.url);
const normalizer = require('../../server/services/state-normalizer');
const { createStateWriteService } = require('../../server/services/state-write-service');

let serverState = normalizer.createEmptyUserState();
serverState.shared.progress.byNovel.existing = { novelId:'existing', episodeId:null, chunk:4, totalChunks:10, ratio:0.4, ts:10 };
normalizer.markSharedSyncVersion(serverState, 7);
const service = createStateWriteService({
  syncStateService:{ get:()=>serverState, set:value=>(serverState=value), saveSoon:()=>true },
  normalizer
});
const snapshot = {
  novelId:'novel-2', episodeId:'episode-9', episodeIdx:8, chunk:12, totalChunks:20,
  ratio:0.35, documentRatio:0.75, episodeDocumentRatio:0.35, globalBlockIndex:222,
  fileCharIndex:9033, ts:1000, sourceDeviceId:'device_1234', sourceDeviceName:'test'
};
const result = service.saveProgressDelta({ snapshot, syncVersion:8, updatedAt:1000 }, snapshot.novelId);
assert.equal(result.sharedVersion,8);
assert.equal(result.shared,undefined,'delta response must not echo the full shared state');
assert.equal(serverState.shared.progress.byNovel.existing.novelId,'existing','delta merge must preserve other novels');
assert.equal(serverState.shared.progress.byNovel['novel-2'].fileCharIndex,9033);
assert.equal(serverState.shared.progress.readMeta['novel-2-episode-9'].documentRatio,0.35);
assert.equal(serverState.shared.progress.positions['pos-novel-2-episode-9'].globalBlockIndex,222);
assert.throws(() => service.saveProgressDelta({ snapshot:{...snapshot,novelId:'other'}, syncVersion:9, updatedAt:1100 }, 'novel-2'), /invalid/);

const hugeProgress = { lastRead:snapshot, byNovel:{}, positions:{}, readMeta:{} };
for (let i=0;i<2000;i+=1) {
  const id=`novel-${i}`;
  hugeProgress.byNovel[id]={...snapshot,novelId:id,ts:i};
  hugeProgress.readMeta[`${id}-single`]={...snapshot,novelId:id,episodeId:null,ts:i};
  hugeProgress.positions[`pos-${id}-single`]={documentRatio:0.5,fallbackChunk:1,fallbackRatio:0.5,ts:i};
}
let captured = null;
const app = {
  state:{ sharedVersion:20, progress:hugeProgress, progressSyncRequest:null, shared:{} },
  api:{ async patchProgressNovel(novelId,payload) { captured={novelId,payload}; return {sharedVersion:21,progressSnapshot:payload.snapshot}; } }
};
const sync = await syncProgressState(app,{snapshot});
assert.equal(sync.synced,true);
assert.equal(sync.mode,'delta');
assert.equal(captured.novelId,'novel-2');
assert.equal(Object.prototype.hasOwnProperty.call(captured.payload,'progress'),false,'delta request must not contain full progress state');
assert.ok(Buffer.byteLength(JSON.stringify(captured.payload)) < 4096,'delta request must stay well below keepalive limits');

let rejectedCalls=0;
const rejectedApp={state:{sharedVersion:1,progress:hugeProgress,progressSyncRequest:null,shared:{}},api:{async patchProgressNovel(){rejectedCalls+=1;const error=new Error('too large');error.status=413;throw error;}}};
const rejected=await syncProgressState(rejectedApp,{snapshot});
assert.equal(rejected.synced,false);
assert.equal(rejectedCalls,1,'non-retryable client errors must not be retried');
assert.equal(rejected.attempts,1,'reported attempts must match actual calls');

const compact = compactProgressForLocalStorage(hugeProgress);
assert.ok(Object.keys(compact.byNovel).length <= 300);
assert.ok(Object.keys(compact.readMeta).length <= 800);
assert.ok(Object.keys(compact.positions).length <= 1402);
assert.ok(Buffer.byteLength(JSON.stringify(compact)) < 512 * 1024);
const oversized = structuredClone(hugeProgress);
for (const value of Object.values(oversized.byNovel)) value.longDiagnostic = '가'.repeat(1800);
for (const value of Object.values(oversized.readMeta)) value.longDiagnostic = '나'.repeat(1800);
const selected = chooseLocalProgressPayload(oversized);
assert.equal(selected.compacted,true);
assert.ok(selected.bytes <= 512 * 1024,'local bootstrap payload must remain within its byte budget');

console.log(JSON.stringify({pass:'v612-progress-delta-smoke-pass',deltaBytes:Buffer.byteLength(JSON.stringify(captured.payload)),compactBytes:Buffer.byteLength(JSON.stringify(compact))}));
