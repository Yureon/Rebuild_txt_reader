import { escapeRegExp, limitMapSize } from '../../core/utils.mjs';
import { readChunkPayloadFromCache, writeChunkPayloadToCache, getSearchCacheManifestSnapshot, SEARCH_CACHE_MANIFEST_PASS } from '../reader/cache-store.mjs';
import { chunkCharToDocumentRatio } from '../reader/coordinates.mjs';
import { SEARCH_SERVER_LOAD_MITIGATION_PASS, applySearchAdaptiveStats, loadSearchServerPerformanceProfile, recordSearchAdaptiveFeedback, resolveAdaptiveSearchConcurrency, resolveAdaptiveSearchWorkerBatchSize, searchAdaptiveNow, startSearchAdaptiveProfile } from './search-performance-profile.mjs';

export const MAX_RESULTS = 3000;
export const MAX_MATCHES_PER_CHUNK = 80;
export const MAX_SEARCH_TEXT_CACHE = 120;
const SEARCH_STATUS_INTERVAL_MS = 160;
const SEARCH_RESULT_PROGRESS_INTERVAL_MS = 220;
const SEARCH_FULL_SCAN_CONCURRENCY_MAX = 3;
const SEARCH_LIVE_FULL_SCAN_CONCURRENCY_MAX = 3;
const SEARCH_MULTI_EPISODE_TARGET_CONCURRENCY_MAX = 2;
export { loadSearchServerPerformanceProfile };
const SEARCH_FAST_MULTI_EPISODE_SCAN_PASS = 'v367-search-fast-multi-episode-scan-pass';
const SEARCH_INCREMENTAL_RESULTS_PASS = 'v364-search-incremental-results-pass';
const SEARCH_CONCURRENT_FETCH_PASS = 'v364-search-concurrent-fetch-pass';
const SEARCH_CONTINUE_DURING_NAVIGATION_PASS = 'v365-search-continue-during-navigation-pass';
export const SEARCH_PERFORMANCE_PASS = 'v145-search-performance-pass';
export const SEARCH_RESULT_FILTER_CACHE_PASS = 'v145-search-result-filter-cache-pass';
export const SEARCH_ALL_CHUNKS_COMPLETE_SCAN_PASS = 'v149-search-all-chunks-complete-scan-pass';
export const SEARCH_FULL_SCAN_DIAGNOSTICS_PASS = 'v150-search-full-scan-diagnostics-pass';
export const SEARCH_RESULT_FIELD_VALIDATION_PASS = 'v151-search-result-field-validation-pass';
export const SEARCH_CACHE_ONLY_CLIENT_UX_PASS = 'v398-search-cache-only-client-ux-pass';
export const SEARCH_WORKER_CLIENT_PASS = 'v399-search-worker-client-pass';
export const SEARCH_WORKER_WARM_START_PASS = 'v453-search-worker-warm-start-pass';
export const SEARCH_WORKER_BATCH_PASS = 'v460-search-worker-batch-pass';
export const SEARCH_WORKER_BATCH_SCHEDULE_PASS = 'v467-search-worker-batch-schedule-pass';
export const SEARCH_FULL_SCAN_CONCURRENCY_TUNE_PASS = 'v509-search-full-scan-adaptive-concurrency-pass';
export const SEARCH_LIVE_FULL_SCAN_CONCURRENCY_PASS = 'v509-search-live-adaptive-concurrency-pass';
export const SEARCH_MULTI_EPISODE_TARGET_CONCURRENCY_PASS = 'v509-search-multi-episode-adaptive-concurrency-pass';
export const SEARCH_WORKER_BATCH_SIZE_TUNE_PASS = 'v509-search-worker-adaptive-batch-pass';
export const SEARCH_WORKER_ABORT_TERMINATE_PASS = 'v541-search-worker-abort-terminate-pass';
const SEARCH_WORKER_BATCH_SIZE_MAX = 5;
const SEARCH_SCAN_REQUEST_HEADER = 'X-Search-Scan';
const SEARCH_WORKER_SCRIPT_URL = '/scripts/rebuild/features/search/search-worker.js?v=rebuild-v682';



export function prewarmSearchWorker(app, reason = 'search-open') {
  const search = app?.state?.search;
  if (!search) return { pass: SEARCH_WORKER_WARM_START_PASS, warmed: false, reason: 'search state unavailable' };
  const startedAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const client = getSearchWorkerClient(app, null);
  const elapsedMs = Math.max(0, ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - startedAt);
  const record = {
    pass: SEARCH_WORKER_WARM_START_PASS,
    warmed: !!client,
    reused: !!(client && search.workerClient === client && search.searchWorkerWarmStart),
    reason,
    elapsedMs,
    workerClientPass: client?.pass || '',
    unavailable: search.workerUnavailable || '',
    at: Date.now()
  };
  search.searchWorkerWarmStart = record;
  return record;
}

export function searchLoadedChunks(app, q) {
  if (!q) {
    app.state.search.results = [];
    app.state.search.stats = createSearchStats('loaded', 0);
    return;
  }
  const chunks = Array.from(app.state.loadedChunks.values()).map(chunk => ({ ...chunk, __searchSource: 'loaded' }));
  const stats = createSearchStats('loaded', chunks.length);
  stats.loadedChunks = chunks.length;
  stats.scannedChunks = chunks.length;
  stats.processedChunks = chunks.length;
  app.state.search.results = collectMatches(app, chunks, q, app.state.current, MAX_RESULTS);
  stats.resultCount = app.state.search.results.length;
  stats.done = true;
  commitSearchStats(app, stats);
}

