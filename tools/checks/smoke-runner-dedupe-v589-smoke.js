#!/usr/bin/env node
const assert=require('assert');
const { ALL_GROUPS, uniqueTasks }=require('../run_smoke_tests.js');
for(const name of ['quick','standard','full']){
  const raw=ALL_GROUPS[name];
  const unique=uniqueTasks(raw);
  assert.equal(unique.length,new Set(unique.map(task=>task.label)).size,`${name} must contain no duplicate labels after normalization`);
  assert.ok(unique.length<=raw.length,`${name} normalization must not add tasks`);
}
console.log(JSON.stringify({pass:'v589-smoke-runner-dedupe-pass',quick:uniqueTasks(ALL_GROUPS.quick).length,standard:uniqueTasks(ALL_GROUPS.standard).length,full:uniqueTasks(ALL_GROUPS.full).length}));
