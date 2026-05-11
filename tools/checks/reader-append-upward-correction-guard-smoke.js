#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PASS = 'v374-reader-append-upward-correction-guard-smoke-pass';
const root = path.resolve(__dirname, '..', '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

function runReaderAppendUpwardCorrectionGuardSmoke() {
  const layout = read('public/scripts/rebuild/features/reader/virtual-layout.mjs');
  const runner = read('tools/run_smoke_tests.js');
  assert.ok(layout.includes("READER_APPEND_UPWARD_CORRECTION_GUARD_PASS = 'v374-reader-append-upward-correction-guard-pass'"), 'missing v374 upward correction guard marker');
  assert.ok(layout.includes('function resolveAppendUpwardCorrectionGuard('), 'missing append upward correction guard resolver');
  assert.ok(layout.includes('recent forward scroll-buffer append suppresses upward anchor correction'), 'guard must suppress upward correction after forward scroll-buffer append');
  assert.ok(layout.includes("anchorType: 'append'"), 'append anchor restore must use upward correction guard');
  assert.ok(layout.includes("anchorType: 'render-window'"), 'render-window anchor restore must use upward correction guard');
  assert.ok(layout.includes("anchorType: 'measure'"), 'measure anchor restore must use upward correction guard');
  assert.ok(!layout.includes('v.episodeBottomAnchorRecheckRaf = 0;\n    restoreRenderWindowAnchor(app, anchor, phase);'), 'render-window recheck must not reset episode bottom RAF handle');
  assert.ok(runner.includes('tools/checks/reader-append-upward-correction-guard-smoke.js'), 'reader smoke runner must include v374 guard smoke');
  return { pass: PASS };
}

if (require.main === module) console.log(JSON.stringify(runReaderAppendUpwardCorrectionGuardSmoke()));
module.exports = { PASS, runReaderAppendUpwardCorrectionGuardSmoke };
