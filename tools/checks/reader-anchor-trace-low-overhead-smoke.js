#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const assert = require('assert');

const root = path.join(__dirname, '..', '..');
const PASS = 'v450-reader-anchor-trace-low-overhead-smoke-pass';
const LOW_OVERHEAD = 'v450-reader-anchor-trace-low-overhead-pass';

function makeContentStub() {
  return { querySelectorAll(){ return []; }, classList:{ add(){} } };
}
function makeReaderStub() {
  return { scrollTop: 120, clientHeight: 720, scrollHeight: 999999, classList:{ add(){} } };
}

(async () => {
  const source = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/reader/virtual-layout.mjs'), 'utf8');
  assert.ok(source.includes("READER_ANCHOR_TRACE_LOW_OVERHEAD_PASS = '" + LOW_OVERHEAD + "'"), 'low overhead marker missing');
  assert.ok(source.includes("scrollHeightSource: 'virtual-total-height'"), 'trace context must use virtual-total-height source');
  assert.ok(!source.includes('const trace = Array.isArray(v.anchorTrace) ? v.anchorTrace.slice() : [];'), 'old trace array copy path must not remain');
  assert.ok(source.includes('v.anchorTrace.push(event)'), 'trace should append in-place');
  assert.ok(source.includes('v.anchorTrace.shift()'), 'trace should drop oldest event in-place');

  const layout = await import(pathToFileURL(path.join(root, 'public/scripts/rebuild/features/reader/virtual-layout.mjs')).href);
  assert.strictEqual(layout.READER_ANCHOR_TRACE_LOW_OVERHEAD_PASS, LOW_OVERHEAD, 'exported marker mismatch');

  const app = {
    state: {
      current: { chunk:1, totalChunks:2, novel:{ isMultiFile:false, episodes:[] } },
      loadedChunks: new Map([[1, true]]),
      readerVirtual: {
        rows: [{ id:'1:b:0', type:'body', chunk:1 }],
        prefix: [0, 180],
        heights: [180],
        totalHeight: 180,
        renderedStart: 0,
        renderedEnd: 1,
        rowIndexesByChunk: new Map([[1, [0]]]),
        measureCache: new Map(),
        rowElementPool: new Map(),
        anchorTracePass: 'v444-reader-anchor-trace-export-pass',
        anchorTraceLowOverheadPass: LOW_OVERHEAD,
        anchorTraceStats: { pushed: 40, dropped: 8, maxEvents: 32 },
        anchorTrace: [{ pass:'v444-reader-anchor-trace-export-pass', lowOverheadPass:LOW_OVERHEAD, scrollHeightSource:'virtual-total-height', seq:40, event:'restore', mode:'single-file', scrollHeight:180 }],
        lastAnchorTraceEvent: { pass:'v444-reader-anchor-trace-export-pass', lowOverheadPass:LOW_OVERHEAD, scrollHeightSource:'virtual-total-height', seq:40, event:'restore', mode:'single-file', scrollHeight:180 }
      }
    },
    els: { reader: makeReaderStub(), content: makeContentStub() }
  };
  const diagnostics = layout.getVirtualLayoutDiagnostics(app);
  assert.strictEqual(diagnostics.anchorTraceLowOverheadPass, LOW_OVERHEAD, 'diagnostics low overhead marker missing');
  assert.strictEqual(diagnostics.anchorTraceStats.pushed, 40, 'trace pushed stats missing');
  assert.strictEqual(diagnostics.anchorTraceStats.dropped, 8, 'trace dropped stats missing');
  assert.strictEqual(diagnostics.anchorTrace[0].scrollHeightSource, 'virtual-total-height', 'normalized trace source missing');
  assert.strictEqual(diagnostics.anchorTrace[0].lowOverheadPass, LOW_OVERHEAD, 'normalized trace marker missing');
  console.log(JSON.stringify({ pass: PASS, marker: LOW_OVERHEAD }));
})().catch(error => {
  console.error('[reader-anchor-trace-low-overhead-smoke] failed:', error && error.stack || error);
  process.exit(1);
});