export async function searchAllChunks(app, q, runId, signal, options = {}) {
  const rootCurrent = app.state.current;
  const targets = buildSearchScopeContexts(rootCurrent);
  const cacheOnly = !!options.cacheOnly;
  const initialTotal = targets.reduce((sum, target) => sum + Math.max(1, Number(target.current?.totalChunks) || 1), 0);
  const stats = createSearchStats(cacheOnly ? 'cache-only' : 'all', initialTotal);
  stats.cacheOnlyClientUxPass = cacheOnly ? SEARCH_CACHE_ONLY_CLIENT_UX_PASS : '';
  stats.cacheOnly = cacheOnly;
  stats.completeScanPass = SEARCH_ALL_CHUNKS_COMPLETE_SCAN_PASS;
  stats.fullSearchDiagnosticsPass = SEARCH_FULL_SCAN_DIAGNOSTICS_PASS;
  stats.multiEpisodeSearchPass = targets.length > 1 ? 'v363-search-multi-episode-full-scan-pass' : '';
  stats.incrementalResultsPass = SEARCH_INCREMENTAL_RESULTS_PASS;
  stats.concurrentFetchPass = SEARCH_CONCURRENT_FETCH_PASS;
  stats.fullScanConcurrencyTunePass = SEARCH_FULL_SCAN_CONCURRENCY_TUNE_PASS;
  stats.liveFullScanConcurrencyPass = SEARCH_LIVE_FULL_SCAN_CONCURRENCY_PASS;
  stats.multiEpisodeTargetConcurrencyPass = SEARCH_MULTI_EPISODE_TARGET_CONCURRENCY_PASS;
  stats.workerBatchSizeTunePass = SEARCH_WORKER_BATCH_SIZE_TUNE_PASS;
  const adaptiveProfile = startSearchAdaptiveProfile(app);
  applySearchAdaptiveStats(stats, adaptiveProfile);
  stats.multiEpisodeTargetConcurrency = targets.length > 1 ? stats.multiEpisodeTargetConcurrency : 1;
  stats.workerBatchSizeMax = SEARCH_WORKER_BATCH_SIZE_MAX;
  stats.fastMultiEpisodeScanPass = targets.length > 1 ? SEARCH_FAST_MULTI_EPISODE_SCAN_PASS : '';
  stats.searchScope = targets.length > 1 ? 'novel-episodes' : 'current-episode';
  stats.episodeCount = targets.length;
  stats.expectedChunks = initialTotal;
  stats.plannedChunks = initialTotal;
  stats.firstPlannedChunk = initialTotal ? 1 : 0;
  stats.lastPlannedChunk = initialTotal;
  if (cacheOnly) {
    const preview = await buildSearchCoveragePreview(app, rootCurrent, { signal, maxChunks: Math.max(1, Number(rootCurrent?.totalChunks) || 1), cacheOnly: true });
    stats.cacheOnlyAvailableChunks = Number(preview.cachedOrLoaded) || 0;
    stats.cacheOnlyMissingChunks = Number(preview.serverFreeMissingChunks) || Math.max(0, initialTotal - stats.cacheOnlyAvailableChunks);
    stats.searchCacheManifestPass = preview.searchCacheManifestPass || SEARCH_CACHE_MANIFEST_PASS;
    stats.searchCacheManifestChunks = Number(preview.searchCacheManifestChunks) || 0;
    stats.searchCacheManifestMatchedChunks = Number(preview.searchCacheManifestMatchedChunks) || 0;
    app.state.search.coveragePreview = { ...preview, cacheOnly: true, updatedAt: Date.now() };
  }
  const results = [];
  commitSearchStats(app, stats);
  await scanSearchTargets(app, q, runId, signal, targets, { rootCurrent, results, stats, cacheOnly });
  stats.done = true;
  stats.completeScanDone = !cacheOnly && Math.max(Number(stats.scannedChunks) || 0, Number(stats.processedChunks) || 0) >= Math.max(1, Number(stats.totalChunks) || 1);
  stats.searchCompletionSummary = buildSearchCompletionSummary(stats, results.length);
  stats.resultCount = results.length;
  stats.updatedAt = Date.now();
  commitSearchStats(app, stats, { force:true });
  if (runId === app.state.search.runId) commitSearchResults(app, results, runId, { force:true });
  if (app.els.nsearchStatus) app.els.nsearchStatus.textContent = formatSearchProgress(stats, app.state.search.results.length, true);
}

export async function searchSelectedChunks(app, q, runId, signal, chunks = [], { mode = 'retry', preserveResults = true } = {}) {
  const c = app.state.current;
  const selected = normalizeChunkList(chunks, Math.max(1, Number(c?.totalChunks) || 1));
  const stats = createSearchStats(mode, selected.length);
  stats.retryChunks = selected.slice();
  const results = preserveResults && Array.isArray(app.state.search.results) ? app.state.search.results.slice() : [];
  commitSearchStats(app, stats);
  await scanSearchChunks(app, q, runId, signal, selected, { current: c, results, stats, status: true });
  stats.done = true;
  stats.resultCount = results.length;
  stats.updatedAt = Date.now();
  commitSearchStats(app, stats, { force:true });
  if (runId === app.state.search.runId) commitSearchResults(app, results, runId, { force:true });
  if (app.els.nsearchStatus) app.els.nsearchStatus.textContent = formatSearchProgress(stats, app.state.search.results.length, true);
  return stats;
}

export async function buildSearchCoveragePreview(app, current = app?.state?.current, { signal = null, maxChunks = 5000, cacheOnly = false } = {}) {
  const total = Math.max(1, Number(current?.totalChunks) || 1);
  const limit = Math.max(1, Math.min(total, Number(maxChunks) || total));
  const loadedSet = app?.state?.loadedChunks || new Map();
  const memoryCache = app?.state?.chunkTextCache || new Map();
  const manifest = await getSearchCacheManifestSnapshot(app, current, { signal });
  const manifestSet = new Set(Array.isArray(manifest?.chunks) ? manifest.chunks.map(value => Math.max(1, Math.round(Number(value) || 0))).filter(Boolean) : []);
  const seen = new Set();
  const chunks = [];
  let loadedChunks = 0;
  let memoryChunks = 0;
  let cacheChunks = 0;
  let sampledChunks = 0;
  for (let chunk = 1; chunk <= limit; chunk += 1) {
    if (signal?.aborted) throw new DOMException('검색 가능 범위 확인 취소', 'AbortError');
    sampledChunks += 1;
    if (loadedSet.has(chunk)) {
      loadedChunks += 1;
      seen.add(chunk);
      chunks.push({ chunk, source: 'loaded' });
    } else if (memoryCache.has(chunk)) {
      memoryChunks += 1;
      seen.add(chunk);
      chunks.push({ chunk, source: 'memory' });
    } else if (manifestSet.has(chunk)) {
      cacheChunks += 1;
      seen.add(chunk);
      chunks.push({ chunk, source: 'search-manifest' });
    } else if (await readChunkPayloadFromCache(app, current, chunk)) {
      cacheChunks += 1;
      seen.add(chunk);
      chunks.push({ chunk, source: 'reader-cache' });
    }
    if (chunk % 40 === 0) await sleepFrame();
  }
  const online = !isBrowserOffline();
  const cachedOrLoaded = seen.size;
  const serverFreeMissingChunks = Math.max(0, total - cachedOrLoaded);
  const searchableChunks = cacheOnly ? cachedOrLoaded : (online ? total : cachedOrLoaded);
  return {
    pass: cacheOnly ? SEARCH_CACHE_ONLY_CLIENT_UX_PASS : '',
    cacheOnly: !!cacheOnly,
    totalChunks: total,
    sampledChunks,
    truncated: limit < total,
    online,
    loadedChunks,
    memoryChunks,
    cacheChunks,
    cachedOrLoaded,
    searchableChunks,
    serverFreeMissingChunks,
    offlineMissingChunks: online ? 0 : serverFreeMissingChunks,
    searchCacheManifestPass: manifest?.pass || SEARCH_CACHE_MANIFEST_PASS,
    searchCacheManifestChunks: Number(manifest?.chunkCount) || manifestSet.size,
    searchCacheManifestMatchedChunks: chunks.filter(item => item.source === 'search-manifest').length,
    chunks
  };
}

