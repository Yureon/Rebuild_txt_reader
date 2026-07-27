import { getNetworkProfile } from '../reader/offline-status.mjs';

export const RECOVERY_SEARCH_DIAGNOSTICS_COPY_PAYLOAD_PASS = 'v244-recovery-search-diagnostics-copy-payload-pass';

export function buildRecoverySearchDiagnosticsPayload(app, payloadParts = {}) {
  return {
    current: app.state.current ? {
      novelId: app.state.current.novel?.id || '',
      episodeId: app.state.current.episode?.id || null,
      chunk: app.state.current.chunk,
      totalChunks: app.state.current.totalChunks,
      title: app.state.current.title
    } : null,
    coverage: payloadParts.coverage || null,
    coverageMissingChunks: payloadParts.missingCoverageChunks || [],
    stats: payloadParts.stats || null,
    lastJumpStatus: payloadParts.jumpStatus || null,
    lastJumpFailure: payloadParts.jumpFailure || null,
    lastJumpLiveFieldValidation: payloadParts.jumpLiveValidation || null,
    lastJumpRetryValidation: payloadParts.jumpRetryValidation || null,
    lastJumpSessionCleanup: payloadParts.jumpSessionCleanup || null,
    lastSearchContextReset: payloadParts.searchContextReset || null,
    resultCount: app.state.search?.results?.length || 0,
    sourceFilter: app.state.search?.sourceFilter || 'all',
    cacheOnly: !!app.state.search?.cacheOnly,
    cacheOnlySkipped: payloadParts.stats?.skippedCacheOnlyChunks || 0,
    network: getNetworkProfile(),
    copiedAt: Date.now()
  };
}
