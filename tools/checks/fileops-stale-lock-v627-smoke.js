#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const {createFileopsService,FILEOPS_MUTATION_SERIALIZATION_PASS}=require('../../server/services/fileops-service');

(async()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'fileops-stale-v627-'));
  const libraryPath=path.join(tmp,'library');
  fs.mkdirSync(path.join(libraryPath,'dest'),{recursive:true});
  fs.writeFileSync(path.join(libraryPath,'A.txt'),'text');
  let currentRel='A.txt';
  const novel={id:'n1',title:'A',progressAliases:['n1']};
  let activeFs=0,maxActiveFs=0;
  const originalRename=fs.promises.rename, originalUnlink=fs.promises.unlink;
  fs.promises.rename=async(src,dst)=>{activeFs++;maxActiveFs=Math.max(maxActiveFs,activeFs);await new Promise(r=>setTimeout(r,35));try{return await originalRename(src,dst);}finally{activeFs--;}};
  fs.promises.unlink=async(target)=>{activeFs++;maxActiveFs=Math.max(maxActiveFs,activeFs);await new Promise(r=>setTimeout(r,35));try{return await originalUnlink(target);}finally{activeFs--;}};
  const service=createFileopsService({
    libraryService:{
      libraryPath,
      getLibraryCachedAsync:async()=>[novel], getLibraryCached:()=>[novel], invalidateLibraryCache(){},
      sanitizeNodeName:v=>String(v||'').trim(), normalizeTxtBaseName:v=>String(v||'').trim(),
      safeJoinUnderLibrary:rel=>path.join(libraryPath,rel||''), categoryPathToRelDir:v=>String(v||''), sendFsError(){},
      clearFileCachePath(){},clearAllFileCache(){},isSubPath:(a,b)=>path.resolve(b).startsWith(path.resolve(a)+path.sep),
      getNovelStorageInfo(){const absPath=path.join(libraryPath,currentRel);return{type:'file',absPath,name:path.basename(absPath)};},
      getEpisodeStorageInfo(){throw new Error('unused');},clearNovelCachesByInfo(){}
    },
    onMutation(event){
      if(event.type==='moveNovel') currentRel='dest/A.txt';
      if(event.type==='renameNovel') currentRel='dest/C.txt';
    },
    logger:{warn(){}}
  });
  try{
    const moving=service.moveNovel({novelId:'n1',targetCategoryPath:'dest'});
    await new Promise(r=>setTimeout(r,5));
    const deleting=service.deleteNovel({novelId:'n1'});
    await moving;
    const renaming=service.renameNovel({novelId:'n1',title:'C'});
    const results=await Promise.allSettled([deleting,renaming]);
    assert.equal(maxActiveFs,1,'stale and current paths must never mutate concurrently');
    assert(results.some(item=>item.status==='fulfilled'));
    assert.equal(service.getStatus().serializationPass,FILEOPS_MUTATION_SERIALIZATION_PASS);
    console.log(JSON.stringify({pass:'v627-fileops-stale-lock-smoke-pass',maxActiveFs,results:results.map(x=>x.status)}));
  }finally{
    fs.promises.rename=originalRename;fs.promises.unlink=originalUnlink;fs.rmSync(tmp,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error&&error.stack||error);process.exit(1);});
