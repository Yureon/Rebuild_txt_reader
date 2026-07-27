#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const required = [
  'progress-delta-v612-smoke.mjs',
  'progress-storage-coalesce-v612-smoke.mjs',
  'library-async-event-guard-v612-smoke.mjs',
  'library-access-snapshot-v612-smoke.mjs',
  'release-verify-current-coverage-v612-smoke.js'
];
const verifier = fs.readFileSync('tools/release_verify.js', 'utf8');
const runner = fs.readFileSync('tools/run_smoke_tests.js', 'utf8');
for (const name of required) {
  assert.ok(verifier.includes(`tools/checks/${name}`), `release verifier is missing v612 critical smoke: ${name}`);
  assert.ok(runner.includes(`tools/checks/${name}`), `smoke runner is missing v612 critical smoke: ${name}`);
}
console.log(JSON.stringify({ pass:'v612-release-verify-current-coverage-pass', required:required.length }));
