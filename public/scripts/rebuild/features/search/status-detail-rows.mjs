import { MAX_RESULTS, SEARCH_FULL_SCAN_DIAGNOSTICS_PASS, buildSearchCompletionSummary, getSearchProcessedCount } from './matcher.mjs';
export const SEARCH_STATUS_DETAIL_ROWS_SPLIT_PASS = 'v199-search-status-detail-rows-split-pass';
export const SEARCH_COMPACT_STATUS_PASS = 'v366-search-compact-status-pass';

const SEARCH_JUMP_FAILURE_RECOVERY_PASS = 'v152-search-jump-failure-recovery-pass';
const SEARCH_LIVE_FIELD_VALIDATION_PASS = 'v153-search-live-field-validation-pass';

export function updateSearchChunkDetails(app, info = {}) {
  const el = app.els.nsearchChunkDetails;
  if (!el) return;
  const missing = info.missing || [];
  const failed = info.failed || [];
  const cacheOnlySkipped = info.cacheOnlySkipped || [];
  const stats = info.stats || null;
  const jumpFailure = info.jumpFailure || null;
  const jumpStatus = info.jumpStatus || null;
  const jumpLiveValidation = info.jumpLiveValidation || null;
  const rows = [];
  if (jumpFailure) rows.push(renderSearchJumpFailureRow(jumpFailure));
  else if (jumpStatus) rows.push(renderSearchJumpLiveStatusRow(jumpStatus, jumpLiveValidation));
  const hasActionableIssue = missing.length || failed.length || cacheOnlySkipped.length;
  if (stats?.done && hasActionableIssue && (stats.mode === 'all' || stats.mode === 'cache-only')) rows.push(renderSearchSummaryDetailRow(stats));
  if (missing.length) rows.push(renderChunkDetailRow('오프라인 누락', missing, 'missing'));
  if (failed.length) rows.push(renderChunkDetailRow(`실패${stats && stats.lastError ? ` · 최근 오류: ${stats.lastError}` : ''}`, failed, 'failed'));
  if (cacheOnlySkipped.length) rows.push(renderChunkDetailRow('캐시 외 제외', cacheOnlySkipped, 'cache-only'));
  el.hidden = !rows.length;
  el.replaceChildren(...rows);
  el.title = rows.map(row => row.dataset.fullText || '').filter(Boolean).join('\n');
}

export function renderSearchSummaryDetailRow(stats) {
  const row = document.createElement('div');
  row.className = 'nsearch-chunk-detail-row nsearch-scan-summary-row';
  row.dataset.searchFullScanDiagnosticsPass = SEARCH_FULL_SCAN_DIAGNOSTICS_PASS;
  row.dataset.fullText = buildSearchCompletionSummary(stats, Number(stats?.resultCount) || 0);
  const summary = document.createElement('span');
  summary.className = 'nsearch-chunk-detail-text';
  summary.textContent = buildSearchCompactSummary(stats);
  row.append(summary);
  return row;
}

export function renderSearchJumpLiveStatusRow(statusInfo = {}, validation = {}) {
  const row = document.createElement('div');
  row.className = 'nsearch-chunk-detail-row nsearch-jump-live-row';
  row.dataset.searchLiveFieldValidationPass = SEARCH_LIVE_FIELD_VALIDATION_PASS;
  row.dataset.fullText = formatSearchJumpLiveStatus(statusInfo, validation);
  const summary = document.createElement('span');
  summary.className = 'nsearch-chunk-detail-text';
  summary.textContent = formatSearchJumpLiveStatus(statusInfo, validation);
  row.append(summary);
  return row;
}

export function formatSearchJumpLiveStatus(statusInfo = {}, validation = {}) {
  const stage = statusInfo.stage === 'done' ? '완료' : statusInfo.stage === 'failed' ? '실패' : statusInfo.stage === 'loading' ? '진행 중' : '기록됨';
  const chunk = Math.max(1, Number(statusInfo.chunk) || 1);
  const total = Math.max(1, Number(statusInfo.totalChunks) || 1);
  const valid = validation && validation.ok === false ? ' · 현재 검색과 불일치' : '';
  return '마지막 검색 이동 ' + stage + ' · chunk ' + chunk + '/' + total + valid;
}

