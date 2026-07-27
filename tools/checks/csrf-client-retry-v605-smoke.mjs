#!/usr/bin/env node
import assert from 'node:assert/strict';
globalThis.window={location:{origin:'http://local.test',pathname:'/library.html'}};globalThis.location={href:'',pathname:'/library.html',reload(){}};
const {ApiClient}=await import('../../public/scripts/rebuild/core/api.mjs');
const calls=[];let csrfSerial=0;let postSerial=0;
globalThis.fetch=async(url,init={})=>{calls.push({url:String(url),method:String(init.method||'GET'),csrf:init.headers?.get?.('X-CSRF-Token')||''});
if(String(url)==='/api/csrf'){csrfSerial+=1;return new Response(JSON.stringify({csrfToken:`token-${csrfSerial}`}),{status:200,headers:{'Content-Type':'application/json'}});}
postSerial+=1;if(postSerial===1)return new Response(JSON.stringify({error:'csrf blocked'}),{status:403,headers:{'Content-Type':'application/json'}});
return new Response(JSON.stringify({ok:true}),{status:200,headers:{'Content-Type':'application/json'}});};
const api=new ApiClient({deviceId:'device-a'});const out=await api.post('/api/test',{value:1});assert.equal(out.ok,true);assert.equal(postSerial,2);assert.equal(csrfSerial,2);assert.equal(calls.filter(c=>c.url==='/api/test').length,2);assert.equal(calls.at(-1).csrf,'token-2');
const adminSource=(await import('node:fs')).readFileSync(new URL('../../public/scripts/admin/core.js',import.meta.url),'utf8');assert(adminSource.includes("d.error === 'csrf blocked'"));assert(adminSource.includes('_csrfRetried:true'));
console.log(JSON.stringify({pass:'v605-csrf-client-retry-smoke-pass',calls:calls.length}));
