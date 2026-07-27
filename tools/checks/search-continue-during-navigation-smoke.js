#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');

const searchSource = fs.readFileSync('public/scripts/rebuild/features/search.mjs', 'utf8');
const resultsSource = fs.readFileSync('public/scripts/rebuild/features/search/results-view.mjs', 'utf8');
const matcherSource = fs.readFileSync('public/scripts/rebuild/features/search/matcher.mjs', 'utf8');
const PASS = 'v365-search-continue-during-navigation-smoke-pass';

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing function ${name}`);
  const next = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, next >= 0 ? next : source.length);
}

async function runMatcherSmoke() {
  const { searchAllChunks } = await import('../../public/scripts/rebuild/features/search/matcher.mjs');
  const events = [];
  global.CustomEvent = class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } };
  global.window = { dispatchEvent(event) { events.push(event); } };
  const novel = {
    id:'same-root-novel',
    title:'Same Root',
    episodes:[
      { id:'ep-1', title:'1화', totalChunks:1 },
      { id:'ep-2', title:'2화', totalChunks:2 }
    ]
  };
  const current1 = { novel, episode: novel.episodes[0], episodeIdx:0, chunk:1, totalChunks:1, title:'Same Root · 1화' };
  const current2 = { novel, episode: novel.episodes[1], episodeIdx:1, chunk:1, totalChunks:2, title:'Same Root · 2화' };
  const app = {
    els:{ nsearchStatus:{ textContent:'' } },
    api:{
      async content({ episodeId, chunk }) {
        if (episodeId === 'ep-2' && chunk === 1) app.state.current = current2;
        return { currentChunk:chunk, totalChunks:episodeId === 'ep-2' ? 2 : 1, title:episodeId, content:`needle ${episodeId} ${chunk}` };
      }
    },
    state:{
      current:current1,
      loadedChunks:new Map(),
      loadingChunks:new Set(),
      chunkTextCache:new Map(),
      prefs:{ readerCache:false, preprocess:{} },
      search:{ runId:365, results:[], stats:null }
    }
  };
  await searchAllChunks(app, 'needle', 365, new AbortController().signal, { cacheOnly:false });
  assert.ok(app.state.search.results.some(result => result.episodeId === 'ep-2'), 'same-root episode navigation must not abort full search');
  assert.strictEqual(app.state.search.continueDuringNavigationPass, 'v365-search-continue-during-navigation-pass', 'continue marker must be stored');
  assert.ok(events.some(event => event.type === 'txt-reader-search-results'), 'search must keep publishing result events');
}

(async () => {
  const closeSearch = extractFunction(searchSource, 'closeSearch');
  assert.ok(closeSearch.includes('options = {}'), 'closeSearch must accept options');
  assert.ok(closeSearch.includes('options.abort === true'), 'closeSearch must only abort when explicitly requested');
  assert.ok(closeSearch.indexOf('abortController?.abort?.();') > closeSearch.indexOf('if (abort)'), 'closeSearch abort must be inside explicit abort branch');
  assert.ok(resultsSource.includes("closeSearch({ abort:false, reason:'result-navigation' })"), 'result navigation must close UI without aborting search');
  assert.ok(matcherSource.includes('isSameSearchRoot'), 'matcher must guard by root novel rather than current episode identity');
  await runMatcherSmoke();
  console.log(PASS);
})().catch(error => {
  console.error(error && (error.stack || error.message || String(error)));
  process.exit(1);
});
