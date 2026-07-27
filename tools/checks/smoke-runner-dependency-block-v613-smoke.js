#!/usr/bin/env node
const assert=require('assert');
const { classifyBlockedDependency, allowDependencyBlocks }=require('../run_smoke_tests.js');
assert.deepEqual(classifyBlockedDependency("Error: Cannot find module 'express'"),{blocked:true,dependency:'express'});
assert.deepEqual(classifyBlockedDependency("Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'iconv-lite' imported from /tmp/a.mjs"),{blocked:true,dependency:'iconv-lite'});
assert.equal(classifyBlockedDependency("Cannot find module './missing-internal.js'").blocked,false);
assert.equal(typeof allowDependencyBlocks(),'boolean');
console.log(JSON.stringify({pass:'v622-smoke-runner-dependency-block-pass'}));
