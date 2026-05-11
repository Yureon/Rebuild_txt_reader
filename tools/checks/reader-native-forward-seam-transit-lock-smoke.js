#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');

const PASS = 'v431-reader-native-forward-seam-transit-lock-smoke-pass';
const root = path.resolve(__dirname, '..', '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

async function runReaderNativeForwardSeamTransitLockSmoke(projectRoot = root) {
  const layoutPath = path.join(projectRoot, 'public/scripts/rebuild/features/reader/virtual-layout.mjs');
  const layout = fs.readFileSync(layoutPath, 'utf8');
  const diagnostics = read('public/scripts/rebuild/features/reader/virtual-layout-diagnostics.mjs');
  const manual = read('public/scripts/rebuild/features/reader/manual-diagnostics-snapshot.mjs');
  const runner = read('tools/run_smoke_tests.js');
  const release = read('docs/release-history.md');

  assert.ok(layout.includes("READER_NATIVE_FORWARD_SEAM_TRANSIT_LOCK_PASS = 'v431-reader-native-forward-seam-transit-lock-pass'"), 'missing v431 seam transit lock marker');
  assert.ok(layout.includes("READER_SEAM_TRANSIT_MEASURE_DEFER_PASS = 'v431-reader-seam-transit-measure-defer-pass'"), 'missing v431 seam transit measure defer marker');
  assert.ok(layout.includes('function resolveNativeForwardSeamTransitLock'), 'seam transit lock resolver must exist');
  assert.ok(layout.includes('native forward seam transit defers seam render until inertia settles'), 'seam render must defer during native seam transit');
  assert.ok(layout.includes('native forward seam transit keeps native scrollTop at append seam'), 'seam correction must yield to native seam transit');
  assert.ok(layout.includes('native forward seam transit defers visible measurement flush'), 'visible measurement flush must defer during seam transit');
  assert.ok(layout.includes('native seam transit syncs bottom spacer monotonically'), 'deferred spacer sync must be monotonic during seam transit');
  assert.ok(diagnostics.includes('lastNativeForwardSeamTransitLock'), 'diagnostics must expose seam transit lock state');
  assert.ok(manual.includes('nativeForwardSeamTransitLockPass'), 'manual diagnostics snapshot must expose seam transit lock marker');
  assert.ok(runner.includes('tools/checks/reader-native-forward-seam-transit-lock-smoke.js'), 'reader smoke runner must include v431 seam transit smoke');
  assert.ok(release.includes(PASS), 'release history must mention v431 seam transit smoke');

  const previousWindow = global.window;
  global.window = { requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, clearTimeout: () => {}, setTimeout: () => 0 };
  try {
    const mod = await import(pathToFileURL(layoutPath).href + `?smoke=${Date.now()}`);
    const topSpacer = { style: { height: '0px' } };
    const bottomSpacer = { style: { height: '0px' } };
    const content = {
      clientWidth: 700,
      classList: { add() {} },
      querySelector(selector) {
        if (selector === '.reader-virtual-top') return topSpacer;
        if (selector === '.reader-virtual-bottom') return bottomSpacer;
        return null;
      },
      querySelectorAll() { return []; }
    };
    const app = {
      state: {
        current: { chunk: 1, totalChunks: 2, novel: { id: 'n1' }, episode: { id: 'folder' } },
        loadedChunks: new Map([
          [1, { chunk: 1, title: '1', totalChunks: 2, blocks: [{ index: 0, start: 0, end: 10, text: 'first block '.repeat(20) }], content: '' }],
          [2, { chunk: 2, title: '2', totalChunks: 2, blocks: [{ index: 0, start: 0, end: 10, text: 'second block '.repeat(20) }], content: '' }]
        ]),
        prefs: {},
        readerVirtual: null
      },
      els: { reader: { scrollTop: 0, clientHeight: 600, scrollHeight: 1200, classList: { add() {} } }, content }
    };
    const v = mod.ensureVirtualState(app);
    v.rows = [{ id: '1:b:0', type: 'body', chunk: 1, blockIndex: 0, start: 0, end: 10, text: 'first block '.repeat(20) }];
    v.renderedStart = 0;
    v.renderedEnd = 1;
    v.prefix = [0, 240];
    v.totalHeight = 240;
    v.lastScrollBufferDirection = 'forward';
    v.lastUserScrollSource = 'scroll';
    v.userScrollActiveUntil = Date.now() + 500;

    mod.rebuildVirtualRows(app, 'append', 2, { source: 'v147-reader-chunk-window-buffer-pass' });

    assert.strictEqual(app.els.reader.scrollTop, 0, 'native seam transit append must not mutate scrollTop');
    assert.strictEqual(v.lastAppendSeamRender?.seamTransitLock, true, 'append seam render must record seam transit lock');
    assert.strictEqual(v.lastAppendSeamRender?.immediate, false, 'seam transit lock must block immediate seam render');
    assert.strictEqual(v.lastNativeForwardSeamTransitLock?.locked, true, 'seam transit lock diagnostics must be recorded');
    assert.strictEqual(v.lastAppendDeferredSpacerSync?.topChanged, false, 'seam transit must not rewrite the top spacer during deferred append');
    assert.strictEqual(v.lastAppendDeferredSpacerSync?.reason, 'native seam transit syncs bottom spacer monotonically', 'seam transit spacer sync reason must be recorded');

    const anchor = { rowId: '1:b:0', rowIndex: 0, offsetPx: 100, anchorOffsetPx: 36 };
    const correction = mod.resolveAppendCorrectionGuard(app, anchor, { phase: 'measure-commit', anchorType: 'measure' });
    assert.strictEqual(correction.suppress, true, 'seam transit must suppress append correction');
    assert.strictEqual(correction.appendSeamAnchorCorrection, false, 'seam transit must not allow seam anchor correction');
    assert.strictEqual(v.lastAppendSeamNativeScrollRetain?.seamTransitLock, true, 'native retain diagnostics must record seam transit lock');

    const freeze = mod.shouldFreezeNativeSettledScroll(app, { reason: 'measure-commit', anchorType: 'measure', record: true });
    assert.strictEqual(freeze, true, 'native seam transit must freeze settled anchor correction');
    assert.strictEqual(v.lastScrollSettleNativeFreeze?.seamTransitLock, true, 'settle freeze diagnostics must record seam transit lock');

    const snapshot = mod.getVirtualLayoutDiagnostics(app);
    assert.strictEqual(snapshot.nativeForwardSeamTransitLockPass, 'v431-reader-native-forward-seam-transit-lock-pass', 'diagnostics snapshot must expose seam transit pass');
    assert.strictEqual(snapshot.seamTransitMeasureDeferPass, 'v431-reader-seam-transit-measure-defer-pass', 'diagnostics snapshot must expose measure defer pass');
  } finally {
    global.window = previousWindow;
  }
  return { pass: PASS };
}

if (require.main === module) runReaderNativeForwardSeamTransitLockSmoke().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exit(1); });
module.exports = { PASS, runReaderNativeForwardSeamTransitLockSmoke };
