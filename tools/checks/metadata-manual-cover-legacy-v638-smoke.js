#!/usr/bin/env node
'use strict';
const assert=require('assert');
const Module=require('module');
function fakeExpress(){return{raw:()=> (_q,_s,n)=>n(),Router(){const router={routes:[]};for(const method of ['get','post','put','delete','patch','all','head','options'])router[method]=(path,...handlers)=>(router.routes.push({method,path,handlers}),router);router.use=()=>router;router.param=()=>router;return router;}};}
async function invoke(handlers,req,res){let i=-1;async function next(error){if(error)throw error;const fn=handlers[++i];if(!fn)return;const out=fn(req,res,next);if(out&&typeof out.then==='function')await out;}await next();for(let n=0;n<6;n+=1)await Promise.resolve();}
function response(){return{statusCode:200,body:null,headers:{},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;},setHeader(name,value){this.headers[name.toLowerCase()]=value;},getHeader(name){return this.headers[name.toLowerCase()];}};}
(async()=>{
  const original=Module._load;Module._load=function(request,parent,isMain){if(request==='express')return fakeExpress();return original.call(this,request,parent,isMain);};
  let createMetadataRouter;try{({createMetadataRouter}=require('../../server/routes/metadata-routes'));}finally{Module._load=original;}
  const novel={id:'novel',title:'작품',author:'작가',progressAliases:[]};
  const assetId='a'.repeat(64);const canonical=`/api/metadata/covers/${assetId}`;
  let savedInput=null;let released=0;
  const metadataService={enabled:true,listProviders:()=>[],queueStatus:()=>({}),async saveManualMetadata(_novel,input){savedInput=input;return{id:'wm',providerId:'manual',data:{title:input.title,coverAssetId:assetId,coverUrl:canonical}};},getAppliedRecord(){return{id:'wm',providerId:'manual',data:{title:savedInput.title,coverAssetId:assetId,coverUrl:canonical}};},createCoverAccessScope:()=>({aliases:new Set(),workKeys:new Set()})};
  const router=createMetadataRouter({metadataService,coverService:{getStatus:()=>({}),verifyAssetAsync:async id=>id===assetId?{assetId:id}:null,canonicalAssetUrl:id=>`/api/metadata/covers/${id}`,releaseAssetLeaseDurably:async()=>{released+=1;}},libraryService:{getLibraryCached:()=>[novel]},sessionStore:{getSession:()=>({kind:'owner',id:'owner'})},accountService:{getUserAppPermissions:()=>({metadataAccess:true})},playwrightService:{},requireSameOrigin:(_q,_s,n)=>n(),requireCsrf:(_q,_s,n)=>n(),checkApiWriteLimit:()=>true});
  const route=router.routes.find(item=>item.method==='put'&&item.path==='/novels/:novelId/metadata/manual');
  const req={params:{novelId:'novel'},body:{title:'작품',coverAssetId:assetId,coverUrlLocal:canonical},headers:{cookie:'session_token=x'},get:()=>''};const res=response();
  await invoke(route.handlers,req,res);
  assert.equal(res.statusCode,200,'v636 canonical coverUrlLocal must remain compatible');
  assert.equal(savedInput.coverUrlLocal,canonical,'server must regenerate the canonical URL');
  assert.equal(released,1);
  const badReq={...req,body:{title:'작품',coverAssetId:assetId,coverUrlLocal:'/api/metadata/covers/'+'b'.repeat(64)}};const badRes=response();await invoke(route.handlers,badReq,badRes);
  assert.equal(badRes.statusCode,400,'mismatched legacy URL must remain rejected');
  console.log(JSON.stringify({pass:'v638-metadata-manual-cover-legacy-pass',canonicalAccepted:true,mismatchRejected:true}));
})().catch(error=>{console.error(error&&error.stack||error);process.exit(1);});
