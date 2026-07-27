#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createSyncStateService } = require('../../server/services/sync-state-service');
const PASS = 'v603-sync-state-durable-flush-smoke-pass';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-durable-v603-'));
let callback = null;
const service = createSyncStateService({
  syncPath:path.join(root,'state.json'), snapshotDir:path.join(root,'snapshots'),
  createEmptyState:()=>({value:0}), normalizeState:v=>({value:Number(v?.value)||0}),
  writeJson:(file,value,cb)=>{ callback=()=>{ fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,JSON.stringify(value)); cb(null); }; },
  logger:{error(){}}
});
(async()=>{
  service.set({value:7});
  let settled=false;
  const pending=service.flushAndWait().then(()=>{settled=true;});
  await new Promise(r=>setImmediate(r));
  assert.strictEqual(settled,false,'flushAndWait must wait for persistence callback');
  assert.strictEqual(typeof callback,'function');
  callback();
  await pending;
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(root,'state.json'),'utf8')),{value:7});
  const closing=service.close();
  await new Promise(r=>setImmediate(r));
  assert.strictEqual(typeof callback,'function');
  callback();
  await closing;
  const failure=createSyncStateService({
    syncPath:path.join(root,'failure.json'), snapshotDir:path.join(root,'snapshots2'),
    createEmptyState:()=>({value:0}), normalizeState:v=>({value:Number(v?.value)||0}),
    writeJson:(file,value,cb)=>setImmediate(()=>cb(Object.assign(new Error('injected'),{code:'EIO'}))), logger:{error(){}}
  });
  failure.set({value:9});
  await assert.rejects(failure.flushAndWait(),/injected/);
  console.log(JSON.stringify({pass:PASS}));
})().finally(()=>fs.rmSync(root,{recursive:true,force:true})).catch(e=>{console.error(e.stack||e);process.exitCode=1;});
