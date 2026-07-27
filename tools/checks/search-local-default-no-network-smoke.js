#!/usr/bin/env node
const fs = require('fs');
const assert = require('assert');
const { runModuleSmokeScript } = require('./smoke-child-runner.js');

const PASS = 'v411-search-local-default-no-network-pass';

async function runSearchLocalDefaultNoNetworkSmoke(projectRoot) {
  const shell = fs.readFileSync(`${projectRoot}/public/fragments/app-shell.html`, 'utf8') + '\n' + fs.readFileSync(`${projectRoot}/public/fragments/deferred-ui.html`, 'utf8');
  const elements = fs.readFileSync(`${projectRoot}/public/scripts/rebuild/features/ui/elements.mjs`, 'utf8');
  const runActions = fs.readFileSync(`${projectRoot}/public/scripts/rebuild/features/search/run-actions.mjs`, 'utf8');
  const searchSource = fs.readFileSync(`${projectRoot}/public/scripts/rebuild/features/search.mjs`, 'utf8');
  assert.ok(shell.includes('nsearch-mode-toggle'), 'search full-search toggle UI missing');
  assert.ok(shell.includes('OFF: 표시중/캐시만 · ON: 서버 전체 검색'), 'search toggle copy missing');
  assert.ok(!shell.includes('nsearch-case'), 'case-sensitive checkbox must be removed');
  assert.ok(!shell.includes('nsearch-cache-only'), 'cache-only checkbox must be removed');
  assert.ok(!elements.includes('nsearch-case') && !elements.includes('nsearch-cache-only'), 'removed search controls must not be collected');
  assert.ok(runActions.includes('const cacheOnly = !allChunks'), 'default unchecked full-search must map to cache-only');
  assert.ok(searchSource.includes('await searchAllChunks(app, request.query, request.runId, request.controller.signal, { cacheOnly: request.cacheOnly });'), 'runSearch must route default mode through cache-only full scan');

  const script = String.raw`
    globalThis.window = { dispatchEvent() {} };
    globalThis.CustomEvent = class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } };
    const { buildSearchRunRequest } = await import('./public/scripts/rebuild/features/search/run-actions.mjs');
    const { searchAllChunks } = await import('./public/scripts/rebuild/features/search/matcher.mjs');
    const current = { title:'Local Default', totalChunks:2, novel:{ id:'local-default', title:'Local Default', episodes:[] }, episode:null };
    let networkCalls = 0;
    const app = {
      api:{ async content(){ networkCalls += 1; throw new Error('default search must not call network'); } },
      els:{ nsearchInput:{ value:'needle' }, nsearchAllchunks:{ checked:false }, nsearchStatus:{ textContent:'' } },
      state:{ current, loadedChunks:new Map([[1,{ chunk:1, content:'needle cached', totalChunks:2, title:'Local Default' }]]), chunkTextCache:new Map(), prefs:{ preprocess:{} }, search:{ runId:1, results:[], abortController:null, stats:null } }
    };
    const request = buildSearchRunRequest(app);
    if (!request.cacheOnly || request.allChunks) throw new Error('unchecked full-search must create cache-only request');
    app.state.search.runId = request.runId;
    await searchAllChunks(app, request.query, request.runId, request.controller.signal, { cacheOnly: request.cacheOnly });
    if (networkCalls !== 0) throw new Error('default cache search called network');
    if (app.state.search.results.length !== 1) throw new Error('default cache search should find loaded chunk');
    if (app.state.search.stats.mode !== 'cache-only') throw new Error('default search stats must be cache-only');
  `;
  await runModuleSmokeScript(projectRoot, script, { label: 'search local default no-network smoke', timeoutMs: 8000 });
  return { pass: PASS };
}

if (require.main === module) {
  runSearchLocalDefaultNoNetworkSmoke(process.cwd()).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exit(1); });
}
module.exports = { PASS, runSearchLocalDefaultNoNetworkSmoke };
