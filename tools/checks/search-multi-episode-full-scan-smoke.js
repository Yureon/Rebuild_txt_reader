#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');

const matcher = fs.readFileSync('public/scripts/rebuild/features/search/matcher.mjs', 'utf8');
const search = fs.readFileSync('public/scripts/rebuild/features/search.mjs', 'utf8');
const reader = fs.readFileSync('public/scripts/rebuild/features/reader.mjs', 'utf8');
const nav = fs.readFileSync('public/scripts/rebuild/features/reader/navigation-intent.mjs', 'utf8');
const runner = fs.readFileSync('tools/run_smoke_tests.js', 'utf8');

const PASS = 'v363-search-multi-episode-full-scan-smoke-pass';
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function runDynamicMatcherSmoke() {
  try { Object.defineProperty(globalThis, 'navigator', { value: { hardwareConcurrency: 8, deviceMemory: 8 }, configurable: true }); } catch {}
  const { searchAllChunks } = await import('../../public/scripts/rebuild/features/search/matcher.mjs');
  global.window = { dispatchEvent() {}, addEventListener() {}, removeEventListener() {} };
  const novel = { id:'novel-smoke', title:'Smoke Novel', episodes:[{ id:'ep-1', title:'1화' }, { id:'ep-2', title:'2화' }, { id:'ep-3', title:'3화' }] };
  const current = { novel, episode: novel.episodes[0], episodeIdx:0, chunk:1, totalChunks:1, title:'Smoke Novel · 1화' };
  const payloads = {
    'ep-1:1': { currentChunk:1, totalChunks:2, title:'1화', content:'needle first' },
    'ep-1:2': { currentChunk:2, totalChunks:2, title:'1화', content:'no match' },
    'ep-2:1': { currentChunk:1, totalChunks:2, title:'2화', content:'needle second' },
    'ep-2:2': { currentChunk:2, totalChunks:2, title:'2화', content:'tail needle' },
    'ep-3:1': { currentChunk:1, totalChunks:2, title:'3화', content:'needle third' },
    'ep-3:2': { currentChunk:2, totalChunks:2, title:'3화', content:'plain' }
  };
  let activeEpisodes = 0;
  let maxActiveEpisodes = 0;
  const app = {
    els: { nsearchStatus:{ textContent:'' } },
    api: { async content({ episodeId, chunk }, options = {}) {
      assert.strictEqual(options?.headers?.['X-Search-Scan'], '1', 'multi-episode full search content requests must carry X-Search-Scan header');
      activeEpisodes += 1; maxActiveEpisodes = Math.max(maxActiveEpisodes, activeEpisodes); await delay(2); activeEpisodes -= 1; return payloads[`${episodeId}:${chunk}`];
    } },
    state: {
      current,
      loadedChunks:new Map(),
      loadingChunks:new Set(),
      chunkTextCache:new Map(),
      prefs:{ readerCache:false, preprocess:{} },
      search:{ runId:7, results:[], stats:null }
    }
  };
  await searchAllChunks(app, 'needle', 7, new AbortController().signal, { cacheOnly:false });
  assert.strictEqual(app.state.search.results.length, 4, 'multi-episode full scan must collect matches from all episodes');
  assert.deepStrictEqual(app.state.search.results.map(result => result.episodeId), ['ep-1', 'ep-2', 'ep-2', 'ep-3'], 'results must retain target episode id');
  assert.strictEqual(maxActiveEpisodes, 1, 'multi-episode full scan must serialize target content requests for server CPU control');
  assert.strictEqual(app.state.search.stats.multiEpisodeTargetConcurrency, 1, 'stats must expose serialized multi-episode target concurrency');
  assert.strictEqual(app.state.search.stats.searchScope, 'novel-episodes', 'stats must record novel episode search scope');
  assert.strictEqual(app.state.search.stats.totalChunks, 6, 'stats total chunks must expand across all episodes');
  assert.strictEqual(app.state.search.stats.searchServerLoadMitigationPass, 'v539-search-server-load-mitigation-pass', 'stats must expose v539 server-load mitigation marker');
}

(async () => {
  assert.ok(matcher.includes('v363-search-multi-episode-full-scan-pass'), 'matcher must expose v363 multi-episode full scan marker');
  assert.ok(matcher.includes('function buildSearchScopeContexts(current)'), 'matcher must build per-episode search contexts');
  assert.ok(matcher.includes("stats.searchScope = targets.length > 1 ? 'novel-episodes' : 'current-episode'"), 'all chunks search must switch to novel episode scope');
  assert.ok(matcher.includes('episodeId:c.episode?.id || null'), 'network scan must use each target episode id');
  assert.ok(matcher.includes('searchRootCurrent'), 'multi-episode scanning must guard against reader context changes without requiring target episode to be current');
  assert.ok(matcher.includes('SEARCH_MULTI_EPISODE_TARGET_CONCURRENCY'), 'multi-episode search must expose target concurrency');
  assert.ok(matcher.includes('SEARCH_MULTI_EPISODE_TARGET_CONCURRENCY_MAX = 1'), 'multi-episode search concurrency must be serialized at 1');
  assert.ok(matcher.includes("SEARCH_SCAN_REQUEST_HEADER = 'X-Search-Scan'"), 'multi-episode search must mark server search-scan content requests');
  assert.ok(matcher.includes('Number(a.episodeIndex)'), 'search result ordering must sort by episode index before chunk');
  assert.ok(search.includes('v363-search-multi-episode-result-jump-pass'), 'search jump validation must expose multi-episode result marker');
  assert.ok(search.includes('targetEpisode = episodes.find'), 'search validation must allow results from another episode in the same novel');
  assert.ok(reader.includes('v363-reader-search-multi-episode-jump-pass'), 'reader must expose multi-episode search jump marker');
  assert.ok(reader.includes('preserveSearchSession: true'), 'reader search jump must preserve search session while opening another episode');
  assert.ok(reader.includes('searchIndex,'), 'reader must pass search index into cross-episode open');
  assert.ok(nav.includes('searchIndex: options.searchIndex'), 'open-novel load intent must carry search target options');
  assert.ok(runner.includes("nodeCmd('tools/checks/search-multi-episode-full-scan-smoke.js')"), 'smoke runner must include multi-episode search smoke');
  await runDynamicMatcherSmoke();
  console.log(PASS);
})().catch(error => {
  console.error(error && (error.stack || error.message || String(error)));
  process.exit(1);
});
