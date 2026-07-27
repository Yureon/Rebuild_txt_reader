#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const {atomicWriteCompressedJsonAsync}=require('../../server/repositories/compressed-json-file-store');
const {createMetadataStoreService}=require('../../server/services/metadata-store-service');
const {createMetadataService}=require('../../server/services/metadata-service');
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v643-provider-settings-'));
  let failWrites=false;
  const store=createMetadataStoreService({
    storePath:path.join(dir,'work-metadata.json'),
    logger:{warn(){}},
    writeCompressed:async(...args)=>{
      if(failWrites) throw Object.assign(new Error('fixture durable write failure'),{code:'EIO'});
      return atomicWriteCompressedJsonAsync(...args);
    }
  });
  const configured=await store.setProviderSettingsDurably('builtin-novelpia',{
    enabled:true,priority:7,autoApply:false,autoApplyThreshold:0.947,requestIntervalMs:5250,searchLimit:8
  });
  assert.equal(configured.pass,'v643-metadata-provider-settings-pass');
  assert.deepEqual({
    enabled:configured.enabled,priority:configured.priority,autoApply:configured.autoApply,
    autoApplyThreshold:configured.autoApplyThreshold,requestIntervalMs:configured.requestIntervalMs,searchLimit:configured.searchLimit
  },{enabled:true,priority:7,autoApply:false,autoApplyThreshold:0.947,requestIntervalMs:5250,searchLimit:8});
  await assert.rejects(()=>store.setProviderSettingsDurably('builtin-novelpia',{autoApplyThreshold:0.69}),error=>error?.code==='METADATA_PROVIDER_SETTINGS_INVALID'&&error?.field==='autoApplyThreshold');
  await assert.rejects(()=>store.setProviderSettingsDurably('builtin-novelpia',{requestIntervalMs:60001}),error=>error?.code==='METADATA_PROVIDER_SETTINGS_INVALID'&&error?.field==='requestIntervalMs');
  await assert.rejects(()=>store.setProviderSettingsDurably('builtin-novelpia',{searchLimit:0}),error=>error?.code==='METADATA_PROVIDER_SETTINGS_INVALID'&&error?.field==='searchLimit');
  const before=store.getProviderSettings('builtin-novelpia');
  failWrites=true;
  await assert.rejects(()=>store.setProviderSettingsDurably('builtin-novelpia',{priority:99,searchLimit:3}),/fixture durable write failure/);
  assert.deepEqual(store.getProviderSettings('builtin-novelpia'),before,'failed durable write must rollback provider settings');
  failWrites=false;
  const service=createMetadataService({
    store,
    transport:{async fetchProvider(){throw new Error('network must not be used by provider settings test');}},
    coverService:{async cacheRemoteCover(){return null;}},
    queuePath:path.join(dir,'queue.json'),bulkDir:path.join(dir,'batches'),enabled:true,concurrency:1,maxJobs:4,maxAttempts:1,pollMs:20
  });
  const descriptor=service.listProviders().find(provider=>provider.id==='builtin-novelpia');
  assert(descriptor,'novelpia provider descriptor missing');
  assert.equal(descriptor.priority,7);
  assert.equal(descriptor.autoApply,false);
  assert.equal(descriptor.autoApplyThreshold,0.947);
  assert.equal(descriptor.baseRequestIntervalMs,5250);
  assert.equal(descriptor.searchLimit,8);
  assert.deepEqual(descriptor.requestDelayRangeMs,[Math.round(5250*1.5),Math.round(5250*2)]);
  await service.stop();
  const reload=createMetadataStoreService({storePath:path.join(dir,'work-metadata.json'),logger:{warn(){}}});
  assert.equal(reload.getProviderSettings('builtin-novelpia').searchLimit,8);
  assert.equal(reload.getProviderSettings('builtin-novelpia').requestIntervalMs,5250);
  await reload.close();
  fs.rmSync(dir,{recursive:true,force:true});
  console.log(JSON.stringify({pass:'v643-metadata-provider-settings-pass',durable:true,validated:true,rollback:true,runtime:true}));
})().catch(error=>{console.error(error);process.exit(1);});
