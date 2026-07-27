#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
const dependencies = Object.keys(pkg.dependencies || {}).sort();
const missing=[]; const resolved={};
for(const name of dependencies) {
  try {
    const packageJson=require.resolve(`${name}/package.json`,{paths:[root]});
    const installed=JSON.parse(fs.readFileSync(packageJson,'utf8'));
    resolved[name]={version:String(installed.version||''),packageJson:path.relative(root,packageJson).replace(/\\/g,'/')};
    assert(installed.version,`${name} version missing`);
    const lockEntry=lock.packages && lock.packages[`node_modules/${name}`];
    assert(lockEntry && lockEntry.version,`${name} lock entry missing`);
    assert.equal(String(installed.version),String(lockEntry.version),`${name} installed/lock version mismatch`);
  } catch(error) { missing.push({name,error:error.code||error.message}); }
}
if(missing.length) {
  console.error(JSON.stringify({pass:'v677-runtime-dependency-install-blocked',blocked:true,blockedDependency:'runtime-dependencies',missing}));
  process.exit(77);
}
console.log(JSON.stringify({pass:'v677-runtime-dependency-install-smoke-pass',dependencies:dependencies.length,resolved}));
