const fs = require('fs');
const path = require('path');

function runReaderRenderWindowAnchorSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const layoutPath = path.join(projectRoot, 'public/scripts/rebuild/features/reader/virtual-layout.mjs');
  const stabilityPath = path.join(projectRoot, 'public/scripts/rebuild/features/reader/virtual-render-stability.mjs');
  const layout = fs.readFileSync(layoutPath, 'utf8');
  const stability = fs.readFileSync(stabilityPath, 'utf8');
  const requiredLayout = [
    "from './virtual-render-stability.mjs'",
    'captureRenderWindowAnchor(app, v, reader',
    'syncRenderedVirtualSpacers(app, v, content)',
    "const phase = patched ? 'window-patch' : 'window-replace';",
    'restoreRenderWindowAnchor(app, renderAnchor, phase)',
    "scheduleRenderWindowAnchorRecheck(app, renderAnchor, patched ? 'window-patch-raf' : 'window-replace-raf')",
    'lastRenderWindowStability'
  ];
  const requiredStability = [
    'READER_RENDER_WINDOW_ANCHOR_PASS',
    'captureVirtualRenderWindowAnchor',
    'restoreVirtualRenderWindowAnchor',
    'syncVirtualSpacerHeights',
    'reader-virtual-top',
    'reader-virtual-bottom'
  ];
  const missingLayout = requiredLayout.filter(token => !layout.includes(token));
  const missingStability = requiredStability.filter(token => !stability.includes(token));
  if (missingLayout.length || missingStability.length) {
    throw new Error('reader render window anchor smoke failed: ' + JSON.stringify({ missingLayout, missingStability }));
  }
  if (/renderVirtual\(app, \{ force: true \}\);\s*if \(renderAnchor\)/.test(layout)) {
    throw new Error('reader render anchor must be restored after content replacement, not after forced render call');
  }
  console.log('Reader render window anchor smoke OK');
  return { ok: true };
}

module.exports = { runReaderRenderWindowAnchorSmoke };

if (require.main === module) runReaderRenderWindowAnchorSmoke();
