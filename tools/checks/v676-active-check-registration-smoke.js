#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const checksDir = path.join(root, 'tools/checks');
const current = fs.readdirSync(checksDir).filter(name => /^v676-.*-smoke\.(?:js|mjs)$/u.test(name) || name === 'release-verify-current-coverage-v676-smoke.js').sort();
const runner = fs.readFileSync(path.join(root, 'tools/run_smoke_tests.js'), 'utf8');
const verifier = fs.readFileSync(path.join(root, 'tools/release_verify.js'), 'utf8');
for (const name of current) {
  assert(runner.includes(`tools/checks/${name}`), `unregistered in runner: ${name}`);
  assert(verifier.includes(`tools/checks/${name}`), `unregistered in release verifier: ${name}`);
}
assert(current.length >= 11, `unexpected current smoke count ${current.length}`);

const { SUPERSEDED_SMOKE_CHECKS } = require('../superseded-smoke-registry.js');
for (const [retired, replacement] of Object.entries(SUPERSEDED_SMOKE_CHECKS)) {
  assert(fs.existsSync(path.join(checksDir, retired)), `retired smoke missing: ${retired}`);
  assert(current.includes(replacement), `retirement replacement is not current: ${replacement}`);
}

console.log(JSON.stringify({ pass:'v676-active-check-registration-pass', registered:current.length, retired:Object.keys(SUPERSEDED_SMOKE_CHECKS).length, files:current }));
