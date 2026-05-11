#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const reportingPath = path.join(root, 'public/scripts/rebuild/features/library-virtual-render-reporting.mjs');
const reporting = fs.readFileSync(reportingPath, 'utf8');
const docs = fs.readFileSync(path.join(root, 'docs/smoke-tests.md'), 'utf8');
const runner = fs.readFileSync(path.join(root, 'tools/run_smoke_tests.js'), 'utf8');
const PASS = 'v508-library-virtual-scroll-row-height-freeze-smoke-pass';

function row(height) {
  return { getBoundingClientRect() { return { height }; } };
}
function appWithRows(rows) {
  return {
    state: {},
    els: {
      novelList: {
        scrollTop: 420,
        clientHeight: 640,
        scrollHeight: 12000,
        children: rows,
        querySelectorAll() { return rows; }
      }
    }
  };
}

(async () => {
  assert.ok(reporting.includes("LIBRARY_VIRTUAL_SCROLL_ROW_HEIGHT_FREEZE_PASS = 'v508-library-virtual-scroll-row-height-freeze-pass'"), 'row-height freeze marker missing');
  assert.ok(reporting.includes("options.source === 'virtual-scroll'"), 'virtual scroll source branch missing');
  assert.ok(reporting.includes('app?.state?.libraryVirtualStableRowHeight'), 'stable row-height state must be used');
  assert.ok(reporting.includes('rowHeightFrozenForScroll'), 'scroll policy must expose row-height freeze diagnostics');
  assert.ok(docs.includes('library-virtual-scroll-row-height-freeze-smoke.js'), 'smoke docs must mention library row-height freeze smoke');
  assert.ok(runner.includes("nodeCmd('tools/checks/library-virtual-scroll-row-height-freeze-smoke.js')"), 'runner must include library row-height freeze smoke');

  const { buildLibraryVirtualMetrics, LIBRARY_VIRTUAL_SCROLL_ROW_HEIGHT_FREEZE_PASS } = await import('../../public/scripts/rebuild/features/library-virtual-render-reporting.mjs');
  const app = appWithRows([row(56), row(56), row(56)]);
  const first = buildLibraryVirtualMetrics(app, [], { source:'initial-render' });
  assert.strictEqual(first.rowHeight, 56, 'initial render must capture measured stable row height');
  assert.strictEqual(app.state.libraryVirtualStableRowHeight, 56, 'initial render must store stable row height');

  app.els.novelList.querySelectorAll = () => [row(104), row(112), row(96)];
  const scrolled = buildLibraryVirtualMetrics(app, [], { source:'virtual-scroll' });
  assert.strictEqual(scrolled.rowHeight, 56, 'virtual scroll must reuse stable row height instead of recalculating from current window');
  assert.strictEqual(scrolled.measuredRowHeight, 104, 'diagnostics must retain current measured row height');
  assert.strictEqual(scrolled.rowHeightFreezePass, LIBRARY_VIRTUAL_SCROLL_ROW_HEIGHT_FREEZE_PASS, 'freeze pass must be reported');
  assert.strictEqual(scrolled.rowHeightFrozenForScroll, true, 'freeze diagnostic flag must be true');
  console.log(JSON.stringify({ pass: PASS }));
})().catch(error => {
  console.error(error && (error.stack || error.message || String(error)));
  process.exit(1);
});