export function collectMatches(app, chunks, q, current, limit = MAX_RESULTS) {
  if (!q || limit <= 0) return [];
  const re = new RegExp(escapeRegExp(q), 'gi');
  const out = [];
  chunks.forEach(chunk => {
    if (out.length >= limit) return;
    const text = String(chunk.content || '');
    const chunkNumber = Math.max(1, Math.round(Number(chunk.chunk) || 1));
    const totalChunks = Math.max(1, Number(chunk.totalChunks) || Number(current?.totalChunks) || chunkNumber);
    const novelId = chunk.novelId || current?.novel?.id || '';
    const episodeId = Object.prototype.hasOwnProperty.call(chunk, 'episodeId') ? chunk.episodeId : (current?.episode?.id || null);
    const episodeIndex = Number.isFinite(Number(chunk.episodeIndex)) ? Math.max(0, Math.round(Number(chunk.episodeIndex))) : Math.max(0, Number(current?.episodeIdx) || 0);
    const episodeCount = Math.max(1, Number(chunk.episodeCount) || Number(current?.novel?.episodes?.length) || 1);
    const title = chunk.title || current?.title || '';
    let match;
    let count = 0;
    while ((match = re.exec(text)) && count < MAX_MATCHES_PER_CHUNK && out.length < limit) {
      const idx = Math.max(0, Number(match.index) || 0);
      const start = Math.max(0, idx - 70);
      const end = Math.min(text.length, idx + q.length + 90);
      out.push({
        novelId,
        episodeId,
        episodeTitle: chunk.episodeTitle || current?.episode?.title || '',
        episodeIndex,
        episodeCount,
        chunk: chunkNumber,
        totalChunks,
        index: idx,
        title,
        excerpt: text.slice(start, end),
        query: q,
        matchLength: q.length,
        source: chunk.__searchSource || chunk.source || '',
        textLength: text.length,
        resultFieldValidationPass: SEARCH_RESULT_FIELD_VALIDATION_PASS,
        documentRatio: resolveSearchDocumentRatio(app, current, { episodeId, episodeIndex, episodeCount, chunkNumber, totalChunks, index: idx, textLength: text.length })
      });
      count += 1;
      if (match.index === re.lastIndex) re.lastIndex += 1;
    }
  });
  return out;
}

export function createSearchStats(mode = 'all', totalChunks = 0) {
  return {
    mode,
    totalChunks: Math.max(0, Number(totalChunks) || 0),
    processedChunks: 0,
    scannedChunks: 0,
    memoryChunks: 0,
    loadedChunks: 0,
    cacheChunks: 0,
    networkChunks: 0,
    skippedOfflineChunks: 0,
    failedChunks: 0,
    resultCount: 0,
    lastFailedChunk: 0,
    lastSkippedChunk: 0,
    lastError: '',
    failedChunkList: [],
    skippedOfflineChunkList: [],
    skippedCacheOnlyChunks: 0,
    skippedCacheOnlyChunkList: [],
    cacheOnly: false,
    cacheOnlyAvailableChunks: 0,
    cacheOnlyMissingChunks: 0,
    cacheOnlyClientUxPass: '',
    retryChunks: [],
    startedAt: Date.now(),
    updatedAt: Date.now(),
    done: false,
    statCommitEvents: 0,
    statCommitCoalesced: 0,
    completeScanPass: SEARCH_ALL_CHUNKS_COMPLETE_SCAN_PASS,
    fullSearchDiagnosticsPass: SEARCH_FULL_SCAN_DIAGNOSTICS_PASS,
    resultFieldValidationPass: SEARCH_RESULT_FIELD_VALIDATION_PASS,
    expectedChunks: Math.max(0, Number(totalChunks) || 0),
    plannedChunks: Math.max(0, Number(totalChunks) || 0),
    firstPlannedChunk: totalChunks ? 1 : 0,
    lastPlannedChunk: Math.max(0, Number(totalChunks) || 0),
    expansionEvents: 0,
    expandedTotalChunksFrom: 0,
    expandedTotalChunksTo: 0,
    lastScannedChunk: 0,
    resultLimitReached: false,
    resultLimitReachedAtChunk: 0,
    completeScanDone: false,
    searchCompletionSummary: '',
    searchWorkerClientPass: '',
    workerChunks: 0,
    workerMatches: 0,
    workerFallbacks: 0,
    workerUnavailable: '',
    workerBatchPass: SEARCH_WORKER_BATCH_PASS,
    workerBatchSchedulePass: SEARCH_WORKER_BATCH_SCHEDULE_PASS,
    workerBatches: 0,
    workerBatchChunks: 0,
    workerMaxBatchSize: SEARCH_WORKER_BATCH_SIZE_MAX,
    fullScanConcurrencyTunePass: SEARCH_FULL_SCAN_CONCURRENCY_TUNE_PASS,
    liveFullScanConcurrencyPass: SEARCH_LIVE_FULL_SCAN_CONCURRENCY_PASS,
    multiEpisodeTargetConcurrencyPass: SEARCH_MULTI_EPISODE_TARGET_CONCURRENCY_PASS,
    workerBatchSizeTunePass: SEARCH_WORKER_BATCH_SIZE_TUNE_PASS,
    fullScanConcurrency: SEARCH_FULL_SCAN_CONCURRENCY_MAX,
    liveFullScanConcurrency: SEARCH_LIVE_FULL_SCAN_CONCURRENCY_MAX,
    multiEpisodeTargetConcurrency: 1,
    workerBatchSize: SEARCH_WORKER_BATCH_SIZE_MAX,
    searchServerLoadMitigationPass: SEARCH_SERVER_LOAD_MITIGATION_PASS,
    searchScanRequestHeader: SEARCH_SCAN_REQUEST_HEADER,
    searchScanContentRequests: 0,
    searchBlockManifestPolicyPass: 'v537-search-block-manifest-lazy-pass',
    searchBlockManifestPolicy: 'lazy-on-reader-jump',
    searchCacheManifestPass: '',
    searchCacheManifestChunks: 0,
    searchCacheManifestMatchedChunks: 0,
    searchWorkerAbortTerminatePass: ''
  };
}
export function searchSourceGroup(source = '') {
  const value = String(source || '').trim();
  if (value === 'network') return 'network';
  if (value === 'reader-cache' || value === 'loaded' || value === 'memory') return 'cache';
  return 'unknown';
}

export function searchResultMatchesFilter(result, filter = 'all') {
  const mode = normalizeSearchSourceFilter(filter);
  if (mode === 'all') return true;
  return searchSourceGroup(result?.source) === mode;
}

export function normalizeSearchSourceFilter(filter = 'all') {
  const value = String(filter || 'all').trim();
  return value === 'cache' || value === 'network' || value === 'unknown' ? value : 'all';
}

export function getSearchResultFilterSnapshot(app, results = [], filter = 'all') {
  const search = app?.state?.search || null;
  const list = Array.isArray(results) ? results : [];
  const mode = normalizeSearchSourceFilter(filter);
  const cache = search?.resultFilterSnapshotCache || null;
  if (cache && cache.pass === SEARCH_RESULT_FILTER_CACHE_PASS && cache.resultsRef === list && cache.filter === mode && cache.length === list.length) {
    return cache.snapshot;
  }
  const snapshot = buildSearchResultFilterSnapshot(list, mode);
  if (search) {
    const serial = (Number(search.resultFilterSnapshotSerial) || 0) + 1;
    search.resultFilterSnapshotSerial = serial;
    snapshot.serial = serial;
    search.resultFilterSnapshotCache = {
      pass: SEARCH_RESULT_FILTER_CACHE_PASS,
      resultsRef: list,
      filter: mode,
      length: list.length,
      snapshot
    };
  }
  return snapshot;
}

