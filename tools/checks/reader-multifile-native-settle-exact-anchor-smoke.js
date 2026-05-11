#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const PASS = 'v461-reader-multifile-native-settle-exact-anchor-smoke-pass';
const MARKER = 'v461-reader-multi-file-native-scroll-settle-exact-anchor-pass';
function assert(condition, message) { if (!condition) throw new Error(message); }
function makeClassList() { return { add(){}, remove(){}, contains(){ return false; } }; }

(async () => {
  const root = path.resolve(__dirname, '../..');
  const layoutPath = path.join(root, 'public/scripts/rebuild/features/reader/virtual-layout.mjs');
  const diagnosticsPath = path.join(root, 'public/scripts/rebuild/features/reader/virtual-layout-diagnostics.mjs');
  const runnerPath = path.join(root, 'tools/run_smoke_tests.js');
  const layoutSource = fs.readFileSync(layoutPath, 'utf8');
  const diagnosticsSource = fs.readFileSync(diagnosticsPath, 'utf8');
  const runnerSource = fs.readFileSync(runnerPath, 'utf8');
  assert(layoutSource.includes(`READER_MULTI_FILE_NATIVE_SCROLL_SETTLE_EXACT_ANCHOR_PASS = '${MARKER}'`), 'v461 exact settle marker missing');
  assert(layoutSource.includes('function resolveMultiFileNativeExactAnchorState'), 'exact settle resolver missing');
  assert(layoutSource.includes('recentNativeSettle'), 'exact anchor window must include native settle grace');
  assert(layoutSource.includes("phase: 'append-capture'"), 'append capture must record exact-native policy');
  assert(layoutSource.includes("phase: 'prepend-capture'"), 'prepend capture must record exact-native policy');
  assert(layoutSource.includes("anchorType: 'viewport'"), 'viewport/prune capture must record exact-native policy');
  assert((layoutSource.match(/preferBodyRows: !exactNativeAnchor/g) || []).length >= 4, 'append/prepend/viewport/render captures must disable body remap under exact native anchor');
  assert(layoutSource.includes('preferBodyRows: !exactNativeMeasureAnchor'), 'measure capture must still disable body remap under exact native anchor');
  assert(diagnosticsSource.includes('multiFileNativeScrollSettleExactAnchorPass'), 'diagnostics must expose v461 exact settle marker');
  assert(runnerSource.includes('reader-multifile-native-settle-exact-anchor-smoke.js'), 'reader smoke group must include v461 exact settle smoke');

  global.window = {
    requestAnimationFrame(fn){ return setTimeout(fn, 0); },
    cancelAnimationFrame(id){ clearTimeout(id); },
    clearTimeout(id){ clearTimeout(id); },
    setTimeout(fn, ms){ return setTimeout(fn, ms); }
  };
  global.document = { createElement(){ return { classList: makeClassList(), dataset:{}, style:{}, appendChild(){}, setAttribute(){}, querySelector(){ return null; }, querySelectorAll(){ return []; } }; } };

  const layout = await import(pathToFileURL(layoutPath).href + `?smoke=${Date.now()}`);
  const reader = { scrollTop: 964, clientHeight: 900, scrollHeight: 2600, classList: makeClassList() };
  const app = {
    state: {
      current: { chunk: 2, totalChunks: 3, novel: { isMultiFile: true, episodes: [{}, {}, {}] }, episode: { id:'ep2' } },
      loadedChunks: new Map([[1, true], [2, true], [3, true]]),
      prefs: {}
    },
    els: { reader, content: { clientWidth: 900, classList: makeClassList(), querySelectorAll(){ return []; } } }
  };
  const v = layout.ensureVirtualState(app);
  v.rows = [
    { id:'1:b:20', type:'body', chunk:1, text:'first' },
    { id:'2:h', type:'header', chunk:2, title:'2화' },
    { id:'2:b:0', type:'body', chunk:2, text:'second' }
  ];
  v.prefix = [0, 1000, 1076, 1376];
  v.heights = [1000, 76, 300];
  v.totalHeight = 1376;
  v.measureCache.set('1:b:20', 1000);
  v.measureCache.set('2:h', 76);
  v.measureCache.set('2:b:0', 300);
  v.lastUserScrollSource = 'touch-coast';
  v.userScrollActiveUntil = Date.now() - 360;

  const anchor = layout.captureVirtualViewportAnchor(app, { source:'chunk-window-prune' });
  assert(anchor && anchor.rowId === '2:h', `native settle viewport capture must keep exact header row, got ${JSON.stringify(anchor)}`);
  assert(anchor.bodyAnchorAdjusted === false, 'native settle viewport anchor must not remap to body row');
  const diagnostics = layout.getVirtualLayoutDiagnostics(app);
  assert(diagnostics.multiFileNativeScrollSettleExactAnchorPass === MARKER, 'diagnostics v461 marker mismatch');
  assert(diagnostics.lastMultiFileNativeScrollSettleExactAnchor?.exact === true, 'diagnostics must record exact=true');
  assert(diagnostics.lastMultiFileNativeScrollSettleExactAnchor?.recentNativeSettle === true, 'diagnostics must record recentNativeSettle=true');
  console.log(JSON.stringify({ pass: PASS, marker: MARKER, rowId: anchor.rowId }));
})().catch(error => {
  console.error('[reader-multifile-native-settle-exact-anchor-smoke] failed:', error && error.stack || error);
  process.exit(1);
});
