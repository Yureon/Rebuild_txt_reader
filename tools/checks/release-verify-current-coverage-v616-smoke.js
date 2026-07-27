#!/usr/bin/env node
'use strict';
const fs = require('fs');
const assert = require('assert');
const runner = fs.readFileSync('tools/run_smoke_tests.js', 'utf8');
const verifier = fs.readFileSync('tools/release_verify.js', 'utf8');
const status = fs.readFileSync('docs/project-status-roadmap.md', 'utf8');
const smoke = fs.readFileSync('docs/smoke-tests.md', 'utf8');
for (const file of ['release-verify-current-coverage-v616-smoke.js','metadata-view-state-v616-smoke.js','ux-disruption-guard-v616-smoke.js']) {
  assert.ok(runner.includes(`tools/checks/${file}`), `smoke runner missing v616 check: ${file}`);
  assert.ok(verifier.includes(`tools/checks/${file}`), `release verifier missing v616 check: ${file}`);
}
for (const token of ['v616-metadata-view-state-pass','v616-ui-disruption-guard-pass']) {
  assert.ok(status.includes(token) || smoke.includes(token), `v616 documentation marker missing: ${token}`);
}
console.log(JSON.stringify({ pass:'v616-release-verify-current-coverage-pass', required:3 }));
