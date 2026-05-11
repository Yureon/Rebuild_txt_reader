#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PASS = 'v378-reader-trusted-bottom-progress-smoke-pass';
const root = path.resolve(__dirname, '..', '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

function runReaderTrustedBottomProgressSmoke() {
  const layout = read('public/scripts/rebuild/features/reader/virtual-layout.mjs');
  const runner = read('tools/run_smoke_tests.js');
  const release = read('docs/release-history.md');

  assert.ok(layout.includes("READER_TRUSTED_BOTTOM_PROGRESS_PASS = 'v378-reader-trusted-bottom-progress-pass'"), 'missing v378 trusted bottom progress marker');
  assert.ok(layout.includes('function resolveTrustedBottomProgress('), 'missing trusted bottom progress helper');
  assert.ok(layout.includes('virtualRemainingBottom <= 2'), '100% clamp must require virtual bottom');
  assert.ok(layout.includes('remainingBottom <= 2'), '100% clamp must require DOM bottom');
  assert.ok(layout.includes('terminalRowsRemaining <= 1'), '100% clamp must require terminal row proximity');
  assert.ok(!layout.includes('ratio = Math.min(ratio, 0.999)'), 'v474 removes artificial 0.999 progress cap; terminal trust remains diagnostic-only until actual bottom');
  assert.ok(layout.includes('lastTrustedBottomProgress'), 'trusted bottom diagnostics must be recorded');
  assert.ok(runner.includes('tools/checks/reader-trusted-bottom-progress-smoke.js'), 'reader smoke runner must include v378 trusted bottom progress smoke');
  assert.ok(release.includes(PASS), 'release history must mention v378 smoke pass');
  return { pass: PASS };
}

if (require.main === module) console.log(JSON.stringify(runReaderTrustedBottomProgressSmoke()));
module.exports = { PASS, runReaderTrustedBottomProgressSmoke };
