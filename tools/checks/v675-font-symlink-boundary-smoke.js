#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createFontService } = require('../../server/services/font-service');
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'txt-reader-v675-font-'));
  const fontDir=path.join(dir,'fonts'); const legacy=path.join(dir,'legacy');
  fs.mkdirSync(fontDir,{recursive:true}); fs.mkdirSync(legacy,{recursive:true});
  fs.writeFileSync(path.join(fontDir,'normal.ttf'),Buffer.from([0,1,0,0,1,2,3,4]));
  const outside=path.join(dir,'outside.ttf'); fs.writeFileSync(outside,Buffer.from([0,1,0,0,9,9,9,9]));
  let symlinkCreated=true;
  try { fs.symlinkSync(outside,path.join(fontDir,'escape.ttf')); } catch { symlinkCreated=false; }
  fs.writeFileSync(path.join(dir,'fonts.json'),JSON.stringify([{name:'Normal',family:'Normal',filename:'normal.ttf',size:8},{name:'Escape',family:'Escape',filename:'escape.ttf',size:8}]));
  const service=createFontService({fontDir,fontMetaPath:path.join(dir,'fonts.json'),legacyFontDir:legacy,legacyFontMetaPath:path.join(dir,'legacy.json'),userDataDir:path.join(dir,'users')});
  const normal=await service.getFontFileForResponseAsync('normal.ttf',{ownerId:'__owner__'});
  assert.equal(normal.noFollowPass,'v675-font-nofollow-pass'); assert(normal.handle); await normal.handle.close();
  if (symlinkCreated) await assert.rejects(()=>service.getFontFileForResponseAsync('escape.ttf',{ownerId:'__owner__'}),error=>error && error.status===404);
  fs.rmSync(dir,{recursive:true,force:true});
  console.log(JSON.stringify({pass:'v675-font-symlink-boundary-smoke-pass',normalOpen:true,symlinkCreated,symlinkBlocked:symlinkCreated}));
})().catch(error=>{console.error(error.stack||error);process.exitCode=1});
