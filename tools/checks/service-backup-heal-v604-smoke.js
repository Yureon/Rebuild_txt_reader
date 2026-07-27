#!/usr/bin/env node
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const {createFontService}=require('../../server/services/font-service');
const {createSiteLanguageService}=require('../../server/services/site-language-service');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'txt-reader-v604-service-heal-'));
 const fontDir=path.join(root,'fonts'); fs.mkdirSync(fontDir,{recursive:true});
 const fontMeta=path.join(root,'font-library.json');
 fs.writeFileSync(fontMeta,'{broken'); fs.writeFileSync(fontMeta+'.bak','[]');
 const fontService=createFontService({fontDir,fontMetaPath:fontMeta,legacyFontDir:path.join(root,'legacy-fonts'),legacyFontMetaPath:path.join(root,'legacy-fonts.json'),userDataDir:path.join(root,'users'),logger:{warn(){}}});
 await fontService.getFontListResponseAsync({ownerId:'__owner__'});
 assert.deepEqual(JSON.parse(fs.readFileSync(fontMeta,'utf8')),[]);
 const langDir=path.join(root,'languages'); fs.mkdirSync(langDir,{recursive:true});
 const langPath=path.join(langDir,'ko-test.json');
 const lang={id:'ko-test',name:'테스트',enabled:true,map:{Hello:'안녕'}};
 fs.writeFileSync(langPath,'{broken'); fs.writeFileSync(langPath+'.bak',JSON.stringify(lang));
 const langService=createSiteLanguageService({siteLanguagesDir:langDir,bundledSiteLanguagesDir:'',logger:{warn(){}}});
 const list=await langService.listLanguagesAsync({includeDisabled:true});
 assert.equal(list.some(x=>x.id==='ko-test'),true);
 assert.equal(JSON.parse(fs.readFileSync(langPath,'utf8')).id,'ko-test');
 console.log(JSON.stringify({pass:'v604-service-backup-heal-smoke-pass'}));
})().catch(error=>{console.error(error);process.exitCode=1;});
