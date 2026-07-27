#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const { TXT_READER_BUILD, applyVersionedRebuildAssetCache } = require('../../server/middleware/cache-policy');
const PASS = 'v622-build-mismatch-boundary-smoke-pass';
function response(){ return {headers:{},statusCode:200,body:'',setHeader(k,v){this.headers[String(k).toLowerCase()]=v;},getHeader(k){return this.headers[String(k).toLowerCase()];},status(code){this.statusCode=code;return this;},end(body=''){this.body=String(body);this.ended=true;return this;}}; }
function invoke(url,method='GET'){ const res=response(); let next=false; applyVersionedRebuildAssetCache({method,url,originalUrl:url},res,()=>{next=true;}); return {res,next}; }
const staleNumber=Math.max(1,Number(String(TXT_READER_BUILD).replace(/\D/g,''))-1);
const stale=`rebuild-v${staleNumber}`;
const current=invoke(`/scripts/rebuild/features/example.mjs?v=${TXT_READER_BUILD}`);
assert.strictEqual(current.next,true);
assert.strictEqual(current.res.getHeader('cache-control'),'public, max-age=31536000, immutable');
const staleModule=invoke(`/scripts/rebuild/features/example.mjs?v=${stale}`);
assert.strictEqual(staleModule.next,false);
assert.strictEqual(staleModule.res.statusCode,409);
assert.strictEqual(staleModule.res.getHeader('x-txt-reader-stale-build-forwarded'),undefined);
assert.strictEqual(staleModule.res.getHeader('x-txt-reader-reload-required'),'1');
assert(staleModule.res.body.includes('reload_required'));
const staleStyle=invoke(`/styles/app.css?v=${stale}`);
assert.strictEqual(staleStyle.next,true);
assert.strictEqual(staleStyle.res.statusCode,200);
assert.strictEqual(staleStyle.res.getHeader('cache-control'),'no-store, no-cache, must-revalidate, max-age=0');
const unversioned=invoke('/styles/app.css');
assert.strictEqual(unversioned.next,true);
const register=fs.readFileSync('public/scripts/service-worker-register.js','utf8');
assert(register.includes("addEventListener('controllerchange'"));
assert(register.includes('activationAttempt'));
assert(/v\d+-service-worker-update-(?:activation|coordination)-pass/.test(register));
assert(register.includes('업데이트 적용'));
assert(register.includes('scheduleReload'));
assert(register.includes('__TXT_READER_REQUIRE_UPDATE__'));
assert(!register.includes('hadController && location.reload'));
console.log(JSON.stringify({pass:PASS,build:TXT_READER_BUILD,staleExecutableBlocked:true,staleNonExecutableForwarded:true}));
