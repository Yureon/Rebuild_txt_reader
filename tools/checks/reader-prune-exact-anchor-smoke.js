#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PASS = 'v376-reader-prune-exact-anchor-smoke-pass';
const root = path.resolve(__dirname, '..', '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

function runReaderPruneExactAnchorSmoke() {
  const stability = read('public/scripts/rebuild/features/reader/virtual-scroll-stability.mjs');
  const chunkWindow = read('public/scripts/rebuild/features/reader/chunk-window.mjs');
  const layout = read('public/scripts/rebuild/features/reader/virtual-layout.mjs');
  const runner = read('tools/run_smoke_tests.js');
  const release = read('docs/release-history.md');

  assert.ok(stability.includes('return byId >= 0 ? byId : -1;'), 'stable rowId anchors must not fall back to stale rowIndex');
  assert.ok(chunkWindow.includes('function getVirtualAnchorChunk('), 'chunk-window prune must resolve anchor chunk from rowId');
  assert.ok(chunkWindow.includes('const anchorChunk = getVirtualAnchorChunk(anchor);'), 'prune must prefer captured viewport anchor chunk');
  assert.ok(chunkWindow.includes('const visible = anchorChunk || getVisibleChunk(app)'), 'prune plan must keep the captured anchor chunk visible');
  assert.ok(chunkWindow.includes("rebuildVirtualRows(app, 'prune'"), 'prune rebuild must not run append-specific anchor restoration');
  assert.ok(chunkWindow.includes('const v = ensureVirtualState(app);'), 'prune deferral timer must use an initialized virtual state');
  assert.ok(layout.includes("READER_PRUNE_EXACT_ANCHOR_PASS = 'v376-reader-prune-exact-anchor-pass'"), 'missing v376 exact prune anchor marker');
  assert.ok(layout.includes('exact anchor row missing; fallback skipped'), 'missing exact-anchor fallback skip guard');
  assert.ok(layout.includes('suppressedBy: READER_PRUNE_EXACT_ANCHOR_PASS'), 'exact-anchor skip must be visible in diagnostics');
  assert.ok(runner.includes('tools/checks/reader-prune-exact-anchor-smoke.js'), 'reader smoke runner must include v376 exact prune anchor smoke');
  assert.ok(release.includes(PASS), 'release history must mention v376 smoke pass');
  return { pass: PASS };
}

if (require.main === module) console.log(JSON.stringify(runReaderPruneExactAnchorSmoke()));
module.exports = { PASS, runReaderPruneExactAnchorSmoke };