export function buildSearchResultFilterSnapshot(results = [], filter = 'all') {
  const list = Array.isArray(results) ? results : [];
  const mode = normalizeSearchSourceFilter(filter);
  const entries = [];
  const indexes = [];
  const sourceCounts = { all:0, cache:0, network:0, unknown:0 };
  list.forEach((result, index) => {
    sourceCounts.all += 1;
    const group = searchSourceGroup(result?.source);
    sourceCounts[group] = (sourceCounts[group] || 0) + 1;
    if (mode === 'all' || group === mode) {
      entries.push({ result, index });
      indexes.push(index);
    }
  });
  return {
    pass: SEARCH_RESULT_FILTER_CACHE_PASS,
    filter: mode,
    length: list.length,
    entries,
    indexes,
    sourceCounts,
    serial: 0
  };
}


export function formatSearchProgress(stats, resultCount = 0, done = false) {
  if (!stats) return '';
  const total = Math.max(0, Number(stats.totalChunks) || 0);
  const processed = getSearchProcessedCount(stats);
  const prefix = done ? '검색 완료' : '검색 중';
  const modeLabel = getSearchModeLabel(stats);
  const percent = total ? `${Math.min(100, Math.round((processed / total) * 100))}%` : '';
  const pieces = [`${prefix}${modeLabel ? `(${modeLabel})` : ''}${percent ? ` ${percent}` : ''}`];
  if (total) pieces.push(`처리 ${processed}/${total}`);
  pieces.push(`결과 ${resultCount}`);
  if (Number(stats.episodeCount) > 1) pieces.push(`화 ${stats.currentEpisodeIndex || '-'} / ${stats.episodeCount}`);
  const warnings = [];
  if (stats.failedChunks) warnings.push(`실패 ${stats.failedChunks}`);
  if (stats.skippedOfflineChunks) warnings.push(`오프라인 누락 ${stats.skippedOfflineChunks}`);
  if (stats.skippedCacheOnlyChunks) warnings.push(`캐시 외 ${stats.skippedCacheOnlyChunks}`);
  if (stats.resultLimitReached) warnings.push(`결과 상한 ${MAX_RESULTS}`);
  if (warnings.length) pieces.push(warnings.join(' · '));
  return pieces.join(' · ');
}

export function getSearchProcessedCount(stats = {}) {
  return Math.max(0, Number(stats.processedChunks) || (Number(stats.scannedChunks) || 0) + (Number(stats.skippedOfflineChunks) || 0) + (Number(stats.failedChunks) || 0));
}

export function getSearchModeLabel(stats = {}) {
  const mode = String(stats.mode || '');
  if (mode === 'all') return '전체/네트워크';
  if (mode === 'cache-only') return '캐시 검색';
  if (mode === 'loaded') return '표시중';
  if (mode.startsWith('retry')) return '재검색';
  return '';
}

export function buildSearchCompletionSummary(stats = {}, resultCount = 0) {
  const total = Math.max(0, Number(stats.totalChunks) || 0);
  const processed = getSearchProcessedCount(stats);
  const scanned = Math.max(0, Number(stats.scannedChunks) || 0);
  const failed = Math.max(0, Number(stats.failedChunks) || 0);
  const offlineMissing = Math.max(0, Number(stats.skippedOfflineChunks) || 0);
  const cacheOnlySkipped = Math.max(0, Number(stats.skippedCacheOnlyChunks) || 0);
  const cacheOnly = String(stats.mode || '') === 'cache-only';
  const complete = !!stats.completeScanDone || (cacheOnly && processed >= total);
  const planned = Math.max(0, Number(stats.plannedChunks) || total);
  const modeLabel = getSearchModeLabel(stats) || '검색';
  const pieces = [`${modeLabel} 요약`, complete ? (cacheOnly ? '캐시 범위 스캔 완료' : '전체 스캔 완료') : (cacheOnly ? '캐시 범위 스캔 미완료' : '전체 스캔 미완료'), `처리 ${processed}/${total || planned}`];
  if (scanned) pieces.push(`스캔 ${scanned}`);
  if (failed) pieces.push(`실패 ${failed}`);
  if (offlineMissing) pieces.push(`오프라인 누락 ${offlineMissing}`);
  if (cacheOnlySkipped) pieces.push(`캐시 외 제외 ${cacheOnlySkipped}`);
  if (stats.resultLimitReached) pieces.push(`결과 표시 상한 ${MAX_RESULTS}`);
  if (stats.expansionEvents) pieces.push(`chunk 수 확장 ${stats.expandedTotalChunksFrom || '-'}→${stats.expandedTotalChunksTo || total}`);
  if (stats.lastScannedChunk) pieces.push(`마지막 스캔 ${stats.lastScannedChunk}`);
  pieces.push(`결과 ${resultCount}`);
  return pieces.join(' · ');
}


function buildSearchScopeContexts(current) {
  if (!current) return [];
  const novel = current.novel || {};
  const episodes = Array.isArray(novel.episodes) ? novel.episodes : [];
  if (!current.episode || episodes.length <= 1) {
    return [{ current, episodeIndex: Number(current.episodeIdx) || 0, episodeTitle: current.episode?.title || current.title || '' }];
  }
  return episodes.map((episode, index) => {
    const sameEpisode = String(episode?.id || '') === String(current.episode?.id || '');
    const nextCurrent = sameEpisode ? current : {
      ...current,
      episode,
      episodeIdx: index,
      chunk: 1,
      totalChunks: Math.max(1, Number(episode?.totalChunks) || 1),
      title: `${novel.title || current.title || ''} · ${episode?.title || episode?.fileName || `화 ${index + 1}`}`
    };
    return {
      current: nextCurrent,
      episodeIndex: index,
      episodeTitle: episode?.title || episode?.fileName || `화 ${index + 1}`
    };
  });
}

function isLiveReaderSearchContext(app, current = null) {
  const live = app?.state?.current || null;
  if (!live || !current) return false;
  const liveNovelId = String(live?.novel?.id || '');
  const currentNovelId = String(current?.novel?.id || '');
  const liveEpisodeId = live?.episode?.id == null ? '' : String(live.episode.id);
  const currentEpisodeId = current?.episode?.id == null ? '' : String(current.episode.id);
  return !!liveNovelId && liveNovelId === currentNovelId && liveEpisodeId === currentEpisodeId;
}

function resolveSearchDocumentRatio(app, current, meta = {}) {
  const episodeCount = Math.max(1, Number(meta.episodeCount) || 1);
  if (episodeCount <= 1 || isLiveReaderSearchContext(app, current)) {
    return chunkCharToDocumentRatio(app, meta.chunkNumber, meta.index, meta.textLength);
  }
  const chunkPart = (Math.max(1, Number(meta.chunkNumber) || 1) - 1 + clamp01((Number(meta.index) || 0) / Math.max(1, Number(meta.textLength) || 1))) / Math.max(1, Number(meta.totalChunks) || 1);
  return clamp01((Math.max(0, Number(meta.episodeIndex) || 0) + chunkPart) / episodeCount);
}

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}


