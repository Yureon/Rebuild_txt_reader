#!/usr/bin/env node
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const {createMetadataQueueService}=require('../../server/services/metadata-queue-service');
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'txt-reader-job-requesters-'));
  const queue=createMetadataQueueService({
    storePath:path.join(dir,'queue.json'),
    handler:async()=>({ok:true}),
    writeJsonSync:(file,value)=>fs.writeFileSync(file,JSON.stringify(value)),
    writeJsonAsync:async(file,value)=>fs.promises.writeFile(file,JSON.stringify(value)),
    pollMs:10000
  });
  const base={type:'collect',mode:'single',novel:{id:'novel-1'},providerIds:['p1']};
  let job;
  for(let index=0;index<80;index++) job=queue.enqueue({...base,requestedBy:`user-${index}`},{deferSchedule:true});
  assert.equal(job.requesters.length,80,'deduped job must retain every requester');
  assert(job.requesters.includes('user-79'),'last requester must keep job access');
  await queue.stop();
  fs.rmSync(dir,{recursive:true,force:true});
  console.log(JSON.stringify({pass:'v604-metadata-job-requester-scale-smoke-pass',requesters:80}));
})().catch(error=>{console.error(error);process.exit(1)});
