#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const PASS = 'v522-reader-append-seam-70-85-progress-cleanup-smoke-pass';
const LEGACY = 'v448-reader-append-seam-70-85-fixture-pass';
const CLEANUP = 'v522-reader-multi-file-guard-cleanup-pass';
function assert(condition, message) { if (!condition) throw new Error(message); }
function makeClassList() { return { add(){}, remove(){}, contains(){ return false; } }; }

async function runCase({ fallbackTarget, scrollRatio, visibleChunk }) {
  const layoutPath = path.resolve(__dirname, '../../public/scripts/rebuild/features/reader/virtual-layout.mjs');
  const coordsPath = path.resolve(__dirname, '../../public/scripts/rebuild/features/reader/coordinates.mjs');
  const layout = await import(pathToFileURL(layoutPath).href + `?smoke=${Date.now()}-${fallbackTarget}`);
  const coords = await import(pathToFileURL(coordsPath).href + `?smoke=${Date.now()}-${fallbackTarget}`);
  const bodyHeight = visibleChunk === 4 ? 320 : 700;
  const bodyTop = visibleChunk === 4 ? 76 : 472;
  const reader = { scrollTop: Math.round(bodyTop - 36 + bodyHeight * scrollRatio), clientHeight: 700, scrollHeight: 1300, classList: makeClassList() };
  const app = { state: { current: { chunk: visibleChunk, totalChunks: 5, episode: { id:'ep5' }, episodeIdx: 4, novel: { id:'novel', isMultiFile:true, episodes:[{ id:'ep1' }, { id:'ep2' }, { id:'ep3' }, { id:'ep4' }, { id:'ep5' }] } }, loadedChunks: new Map([[4, true], [5, true]]), prefs: {} }, els: { reader, content: { clientWidth:700, classList:makeClassList(), querySelectorAll(){ return []; } } } };
  const v = layout.ensureVirtualState(app);
  v.rows = [{ id:'4:h', type:'header', chunk:4, title:'4화' }, { id:'4:b:0', type:'body', chunk:4, blockIndex:0, globalBlockIndex:51, start:0, end:100, text:'four' }, { id:'5:h', type:'header', chunk:5, blockIndex:0, title:'5화' }, { id:'5:b:0', type:'body', chunk:5, blockIndex:0, globalBlockIndex:68, start:0, end:100, text:'five' }];
  v.measureCache.set('4:h', 76); v.measureCache.set('4:b:0', 320); v.measureCache.set('5:h', 76); v.measureCache.set('5:b:0', 700);
  v.rowIndexesByChunk = new Map([[4, [0, 1]], [5, [2, 3]]]);
  coords.applyBlockManifest(app, { totalChunks: 5, totalBlocks: 100, chunks: [{ chunk:1, blockStart:0, blockCount:17 }, { chunk:2, blockStart:17, blockCount:17 }, { chunk:3, blockStart:34, blockCount:17 }, { chunk:4, blockStart:51, blockCount:17 }, { chunk:5, blockStart:68, blockCount:32 }] });
  v.userScrollActiveUntil = Date.now() + 1200;
  v.lastUserScrollSource = 'scroll';
  const address = layout.getViewportAddress(app);
  const diag = layout.getVirtualLayoutDiagnostics(app);
  assert(diag.lastManifestAdoptionGuard?.held === false, `legacy 70-85 hold should be disabled for ${fallbackTarget}`);
  assert(diag.lastManifestAdoptionGuard?.legacyWouldHold === true, `legacy hold candidate should be diagnostic-only for ${fallbackTarget}`);
  assert(diag.lastManifestAdoptionGuard?.cleanupPass === CLEANUP, 'cleanup pass missing');
  assert(diag.lastAppendSeam7085Fixture == null, 'legacy 70-85 fixture payload should no longer be emitted');
  assert(diag.lastManifestAdoptionGuard?.manifestDocumentRatio === address.documentRatio, 'document ratio should adopt manifest directly after cleanup');
  return { fallbackTarget, actual: address.documentRatio, fallback: diag.lastManifestAdoptionGuard.fallbackDocumentRatio, manifest: diag.lastManifestAdoptionGuard.manifestDocumentRatio };
}

(async () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../public/scripts/rebuild/features/reader/virtual-layout.mjs'), 'utf8');
  assert(source.includes(LEGACY), 'legacy 70-85 marker may remain for old diagnostics compatibility');
  assert(source.includes(CLEANUP), 'cleanup marker missing');
  assert(source.includes('if (false && Number(report.fallbackDocumentRatio) >= 0.68'), 'legacy 70-85 fixture emission should be disabled');
  global.window = { requestAnimationFrame(fn){ return setTimeout(fn, 0); }, cancelAnimationFrame(id){ clearTimeout(id); } };
  global.document = { createElement(){ return { classList: makeClassList(), dataset:{}, style:{}, appendChild(){}, setAttribute(){}, querySelector(){ return null; }, querySelectorAll(){ return []; } }; } };
  const results = [];
  results.push(await runCase({ fallbackTarget: 0.70, scrollRatio: 0.50, visibleChunk: 4 }));
  results.push(await runCase({ fallbackTarget: 0.80, scrollRatio: 0.00, visibleChunk: 5 }));
  results.push(await runCase({ fallbackTarget: 0.85, scrollRatio: 0.25, visibleChunk: 5 }));
  console.log(JSON.stringify({ pass: PASS, cleanup: CLEANUP, results }));
})().catch(error => { console.error('[reader-append-seam-70-85-progress-fixture-smoke] failed:', error && error.stack || error); process.exit(1); });
