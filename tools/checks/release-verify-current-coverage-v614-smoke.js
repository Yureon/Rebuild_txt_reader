#!/usr/bin/env node
const fs = require('fs');
const assert = require('assert');
const runner = fs.readFileSync('tools/run_smoke_tests.js', 'utf8');
const verifier = fs.readFileSync('tools/release_verify.js', 'utf8');
const required = [
  'release-verify-current-coverage-v614-smoke.js',
  'modulepreload-entrypoints-smoke.js',
  'access-bootstrap-v613-smoke.mjs',
  'metadata-restart-resume-v614-smoke.js',
  'metadata-auto-apply-v614-smoke.js'
];
for (const name of required) {
  assert.ok(runner.includes(`tools/checks/${name}`), `smoke runner missing v614 check: ${name}`);
  assert.ok(verifier.includes(`tools/checks/${name}`), `release verifier missing v614 check: ${name}`);
}
console.log(JSON.stringify({ pass:'v614-release-verify-current-coverage-pass', required:required.length }));
