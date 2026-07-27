#!/usr/bin/env node
const assert=require('assert');const fs=require('fs');const os=require('os');const path=require('path');
const {createUserStateServiceManager}=require('../../server/services/user-state-service');
const {createEmptyUserState,normalizeUserState}=require('../../server/services/state-normalizer');
const PASS='v603-user-state-durable-admin-smoke-pass';
(async()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'user-state-durable-v603-'));const userDir=path.join(root,'reader-a');fs.mkdirSync(userDir,{recursive:true});
const initial=normalizeUserState(createEmptyUserState());initial.shared.favorites=['novel-a'];initial.shared.syncVersion=4;fs.writeFileSync(path.join(userDir,'state.json'),JSON.stringify(initial));
let writes=0;const writeJson=(file,value,cb)=>{writes++;setImmediate(()=>{if(writes===1)return cb(Object.assign(new Error('disk full'),{code:'ENOSPC'}));fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value));cb(null);});};
const manager=createUserStateServiceManager({userDataDir:root,writeJson,logger:{error(){}}});
await assert.rejects(manager.resetStateForUserId('reader-a',{skipBeforeSnapshot:true}),/disk full/);
const current=manager.readNormalizedStateForUserId('reader-a').state;assert.deepStrictEqual(current.shared.favorites,['novel-a'],'failed reset must roll memory back');
assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(userDir,'state.json'),'utf8')).shared.favorites,['novel-a'],'failed reset must preserve disk state');
await manager.closeAll();fs.rmSync(root,{recursive:true,force:true});console.log(JSON.stringify({pass:PASS,writes}));})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