async function scanSearchTargets(app, q, runId, signal, targets = [], { rootCurrent = null, results, stats, cacheOnly = false } = {}) {
  const list = Array.isArray(targets) ? targets : [];
  const concurrency = list.length > 1 ? resolveAdaptiveSearchConcurrency(app, { multiEpisode: true, noNetwork: cacheOnly }) : 1;
  stats.multiEpisodeTargetConcurrencyPass = SEARCH_MULTI_EPISODE_TARGET_CONCURRENCY_PASS;
  applySearchAdaptiveStats(stats, app?.state?.search?.adaptiveProfile || null);
  stats.multiEpisodeTargetConcurrency = concurrency;
  if (list.length <= 1 || concurrency <= 1) {
    for (const target of list) await scanSearchTarget(app, q, runId, signal, target, { rootCurrent, results, stats, cacheOnly });
    return;
  }
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, list.length) }, async () => {
    while (index < list.length) {
      const target = list[index++];
      await scanSearchTarget(app, q, runId, signal, target, { rootCurrent, results, stats, cacheOnly });
    }
  });
  await Promise.all(workers);
}

async function scanSearchTarget(app, q, runId, signal, target, { rootCurrent = null, results, stats, cacheOnly = false } = {}) {
  assertSearchActive(app, rootCurrent, runId, signal);
  const c = target.current;
  stats.currentEpisodeIndex = Number(target.episodeIndex) + 1;
  stats.currentEpisodeTitle = target.episodeTitle || c.title || '';
  let total = Math.max(1, Number(c.totalChunks) || 1);
  let scannedThrough = 0;
  let chunks = buildSequentialChunkList(1, total);
  do {
    assertSearchActive(app, rootCurrent, runId, signal);
    chunks = chunks.filter(chunk => chunk > scannedThrough);
    if (chunks.length) {
      await scanSearchChunks(app, q, runId, signal, chunks, { current: c, searchRootCurrent: rootCurrent, results, stats, status: true, noNetwork: cacheOnly });
      scannedThrough = Math.max(scannedThrough, chunks[chunks.length - 1] || scannedThrough);
    }
    const nextTotal = Math.max(total, Number(c.totalChunks) || 0, Number(stats.totalChunksByEpisode?.[String(c.episode?.id || 'single')]) || 0);
    if (cacheOnly || nextTotal <= total) break;
    stats.expansionEvents = (Number(stats.expansionEvents) || 0) + 1;
    stats.expandedTotalChunksFrom = Math.max(Number(stats.expandedTotalChunksFrom) || 0, stats.totalChunks);
    stats.totalChunks += nextTotal - total;
    stats.expectedChunks = stats.totalChunks;
    stats.plannedChunks = stats.totalChunks;
    stats.expandedTotalChunksTo = stats.totalChunks;
    total = nextTotal;
    c.totalChunks = total;
    chunks = buildSequentialChunkList(scannedThrough + 1, total);
    stats.lastPlannedChunk = total;
    commitSearchStats(app, stats);
  } while (chunks.length);
}

async function scanSearchChunks(app, q, runId, signal, chunks, { current, searchRootCurrent = null, results, stats, status = false, noNetwork = false } = {}) {
  const c = current || app.state.current;
  const guardCurrent = searchRootCurrent || app.state.current;
  const useLiveMemory = isLiveReaderSearchContext(app, c);
  let lastStatusAt = 0;
  for (let offset = 0; offset < chunks.length;) {
    const batchSize = resolveSearchConcurrency(app, useLiveMemory, noNetwork);
    assertSearchActive(app, guardCurrent, runId, signal);
    const batch = chunks.slice(offset, offset + batchSize);
    const firstChunk = batch[0];
    const now = Date.now();
    if (status && app.els.nsearchStatus && (firstChunk === chunks[0] || now - lastStatusAt >= SEARCH_STATUS_INTERVAL_MS)) {
      app.els.nsearchStatus.textContent = formatSearchProgress(stats, results.length, false);
      lastStatusAt = now;
    }
    const fetchStartedAt = searchAdaptiveNow();
    const resolved = await Promise.all(batch.map(chunk => resolveSearchChunkText(app, c, chunk, { useLiveMemory, noNetwork, signal })));
    applySearchAdaptiveStats(stats, recordSearchAdaptiveFeedback(app, { kind:'fetch', elapsedMs: searchAdaptiveNow() - fetchStartedAt, count: batch.length }));
    offset += batchSize;
    const matchPayloads = [];
    for (const item of resolved.sort((a, b) => (Number(a.chunk) || 0) - (Number(b.chunk) || 0))) {
      assertSearchActive(app, guardCurrent, runId, signal);
      const chunk = Math.max(1, Number(item.chunk) || 1);
      if (item.skip === 'cache-only') { recordCacheOnlySkip(stats, chunk); commitSearchStats(app, stats); continue; }
      if (item.skip === 'offline') { recordOfflineSkip(stats, chunk); commitSearchStats(app, stats); continue; }
      if (item.error) { recordFailedChunk(stats, chunk, item.error); commitSearchStats(app, stats); continue; }
      const text = String(item.text || '');
      const source = item.source || 'memory';
      c.totalChunks = Math.max(Number(c.totalChunks) || 1, Number(item.totalChunks) || 0) || c.totalChunks;
      stats.totalChunksByEpisode = stats.totalChunksByEpisode || {};
      stats.totalChunksByEpisode[String(c.episode?.id || 'single')] = Math.max(Number(stats.totalChunksByEpisode[String(c.episode?.id || 'single')]) || 0, Number(c.totalChunks) || 0);
      if (stats.searchScope !== 'novel-episodes') { stats.totalChunks = Math.max(Number(stats.totalChunks) || 0, Number(c.totalChunks) || 0); stats.expectedChunks = stats.totalChunks; }
      recordSearchSource(stats, source);
      if (source === 'network') stats.searchScanContentRequests = (Number(stats.searchScanContentRequests) || 0) + 1;
      stats.scannedChunks += 1;
      stats.processedChunks += 1;
      stats.lastScannedChunk = chunk;
      stats.updatedAt = Date.now();
      if (results.length + matchPayloads.length < MAX_RESULTS) {
        matchPayloads.push({ chunk, title:c.title, content:text, totalChunks:c.totalChunks, novelId:c.novel?.id || '', episodeId:c.episode?.id || null, episodeTitle:c.episode?.title || '', episodeIndex:Number(c.episodeIdx) || 0, episodeCount:Math.max(1, Number(c.novel?.episodes?.length) || 1), __searchSource:source });
      } else {
        stats.resultLimitReached = true;
        if (!stats.resultLimitReachedAtChunk) stats.resultLimitReachedAtChunk = chunk;
      }
      commitSearchStats(app, stats);
    }
    if (matchPayloads.length) {
      const remaining = MAX_RESULTS - results.length;
      const workerResults = await collectMatchesBatchWithOptionalWorker(app, matchPayloads, q, c, remaining, stats, signal);
      if (workerResults.length) {
        results.push(...workerResults.slice(0, Math.max(0, remaining)));
        stats.resultCount = results.length;
        if (results.length >= MAX_RESULTS && !stats.resultLimitReached) {
          stats.resultLimitReached = true;
          stats.resultLimitReachedAtChunk = matchPayloads[Math.min(matchPayloads.length - 1, Math.max(0, resolveAdaptiveSearchWorkerBatchSize(app) - 1))]?.chunk || stats.lastScannedChunk || 0;
        }
      }
      commitSearchStats(app, stats);
    }
    commitSearchResults(app, results, runId);
    await yieldToUi(app, guardCurrent, runId, signal);
  }
}

