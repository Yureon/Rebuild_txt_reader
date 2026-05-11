import { REBUILD_VERSION } from '../../core/utils.mjs';
import { buildReaderCacheDiagnosticsSnapshot, buildReaderCacheNovelStatsSnapshot, buildReaderCacheUnavailableDiagnostics, buildReaderCacheUnavailableNovelStats } from './cache-diagnostics.mjs';
import { summarizeReaderCacheRecordForPrune } from './cache-record-formatters.mjs';
import { buildCurrentReaderCacheProtectionSet, buildReaderCachePrunePlan, clampReaderCacheLimit, normalizeReaderCacheChunkDeleteSet } from './cache-prune-plan.mjs';
import { buildReaderCachePruneDiagnosticsView } from './cache-prune-diagnostics.mjs';

const DB_NAME = 'txt-reader-rebuild-reader-cache';
const DB_VERSION = 2;
const CHUNK_STORE = 'chunks';
const META_STORE = 'meta';
const SEARCH_MANIFEST_STORE = 'searchManifests';
const CACHE_SCHEMA = 'reader-chunk-v1';
const SEARCH_CACHE_MANIFEST_SCHEMA = 'search-cache-manifest-v1';
export const SEARCH_CACHE_MANIFEST_PASS = 'v400-search-cache-manifest-pass';
export const READER_MULTI_FILE_CACHED_TOTAL_CHUNKS_GUARD_PASS = 'v424-reader-multi-file-cached-total-chunks-guard-pass';
export const READER_MULTI_FILE_CURRENT_CACHE_TOTAL_CHUNKS_GUARD_PASS = 'v424-reader-multi-file-current-cache-totalchunks-guard-pass';
const DEFAULT_MAX_ENTRIES = 360;
const DEFAULT_MAX_BYTES = 96 * 1024 * 1024;
const PRUNE_INTERVAL_MS = 60_000;

let dbPromise = null;
let disabled = false;
let prunePromise = null;
let scheduledPruneHandle = 0;
let scheduledPruneIsIdle = false;

export function isReaderCacheAvailable() {
  return !disabled && typeof indexedDB !== 'undefined';
}

export function getPreprocessSignature(preprocess = {}) {
  const p = preprocess || {};
  return [
    ['removeNoise', p.removeNoise],
    ['chapterSpacing', p.chapterSpacing],
    ['collapseBreaks', p.collapseBreaks],
    ['splitDense', p.splitDense],
    ['dialogueBreak', p.dialogueBreak],
    ['paragraphOptimize', p.paragraphOptimize],
    ['aggressive', p.aggressive]
  ].map(([key, value]) => `${key}:${value ? 1 : 0}`).join('|');
}

export function getContentIdentity(current = {}) {
  const novel = current.novel || {};
  const episode = current.episode || {};
  return [
    CACHE_SCHEMA,
    novel.id || '',
    novel.path || '',
    novel.filePath || '',
    novel.fileName || '',
    novel.size || '',
    novel.mtime || novel.modifiedAt || novel.updatedAt || '',
    episode.id || 'single',
    episode.path || '',
    episode.filePath || '',
    episode.fileName || '',
    episode.size || '',
    episode.mtime || episode.modifiedAt || episode.updatedAt || ''
  ].join('::');
}

export function makeChunkCacheKey(current, chunk, preprocess = {}) {
  const novelId = current?.novel?.id || '';
  const episodeId = current?.episode?.id || 'single';
  const chunkIndex = Math.max(1, Number(chunk) || 1);
  const signature = getPreprocessSignature(preprocess);
  const identity = getContentIdentity(current);
  const id = [CACHE_SCHEMA, novelId, episodeId, chunkIndex, signature, hashString(identity)].join('::');
  return { id, novelId, episodeId, chunk: chunkIndex, preprocessSignature: signature, contentIdentity: identity };
}

