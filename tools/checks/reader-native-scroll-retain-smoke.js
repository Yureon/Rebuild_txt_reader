#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PASS = 'v377-reader-native-scroll-retain-smoke-pass';
const root = path.resolve(__dirname, '..', '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

function runReaderNativeScrollRetainSmoke() {
  const layout = read('public/scripts/rebuild/features/reader/virtual-layout.mjs');
  const runner = read('tools/run_smoke_tests.js');
  const release = read('docs/release-history.md');

  assert.ok(layout.includes("READER_ACTIVE_LEADING_RETAIN_PASS = 'v377-reader-active-leading-retain-pass'"), 'missing v377 active leading retain marker');
  assert.ok(layout.includes("READER_SETTLED_MEASURE_FLUSH_PASS = 'v377-reader-settled-measure-flush-pass'"), 'missing v377 settled measure flush marker');
  assert.ok(layout.includes('function resolveNativeScrollTransitionState('), 'missing native scroll transition state helper');
  assert.ok(layout.includes('function resolveActiveLeadingRetain('), 'missing active leading row retain helper');
  assert.ok(layout.includes('native forward scroll retains leading rows until settle'), 'leading row retention must document native-scroll rationale');
  assert.ok(layout.includes('flushRenderedMeasureCacheForSettle(app, v, content'), 'render must flush visible measurements before settle compaction');
  assert.ok(layout.includes('visible rows measured before settle render'), 'settle measure flush must be diagnostic-visible');
  assert.ok(layout.includes('VIRTUAL_ACTIVE_RETAIN_LEADING_MAX_ROWS'), 'active leading retain must use a bounded enlarged window');
  assert.ok(layout.includes('leadingRetain?.retain') && layout.includes('scheduleActiveRenderWindowIdleCompaction(app)'), 'leading retain must schedule later compaction');
  assert.ok(runner.includes('tools/checks/reader-native-scroll-retain-smoke.js'), 'reader smoke runner must include v377 native scroll retain smoke');
  assert.ok(release.includes(PASS), 'release history must mention v377 smoke pass');
  return { pass: PASS };
}

if (require.main === module) console.log(JSON.stringify(runReaderNativeScrollRetainSmoke()));
module.exports = { PASS, runReaderNativeScrollRetainSmoke };
