#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const PASS = 'v454-reader-ipad-touch-native-anchor-smoke-pass';
const MARKER = 'v454-reader-ipad-touch-native-scroll-anchor-pass';
const BODY_RETAIN = 'v445-reader-body-anchor-inertia-retain-pass';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function makeClassList() { return { add(){}, remove(){}, contains(){ return false; } }; }

(async () => {
  const root = path.resolve(__dirname, '../..');
  const layoutPath = path.join(root, 'public/scripts/rebuild/features/reader/virtual-layout.mjs');
  const commitPath = path.join(root, 'public/scripts/rebuild/features/reader/load-chunk-side-effects.mjs');
  const diagnosticsPath = path.join(root, 'public/scripts/rebuild/features/reader/virtual-layout-diagnostics.mjs');
  const layoutSource = fs.readFileSync(layoutPath, 'utf8');
  const commitSource = fs.readFileSync(commitPath, 'utf8');
  const diagnosticsSource = fs.readFileSync(diagnosticsPath, 'utf8');

  assert(layoutSource.includes(MARKER), 'iPad touch native scroll anchor marker missing');
  assert(layoutSource.includes('const nativeScrollSource = isUserScrollSource(lastSource);'), 'body-anchor inertia guard must use the unified native scroll source resolver');
  assert(layoutSource.includes('const activeUserScroll = active && isUserScrollSource(lastUserScrollSource);'), 'append/prepend anchor gates must treat touch scroll as active user scroll');
  assert(commitSource.includes("label === 'touch-scroll' || label === 'touch-coast'"), 'touch scroll/coast must defer active chunk commits');
  assert(diagnosticsSource.includes('ipadTouchNativeScrollAnchorPass'), 'diagnostics must expose touch native anchor guard');

  global.window = {
    requestAnimationFrame(fn){ return setTimeout(fn, 0); },
    cancelAnimationFrame(id){ clearTimeout(id); },
    clearTimeout(id){ clearTimeout(id); },
    setTimeout(fn, ms){ return setTimeout(fn, ms); }
  };
  global.document = { createElement(){ return { classList: makeClassList(), dataset:{}, style:{}, appendChild(){}, setAttribute(){}, querySelector(){ return null; }, querySelectorAll(){ return []; } }; } };

  const layout = await import(pathToFileURL(layoutPath).href + `?smoke=${Date.now()}`);
  const reader = { scrollTop: 1000, clientHeight: 1366, scrollHeight: 3600, classList: makeClassList() };
  const app = {
    state: {
      current: { chunk: 1, totalChunks: 2, novel: { isMultiFile: true, episodes: [{}, {}] }, episode: {} },
      loadedChunks: new Map([[1, true], [2, true]]),
      prefs: {}
    },
    els: { reader, content: { clientWidth: 1024, classList: makeClassList(), querySelectorAll(){ return []; } } }
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
  v.lastScrollBufferDirection = 'forward';
  v.userScrollActiveUntil = Date.now() + 1400;

  const anchor = {
    rowId:'2:b:0', rowIndex:2, capturedRowId:'2:h', capturedRowIndex:1,
    offsetPx:-16, anchorOffsetPx:36, bodyAnchorAdjusted:true, scrollTop:940
  };
  const result = layout.restoreVirtualViewportAnchor(app, anchor, { source:'scroll-buffer-bottom', reason:'ipad-touch-native-anchor-fixture' });
  assert(result && result.suppressedBy === BODY_RETAIN, `touch native body-anchor correction was not suppressed: ${JSON.stringify(result)}`);
  assert(reader.scrollTop === 1000, 'touch native body-anchor correction changed scrollTop');
  const diagnostics = layout.getVirtualLayoutDiagnostics(app);
  assert(diagnostics.ipadTouchNativeScrollAnchorPass === MARKER, 'diagnostics marker missing');
  assert(diagnostics.lastIpadTouchNativeScrollAnchor?.retain === true, 'last touch native anchor guard must record retain=true');
  console.log(JSON.stringify({ pass: PASS, marker: MARKER, retainedBy: BODY_RETAIN }));
})().catch(error => {
  console.error('[reader-ipad-touch-native-anchor-smoke] failed:', error && error.stack || error);
  process.exit(1);
});
