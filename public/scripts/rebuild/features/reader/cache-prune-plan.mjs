import { summarizeReaderCacheRecordForPrune } from './cache-record-formatters.mjs';

export const READER_CACHE_PRUNE_PLAN_SPLIT_PASS = 'v199-reader-cache-prune-plan-split-pass';

export function buildReaderCachePrunePlan(app, records = [], options = {}) {
  const maxEntries = clampReaderCacheLimit(options.maxEntries, options.defaultMaxEntries, 20, 100000);
  const maxBytes = clampReaderCacheLimit(options.maxBytes, options.defaultMaxBytes, 1024 * 1024, 1024 * 1024 * 1024 * 50);
  const protectCurrent = options.protectCurrent !== false;
  const protectRadius = clampReaderCacheLimit(options.protectRadius, 8, 0, 200);
  const list = Array.isArray(records) ? records : [];
  const totalBytes = list.reduce((sum, row) => sum + (Number(row?.bytes) || 0), 0);
  const protectedIds = protectCurrent ? buildCurrentReaderCacheProtectionSet(app, list, protectRadius) : new Set();
  let entriesAfter = list.length;
  let bytesAfter = totalBytes;
  const candidates = list
    .filter(record => !protectedIds.has(String(record?.id || '')))
    .sort((a, b) => (Number(a?.lastAccessedAt) || 0) - (Number(b?.lastAccessedAt) || 0));
  const victimsFull = [];
  while ((entriesAfter > maxEntries || bytesAfter > maxBytes) && candidates.length) {
    const victim = candidates.shift();
    victimsFull.push(victim);
    entriesAfter -= 1;
    bytesAfter -= Number(victim?.bytes) || 0;
  }
  const removeBytes = victimsFull.reduce((sum, row) => sum + (Number(row?.bytes) || 0), 0);
  const limitedByProtected = (entriesAfter > maxEntries || bytesAfter > maxBytes) && !candidates.length;
  return {
    available: true,
    entries: list.length,
    bytes: totalBytes,
    maxEntries,
    maxBytes,
    overEntries: Math.max(0, list.length - maxEntries),
    overBytes: Math.max(0, totalBytes - maxBytes),
    remove: victimsFull.length,
    removeBytes,
    afterEntries: entriesAfter,
    afterBytes: bytesAfter,
    protectedEntries: protectedIds.size,
    protectCurrent,
    protectRadius,
    limitedByProtected,
    victims: victimsFull.slice(0, 24).map(record => summarizeReaderCacheRecordForPrune(app, record)),
    victimsFull
  };
}

export function clampReaderCacheLimit(value, fallback, min, max) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function buildCurrentReaderCacheProtectionSet(app, records = [], radius = 8) {
  const current = app?.state?.current;
  const currentNovelId = String(current?.novel?.id || '');
  if (!currentNovelId) return new Set();
  const currentEpisodeId = String(current?.episode?.id || 'single');
  const currentChunk = Math.max(1, Math.round(Number(current?.chunk) || 1));
  const loadedChunks = new Set(Array.from(app?.state?.loadedChunks?.keys?.() || [])
    .map(value => Math.max(1, Math.round(Number(value) || 0)))
    .filter(Boolean));
  const minChunk = Math.max(1, currentChunk - radius);
  const maxChunk = currentChunk + radius;
  const out = new Set();
  (Array.isArray(records) ? records : []).forEach(record => {
    if (String(record?.novelId || '') !== currentNovelId) return;
    if (String(record?.episodeId || 'single') !== currentEpisodeId) return;
    const chunk = Math.max(1, Math.round(Number(record?.chunk) || 0));
    if (loadedChunks.has(chunk) || (chunk >= minChunk && chunk <= maxChunk)) out.add(String(record?.id || ''));
  });
  return out;
}

export function normalizeReaderCacheChunkDeleteSet(chunks, totalChunks, options = {}) {
  const max = Math.max(1, Number(totalChunks) || 1);
  const out = new Set();
  const add = value => {
    const chunk = Math.max(1, Math.min(max, Math.round(Number(value) || 0)));
    if (chunk) out.add(chunk);
  };
  if (options.range && typeof options.range === 'object') {
    const start = Math.max(1, Math.min(max, Math.round(Number(options.range.start) || 1)));
    const end = Math.max(start, Math.min(max, Math.round(Number(options.range.end) || start)));
    for (let chunk = start; chunk <= end; chunk += 1) out.add(chunk);
  }
  (Array.isArray(chunks) ? chunks : []).forEach(add);
  return out;
}