export async function readChunkPayloadFromCache(app, current, chunk) {
  if (!shouldUseCache(app) || Number(chunk) === -1) return null;
  const key = makeChunkCacheKey(current, chunk, app.state.prefs.preprocess);
  try {
    const db = await openDb();
    const record = await idbGet(db, CHUNK_STORE, key.id);
    if (!record || record.schema !== CACHE_SCHEMA) return null;
    const staleBypass = shouldBypassStaleMultiFileTotalChunks(app, current, record);
    if (staleBypass) {
      app.state.readerStaleMultiFileCacheBypass = {
        pass: staleBypass.pass || READER_MULTI_FILE_CACHED_TOTAL_CHUNKS_GUARD_PASS,
        novelId: current?.novel?.id || '',
        episodeId: current?.episode?.id || '',
        chunk: Number(record.chunk) || Number(chunk) || 1,
        recordTotalChunks: Number(record.totalChunks) || 0,
        currentTotalChunks: Number(current?.totalChunks) || 0,
        recordVersion: record.appVersion || '',
        reason: staleBypass.reason || 'stale-multi-file-total-chunks',
        at: Date.now()
      };
      return null;
    }
    const content = String(record.content || '');
    const payload = {
      currentChunk: record.chunk,
      totalChunks: Number(record.totalChunks) || Number(current?.totalChunks) || 1,
      title: record.title || current?.title || '',
      content,
      __fromReaderCache: true,
      __cachedAt: record.updatedAt,
      __blocks: Array.isArray(record.blocks) ? record.blocks : null
    };
    record.lastAccessedAt = Date.now();
    idbPut(db, CHUNK_STORE, record).catch(() => {});
    touchSearchCacheManifestRecord(db, app, current, record.chunk, record.totalChunks, { source: 'reader-cache' }).catch(() => {});
    return payload;
  } catch (error) {
    disableOnError(error);
    return null;
  }
}


function shouldBypassStaleMultiFileTotalChunks(app, current, record) {
  if (!current?.novel?.isMultiFile || !current?.episode) return null;
  const recordTotal = Number(record?.totalChunks) || 0;
  const currentTotal = Number(current?.totalChunks) || 0;
  const manifestTotal = Number(app?.state?.readerCoordinates?.manifest?.totalChunks) || 0;
  const recordVersion = String(record?.appVersion || '');
  if (recordTotal > 1 || currentTotal > 1 || manifestTotal > 1) return null;
  if (recordVersion !== REBUILD_VERSION) {
    return { pass: READER_MULTI_FILE_CACHED_TOTAL_CHUNKS_GUARD_PASS, reason: 'pre-v424-multi-file-totalchunks-cache' };
  }
  return { pass: READER_MULTI_FILE_CURRENT_CACHE_TOTAL_CHUNKS_GUARD_PASS, reason: 'current-version-multi-file-totalchunks-unverified' };
}

export async function writeChunkPayloadToCache(app, current, chunk, payload, blocks = null) {
  if (!shouldUseCache(app) || Number(chunk) === -1 || !payload) return false;
  const content = String(payload.content || '');
  if (!content && !Array.isArray(blocks)) return false;
  const key = makeChunkCacheKey(current, chunk, app.state.prefs.preprocess);
  const now = Date.now();
  const record = {
    ...key,
    schema: CACHE_SCHEMA,
    appVersion: REBUILD_VERSION,
    title: payload.title || current?.title || '',
    totalChunks: Number(payload.totalChunks) || Number(current?.totalChunks) || 1,
    content,
    blocks: Array.isArray(blocks) ? blocks : Array.isArray(payload.__blocks) ? payload.__blocks : null,
    bytes: estimateBytes(content, blocks || payload.__blocks),
    createdAt: now,
    updatedAt: now,
    lastAccessedAt: now
  };
  try {
    const db = await openDb();
    await putChunkRecordWithQuotaRecovery(db, record);
    await touchSearchCacheManifestRecord(db, app, current, record.chunk, record.totalChunks, { source: 'reader-cache' }).catch(() => false);
    schedulePrune(app, db);
    return true;
  } catch (error) {
    disableOnError(error);
    return false;
  }
}

export async function pruneReaderCache(app, { maxEntries = DEFAULT_MAX_ENTRIES, maxBytes = DEFAULT_MAX_BYTES, force = false } = {}) {
  if (!shouldUseCache(app)) return { removed: 0, bytes: 0 };
  const now = Date.now();
  if (!force && app.state.readerCacheLastPrune && now - app.state.readerCacheLastPrune < PRUNE_INTERVAL_MS) {
    return { removed: 0, bytes: 0, skipped: true };
  }
  app.state.readerCacheLastPrune = now;
  try {
    const db = await openDb();
    return await runPruneDb(db, { maxEntries, maxBytes });
  } catch (error) {
    disableOnError(error);
    return { removed: 0, bytes: 0, error };
  }
}

export async function clearReaderCache() {
  if (!isReaderCacheAvailable()) return false;
  try {
    cancelScheduledPrune();
    const db = await openDb();
    await Promise.all([idbClear(db, CHUNK_STORE), idbClear(db, META_STORE), idbClear(db, SEARCH_MANIFEST_STORE)]);
    return true;
  } catch (error) {
    disableOnError(error);
    return false;
  }
}

