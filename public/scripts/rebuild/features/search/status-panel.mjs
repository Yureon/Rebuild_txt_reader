import { normalizeRetryChunks, updateSearchChunkDetails } from './status-detail-rows.mjs';
import { buildSearchCoverageSummaryPayload } from './coverage-summary.mjs';
export { buildSearchCompactSummary, renderSearchSummaryDetailRow } from './status-detail-rows.mjs';

export const SEARCH_STATUS_PANEL_SPLIT_PASS = 'v197-search-status-panel-split-pass';
export const SEARCH_COMPACT_STATUS_PASS = 'v366-search-compact-status-pass';

const SEARCH_FULL_SCAN_UX_PASS = 'v150-search-full-scan-ux-pass';
const SEARCH_JUMP_FAILURE_RECOVERY_PASS = 'v152-search-jump-failure-recovery-pass';
const SEARCH_LIVE_FIELD_VALIDATION_PASS = 'v153-search-live-field-validation-pass';
export function updateSearchRetryBar(app, options = {}) {
  const bar = app.els.nsearchRetrybar;
  if (!bar) return;
  const stats = app.state.search.stats || null;
  const preview = app.state.search.coveragePreview || null;
  const allChunks = !!app.els.nsearchAllchunks?.checked;
  const missing = normalizeRetryChunks(stats?.skippedOfflineChunkList || []);
  const failed = normalizeRetryChunks(stats?.failedChunkList || []);
  const cacheOnlySkipped = normalizeRetryChunks(stats?.skippedCacheOnlyChunkList || []);
  const jumpFailure = app.state.search.lastJumpFailure || null;
  const jumpStatus = app.state.search.lastJumpStatus || null;
  const jumpLiveValidation = app.state.search.lastJumpLiveFieldValidation || null;
  const hasActionableIssue = missing.length || failed.length || cacheOnlySkipped.length;
  const shouldShow = hasActionableIssue || !!jumpFailure || (!!jumpStatus && !allChunks) || !!options.previewBusy || !!preview?.error || (!allChunks && !!preview?.totalChunks);
  bar.hidden = !shouldShow;
  if (bar.dataset) bar.dataset.searchCompactStatusPass = SEARCH_COMPACT_STATUS_PASS;
  if (!shouldShow) return;
  if (app.els.nsearchRetryMissing) {
    app.els.nsearchRetryMissing.hidden = !missing.length;
    app.els.nsearchRetryMissing.disabled = app.state.search.running || !missing.length;
    app.els.nsearchRetryMissing.textContent = missing.length ? `누락 ${missing.length}개 재검색` : '누락 재검색';
  }
  if (app.els.nsearchRetryFailed) {
    app.els.nsearchRetryFailed.hidden = !failed.length;
    app.els.nsearchRetryFailed.disabled = app.state.search.running || !failed.length;
    app.els.nsearchRetryFailed.textContent = failed.length ? `실패 ${failed.length}개 재시도` : '실패 재시도';
  }
  if (app.els.nsearchCoverageRefresh) {
    app.els.nsearchCoverageRefresh.disabled = app.state.search.running || !app.state.current;
    app.els.nsearchCoverageRefresh.textContent = options.previewBusy ? '범위 확인…' : '범위 확인';
  }
  if (app.els.nsearchCoverageSummary) {
    const coverageSummary = buildSearchCoverageSummaryPayload(app, { allChunks, stats, preview, previewBusy:options.previewBusy, jumpFailure, jumpStatus, jumpLiveValidation });
    if (coverageSummary.markers.jumpFailureRecovery) app.els.nsearchCoverageSummary.dataset.searchJumpFailureRecoveryPass = SEARCH_JUMP_FAILURE_RECOVERY_PASS;
    if (coverageSummary.markers.liveFieldValidation) app.els.nsearchCoverageSummary.dataset.searchLiveFieldValidationPass = SEARCH_LIVE_FIELD_VALIDATION_PASS;
    if (coverageSummary.markers.fullScanUx) app.els.nsearchCoverageSummary.dataset.searchFullScanUxPass = SEARCH_FULL_SCAN_UX_PASS;
    app.els.nsearchCoverageSummary.dataset.searchCoverageSummaryHelperPass = 'v234';
    app.els.nsearchCoverageSummary.textContent = coverageSummary.text;
  }
  updateSearchChunkDetails(app, { missing, failed, cacheOnlySkipped, stats, jumpFailure, jumpStatus, jumpLiveValidation });
}

export { normalizeRetryChunks };
export { buildSearchStatusSuffix, describeCoveragePreview } from './status-formatters.mjs';
