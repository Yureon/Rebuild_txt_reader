#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const cacheSource = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/library-virtual-render-cache.mjs'), 'utf8');
const runtimeSource = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/library-virtual-render-runtime.mjs'), 'utf8');
const docs = fs.readFileSync(path.join(root, 'docs/smoke-tests.md'), 'utf8');
const runner = fs.readFileSync(path.join(root, 'tools/run_smoke_tests.js'), 'utf8');
const PASS = 'v509-library-virtual-scroll-window-hold-smoke-pass';

(async () => {
  assert.ok(cacheSource.includes("LIBRARY_VIRTUAL_SCROLL_WINDOW_HOLD_PASS = 'v509-library-virtual-scroll-window-hold-pass'"), 'scroll window hold marker missing');
  assert.ok(cacheSource.includes('isVisibleRangeInsideCachedWindow'), 'visible range hold helper missing');
  assert.ok(cacheSource.includes('libraryVirtualLastScrollWindowHold'), 'scroll window hold diagnostic missing');
  assert.ok(cacheSource.includes("LIBRARY_VIRTUAL_SCROLL_BOTTOM_EDGE_HOLD_PASS = 'v511-library-virtual-scroll-bottom-edge-hold-pass'"), 'bottom edge hold marker missing');
  assert.ok(runtimeSource.includes('shouldSkipLibraryVirtualDomRender(app, box, options, windowRenderSignature, windowPlan, rowsInfo)'), 'runtime must pass window plan/rows info to skip helper');
  assert.ok(runtimeSource.includes('scrollWindowHoldPass'), 'runtime skip diagnostics must expose hold pass');
  assert.ok(docs.includes('library-virtual-scroll-window-hold-smoke.js'), 'smoke docs must mention scroll window hold smoke');
  assert.ok(runner.includes("nodeCmd('tools/checks/library-virtual-scroll-window-hold-smoke.js')"), 'runner must include scroll window hold smoke');

  const { shouldSkipLibraryVirtualDomRender, rememberLibraryVirtualWindowRender, LIBRARY_VIRTUAL_SCROLL_WINDOW_HOLD_PASS, LIBRARY_VIRTUAL_SCROLL_BOTTOM_EDGE_HOLD_PASS } = await import('../../public/scripts/rebuild/features/library-virtual-render-cache.mjs');
  const visibleRows = Array.from({ length: 400 }, (_, index) => ({ key:`row:${index}` }));
  const app = { state:{} };
  const box = { dataset:{ libraryVirtualActive:'1' } };
  rememberLibraryVirtualWindowRender(app, 'old-window', { renderStart:40, renderEnd:140, visibleStart:70, visibleEnd:82, rowHeight:56 }, { visibleRows, activeKey:'row:10' }, 100, {});
  const held = shouldSkipLibraryVirtualDomRender(app, box, { source:'virtual-scroll' }, 'new-window', { totalRows:400, renderStart:55, renderEnd:155, visibleStart:82, visibleEnd:94 }, { visibleRows, activeKey:'row:10' });
  assert.strictEqual(held, true, 'visible range inside cached overscan should skip DOM replacement during scroll');
  assert.strictEqual(app.state.libraryVirtualLastScrollWindowHold.pass, LIBRARY_VIRTUAL_SCROLL_WINDOW_HOLD_PASS, 'hold diagnostic pass mismatch');
  const edge = shouldSkipLibraryVirtualDomRender(app, box, { source:'virtual-scroll' }, 'edge-window', { totalRows:400, renderStart:130, renderEnd:230, visibleStart:134, visibleEnd:150 }, { visibleRows, activeKey:'row:10' });
  assert.strictEqual(edge, false, 'near cached window edge should allow a new render');
  rememberLibraryVirtualWindowRender(app, 'bottom-old-window', { renderStart:300, renderEnd:400, visibleStart:384, visibleEnd:400, rowHeight:56 }, { visibleRows, activeKey:'row:10' }, 100, {});
  const bottomHeld = shouldSkipLibraryVirtualDomRender(app, box, { source:'virtual-scroll' }, 'bottom-new-window', { totalRows:400, renderStart:292, renderEnd:400, visibleStart:392, visibleEnd:400 }, { visibleRows, activeKey:'row:10' });
  assert.strictEqual(bottomHeld, true, 'bottom edge range already inside cached end should skip DOM replacement');
  assert.strictEqual(app.state.libraryVirtualLastScrollWindowHold.pass, LIBRARY_VIRTUAL_SCROLL_BOTTOM_EDGE_HOLD_PASS, 'bottom edge hold diagnostic pass mismatch');
  console.log(JSON.stringify({ pass: PASS }));
})().catch(error => {
  console.error(error && (error.stack || error.message || String(error)));
  process.exit(1);
});
