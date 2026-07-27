#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { putDevicePatch } from '../../public/scripts/rebuild/features/sync/device-state-write.mjs';

const versions = [];
let serverVersion = 4;
let calls = 0;
const app = {
  state:{ deviceId:'device-12345678', deviceName:'테스트', deviceVersion:4, device:{}, deviceSyncRequest:null },
  api:{ async putDevice(payload) {
    calls += 1;
    versions.push(payload.syncVersion);
    if (calls === 1) {
      serverVersion = 5;
      throw new Error('response-lost-after-commit');
    }
    if (payload.syncVersion <= serverVersion) return { skipped:true, reason:'stale_device_version', deviceVersion:serverVersion, device:{prefs:{fontSize:20}} };
    serverVersion = payload.syncVersion;
    return { skipped:false, deviceVersion:serverVersion, device:{prefs:payload.prefs} };
  } }
};
const result = await putDevicePatch(app, { prefs:{fontSize:22} });
assert.equal(result.synced,true,'device write must recover after a lost response and stale version');
assert.deepEqual(versions,[5,5,6]);
assert.equal(app.state.deviceVersion,6);
assert.equal(app.state.device.prefs.fontSize,22);
assert.equal(app.state.deviceSyncRequest,null);

let releaseFirst;
const serialVersions=[];
const serialApp={
  state:{deviceId:'device-abcdefgh',deviceName:'직렬',deviceVersion:1,device:{},deviceSyncRequest:null},
  api:{async putDevice(payload){serialVersions.push(payload.syncVersion);if(serialVersions.length===1)await new Promise(resolve=>{releaseFirst=resolve;});return{skipped:false,deviceVersion:payload.syncVersion,device:{prefs:payload.prefs||{}}};}}
};
const first=putDevicePatch(serialApp,{prefs:{fontSize:20}});
const second=putDevicePatch(serialApp,{prefs:{fontSize:21}});
await new Promise(resolve=>setImmediate(resolve));
assert.equal(serialVersions.length,1,'device writes must be serialized');
releaseFirst();
await Promise.all([first,second]);
assert.deepEqual(serialVersions,[2,3]);

for(const file of ['public/scripts/rebuild/features/sync/periodic-state-push.mjs','public/scripts/rebuild/features/recovery/import-writeback.mjs']){
  const source=fs.readFileSync(file,'utf8');
  assert(source.includes('putDevicePatch'),`${file} must use serialized device writes`);
  assert(!source.includes('app.api.putDevice('),`${file} bypasses device write helper`);
}
console.log(JSON.stringify({pass:'v602-device-state-write-smoke-pass',versions}));
