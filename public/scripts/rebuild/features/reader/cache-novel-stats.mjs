import { resolveReaderCacheNovelTitle } from './cache-record-formatters.mjs';

export const READER_CACHE_NOVEL_STATS_HELPER_PASS = 'v213-reader-cache-novel-stats-helper-pass';

export function buildReaderCacheNovelStatsSnapshot(app, records = [], options = {}) {
  const list = Array.isArray(records) ? records : [];
  const currentSignature = String(options.currentSignature || '');
  const groups = groupCacheRecordsByNovel(app, list, { currentSignature });
  return {
    available: true,
    disabled: false,
    entries: list.length,
    bytes: list.reduce((sum, row) => sum + (Number(row?.bytes) || 0), 0),
    novels: groups,
    novelGroups: groups.length,
    currentSignature,
    generatedAt: Date.now()
  };
}

export function groupCacheRecordsByNovel(app, records = [], options = {}) {
  const currentSignature = String(options.currentSignature || '');
  const now = Date.now();
  const byNovelMap = new Map();
  (Array.isArray(records) ? records : []).forEach(record => {
    const novelId = String(record?.novelId || '(unknown)');
    const episodeId = String(record?.episodeId || 'single');
    const chunk = Math.max(1, Math.round(Number(record?.chunk) || 0));
    const bytes = Number(record?.bytes) || 0;
    const lastAccessedAt = Number(record?.lastAccessedAt) || 0;
    const updatedAt = Number(record?.updatedAt) || 0;
    const signature = String(record?.preprocessSignature || 'unknown') || 'unknown';
    const appVersion = String(record?.appVersion || 'unknown') || 'unknown';
    const item = byNovelMap.get(novelId) || {
      novelId,
      title: resolveReaderCacheNovelTitle(app, novelId, record?.title || ''),
      entries: 0,
      bytes: 0,
      episodes: new Set(),
      chunks: new Set(),
      signatures: new Set(),
      signatureStats: new Map(),
      appVersions: new Set(),
      activeSignatureEntries: 0,
      activeSignatureBytes: 0,
      staleSignatureEntries: 0,
      staleSignatureBytes: 0,
      lastAccessedAt: 0,
      updatedAt: 0,
      oldestAccessedAt: Number.POSITIVE_INFINITY,
      minChunk: Number.POSITIVE_INFINITY,
      maxChunk: 0
    };
    item.entries += 1;
    item.bytes += bytes;
    item.episodes.add(episodeId);
    if (chunk) {
      item.chunks.add(chunk);
      item.minChunk = Math.min(item.minChunk, chunk);
      item.maxChunk = Math.max(item.maxChunk, chunk);
    }
    item.signatures.add(signature);
    const sigStat = item.signatureStats.get(signature) || { signature, entries: 0, bytes: 0, lastAccessedAt: 0, updatedAt: 0 };
    sigStat.entries += 1;
    sigStat.bytes += bytes;
    sigStat.lastAccessedAt = Math.max(sigStat.lastAccessedAt, lastAccessedAt);
    sigStat.updatedAt = Math.max(sigStat.updatedAt, updatedAt);
    item.signatureStats.set(signature, sigStat);
    if (signature === currentSignature) {
      item.activeSignatureEntries += 1;
      item.activeSignatureBytes += bytes;
    } else {
      item.staleSignatureEntries += 1;
      item.staleSignatureBytes += bytes;
    }
    item.appVersions.add(appVersion);
    item.lastAccessedAt = Math.max(item.lastAccessedAt, lastAccessedAt);
    item.updatedAt = Math.max(item.updatedAt, updatedAt);
    if (lastAccessedAt) item.oldestAccessedAt = Math.min(item.oldestAccessedAt, lastAccessedAt);
    byNovelMap.set(novelId, item);
  });
  return Array.from(byNovelMap.values())
    .map(item => ({
      novelId: item.novelId,
      title: item.title,
      entries: item.entries,
      bytes: item.bytes,
      episodes: item.episodes.size,
      chunks: item.chunks.size,
      signatures: item.signatures.size,
      signatureBreakdown: Array.from(item.signatureStats.values())
        .sort((a, b) => (b.entries - a.entries) || (b.bytes - a.bytes))
        .slice(0, 8),
      activeSignatureEntries: item.activeSignatureEntries,
      activeSignatureBytes: item.activeSignatureBytes,
      staleSignatureEntries: item.staleSignatureEntries,
      staleSignatureBytes: item.staleSignatureBytes,
      staleSignatureRatio: item.entries ? item.staleSignatureEntries / item.entries : 0,
      appVersions: Array.from(item.appVersions).slice(0, 8),
      lastAccessedAt: item.lastAccessedAt,
      updatedAt: item.updatedAt,
      oldestAccessedAt: Number.isFinite(item.oldestAccessedAt) ? item.oldestAccessedAt : 0,
      ageDays: item.lastAccessedAt ? Math.max(0, Math.floor((now - item.lastAccessedAt) / 86400000)) : null,
      oldestAgeDays: Number.isFinite(item.oldestAccessedAt) && item.oldestAccessedAt ? Math.max(0, Math.floor((now - item.oldestAccessedAt) / 86400000)) : null,
      minChunk: Number.isFinite(item.minChunk) ? item.minChunk : 0,
      maxChunk: item.maxChunk || 0
    }))
    .sort((a, b) => (b.bytes - a.bytes) || (b.entries - a.entries) || String(a.title).localeCompare(String(b.title), 'ko'));
}
