#!/usr/bin/env node
const fs=require('fs'); const assert=require('assert');
const app=fs.readFileSync('server/app.js','utf8');
const service=fs.readFileSync('server/services/library-service.js','utf8');
assert.ok(service.includes('novelById: new Map') || service.includes('novelById:new Map'),'library cache must maintain a novel id index');
assert.ok(service.includes('getNovelByIdCachedAsync'),'library service must expose indexed novel lookup');
const delta=app.indexOf("kind === 'progress-delta'");
const full=app.indexOf('createUserStateAccessContext');
assert.ok(delta>=0,'progress delta access fast path missing');
assert.ok(app.slice(delta,delta+2500).includes('getNovelByIdCachedAsync'),'progress delta must resolve only the target novel');
assert.ok(app.slice(delta,delta+2500).includes('isNovelAllowed'),'progress delta must check target access');
assert.ok(full<0 || delta<full || app.lastIndexOf("kind === 'progress-delta'")>full,'progress delta fast path must exist independently of full ACL set construction');
console.log(JSON.stringify({pass:'v613-progress-delta-single-acl-smoke-pass'}));
