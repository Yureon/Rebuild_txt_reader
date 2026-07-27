#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import {
  LIBRARY_BOUNDED_FULL_FALLBACK_MAX_NOVELS,
  LIBRARY_BOUNDED_FULL_FALLBACK_PASS,
  selectLibraryBoundedFallbackNovels
} from '../../public/scripts/rebuild/features/library-full-renderer.mjs';
import {
  buildLibraryBookmarkCountIndex,
  LIBRARY_BOOKMARK_COUNT_INDEX_PASS,
  LIBRARY_COLLAPSED_EPISODE_LAZY_PASS
} from '../../public/scripts/rebuild/features/library-tree-renderer.mjs';
import {
  LIBRARY_VIRTUAL_LARGE_FALLBACK_RETRY_PASS,
  recordLibraryVirtualFallbackRuntime
} from '../../public/scripts/rebuild/features/library-virtual-recording-runtime.mjs';
import {
  LIBRARY_VIRTUAL_BOUNDED_FAILURE_PASS,
  renderLibraryVirtualIfEnabledRuntime
} from '../../public/scripts/rebuild/features/library-virtual-render-runtime.mjs';
import { renderLibraryOrchestratorRuntime } from '../../public/scripts/rebuild/features/library-render-orchestrator.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const novels = Array.from({ length:80_000 }, (_, index) => ({
  id:`novel-${index}`,
  title:`Novel ${index}`,
  isMultiFile:index % 10 === 0,
  episodes:[]
}));
const selected = selectLibraryBoundedFallbackNovels(novels, 'novel-79999');
assert.equal(selected.length, LIBRARY_BOUNDED_FULL_FALLBACK_MAX_NOVELS);
assert(selected.some(novel => novel.id === 'novel-79999'), 'bounded fallback must retain the active novel');

let persistedFallbacks = 0;
const fallbackApp = { state:{} };
const fallback = recordLibraryVirtualFallbackRuntime(fallbackApp, {
  reason:'actual-dom-mismatch',
  blocking:true,
  rowCount:80_000
}, {
  persistLibraryVirtualAutoFallback() { persistedFallbacks += 1; }
});
assert.equal(persistedFallbacks, 0, 'large gate failures must not disable virtualization for seven days');
assert.equal(fallback.autoFallbackPersisted, false);
assert.equal(fallback.largeFallbackRetryPass, LIBRARY_VIRTUAL_LARGE_FALLBACK_RETRY_PASS);

const disabledResult = renderLibraryVirtualIfEnabledRuntime({
  state:{ libraryVirtualAutoFallback:{ active:true } }
}, {}, novels, {}, {
  isLibraryVirtualRendererEnabled:() => false
});
assert.equal(disabledResult.blocking, true);
assert.equal(disabledResult.pass, LIBRARY_VIRTUAL_BOUNDED_FAILURE_PASS);

let orchestratorOptions = null;
const fakeBox = {
  scrollTop:0,
  classList:{ add() {}, remove() {} }
};
renderLibraryOrchestratorRuntime({
  state:{ libraryViewMode:'files' },
  els:{ novelList:fakeBox }
}, {}, {
  normalizeLibraryRenderOptions:options => options,
  cancelLibraryVirtualRender() {},
  syncLibraryChrome() {},
  renderLibraryQuickList() {},
  getLibraryFilteredNovels:() => novels,
  renderLibraryVirtualIfEnabled:() => disabledResult,
  renderLibraryFull(_app, _box, _novels, _reason, options) { orchestratorOptions = options; }
});
assert.equal(orchestratorOptions?.blockingVirtualFallback, true);
assert.equal(orchestratorOptions?.virtualFallbackRowCount, 80_000);

const benchmarkNovels = novels.slice(0, 10_000);
const bookmarks = Array.from({ length:5_000 }, (_, index) => ({ novelId:`novel-${index % 2_500}` }));
const runLegacy = () => {
  let total = 0;
  for (const novel of benchmarkNovels) total += bookmarks.filter(bookmark => bookmark.novelId === novel.id).length;
  return total;
};
const runIndexed = () => {
  const counts = buildLibraryBookmarkCountIndex(bookmarks);
  let total = 0;
  for (const novel of benchmarkNovels) total += counts.get(novel.id) || 0;
  return total;
};
const measure = (fn, runs = 4) => {
  const samples = [];
  let value = 0;
  for (let run = 0; run < runs; run += 1) {
    const startedAt = performance.now();
    value = fn();
    const elapsed = performance.now() - startedAt;
    if (run > 0) samples.push(elapsed);
  }
  samples.sort((left, right) => left - right);
  return {
    value,
    runs:samples.length,
    warmupRuns:1,
    averageMs:samples.reduce((sum, item) => sum + item, 0) / samples.length,
    p95Ms:samples[Math.ceil(samples.length * 0.95) - 1],
    maxMs:samples[samples.length - 1]
  };
};
const rssBefore = process.memoryUsage().rss;
const before = measure(runLegacy);
const after = measure(runIndexed);
assert.equal(after.value, before.value);
assert(after.averageMs < before.averageMs);

const treeSource = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/library-tree-renderer.mjs'), 'utf8');
assert(treeSource.includes('novel.isMultiFile && app.state.expandedEpisodeNovels.has(novel.id)'));
assert(treeSource.includes(LIBRARY_COLLAPSED_EPISODE_LAZY_PASS));
assert(treeSource.includes(LIBRARY_BOOKMARK_COUNT_INDEX_PASS));

const round = value => Number(value.toFixed(2));
console.log(JSON.stringify({
  pass:'v674-library-bounded-fallback-smoke-pass',
  boundedFallbackPass:LIBRARY_BOUNDED_FULL_FALLBACK_PASS,
  fixture:{ catalogNovels:80_000, benchmarkNovels:10_000, bookmarks:5_000 },
  boundedNovels:selected.length,
  activeNovelRetained:true,
  autoFallbackPersisted:false,
  collapsedEpisodesLazy:true,
  bookmarkCounts:{
    before:{ ...before, averageMs:round(before.averageMs), p95Ms:round(before.p95Ms), maxMs:round(before.maxMs) },
    after:{ ...after, averageMs:round(after.averageMs), p95Ms:round(after.p95Ms), maxMs:round(after.maxMs) },
    improvementRatio:round(before.averageMs / Math.max(after.averageMs, 0.001))
  },
  rssDeltaBytes:process.memoryUsage().rss - rssBefore,
  synthetic:true,
  browserRendering:false,
  externalNetwork:false
}));
