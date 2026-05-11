#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const PASS = 'v446-reader-safe-area-body-progress-smoke-pass';
const BODY_MARKER = 'v446-safe-area-multi-file-body-progress-pass';
const NULL_FALLBACK_MARKER = 'v446-safe-area-multi-file-null-manifest-fallback-pass';
const BODY_ROW_MARKER = 'v446-safe-area-body-row-progress-pass';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeClassList() { return { add(){}, remove(){}, contains(){ return false; } }; }

(async () => {
  const progressPath = path.resolve(__dirname, '../../public/scripts/rebuild/features/reader/progress.mjs');
  const layoutPath = path.resolve(__dirname, '../../public/scripts/rebuild/features/reader/virtual-layout.mjs');
  const progressSource = fs.readFileSync(progressPath, 'utf8');
  const layoutSource = fs.readFileSync(layoutPath, 'utf8');
  assert(progressSource.includes(BODY_MARKER), 'safe-area body progress marker missing');
  assert(progressSource.includes(NULL_FALLBACK_MARKER), 'safe-area null manifest fallback marker missing');
  assert(progressSource.includes('exact != null && Number.isFinite(Number(exact))'), 'null folder manifest must not be treated as 0%');
  assert(layoutSource.includes(BODY_ROW_MARKER), 'safe-area body row progress marker missing');
  assert(layoutSource.includes('resolveVisibleBodyRowInfo'), 'viewport progress must remap header row to body row');

  global.window = { requestAnimationFrame(fn){ return setTimeout(fn, 0); }, cancelAnimationFrame(id){ clearTimeout(id); } };
  global.document = { createElement(){ return { classList: makeClassList(), dataset:{}, style:{}, appendChild(){}, setAttribute(){}, querySelector(){ return null; }, querySelectorAll(){ return []; } }; }, getElementById(){ return null; }, documentElement:{ dataset:{} }, body:{ classList:makeClassList(), dataset:{} } };

  const layout = await import(pathToFileURL(layoutPath).href + `?smoke=${Date.now()}`);
  const progress = await import(pathToFileURL(progressPath).href + `?smoke=${Date.now()}`);
  const app = {
    state: {
      current: {
        chunk: 1,
        totalChunks: 2,
        episode: { id:'ep2' },
        episodeIdx: 1,
        novel: { id:'novel', isMultiFile:true, episodes:[{ id:'ep1' }, { id:'ep2' }, { id:'ep3' }] }
      },
      loadedChunks: new Map([[1, true], [2, true]]),
      prefs: {}
    },
    els: {
      reader: { scrollTop:540, clientHeight:700, scrollHeight:1400, classList:makeClassList() },
      content: { clientWidth:700, classList:makeClassList(), querySelectorAll(){ return []; } },
      safeProgress: { textContent:'', dataset:{} },
      navInfo: { textContent:'' },
      navSlider: {}
    }
  };
  const v = layout.ensureVirtualState(app);
  v.rows = [
    { id:'1:h', type:'header', chunk:1, title:'1화' },
    { id:'1:b:0', type:'body', chunk:1, blockIndex:0, globalBlockIndex:0, start:0, end:100, text:'one' },
    { id:'2:h', type:'header', chunk:2, title:'2화' },
    { id:'2:b:0', type:'body', chunk:2, blockIndex:0, globalBlockIndex:1, start:0, end:100, text:'two' }
  ];
  v.measureCache.set('1:h', 76);
  v.measureCache.set('1:b:0', 500);
  v.measureCache.set('2:h', 76);
  v.measureCache.set('2:b:0', 500);
  v.rowIndexesByChunk = new Map([[1, [0, 1]], [2, [2, 3]]]);

  progress.updateProgressFromViewport(app);
  assert(app.els.safeProgress.dataset.safeProgressScope === 'folder-document', 'multi-file safe progress scope must be folder-document');
  assert(!/^0(?:\.0+)?%/.test(app.els.safeProgress.textContent), `multi-file safe-area progress remained zero: ${app.els.safeProgress.textContent}`);
  assert(app.els.safeProgress.textContent.startsWith('50'), `expected fallback folder progress near 50%, got ${app.els.safeProgress.textContent}`);
  assert(app.state.lastSafeAreaMultiFileProgress?.bodyProgressPass === BODY_MARKER, 'safe-area body progress diagnostic missing');
  assert(app.state.lastSafeAreaMultiFileProgress?.nullManifestFallbackPass === NULL_FALLBACK_MARKER, 'safe-area null manifest fallback diagnostic missing');
  assert(app.state.readerVirtual.lastSafeAreaBodyRowProgress?.pass === BODY_ROW_MARKER, 'body row progress diagnostic missing');
  assert(app.state.readerVirtual.lastSafeAreaBodyRowProgress?.bodyRowAdjusted === true, 'header row was not remapped to body row for progress');

  console.log(JSON.stringify({ pass: PASS, markers:[BODY_MARKER, NULL_FALLBACK_MARKER, BODY_ROW_MARKER], safeProgress: app.els.safeProgress.textContent }));
})().catch(error => {
  console.error('[reader-safe-area-body-progress-smoke] failed:', error && error.stack || error);
  process.exit(1);
});
