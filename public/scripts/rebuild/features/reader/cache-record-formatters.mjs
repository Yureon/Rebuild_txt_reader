export const READER_CACHE_RECORD_FORMATTERS_PASS = 'v211-reader-cache-record-formatters-pass';

export function resolveReaderCacheNovelTitle(app, novelId, fallback = '') {
  const direct = app?.state?.novelById?.get?.(novelId);
  if (direct?.title) return String(direct.title);
  return String(fallback || novelId || '(unknown)').slice(0, 120);
}

export function summarizeReaderCacheRecordForPrune(app, record) {
  const novelId = String(record?.novelId || '');
  return {
    novelId,
    episodeId: String(record?.episodeId || 'single'),
    chunk: Math.max(1, Math.round(Number(record?.chunk) || 0)),
    title: resolveReaderCacheNovelTitle(app, novelId, record?.title || ''),
    bytes: Number(record?.bytes) || 0,
    lastAccessedAt: Number(record?.lastAccessedAt) || 0,
    updatedAt: Number(record?.updatedAt) || 0,
    preprocessSignature: String(record?.preprocessSignature || '')
  };
}

export function buildReaderCacheRecordIdentity(record) {
  return {
    novelId: String(record?.novelId || ''),
    episodeId: String(record?.episodeId || 'single'),
    chunk: Math.max(1, Math.round(Number(record?.chunk) || 0)),
    preprocessSignature: String(record?.preprocessSignature || ''),
    appVersion: String(record?.appVersion || 'unknown') || 'unknown'
  };
}