async function resolveSearchChunkText(app, c, chunk, { useLiveMemory = false, noNetwork = false, signal = null } = {}) {
  const safeChunk = Math.max(1, Number(chunk) || 1);
  try {
    const loaded = useLiveMemory ? app.state.loadedChunks?.get?.(safeChunk) : null;
    let text = useLiveMemory ? app.state.chunkTextCache.get(safeChunk) : null;
    let source = text == null ? '' : 'memory';

    if (useLiveMemory && text == null && loaded && loaded.content != null) {
      text = String(loaded.content || '');
      source = 'loaded';
      app.state.chunkTextCache.set(safeChunk, text);
      limitMapSize(app.state.chunkTextCache, MAX_SEARCH_TEXT_CACHE, Array.from(app.state.loadedChunks.keys()));
    }

    let totalChunks = Number(c?.totalChunks) || safeChunk;
    if (text == null) {
      let data = await readChunkPayloadFromCache(app, c, safeChunk);
      if (data) {
        source = 'reader-cache';
      } else {
        if (noNetwork) return { chunk:safeChunk, skip:'cache-only' };
        if (isBrowserOffline()) return { chunk:safeChunk, skip:'offline' };
        data = await app.api.content({ novelId:c.novel.id, episodeId:c.episode?.id || null, chunk:safeChunk, preprocess:app.state.prefs.preprocess }, { signal, headers: { [SEARCH_SCAN_REQUEST_HEADER]: '1' } });
        source = 'network';
        writeChunkPayloadToCache(app, c, Number(data.currentChunk) || safeChunk, data).catch(() => {});
      }
      text = String(data.content || '');
      totalChunks = Number(data.totalChunks) || totalChunks;
      if (useLiveMemory) {
        app.state.chunkTextCache.set(safeChunk, text);
        limitMapSize(app.state.chunkTextCache, MAX_SEARCH_TEXT_CACHE, Array.from(app.state.loadedChunks.keys()));
      }
    }
    return { chunk:safeChunk, text, source, totalChunks };
  } catch (error) {
    if (error && error.name === 'AbortError') throw error;
    return { chunk:safeChunk, error };
  }
}

function resolveSearchConcurrency(app, useLiveMemory = false, noNetwork = false) {
  return resolveAdaptiveSearchConcurrency(app, { useLiveMemory, noNetwork });
}


async function collectMatchesWithOptionalWorker(app, chunkPayload, q, current, limit, stats, signal) {
  return collectMatchesBatchWithOptionalWorker(app, [chunkPayload], q, current, limit, stats, signal);
}

async function collectMatchesBatchWithOptionalWorker(app, chunkPayloads, q, current, limit, stats, signal) {
  const chunks = (Array.isArray(chunkPayloads) ? chunkPayloads : []).filter(Boolean);
  if (limit <= 0 || !chunks.length) return [];
  const out = [];
  const client = getSearchWorkerClient(app, stats);
  for (let offset = 0; offset < chunks.length && out.length < limit;) {
    const adaptiveBatchSize = Math.max(1, resolveAdaptiveSearchWorkerBatchSize(app));
    const capped = chunks.slice(offset, offset + adaptiveBatchSize);
    offset += adaptiveBatchSize;
    const remaining = Math.max(0, limit - out.length);
    const fallback = () => collectMatches(app, capped, q, current, remaining);
    if (!client) {
      out.push(...fallback());
      continue;
    }
    try {
      const workerStartedAt = searchAdaptiveNow();
      const raw = await client.match({ chunks: capped, query:q, limit:remaining }, signal);
      applySearchAdaptiveStats(stats, recordSearchAdaptiveFeedback(app, { kind:'worker', elapsedMs: Number(raw?.elapsedMs) || (searchAdaptiveNow() - workerStartedAt), count: capped.length }));
      const workerResults = normalizeWorkerMatchResults(app, current, Array.isArray(raw?.results) ? raw.results : []);
      stats.searchWorkerClientPass = SEARCH_WORKER_CLIENT_PASS;
      stats.workerBatchPass = SEARCH_WORKER_BATCH_PASS;
      stats.workerBatchSchedulePass = SEARCH_WORKER_BATCH_SCHEDULE_PASS;
      stats.workerBatches = (Number(stats.workerBatches) || 0) + 1;
      stats.workerBatchChunks = (Number(stats.workerBatchChunks) || 0) + capped.length;
      stats.workerMaxBatchSize = Math.max(Number(stats.workerMaxBatchSize) || 0, capped.length);
      if (app?.state?.search?.searchWorkerWarmStart) stats.searchWorkerWarmStart = app.state.search.searchWorkerWarmStart;
      stats.workerChunks = (Number(stats.workerChunks) || 0) + capped.length;
      stats.workerMatches = (Number(stats.workerMatches) || 0) + workerResults.length;
      out.push(...workerResults.slice(0, remaining));
    } catch (error) {
      stats.workerFallbacks = (Number(stats.workerFallbacks) || 0) + capped.length;
      stats.workerUnavailable = error?.message || String(error || 'worker unavailable');
      out.push(...fallback());
    }
  }
  return out;
}

function normalizeWorkerMatchResults(app, current, results = []) {
  return (Array.isArray(results) ? results : []).map(result => {
    const chunkNumber = Math.max(1, Math.round(Number(result?.chunk) || 1));
    const totalChunks = Math.max(1, Number(result?.totalChunks) || Number(current?.totalChunks) || chunkNumber);
    const episodeIndex = Number.isFinite(Number(result?.episodeIndex)) ? Math.max(0, Math.round(Number(result.episodeIndex))) : Math.max(0, Number(current?.episodeIdx) || 0);
    const episodeCount = Math.max(1, Number(result?.episodeCount) || Number(current?.novel?.episodes?.length) || 1);
    const textLength = Math.max(0, Number(result?.textLength) || 0);
    const index = Math.max(0, Number(result?.index) || 0);
    return {
      ...result,
      chunk: chunkNumber,
      totalChunks,
      episodeIndex,
      episodeCount,
      index,
      textLength,
      resultFieldValidationPass: result?.resultFieldValidationPass || SEARCH_RESULT_FIELD_VALIDATION_PASS,
      searchWorkerClientPass: SEARCH_WORKER_CLIENT_PASS,
      documentRatio: resolveSearchDocumentRatio(app, current, {
        episodeId: Object.prototype.hasOwnProperty.call(result || {}, 'episodeId') ? result.episodeId : (current?.episode?.id || null),
        episodeIndex,
        episodeCount,
        chunkNumber,
        totalChunks,
        index,
        textLength
      })
    };
  });
}