export async function deleteReaderCacheChunks(app, current = app?.state?.current, chunks = [], options = {}) {
  if (!isReaderCacheAvailable()) return { available: false, removed: 0, bytes: 0, chunks: [] };
  const novelId = String(current?.novel?.id || '');
  if (!novelId) return { available: true, removed: 0, bytes: 0, chunks: [] };
  const episodeId = String(current?.episode?.id || 'single');
  const totalChunks = Math.max(1, Number(current?.totalChunks) || 1);
  const selected = normalizeReaderCacheChunkDeleteSet(chunks, totalChunks, options);
  const deleteAllForCurrent = !!options.allForCurrent;
  if (!deleteAllForCurrent && !selected.size) return { available: true, removed: 0, bytes: 0, chunks: [] };
  try {
    cancelScheduledPrune();
    const db = await openDb();
    const records = await idbGetAll(db, CHUNK_STORE);
    let removed = 0;
    let bytes = 0;
    const removedChunks = new Set();
    for (const record of records) {
      if (String(record?.novelId || '') !== novelId) continue;
      if (String(record?.episodeId || 'single') !== episodeId) continue;
      const chunk = Math.max(1, Math.round(Number(record?.chunk) || 0));
      if (!deleteAllForCurrent && !selected.has(chunk)) continue;
      await idbDelete(db, CHUNK_STORE, record.id);
      removed += 1;
      bytes += Number(record?.bytes) || 0;
      if (chunk) removedChunks.add(chunk);
    }
    return { available: true, removed, bytes, chunks: Array.from(removedChunks).sort((a, b) => a - b) };
  } catch (error) {
    disableOnError(error);
    return { available: false, removed: 0, bytes: 0, chunks: [], error: error?.message || String(error) };
  }
}

export function deleteReaderCacheForCurrent(app, current = app?.state?.current) {
  return deleteReaderCacheChunks(app, current, [], { allForCurrent: true });
}

export async function getReaderCacheStats() {
  if (!isReaderCacheAvailable()) return { available: false, entries: 0, bytes: 0 };
  try {
    const db = await openDb();
    const records = await idbGetAll(db, CHUNK_STORE);
    return {
      available: true,
      entries: records.length,
      bytes: records.reduce((sum, row) => sum + (Number(row.bytes) || 0), 0)
    };
  } catch (error) {
    disableOnError(error);
    return { available: false, entries: 0, bytes: 0, error: error?.message || String(error) };
  }
}

export async function getReaderCacheDiagnostics(app, current = app?.state?.current) {
  const prune = getReaderCachePruneDiagnostics(app);
  if (!isReaderCacheAvailable()) return buildReaderCacheUnavailableDiagnostics({ disabled, prune });
  try {
    const db = await openDb();
    const records = await idbGetAll(db, CHUNK_STORE);
    return buildReaderCacheDiagnosticsSnapshot(app, records, current, {
      currentSignature: getPreprocessSignature(app?.state?.prefs?.preprocess || {}),
      prune
    });
  } catch (error) {
    disableOnError(error);
    return buildReaderCacheUnavailableDiagnostics({ disabled, prune, error: error?.message || String(error) });
  }
}
export async function getReaderCacheNovelStats(app) {
  if (!isReaderCacheAvailable()) return buildReaderCacheUnavailableNovelStats({ disabled });
  try {
    const db = await openDb();
    const records = await idbGetAll(db, CHUNK_STORE);
    return buildReaderCacheNovelStatsSnapshot(app, records, {
      currentSignature: getPreprocessSignature(app?.state?.prefs?.preprocess || {})
    });
  } catch (error) {
    disableOnError(error);
    return buildReaderCacheUnavailableNovelStats({ disabled, error: error?.message || String(error) });
  }
}
export function getReaderCachePruneDiagnostics(app) {
  return buildReaderCachePruneDiagnosticsView({
    defaultMaxEntries: DEFAULT_MAX_ENTRIES,
    defaultMaxBytes: DEFAULT_MAX_BYTES,
    intervalMs: PRUNE_INTERVAL_MS,
    lastPruneAt: app?.state?.readerCacheLastPrune,
    scheduled: scheduledPruneHandle,
    scheduledIsIdle: scheduledPruneIsIdle,
    running: prunePromise
  });
}


