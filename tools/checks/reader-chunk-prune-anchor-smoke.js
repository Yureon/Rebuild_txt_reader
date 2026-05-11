const fs = require('fs');
const path = require('path');
const { readProjectSourceManifest, buildProjectSourceManifestSummary } = require('./source-loader-manifest.js');

const READER_CHUNK_PRUNE_ANCHOR_SMOKE_PASS = 'v276-reader-chunk-prune-anchor-smoke-pass';

function runReaderChunkPruneAnchorSmoke(projectRoot) {
  if (!projectRoot) throw new Error('runReaderChunkPruneAnchorSmoke requires projectRoot');
  const sources = readProjectSourceManifest(projectRoot, {
    chunkWindowSource: 'rebuild/features/reader/chunk-window.mjs',
    virtualLayoutSource: 'rebuild/features/reader/virtual-layout.mjs',
    virtualStabilitySource: 'rebuild/features/reader/virtual-scroll-stability.mjs'
  });
  const sourceSummary = buildProjectSourceManifestSummary(sources);
  const chunkWindow = sources.chunkWindowSource;
  const virtualLayout = sources.virtualLayoutSource;

  [
    'captureVirtualViewportAnchor',
    'restoreVirtualViewportAnchor',
    'const anchor = captureVirtualViewportAnchor(app);',
    'restoreVirtualViewportAnchor(app, anchor, { fallbackDeltaPx: removedBeforeHeight });'
  ].forEach(marker => {
    if (!chunkWindow.includes(marker)) throw new Error('chunk prune anchor smoke missing chunk-window marker: ' + marker);
  });
  [
    'export function captureVirtualViewportAnchor',
    'export function restoreVirtualViewportAnchor',
    'fallbackDeltaPx',
    "reason: 'fallback delta adjusted'"
  ].forEach(marker => {
    if (!virtualLayout.includes(marker)) throw new Error('chunk prune anchor smoke missing virtual-layout marker: ' + marker);
  });

  const heightIndex = chunkWindow.indexOf('const removedBeforeHeight = sumRemovedChunkHeightBeforeVisible');
  const deleteIndex = chunkWindow.indexOf('plan.removed.forEach(chunk => app.state.loadedChunks.delete(chunk));');
  const rebuildIndex = chunkWindow.indexOf("rebuildVirtualRows(app, 'append');");
  const restoreIndex = chunkWindow.indexOf('restoreVirtualViewportAnchor(app, anchor');
  if (!(heightIndex >= 0 && deleteIndex > heightIndex)) throw new Error('removed chunk height must be measured before deleting loaded chunks');
  if (!(rebuildIndex > deleteIndex && restoreIndex > rebuildIndex)) throw new Error('viewport anchor must be restored after virtual rows are rebuilt');

  const staleOrder = /plan\.removed\.forEach\(chunk => app\.state\.loadedChunks\.delete\(chunk\)\);[\s\S]{0,240}const removedBeforeHeight/.test(chunkWindow);
  if (staleOrder) throw new Error('regression: stale prune order computes removed height after deleting chunks');

  return {
    pass: READER_CHUNK_PRUNE_ANCHOR_SMOKE_PASS,
    sourceManifestPass: sourceSummary.pass,
    files: sourceSummary.files
  };
}

if (require.main === module) {
  runReaderChunkPruneAnchorSmoke(path.join(__dirname, '..', '..'));
  console.log('reader chunk prune anchor smoke OK');
}

module.exports = { READER_CHUNK_PRUNE_ANCHOR_SMOKE_PASS, runReaderChunkPruneAnchorSmoke };
