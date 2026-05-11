#!/usr/bin/env node
const { runModuleSmokeScript } = require('./smoke-child-runner.js');

const PASS = 'v398-search-cache-only-no-network-smoke-pass';

async function runSearchCacheOnlyNoNetworkSmoke(projectRoot) {
  if (!projectRoot) throw new Error('runSearchCacheOnlyNoNetworkSmoke requires projectRoot');
  const script = String.raw`
    globalThis.window = { dispatchEvent() {} };
    globalThis.CustomEvent = class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } };
    const { searchAllChunks, buildSearchCoveragePreview, SEARCH_CACHE_ONLY_CLIENT_UX_PASS } = await import('./public/scripts/rebuild/features/search/matcher.mjs');
    let networkCalls = 0;
    const controller = new AbortController();
    const current = {
      title: 'Smoke Novel',
      totalChunks: 3,
      novel: { id: 'novel-cache-only', title: 'Smoke Novel', episodes: [] },
      episode: null
    };
    const app = {
      api: {
        async content() {
          networkCalls += 1;
          throw new Error('cache-only search must not call content API');
        }
      },
      els: {
        nsearchStatus: { textContent: '' }
      },
      state: {
        current,
        loadedChunks: new Map([[1, { chunk: 1, title: 'Smoke Novel', content: 'alpha beta gamma', totalChunks: 3 }]]),
        chunkTextCache: new Map(),
        prefs: { preprocess: {} },
        search: { runId: 7, results: [], stats: null, lastStatsEventAt: 0, lastResultEventAt: 0 }
      }
    };
    const preview = await buildSearchCoveragePreview(app, current, { cacheOnly: true, maxChunks: 3 });
    if (preview.pass !== SEARCH_CACHE_ONLY_CLIENT_UX_PASS) throw new Error('cache-only preview pass marker missing');
    if (preview.searchableChunks !== 1 || preview.serverFreeMissingChunks !== 2) throw new Error('cache-only preview must count only loaded/cache chunks');
    await searchAllChunks(app, 'alpha', 7, controller.signal, { cacheOnly: true });
    if (networkCalls !== 0) throw new Error('cache-only search called network content API');
    if (app.state.search.results.length !== 1) throw new Error('cache-only search should scan loaded chunk');
    if (!app.state.search.stats || app.state.search.stats.mode !== 'cache-only') throw new Error('cache-only stats mode missing');
    if (app.state.search.stats.networkChunks !== 0) throw new Error('cache-only stats must not record network chunks');
    if (app.state.search.stats.skippedCacheOnlyChunks !== 2) throw new Error('cache-only stats must record skipped non-cached chunks');
    if (app.state.search.stats.cacheOnlyClientUxPass !== SEARCH_CACHE_ONLY_CLIENT_UX_PASS) throw new Error('cache-only stats marker missing');
  `;
  await runModuleSmokeScript(projectRoot, script, { label: 'search cache-only no-network smoke', timeoutMs: 8000 });
  return { pass: PASS };
}

if (require.main === module) {
  runSearchCacheOnlyNoNetworkSmoke(process.cwd()).then(result => {
    console.log(JSON.stringify(result));
  }).catch(error => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { PASS, runSearchCacheOnlyNoNetworkSmoke };
