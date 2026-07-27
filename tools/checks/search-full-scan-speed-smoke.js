#!/usr/bin/env node
const assert = require('assert');
const { CURRENT_REBUILD_VERSION } = require('./current-rebuild-version');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const matcher = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/search/matcher.mjs'), 'utf8');
const profile = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/search/search-performance-profile.mjs'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/search/search-worker.js'), 'utf8');
const docs = fs.readFileSync(path.join(root, 'docs/performance-cache.md'), 'utf8');
const smokeDocs = fs.readFileSync(path.join(root, 'docs/smoke-tests.md'), 'utf8');
const runner = fs.readFileSync(path.join(root, 'tools/run_smoke_tests.js'), 'utf8');
const PASS = 'v509-search-adaptive-performance-smoke-pass';

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function runLiveSingleFileConcurrencySmoke() {
  try { Object.defineProperty(globalThis, 'navigator', { value: { hardwareConcurrency: 8, deviceMemory: 8 }, configurable: true }); } catch {}
  const { searchAllChunks } = await import('../../public/scripts/rebuild/features/search/matcher.mjs');
  global.window = { dispatchEvent() {}, addEventListener() {}, removeEventListener() {} };
  let active = 0;
  let maxActive = 0;
  const current = { novel:{ id:'single-smoke', title:'Single Smoke' }, episode:null, episodeIdx:0, chunk:1, totalChunks:12, title:'Single Smoke' };
  const app = {
    els: { nsearchStatus:{ textContent:'' } },
    api: { async content({ chunk }, options = {}) {
        assert.strictEqual(options?.headers?.['X-Search-Scan'], '1', 'full search content requests must carry X-Search-Scan header');
        active += 1; maxActive = Math.max(maxActive, active); await delay(2); active -= 1; return { currentChunk:chunk, totalChunks:12, title:'Single Smoke', content: chunk % 3 === 0 ? 'needle' : 'plain' };
      } },
    state: {
      current,
      loadedChunks:new Map(),
      loadingChunks:new Set(),
      chunkTextCache:new Map(),
      prefs:{ readerCache:false, preprocess:{} },
      search:{ runId:509, results:[], stats:null }
    }
  };
  await searchAllChunks(app, 'needle', 509, new AbortController().signal, { cacheOnly:false });
  assert.ok(maxActive >= 2, 'adaptive live search must not fetch chunks strictly one by one on normal clients');
  assert.ok(app.state.search.stats.liveFullScanConcurrency >= 1 && app.state.search.stats.liveFullScanConcurrency <= 3, 'live concurrency must stay inside server-friendly adaptive bounds');
  assert.ok(app.state.search.stats.fullScanConcurrency >= 1 && app.state.search.stats.fullScanConcurrency <= 3, 'full concurrency must stay inside server-friendly adaptive bounds');
  assert.strictEqual(app.state.search.stats.adaptiveSearchProfilePass, 'v509-search-adaptive-profile-pass', 'stats must expose adaptive profile marker');
  assert.strictEqual(app.state.search.stats.searchServerLoadMitigationPass, 'v549-search-auto-server-profile-pass', 'stats must expose v549 auto server search profile marker');
  assert.ok(app.state.search.stats.searchScanContentRequests > 0, 'stats must count search scan content requests');
}

(async () => {
  assert.ok(matcher.includes("SEARCH_FULL_SCAN_CONCURRENCY_TUNE_PASS = 'v509-search-full-scan-adaptive-concurrency-pass'"), 'adaptive full scan marker missing');
  assert.ok(matcher.includes("SEARCH_LIVE_FULL_SCAN_CONCURRENCY_PASS = 'v509-search-live-adaptive-concurrency-pass'"), 'adaptive live scan marker missing');
  assert.ok(matcher.includes("SEARCH_MULTI_EPISODE_TARGET_CONCURRENCY_PASS = 'v509-search-multi-episode-adaptive-concurrency-pass'"), 'adaptive multi-episode marker missing');
  assert.ok(matcher.includes("SEARCH_WORKER_BATCH_SIZE_TUNE_PASS = 'v509-search-worker-adaptive-batch-pass'"), 'adaptive worker batch marker missing');
  assert.ok(profile.includes("SEARCH_ADAPTIVE_PROFILE_PASS = 'v509-search-adaptive-profile-pass'"), 'adaptive profile module marker missing');
  assert.ok(profile.includes('nav?.hardwareConcurrency'), 'adaptive profile must consider hardwareConcurrency');
  assert.ok(profile.includes('nav?.deviceMemory'), 'adaptive profile must consider deviceMemory when available');
  assert.ok(profile.includes('recordSearchAdaptiveFeedback'), 'adaptive feedback helper missing');
  assert.ok(profile.includes('SEARCH_ADAPTIVE_INPUT_PRESSURE_PASS'), 'input pressure marker missing');
  assert.ok(profile.includes("SEARCH_SERVER_LOAD_MITIGATION_PASS = 'v549-search-auto-server-profile-pass'"), 'server-load mitigation marker missing');
  assert.ok(profile.includes('full: { min: 1, max: 3, step: 1 }'), 'full search concurrency must remain bounded while using the v549 auto profile default bounds');
  assert.ok(profile.includes('multi: { min: 1, max: 2, step: 1 }'), 'multi-episode search concurrency must remain bounded with the v549 auto profile default bounds');
  assert.ok(matcher.includes("SEARCH_SCAN_REQUEST_HEADER = 'X-Search-Scan'"), 'search scan request header marker missing');
  assert.ok(matcher.includes('recordSearchAdaptiveFeedback(app, { kind:\'fetch\''), 'fetch feedback must be recorded');
  assert.ok(matcher.includes('recordSearchAdaptiveFeedback(app, { kind:\'worker\''), 'worker feedback must be recorded');
  assert.ok(matcher.includes(`SEARCH_WORKER_SCRIPT_URL = '/scripts/rebuild/features/search/search-worker.js?v=${CURRENT_REBUILD_VERSION}'`), 'worker URL must be cache-busted to v549');
  assert.ok(worker.includes("SEARCH_WORKER_BATCH_SIZE_TUNE_PASS = 'v509-search-worker-adaptive-batch-pass'"), 'worker must expose adaptive batch marker');
  assert.ok(worker.includes('elapsedMs'), 'worker must report elapsedMs feedback');
  assert.ok(docs.includes('v509-search-adaptive-profile-pass'), 'performance docs must record adaptive search profile');
  assert.ok(smokeDocs.includes('search-full-scan-speed-smoke.js'), 'smoke docs must mention search speed smoke');
  assert.ok(runner.includes("nodeCmd('tools/checks/search-full-scan-speed-smoke.js')"), 'search smoke group must include speed smoke');
  await runLiveSingleFileConcurrencySmoke();
  console.log(JSON.stringify({ pass: PASS }));
})().catch(error => {
  console.error(error && (error.stack || error.message || String(error)));
  process.exit(1);
});
