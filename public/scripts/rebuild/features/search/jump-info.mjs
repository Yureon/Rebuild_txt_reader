import { getSearchJumpSourceLabel } from './announcement-formatters.mjs';

export const SEARCH_JUMP_INFO_SPLIT_PASS = 'v206-search-jump-info-split-pass';

export function buildSearchJumpInfo(app, target = {}, idx = -1, validation = {}, options = {}) {
  const currentChunk = Math.max(1, Number(app?.state?.current?.chunk) || 1);
  const targetChunk = Math.max(1, Number(target.chunk) || 1);
  const totalChunks = Math.max(1, Number(target.totalChunks) || Number(app?.state?.current?.totalChunks) || targetChunk);
  const distance = Math.abs(targetChunk - currentChunk);
  const source = String(target.source || '').trim() || (validation.targetLoaded ? 'loaded' : 'unknown');
  const current = app?.state?.current || null;
  return {
    pass: options.searchJumpUxPass || '',
    liveFieldValidationPass: options.liveFieldValidationPass || '',
    index: Math.max(0, Math.round(Number(idx) || 0)),
    chunk: targetChunk,
    totalChunks,
    currentChunk,
    distance,
    farJump: distance >= 2,
    source,
    sourceLabel: getSearchJumpSourceLabel(source, !!validation.targetLoaded),
    targetLoaded: !!validation.targetLoaded,
    query: String(target.query || app?.state?.search?.query || '').trim(),
    runId: Number(app?.state?.search?.runId) || 0,
    resultCount: Array.isArray(app?.state?.search?.results) ? app.state.search.results.length : 0,
    novelId: current?.novel?.id || target.novelId || '',
    episodeId: current?.episode?.id ?? target.episodeId ?? null,
    at: Date.now()
  };
}
