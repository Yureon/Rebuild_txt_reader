#!/usr/bin/env node
const path = require('path');
const { pathToFileURL } = require('url');

const PASS = 'v444-reader-anchor-trace-export-smoke-pass';
const TRACE_PASS = 'v444-reader-anchor-trace-export-pass';
const TRACE_DIAGNOSTICS_PASS = 'v444-reader-anchor-trace-diagnostics-pass';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeContentStub() {
  return { querySelectorAll(){ return []; }, classList:{ add(){} } };
}

function makeReaderStub() {
  return { scrollTop: 100, clientHeight: 700, scrollHeight: 2000, classList:{ add(){} } };
}

(async () => {
  const layout = await import(pathToFileURL(path.resolve(__dirname, '../../public/scripts/rebuild/features/reader/virtual-layout.mjs')).href);
  assert(layout.READER_ANCHOR_TRACE_EXPORT_PASS === TRACE_PASS, 'trace export marker mismatch');
  const anchorTrace = [
    { pass:TRACE_PASS, seq:1, event:'capture', mode:'single-file', phase:'measure-capture', anchorType:'measure', rowId:'1:b:10', rowIndex:10, chunk:1, totalChunks:2, scrollTop:100 },
    { pass:TRACE_PASS, seq:2, event:'restore', mode:'single-file', phase:'measure-commit', anchorType:'measure', applied:false, reason:'below threshold', rowId:'1:b:10', rowIndex:10, chunk:1, totalChunks:2, scrollTop:100 },
    { pass:TRACE_PASS, seq:3, event:'capture', mode:'multi-file', phase:'append-capture', anchorType:'append', rowId:'2:b:0', capturedRowId:'2:h', rowIndex:20, capturedRowIndex:19, bodyAnchorAdjusted:true, chunk:2, totalChunks:3, episodeIdx:1, episodeCount:3, hasEpisode:true, scrollTop:500 }
  ];
  const app = {
    state: {
      current: { chunk:2, totalChunks:3, episodeIdx:1, episode:{ id:'episode-2' }, novel:{ id:'novel-a', isMultiFile:true, episodes:[{ id:'episode-1' }, { id:'episode-2' }, { id:'episode-3' }] } },
      loadedChunks: new Map([[1, true], [2, true]]),
      readerVirtual: {
        rows: [{ id:'1:b:10', type:'body' }, { id:'2:h', type:'header' }, { id:'2:b:0', type:'body' }],
        prefix: [0, 100, 180, 260],
        heights: [100, 80, 80],
        totalHeight: 260,
        renderedStart: 0,
        renderedEnd: 3,
        rowIndexesByChunk: new Map([[1, [0]], [2, [1, 2]]]),
        measureCache: new Map(),
        rowElementPool: new Map(),
        anchorTracePass: TRACE_PASS,
        anchorTrace,
        lastAnchorTraceEvent: anchorTrace[2]
      }
    },
    els: { reader: makeReaderStub(), content: makeContentStub() }
  };
  const diagnostics = layout.getVirtualLayoutDiagnostics(app);
  assert(diagnostics.anchorTracePass === TRACE_PASS, 'diagnostics trace pass missing');
  assert(Array.isArray(diagnostics.anchorTrace) && diagnostics.anchorTrace.length === 3, 'diagnostics trace events missing');
  assert(diagnostics.anchorTraceSummary?.pass === TRACE_DIAGNOSTICS_PASS, 'trace summary marker missing');
  assert(diagnostics.anchorTraceSummary.singleFileEvents === 2, 'single-file trace events not summarized');
  assert(diagnostics.anchorTraceSummary.multiFileEvents === 1, 'multi-file trace events not summarized');
  assert(diagnostics.anchorTraceSummary.currentMode === 'multi-file', 'current mode not resolved');
  assert(diagnostics.manualDiagnosticsSnapshot?.anchorTracePass === TRACE_PASS, 'manual diagnostics did not carry trace marker');
  assert(diagnostics.manualDiagnosticsSnapshot?.anchorTraceSummary?.multiFileEvents === 1, 'manual diagnostics did not carry trace summary');
  assert(diagnostics.reportSurface?.anchorTraceCount === 3, 'report surface missing trace count');
  assert(String(diagnostics.reportSurface?.copyLabel || '').includes('anchor trace 3'), 'copy label missing trace summary');
  console.log(JSON.stringify({ pass: PASS, tracePass: TRACE_PASS, diagnosticsPass: TRACE_DIAGNOSTICS_PASS }));
})().catch(error => {
  console.error('[reader-anchor-trace-export-smoke] failed:', error && error.stack || error);
  process.exit(1);
});