export function getReaderCacheDefaultPruneLimits() {
  return {
    maxEntries: DEFAULT_MAX_ENTRIES,
    maxBytes: DEFAULT_MAX_BYTES,
    intervalMs: PRUNE_INTERVAL_MS
  };
}

export async function planReaderCachePrune(app, options = {}) {
  if (!isReaderCacheAvailable()) {
    return { available: false, entries: 0, bytes: 0, remove: 0, removeBytes: 0, victims: [], protectedEntries: 0, error: disabled ? 'IndexedDB cache disabled' : 'IndexedDB unavailable' };
  }
  try {
    const db = await openDb();
    const records = await idbGetAll(db, CHUNK_STORE);
    return buildReaderCachePrunePlan(app, records, { defaultMaxEntries: DEFAULT_MAX_ENTRIES, defaultMaxBytes: DEFAULT_MAX_BYTES, ...options });
  } catch (error) {
    disableOnError(error);
    return { available: false, entries: 0, bytes: 0, remove: 0, removeBytes: 0, victims: [], protectedEntries: 0, error: error?.message || String(error) };
  }
}

export async function runManualReaderCachePrune(app, options = {}) {
  if (!isReaderCacheAvailable()) return { available: false, removed: 0, bytes: 0, victims: [], error: disabled ? 'IndexedDB cache disabled' : 'IndexedDB unavailable' };
  try {
    cancelScheduledPrune();
    const db = await openDb();
    const records = await idbGetAll(db, CHUNK_STORE);
    const plan = buildReaderCachePrunePlan(app, records, { defaultMaxEntries: DEFAULT_MAX_ENTRIES, defaultMaxBytes: DEFAULT_MAX_BYTES, ...options });
    let removed = 0;
    let bytes = 0;
    for (const victim of plan.victimsFull || []) {
      if (!victim?.id) continue;
      await idbDelete(db, CHUNK_STORE, victim.id);
      removed += 1;
      bytes += Number(victim.bytes) || 0;
    }
    app.state.readerCacheLastPrune = Date.now();
    return {
      available: true,
      removed,
      bytes,
      victims: plan.victims,
      afterEntries: Math.max(0, plan.entries - removed),
      afterBytes: Math.max(0, plan.bytes - bytes),
      protectedEntries: plan.protectedEntries,
      limitedByProtected: plan.limitedByProtected
    };
  } catch (error) {
    disableOnError(error);
    return { available: false, removed: 0, bytes: 0, victims: [], error: error?.message || String(error) };
  }
}

export async function deleteReaderCacheForNovel(app, novelId, options = {}) {
  const targetNovelId = String(novelId || '').trim();
  if (!isReaderCacheAvailable()) return { available: false, removed: 0, bytes: 0, error: disabled ? 'IndexedDB cache disabled' : 'IndexedDB unavailable' };
  if (!targetNovelId) return { available: true, removed: 0, bytes: 0 };
  try {
    cancelScheduledPrune();
    const db = await openDb();
    const records = await idbGetAll(db, CHUNK_STORE);
    const episodeId = options.episodeId == null ? null : String(options.episodeId || 'single');
    const signature = options.preprocessSignature == null ? null : String(options.preprocessSignature || '');
    let removed = 0;
    let bytes = 0;
    const chunks = new Set();
    for (const record of records) {
      if (String(record?.novelId || '') !== targetNovelId) continue;
      if (episodeId != null && String(record?.episodeId || 'single') !== episodeId) continue;
      if (signature != null && String(record?.preprocessSignature || '') !== signature) continue;
      await idbDelete(db, CHUNK_STORE, record.id);
      removed += 1;
      bytes += Number(record?.bytes) || 0;
      const chunk = Math.max(1, Math.round(Number(record?.chunk) || 0));
      if (chunk) chunks.add(chunk);
    }
    const manifest = await deleteSearchCacheManifestsForNovelInDb(db, targetNovelId, { episodeId, preprocessSignature: signature });
    return { available: true, removed, bytes, chunks: Array.from(chunks).sort((a, b) => a - b), searchManifestsRemoved: manifest.removed };
  } catch (error) {
    disableOnError(error);
    return { available: false, removed: 0, bytes: 0, error: error?.message || String(error) };
  }
}


