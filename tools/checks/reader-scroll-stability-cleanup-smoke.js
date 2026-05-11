const fs = require('fs');
const path = require('path');

const READER_SCROLL_STABILITY_CLEANUP_SMOKE_PASS = 'v291-reader-scroll-stability-cleanup-smoke-pass';

function runReaderScrollStabilityCleanupSmoke(projectRoot) {
  const root = projectRoot || path.join(__dirname, '..', '..');
  const virtualLayoutPath = path.join(root, 'public', 'scripts', 'rebuild', 'features', 'reader', 'virtual-layout.mjs');
  const obsoleteGuardSmokePath = path.join(root, 'tools', 'checks', 'reader-scroll-settle-anchor-guard-smoke.js');
  const docPath = path.join(root, 'docs', 'reader-scroll-stability-cleanup-v291.md');
  const virtualLayout = fs.readFileSync(virtualLayoutPath, 'utf8');
  const loadChunkSideEffects = fs.readFileSync(path.join(root, 'public', 'scripts', 'rebuild', 'features', 'reader', 'load-chunk-side-effects.mjs'), 'utf8');
  const doc = fs.readFileSync(docPath, 'utf8');

  function assertContains(src, needle) {
    if (!src.includes(needle)) throw new Error(`reader scroll stability cleanup contract missing: ${needle}`);
  }
  function assertNotContains(src, needle) {
    if (src.includes(needle)) throw new Error(`reader scroll stability cleanup retained obsolete code: ${needle}`);
  }

  if (fs.existsSync(obsoleteGuardSmokePath)) {
    throw new Error('obsolete v287 scroll-settle anchor guard smoke must be removed');
  }

  assertNotContains(virtualLayout, 'READER_SCROLL_SETTLE_ANCHOR_GUARD_PASS');
  assertNotContains(virtualLayout, 'filterMeasureUpdatesForScrollSettle');
  assertNotContains(virtualLayout, 'resolveScrollSettleAnchorGuard');
  assertNotContains(virtualLayout, 'predictVirtualAnchorAdjustment');
  assertContains(loadChunkSideEffects, 'READER_CHUNK_COMMIT_BUDGET_PASS');
  assertContains(virtualLayout, 'READER_ACTIVE_RENDER_PATCH_PASS');
  assertContains(virtualLayout, 'READER_SCROLL_SETTLE_NATIVE_FREEZE_PASS');
  assertContains(doc, 'v291-reader-scroll-stability-cleanup-doc-pass');
  assertContains(doc, 'v287 scroll-settle anchor guard');

  return { pass: READER_SCROLL_STABILITY_CLEANUP_SMOKE_PASS };
}

if (require.main === module) console.log(JSON.stringify(runReaderScrollStabilityCleanupSmoke(path.join(__dirname, '..', '..'))));

module.exports = { READER_SCROLL_STABILITY_CLEANUP_SMOKE_PASS, runReaderScrollStabilityCleanupSmoke };
