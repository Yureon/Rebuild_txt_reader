export const READER_CACHE_PRUNE_DIAGNOSTICS_PASS = 'v216-reader-cache-prune-diagnostics-pass';

export function buildReaderCachePruneDiagnosticsView({
  defaultMaxEntries,
  defaultMaxBytes,
  intervalMs,
  lastPruneAt,
  scheduled,
  scheduledIsIdle,
  running
} = {}) {
  return {
    defaultMaxEntries,
    defaultMaxBytes,
    intervalMs,
    lastPruneAt: Number(lastPruneAt) || 0,
    scheduled: !!scheduled,
    scheduledIsIdle: !!scheduledIsIdle,
    running: !!running
  };
}
