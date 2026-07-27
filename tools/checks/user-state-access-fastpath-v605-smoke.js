#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const source=fs.readFileSync('server/app.js','utf8');
const start=source.indexOf('async function getStateLibraryAccessContext');
const end=source.indexOf('// ─── 보안 인증',start);
const fn=source.slice(start,end);
assert(fn.includes("if (!auth.ok || auth.access.mode === 'all') return { unrestricted:true"),'full access must not load catalog');
assert(fn.includes("if (auth.access.mode === 'none') return { unrestricted:false"),'none access must use an empty allowed-id set');
const loadIndex=fn.indexOf('getLibraryCachedAsync');
assert(loadIndex>fn.indexOf("auth.access.mode === 'none'"),'catalog load must only occur after fast paths');
assert(fn.includes("filterSharedStatePatchByAllowedNovelIds(body, context.allowedNovelIds, context.knownNovelIds)"),'shared write input must be ACL-filtered');
assert(fn.includes("filterProgressByAllowedNovelIds(body.progress || {}, context.allowedNovelIds, context.knownNovelIds)"),'progress write input must be ACL-filtered');
console.log(JSON.stringify({pass:'v605-user-state-access-fastpath-smoke-pass'}));
