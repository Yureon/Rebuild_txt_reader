#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const {createSessionStore}=require('../../server/services/session-store');
const PASS='v604-session-store-backup-migration-smoke-pass';
(async()=>{
  const root=await fs.promises.mkdtemp(path.join(os.tmpdir(),'txt-reader-session-v604-'));
  const storePath=path.join(root,'sessions.json');
  const secret='0123456789abcdef0123456789abcdef';
  const backup={schemaVersion:2,tokenStorage:'hmac',sessions:{},sessionMeta:{},csrfTokens:{}};
  await fs.promises.writeFile(storePath,'{broken');
  await fs.promises.writeFile(storePath+'.bak',JSON.stringify(backup));
  let store=createSessionStore({storePath,sessionStoreSecret:secret,retryDelayMs:20,cleanupIntervalMs:60000,logger:{warn(){},error(){}}});
  store.load();
  let result=await store.flush();
  assert.strictEqual(result.ok,true);
  assert.strictEqual(JSON.parse(await fs.promises.readFile(storePath,'utf8')).tokenStorage,'hmac','backup recovery must heal primary');
  await store.close();

  const plaintextToken='plaintext-session-token-should-not-remain';
  const legacy={sessions:{[plaintextToken]:Date.now()+60000},csrfTokens:{[plaintextToken]:'plaintext-csrf'}};
  await fs.promises.writeFile(storePath,JSON.stringify(legacy));
  await fs.promises.writeFile(storePath+'.bak',JSON.stringify(legacy));
  store=createSessionStore({storePath,sessionStoreSecret:secret,retryDelayMs:20,cleanupIntervalMs:60000,logger:{warn(){},error(){}}});
  store.load();
  result=await store.flush();
  assert.strictEqual(result.ok,true);
  const healed=await fs.promises.readFile(storePath,'utf8');
  assert.strictEqual(JSON.parse(healed).tokenStorage,'hmac');
  assert(!healed.includes(plaintextToken));
  const backupText=await fs.promises.readFile(storePath+'.bak','utf8').catch(()=> '');
  assert(!backupText.includes(plaintextToken),'legacy plaintext backup must be removed rather than preserved');
  await store.close();
  await fs.promises.rm(root,{recursive:true,force:true});
  console.log(JSON.stringify({pass:PASS}));
})().catch(error=>{console.error(error&&error.stack||error);process.exitCode=1;});
