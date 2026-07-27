#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const zlib=require('zlib');
const {spawnSync}=require('child_process');
const {createMetadataCandidateShardStore}=require('../../server/services/metadata-candidate-shard-store');

const total=100000, shardCount=32, maxCandidates=20000, maxPerWork=30;
const protectedId='candidate-protected-old';

function child(mode, baseDir) {
  const manifest={version:1,shardCount,revisions:Array(shardCount).fill(1)};
  const store=createMetadataCandidateShardStore({baseDir,shardCount});
  if (global.gc) global.gc();
  const before=process.memoryUsage();
  const started=process.hrtime.bigint();
  const loaded=mode==='bounded'
    ? store.loadBoundedIsolated(manifest,{}, {maxCandidates,maxCandidatesPerWork:maxPerWork,maxCandidateResidentBytes:48*1024*1024,protectedIds:new Set([protectedId])})
    : store.load(manifest,{});
  if (global.gc) global.gc();
  const after=process.memoryUsage();
  const candidates=loaded.candidates;
  const values=Object.values(candidates);
  const perWork=new Map();
  for(const item of values){ if(item.id===protectedId) continue; perWork.set(item.workKey,(perWork.get(item.workKey)||0)+1); }
  const payload={
    mode, input:loaded.seen||values.length, retained:values.length,
    maxPerWork:perWork.size?Math.max(...perWork.values()):0,
    protected:values.some(item=>item.id===protectedId),
    heapUsedDelta:after.heapUsed-before.heapUsed,
    rssDelta:after.rss-before.rss,
    elapsedMs:Number(process.hrtime.bigint()-started)/1e6
  };
  console.log(JSON.stringify(payload));
}

if(process.argv[2]==='--child') {
  child(process.argv[3],process.argv[4]);
  process.exit(0);
}

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'v676-candidates-'));
try {
  let sequence=0;
  for(let shard=0;shard<shardCount;shard++) {
    const candidates={};
    const count=Math.floor(total/shardCount)+(shard<total%shardCount?1:0);
    for(let offset=0;offset<count;offset++,sequence++) {
      const id=`candidate-${sequence}`;
      candidates[id]={
        id,
        workKey:sequence<1000?'hot-work':`work-${Math.floor(sequence/3)}`,
        updatedAt:new Date(1700000000000+sequence).toISOString(),
        aliases:[`alias-${sequence}`],
        data:{title:`작품 ${sequence}`,author:`작가 ${sequence%1000}`,description:`설명 ${sequence}`}
      };
    }
    if(shard===0) candidates[protectedId]={id:protectedId,workKey:'hot-work',updatedAt:'2000-01-01T00:00:00.000Z',data:{title:'보호 후보'}};
    const payload={schemaVersion:1,shardIndex:shard,candidateRevision:1,candidates};
    fs.writeFileSync(path.join(tmp,`shard-${String(shard).padStart(2,'0')}.json.gz`),zlib.gzipSync(Buffer.from(JSON.stringify(payload)),{level:1}));
  }
  const runMode=mode=>{
    const run=spawnSync(process.execPath,['--expose-gc',__filename,'--child',mode,tmp],{encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
    assert.equal(run.status,0,run.stderr||run.error?.message);
    return JSON.parse(String(run.stdout).trim().split(/\r?\n/u).pop());
  };
  const full=runMode('full');
  const bounded=runMode('bounded');
  assert.equal(full.retained,total+1);
  assert(bounded.retained<=maxCandidates+1,`retained ${bounded.retained}`);
  assert.equal(bounded.protected,true,'applied candidate reference must survive');
  assert(bounded.maxPerWork<=maxPerWork,`per-work max ${bounded.maxPerWork}`);
  assert(bounded.heapUsedDelta<full.heapUsedDelta,`bounded heap ${bounded.heapUsedDelta} should be below full ${full.heapUsedDelta}`);
  console.log(JSON.stringify({pass:'v676-metadata-bounded-resident-smoke-pass',fixture:{total:total+1,shards:shardCount},full,bounded,heapReductionRatio:Number((full.heapUsedDelta/Math.max(1,bounded.heapUsedDelta)).toFixed(2))}));
} finally { fs.rmSync(tmp,{recursive:true,force:true}); }
