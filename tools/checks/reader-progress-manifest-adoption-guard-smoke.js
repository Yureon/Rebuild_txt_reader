#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const PASS = 'v522-reader-progress-manifest-adoption-cleanup-smoke-pass';
const GUARD = 'v448-reader-manifest-adoption-guard-pass';
const CLEANUP = 'v522-reader-multi-file-guard-cleanup-pass';
const PHASE = 'v448-reader-progress-phase-report-pass';

function assert(condition, message) { if (!condition) throw new Error(message); }
function makeClassList() { return { add(){}, remove(){}, contains(){ return false; } }; }

(async () => {
  const layoutPath = path.resolve(__dirname, '../../public/scripts/rebuild/features/reader/virtual-layout.mjs');
  const coordsPath = path.resolve(__dirname, '../../public/scripts/rebuild/features/reader/coordinates.mjs');
  const diagPath = path.resolve(__dirname, '../../public/scripts/rebuild/features/reader/virtual-layout-diagnostics.mjs');
  const reportPath = path.resolve(__dirname, '../../public/scripts/rebuild/features/reader/anchor-regression-report.mjs');
  const source = fs.readFileSync(layoutPath, 'utf8');
  const diagSource = fs.readFileSync(diagPath, 'utf8');
  const report = fs.readFileSync(reportPath, 'utf8');
  assert(source.includes(GUARD), 'manifest adoption diagnostic marker missing');
  assert(source.includes(CLEANUP), 'v522 cleanup marker missing');
  assert(source.includes('const legacyWouldHold = !!('), 'legacy hold should be retained as diagnostic-only candidate');
  assert(source.includes('const shouldHold = false'), 'legacy seam-band manifest hold must be disabled');
  assert(source.includes('multi-file-seam-band-manifest-hold'), 'cleanup diagnostic must name removed manifest hold');
  assert(source.includes(PHASE), 'progress phase report marker missing');
  assert(diagSource.includes('lastManifestAdoptionGuard'), 'diagnostics must expose manifest adoption result');
  assert(diagSource.includes('lastProgressPhaseReport'), 'diagnostics must expose progress phase report');
  assert(report.includes('lastManifestAdoptionGuard'), 'anchor regression report must include manifest adoption diagnostic');

  global.window = { requestAnimationFrame(fn){ return setTimeout(fn, 0); }, cancelAnimationFrame(id){ clearTimeout(id); } };
  global.document = { createElement(){ return { classList: makeClassList(), dataset:{}, style:{}, appendChild(){}, setAttribute(){}, querySelector(){ return null; }, querySelectorAll(){ return []; } }; } };

  const layout = await import(pathToFileURL(layoutPath).href + `?smoke=${Date.now()}`);
  const coords = await import(pathToFileURL(coordsPath).href + `?smoke=${Date.now()}`);

  const reader = { scrollTop: 471, clientHeight: 700, scrollHeight: 1300, classList: makeClassList() };
  const app = {
    state: {
      current: {
        chunk: 5,
        totalChunks: 5,
        episode: { id:'ep5' },
        episodeIdx: 4,
        novel: { id:'novel', isMultiFile:true, episodes:[{ id:'ep1' }, { id:'ep2' }, { id:'ep3' }, { id:'ep4' }, { id:'ep5' }] }
      },
      loadedChunks: new Map([[4, true], [5, true]]),
      prefs: {}
    },
    els: { reader, content: { clientWidth:700, classList:makeClassList(), querySelectorAll(){ return []; } } }
  };
  const v = layout.ensureVirtualState(app);
  v.rows = [
    { id:'4:h', type:'header', chunk:4, title:'4화' },
    { id:'4:b:0', type:'body', chunk:4, blockIndex:0, globalBlockIndex:51, start:0, end:100, text:'four' },
    { id:'5:h', type:'header', chunk:5, title:'5화' },
    { id:'5:b:0', type:'body', chunk:5, blockIndex:0, globalBlockIndex:68, start:0, end:100, text:'five' }
  ];
  v.measureCache.set('4:h', 76); v.measureCache.set('4:b:0', 320); v.measureCache.set('5:h', 76); v.measureCache.set('5:b:0', 700);
  v.rowIndexesByChunk = new Map([[4, [0, 1]], [5, [2, 3]]]);
  coords.applyBlockManifest(app, {
    totalChunks: 5,
    totalBlocks: 100,
    chunks: [
      { chunk:1, blockStart:0, blockCount:17 },
      { chunk:2, blockStart:17, blockCount:17 },
      { chunk:3, blockStart:34, blockCount:17 },
      { chunk:4, blockStart:51, blockCount:17 },
      { chunk:5, blockStart:68, blockCount:32 }
    ]
  });
  v.userScrollActiveUntil = Date.now() + 1200;
  v.lastUserScrollSource = 'scroll';

  const address = layout.getViewportAddress(app);
  const diag = layout.getVirtualLayoutDiagnostics(app);
  assert(address.documentRatio > 0.67 && address.documentRatio < 0.71, `active manifest adoption should directly use manifest ratio after cleanup, got ${address.documentRatio}`);
  assert(diag.lastManifestAdoptionGuard?.held === false, 'legacy manifest hold should be disabled');
  assert(diag.lastManifestAdoptionGuard?.legacyWouldHold === true, 'legacy candidate should be recorded diagnostically');
  assert(diag.lastManifestAdoptionGuard?.cleanupPass === CLEANUP, 'cleanup pass must be recorded on manifest diagnostic');
  assert(diag.lastMultiFileGuardCleanup?.removedBehavior === 'multi-file-seam-band-manifest-hold', 'cleanup diagnostic must record removed manifest hold');
  assert(diag.lastProgressPhaseReport?.phase === 'manifest-adoption', 'phase report should record direct manifest adoption');

  console.log(JSON.stringify({ pass: PASS, marker: GUARD, cleanup: CLEANUP, ratio: address.documentRatio }));
})().catch(error => { console.error('[reader-progress-manifest-adoption-guard-smoke] failed:', error && error.stack || error); process.exit(1); });