export async function deleteReaderCacheByRule(app, options = {}) {
  if (!isReaderCacheAvailable()) return { available: false, removed: 0, bytes: 0, error: disabled ? 'IndexedDB cache disabled' : 'IndexedDB unavailable' };
  const novelIds = new Set((Array.isArray(options.novelIds) ? options.novelIds : [])
    .map(value => String(value || '').trim())
    .filter(Boolean));
  const hasNovelFilter = novelIds.size > 0;
  const currentSignature = options.currentSignature == null
    ? getPreprocessSignature(app?.state?.prefs?.preprocess || {})
    : String(options.currentSignature || '');
  const staleSignature = !!options.staleSignature;
  const beforeAccessedAt = Math.max(0, Number(options.beforeAccessedAt) || 0);
  const beforeUpdatedAt = Math.max(0, Number(options.beforeUpdatedAt) || 0);
  const protectCurrent = !!options.protectCurrent;
  const protectRadius = clampReaderCacheLimit(options.protectRadius, 8, 0, 200);
  const requireAnyRule = staleSignature || beforeAccessedAt || beforeUpdatedAt || hasNovelFilter;
  if (!requireAnyRule) return { available: true, removed: 0, bytes: 0, chunks: [], error: 'No delete rule specified' };
  try {
    cancelScheduledPrune();
    const db = await openDb();
    const records = await idbGetAll(db, CHUNK_STORE);
    const protectedIds = protectCurrent ? buildCurrentReaderCacheProtectionSet(app, records, protectRadius) : new Set();
    let removed = 0;
    let bytes = 0;
    const chunks = new Set();
    const affectedNovels = new Set();
    const sample = [];
    for (const record of records) {
      const id = String(record?.id || '');
      const novelId = String(record?.novelId || '');
      if (protectedIds.has(id)) continue;
      if (hasNovelFilter && !novelIds.has(novelId)) continue;
      if (staleSignature && String(record?.preprocessSignature || '') === currentSignature) continue;
      if (beforeAccessedAt && (Number(record?.lastAccessedAt) || 0) >= beforeAccessedAt) continue;
      if (beforeUpdatedAt && (Number(record?.updatedAt) || 0) >= beforeUpdatedAt) continue;
      await idbDelete(db, CHUNK_STORE, id);
      removed += 1;
      bytes += Number(record?.bytes) || 0;
      affectedNovels.add(novelId || '(unknown)');
      const chunk = Math.max(1, Math.round(Number(record?.chunk) || 0));
      if (chunk) chunks.add(chunk);
      if (sample.length < 24) sample.push(summarizeReaderCacheRecordForPrune(app, record));
    }
    return {
      available: true,
      removed,
      bytes,
      chunks: Array.from(chunks).sort((a, b) => a - b),
      affectedNovels: Array.from(affectedNovels),
      protectedEntries: protectedIds.size,
      sample
    };
  } catch (error) {
    disableOnError(error);
    return { available: false, removed: 0, bytes: 0, chunks: [], affectedNovels: [], error: error?.message || String(error) };
  }
}



export async function purgeReaderCacheOutsideAllowedNovelIds(app, allowedNovelIds = []) {
  if (!isReaderCacheAvailable()) return { available: false, removed: 0, bytes: 0, error: disabled ? 'IndexedDB cache disabled' : 'IndexedDB unavailable' };
  const allowed = new Set((Array.isArray(allowedNovelIds) ? allowedNovelIds : []).map(value => String(value || '').trim()).filter(Boolean));
  try {
    cancelScheduledPrune();
    const db = await openDb();
    const records = await idbGetAll(db, CHUNK_STORE);
    let removed = 0;
    let bytes = 0;
    const affectedNovels = new Set();
    for (const record of records) {
      const novelId = String(record?.novelId || '').trim();
      if (novelId && allowed.has(novelId)) continue;
      await idbDelete(db, CHUNK_STORE, record.id);
      removed += 1;
      bytes += Number(record?.bytes) || 0;
      affectedNovels.add(novelId || '(unknown)');
    }
    const manifest = await purgeSearchCacheManifestOutsideAllowedNovelIdsInDb(db, allowed);
    for (const novelId of manifest.affectedNovels || []) affectedNovels.add(novelId);
    return { available: true, removed, bytes, affectedNovels: Array.from(affectedNovels).sort(), searchManifestsRemoved: manifest.removed || 0 };
  } catch (error) {
    disableOnError(error);
    return { available: false, removed: 0, bytes: 0, affectedNovels: [], error: error?.message || String(error) };
  }
}


