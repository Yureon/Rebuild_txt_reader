const fs = require('fs');
const path = require('path');

const READER_NATIVE_SCROLL_SETTLE_FREEZE_SMOKE_PASS = 'v290-reader-scroll-settle-native-freeze-smoke-pass';

function runReaderNativeScrollSettleFreezeSmoke(projectRoot) {
  const root = projectRoot || path.join(__dirname, '..', '..');
  const virtualLayout = fs.readFileSync(path.join(root, 'public', 'scripts', 'rebuild', 'features', 'reader', 'virtual-layout.mjs'), 'utf8');
  const chunkWindow = fs.readFileSync(path.join(root, 'public', 'scripts', 'rebuild', 'features', 'reader', 'chunk-window.mjs'), 'utf8');
  const diagnostics = fs.readFileSync(path.join(root, 'public', 'scripts', 'rebuild', 'features', 'reader', 'virtual-layout-diagnostics.mjs'), 'utf8');
  const manualSnapshot = fs.readFileSync(path.join(root, 'public', 'scripts', 'rebuild', 'features', 'reader', 'manual-diagnostics-snapshot.mjs'), 'utf8');
  function assertContains(src, needle) {
    if (!src.includes(needle)) throw new Error(`reader native scroll settle freeze contract missing: ${needle}`);
  }
  assertContains(virtualLayout, 'READER_SCROLL_SETTLE_NATIVE_FREEZE_PASS');
  assertContains(virtualLayout, 'v290-reader-scroll-settle-native-freeze-pass');
  assertContains(virtualLayout, 'function resolveNativeScrollSettleFreeze');
  assertContains(virtualLayout, 'export function shouldFreezeNativeSettledScroll');
  assertContains(virtualLayout, "reason: 'native scroll settle freeze'");
  assertContains(virtualLayout, "reason: 'measure-commit'");
  assertContains(virtualLayout, '`render-window-${phase}`');
  assertContains(chunkWindow, 'shouldFreezeNativeSettledScroll');
  assertContains(chunkWindow, 'before-visible prune postponed');
  if (!chunkWindow.includes("{ preserveAnchor: false, source: options.source || 'chunk-window-prune' }")
    && !chunkWindow.includes("{ preserveAnchor: false, source: options.source || 'chunk-window-prune', prunedChunks: plan.removed.slice(), removedBeforeHeight }")
    && !chunkWindow.includes("{ preserveAnchor: false, source: options.source || 'chunk-window-prune', prunedChunks: plan.removed.slice(), removedBeforeHeight, coordinateEviction }")) {
    throw new Error("reader native scroll settle freeze contract missing: chunk-window prune preserveAnchor=false rebuild option");
  }
  assertContains(diagnostics, 'scrollSettleNativeFreezePass');
  assertContains(diagnostics, 'lastScrollSettleNativeFreeze');
  assertContains(manualSnapshot, 'lastScrollSettleNativeFreeze');
  return { pass: READER_NATIVE_SCROLL_SETTLE_FREEZE_SMOKE_PASS };
}

if (require.main === module) console.log(JSON.stringify(runReaderNativeScrollSettleFreezeSmoke(path.join(__dirname, '..', '..'))));

module.exports = { READER_NATIVE_SCROLL_SETTLE_FREEZE_SMOKE_PASS, runReaderNativeScrollSettleFreezeSmoke };
