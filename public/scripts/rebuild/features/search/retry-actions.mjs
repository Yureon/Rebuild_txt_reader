import { setButtonBusy } from '../../core/utils.mjs';
import { normalizeRetryChunks, updateSearchRetryBar } from './status-panel.mjs';
import { syncSearchNavigationButtons } from './navigation-ui.mjs';
import { hasFullSearchPermission } from './filter-controls.mjs';

export const SEARCH_RETRY_ACTIONS_PASS = 'v247-search-retry-actions-pass';
export const SEARCH_FULL_SEARCH_PERMISSION_RETRY_PASS = 'v551-search-full-search-permission-retry-pass';

export function buildSearchRetryRequest(app, kind = 'failed', overrideChunks = null) {
  const stats = app?.state?.search?.stats || {};
  if (!hasFullSearchPermission(app)) return { pass: SEARCH_RETRY_ACTIONS_PASS, fullSearchPermissionPass: SEARCH_FULL_SEARCH_PERMISSION_RETRY_PASS, ok:false, reason:'full-search-permission-denied', message:'전체검색 권한이 없어 서버 재검색을 실행할 수 없습니다.', kind, chunks:[], query:'' };
  const list = kind === 'failed' ? stats.failedChunkList : stats.skippedOfflineChunkList;
  const chunks = normalizeRetryChunks(Array.isArray(overrideChunks) ? overrideChunks : list);
  const query = String(app?.state?.search?.query || app?.els?.nsearchInput?.value || '').trim();
  const singleOverride = Array.isArray(overrideChunks) && overrideChunks.length === 1;
  const busyButton = singleOverride ? null : (kind === 'failed' ? app?.els?.nsearchRetryFailed : app?.els?.nsearchRetryMissing);
  if (!query) return { pass: SEARCH_RETRY_ACTIONS_PASS, ok:false, reason:'empty-query', message:'먼저 검색어를 입력하세요.', kind, chunks, query };
  if (!chunks.length) return { pass: SEARCH_RETRY_ACTIONS_PASS, ok:false, reason:'empty-chunks', message:kind === 'failed' ? '재시도할 실패 chunk가 없습니다.' : '재검색할 오프라인 누락 chunk가 없습니다.', kind, chunks, query };
  app?.state?.search?.abortController?.abort?.();
  const controller = new AbortController();
  const runId = (Number(app?.state?.search?.runId) || 0) + 1;
  return { pass: SEARCH_RETRY_ACTIONS_PASS, ok:true, kind, chunks, query, controller, runId, busyButton, mode: kind === 'failed' ? 'retry-failed' : 'retry-missing' };
}

export function beginSearchRetry(app, request = {}) {
  const search = app?.state?.search;
  if (!search || !request.ok) return false;
  search.abortController = request.controller;
  search.runId = request.runId;
  search.query = request.query;
  search.running = true;
  search.remoteDismissed = false;
  setButtonBusy(request.busyButton, true, '재검색…');
  syncSearchNavigationButtons(app);
  updateSearchRetryBar(app);
  return true;
}

export function buildSearchRetryDoneMessage(request = {}, stats = {}) {
  const processed = Number(stats.processedChunks) || 0;
  const total = Array.isArray(request.chunks) ? request.chunks.length : 0;
  return request.kind === 'failed'
    ? `실패 chunk 재시도 완료 · 처리 ${processed}/${total}`
    : `오프라인 누락 재검색 완료 · 처리 ${processed}/${total}`;
}

export function finishSearchRetry(app, request = {}, deps = {}) {
  const search = app?.state?.search;
  if (!search || request.runId !== search.runId) return false;
  search.running = false;
  setButtonBusy(app.els?.nsearchRetryFailed, false);
  setButtonBusy(app.els?.nsearchRetryMissing, false);
  deps.renderResults?.(app);
  syncSearchNavigationButtons(app);
  return true;
}
