#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PASS = 'v522-reader-append-seam-anchor-correction-cleanup-smoke-pass';
const CLEANUP = 'v522-reader-multi-file-guard-cleanup-pass';
const root = path.resolve(__dirname, '..', '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

function runReaderAppendSeamAnchorCorrectionSmoke() {
  const layout = read('public/scripts/rebuild/features/reader/virtual-layout.mjs');
  const runner = read('tools/run_smoke_tests.js');
  const release = read('docs/release-history.md');

  assert.ok(layout.includes("READER_APPEND_SEAM_ANCHOR_CORRECTION_PASS = 'v390-reader-append-seam-anchor-correction-pass'"), 'legacy diagnostic marker must remain exported for recovery snapshots');
  assert.ok(layout.includes("READER_MULTI_FILE_GUARD_CLEANUP_PASS = 'v522-reader-multi-file-guard-cleanup-pass'"), 'v522 cleanup marker missing');
  assert.ok(layout.includes('const wouldAllowCorrection = !!(immediate && viewportNearSeam'), 'legacy seam correction candidate must be diagnostic-only');
  assert.ok(layout.includes('const allowCorrection = false'), 'seam-near anchor correction exception must be disabled');
  assert.ok(layout.includes('append seam correction exception disabled; unified native/explicit policies own scrollTop after v522 cleanup'), 'disabled correction reason missing');
  assert.ok(layout.includes("removedBehavior: 'append-seam-anchor-correction-allowance'"), 'cleanup diagnostic payload missing');
  assert.ok(!layout.includes("? 'append seam near viewport allows anchor correction during append grace'"), 'old append seam correction allowance must not remain active');
  assert.ok(!layout.includes("? 'append seam near viewport allows anchor correction during native settle'"), 'native-settle seam allowance must not remain active');
  assert.ok(runner.includes('tools/checks/reader-append-seam-anchor-correction-smoke.js'), 'reader runner must include cleanup smoke');
  assert.ok(release.includes(CLEANUP) || release.includes(PASS), 'release history must mention v522 multi-file guard cleanup');
  return { pass: PASS, cleanup: CLEANUP };
}

if (require.main === module) console.log(JSON.stringify(runReaderAppendSeamAnchorCorrectionSmoke()));
module.exports = { PASS, runReaderAppendSeamAnchorCorrectionSmoke };
