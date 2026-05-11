#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const assert = require('assert');

const root = path.join(__dirname, '..', '..');
const PASS = 'v451-reader-ipad-touch-coast-retain-smoke-pass';
const COAST_PASS = 'v451-reader-ipad-scroll-coast-retain-pass';
const LIVE_PASS = 'v451-reader-anchor-report-live-state-pass';

function makeClassList(){ return { add(){}, remove(){}, contains(){ return false; } }; }

(async () => {
  const layoutPath = path.join(root, 'public/scripts/rebuild/features/reader/virtual-layout.mjs');
  const readerPath = path.join(root, 'public/scripts/rebuild/features/reader.mjs');
  const reportPath = path.join(root, 'public/scripts/rebuild/features/reader/anchor-regression-report.mjs');
  const layoutSource = fs.readFileSync(layoutPath, 'utf8');
  const readerSource = fs.readFileSync(readerPath, 'utf8');
  const reportSource = fs.readFileSync(reportPath, 'utf8');

  assert.ok(layoutSource.includes(COAST_PASS), 'iPad/touch coast retain marker missing');
  assert.ok(layoutSource.includes("label === 'touch-scroll' || label === 'touch-coast'"), 'touch scroll sources must count as user scroll sources');
  assert.ok(readerSource.includes("source: 'touch-coast'"), 'reader touchend/pointerup must mark touch coast');
  assert.ok(readerSource.includes("source: 'touch-scroll'"), 'reader touchmove must mark touch scroll');
  assert.ok(reportSource.includes(LIVE_PASS), 'anchor report live-state marker missing');
  assert.ok(reportSource.includes('getChunkViewportState') && reportSource.includes('getViewportAddress'), 'anchor report must read live viewport state');

  const layout = await import(pathToFileURL(layoutPath).href + `?smoke=${Date.now()}`);
  const reportMod = await import(pathToFileURL(reportPath).href + `?smoke=${Date.now()}`);
  const app = {
    state: {
      current: {
        chunk: 1,
        totalChunks: 1,
        ratio: 0,
        title: '76화',
        episodeIdx: 75,
        episode: { id: 'episode-76', title: '76화' },
        novel: { id: 'novel-ipad', title: 'iPad multi', isMultiFile: true, episodes: new Array(503).fill(0).map((_, index) => ({ id: `episode-${index + 1}` })) }
      },
      progress: {},
      readerProgress: {},
      loadedChunks: new Map([[1, true]]),
      readerVirtual: {
        rows: [{ id:'1:b:173', type:'body', chunk:1, blockIndex:173, globalBlockIndex:173, start:0, end:120, text:'body' }],
        prefix: [0, 240],
        heights: [240],
        totalHeight: 240,
        renderedStart: 0,
        renderedEnd: 1,
        rowIndexesByChunk: new Map([[1, [0]]]),
        measureCache: new Map(),
        rowElementPool: new Map(),
        anchorTracePass: 'v444-reader-anchor-trace-export-pass',
        anchorTrace: [{ pass:'v444-reader-anchor-trace-export-pass', seq:1, event:'capture', mode:'multi-file', phase:'render-window-capture', anchorType:'render-window', rowId:'1:b:173', rowIndex:0, scrollTop:120 }]
      }
    },
    els: {
      reader: { scrollTop:120, clientHeight:1397, scrollHeight:2400, classList:makeClassList() },
      content: { clientWidth:820, classList:makeClassList(), querySelectorAll(){ return []; } }
    }
  };

  layout.markVirtualScrollActivity(app, { source:'touch-coast', durationMs:1500 });
  const diagnostics = layout.getVirtualLayoutDiagnostics(app);
  assert.strictEqual(diagnostics.ipadScrollCoastRetainPass, COAST_PASS, 'diagnostics missing touch coast marker');
  assert.strictEqual(diagnostics.lastIpadScrollCoastRetain?.source, 'touch-coast', 'last touch coast source missing');
  assert.ok(diagnostics.userScrollActive, 'touch coast must keep virtual scroll active');

  const report = reportMod.buildReaderAnchorRegressionReport(app, { notes:'ipad smoke' });
  assert.strictEqual(report.liveStatePass, LIVE_PASS, 'report live state marker missing');
  assert.strictEqual(report.mode, 'multi-file', 'report must not fall back to stale single-file mode');
  assert.strictEqual(report.current.novelId, 'novel-ipad', 'report current novel must come from live reader state');
  assert.strictEqual(report.current.episodeId, 'episode-76', 'report current episode must come from live reader state');
  assert.ok(report.progress.source === 'live-viewport', 'report progress must prefer live viewport state');
  assert.ok(report.progress.documentRatio > 0, 'report progress must not be stuck at zero when live rows exist');
  assert.strictEqual(report.lastIpadScrollCoastRetain?.pass, COAST_PASS, 'report must include touch coast diagnostic');
  console.log(JSON.stringify({ pass: PASS, marker: COAST_PASS, liveState: LIVE_PASS }));
})().catch(error => {
  console.error('[reader-ipad-touch-coast-retain-smoke] failed:', error && error.stack || error);
  process.exit(1);
});
