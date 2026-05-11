export const READER_CACHE_DELETE_FORMATTERS_PASS = 'v217-reader-cache-delete-formatters-pass';

export function formatReaderCacheDeleteResult(result = {}, formatBytes = defaultFormatBytes, unavailableLabel = 'IndexedDB 사용 불가') {
  if (!result?.available) return result?.error || unavailableLabel;
  return `삭제 ${Number(result.removed) || 0}개 · ${formatBytes(Number(result.bytes) || 0)}`;
}

export function formatReaderCacheDeleteBatchResult(result = {}, formatBytes = defaultFormatBytes) {
  const removed = Number(result.removed) || 0;
  const bytes = Number(result.bytes) || 0;
  const failed = Number(result.failed) || 0;
  return `삭제 ${removed}개 · ${formatBytes(bytes)}${failed ? ' · 실패 ' + failed + '개' : ''}`;
}

export function formatReaderCacheRuleDeleteResult(result = {}, formatBytes = defaultFormatBytes, unavailableLabel = 'IndexedDB 사용 불가') {
  if (!result?.available) return result?.error || unavailableLabel;
  return `삭제 ${Number(result.removed) || 0}개 · ${formatBytes(Number(result.bytes) || 0)} · 영향 작품 ${Number(result.affectedNovels?.length) || 0}개 · 보호 ${Number(result.protectedEntries) || 0}개`;
}

export function getReaderCacheDeleteToastTone(result = {}) {
  return result?.available ? 'success' : 'error';
}

function defaultFormatBytes(value) {
  return String(Number(value) || 0) + 'B';
}