function getSearchWorkerClient(app, stats = null) {
  const search = app?.state?.search || null;
  if (!search) return null;
  if (search.workerDisabled) return null;
  if (search.workerClient?.pass === SEARCH_WORKER_CLIENT_PASS && typeof search.workerClient.match === 'function') return search.workerClient;
  if (typeof Worker === 'undefined') {
    if (stats) stats.workerUnavailable = 'Worker API unavailable';
    return null;
  }
  try {
    let nextId = 0;
    const pending = new Map();
    const worker = new Worker(SEARCH_WORKER_SCRIPT_URL, { name:'txt-reader-search-worker' });
    const rejectAll = error => {
      for (const entry of pending.values()) entry.reject(error);
      pending.clear();
    };
    const client = {
      pass: SEARCH_WORKER_CLIENT_PASS,
      match(payload, signal = null) {
        if (signal?.aborted) return Promise.reject(new DOMException('검색 취소', 'AbortError'));
        const id = ++nextId;
        return new Promise((resolve, reject) => {
          const cleanup = () => signal?.removeEventListener?.('abort', onAbort);
          const onAbort = () => {
            pending.delete(id);
            cleanup();
            reject(new DOMException('검색 취소', 'AbortError'));
            if (pending.size === 0) {
              search.searchWorkerAbortTerminatePass = SEARCH_WORKER_ABORT_TERMINATE_PASS;
              try { worker.terminate?.(); } catch {}
              if (search.workerClient === client) search.workerClient = null;
            }
          };
          pending.set(id, {
            resolve(value) { cleanup(); resolve(value); },
            reject(error) { cleanup(); reject(error); }
          });
          signal?.addEventListener?.('abort', onAbort, { once:true });
          worker.postMessage({ id, type:'match', ...payload });
        });
      },
      terminate() {
        rejectAll(new Error('search worker terminated'));
        worker.terminate?.();
      }
    };
    const requestBuildReload = () => {
      globalThis.__TXT_READER_REQUIRE_UPDATE__?.({ source:'search-worker-build-mismatch' });
      globalThis.dispatchEvent?.(new CustomEvent('txt-reader:build-update-required', { detail:{ source:'search-worker-build-mismatch' } }));
    };
    worker.onmessage = event => {
      const data = event?.data || {};
      if (data.type === 'TXT_READER_BUILD_MISMATCH') {
        requestBuildReload();
        rejectAll(new Error('TXT_READER_BUILD_MISMATCH'));
        try { worker.terminate?.(); } catch {}
        return;
      }
      const entry = pending.get(data.id);
      if (!entry) return;
      pending.delete(data.id);
      if (data.ok) entry.resolve(data);
      else entry.reject(new Error(data.error || 'search worker failed'));
    };
    worker.onerror = event => {
      const message = event?.message || 'search worker error';
      if (String(message).includes('TXT_READER_BUILD_MISMATCH')) requestBuildReload();
      search.workerDisabled = true;
      search.workerUnavailable = message;
      rejectAll(new Error(message));
      try { worker.terminate?.(); } catch {}
    };
    search.workerClient = client;
    search.searchWorkerClientPass = SEARCH_WORKER_CLIENT_PASS;
    return client;
  } catch (error) {
    search.workerDisabled = true;
    search.workerUnavailable = error?.message || String(error || 'search worker unavailable');
    if (stats) stats.workerUnavailable = search.workerUnavailable;
    return null;
  }
}

function commitSearchResults(app, results, runId, options = {}) {
  const search = app?.state?.search;
  if (!search || runId !== search.runId) return;
  const now = Date.now();
  const force = !!options.force;
  const lastAt = Number(search.lastResultEventAt) || 0;
  if (!force && lastAt && now - lastAt < SEARCH_RESULT_PROGRESS_INTERVAL_MS) return;
  search.results = sortAndDedupeResults(results);
  search.resultCount = search.results.length;
  search.incrementalResultsPass = SEARCH_INCREMENTAL_RESULTS_PASS;
  search.concurrentFetchPass = SEARCH_CONCURRENT_FETCH_PASS;
  search.lastResultEventAt = now;
  try {
    window.dispatchEvent(new CustomEvent('txt-reader-search-results', { detail: { count: search.results.length, pass: SEARCH_INCREMENTAL_RESULTS_PASS } }));
  } catch {}
}

function commitSearchStats(app, stats, options = {}) {
  if (!app?.state?.search) return;
  const now = Date.now();
  const force = !!options.force || !!stats.done;
  const lastEventAt = Number(app.state.search.lastStatsEventAt) || 0;
  stats.statCommitEvents = Number(stats.statCommitEvents) || 0;
  stats.statCommitCoalesced = Number(stats.statCommitCoalesced) || 0;
  app.state.search.stats = cloneStats(stats);
  if (!force && lastEventAt && now - lastEventAt < SEARCH_STATUS_INTERVAL_MS) {
    stats.statCommitCoalesced += 1;
    app.state.search.stats.statCommitCoalesced = stats.statCommitCoalesced;
    return;
  }
  stats.statCommitEvents += 1;
  app.state.search.lastStatsEventAt = now;
  app.state.search.stats.statCommitEvents = stats.statCommitEvents;
  try {
    window.dispatchEvent(new CustomEvent('txt-reader-search-stats', { detail: app.state.search.stats }));
  } catch {}
}

