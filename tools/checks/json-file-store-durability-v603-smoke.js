#!/usr/bin/env node
const assert=require('assert');const fs=require('fs');const os=require('os');const path=require('path');
const {atomicWriteJson,atomicWriteJsonSync}=require('../../server/repositories/json-file-store');
const PASS='v603-json-file-store-durability-smoke-pass';
(async()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'json-durable-v603-'));const file=path.join(root,'state.json');
atomicWriteJsonSync(file,{version:1});atomicWriteJsonSync(file,{version:2});
assert.deepStrictEqual(JSON.parse(fs.readFileSync(file,'utf8')),{version:2});assert.deepStrictEqual(JSON.parse(fs.readFileSync(file+'.bak','utf8')),{version:1});
await new Promise((resolve,reject)=>atomicWriteJson(file,{version:3},e=>e?reject(e):resolve()));
assert.deepStrictEqual(JSON.parse(fs.readFileSync(file,'utf8')),{version:3});assert.deepStrictEqual(JSON.parse(fs.readFileSync(file+'.bak','utf8')),{version:2});
assert.strictEqual(fs.readdirSync(root).filter(n=>n.endsWith('.tmp')).length,0,'temporary files must be cleaned');
fs.rmSync(root,{recursive:true,force:true});console.log(JSON.stringify({pass:PASS}));})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
