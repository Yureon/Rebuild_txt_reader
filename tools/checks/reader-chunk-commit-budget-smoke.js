const fs = require('fs');
const path = require('path');

const READER_CHUNK_COMMIT_BUDGET_SMOKE_PASS = 'v286-reader-chunk-commit-budget-smoke-pass';

function runReaderChunkCommitBudgetSmoke(projectRoot) {
  const root = projectRoot || path.join(__dirname, '..', '..');
  const loadSideEffects = fs.readFileSync(path.join(root, 'public', 'scripts', 'rebuild', 'features', 'reader', 'load-chunk-side-effects.mjs'), 'utf8');
  const virtualLayout = fs.readFileSync(path.join(root, 'public', 'scripts', 'rebuild', 'features', 'reader', 'virtual-layout.mjs'), 'utf8');
  const reader = fs.readFileSync(path.join(root, 'public', 'scripts', 'rebuild', 'features', 'reader.mjs'), 'utf8');
  function assertContains(src, needle) {
    if (!src.includes(needle)) throw new Error(`reader chunk commit budget contract missing: ${needle}`);
  }
  assertContains(loadSideEffects, 'READER_CHUNK_COMMIT_BUDGET_PASS');
  assertContains(loadSideEffects, 'v286-reader-chunk-commit-budget-pass');
  assertContains(loadSideEffects, 'export async function commitLoadedChunk');
  assertContains(loadSideEffects, 'await yieldBeforeVirtualRebuild(app, { mode, options, actualChunk });');
  assertContains(loadSideEffects, "phase: 'pre-rebuild-yield-check'");
  assertContains(loadSideEffects, "phase: 'virtual-rebuild'");
  assertContains(reader, 'return await commitLoadedChunk(app, {');
  assertContains(virtualLayout, 'READER_APPEND_INCREMENTAL_LAYOUT_PASS');
  assertContains(virtualLayout, 'v286-reader-append-incremental-layout-pass');
  assertContains(virtualLayout, 'tryAppendVirtualRowsIncrementally(app, mode, focusedChunk, { appendAnchor, options })');
  assertContains(virtualLayout, 'buildRowsForLoadedEntry(appendedEntry)');
  assertContains(virtualLayout, 'lastAppendIncrementalLayout');
  return { pass: READER_CHUNK_COMMIT_BUDGET_SMOKE_PASS };
}

if (require.main === module) console.log(JSON.stringify(runReaderChunkCommitBudgetSmoke(path.join(__dirname, '..', '..'))));

module.exports = { READER_CHUNK_COMMIT_BUDGET_SMOKE_PASS, runReaderChunkCommitBudgetSmoke };
