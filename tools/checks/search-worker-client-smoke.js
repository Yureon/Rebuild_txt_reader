#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const { runModuleSmokeScript } = require('./smoke-child-runner.js');

const PASS = 'v399-search-worker-client-smoke-pass';

async function runSearchWorkerClientSmoke(projectRoot) {
  if (!projectRoot) throw new Error('runSearchWorkerClientSmoke requires projectRoot');
  const matcherSource = fs.readFileSync(`${projectRoot}/public/scripts/rebuild/features/search/matcher.mjs`, 'utf8');
  const workerSource = fs.readFileSync(`${projectRoot}/public/scripts/rebuild/features/search/search-worker.js`, 'utf8');
  assert.ok(matcherSource.includes("v399-search-worker-client-pass"), 'matcher must expose v399 worker marker');
  assert.ok(matcherSource.includes("search-worker.js?v=rebuild-v564"), 'matcher must point at current worker script');
  assert.ok(workerSource.includes("v399-search-worker-client-pass"), 'worker must expose v399 worker marker');
  assert.ok(workerSource.includes('self.onmessage'), 'worker must listen for match messages');

  const script = String.raw`
    globalThis.CustomEvent = class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } };
    globalThis.window = { dispatchEvent() {} };
    let workerCreated = 0;
    let workerMessages = 0;
    globalThis.Worker = class MockSearchWorker {
      constructor(url, options = {}) {
        this.url = String(url || '');
        this.options = options;
        workerCreated += 1;
      }
      postMessage(message) {
        workerMessages += 1;
        const query = String(message.query || '');
        const results = [];
        for (const chunk of Array.isArray(message.chunks) ? message.chunks : []) {
          const text = String(chunk.content || '');
          const index = text.toLowerCase().indexOf(query.toLowerCase());
          if (query && index >= 0) {
            results.push({
              novelId: chunk.novelId || '',
              episodeId: chunk.episodeId == null ? null : chunk.episodeId,
              episodeTitle: chunk.episodeTitle || '',
              episodeIndex: Number(chunk.episodeIndex) || 0,
              episodeCount: Number(chunk.episodeCount) || 1,
              chunk: Number(chunk.chunk) || 1,
              totalChunks: Number(chunk.totalChunks) || 1,
              index,
              title: chunk.title || '',
              excerpt: text.slice(Math.max(0, index - 3), index + query.length + 3),
              query,
              matchLength: query.length,
              source: chunk.__searchSource || chunk.source || '',
              textLength: text.length,
              resultFieldValidationPass: 'v151-search-result-field-validation-pass',
              searchWorkerClientPass: 'v399-search-worker-client-pass'
            });
          }
        }
        queueMicrotask(() => this.onmessage && this.onmessage({ data: { id: message.id, type: 'result', ok: true, pass: 'v399-search-worker-client-pass', results } }));
      }
      terminate() {}
    };
    const { searchAllChunks, SEARCH_WORKER_CLIENT_PASS } = await import('./public/scripts/rebuild/features/search/matcher.mjs');
    const current = {
      title: 'Worker Smoke',
      totalChunks: 2,
      novel: { id: 'worker-smoke-novel', title: 'Worker Smoke', episodes: [] },
      episode: null
    };
    const app = {
      api: { async content() { throw new Error('cache-only worker smoke must not call network'); } },
      els: { nsearchStatus: { textContent: '' } },
      state: {
        current,
        loadedChunks: new Map([[1, { chunk: 1, title: 'Worker Smoke', content: 'alpha worker needle', totalChunks: 2 }]]),
        chunkTextCache: new Map(),
        prefs: { preprocess: {} },
        search: { runId: 99, results: [], stats: null, lastStatsEventAt: 0, lastResultEventAt: 0 }
      }
    };
    await searchAllChunks(app, 'needle', 99, new AbortController().signal, { cacheOnly: true });
    if (!workerCreated || !workerMessages) throw new Error('search worker was not used');
    if (!app.state.search.results.length) throw new Error('worker search did not produce a result');
    if (app.state.search.results[0].searchWorkerClientPass !== SEARCH_WORKER_CLIENT_PASS) throw new Error('worker result marker missing');
    if (app.state.search.stats.searchWorkerClientPass !== SEARCH_WORKER_CLIENT_PASS) throw new Error('worker stats marker missing');
    if (app.state.search.stats.workerChunks !== 1) throw new Error('worker chunk count must be 1');
    if (app.state.search.stats.workerFallbacks !== 0) throw new Error('worker fallback should not be used in happy path');
  `;
  await runModuleSmokeScript(projectRoot, script, { label: 'search worker client smoke', timeoutMs: 8000 });
  return { pass: PASS };
}

if (require.main === module) {
  runSearchWorkerClientSmoke(process.cwd()).then(result => {
    console.log(JSON.stringify(result));
  }).catch(error => {
    console.error(error && (error.stack || error.message || String(error)));
    process.exit(1);
  });
}

module.exports = { PASS, runSearchWorkerClientSmoke };
