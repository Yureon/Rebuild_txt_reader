#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
try { require.resolve('iconv-lite'); require.resolve('jschardet'); } catch (error) { console.error(JSON.stringify({ blocked:true, blockedDependency:'iconv-lite/jschardet', reason:'fingerprint dependencies unavailable' })); process.exit(77); }
const {createLibraryContentFingerprintService}=require('../../server/services/library-content-fingerprint-service');
const {sketchSimilarity}=require('../../server/services/library-fingerprint-sketch');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v642-fp-'));
 const lib=path.join(dir,'library'); fs.mkdirSync(lib);
 const a='소설의 첫 문장이 시작된다. 주인공은 성문을 지나 먼 여행을 떠난다. '.repeat(5000);
 const b=a+'마지막 외전이 추가되었다. '.repeat(100);
 fs.writeFileSync(path.join(lib,'a.txt'),a); fs.writeFileSync(path.join(lib,'b.txt'),b);
 const service=createLibraryContentFingerprintService({cachePath:path.join(dir,'cache.json'),libraryService:{safeJoinUnderLibrary(rel){return path.join(lib,rel);}},freshnessMs:60000,logger:{warn(){}}});
 service.request({id:'a',singlePath:'a.txt'}); service.request({id:'b',singlePath:'b.txt'});
 for(let i=0;i<200 && (service.getStatus().queueLength || service.getStatus().active);i++) await new Promise(r=>setTimeout(r,10));
 const fa=service.getCached({singlePath:'a.txt'}), fb=service.getCached({singlePath:'b.txt'});
 assert(fa && fb); assert(sketchSimilarity(fa.prefixSketch,fb.prefixSketch)>0.95); assert(fb.bytes>fa.bytes);
 const rev=service.getRevision();
 fs.appendFileSync(path.join(lib,'a.txt'),'변경');
 service.request({id:'a',singlePath:'a.txt'},{priority:'high'});
 for(let i=0;i<200 && (service.getStatus().queueLength || service.getStatus().active);i++) await new Promise(r=>setTimeout(r,10));
 assert(service.getRevision()>rev);
 await service.stop();
 fs.rmSync(dir,{recursive:true,force:true});
 console.log(JSON.stringify({pass:'v642-library-content-fingerprint-pass',similarity:sketchSimilarity(fa.prefixSketch,fb.prefixSketch)}));
})().catch(error=>{console.error(error);process.exit(1);});
