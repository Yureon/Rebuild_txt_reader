import { resolveReaderCacheNovelTitle } from './cache-record-formatters.mjs';
import { buildReaderCacheUnavailableDiagnostics, buildReaderCacheUnavailableNovelStats } from './cache-diagnostics-unavailable.mjs';

export { buildReaderCacheUnavailableDiagnostics, buildReaderCacheUnavailableNovelStats } from './cache-diagnostics-unavailable.mjs';

export const READER_CACHE_DIAGNOSTICS_SPLIT_PASS = 'v198-reader-cache-diagnostics-split-pass';

export function buildReaderCacheDiagnosticsSnapshot(app, records = [], current = null, options = {}) {
  const list = Array.isArray(records) ? records : [];
  const currentNovelId = String(current?.novel?.id || '');
  const currentEpisodeId = String(current?.episode?.id || 'single');
  const currentSignature = String(options.currentSignature || '');
  const now = Date.now();
  const totalBytes = list.reduce((sum, row) => sum + (Number(row?.bytes) || 0), 0);
  const byNovelMap = new Map();
  const bySignature = new Map();
  const byVersion = new Map();
  const currentChunks = new Set();
  const currentActiveChunks = new Set();
  let currentBytes = 0;
  let currentActiveBytes = 0;
  let currentLastAccessedAt = 0;
  let currentUpdatedAt = 0;

  list.forEach(record => {
    const novelId = String(record?.novelId || '');
    const episodeId = String(record?.episodeId || 'single');
    const chunk = Math.max(1, Math.round(Number(record?.chunk) || 0));
    const bytes = Number(record?.bytes) || 0;
    const lastAccessedAt = Number(record?.lastAccessedAt) || 0;
    const updatedAt = Number(record?.updatedAt) || 0;
    const signature = String(record?.preprocessSignature || '');
    const appVersion = String(record?.appVersion || 'unknown');
    bySignature.set(signature || 'unknown', (bySignature.get(signature || 'unknown') || 0) + 1);
    byVersion.set(appVersion, (byVersion.get(appVersion) || 0) + 1);

    const key = novelId || '(unknown)';
    const item = byNovelMap.get(key) || {
      novelId: key,
      title: resolveReaderCacheNovelTitle(app, key, record?.title || ''),
      entries: 0,
      bytes: 0,
      episodes: new Set(),
      chunks: new Set(),
      signatures: new Set(),
      lastAccessedAt: 0,
      updatedAt: 0,
      oldestAccessedAt: Number.POSITIVE_INFINITY
    };
    item.entries += 1;
    item.bytes += bytes;
    item.episodes.add(episodeId);
    if (chunk) item.chunks.add(chunk);
    item.signatures.add(signature || 'unknown');
    item.lastAccessedAt = Math.max(item.lastAccessedAt, lastAccessedAt);
    item.updatedAt = Math.max(item.updatedAt, updatedAt);
    if (lastAccessedAt) item.oldestAccessedAt = Math.min(item.oldestAccessedAt, lastAccessedAt);
    byNovelMap.set(key, item);

    if (novelId === currentNovelId && episodeId === currentEpisodeId) {
      if (chunk) currentChunks.add(chunk);
      currentBytes += bytes;
      currentLastAccessedAt = Math.max(currentLastAccessedAt, lastAccessedAt);
      currentUpdatedAt = Math.max(currentUpdatedAt, updatedAt);
      if (signature === currentSignature) {
        if (chunk) currentActiveChunks.add(chunk);
        currentActiveBytes += bytes;
      }
    }
  });

  const byNovel = Array.from(byNovelMap.values())
    .map(item => ({
      novelId: item.novelId,
      title: item.title,
      entries: item.entries,
      bytes: item.bytes,
      episodes: item.episodes.size,
      chunks: item.chunks.size,
      signatures: item.signatures.size,
      lastAccessedAt: item.lastAccessedAt,
      updatedAt: item.updatedAt,
      oldestAccessedAt: Number.isFinite(item.oldestAccessedAt) ? item.oldestAccessedAt : 0
    }))
    .sort((a, b) => (b.bytes - a.bytes) || (b.entries - a.entries) || String(a.title).localeCompare(String(b.title), 'ko'))
    .slice(0, 24);

  const totalChunks = Math.max(1, Number(current?.totalChunks) || 1);
  return {
    available: true,
    disabled: false,
    entries: list.length,
    bytes: totalBytes,
    current: currentNovelId ? {
      novelId: currentNovelId,
      episodeId: currentEpisodeId,
      title: current?.title || current?.novel?.title || '',
      entries: currentChunks.size,
      bytes: currentBytes,
      activeSignatureEntries: currentActiveChunks.size,
      activeSignatureBytes: currentActiveBytes,
      totalChunks,
      cachedRatio: totalChunks ? currentChunks.size / totalChunks : 0,
      activeSignatureCachedRatio: totalChunks ? currentActiveChunks.size / totalChunks : 0,
      chunks: Array.from(currentChunks).sort((a, b) => a - b),
      activeSignatureChunks: Array.from(currentActiveChunks).sort((a, b) => a - b),
      preprocessSignature: currentSignature,
      lastAccessedAt: currentLastAccessedAt,
      updatedAt: currentUpdatedAt
    } : null,
    byNovel,
    novelGroups: byNovelMap.size,
    signatures: Array.from(bySignature.entries()).sort((a, b) => b[1] - a[1]).map(([signature, entries]) => ({ signature, entries })),
    appVersions: Array.from(byVersion.entries()).sort((a, b) => b[1] - a[1]).map(([version, entries]) => ({ version, entries })),
    prune: options.prune || null,
    generatedAt: now
  };
}

export { buildReaderCacheNovelStatsSnapshot, groupCacheRecordsByNovel } from './cache-novel-stats.mjs';
