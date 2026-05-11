#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const PASS = 'v446-reader-inertia-fixture-expansion-smoke-pass';
const MARKER = 'v446-reader-inertia-fixture-expansion-pass';
const INERTIA_MARKER = 'v445-reader-body-anchor-inertia-retain-pass';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeClassList() { return { add(){}, remove(){}, contains(){ return false; } }; }

function configureRows(v, scrollTop) {
  const bodyTop = scrollTop + 76;
  v.rows = [
    { id:'1:b:0', type:'body', chunk:1, blockIndex:0, globalBlockIndex:0, text:'before' },
    { id:'2:h', type:'header', chunk:2, blockIndex:-1, title:'boundary' },
    { id:'2:b:0', type:'body', chunk:2, blockIndex:0, globalBlockIndex:1, text:'after' }
  ];
  v.prefix = [0, scrollTop, bodyTop, bodyTop + 360];
  v.heights = [scrollTop, 76, 360];
  v.totalHeight = bodyTop + 360;
  v.measureCache.set('1:b:0', scrollTop);
  v.measureCache.set('2:h', 76);
  v.measureCache.set('2:b:0', 360);
  v.rowIndexesByChunk = new Map([[1, [0]], [2, [1, 2]]]);
}

function makeApp({ mode, scrollTop, sizeKb }) {
  const reader = { scrollTop, clientHeight: 700, scrollHeight: scrollTop + 1500, classList: makeClassList() };
  return {
    state: {
      current: {
        chunk: 2,
        totalChunks: 3,
        novel: mode === 'multi-file' ? { isMultiFile: true, episodes: [{ id:'ep1' }, { id:'ep2' }] } : { isMultiFile: false, episodes: [] },
        episode: mode === 'multi-file' ? { id:'ep1' } : null,
        episodeIdx: 0,
        fixtureSizeKb: sizeKb
      },
      loadedChunks: new Map([[1, true], [2, true], [3, true]]),
      prefs: {}
    },
    els: {
      reader,
      content: { clientWidth: 700, classList: makeClassList(), querySelectorAll(){ return []; } }
    }
  };
}

(async () => {
  const layoutPath = path.resolve(__dirname, '../../public/scripts/rebuild/features/reader/virtual-layout.mjs');
  const source = fs.readFileSync(layoutPath, 'utf8');
  assert(source.includes(MARKER), 'v446 fixture expansion marker missing');
  assert(source.includes(INERTIA_MARKER), 'v445 inertia retain marker missing');

  global.window = {
    requestAnimationFrame(fn){ return setTimeout(fn, 0); },
    cancelAnimationFrame(id){ clearTimeout(id); },
    clearTimeout(id){ clearTimeout(id); },
    setTimeout(fn, ms){ return setTimeout(fn, ms); }
  };
  global.document = { createElement(){ return { classList: makeClassList(), dataset:{}, style:{}, appendChild(){}, setAttribute(){}, querySelector(){ return null; }, querySelectorAll(){ return []; } }; } };

  const layout = await import(pathToFileURL(layoutPath).href + `?smoke=${Date.now()}`);
  const fixtures = [
    { mode:'single-file', sizeKb:12, region:'50%', scrollTop:5200 },
    { mode:'single-file', sizeKb:18, region:'75%', scrollTop:7800 },
    { mode:'multi-file', sizeKb:12, region:'50%', scrollTop:5200 },
    { mode:'multi-file', sizeKb:18, region:'75%', scrollTop:7800 }
  ];

  for (const fixture of fixtures) {
    const app = makeApp(fixture);
    const v = layout.ensureVirtualState(app);
    configureRows(v, fixture.scrollTop);
    v.lastUserScrollSource = 'scroll';
    v.lastScrollBufferDirection = 'forward';
    v.userScrollActiveUntil = Date.now() + 1000;
    const anchor = {
      rowId:'2:b:0', rowIndex:2, capturedRowId:'2:h', capturedRowIndex:1,
      offsetPx:-16, anchorOffsetPx:36, bodyAnchorAdjusted:true, scrollTop:fixture.scrollTop - 60
    };
    const result = layout.restoreVirtualViewportAnchor(app, anchor, { source:'scroll-buffer', reason:`v446-${fixture.mode}-${fixture.region}` });
    assert(result && result.suppressedBy === INERTIA_MARKER, `${fixture.mode} ${fixture.region} did not retain native inertia`);
    assert(app.els.reader.scrollTop === fixture.scrollTop, `${fixture.mode} ${fixture.region} changed scrollTop during active scroll`);
    const diagnostics = layout.getVirtualLayoutDiagnostics(app);
    assert(diagnostics.inertiaFixtureExpansionPass === MARKER, `${fixture.mode} ${fixture.region} diagnostics marker missing`);
    assert(diagnostics.lastBodyAnchorInertiaRetain?.pass === INERTIA_MARKER, `${fixture.mode} ${fixture.region} retain details missing`);
  }

  console.log(JSON.stringify({ pass: PASS, marker: MARKER, fixtures: fixtures.map(f => `${f.mode}:${f.sizeKb}KB:${f.region}`) }));
})().catch(error => {
  console.error('[reader-inertia-fixture-expansion-smoke] failed:', error && error.stack || error);
  process.exit(1);
});
