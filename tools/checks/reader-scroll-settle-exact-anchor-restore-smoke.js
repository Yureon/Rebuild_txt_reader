const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PASS = 'v463-reader-scroll-settle-exact-anchor-restore-smoke-pass';
const MARKER = 'v463-reader-scroll-settle-exact-anchor-restore-pass';

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function runReaderScrollSettleExactAnchorRestoreSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const layout = read(projectRoot, 'public/scripts/rebuild/features/reader/virtual-layout.mjs');
  const diagnostics = read(projectRoot, 'public/scripts/rebuild/features/reader/virtual-layout-diagnostics.mjs');
  const frontend = read(projectRoot, 'tools/check_rebuild_frontend.js');
  const runner = read(projectRoot, 'tools/run_smoke_tests.js');

  assert.ok(layout.includes(MARKER), 'restore marker missing from virtual layout');
  assert.ok(layout.includes('function resolveScrollSettleExactAnchorRestore'), 'native-settle restore resolver missing');
  assert.ok(layout.includes('state.exact && !state.active && state.multiFile && state.userScrollSource && !state.pending'), 'resolver must only reopen exact anchors after active native scroll expires');
  assert.ok(layout.includes('nativeFreezeRequested && !recentAppendAnchor && !recentPrependAnchor && !settleExactMeasureAnchor.restore'), 'measure commit must bypass native freeze only for exact settle restore and recent append/prepend anchors');
  assert.ok(layout.includes('measure commit uses exact native-settle anchor instead of frozen scrollTop'), 'measure diagnostic reason missing');
  assert.ok(layout.includes('idle compaction captures exact native-settle anchor'), 'idle compaction exact-anchor capture reason missing');
  assert.ok(layout.includes('active: active || !!settleExactRenderAnchor.restore'), 'render capture must allow exact settle anchor after active window expires');
  assert.ok(layout.includes('anchor.scrollSettleExactAnchorRestorePass = READER_SCROLL_SETTLE_EXACT_ANCHOR_RESTORE_PASS'), 'captured render anchor must carry restore marker');
  assert.ok(layout.includes('render window restore bypasses native-settle freeze for exact anchor'), 'render restore must bypass freeze only for exact settle anchor');
  assert.ok(diagnostics.includes('scrollSettleExactAnchorRestorePass'), 'diagnostics must expose restore marker');
  assert.ok(diagnostics.includes('lastScrollSettleExactAnchorRestore'), 'diagnostics must expose last restore event');
  assert.ok(frontend.includes('runReaderScrollSettleExactAnchorRestoreSmoke'), 'frontend checker must include restore smoke');
  assert.ok(runner.includes('reader-scroll-settle-exact-anchor-restore-smoke.js'), 'reader smoke runner must include restore smoke');
  return { pass: PASS, marker: MARKER };
}

if (require.main === module) {
  console.log(JSON.stringify(runReaderScrollSettleExactAnchorRestoreSmoke(path.join(__dirname, '..', '..'))));
}

module.exports = { runReaderScrollSettleExactAnchorRestoreSmoke };
