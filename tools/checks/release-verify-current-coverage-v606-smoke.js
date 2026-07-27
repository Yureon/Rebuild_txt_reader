#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const required = [
  'session-logout-durability-v606-smoke.js',
  'login-session-durability-v606-smoke.js',
  'content-worker-shutdown-v606-smoke.js',
  'precompressed-http-boundary-v606-smoke.js',
  'metadata-store-idempotency-v606-smoke.js',
  'metadata-cover-access-scope-v606-smoke.js',
  'release-verify-current-coverage-v606-smoke.js'
];
const verifier = fs.readFileSync('tools/release_verify.js', 'utf8');
const runner = fs.readFileSync('tools/run_smoke_tests.js', 'utf8');
for (const name of required) {
  assert.ok(verifier.includes(`tools/checks/${name}`), `release verifier is missing v606 critical smoke: ${name}`);
  assert.ok(runner.includes(`tools/checks/${name}`), `smoke runner is missing v606 critical smoke: ${name}`);
}
console.log(JSON.stringify({ pass:'v606-release-verify-current-coverage-pass', required:required.length }));
