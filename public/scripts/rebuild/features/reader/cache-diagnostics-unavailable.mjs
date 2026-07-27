export const READER_CACHE_UNAVAILABLE_HELPER_PASS = 'v212-reader-cache-unavailable-helper-pass';

export function buildReaderCacheUnavailableDiagnostics({ disabled = false, prune = null, error = '' } = {}) {
  const out = {
    available: false,
    disabled: !!disabled,
    entries: 0,
    bytes: 0,
    current: null,
    byNovel: [],
    prune
  };
  if (error) out.error = String(error);
  return out;
}

export function buildReaderCacheUnavailableNovelStats({ disabled = false, error = '' } = {}) {
  return {
    available: false,
    disabled: !!disabled,
    entries: 0,
    bytes: 0,
    novels: [],
    novelGroups: 0,
    generatedAt: Date.now(),
    error: error || (disabled ? 'IndexedDB cache disabled' : 'IndexedDB unavailable')
  };
}