export async function getSearchCacheManifestSnapshot(app, current = app?.state?.current, { signal = null } = {}) {
  if (!current || !shouldUseCache(app)) return buildUnavailableSearchManifestSnapshot(app, current);
  if (signal?.aborted) throw new DOMException('검색 캐시 manifest 확인 취소', 'AbortError');
  try {
    const db = await openDb();
    const key = makeSearchCacheManifestKey(app, current);
    const record = await idbGet(db, SEARCH_MANIFEST_STORE, key.id);
    if (!record || record.schema !== SEARCH_CACHE_MANIFEST_SCHEMA) {
      return buildSearchManifestSnapshotFromRecord(null, key, { available: true });
    }
    record.lastAccessedAt = Date.now();
    idbPut(db, SEARCH_MANIFEST_STORE, record).catch(() => {});
    return buildSearchManifestSnapshotFromRecord(record, key, { available: true });
  } catch (error) {
    disableOnError(error);
    return buildUnavailableSearchManifestSnapshot(app, current, error);
  }
}

export async function purgeSearchCacheManifestOutsideAllowedNovelIds(app, allowedNovelIds = []) {
  if (!isReaderCacheAvailable()) return { available: false, removed: 0, affectedNovels: [], error: disabled ? 'IndexedDB cache disabled' : 'IndexedDB unavailable' };
  const allowed = new Set((Array.isArray(allowedNovelIds) ? allowedNovelIds : []).map(value => String(value || '').trim()).filter(Boolean));
  try {
    const db = await openDb();
    const result = await purgeSearchCacheManifestOutsideAllowedNovelIdsInDb(db, allowed);
    return { available: true, ...result };
  } catch (error) {
    disableOnError(error);
    return { available: false, removed: 0, affectedNovels: [], error: error?.message || String(error) };
  }
}

export async function deleteSearchCacheManifestForNovel(app, novelId, options = {}) {
  const targetNovelId = String(novelId || '').trim();
  if (!isReaderCacheAvailable()) return { available: false, removed: 0, affectedNovels: [], error: disabled ? 'IndexedDB cache disabled' : 'IndexedDB unavailable' };
  if (!targetNovelId) return { available: true, removed: 0, affectedNovels: [] };
  try {
    const db = await openDb();
    const result = await deleteSearchCacheManifestsForNovelInDb(db, targetNovelId, options);
    return { available: true, affectedNovels: result.removed ? [targetNovelId] : [], ...result };
  } catch (error) {
    disableOnError(error);
    return { available: false, removed: 0, affectedNovels: [], error: error?.message || String(error) };
  }
}

export async function getReaderCacheCoverage(app, current, { start = 1, end = 1 } = {}) {
  const totalChunks = Math.max(1, Number(current?.totalChunks) || 1);
  const first = Math.max(1, Math.min(totalChunks, Number(start) || 1));
  const last = Math.max(first, Math.min(totalChunks, Number(end) || first));
  const total = last - first + 1;
  if (!current || !shouldUseCache(app)) {
    return { available: isReaderCacheAvailable(), start:first, end:last, total, cached: 0, missing: total, chunks: [] };
  }
  let cached = 0;
  const chunks = [];
  for (let chunk = first; chunk <= last; chunk += 1) {
    let hit = !!app?.state?.loadedChunks?.has?.(chunk);
    if (!hit) hit = !!(await readChunkPayloadFromCache(app, current, chunk));
    if (hit) cached += 1;
    chunks.push({ chunk, cached: hit });
  }
  return {
    available: true,
    start:first,
    end:last,
    total,
    cached,
    missing: Math.max(0, total - cached),
    chunks
  };
}


function getSearchCacheUserScope(app = {}) {
  const snapshot = app?.state?.userAccessSnapshot || {};
  const userId = String(snapshot.userId || app?.state?.userId || 'anonymous');
  const accessVersion = String(snapshot.accessVersion || 1);
  return { userId, accessVersion };
}

function makeSearchCacheManifestKey(app, current = {}) {
  const chunkKey = makeChunkCacheKey(current, 1, app?.state?.prefs?.preprocess || {});
  const { userId, accessVersion } = getSearchCacheUserScope(app);
  const contentIdentityHash = hashString(chunkKey.contentIdentity);
  const id = [SEARCH_CACHE_MANIFEST_SCHEMA, userId, accessVersion, chunkKey.novelId, chunkKey.episodeId, chunkKey.preprocessSignature, contentIdentityHash].join('::');
  return { ...chunkKey, id, schema: SEARCH_CACHE_MANIFEST_SCHEMA, userId, accessVersion, contentIdentityHash };
}

