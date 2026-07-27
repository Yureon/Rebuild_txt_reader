#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMetadataQueueService, METADATA_QUEUE_RESTART_RESUME_PASS } = require('../../server/services/metadata-queue-service');
const { createMetadataStoreService, METADATA_COLLECTED_CANDIDATE_RETENTION_PASS } = require('../../server/services/metadata-store-service');
const { createMetadataService, METADATA_BULK_RESTART_RESUME_PASS, METADATA_BULK_COLLECTED_SKIP_PASS, METADATA_AUTO_APPLY_RECOVERY_PASS } = require('../../server/services/metadata-service');

const PASS='v614-metadata-restart-resume-smoke-pass';
const waitFor=async(check,timeout=4000)=>{const start=Date.now();while(!check()){if(Date.now()-start>timeout)throw new Error('waitFor timeout');await new Promise(r=>setTimeout(r,10));}};

(async()=>{
  const keepalive=setInterval(()=>{},1000);
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'txt-reader-metadata-resume-v614-'));
  try {
    const queuePath=path.join(root,'queue.json');
    let resumedRuns=0;
    const queue=createMetadataQueueService({
      storePath:queuePath,pollMs:10,maxAttempts:1,
      handler:async(job,context)=>{
        if(resumedRuns++>0)return {ok:true,cursor:job.cursor};
        await new Promise((resolve,reject)=>context.signal.addEventListener('abort',()=>reject(context.signal.reason),{once:true}));
      }
    });
    const job=queue.enqueue({type:'collect-bulk',mode:'search',batchId:'mb_'+'a'.repeat(24),total:8532,cursor:840,batchOffset:12345});
    queue.start();
    await waitFor(()=>queue.get(job.id)?.status==='running');
    await queue.stop();
    assert.equal(queue.get(job.id).status,'queued');
    assert.equal(queue.get(job.id).cursor,840);
    assert.equal(queue.get(job.id).batchOffset,12345);
    assert.equal(queue.status().restartResumePass,METADATA_QUEUE_RESTART_RESUME_PASS);

    const queue2=createMetadataQueueService({storePath:queuePath,pollMs:10,maxAttempts:1,handler:async()=>({ok:true})});
    queue2.start();
    await waitFor(()=>queue2.get(job.id)?.status==='completed');
    await queue2.stop();

    const storePath=path.join(root,'metadata.json');
    const store=createMetadataStoreService({storePath,maxCandidates:50000});
    const provider={id:'builtin-kakaopage',name:'카카오페이지',adapterKey:'kakaopage-webnovel-v1',adapter:{revision:11}};
    const collected={id:'collected',title:'수집 완료 후보',author:'로컬 작가명',progressAliases:['collected']};
    const missing={id:'missing',title:'미수집',author:'작가',progressAliases:['missing']};
    store.saveCandidate(collected,provider,{title:collected.title,author:'공식 작가명',sourceUrl:'https://page.kakao.com/content/1',remoteId:'1'},{matchScore:.9});
    await store.flush();
    assert.equal(store.hasCollectedMetadataForNovel(collected),true);
    assert.equal(store.collectedCandidateRetentionPass,METADATA_COLLECTED_CANDIDATE_RETENTION_PASS);

    const service=createMetadataService({
      store,
      transport:{async fetchProvider(){throw Object.assign(new Error('offline'),{code:'EAI_AGAIN'});}},
      coverService:{async cacheRemoteCover(){return null;}},
      queuePath:path.join(root,'service-queue.json'),bulkDir:path.join(root,'batches'),enabled:true,
      requestIntervalMs:3000,delay:async()=>{},random:()=>0,concurrency:1,maxAttempts:1,pollMs:20
    });
    const result=await service.collectMissing([collected,missing],{},'owner');
    assert.equal(result.count,1,'candidate-bearing work must not be recollected by collect-missing');
    assert.equal(result.recoveredApplied,1,'strong retained candidate must be auto-applied before the remaining batch is queued');
    assert.equal(result.autoApplyPass,METADATA_AUTO_APPLY_RECOVERY_PASS);
    assert.equal(store.getAppliedForNovel(collected)?.data?.title,collected.title);
    const queued=service.getJob(result.job.id);
    assert.equal(queued.total,1);
    assert.equal(METADATA_BULK_RESTART_RESUME_PASS,'v614-metadata-bulk-restart-resume-pass');
    assert.equal(METADATA_BULK_COLLECTED_SKIP_PASS,'v614-metadata-bulk-collected-skip-pass');
    await service.stop();

    // A real bulk service interrupted by shutdown must keep both the queue cursor
    // and the JSONL batch so a container replacement can continue the same job.
    const restartStorePath=path.join(root,'restart-metadata.json');
    const restartQueuePath=path.join(root,'restart-queue.json');
    const restartBulkDir=path.join(root,'restart-batches');
    const restartStore=createMetadataStoreService({storePath:restartStorePath,maxCandidates:50000});
    let transportEntered=false;
    const restartService=createMetadataService({
      store:restartStore,
      transport:{async fetchProvider(_provider,_url,options={}){
        transportEntered=true;
        return new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));
      }},
      coverService:{async cacheRemoteCover(){return null;}},
      queuePath:restartQueuePath,bulkDir:restartBulkDir,enabled:true,
      requestIntervalMs:3000,delay:async()=>{},random:()=>0,concurrency:1,maxAttempts:1,pollMs:10
    });
    const restartResult=await restartService.collectMissing([{id:'resume-book',title:'재개 작품',author:'작가',progressAliases:['resume-book']}],{},'owner');
    await waitFor(()=>transportEntered && restartService.getJob(restartResult.job.id)?.status==='running');
    const batchName=`${restartResult.job.batchId}.jsonl`;
    assert.equal(fs.existsSync(path.join(restartBulkDir,batchName)),true);
    await restartService.stop();
    const persistedRestart=JSON.parse(fs.readFileSync(restartQueuePath,'utf8')).jobs.find(item=>item.id===restartResult.job.id);
    assert.equal(persistedRestart.status,'queued');
    assert.equal(fs.existsSync(path.join(restartBulkDir,batchName)),true,'shutdown must preserve the remaining bulk batch');

    console.log(JSON.stringify({pass:PASS,cursor:840,total:8532,recollectCount:result.count,recoveredApplied:result.recoveredApplied,batchPreserved:true}));
  } finally { clearInterval(keepalive); fs.rmSync(root,{recursive:true,force:true}); }
})().catch(error=>{console.error(error&&error.stack||error);process.exit(1);});
