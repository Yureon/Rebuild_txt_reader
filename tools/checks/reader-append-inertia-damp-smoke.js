#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const PASS = 'v449-reader-append-inertia-damp-smoke-pass';
const EXTEND = 'v449-reader-scroll-buffer-append-inertia-extend-pass';
const DAMP = 'v449-reader-append-micro-correction-damp-pass';
const BUFFER = 'v147-reader-chunk-window-buffer-pass';

function assert(condition, message) { if (!condition) throw new Error(message); }
function makeClassList() { return { add(){}, remove(){}, contains(){ return false; } }; }

(async () => {
  const root = path.resolve(__dirname, '../..');
  const layoutPath = path.join(root, 'public/scripts/rebuild/features/reader/virtual-layout.mjs');
  const chunkWindowPath = path.join(root, 'public/scripts/rebuild/features/reader/chunk-window.mjs');
  const diagnosticsPath = path.join(root, 'public/scripts/rebuild/features/reader/virtual-layout-diagnostics.mjs');
  const source = fs.readFileSync(layoutPath, 'utf8');
  const chunkWindow = fs.readFileSync(chunkWindowPath, 'utf8');
  const diagnostics = fs.readFileSync(diagnosticsPath, 'utf8');
  assert(source.includes(EXTEND), 'append inertia extension marker missing');
  assert(source.includes(DAMP), 'append micro correction damp marker missing');
  assert(source.includes('export function extendScrollBufferAppendInertia'), 'append inertia extension export missing');
  assert(source.includes('function resolveAppendMicroCorrectionDamp'), 'micro correction damp resolver missing');
  assert(chunkWindow.includes('extendScrollBufferAppendInertia(app'), 'chunk window must extend native inertia before append load');
  assert(diagnostics.includes('lastScrollBufferAppendInertiaExtend'), 'diagnostics must expose append inertia extension');
  assert(diagnostics.includes('lastAppendMicroCorrectionDamp'), 'diagnostics must expose micro correction damp');

  global.window = { requestAnimationFrame(fn){ return setTimeout(fn, 0); }, cancelAnimationFrame(id){ clearTimeout(id); } };
  global.document = { createElement(){ return { classList: makeClassList(), dataset:{}, style:{}, appendChild(){}, setAttribute(){}, querySelector(){ return null; }, querySelectorAll(){ return []; } }; } };
  const layout = await import(pathToFileURL(layoutPath).href + `?smoke=${Date.now()}`);
  const reader = { scrollTop: 1000, clientHeight: 720, scrollHeight: 3000, classList: makeClassList() };
  const app = {
    state: {
      current: { chunk: 1, totalChunks: 3, novel: { isMultiFile: true, episodes: [{}, {}, {}] }, episode: {} },
      loadedChunks: new Map([[1, true], [2, true]]),
      prefs: {}
    },
    els: { reader, content: { clientWidth: 700, classList: makeClassList(), querySelectorAll(){ return []; } } }
  };
  const v = layout.ensureVirtualState(app);
  v.rows = [
    { id:'1:h', type:'header', chunk:1, title:'1화' },
    { id:'1:b:12', type:'body', chunk:1, text:'a'.repeat(200) }
  ];
  v.prefix = [0, 964, 1964];
  v.heights = [964, 1000];
  v.totalHeight = 1964;
  v.measureCache.set('1:h', 964);
  v.measureCache.set('1:b:12', 1000);
  v.lastUserScrollSource = 'scroll';
  v.lastScrollBufferDirection = 'forward';
  v.userScrollActiveUntil = 0;

  const extension = layout.extendScrollBufferAppendInertia(app, { source: BUFFER, direction: 'forward', targetChunk: 2, remainingBottom: 1500, edgePx: 2200 });
  assert(extension?.pass === EXTEND, 'append inertia extension pass missing');
  assert(extension.extended === true, 'append inertia extension was not applied');
  assert(v.userScrollActiveUntil > Date.now() + 900, 'append inertia extension did not extend active window enough');

  v.userScrollActiveUntil = 0;
  v.lastUserScrollSource = 'scroll';
  v.lastAppendAnchorGate = { source: BUFFER, direction: 'forward', reason: 'active forward buffer append keeps native scrollTop without append anchor', at: Date.now() - 1300 };
  v.lastScrollBufferAppendInertiaExtend = { pass: EXTEND, source: BUFFER, direction: 'forward', extended: true, at: Date.now() - 100, activeUntil: Date.now() + 1000 };
  const anchor = { rowId:'1:b:12', rowIndex:1, offsetPx:108, anchorOffsetPx:36, scrollTop:1000, bodyAnchorAdjusted:false };
  const result = layout.restoreVirtualViewportAnchor(app, anchor, { source:'scroll-buffer-bottom', reason:'post-append-micro-fixture' });
  assert(result?.suppressedBy === DAMP, `micro correction was not damped: ${JSON.stringify(result)}`);
  assert(reader.scrollTop === 1000, 'micro correction damp changed scrollTop');
  const diag = layout.getVirtualLayoutDiagnostics(app);
  assert(diag.scrollBufferAppendInertiaExtendPass === EXTEND, 'diagnostics extension marker missing');
  assert(diag.appendMicroCorrectionDampPass === DAMP, 'diagnostics damp marker missing');
  assert(diag.lastAppendMicroCorrectionDamp?.suppress === true, 'last micro correction damp not recorded as suppress');
  console.log(JSON.stringify({ pass: PASS, extend: EXTEND, damp: DAMP }));
})().catch(error => {
  console.error('[reader-append-inertia-damp-smoke] failed:', error && error.stack || error);
  process.exit(1);
});