async function touchSearchCacheManifestRecord(db, app, current, chunk, totalChunks, options = {}) {
  if (!db || !current) return false;
  const safeChunk = Math.max(1, Math.round(Number(chunk) || 1));
  const key = makeSearchCacheManifestKey(app, current);
  if (!key.novelId) return false;
  const now = Date.now();
  const existing = await idbGet(db, SEARCH_MANIFEST_STORE, key.id).catch(() => null);
  const chunks = new Set(Array.isArray(existing?.chunks) ? existing.chunks.map(value => Math.max(1, Math.round(Number(value) || 0))).filter(Boolean) : []);
  chunks.add(safeChunk);
  const record = {
    ...key,
    appVersion: REBUILD_VERSION,
    title: current?.title || existing?.title || '',
    totalChunks: Math.max(1, Number(totalChunks) || Number(existing?.totalChunks) || Number(current?.totalChunks) || safeChunk),
    chunks: Array.from(chunks).sort((a, b) => a - b),
    chunkCount: chunks.size,
    lastSource: options.source || existing?.lastSource || 'reader-cache',
    createdAt: Number(existing?.createdAt) || now,
    updatedAt: now,
    lastAccessedAt: now
  };
  await idbPut(db, SEARCH_MANIFEST_STORE, record);
  return true;
}

function buildSearchManifestSnapshotFromRecord(record, key = {}, options = {}) {
  const chunks = Array.isArray(record?.chunks) ? record.chunks.map(value => Math.max(1, Math.round(Number(value) || 0))).filter(Boolean) : [];
  return {
    pass: SEARCH_CACHE_MANIFEST_PASS,
    available: options.available !== false,
    schema: SEARCH_CACHE_MANIFEST_SCHEMA,
    userId: record?.userId || key.userId || '',
    accessVersion: record?.accessVersion || key.accessVersion || '1',
    novelId: record?.novelId || key.novelId || '',
    episodeId: record?.episodeId || key.episodeId || 'single',
    preprocessSignature: record?.preprocessSignature || key.preprocessSignature || '',
    contentIdentityHash: record?.contentIdentityHash || key.contentIdentityHash || '',
    totalChunks: Math.max(0, Number(record?.totalChunks) || 0),
    chunkCount: chunks.length,
    chunks,
    updatedAt: Number(record?.updatedAt) || 0,
    error: options.error || ''
  };
}

function buildUnavailableSearchManifestSnapshot(app, current, error = null) {
  let key = {};
  try { key = current ? makeSearchCacheManifestKey(app, current) : {}; } catch {}
  return buildSearchManifestSnapshotFromRecord(null, key, { available: false, error: error?.message || String(error || '') });
}

async function purgeSearchCacheManifestOutsideAllowedNovelIdsInDb(db, allowed) {
  const records = await idbGetAll(db, SEARCH_MANIFEST_STORE);
  let removed = 0;
  const affectedNovels = new Set();
  for (const record of records) {
    const novelId = String(record?.novelId || '').trim();
    if (novelId && allowed.has(novelId)) continue;
    await idbDelete(db, SEARCH_MANIFEST_STORE, record.id);
    removed += 1;
    affectedNovels.add(novelId || '(unknown)');
  }
  return { removed, affectedNovels: Array.from(affectedNovels).sort() };
}

async function deleteSearchCacheManifestsForNovelInDb(db, novelId, options = {}) {
  const targetNovelId = String(novelId || '').trim();
  const episodeId = options.episodeId == null ? null : String(options.episodeId || 'single');
  const signature = options.preprocessSignature == null ? null : String(options.preprocessSignature || '');
  const records = await idbGetAll(db, SEARCH_MANIFEST_STORE);
  let removed = 0;
  for (const record of records) {
    if (String(record?.novelId || '') !== targetNovelId) continue;
    if (episodeId != null && String(record?.episodeId || 'single') !== episodeId) continue;
    if (signature != null && String(record?.preprocessSignature || '') !== signature) continue;
    await idbDelete(db, SEARCH_MANIFEST_STORE, record.id);
    removed += 1;
  }
  return { removed };
}

function shouldUseCache(app) {
  return isReaderCacheAvailable() && app?.state?.prefs?.readerCache !== false;
}

function schedulePrune(app, db) {
  const now = Date.now();
  if (app.state.readerCacheLastPrune && now - app.state.readerCacheLastPrune < PRUNE_INTERVAL_MS) return;
  if (scheduledPruneHandle || prunePromise) return;
  app.state.readerCacheLastPrune = now;
  const run = () => {
    scheduledPruneHandle = 0;
    scheduledPruneIsIdle = false;
    runPruneDb(db, {}).catch(() => {});
  };
  if (typeof requestIdleCallback === 'function') {
    scheduledPruneIsIdle = true;
    scheduledPruneHandle = requestIdleCallback(run, { timeout: 2500 });
  } else {
    scheduledPruneIsIdle = false;
    scheduledPruneHandle = window.setTimeout(run, 600);
  }
}

