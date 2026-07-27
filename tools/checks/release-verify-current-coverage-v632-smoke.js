#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const current = require('./current-rebuild-version.js');
const runner = read('tools/run_smoke_tests.js');
const verifier = read('tools/release_verify.js');
for (const file of ['release-verify-current-coverage-v632-smoke.js','service-worker-cloudflare-v632-smoke.js']) {
  assert(runner.includes(`tools/checks/${file}`), `quick runner missing v632 check: ${file}`);
  assert(verifier.includes(`tools/checks/${file}`), `release verifier missing v632 check: ${file}`);
}
assert(current.CURRENT_REBUILD_VERSION_NUMBER >= 632);
assert.equal(current.CURRENT_REBUILD_VERSION,`rebuild-v${current.CURRENT_REBUILD_VERSION_NUMBER}`);
assert.equal(current.CURRENT_REBUILD_PACKAGE,`txt_reader_v${current.CURRENT_REBUILD_VERSION_NUMBER}.zip`);
assert.equal(JSON.parse(read('package.json')).version,`6.${current.CURRENT_REBUILD_VERSION_NUMBER - 600}.0`);
assert(read('public/sw.js').includes(`const BUILD = '${current.CURRENT_REBUILD_VERSION}'`));
console.log(JSON.stringify({ pass:'v632-release-verify-current-coverage-pass', required:2 }));
