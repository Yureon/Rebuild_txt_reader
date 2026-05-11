export const READER_PREFETCH_SNAPSHOT_HELPER_PASS = 'v213-reader-prefetch-snapshot-helper-pass';

export function buildReaderPrefetchSnapshot(prefetchState = null, passes = {}) {
  const stats = prefetchState?.stats || {};
  return {
    running: !!prefetchState?.running,
    pending: prefetchState?.queue?.length || 0,
    queuedKeys: prefetchState?.queuedKeys?.size || 0,
    enqueued: Number(stats.enqueued) || 0,
    fetched: Number(stats.fetched) || 0,
    cached: Number(stats.cached) || 0,
    failed: Number(stats.failed) || 0,
    aborted: Number(stats.aborted) || 0,
    skippedLoaded: Number(stats.skippedLoaded) || 0,
    skippedDuplicate: Number(stats.skippedDuplicate) || 0,
    skippedCoalesced: Number(stats.skippedCoalesced) || 0,
    dropped: Number(stats.dropped) || 0,
    pass: stats.pass || passes.warmupPass || '',
    bufferPass: passes.bufferPass || '',
    velocityPrefetchPass: stats.velocityPrefetchPass || passes.velocityPass || '',
    lastVelocityPxMs: Number(stats.lastVelocityPxMs) || 0,
    lastRadius: Number(stats.lastRadius) || 0,
    lastDirection: stats.lastDirection || 'forward',
    lastError: stats.lastError || '',
    lastScheduleAt: Number(stats.lastScheduleAt) || 0,
    lastRunAt: Number(stats.lastRunAt) || 0,
    lastCompletedAt: Number(stats.lastCompletedAt) || 0
  };
}
