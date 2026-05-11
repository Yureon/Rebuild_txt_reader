#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const PASS = 'v447-reader-multi-file-progress-stability-smoke-pass';
const MARKER = 'v447-reader-progress-stable-without-manifest-pass';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeClassList() { return { add(){}, remove(){}, contains(){ return false; } }; }

(async () => {
  const layoutPath = path.resolve(__dirname, '../../public/scripts/rebuild/features/reader/virtual-layout.mjs');
  const coordsPath = path.resolve(__dirname, '../../public/scripts/rebuild/features/reader/coordinates.mjs');
  const source = fs.readFileSync(layoutPath, 'utf8');
  assert(source.includes(MARKER), 'progress stability marker missing');
  assert(source.includes('!exactManifest') || source.includes('chunk-ratio-fallback'), 'viewport address must expose a chunk-ratio fallback without manifest');
  assert(source.includes('hasBlockManifest(app)'), 'viewport address must distinguish exact block manifest from estimated coordinates');

  global.window = { requestAnimationFrame(fn){ return setTimeout(fn, 0); }, cancelAnimationFrame(id){ clearTimeout(id); } };
  global.document = { createElement(){ return { classList: makeClassList(), dataset:{}, style:{}, appendChild(){}, setAttribute(){}, querySelector(){ return null; }, querySelectorAll(){ return []; } }; } };

  const layout = await import(pathToFileURL(layoutPath).href + `?smoke=${Date.now()}`);
  const coords = await import(pathToFileURL(coordsPath).href + `?smoke=${Date.now()}`);
  const reader = { scrollTop: 1070, clientHeight: 700, scrollHeight: 2200, classList: makeClassList() };
  const app = {
    state: {
      current: {
        chunk: 4,
        totalChunks: 4,
        episode: { id:'ep4' },
        episodeIdx: 3,
        novel: { id:'novel', isMultiFile:true, episodes:[{ id:'ep1' }, { id:'ep2' }, { id:'ep3' }, { id:'ep4' }] }
      },
      loadedChunks: new Map([[3, true], [4, true]]),
      prefs: {}
    },
    els: {
      reader,
      content: { clientWidth:700, classList:makeClassList(), querySelectorAll(){ return []; } }
    }
  };
  const v = layout.ensureVirtualState(app);
  v.rows = [
    { id:'3:h', type:'header', chunk:3, title:'3화' },
    { id:'3:b:0', type:'body', chunk:3, blockIndex:0, globalBlockIndex:0, start:0, end:100, text:'three' },
    { id:'4:h', type:'header', chunk:4, title:'4화' },
    { id:'4:b:0', type:'body', chunk:4, blockIndex:0, globalBlockIndex:1, start:0, end:100, text:'four' }
  ];
  v.measureCache.set('3:h', 76);
  v.measureCache.set('3:b:0', 900);
  v.measureCache.set('4:h', 76);
  v.measureCache.set('4:b:0', 380);
  v.rowIndexesByChunk = new Map([[3, [0, 1]], [4, [2, 3]]]);

  const before = layout.getViewportAddress(app).documentRatio;
  // Simulate the next chunk/body-count metadata changing around an append seam.
  // Without the v447 fallback this could change estimated total blocks and make
  // the bottom bar oscillate between two percentages.
  coords.registerChunkBlocks(app, 4, 96);
  const after = layout.getViewportAddress(app).documentRatio;
  assert(before >= 0.76 && before <= 0.82, `expected stable chunk ratio near 80%, got ${before}`);
  assert(Math.abs(after - before) < 0.0001, `progress changed after estimated block metadata changed: ${before} -> ${after}`);
  const diagnostics = layout.getVirtualLayoutDiagnostics(app);
  assert(diagnostics.progressStableWithoutManifestPass === MARKER, 'progress stability diagnostics marker missing');
  assert(diagnostics.lastProgressStableWithoutManifest?.mode === 'chunk-ratio-fallback', 'diagnostics must record chunk-ratio fallback mode');

  console.log(JSON.stringify({ pass: PASS, marker: MARKER, before, after }));
})().catch(error => {
  console.error('[reader-multi-file-progress-stability-smoke] failed:', error && error.stack || error);
  process.exit(1);
});
