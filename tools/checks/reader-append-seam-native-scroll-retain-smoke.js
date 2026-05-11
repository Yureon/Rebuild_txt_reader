#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');

const PASS = 'v522-reader-append-boundary-native-retain-cleanup-smoke-pass';
const CLEANUP = 'v522-reader-multi-file-guard-cleanup-pass';
const root = path.resolve(__dirname, '..', '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

async function runReaderAppendSeamNativeScrollRetainSmoke(projectRoot = root) {
  const layoutPath = path.join(projectRoot, 'public/scripts/rebuild/features/reader/virtual-layout.mjs');
  const layout = fs.readFileSync(layoutPath, 'utf8');
  const runner = read('tools/run_smoke_tests.js');
  const release = read('docs/release-history.md');

  assert.ok(layout.includes("READER_APPEND_SEAM_NATIVE_SCROLL_RETAIN_PASS = 'v429-reader-append-seam-native-scroll-retain-pass'"), 'legacy retain diagnostic marker must remain');
  assert.ok(layout.includes("READER_MULTI_FILE_GUARD_CLEANUP_PASS = 'v522-reader-multi-file-guard-cleanup-pass'"), 'cleanup marker missing');
  assert.ok(layout.includes('const nativeScrollSource = isUserScrollSource(v?.lastUserScrollSource)'), 'append correction must be scoped to native scroll input');
  assert.ok(layout.includes('nativeScrollSource'), 'native scroll source diagnostic missing');
  assert.ok(layout.includes('const allowCorrection = false'), 'seam correction exception should be disabled');
  assert.ok(runner.includes('tools/checks/reader-append-seam-native-scroll-retain-smoke.js'), 'reader smoke runner must include retain cleanup smoke');
  assert.ok(release.includes(CLEANUP) || release.includes(PASS), 'release history must mention v522 cleanup');

  const mod = await import(pathToFileURL(layoutPath).href + `?smoke=${Date.now()}`);
  const app = {
    state: { readerVirtual: null },
    els: {
      reader: { scrollTop: 1000, clientHeight: 600, scrollHeight: 5000, classList: { add() {} } },
      content: { classList: { add() {} }, clientWidth: 700 }
    }
  };
  const v = mod.ensureVirtualState(app);
  v.rows = [{ id: '1:b:0', type: 'body', chunk: 1, blockIndex: 0, start: 0, end: 10, text: 'anchor' }];
  v.prefix = [0, 1200];
  v.totalHeight = 1200;
  const now = Date.now();
  v.lastAppendSeamRender = { immediate: true, viewportNearSeam: true, smallEpisodeBoundaryDefer: false, renderedTouchesTail: true, overscanTailOnly: false, distanceToSeam: 120, threshold: 900, at: now };
  v.lastAppendAnchorGate = { source: 'v147-reader-chunk-window-buffer-pass', direction: 'forward', reason: 'active forward buffer append keeps native scrollTop without append anchor', at: now };
  v.userScrollActiveUntil = now + 500;
  v.lastUserScrollSource = 'scroll';
  const anchor = { rowId: '1:b:0', rowIndex: 0, offsetPx: 100, anchorOffsetPx: 36 };
  const retained = mod.resolveAppendCorrectionGuard(app, anchor, { phase: 'measure-commit', anchorType: 'measure' });
  assert.strictEqual(retained.suppress, true, 'active native forward append must suppress anchor correction');
  assert.strictEqual(retained.appendSeamAnchorCorrection, false, 'legacy seam correction allowance must not override native retain');
  assert.strictEqual(v.lastMultiFileGuardCleanup?.removedBehavior, 'append-seam-anchor-correction-allowance', 'cleanup diagnostic must record removed allowance');
  assert.strictEqual(retained.sourceMatchesForwardBuffer, true, 'actual chunk-window source must be treated as forward buffer append');

  v.lastUserScrollSource = 'tap-animation';
  const allowed = mod.resolveAppendCorrectionGuard(app, anchor, { phase: 'measure-commit', anchorType: 'measure' });
  assert.strictEqual(allowed.suppress, false, 'non-native append correction should not be suppressed by native-scroll retain cleanup');
  assert.strictEqual(allowed.nativeScrollSource, false, 'non-native diagnostic should be explicit');
  assert.strictEqual(allowed.appendSeamAnchorCorrection, false, 'legacy seam correction allowance remains disabled');
  return { pass: PASS, cleanup: CLEANUP };
}

if (require.main === module) runReaderAppendSeamNativeScrollRetainSmoke().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exit(1); });
module.exports = { PASS, runReaderAppendSeamNativeScrollRetainSmoke };
