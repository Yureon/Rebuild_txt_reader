#!/usr/bin/env node
const fs=require('fs'); const assert=require('assert');
for(const page of ['public/library.html','public/site.html','public/mobile.html']){
  const html=fs.readFileSync(page,'utf8');
  const preloads=[...html.matchAll(/<link\s+rel="modulepreload"\s+href="([^"]+)"/g)].map(m=>m[1]);
  for(const critical of ['/scripts/rebuild/core/user-scope-bootstrap.mjs','/scripts/rebuild/features/lazy-features.mjs','/scripts/rebuild/features/library.mjs'])
    assert.ok(preloads.includes(critical),`${page} must preload ${critical}`);
  assert.ok(!preloads.includes('/scripts/rebuild/features/settings/appearance.mjs'),`${page} must defer appearance runtime`);
  assert.ok(preloads.includes('/scripts/rebuild/main.mjs'),`${page} must preload main`);
  assert.ok(preloads.includes('/scripts/rebuild/core/app-shell.mjs'),`${page} must preload app shell`);
  assert.ok(preloads.length<=9,`${page} critical preload count too high: ${preloads.length}`);
}
console.log(JSON.stringify({pass:'v614-critical-preload-budget-smoke-pass'}));
