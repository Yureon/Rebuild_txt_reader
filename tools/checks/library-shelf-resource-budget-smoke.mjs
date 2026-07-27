#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureNovelEpisodesLoadedRuntime, LIBRARY_SHELF_APPEND_RENDER_PASS, LIBRARY_EPISODE_LRU_PASS } from '../../public/scripts/rebuild/features/library-shelf-runtime.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const runtime = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/library-shelf-runtime.mjs'), 'utf8');
const controls = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/library-install-controls-runtime.mjs'), 'utf8');
const appCss = fs.readFileSync(path.join(root, 'public/styles/app.css'), 'utf8');

assert.ok(runtime.includes(LIBRARY_SHELF_APPEND_RENDER_PASS));
assert.ok(runtime.includes(LIBRARY_EPISODE_LRU_PASS));
assert.ok(runtime.includes('items.slice(appendFrom).forEach'), 'load-more must append only the new card range');
assert.ok(runtime.includes("options.source === 'shelf-load-more-start'"), 'load-more pending state must not rebuild the full card grid');
assert.ok(controls.includes(': 300;'), 'shelf search debounce must be raised to 300ms');
assert.match(appCss, /\.library-shelf-card\.novel-item[\s\S]*content-visibility\s*:\s*auto/, 'offscreen shelf cards must skip layout and paint work');
assert.match(appCss, /contain-intrinsic-size\s*:\s*auto 310px/, 'shelf cards must reserve an intrinsic height while skipped');

const novels = Array.from({ length:14 }, (_, index) => ({
  id:`novel-${index + 1}`,
  title:`Novel ${index + 1}`,
  isMultiFile:true,
  episodes:[],
  episodesLoaded:false
}));
const app = {
  state: {
    novelById:new Map(novels.map(item => [item.id, item])),
    novels:novels.slice(),
    libraryFullCatalogLoaded:false,
    libraryEpisodeCacheLru:[],
    libraryEpisodeCacheLimit:12,
    progress:{ lastRead:null },
    current:null,
    libraryFilteredNovelsCache:null,
    libraryVirtualRowsCache:null
  },
  api: {
    async novelEpisodes(id) { return { episodes:[{ id:`${id}-ep`, title:'1화' }] }; }
  }
};

for (const novel of novels) await ensureNovelEpisodesLoadedRuntime(app, novel);
assert.equal(app.state.libraryEpisodeCacheLru.length, 12);
assert.equal(novels[0].episodesLoaded, false);
assert.equal(novels[1].episodesLoaded, false);
assert.equal(novels[13].episodesLoaded, true);
console.log(JSON.stringify({ pass:'v567-library-shelf-resource-budget-smoke-pass', lru:app.state.libraryEpisodeCacheLru.length }));
