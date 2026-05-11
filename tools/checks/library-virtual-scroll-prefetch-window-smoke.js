#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const diagnosticsSource = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/library-row-diagnostics.mjs'), 'utf8');
const cacheSource = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/library-virtual-render-cache.mjs'), 'utf8');
const docs = fs.readFileSync(path.join(root, 'docs/smoke-tests.md'), 'utf8');
const runner = fs.readFileSync(path.join(root, 'tools/run_smoke_tests.js'), 'utf8');
const PASS = 'v518-library-virtual-scroll-prefetch-window-smoke-pass';

function row(height = 56) {
  return { getBoundingClientRect() { return { height }; } };
}

(async () => {
  assert.ok(diagnosticsSource.includes("LIBRARY_VIRTUAL_SCROLL_PREFETCH_OVERSCAN_PASS = 'v518-library-virtual-scroll-prefetch-overscan-pass'"), 'prefetch overscan marker missing');
  assert.ok(diagnosticsSource.includes('overscan: lightweight ? 48 : 24'), 'virtual-scroll overscan must be wider than initial render overscan');
  assert.ok(diagnosticsSource.includes('maxWindowRows: lightweight ? 420 : 360'), 'virtual-scroll max window must allow the wider prefetch window');
  assert.ok(cacheSource.includes("LIBRARY_VIRTUAL_SCROLL_EARLY_EDGE_REFRESH_PASS = 'v518-library-virtual-scroll-early-edge-refresh-pass'"), 'early edge refresh marker missing');
  assert.ok(cacheSource.includes('Math.max(12, Math.min(32'), 'cached-window hold margin must refresh earlier near window edges');
  assert.ok(docs.includes('library-virtual-scroll-prefetch-window-smoke.js'), 'smoke docs must mention prefetch window smoke');
  assert.ok(runner.includes("nodeCmd('tools/checks/library-virtual-scroll-prefetch-window-smoke.js')"), 'runner must include prefetch window smoke');

  const { getLibraryWindowDomMetrics, LIBRARY_VIRTUAL_SCROLL_PREFETCH_OVERSCAN_PASS } = await import('../../public/scripts/rebuild/features/library-row-diagnostics.mjs');
  const { shouldSkipLibraryVirtualDomRender, rememberLibraryVirtualWindowRender, LIBRARY_VIRTUAL_SCROLL_EARLY_EDGE_REFRESH_PASS } = await import('../../public/scripts/rebuild/features/library-virtual-render-cache.mjs');
  const app = {
    state: {},
    els: {
      novelList: {
        scrollTop: 5600,
        clientHeight: 640,
        scrollHeight: 56000,
        children: [row(), row(), row()],
        dataset: { libraryVirtualActive: '1' },
        querySelectorAll() { return [row(), row(), row(), row(), row(), row(), row(), row()]; }
      }
    }
  };
  const metrics = getLibraryWindowDomMetrics(app, { lightweight:true });
  assert.strictEqual(metrics.overscan, 48, 'virtual-scroll metrics must use the wider overscan');
  assert.strictEqual(metrics.maxWindowRows, 420, 'virtual-scroll metrics must allow a wider rendered window');
  assert.strictEqual(metrics.virtualScrollPrefetchPass, LIBRARY_VIRTUAL_SCROLL_PREFETCH_OVERSCAN_PASS, 'prefetch pass must be exposed in metrics');

  const visibleRows = Array.from({ length: 500 }, (_, index) => ({ key:`row:${index}` }));
  const cacheApp = { state:{} };
  const box = { dataset:{ libraryVirtualActive:'1' } };
  rememberLibraryVirtualWindowRender(cacheApp, 'cached', { renderStart:40, renderEnd:160, visibleStart:80, visibleEnd:92, rowHeight:56 }, { visibleRows, activeKey:'row:10' }, 120, {});
  const nearEnd = shouldSkipLibraryVirtualDomRender(cacheApp, box, { source:'virtual-scroll' }, 'next', { totalRows:500, renderStart:90, renderEnd:210, visibleStart:135, visibleEnd:145 }, { visibleRows, activeKey:'row:10' });
  assert.strictEqual(nearEnd, false, 'near cached-window edge should render early instead of holding until the final rows');
  const holdPass = cacheApp.state.libraryVirtualLastScrollWindowHold?.pass || '';
  assert.notStrictEqual(holdPass, LIBRARY_VIRTUAL_SCROLL_EARLY_EDGE_REFRESH_PASS, 'early refresh is a no-hold decision and should not be recorded as a hold');
  console.log(JSON.stringify({ pass: PASS }));
})().catch(error => {
  console.error(error && (error.stack || error.message || String(error)));
  process.exit(1);
});
