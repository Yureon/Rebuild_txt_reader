#!/usr/bin/env node
const fs=require('fs'); const path=require('path'); const assert=require('assert');
const { staticGraph }=require('./current-library-architecture-contract.js');
const root=path.resolve(__dirname,'../../public/scripts/rebuild');
const results=[];
for(const entryName of ['library-page.mjs','site.mjs','mobile.mjs']){
 const files=staticGraph(path.join(root,entryName)); const bytes=files.reduce((n,f)=>n+fs.statSync(f).size,0);
 assert.ok(files.length<=90,`${entryName} module budget exceeded: ${files.length}`);
 assert.ok(bytes<=580000,`${entryName} source budget exceeded: ${bytes}`);
 results.push({entry:entryName,modules:files.length,bytes});
}
const main=fs.readFileSync(path.join(root,'main.mjs'),'utf8');
for(const dynamic of ["import('./features/lazy-features.mjs')","import('./features/library.mjs')","import('./core/user-scope-bootstrap.mjs')"])
 assert.ok(main.includes(dynamic),`staged boot missing ${dynamic}`);
console.log(JSON.stringify({pass:'v600-initial-load-budget-smoke-pass',results}));
