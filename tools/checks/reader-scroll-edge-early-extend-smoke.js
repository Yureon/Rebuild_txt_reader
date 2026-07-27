const fs = require('fs');
const path = require('path');

const READER_SCROLL_EDGE_EARLY_EXTEND_SMOKE_PASS = 'v367-reader-scroll-edge-anchor-tuned-smoke-pass';

function runReaderScrollEdgeEarlyExtendSmoke(projectRoot) {
  const root = projectRoot || path.join(__dirname, '..', '..');
  const scrollSideEffects = fs.readFileSync(path.join(root, 'public', 'scripts', 'rebuild', 'features', 'reader', 'scroll-side-effects.mjs'), 'utf8');
  const chunkDiagnostics = fs.readFileSync(path.join(root, 'public', 'scripts', 'rebuild', 'features', 'reader', 'chunk-window-diagnostics.mjs'), 'utf8');
  const virtualLayout = fs.readFileSync(path.join(root, 'public', 'scripts', 'rebuild', 'features', 'reader', 'virtual-layout.mjs'), 'utf8');
  function assertContains(src, needle) {
    if (!src.includes(needle)) throw new Error(`reader scroll edge early extend contract missing: ${needle}`);
  }
  assertContains(scrollSideEffects, 'READER_SCROLL_EDGE_EARLY_EXTEND_PASS');
  assertContains(scrollSideEffects, 'Number(handlers.extendDelayMs) || 56');
  assertContains(chunkDiagnostics, 'READER_CHUNK_WINDOW_EARLY_APPEND_PASS');
  assertContains(chunkDiagnostics, 'READER_CHUNK_WINDOW_PC_ANCHOR_TUNING_PASS');
  assertContains(chunkDiagnostics, 'minPx: 1600');
  assertContains(chunkDiagnostics, 'viewportMultiplier: 2.35');
  assertContains(chunkDiagnostics, 'maxPx: 5200');
  assertContains(virtualLayout, 'v285-reader-append-anchor-gated-pass');
  assertContains(virtualLayout, 'active forward buffer append keeps native scrollTop without append anchor');
  assertContains(virtualLayout, 'READER_NATIVE_FORWARD_SCROLL_RETAIN_PASS');
  assertContains(virtualLayout, 'READER_MULTI_EPISODE_APPEND_ANCHOR_PASS');
  return { pass: READER_SCROLL_EDGE_EARLY_EXTEND_SMOKE_PASS };
}

if (require.main === module) console.log(JSON.stringify(runReaderScrollEdgeEarlyExtendSmoke(path.join(__dirname, '..', '..'))));

module.exports = { READER_SCROLL_EDGE_EARLY_EXTEND_SMOKE_PASS, runReaderScrollEdgeEarlyExtendSmoke };
