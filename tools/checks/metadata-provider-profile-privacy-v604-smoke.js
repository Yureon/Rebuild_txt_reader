#!/usr/bin/env node
'use strict';
const assert = require('assert');
const Module = require('module');
const PASS = 'v604-metadata-provider-profile-privacy-smoke-pass';
function fakeExpress(){ return { raw:()=> (_req,_res,next)=>next(), Router(){ const router={routes:[]}; for(const method of ['get','post','put','delete','patch']) router[method]=(path,...handlers)=>(router.routes.push({method,path,handlers}),router); return router; } }; }
async function invoke(handlers, req, res){ let index=-1; async function next(){ const handler=handlers[++index]; if(handler) return handler(req,res,next); } await next(); }
function response(){ return { statusCode:200, body:null, headers:{}, status(code){this.statusCode=code;return this;}, json(body){this.body=body;return this;}, setHeader(name,value){this.headers[String(name).toLowerCase()]=value;}, getHeader(name){return this.headers[String(name).toLowerCase()];}, end(){return this;} }; }
(async()=>{
  const original=Module._load;
  Module._load=function(request,parent,isMain){ if(request==='express') return fakeExpress(); return original.call(this,request,parent,isMain); };
  let createMetadataRouter;
  try { ({createMetadataRouter}=require('../../server/routes/metadata-routes')); } finally { Module._load=original; }
  const provider={ id:'p', enabled:true, browserProfile:{ supported:true, configured:true, status:'ready', updatedAt:'2026-01-01T00:00:00Z', lastVerifiedAt:'2026-01-01T00:00:00Z', lastError:'/private/profile/path authentication failed', sessionActive:true, pass:'profile-pass' } };
  async function read(session){
    const router=createMetadataRouter({
      metadataService:{enabled:true,listProviders:()=>[provider],queueStatus:()=>({}),hasCoverAsset:()=>false,canAccessCover:()=>false},
      coverService:{findAsset:()=>null},libraryService:{getLibraryCached:()=>[]},sessionStore:{getSession:()=>session},
      accountService:{getUserLibraryAccess:()=>({mode:'all',folders:[]}),getUserAppPermissions:()=>({metadataAccess:true,fullSearch:true})},
      playwrightService:{},requireSameOrigin:(_q,_s,n)=>n(),requireCsrf:(_q,_s,n)=>n(),checkApiWriteLimit:()=>true
    });
    const route=router.routes.find(item=>item.method==='get'&&item.path==='/metadata/providers');
    const req={headers:{cookie:'session_token=test-token'},get:()=>''}; const res=response(); await invoke(route.handlers,req,res); return res;
  }
  const user=await read({kind:'user',userId:'u'});
  assert.strictEqual(user.statusCode,200);
  const publicProfile=user.body.providers[0].browserProfile;
  assert.deepStrictEqual(Object.keys(publicProfile).sort(),['configured','pass','status','supported']);
  assert.strictEqual(publicProfile.lastError,undefined);
  assert.strictEqual(publicProfile.updatedAt,undefined);
  assert.strictEqual(publicProfile.sessionActive,undefined);
  const owner=await read({kind:'owner',id:'owner'});
  assert.strictEqual(owner.body.providers[0].browserProfile.lastError,provider.browserProfile.lastError);
  assert.strictEqual(owner.body.providers[0].browserProfile.sessionActive,true);
  assert.strictEqual(provider.browserProfile.lastError,'/private/profile/path authentication failed','source descriptor must not be mutated');
  console.log(JSON.stringify({pass:PASS}));
})().catch(error=>{console.error(error&&error.stack||error);process.exitCode=1;});
