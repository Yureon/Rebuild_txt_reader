#!/usr/bin/env node
const assert=require('assert');const fs=require('fs');const os=require('os');const path=require('path');
const {createAccountService,hashPassword,verifyPasswordAsync}=require('../../server/services/account-service');
const PASS='v603-account-auth-async-smoke-pass';
(async()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'account-auth-v603-'));const accountsPath=path.join(root,'accounts.json');
fs.writeFileSync(accountsPath,JSON.stringify({version:1,users:[{id:'reader-a',username:'reader-a',passwordHash:hashPassword('password-123'),enabled:true,sessionVersion:1,accessVersion:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),libraryAccess:{mode:'all',folders:[]},folderMutationAccess:{moveFolders:[],deleteFolders:[]},appPermissions:{fullSearch:true,metadataAccess:false}}]}));
const service=createAccountService({accountsPath,logger:{error(){}}});service.load();assert(await verifyPasswordAsync('password-123',service.findUserById('reader-a').passwordHash));assert(!(await verifyPasswordAsync('wrong',service.findUserById('reader-a').passwordHash)));const user=await service.authenticateUserAsync('reader-a','password-123');assert(user&&user.id==='reader-a');
assert.strictEqual(await verifyPasswordAsync('x','scrypt:999999999:8:1:64:0011223344556677:'+'00'.repeat(64)),false,'unsafe scrypt parameters must be rejected');
const route=fs.readFileSync(path.join(__dirname,'../../server/routes/auth-routes.js'),'utf8');assert(route.includes('await accountService.authenticateUserAsync'),'login route must use non-blocking scrypt');fs.rmSync(root,{recursive:true,force:true});console.log(JSON.stringify({pass:PASS}));})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
