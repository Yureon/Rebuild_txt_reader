const fs = require('fs');
const path = require('path');

const READER_SCROLL_COAST_BUDGET_SMOKE_PASS = 'v281-reader-scroll-coast-budget-smoke-pass';

function read(projectRoot, rel) {
  return fs.readFileSync(path.join(projectRoot, rel), 'utf8');
}

function requireSourceIncludes(source, markers, label) {
  const missing = markers.filter(marker => !source.includes(marker));
  if (missing.length) throw new Error(`${label} missing markers: ${missing.join(', ')}`);
}

function runReaderScrollCoastBudgetSmoke(projectRoot) {
  const budget = read(projectRoot, 'public/scripts/rebuild/features/reader/chunk-window-scroll-budget.mjs');
  const chunkWindow = read(projectRoot, 'public/scripts/rebuild/features/reader/chunk-window.mjs');
  const layout = read(projectRoot, 'public/scripts/rebuild/features/reader/virtual-layout.mjs');
  requireSourceIncludes(budget, [
    "READER_SCROLL_COAST_CHUNK_WINDOW_PASS = 'v281-reader-scroll-coast-chunk-window-pass'",
    'export function resolveScrollCoastChunkBatch',
    'const resolved = active ? 1 : requested',
    'export function getScrollCoastPruneDelay',
    'SCROLL_COAST_PRUNE_IDLE_GRACE_MS = 220',
    'export function recordScrollCoastPrune'
  ], 'scroll coast budget module');
  requireSourceIncludes(chunkWindow, [
    "import { getScrollCoastPruneDelay, recordScrollCoastPrune, resolveScrollCoastChunkBatch } from './chunk-window-scroll-budget.mjs'",
    'resolveExtendBatchSize(app, reader, \'append\'',
    'resolveExtendBatchSize(app, reader, \'prepend\'',
    'schedulePruneChunkWindow(app, { source: \'scroll-buffer-bottom\' })',
    'schedulePruneChunkWindow(app, { source: \'scroll-buffer-top\' })',
    'window.setTimeout(() => {',
    'recordScrollCoastPrune(app, { deferred: true'
  ], 'chunk window scroll coast integration');
  requireSourceIncludes(layout, [
    'const VIRTUAL_ACTIVE_RENDER_IDLE_COMPACT_GRACE_MS = 420',
    'const VIRTUAL_SCROLL_ACTIVE_GRACE_MS = 240',
    'const VIRTUAL_MEASURE_IDLE_GRACE_MS = 180',
    'lastScrollCoastChunkWindow: null',
    'lastScrollCoastPrune: null',
    'scrollCoastPruneTimer: 0'
  ], 'virtual layout scroll coast grace');
  console.log('reader scroll coast budget smoke OK');
  return { pass: READER_SCROLL_COAST_BUDGET_SMOKE_PASS, ok: true };
}

module.exports = { runReaderScrollCoastBudgetSmoke, READER_SCROLL_COAST_BUDGET_SMOKE_PASS };
