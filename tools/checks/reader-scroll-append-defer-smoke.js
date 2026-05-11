const fs = require('fs');
const path = require('path');

const READER_SCROLL_APPEND_DEFER_SMOKE_PASS = 'v312-reader-scroll-append-defer-smoke-pass';

function read(projectRoot, relPath) {
  return fs.readFileSync(path.join(projectRoot, relPath), 'utf8');
}

function requireSourceIncludes(source, markers, label) {
  const missing = markers.filter(marker => !source.includes(marker));
  if (missing.length) throw new Error(`${label} missing markers: ${missing.join(', ')}`);
}

function runReaderScrollAppendDeferSmoke(projectRoot) {
  const root = projectRoot || path.join(__dirname, '..', '..');
  const chunkWindow = read(root, 'public/scripts/rebuild/features/reader/chunk-window.mjs');
  const loadSideEffects = read(root, 'public/scripts/rebuild/features/reader/load-chunk-side-effects.mjs');
  const layout = read(root, 'public/scripts/rebuild/features/reader/virtual-layout.mjs');
  requireSourceIncludes(chunkWindow, [
    "export const READER_CHUNK_WINDOW_BUFFER_PASS = 'v147-reader-chunk-window-buffer-pass'",
    'await loadChunk(target, mode, { source: READER_CHUNK_WINDOW_BUFFER_PASS });'
  ], 'chunk window scroll append source');
  requireSourceIncludes(loadSideEffects, [
    "READER_SCROLL_BUFFER_COMMIT_DEFER_PASS = 'v312-reader-scroll-buffer-commit-defer-pass'",
    'READER_CHUNK_WINDOW_BUFFER_PASS',
    'waitForVirtualRebuildSlot({ idle: scrollBufferCommit })',
    'window.requestIdleCallback',
    "commitDeferPass: scrollBufferCommit ? READER_SCROLL_BUFFER_COMMIT_DEFER_PASS : ''"
  ], 'scroll buffer commit deferral');
  requireSourceIncludes(layout, [
    "READER_SCROLL_APPEND_RENDER_DEFER_PASS = 'v312-reader-scroll-append-render-defer-pass'",
    'resolveAppendRenderDeferral(v, context?.options || {})',
    'if (renderDefer.deferred) scheduleVirtualRender(app);',
    'deferredRender: renderDefer.deferred',
    "'active scroll buffer append render scheduled'",
    'lastScrollAppendRenderDefer'
  ], 'scroll append render deferral');
  console.log('reader scroll append defer smoke OK');
  return { pass: READER_SCROLL_APPEND_DEFER_SMOKE_PASS, ok: true };
}

if (require.main === module) console.log(JSON.stringify(runReaderScrollAppendDeferSmoke(path.join(__dirname, '..', '..'))));

module.exports = { READER_SCROLL_APPEND_DEFER_SMOKE_PASS, runReaderScrollAppendDeferSmoke };
