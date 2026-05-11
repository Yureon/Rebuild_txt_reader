#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const layout = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/reader/virtual-layout.mjs'), 'utf8');
const diagnostics = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/reader/virtual-layout-diagnostics.mjs'), 'utf8');
const runner = fs.readFileSync(path.join(root, 'tools/run_smoke_tests.js'), 'utf8');

assert.ok(layout.includes("READER_ACTUAL_BOTTOM_PROGRESS_TRUST_PASS = 'v520-reader-actual-bottom-progress-trust-pass'"), 'v520 actual bottom progress marker missing');
assert.ok(layout.includes('const actualBottom = terminal && remainingBottom <= 2'), 'trusted bottom progress must define actual DOM bottom');
assert.ok(layout.includes("trustMode === 'actual-dom-terminal-bottom'"), 'actual DOM bottom trust mode missing');
assert.ok(layout.includes('actual DOM bottom is authoritative for terminal progress'), 'actual bottom diagnostic reason missing');
assert.ok(layout.includes('actualBottomProgressTrustPass: trusted && trustMode === \'actual-dom-terminal-bottom\''), 'trusted bottom result must expose actual bottom pass');
assert.ok(diagnostics.includes('actualBottomProgressTrustPass'), 'virtual diagnostics must expose actual bottom progress pass');
assert.ok(diagnostics.includes('lastActualBottomProgressTrust'), 'virtual diagnostics must expose actual bottom trust diagnostic');
assert.ok(runner.includes('reader-actual-bottom-progress-trust-smoke.js'), 'reader smoke runner must include v520 actual bottom progress smoke');

console.log('v520-reader-actual-bottom-progress-trust-smoke-pass');
