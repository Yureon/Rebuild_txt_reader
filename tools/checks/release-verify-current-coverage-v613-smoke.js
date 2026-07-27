#!/usr/bin/env node
const fs=require('fs'); const assert=require('assert');
const runner=fs.readFileSync('tools/run_smoke_tests.js','utf8');
const verifier=fs.readFileSync('tools/release_verify.js','utf8');
const required=[
  'user-scoped-storage-v613-smoke.mjs',
  'progress-user-scope-v613-smoke.mjs',
  'reader-cache-user-scope-v613-smoke.mjs',
  'access-bootstrap-v613-smoke.mjs',
  'progress-lifecycle-immediate-v613-smoke.mjs',
  'progress-delta-single-acl-v613-smoke.js',
  'critical-preload-budget-v613-smoke.js',
  'ui-version-accessibility-v613-smoke.js',
  'release-verify-current-coverage-v613-smoke.js',
  'smoke-runner-dependency-block-v613-smoke.js'
];
for(const name of required){
  assert.ok(runner.includes(`tools/checks/${name}`),`smoke runner missing v613 check: ${name}`);
  assert.ok(verifier.includes(`tools/checks/${name}`),`release verifier missing v613 check: ${name}`);
}
console.log(JSON.stringify({pass:'v613-release-verify-current-coverage-pass',required:required.length}));
