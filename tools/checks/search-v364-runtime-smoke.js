#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');

const statusPanelSource = fs.readFileSync('public/scripts/rebuild/features/search/status-panel.mjs', 'utf8');
const matcherSource = fs.readFileSync('public/scripts/rebuild/features/search/matcher.mjs', 'utf8');
const searchSource = fs.readFileSync('public/scripts/rebuild/features/search.mjs', 'utf8');
const runnerSource = fs.readFileSync('tools/run_smoke_tests.js', 'utf8');

const PASS = 'v364-search-runtime-smoke-pass';

async function runStatusPanelSmoke() {
  const { updateSearchRetryBar } = await import('../../public/scripts/rebuild/features/search/status-panel.mjs');
  const coverage = { dataset:{}, textContent:'' };
  const retrybar = { hidden:false };
  const app = {
    els: {
      nsearchRetrybar: retrybar,
      nsearchAllchunks: { checked:false },
      nsearchCoverageSummary: coverage
    },
    state: {
      current: { totalChunks:1 },
      search: {
        running:false,
        results:[{ chunk:1 }],
        stats:null,
        lastJumpFailure:{ chunk:1, totalChunks:2, error:'boom', canRetry:true }
      }
    }
  };
  updateSearchRetryBar(app);
  assert.strictEqual(retrybar.hidden, false, 'retry bar must stay visible for jump failure');
  assert.strictEqual(coverage.dataset.searchJumpFailureRecoveryPass, 'v152-search-jump-failure-recovery-pass', 'jump failure marker must be assigned without ReferenceError');
}

async function runFullSearchProgressSmoke() {
  const { searchAllChunks } = await import('../../public/scripts/rebuild/features/search/matcher.mjs');
  const events = [];
  global.CustomEvent = class CustomEvent {
    constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
  };
  global.window = { dispatchEvent(event) { events.push(event); } };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  let active = 0;
  let maxActive = 0;
  const novel = {
    id:'novel-v364',
    title:'Search Novel',
    episodes:[
      { id:'ep-1', title:'1화', totalChunks:1 },
      { id:'ep-2', title:'2화', totalChunks:5 }
    ]
  };
  const current = { novel, episode: novel.episodes[0], episodeIdx:0, chunk:1, totalChunks:1, title:'Search Novel · 1화' };
  const app = {
    els: { nsearchStatus:{ textContent:'' } },
    api: {
      async content({ episodeId, chunk }) {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await sleep(8);
        active -= 1;
        return {
          currentChunk:chunk,
          totalChunks:episodeId === 'ep-2' ? 5 : 1,
          title:episodeId,
          content:chunk % 2 ? `needle ${episodeId} ${chunk}` : `plain ${episodeId} ${chunk}`
        };
      }
    },
    state: {
      current,
      loadedChunks:new Map(),
      loadingChunks:new Set(),
      chunkTextCache:new Map(),
      prefs:{ readerCache:false, preprocess:{} },
      search:{ runId:64, results:[], stats:null }
    }
  };
  await searchAllChunks(app, 'needle', 64, new AbortController().signal, { cacheOnly:false });
  const resultEvents = events.filter(event => event.type === 'txt-reader-search-results');
  assert.ok(maxActive > 1, 'non-live episode full scan should use bounded concurrent fetches');
  assert.ok(resultEvents.length >= 1, 'full scan must publish incremental/final result events');
  assert.strictEqual(app.state.search.incrementalResultsPass, 'v364-search-incremental-results-pass', 'incremental result marker must be stored');
  assert.strictEqual(app.state.search.concurrentFetchPass, 'v364-search-concurrent-fetch-pass', 'concurrent fetch marker must be stored');
  assert.ok(app.state.search.results.some(result => result.episodeId === 'ep-2'), 'results must include non-current episode matches');
}

(async () => {
  assert.ok(statusPanelSource.includes("const SEARCH_JUMP_FAILURE_RECOVERY_PASS = 'v152-search-jump-failure-recovery-pass'"), 'status panel must define jump failure marker locally');
  assert.ok(statusPanelSource.includes("const SEARCH_LIVE_FIELD_VALIDATION_PASS = 'v153-search-live-field-validation-pass'"), 'status panel must define live field validation marker locally');
  assert.ok(matcherSource.includes('v364-search-incremental-results-pass'), 'matcher must expose v364 incremental results marker');
  assert.ok(matcherSource.includes('v364-search-concurrent-fetch-pass'), 'matcher must expose v364 concurrent fetch marker');
  assert.ok(searchSource.includes("txt-reader-search-results"), 'search UI must listen for incremental result updates');
  assert.ok(runnerSource.includes("nodeCmd('tools/checks/search-v364-runtime-smoke.js')"), 'smoke runner must include v364 search runtime smoke');
  await runStatusPanelSmoke();
  await runFullSearchProgressSmoke();
  console.log(PASS);
})().catch(error => {
  console.error(error && (error.stack || error.message || String(error)));
  process.exit(1);
});
