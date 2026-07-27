#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const crypto=require('crypto');
const {createLibraryVariantPreferenceService}=require('../../server/services/library-variant-preference-service');
const {buildLibraryVariantPresentation}=require('../../server/services/library-variant-service');
const {buildSketch}=require('../../server/services/library-fingerprint-sketch');
function fp(text,bytes){return {prefixHash:crypto.createHash('sha256').update(text).digest('hex'),prefixSketch:buildSketch(text),bytes,mtimeMs:1,replacementRatio:0};}
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v642-pref-'));
 const store=path.join(dir,'preferences.json');
 const text='동일한 작품 본문이 길게 이어진다. 등장인물은 성문을 지나 여행을 시작한다. '.repeat(30);
 const novels=[
  {id:'a',title:'동일 작품',author:'작가',description:'동일 소개',metadata:{},singlePath:'동일 작품 1-100.txt',contentFingerprint:fp(text,100000)},
  {id:'b',title:'동일 작품',author:'작가',description:'동일 소개',metadata:{},singlePath:'동일 작품 1-200完.txt',contentFingerprint:fp(text,200000)}
 ];
 let service=createLibraryVariantPreferenceService({storePath:store,logger:{warn(){}}});
 let result=buildLibraryVariantPresentation(novels,{preferenceService:service});
 const key=result.items[0].variantPreferenceKey;
 await service.setRepresentative(key,'a');
 result=buildLibraryVariantPresentation(novels,{preferenceService:service});
 assert.equal(result.items[0].id,'a');
 await service.stop();
 service=createLibraryVariantPreferenceService({storePath:store,logger:{warn(){}}});
 assert.equal(service.getRepresentative(key),'a');
 await service.setExcluded('a','b',true);
 result=buildLibraryVariantPresentation(novels,{preferenceService:service});
 assert.equal(result.items.length,2);
 await service.setExcluded('a','b',false);
 result=buildLibraryVariantPresentation(novels,{preferenceService:service});
 assert.equal(result.items.length,1);
 await service.clearRepresentative(key);
 assert.equal(service.getRepresentative(key),'');
 await service.stop();
 fs.rmSync(dir,{recursive:true,force:true});
 console.log(JSON.stringify({pass:'v642-library-variant-preference-pass',persistent:true,exclusion:true,reversible:true}));
})().catch(error=>{console.error(error);process.exit(1);});
