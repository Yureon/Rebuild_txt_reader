#!/usr/bin/env node
'use strict';
const assert=require('assert');const fs=require('fs');const os=require('os');const path=require('path');
const {createFontService}=require('../../server/services/font-service');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'txt-reader-v676-font-'));const fontDir=path.join(dir,'fonts');const legacy=path.join(dir,'legacy');fs.mkdirSync(fontDir,{recursive:true});fs.mkdirSync(legacy,{recursive:true});
 const target=path.join(fontDir,'io.ttf');fs.writeFileSync(target,Buffer.from([0,1,0,0,1,2,3,4]));fs.writeFileSync(path.join(dir,'fonts.json'),JSON.stringify([{name:'IO',family:'IO',filename:'io.ttf',size:8}]));
 const service=createFontService({fontDir,fontMetaPath:path.join(dir,'fonts.json'),legacyFontDir:legacy,legacyFontMetaPath:path.join(dir,'legacy.json'),userDataDir:path.join(dir,'users')});
 const original=fs.promises.open;fs.promises.open=async(file,...rest)=>{if(path.resolve(String(file))===path.resolve(target)){const error=new Error('synthetic I/O failure');error.code='EIO';throw error;}return original.call(fs.promises,file,...rest);};
 try{await assert.rejects(()=>service.getFontFileForResponseAsync('io.ttf',{ownerId:'__owner__'}),error=>error?.code==='EIO'&&!error.status);}finally{fs.promises.open=original;fs.rmSync(dir,{recursive:true,force:true});}
 console.log(JSON.stringify({pass:'v676-font-io-error-propagation-smoke-pass',eioPropagated:true,collapsedTo404:false}));
})().catch(error=>{console.error(error.stack||error);process.exitCode=1});
