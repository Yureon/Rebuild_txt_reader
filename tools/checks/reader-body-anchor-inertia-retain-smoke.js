#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const PASS = 'v445-reader-body-anchor-inertia-retain-smoke-pass';
const MARKER = 'v445-reader-body-anchor-inertia-retain-pass';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeClassList() { return { add(){}, remove(){}, contains(){ return false; } }; }

(async () => {
  const layoutPath = path.resolve(__dirname, '../../public/scripts/rebuild/features/reader/virtual-layout.mjs');
  const source = fs.readFileSync(layoutPath, 'utf8');
  assert(source.includes(MARKER), 'inertia retain marker missing');
  assert(source.includes('function readVirtualAnchorOffsetPx(anchor = null)'), 'negative body-anchor offset reader missing');
  assert(source.includes('const offsetPx = readVirtualAnchorOffsetPx(anchor);'), 'estimate delta still clamps body-anchor offset');
  assert(source.includes('applyVirtualScrollAnchorWithInertiaGuard(app, v, reader, anchor, { phase, anchorType: \'render-window\' })'), 'render-window restore does not use inertia guard');

  global.window = {
    requestAnimationFrame(fn){ return setTimeout(fn, 0); },
    cancelAnimationFrame(id){ clearTimeout(id); },
    clearTimeout(id){ clearTimeout(id); },
    setTimeout(fn, ms){ return setTimeout(fn, ms); }
  };
  global.document = { createElement(){ return { classList: makeClassList(), dataset:{}, style:{}, appendChild(){}, setAttribute(){}, querySelector(){ return null; }, querySelectorAll(){ return []; } }; } };

  const layout = await import(pathToFileURL(layoutPath).href + `?smoke=${Date.now()}`);
  const reader = { scrollTop: 1000, clientHeight: 700, scrollHeight: 2600, classList: makeClassList() };
  const app = {
    state: {
      current: { chunk: 1, totalChunks: 2, novel: { isMultiFile: true, episodes: [{}, {}] }, episode: {} },
      loadedChunks: new Map([[1, true], [2, true]]),
      prefs: {}
    },
    els: { reader, content: { clientWidth: 700, classList: makeClassList(), querySelectorAll(){ return []; } } }
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
  v.lastUserScrollSource = 'scroll';
  v.lastScrollBufferDirection = 'forward';
  v.userScrollActiveUntil = Date.now() + 1000;
  const anchor = {
    rowId:'2:b:0', rowIndex:2, capturedRowId:'2:h', capturedRowIndex:1,
    offsetPx:-16, anchorOffsetPx:36, bodyAnchorAdjusted:true, scrollTop:940
  };
  const result = layout.restoreVirtualViewportAnchor(app, anchor, { source:'scroll-buffer', reason:'viewport-restore' });
  assert(result && result.suppressedBy === MARKER, 'active body-anchor restore did not retain inertia');
  assert(reader.scrollTop === 1000, 'active body-anchor restore changed scrollTop');
  const diagnostics = layout.getVirtualLayoutDiagnostics(app);
  assert(diagnostics.bodyAnchorInertiaRetainPass === MARKER, 'diagnostics marker missing');
  assert(diagnostics.lastBodyAnchorInertiaRetain?.pass === MARKER, 'last inertia retain not recorded');

  v.userScrollActiveUntil = 0;
  v.lastUserScrollSource = '';
  const idle = layout.restoreVirtualViewportAnchor(app, anchor, { source:'idle', reason:'viewport-restore' });
  assert(idle && idle.applied === true, 'idle body-anchor restore should still apply');
  assert(reader.scrollTop === 1024, `idle body-anchor restore target mismatch: ${reader.scrollTop}`);
  console.log(JSON.stringify({ pass: PASS, marker: MARKER }));
})().catch(error => {
  console.error('[reader-body-anchor-inertia-retain-smoke] failed:', error && error.stack || error);
  process.exit(1);
});
