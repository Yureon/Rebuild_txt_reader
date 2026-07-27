#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const registryPath = require.resolve('../../server/services/metadata-provider-registry');
const metadataPath = require.resolve('../../server/services/metadata-service');
const originalRegistry = require(registryPath);
const calls = [];
function provider(id, name, priority, score) {
  const host = `${id}.example`;
  return {
    id, name, priority, adapterKey:`${id}-adapter`, revision:1, description:'fixture', enabled:true,
    supportsSearch:true, supportsDirect:false, browserProfileSupported:false,
    searchHosts:[host], detailHosts:[host], allowedPathPrefixes:['/search','/detail'], coverHosts:[],
    adapter:{
      revision:1,
      requestProfile:'default',
      buildSearchRequests(terms) { return [{ url:`https://${host}/search?q=${encodeURIComponent(terms.title)}`, method:'GET' }]; },
      parseSearchResults(_body, finalUrl, expected) {
        calls.push(id);
        return [{
          sourceUrl:`https://${host}/detail/1`, remoteId:'1', title:expected.title, author:'작가', matchScore:score,
          inlineMetadata:{ title:expected.title, author:'작가', synopsis:`${name} 상세`, sourceUrl:`https://${host}/detail/1`, remoteId:'1' }
        }];
      }
    }
  };
}
const providers = [provider('p-priority','우선 공급자',10,0.95), provider('p-score','고득점 공급자',20,0.99)];
require.cache[registryPath].exports = {
  ...originalRegistry,
  listMetadataProviders:() => providers.map(({adapter,...item}) => item),
  getMetadataProvider:id => providers.find(item => item.id === id) || null,
  resolveDirectMetadataTarget:() => null
};
delete require.cache[metadataPath];
const { createMetadataService, METADATA_SCORE_FIRST_LIVE_COMPETITION_PASS } = require(metadataPath);
const { createMetadataStoreService } = require('../../server/services/metadata-store-service');

function waitFor(check, timeoutMs=5000) {
  const start=Date.now();
  return new Promise((resolve,reject)=>{ const tick=()=>{ try { const v=check(); if(v) return resolve(v); } catch(e){ return reject(e); } if(Date.now()-start>timeoutMs) return reject(new Error('timeout')); setTimeout(tick,10); }; tick(); });
}
(async()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'metadata-live-score-v627-'));
  let service;
  try {
    const store=createMetadataStoreService({storePath:path.join(tmp,'metadata.json')});
    service=createMetadataService({
      store,
      transport:{ async fetchProvider(_provider,url){ return {statusCode:200,headers:{},body:'ok',finalUrl:url,contentType:'text/html'}; } },
      coverService:{ async cacheRemoteCover(){ return null; } },
      queuePath:path.join(tmp,'queue.json'), bulkDir:path.join(tmp,'bulk'), enabled:true, concurrency:1, maxJobs:8,
      requestIntervalMs:3000, delay:async()=>{}, now:(()=>{let n=0; return ()=>n+=5000;})(), random:()=>0
    });
    const novel={id:'novel',title:'경쟁 작품',author:'작가',progressAliases:['novel']};
    const queued=await service.collect(novel,{providerIds:['p-priority','p-score']},'owner');
    const done=await waitFor(()=>{const j=service.getJob(queued.id); return j&&['completed','failed'].includes(j.status)?j:null;});
    assert.equal(done.status,'completed',done.lastError);
    assert.deepEqual(calls,['p-priority','p-score'],'both providers must participate before a 95% candidate is applied');
    const applied=service.getNovelMetadata(novel).applied;
    assert(applied);
    assert.equal(applied.providerId,'p-score');
    assert.equal(done.result.liveCompetitionPass,METADATA_SCORE_FIRST_LIVE_COMPETITION_PASS);
    console.log(JSON.stringify({pass:'v627-metadata-live-score-competition-smoke-pass',provider:applied.providerId,calls}));
  } finally {
    if(service) await service.stop();
    fs.rmSync(tmp,{recursive:true,force:true});
    require.cache[registryPath].exports=originalRegistry;
    delete require.cache[metadataPath];
  }
})().catch(error=>{ console.error(error&&error.stack||error); process.exit(1); });
