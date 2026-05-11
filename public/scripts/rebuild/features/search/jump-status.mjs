export const SEARCH_JUMP_STATUS_HELPERS_SPLIT_PASS = 'v201-search-jump-status-helpers-split-pass';

export function buildSearchJumpMessage(info = {}, stage = 'loading') {
  const chunkText = 'chunk ' + Math.max(1, Number(info.chunk) || 1) + '/' + Math.max(1, Number(info.totalChunks) || 1);
  const sourceText = info.sourceLabel ? ' · ' + info.sourceLabel : '';
  const farText = info.farJump ? ' · 먼 위치 이동(' + Math.max(0, Number(info.distance) || 0) + ' chunk)' : '';
  if (stage === 'done') return '검색 결과 이동 완료 · ' + chunkText + sourceText;
  if (stage === 'failed') return '검색 결과 이동 실패 · ' + chunkText + sourceText;
  return '검색 결과 이동 중 · ' + chunkText + sourceText + farText;
}

export function validateLastSearchJumpRetry(app, failure = {}, pass = 'v153-search-live-field-validation-pass') {
  const current = app?.state?.current || null;
  const results = Array.isArray(app?.state?.search?.results) ? app.state.search.results : [];
  const index = Math.max(0, Math.round(Number(failure.index) || 0));
  let ok = !!current && !!results[index];
  let reason = ok ? '' : (!current ? 'no-current-reader' : 'missing-result-index');
  const currentNovelId = current?.novel?.id || '';
  const currentEpisodeId = current?.episode?.id ?? null;
  const failureNovelId = failure.novelId || '';
  const failureEpisodeId = failure.episodeId ?? null;
  if (ok && failureNovelId && currentNovelId && String(failureNovelId) !== String(currentNovelId)) {
    ok = false;
    reason = 'novel-mismatch';
  }
  if (ok && failureEpisodeId != null && currentEpisodeId != null && String(failureEpisodeId) !== String(currentEpisodeId)) {
    ok = false;
    reason = 'episode-mismatch';
  }
  const query = String(app?.state?.search?.query || '').trim();
  const failureQuery = String(failure.query || '').trim();
  if (ok && failureQuery && query && failureQuery !== query) {
    ok = false;
    reason = 'query-mismatch';
  }
  const runId = Number(app?.state?.search?.runId) || 0;
  const failureRunId = Number(failure.runId) || 0;
  if (ok && failureRunId && runId && failureRunId !== runId) {
    ok = false;
    reason = 'search-run-mismatch';
  }
  return {
    pass,
    ok,
    reason,
    index,
    runId,
    failureRunId,
    currentNovelId,
    failureNovelId,
    currentEpisodeId,
    failureEpisodeId,
    query,
    failureQuery,
    at: Date.now()
  };
}

export function buildSearchJumpLiveFieldValidation(app, payload = {}, pass = 'v153-search-live-field-validation-pass') {
  const current = app?.state?.current || null;
  const currentNovelId = current?.novel?.id || '';
  const currentEpisodeId = current?.episode?.id ?? null;
  const payloadNovelId = payload.novelId || '';
  const payloadEpisodeId = payload.episodeId ?? null;
  const query = String(app?.state?.search?.query || '').trim();
  const payloadQuery = String(payload.query || '').trim();
  const resultCount = Array.isArray(app?.state?.search?.results) ? app.state.search.results.length : 0;
  const index = Math.max(0, Math.round(Number(payload.index) || 0));
  const ok = !!current
    && index < resultCount
    && (!payloadNovelId || !currentNovelId || String(payloadNovelId) === String(currentNovelId))
    && (payloadEpisodeId == null || currentEpisodeId == null || String(payloadEpisodeId) === String(currentEpisodeId))
    && (!payloadQuery || !query || payloadQuery === query);
  return {
    pass,
    ok,
    stage: payload.stage || '',
    index,
    resultCount,
    currentNovelId,
    payloadNovelId,
    currentEpisodeId,
    payloadEpisodeId,
    query,
    payloadQuery,
    at: Date.now()
  };
}
