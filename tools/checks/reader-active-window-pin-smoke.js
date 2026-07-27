const fs = require('fs');
const path = require('path');

function runReaderActiveWindowPinSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const layoutPath = path.join(projectRoot, 'public/scripts/rebuild/features/reader/virtual-layout.mjs');
  const helperPath = path.join(projectRoot, 'public/scripts/rebuild/features/reader/virtual-window-range-stability.mjs');
  const layout = fs.readFileSync(layoutPath, 'utf8');
  const helper = fs.readFileSync(helperPath, 'utf8');
  const requiredLayout = [
    "from './virtual-window-range-stability.mjs'",
    'resolveStableVirtualRenderRange({',
    'VIRTUAL_ACTIVE_RENDER_WINDOW_MAX_ROWS',
    'scheduleActiveRenderWindowIdleCompaction(app)',
    'activeRenderWindowIdleCompacting',
    'lastActiveRenderWindowPin'
  ];
  const requiredHelper = [
    'READER_ACTIVE_RENDER_WINDOW_PIN_PASS',
    'resolveStableVirtualRenderRange',
    'active-pinned',
    'active-pinned-truncated',
    'previousStart',
    'previousEnd'
  ];
  const missingLayout = requiredLayout.filter(token => !layout.includes(token));
  const missingHelper = requiredHelper.filter(token => !helper.includes(token));
  if (missingLayout.length || missingHelper.length) {
    throw new Error('reader active window pin smoke failed: ' + JSON.stringify({ missingLayout, missingHelper }));
  }
  if (/const \{ start, end \} = findVisibleRange\(v, viewportTop, viewportBottom\)/.test(layout)) {
    throw new Error('renderVirtual must pass natural range through active-window pin helper');
  }
  console.log('Reader active window pin smoke OK');
  return { ok: true };
}

module.exports = { runReaderActiveWindowPinSmoke };

if (require.main === module) runReaderActiveWindowPinSmoke();
