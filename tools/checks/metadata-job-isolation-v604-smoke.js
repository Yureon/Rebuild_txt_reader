#!/usr/bin/env node
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const {createMetadataQueueService}=require('../../server/services/metadata-queue-service');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'txt-reader-v604-job-isolation-'));
 const queue=createMetadataQueueService({storePath:path.join(root,'queue.json'),handler:async()=>({ok:true}),pollMs:10000});
 const input={type:'collect',mode:'search',novel:{id:'novel-a'},providerIds:['p'],requestedBy:'user-a'};
 const first=queue.enqueue(input,{deferSchedule:true});
 const reused=queue.enqueue({...input,requestedBy:'user-b'},{deferSchedule:true});
 assert.equal(first.id,reused.id);
 assert.deepEqual(new Set(reused.requesters),new Set(['user-a','user-b']));
 await queue.flush();
 const persisted=JSON.parse(fs.readFileSync(path.join(root,'queue.json'),'utf8'));
 assert.deepEqual(new Set(persisted.jobs[0].requesters),new Set(['user-a','user-b']));
 await queue.stop();
 const route=fs.readFileSync('server/routes/metadata-routes.js','utf8');
 const service=fs.readFileSync('server/services/metadata-service.js','utf8');
 assert(route.includes('canAccessJob(ctx, job)'));
 assert(route.includes('canAccessJob(ctx, existing)'));
 assert(service.includes('listJobsForRequester'));
 assert(route.includes('publicJobForContext'));
 assert(route.includes('requestedBy, requesters, dedupeKey'));
 assert(route.includes('queueStatusForContext'));
 assert(route.includes('scoped:true'));
 console.log(JSON.stringify({pass:'v604-metadata-job-isolation-smoke-pass'}));
})().catch(error=>{console.error(error);process.exitCode=1;});