function cancelScheduledPrune() {
  if (!scheduledPruneHandle) return;
  if (scheduledPruneIsIdle && typeof cancelIdleCallback === 'function') cancelIdleCallback(scheduledPruneHandle);
  else clearTimeout(scheduledPruneHandle);
  scheduledPruneHandle = 0;
  scheduledPruneIsIdle = false;
}

function runPruneDb(db, options = {}) {
  if (prunePromise) return prunePromise;
  prunePromise = pruneDb(db, options).finally(() => {
    prunePromise = null;
  });
  return prunePromise;
}

async function putChunkRecordWithQuotaRecovery(db, record) {
  try {
    await idbPut(db, CHUNK_STORE, record);
  } catch (error) {
    if (!isQuotaError(error)) throw error;
    await runPruneDb(db, {
      maxEntries: Math.max(40, Math.floor(DEFAULT_MAX_ENTRIES * 0.65)),
      maxBytes: Math.max(8 * 1024 * 1024, Math.floor(DEFAULT_MAX_BYTES * 0.65))
    });
    await idbPut(db, CHUNK_STORE, record);
  }
}

function isQuotaError(error) {
  const name = String(error?.name || '');
  const message = String(error?.message || '');
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || /quota/i.test(message);
}

async function pruneDb(db, { maxEntries = DEFAULT_MAX_ENTRIES, maxBytes = DEFAULT_MAX_BYTES } = {}) {
  const records = await idbGetAll(db, CHUNK_STORE);
  let totalBytes = records.reduce((sum, row) => sum + (Number(row.bytes) || 0), 0);
  const sorted = records.sort((a, b) => (Number(a.lastAccessedAt) || 0) - (Number(b.lastAccessedAt) || 0));
  let removed = 0;
  let removedBytes = 0;
  while (sorted.length > maxEntries || totalBytes > maxBytes) {
    const victim = sorted.shift();
    if (!victim) break;
    await idbDelete(db, CHUNK_STORE, victim.id);
    const bytes = Number(victim.bytes) || 0;
    totalBytes -= bytes;
    removedBytes += bytes;
    removed += 1;
  }
  return { removed, bytes: removedBytes };
}

function openDb() {
  if (!isReaderCacheAvailable()) return Promise.reject(new Error('IndexedDB cache is unavailable'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CHUNK_STORE)) {
        const chunks = db.createObjectStore(CHUNK_STORE, { keyPath: 'id' });
        chunks.createIndex('novelId', 'novelId', { unique: false });
        chunks.createIndex('episodeId', 'episodeId', { unique: false });
        chunks.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(SEARCH_MANIFEST_STORE)) {
        const manifests = db.createObjectStore(SEARCH_MANIFEST_STORE, { keyPath: 'id' });
        manifests.createIndex('novelId', 'novelId', { unique: false });
        manifests.createIndex('userId', 'userId', { unique: false });
        manifests.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
    req.onblocked = () => reject(new Error('IndexedDB upgrade blocked'));
  }).catch(error => {
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

function txStore(db, storeName, mode = 'readonly') {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function idbGet(db, storeName, key) {
  return requestToPromise(txStore(db, storeName).get(key));
}

function idbGetAll(db, storeName) {
  return requestToPromise(txStore(db, storeName).getAll());
}

function idbPut(db, storeName, value) {
  return requestToPromise(txStore(db, storeName, 'readwrite').put(value));
}

function idbDelete(db, storeName, key) {
  return requestToPromise(txStore(db, storeName, 'readwrite').delete(key));
}

function idbClear(db, storeName) {
  return requestToPromise(txStore(db, storeName, 'readwrite').clear());
}

function requestToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB request failed'));
  });
}

function estimateBytes(content, blocks) {
  const textBytes = String(content || '').length * 2;
  const blockBytes = Array.isArray(blocks) ? JSON.stringify(blocks).length * 2 : 0;
  return textBytes + blockBytes + 1024;
}

function hashString(value) {
  const text = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function disableOnError(error) {
  const name = error?.name || '';
  if (name === 'SecurityError' || name === 'InvalidStateError' || name === 'UnknownError') disabled = true;
}