function cloneStats(stats) {
  return {
    ...stats,
    failedChunkList: Array.isArray(stats.failedChunkList) ? stats.failedChunkList.slice() : [],
    skippedOfflineChunkList: Array.isArray(stats.skippedOfflineChunkList) ? stats.skippedOfflineChunkList.slice() : [],
    skippedCacheOnlyChunkList: Array.isArray(stats.skippedCacheOnlyChunkList) ? stats.skippedCacheOnlyChunkList.slice() : [],
    retryChunks: Array.isArray(stats.retryChunks) ? stats.retryChunks.slice() : [],
    completeScanPass: stats.completeScanPass || SEARCH_ALL_CHUNKS_COMPLETE_SCAN_PASS,
    fullSearchDiagnosticsPass: stats.fullSearchDiagnosticsPass || SEARCH_FULL_SCAN_DIAGNOSTICS_PASS,
    resultFieldValidationPass: stats.resultFieldValidationPass || SEARCH_RESULT_FIELD_VALIDATION_PASS,
    searchWorkerClientPass: stats.searchWorkerClientPass || '',
    workerChunks: Number(stats.workerChunks) || 0,
    workerMatches: Number(stats.workerMatches) || 0,
    workerFallbacks: Number(stats.workerFallbacks) || 0,
    workerUnavailable: stats.workerUnavailable || '',
    workerBatchPass: stats.workerBatchPass || SEARCH_WORKER_BATCH_PASS,
    workerBatchSchedulePass: stats.workerBatchSchedulePass || SEARCH_WORKER_BATCH_SCHEDULE_PASS,
    workerBatches: Number(stats.workerBatches) || 0,
    workerBatchChunks: Number(stats.workerBatchChunks) || 0,
    workerMaxBatchSize: Number(stats.workerMaxBatchSize) || SEARCH_WORKER_BATCH_SIZE_MAX,
    fullScanConcurrencyTunePass: stats.fullScanConcurrencyTunePass || SEARCH_FULL_SCAN_CONCURRENCY_TUNE_PASS,
    liveFullScanConcurrencyPass: stats.liveFullScanConcurrencyPass || SEARCH_LIVE_FULL_SCAN_CONCURRENCY_PASS,
    multiEpisodeTargetConcurrencyPass: stats.multiEpisodeTargetConcurrencyPass || SEARCH_MULTI_EPISODE_TARGET_CONCURRENCY_PASS,
    workerBatchSizeTunePass: stats.workerBatchSizeTunePass || SEARCH_WORKER_BATCH_SIZE_TUNE_PASS,
    fullScanConcurrency: Number(stats.fullScanConcurrency) || SEARCH_FULL_SCAN_CONCURRENCY_MAX,
    liveFullScanConcurrency: Number(stats.liveFullScanConcurrency) || SEARCH_LIVE_FULL_SCAN_CONCURRENCY_MAX,
    multiEpisodeTargetConcurrency: Number(stats.multiEpisodeTargetConcurrency) || 1,
    workerBatchSize: Number(stats.workerBatchSize) || SEARCH_WORKER_BATCH_SIZE_MAX,
    adaptiveSearchProfilePass: stats.adaptiveSearchProfilePass || '',
    adaptiveSearchFeedbackPass: stats.adaptiveSearchFeedbackPass || '',
    adaptiveSearchInputPressurePass: stats.adaptiveSearchInputPressurePass || '',
    adaptiveSearchClientTier: stats.adaptiveSearchClientTier || '',
    adaptiveSearchPressureEvents: Number(stats.adaptiveSearchPressureEvents) || 0,
    adaptiveSearchFeedbackEvents: Number(stats.adaptiveSearchFeedbackEvents) || 0,
    adaptiveSearchLastFeedback: stats.adaptiveSearchLastFeedback || null,
    adaptiveSearchLastAdjustment: stats.adaptiveSearchLastAdjustment || null,
    searchCacheManifestPass: stats.searchCacheManifestPass || '',
    searchCacheManifestChunks: Number(stats.searchCacheManifestChunks) || 0,
    searchCacheManifestMatchedChunks: Number(stats.searchCacheManifestMatchedChunks) || 0,
    searchWorkerWarmStartPass: SEARCH_WORKER_WARM_START_PASS,
    searchWorkerWarmStart: stats.searchWorkerWarmStart || null,
    searchWorkerAbortTerminatePass: stats.searchWorkerAbortTerminatePass || ''
  };
}

function recordSearchSource(stats, source) {
  if (source === 'loaded') stats.loadedChunks += 1;
  else if (source === 'reader-cache') stats.cacheChunks += 1;
  else if (source === 'network') stats.networkChunks += 1;
  else stats.memoryChunks += 1;
}

function recordOfflineSkip(stats, chunk) {
  stats.skippedOfflineChunks += 1;
  stats.processedChunks += 1;
  stats.lastSkippedChunk = chunk;
  if (!stats.skippedOfflineChunkList.includes(chunk)) stats.skippedOfflineChunkList.push(chunk);
  stats.updatedAt = Date.now();
}

function recordCacheOnlySkip(stats, chunk) {
  stats.skippedCacheOnlyChunks += 1;
  stats.processedChunks += 1;
  stats.lastSkippedChunk = chunk;
  if (!stats.skippedCacheOnlyChunkList.includes(chunk)) stats.skippedCacheOnlyChunkList.push(chunk);
  stats.updatedAt = Date.now();
}

function recordFailedChunk(stats, chunk, error) {
  stats.failedChunks += 1;
  stats.processedChunks += 1;
  stats.lastError = error?.message || String(error);
  stats.lastFailedChunk = chunk;
  if (!stats.failedChunkList.includes(chunk)) stats.failedChunkList.push(chunk);
  stats.updatedAt = Date.now();
}

function sortAndDedupeResults(results) {
  const seen = new Set();
  return (Array.isArray(results) ? results : [])
    .slice()
    .sort((a, b) => (Number(a.episodeIndex) || 0) - (Number(b.episodeIndex) || 0) || (Number(a.chunk) || 0) - (Number(b.chunk) || 0) || (Number(a.index) || 0) - (Number(b.index) || 0))
    .filter(item => {
      const key = [item.novelId || '', item.episodeId || '', item.chunk || 0, item.index || 0, item.query || ''].join('::');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildSequentialChunkList(start, end) {
  const first = Math.max(1, Math.round(Number(start) || 1));
  const last = Math.max(first - 1, Math.round(Number(end) || 0));
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => first + index);
}

function buildMissingChunkList(total, availableSet) {
  const out = [];
  const max = Math.max(0, Number(total) || 0);
  for (let chunk = 1; chunk <= max; chunk += 1) {
    if (!availableSet.has(chunk)) out.push(chunk);
  }
  return out;
}

function normalizeChunkList(chunks, total) {
  const out = [];
  const seen = new Set();
  (Array.isArray(chunks) ? chunks : []).forEach(value => {
    const chunk = Math.max(1, Math.min(total, Math.round(Number(value) || 0)));
    if (!chunk || seen.has(chunk)) return;
    seen.add(chunk);
    out.push(chunk);
  });
  return out.sort((a, b) => a - b);
}

function isBrowserOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function sleepFrame() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function getSearchRootNovelId(current = null) {
  return String(current?.novel?.id || current?.novelId || '');
}

function isSameSearchRoot(app, rootCurrent = null) {
  const rootNovelId = getSearchRootNovelId(rootCurrent);
  if (!rootNovelId) return rootCurrent === app?.state?.current;
  return rootNovelId === getSearchRootNovelId(app?.state?.current);
}

function assertSearchActive(app, current, runId, signal) {
  if (signal?.aborted || runId !== app.state.search.runId || !isSameSearchRoot(app, current)) {
    throw new DOMException('검색 취소', 'AbortError');
  }
  if (app?.state?.search) app.state.search.continueDuringNavigationPass = SEARCH_CONTINUE_DURING_NAVIGATION_PASS;
}

function yieldToUi(app, current, runId, signal) {
  return new Promise((resolve, reject) => {
    const finish = () => {
      try {
        assertSearchActive(app, current, runId, signal);
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException('검색 취소', 'AbortError'));
    };
    let timer = 0;
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      signal?.removeEventListener?.('abort', onAbort);
    };
    signal?.addEventListener?.('abort', onAbort, { once: true });
    timer = setTimeout(() => {
      cleanup();
      finish();
    }, 0);
  });
}
