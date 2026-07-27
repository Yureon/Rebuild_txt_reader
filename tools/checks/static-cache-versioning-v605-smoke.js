#!/usr/bin/env node
'use strict';
const assert=require('assert');const fs=require('fs');const path=require('path');const policy=require('../../server/middleware/cache-policy');
function response(){const headers=new Map();return{setHeader(k,v){headers.set(k,String(v))},getHeader(k){return headers.get(k)},type(){},headers};}
let res=response();policy.applyVersionedRebuildAssetCache({method:'GET',originalUrl:`/styles/app.css?v=${policy.TXT_READER_BUILD}`},res,()=>{});policy.applyStaticCachePolicy(res,path.resolve('public/styles/app.css'));assert.equal(res.getHeader('Cache-Control'),'public, max-age=31536000, immutable');assert(res.getHeader('X-Versioned-Static-Asset'));
res=response();policy.applyVersionedRebuildAssetCache({method:'GET',originalUrl:'/styles/app.css'},res,()=>{});policy.applyStaticCachePolicy(res,path.resolve('public/styles/app.css'));assert.equal(res.getHeader('Cache-Control'),'public, max-age=0, must-revalidate');
res=response();policy.applyStaticCachePolicy(res,path.resolve('public/icon/icon-192.png'));assert.equal(res.getHeader('Cache-Control'),'public, max-age=0, must-revalidate');
const app=fs.readFileSync('server/app.js','utf8');const alias=app.slice(app.indexOf('function sendPublicIconAlias'),app.indexOf('const SESSION_STORE_PATH'));assert(alias.includes('max-age=0, must-revalidate'));assert(!alias.includes('max-age=31536000'));
console.log(JSON.stringify({pass:'v605-static-cache-versioning-smoke-pass'}));
