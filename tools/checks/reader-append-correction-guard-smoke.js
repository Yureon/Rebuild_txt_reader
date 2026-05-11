#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PASS = 'v375-reader-append-correction-guard-smoke-pass';
const root = path.resolve(__dirname, '..', '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

function runReaderAppendCorrectionGuardSmoke() {
  const layout = read('public/scripts/rebuild/features/reader/virtual-layout.mjs');
  const chunkWindow = read('public/scripts/rebuild/features/reader/chunk-window.mjs');
  const runner = read('tools/run_smoke_tests.js');
  const release = read('docs/release-history.md');

  assert.ok(layout.includes("READER_APPEND_CORRECTION_GUARD_PASS = 'v375-reader-append-correction-guard-pass'"), 'missing v375 append correction guard marker');
  assert.ok(layout.includes('function resolveRecentForwardScrollBufferAppend('), 'must centralize recent forward append detection');
  assert.ok(layout.includes('export function resolveAppendCorrectionGuard('), 'must export shared append correction guard');
  assert.ok(layout.includes('export function resolveAppendPruneDeferral('), 'must export append-aware prune deferral');
  assert.ok(layout.includes('recent forward scroll-buffer append keeps native scrollTop during correction grace'), 'guard must prefer native scrollTop during append grace');
  assert.ok(layout.includes("anchorType: 'append'"), 'append restore must use correction guard');
  assert.ok(layout.includes("anchorType: 'render-window'"), 'render-window restore must use correction guard');
  assert.ok(layout.includes("anchorType: 'measure'"), 'measure restore must use correction guard');
  assert.ok(layout.includes("anchorType: 'viewport'"), 'viewport/fallback restore must use correction guard');
  assert.ok(layout.includes('fallbackDeltaPx'), 'viewport fallback delta must be guarded');

  assert.ok(chunkWindow.includes('resolveAppendPruneDeferral'), 'chunk window must import/use append prune deferral');
  assert.ok(chunkWindow.includes('chunk-window-prune-schedule'), 'prune scheduling must be guarded');
  assert.ok(chunkWindow.includes('chunk-window-prune-apply'), 'prune apply must be guarded');
  assert.ok(chunkWindow.includes('appendCorrectionGuardPass'), 'prune diagnostics must retain correction guard pass');
  assert.ok(runner.includes('tools/checks/reader-append-correction-guard-smoke.js'), 'reader smoke runner must include v375 guard smoke');
  assert.ok(release.includes('v375-reader-append-correction-guard-smoke-pass'), 'release history must mention v375 guard smoke');
  return { pass: PASS };
}

if (require.main === module) console.log(JSON.stringify(runReaderAppendCorrectionGuardSmoke()));
module.exports = { PASS, runReaderAppendCorrectionGuardSmoke };
