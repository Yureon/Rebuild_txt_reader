#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const PASS = 'v522-reader-multifile-90-manifest-hold-cleanup-smoke-pass';
const CLEANUP = 'v522-reader-multi-file-guard-cleanup-pass';
function assert(condition, message) { if (!condition) throw new Error(message); }
function makeClassList() { return { add(){}, remove(){}, contains(){ return false; } }; }
function setupDom() { global.window = { requestAnimationFrame(fn){ return setTimeout(fn, 0); }, cancelAnimationFrame(id){ clearTimeout(id); } }; global.document = { createElement(){ return { classList: makeClassList(), dataset:{}, style:{}, appendChild(){}, setAttribute(){}, querySelector(){ return null; }, querySelectorAll(){ return []; } }; } }; }

async function runCase({ active, scrollRatio, label }) {
  const nonce = `${Date.now()}-${Math.random()}-${label}`;
  const layoutPath = path.resolve(__dirname, '../../public/scripts/rebuild/features/reader/virtual-layout.mjs');
  const coordsPath = path.resolve(__dirname, '../../public/scripts/rebuild/features/reader/coordinates.mjs');
  const layout = await import(pathToFileURL(layoutPath).href + `?smoke=${nonce}`);
  const coords = await import(pathToFileURL(coordsPath).href + `?smoke=${nonce}`);
  const bodyTop = 472; const bodyHeight = 700;
  const reader = { scrollTop: Math.round(bodyTop - 36 + bodyHeight * scrollRatio), clientHeight: 700, scrollHeight: 1300, classList: makeClassList() };
  const app = { state: { current: { chunk: 5, totalChunks: 5, episode: { id:'ep5' }, episodeIdx: 4, novel: { id:'novel', isMultiFile:true, episodes:[{ id:'ep1' }, { id:'ep2' }, { id:'ep3' }, { id:'ep4' }, { id:'ep5' }] } }, loadedChunks: new Map([[4, true], [5, true]]), prefs: {} }, els: { reader, content: { clientWidth:700, classList:makeClassList(), querySelectorAll(){ return []; } } } };
  const v = layout.ensureVirtualState(app);
  v.rows = [{ id:'4:h', type:'header', chunk:4, title:'4화' }, { id:'4:b:0', type:'body', chunk:4, blockIndex:0, globalBlockIndex:51, start:0, end:100, text:'four' }, { id:'5:h', type:'header', chunk:5, title:'5화' }, { id:'5:b:0', type:'body', chunk:5, blockIndex:0, globalBlockIndex:68, start:0, end:100, text:'five' }];
  v.measureCache.set('4:h', 76); v.measureCache.set('4:b:0', 320); v.measureCache.set('5:h', 76); v.measureCache.set('5:b:0', 700);
  v.rowIndexesByChunk = new Map([[4, [0, 1]], [5, [2, 3]]]);
  coords.applyBlockManifest(app, { totalChunks: 5, totalBlocks: 100, chunks: [{ chunk:1, blockStart:0, blockCount:17 }, { chunk:2, blockStart:17, blockCount:17 }, { chunk:3, blockStart:34, blockCount:17 }, { chunk:4, blockStart:51, blockCount:17 }, { chunk:5, blockStart:68, blockCount:32 }] });
  v.userScrollActiveUntil = active ? Date.now() + 1200 : 0;
  v.lastUserScrollSource = active ? 'scroll' : '';
  const address = layout.getViewportAddress(app);
  const diag = layout.getVirtualLayoutDiagnostics(app);
  return { address, diag };
}

(async () => {
  const layoutPath = path.resolve(__dirname, '../../public/scripts/rebuild/features/reader/virtual-layout.mjs');
  const source = fs.readFileSync(layoutPath, 'utf8');
  assert(source.includes("const shouldHold = false"), 'late multi-file manifest hold must be disabled by v522 cleanup');
  assert(source.includes(CLEANUP), 'cleanup marker missing');
  setupDom();
  const active90 = await runCase({ active:true, scrollRatio:0.50, label:'active90' });
  assert(active90.diag.lastManifestAdoptionGuard?.held === false, 'active 90% multi-file scroll should not hold fallback after cleanup');
  assert(active90.diag.lastManifestAdoptionGuard?.legacyWouldHold === true, 'legacy 90% hold candidate should be recorded diagnostically');
  assert(active90.diag.lastManifestAdoptionGuard?.cleanupPass === CLEANUP, 'cleanup pass should be recorded');
  assert(active90.address.documentRatio > 0.83 && active90.address.documentRatio < 0.86, `active 90% should directly adopt manifest near 84%, got ${active90.address.documentRatio}`);
  const active98 = await runCase({ active:true, scrollRatio:0.90, label:'active98' });
  assert(active98.diag.lastManifestAdoptionGuard?.held === false, 'near-terminal active reader should still adopt manifest directly');
  console.log(JSON.stringify({ pass: PASS, cleanup: CLEANUP, active90: active90.address.documentRatio, active98: active98.address.documentRatio }));
})().catch(error => { console.error('[reader-multifile-90-manifest-hold-smoke] failed:', error && error.stack || error); process.exit(1); });
