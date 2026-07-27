const fs = require('fs');
const path = require('path');

const READER_SCROLL_SETTLE_COMPACTION_SMOKE_PASS = 'v288-reader-scroll-settle-compaction-smoke-pass';

function runReaderScrollSettleCompactionSmoke(projectRoot) {
  const root = projectRoot || path.join(__dirname, '..', '..');
  const virtualLayout = fs.readFileSync(path.join(root, 'public', 'scripts', 'rebuild', 'features', 'reader', 'virtual-layout.mjs'), 'utf8');
  const diagnostics = fs.readFileSync(path.join(root, 'public', 'scripts', 'rebuild', 'features', 'reader', 'virtual-layout-diagnostics.mjs'), 'utf8');
  function assertContains(src, needle) {
    if (!src.includes(needle)) throw new Error(`reader scroll settle compaction contract missing: ${needle}`);
  }
  function assertNotContains(src, needle) {
    if (src.includes(needle)) throw new Error(`reader scroll settle compaction regression retained: ${needle}`);
  }
  assertContains(virtualLayout, 'READER_SCROLL_SETTLE_COMPACTION_PASS');
  assertContains(virtualLayout, 'v288-reader-scroll-settle-compaction-pass');
  assertContains(virtualLayout, 'recordScrollSettleCompaction(v, {');
  assertContains(virtualLayout, "'idle compaction keeps native scrollTop'");
  assertContains(virtualLayout, 'const active = isVirtualScrollActive(v);');
  assertContains(virtualLayout, 'if (!settleExactRenderAnchor.restore) return null;');
  assertContains(virtualLayout, 'return null;');
  assertNotContains(virtualLayout, 'v287-reader-scroll-settle-anchor-guard-pass');
  assertNotContains(virtualLayout, 'filterMeasureUpdatesForScrollSettle');
  assertNotContains(virtualLayout, 'VIRTUAL_SCROLL_SETTLE_GUARD_MS');
  assertContains(diagnostics, 'lastScrollSettleCompaction');
  return { pass: READER_SCROLL_SETTLE_COMPACTION_SMOKE_PASS };
}

if (require.main === module) console.log(JSON.stringify(runReaderScrollSettleCompactionSmoke(path.join(__dirname, '..', '..'))));

module.exports = { READER_SCROLL_SETTLE_COMPACTION_SMOKE_PASS, runReaderScrollSettleCompactionSmoke };
