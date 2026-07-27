#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const runner = read('tools/run_smoke_tests.js');
const verifier = read('tools/release_verify.js');
const current = require('./current-rebuild-version.js');
const required = [
  'release-verify-current-coverage-v626-smoke.js',
  'ui-scrollbar-compose-v626-smoke.js'
];
for (const file of required) {
  assert(runner.includes(`tools/checks/${file}`), `quick runner missing v626 check: ${file}`);
  assert(verifier.includes(`tools/checks/${file}`), `release verifier missing v626 check: ${file}`);
}
assert(current.CURRENT_REBUILD_VERSION_NUMBER >= 626);
assert(Number(current.CURRENT_REBUILD_VERSION.replace('rebuild-v','')) >= 626);
assert(current.CURRENT_REBUILD_PACKAGE.startsWith('txt_reader_v'));
assert(Number(JSON.parse(read('package.json')).version.split('.')[1]) >= 26);
assert(read('public/styles/metadata-page.css').includes('v626-metadata-scrollbar-ui-pass'));
assert(read('docker-compose.yml').includes('${TXT_READER_BIND_ADDRESS:-0.0.0.0}:${PORT:-3000}:3000'));
assert(read('docs/smoke-tests.md').includes('v626-ui-full-viewport-audit-pass'));
console.log(JSON.stringify({ pass:'v626-release-verify-current-coverage-pass', required:required.length }));
