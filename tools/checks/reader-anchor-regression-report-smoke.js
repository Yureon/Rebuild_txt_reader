#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const PASS = 'v445-reader-anchor-regression-report-smoke-pass';
const MARKER = 'v445-reader-anchor-regression-report-pass';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeClassList() { return { add(){}, remove(){}, contains(){ return false; } }; }

(async () => {
  const reportPath = path.resolve(__dirname, '../../public/scripts/rebuild/features/reader/anchor-regression-report.mjs');
  const panelPath = path.resolve(__dirname, '../../public/scripts/rebuild/features/recovery/diagnostics-panel.mjs');
  const source = fs.readFileSync(reportPath, 'utf8');
  const panel = fs.readFileSync(panelPath, 'utf8');
  assert(source.includes(MARKER), 'report marker missing');
  assert(source.includes('anchorTrace'), 'report source missing anchor trace');
  assert(source.includes('virtualDiagnostics'), 'report source missing virtual diagnostics');
  assert(!/password|session[_-]?token|invite\s*code|signup\s*code|absolutePath/i.test(source), 'report source includes sensitive field terms');
  assert(panel.includes('앵커링 리포트 JSON'), 'recovery diagnostics panel button missing');
  assert(panel.includes('readerAnchorRegressionReportPass'), 'recovery diagnostics panel marker missing');

  global.window = { requestAnimationFrame(fn){ return setTimeout(fn, 0); }, cancelAnimationFrame(id){ clearTimeout(id); } };
  global.document = { createElement(){ return { classList: makeClassList(), dataset:{}, style:{}, appendChild(){}, setAttribute(){}, querySelector(){ return null; }, querySelectorAll(){ return []; } }; } };
  const mod = await import(pathToFileURL(reportPath).href + `?smoke=${Date.now()}`);
  const app = {
    state: {
      current: { chunk:1, totalChunks:1, novel:{ id:'novel-a', isMultiFile:false, episodes:[] } },
      readerContext: { novelId:'novel-a', episodeId:'episode-a', episodeCount:1, chunk:1, totalChunks:1, title:'단일 파일' },
      progress: { currentKey:'novel-a:episode-a', chunk:1, ratio:0.5, documentRatio:0.5, updatedAt:'2026-05-07T00:00:00.000Z' },
      loadedChunks: new Map([[1, true]]),
      readerVirtual: {
        rows: [{ id:'1:b:0', type:'body' }], prefix: [0, 100], heights: [100], totalHeight: 100,
        renderedStart: 0, renderedEnd: 1, rowIndexesByChunk: new Map([[1, [0]]]), measureCache: new Map(), rowElementPool: new Map(),
        anchorTracePass: 'v444-reader-anchor-trace-export-pass',
        anchorTrace: [{ pass:'v444-reader-anchor-trace-export-pass', seq:1, event:'capture', mode:'single-file', phase:'viewport', anchorType:'viewport', rowId:'1:b:0', rowIndex:0, scrollTop:20 }]
      }
    },
    els: { reader:{ scrollTop:20, clientHeight:700, scrollHeight:1400, classList:makeClassList() }, content:{ clientWidth:700, classList:makeClassList(), querySelectorAll(){ return []; } } }
  };
  const report = mod.buildReaderAnchorRegressionReport(app, { notes:'smoke' });
  assert(report.pass === MARKER, 'report pass mismatch');
  assert(report.version === 'rebuild-v489', 'report version mismatch');
  assert(report.mode === 'single-file', 'single-file mode not detected');
  assert(report.current.novelId === 'novel-a', 'current novel missing');
  assert(report.progress.currentKey === 'novel-a:episode-a', 'progress missing');
  assert(Array.isArray(report.anchorTrace) && report.anchorTrace.length === 1, 'anchor trace not included');
  assert(report.virtualDiagnostics?.anchorTraceSummary?.singleFileEvents === 1, 'virtual diagnostics trace summary missing');
  const json = JSON.stringify(report);
  assert(!/session_token|password|inviteCode|signupCode/i.test(json), 'report includes sensitive strings');
  console.log(JSON.stringify({ pass: PASS, marker: MARKER }));
})().catch(error => {
  console.error('[reader-anchor-regression-report-smoke] failed:', error && error.stack || error);
  process.exit(1);
});