export function renderSearchJumpFailureRow(failure = {}) {
  const row = document.createElement('div');
  row.className = 'nsearch-chunk-detail-row nsearch-jump-failure-row';
  row.dataset.searchJumpFailureRecoveryPass = SEARCH_JUMP_FAILURE_RECOVERY_PASS;
  row.dataset.fullText = '검색 결과 이동 실패: chunk ' + (failure.chunk || '-') + ' / ' + (failure.totalChunks || '-') + ' · ' + (failure.error || '원인 미상');
  const summary = document.createElement('span');
  summary.className = 'nsearch-chunk-detail-text';
  summary.textContent = '이동 실패 · chunk ' + (failure.chunk || '-') + ' · ' + (failure.error || '원인 미상');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'nsearch-chunk-retry-btn nsearch-jump-retry-btn';
  button.dataset.retryKind = 'jump';
  button.dataset.index = String(Math.max(0, Math.round(Number(failure.index) || 0)));
  button.textContent = '이동 재시도';
  button.title = '마지막 검색 결과 이동을 다시 시도합니다.';
  row.append(summary, button);
  return row;
}

export function renderChunkDetailRow(label, chunks, kind) {
  const row = document.createElement('div');
  row.className = 'nsearch-chunk-detail-row';
  const list = normalizeRetryChunks(chunks);
  const text = `${label}: ${formatChunkList(list)}`;
  row.dataset.fullText = `${label}: ${list.join(', ')}`;
  const summary = document.createElement('span');
  summary.className = 'nsearch-chunk-detail-text';
  summary.textContent = text;
  row.append(summary);
  if (kind !== 'cache-only') {
    const buttons = document.createElement('span');
    buttons.className = 'nsearch-chunk-detail-actions';
    list.slice(0, 12).forEach(chunk => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'nsearch-chunk-retry-btn';
      button.dataset.retryKind = kind;
      button.dataset.chunk = String(chunk);
      button.textContent = String(chunk);
      button.title = `chunk ${chunk}만 재시도`;
      buttons.append(button);
    });
    row.append(buttons);
  }
  return row;
}

export function formatChunkList(chunks) {
  const list = normalizeRetryChunks(chunks);
  if (!list.length) return '없음';
  const head = list.slice(0, 20).join(', ');
  return list.length > 20 ? `${head} 외 ${list.length - 20}개` : head;
}

export function buildSearchCompactSummary(stats = {}) {
  const total = Math.max(0, Number(stats.totalChunks) || 0);
  const processed = getSearchProcessedCount(stats);
  const scanned = Math.max(0, Number(stats.scannedChunks) || 0);
  const failed = Math.max(0, Number(stats.failedChunks) || 0);
  const skipped = Math.max(0, Number(stats.skippedOfflineChunks) || 0) + Math.max(0, Number(stats.skippedCacheOnlyChunks) || 0);
  const state = stats.completeScanDone || stats.mode === 'cache-only' ? '완료' : '미완료';
  const limit = stats.resultLimitReached ? ` · 결과 상한 ${MAX_RESULTS}` : '';
  const issues = failed || skipped ? ` · 문제 ${failed + skipped}` : '';
  return `전체 검색 ${state} · 처리 ${processed}/${total}${issues}${limit}`;
}

export function normalizeRetryChunks(value) {
  const out = [];
  const seen = new Set();
  (Array.isArray(value) ? value : []).forEach(item => {
    const chunk = Math.max(1, Math.round(Number(item) || 0));
    if (!chunk || seen.has(chunk)) return;
    seen.add(chunk);
    out.push(chunk);
  });
  return out.sort((a, b) => a - b);
}
