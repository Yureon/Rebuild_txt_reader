#!/usr/bin/env node
'use strict';
const assert=require('assert');const fs=require('fs');const os=require('os');const path=require('path');
const {createSessionStore}=require('../../server/services/session-store');
const PASS='v605-csrf-multitab-smoke-pass';
(async()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'csrf-v605-'));const storePath=path.join(root,'sessions.json');
const store=createSessionStore({storePath,sessionStoreSecret:'0123456789abcdef0123456789abcdef',maxCsrfTokensPerSession:8,logger:{error(){},warn(){}}});
const session=store.createSession({kind:'user',userId:'reader-a'});const tokens=[];for(let i=0;i<10;i++)tokens.push(store.issueCsrfToken(session));
assert.strictEqual(store.validateCsrfToken(session,tokens[0]),false,'oldest token must age out');assert.strictEqual(store.validateCsrfToken(session,tokens[1]),false,'second oldest token must age out');
for(const token of tokens.slice(-8))assert.strictEqual(store.validateCsrfToken(session,token),true,'recent tab token must remain valid');
const status=store.getLifecycleStatus();assert.strictEqual(status.maxCsrfTokensPerSession,8);await store.close();
const doc=JSON.parse(fs.readFileSync(storePath,'utf8'));const key=Object.keys(doc.csrfTokens)[0];assert(Array.isArray(doc.csrfTokens[key])&&doc.csrfTokens[key].length===8,'persisted CSRF token ring must be bounded');
// Legacy single-hash storage remains readable.
doc.csrfTokens[key]=doc.csrfTokens[key][7];fs.writeFileSync(storePath,JSON.stringify(doc));
const restored=createSessionStore({storePath,sessionStoreSecret:'0123456789abcdef0123456789abcdef',logger:{error(){},warn(){}}});restored.load();assert(restored.validateCsrfToken(session,tokens[9]),'legacy single hash must migrate');await restored.close();
fs.rmSync(root,{recursive:true,force:true});console.log(JSON.stringify({pass:PASS,retained:8}));})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
