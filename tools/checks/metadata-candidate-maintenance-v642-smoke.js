#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const {atomicWriteCompressedJsonAsync}=require('../../server/repositories/compressed-json-file-store');
const {createMetadataStoreService}=require('../../server/services/metadata-store-service');

function provider(id){return {id,name:id,adapterKey:'fixture',adapter:{revision:1}};}
function add(store,novel,index,days){
  const candidate=store.saveCandidate(novel,provider(`p${index%2}`),{title:novel.title,author:novel.author,synopsis:`소개 ${index}`,sourceUrl:`https://example.test/${novel.id}/${index}`,remoteId:String(index)},{matchScore:0.8+index/1000});
  candidate.updatedAt=new Date(Date.now()-days*86400000).toISOString();
  candidate.createdAt=candidate.updatedAt;
  return candidate;
}
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v642-meta-clean-'));
  const store=createMetadataStoreService({storePath:path.join(dir,'metadata.json'),logger:{warn(){}}});
  const active={id:'active',title:'활성 작품',author:'작가'};
  const orphan={id:'orphan',title:'삭제 작품',author:'작가'};
  const activeCandidates=[];
  for(let i=0;i<8;i++) activeCandidates.push(add(store,active,i,60+i));
  const protectedCandidate=activeCandidates[0];
  store.applyCandidate(active,protectedCandidate.id);
  add(store,orphan,20,20); add(store,orphan,21,21);
  await store.flush();
  const before=store.getStorageStats().candidateCount;
  const plan=store.buildCandidateCleanupPlan({olderThanDays:30,orphanOlderThanDays:7,keepPerWork:2,keepPerProvider:1},{activeNovelIds:['active']});
  assert(plan.removeCount>0);
  assert(!plan.removals.some(item=>item.id===protectedCandidate.id));
  assert(plan.reasons.orphaned>=2);
  assert.equal(store.getStorageStats().candidateCount,before,'dry-run must not mutate');
  const result=await store.cleanupCandidatesDurably({olderThanDays:30,orphanOlderThanDays:7,keepPerWork:2,keepPerProvider:1,dryRun:false},{activeNovelIds:['active']});
  assert.equal(result.removedCount,plan.removeCount);
  assert(store.getStorageStats().candidateCount<before);
  assert(store.getAppliedForNovel(active));
  await store.close();

  let fail=false;
  const rollbackDir=fs.mkdtempSync(path.join(os.tmpdir(),'v642-meta-clean-rollback-'));
  const rollback=createMetadataStoreService({
    storePath:path.join(rollbackDir,'metadata.json'),logger:{warn(){}},
    writeCompressed:async(...args)=>{if(fail) throw Object.assign(new Error('fixture write failure'),{code:'EIO'});return atomicWriteCompressedJsonAsync(...args);}
  });
  const candidate=add(rollback,{id:'r',title:'롤백',author:'작가'},1,90);
  await rollback.flush();
  fail=true;
  await assert.rejects(()=>rollback.cleanupCandidatesDurably({olderThanDays:1,keepPerWork:0,keepPerProvider:0,dryRun:false},{activeNovelIds:['r']}),/fixture write failure/);
  assert.equal(rollback.getStorageStats().candidateCount,1,'failed durable cleanup must restore candidate');
  assert(rollback.buildCandidateCleanupPlan({olderThanDays:1,keepPerWork:0,keepPerProvider:0},{activeNovelIds:['r']}).removals.some(item=>item.id===candidate.id));
  fail=false; await rollback.close();
  fs.rmSync(dir,{recursive:true,force:true}); fs.rmSync(rollbackDir,{recursive:true,force:true});
  console.log(JSON.stringify({pass:'v642-metadata-candidate-maintenance-pass',protected:true,dryRun:true,rollback:true}));
})().catch(error=>{console.error(error);process.exit(1);});
