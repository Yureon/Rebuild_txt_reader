#!/usr/bin/env node
const assert = require('assert');
const path = require('path');
const { runModuleSmokeScript } = require('./smoke-child-runner.js');
const PASS = 'v565-reader-virtual-layout-cache-smoke-pass';
(async () => {
  const root = path.resolve(__dirname, '../..');
  const script = String.raw`
    globalThis.window = { cancelAnimationFrame(){}, clearTimeout(){}, clearInterval(){}, requestAnimationFrame(fn){ return 1; }, setTimeout(){ return 1; } };
    const mod = await import('./public/scripts/rebuild/features/reader/virtual-layout.mjs');
    const classList = { add(){}, remove(){}, toggle(){} };
    const app = { state:{ readerVirtual:null, prefs:{} }, els:{ reader:{ classList, clientHeight:800, scrollTop:0 }, content:{ classList, clientWidth:700 } } };
    const v = mod.ensureVirtualState(app);
    v.rows = [{ id:'r1', type:'body', text:'hello world', chunk:1, blockIndex:0 }];
    v.layoutRevision += 1;
    mod.recalcVirtualLayout(app);
    const recalcs = v.layoutRecalcCount;
    mod.recalcVirtualLayout(app);
    if (v.layoutRecalcCount !== recalcs) throw new Error('unchanged layout must not be recomputed');
    if (v.layoutCacheHits < 1) throw new Error('layout cache hit was not recorded');
    if (v.prefix.length !== 2 || v.heights.length !== 1) throw new Error('layout arrays invalid');
  `;
  await runModuleSmokeScript(root, script, { label:'reader virtual layout cache smoke', timeoutMs:8000 });
  console.log(JSON.stringify({ pass: PASS }));
})().catch(error => { console.error(error); process.exit(1); });
