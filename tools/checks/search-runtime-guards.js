const fs = require('fs');
const path = require('path');
const { readHistoricalDocSourceManifest } = require('./source-loader-manifest.js');

function readGuardHistoricalDoc(docsRoot, rel) {
  return readHistoricalDocSourceManifest(path.dirname(docsRoot), [rel])[rel];
}


const FRONTEND_CHECK_SEARCH_RUNTIME_GUARDS_PASS = 'v189-frontend-check-search-runtime-guards-pass';

function runSearchRuntimeGuardChecks(ctx) {
  const {
    docsRoot,
    readerSource,
    readerVirtualLayoutSource,
    searchMatcherSource,
    searchSource,
    searchResultsViewSource,
    searchStatusPanelSource,
    searchStatusFormattersSource,
    searchCoverageSummarySource = '',
    searchStatusDetailRowsSource,
    searchFilterControlsSource,
    searchJumpStatusSource,
    searchRetryDispatcherSource,
    searchAnnouncementFormattersSource,
    searchNavigationUiSource,
    searchSessionResetSource,
    searchJumpInfoSource,
    stateSource
  } = ctx;

['SEARCH_PERFORMANCE_PASS','v145-search-performance-pass','SEARCH_RESULT_FILTER_CACHE_PASS','v145-search-result-filter-cache-pass','getSearchResultFilterSnapshot','buildSearchResultFilterSnapshot','statCommitCoalesced'].forEach((marker) => {
  if (!searchMatcherSource.includes(marker)) throw new Error('Missing v145 search matcher performance marker: ' + marker);
});
['SEARCH_VISIBLE_INDEX_CACHE_PASS','v145-search-visible-index-cache-pass','resetSearchPerformanceCaches','visibleIndexesCache'].forEach((marker) => {
  if (!searchSource.includes(marker) && !searchFilterControlsSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v145 search visible-index cache marker: ' + marker);
});
['SEARCH_RESULT_RENDER_SKIP_PASS','v145-search-result-render-skip-pass','buildResultRenderSignature','searchRenderSignature','getSearchResultFilterSnapshot'].forEach((marker) => {
  if (!searchResultsViewSource.includes(marker)) throw new Error('Missing v145 search result render skip marker: ' + marker);
});
const phase145Source = readGuardHistoricalDoc(docsRoot, 'rebuild-phase145.md');
['Rebuild Phase 145','Search performance pass','v145-search-performance-pass','v145-search-result-filter-cache-pass','v145-search-result-render-skip-pass'].forEach((marker) => {
  if (!phase145Source.includes(marker)) throw new Error('Missing v145 phase doc marker: ' + marker);
});
const searchPerformance145Source = readGuardHistoricalDoc(docsRoot, 'search-performance-v145.md');
['filtered result snapshot cache','visible index cache','render signature skip','stats event coalescing'].forEach((marker) => {
  if (!searchPerformance145Source.includes(marker)) throw new Error('Missing v145 search performance doc marker: ' + marker);
});
const v149DocFiles = [
  'rebuild-phase149.md',
  'remaining-work-v149.md',
  'worklist-v149.md',
  'performance-optimization-v149.md',
  'optimization-audit-v149.md',
  'reader-velocity-buffer-v149.md',
  'search-complete-scan-v149.md',
  'library-virtual-renderer-readiness-v149.md',
  'default-virtual-renderer-guarded-rollout-v149.md',
  'migration-gap-audit.md'
];
for (const rel of v149DocFiles) {
  const full = path.join(docsRoot, rel);
  if (!fs.existsSync(full)) {}
}
['SEARCH_ALL_CHUNKS_COMPLETE_SCAN_PASS','v149-search-all-chunks-complete-scan-pass','buildSequentialChunkList','completeScanDone','resultLimitReached','lastScannedChunk'].forEach((marker) => {
  if (!searchMatcherSource.includes(marker)) throw new Error('Missing v149 complete full-search scan marker: ' + marker);
});
const phase149Source = readGuardHistoricalDoc(docsRoot, 'rebuild-phase149.md');
['Rebuild Phase 149','Reader scroll restore precision and velocity buffer tuning','v149-reader-velocity-buffer-pass','v149-search-all-chunks-complete-scan-pass'].forEach((marker) => {
  if (!phase149Source.includes(marker)) throw new Error('Missing v149 phase doc marker: ' + marker);
});
const readerVelocity149Source = readGuardHistoricalDoc(docsRoot, 'reader-velocity-buffer-v149.md');
['velocity-based edge threshold','adaptive virtual overscan','prefetch radius boost','bounded buffer'].forEach((marker) => {
  if (!readerVelocity149Source.includes(marker)) throw new Error('Missing v149 reader velocity doc marker: ' + marker);
});
const searchComplete149Source = readGuardHistoricalDoc(docsRoot, 'search-complete-scan-v149.md');
['dynamic totalChunks expansion','complete scan','result cap does not stop chunk traversal','lastScannedChunk'].forEach((marker) => {
  if (!searchComplete149Source.includes(marker)) throw new Error('Missing v149 search complete scan doc marker: ' + marker);
});
const v150DocFiles = [
  'rebuild-phase150.md',
  'remaining-work-v150.md',
  'worklist-v150.md',
  'performance-optimization-v150.md',
  'optimization-audit-v150.md',
  'search-full-scan-diagnostics-v150.md',
  'library-virtual-renderer-readiness-v150.md',
  'default-virtual-renderer-guarded-rollout-v150.md',
  'migration-gap-audit.md'
];
for (const rel of v150DocFiles) {
  const full = path.join(docsRoot, rel);
  if (!fs.existsSync(full)) {}
}
['SEARCH_FULL_SCAN_DIAGNOSTICS_PASS','v150-search-full-scan-diagnostics-pass','fullSearchDiagnosticsPass','buildSearchCompletionSummary','getSearchProcessedCount','getSearchModeLabel','searchCompletionSummary'].forEach((marker) => {
  if (!searchMatcherSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v150 full-search diagnostics marker: ' + marker);
});
['SEARCH_FULL_SCAN_UX_PASS','v150-search-full-scan-ux-pass','buildSearchRunSummary','buildSearchCompactSummary','renderSearchSummaryDetailRow','buildSearchStatusSuffix'].forEach((marker) => {
  if (!searchSource.includes(marker) && !searchStatusPanelSource.includes(marker) && !searchStatusFormattersSource.includes(marker) && !searchCoverageSummarySource.includes(marker)) throw new Error('Missing v150 full-search UX marker: ' + marker);
});
const phase150Source = readGuardHistoricalDoc(docsRoot, 'rebuild-phase150.md');
['Rebuild Phase 150','Full search UX and diagnostics polish','v150-search-full-scan-diagnostics-pass','v150-search-full-scan-ux-pass'].forEach((marker) => {
  if (!phase150Source.includes(marker)) throw new Error('Missing v150 phase doc marker: ' + marker);
});
const searchDiagnostics150Source = readGuardHistoricalDoc(docsRoot, 'search-full-scan-diagnostics-v150.md');
['processed chunk count','scanned chunk count','failed chunk count','dynamic total chunk expansion metadata'].forEach((marker) => {
  if (!searchDiagnostics150Source.includes(marker)) throw new Error('Missing v150 search diagnostics doc marker: ' + marker);
});

const v151DocFiles = [
  'rebuild-phase151.md',
  'remaining-work-v151.md',
  'worklist-v151.md',
  'performance-optimization-v151.md',
  'optimization-audit-v151.md',
  'search-result-jump-v151.md',
  'library-virtual-renderer-readiness-v151.md',
  'default-virtual-renderer-guarded-rollout-v151.md',
  'migration-gap-audit.md'
];
for (const rel of v151DocFiles) {
  const full = path.join(docsRoot, rel);
  if (!fs.existsSync(full)) {}
}
['SEARCH_RESULT_FIELD_VALIDATION_PASS','v151-search-result-field-validation-pass','resultFieldValidationPass','textLength'].forEach((marker) => {
  if (!searchMatcherSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v151 search result field validation marker: ' + marker);
});
['SEARCH_RESULT_JUMP_VALIDATION_PASS','v151-search-result-jump-validation-pass','validateSearchResultJump','recordSearchJumpValidation','lastJumpValidation','searchResultJumpValidationPass'].forEach((marker) => {
  if (!searchSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v151 search result jump validation marker: ' + marker);
});
['READER_SEARCH_JUMP_STABILITY_PASS','v151-reader-search-jump-stability-pass','hasVirtualChunkRows','lastReaderSearchJump','replace-load','in-window-scroll'].forEach((marker) => {
  if (!readerSource.includes(marker) && !readerVirtualLayoutSource.includes(marker)) throw new Error('Missing v151 reader search jump stability marker: ' + marker);
});
['READER_SEARCH_TARGET_RESOLUTION_PASS','v151-reader-search-target-resolution-pass','searchTargetResolutionPass','lastSearchTargetResolution'].forEach((marker) => {
  if (!readerVirtualLayoutSource.includes(marker)) throw new Error('Missing v151 reader search target resolution marker: ' + marker);
});
const phase151Source = readGuardHistoricalDoc(docsRoot, 'rebuild-phase151.md');
['Rebuild Phase 151','Search result jump and full-search field validation','v151-search-result-field-validation-pass','v151-search-result-jump-validation-pass'].forEach((marker) => {
  if (!phase151Source.includes(marker)) throw new Error('Missing v151 phase doc marker: ' + marker);
});
const searchJump151Source = readGuardHistoricalDoc(docsRoot, 'search-result-jump-v151.md');
['Search Result Jump v151','stale novel/episode results are refused','replace-load','lastSearchTargetResolution'].forEach((marker) => {
  if (!searchJump151Source.includes(marker)) throw new Error('Missing v151 search jump doc marker: ' + marker);
});


const v152DocFiles = [
  'rebuild-phase152.md',
  'remaining-work-v152.md',
  'worklist-v152.md',
  'performance-optimization-v152.md',
  'optimization-audit-v152.md',
  'search-jump-ux-v152.md',
  'library-virtual-renderer-readiness-v152.md',
  'default-virtual-renderer-guarded-rollout-v152.md',
  'migration-gap-audit.md'
];
for (const rel of v152DocFiles) {
  const full = path.join(docsRoot, rel);
  if (!fs.existsSync(full)) {}
}
['SEARCH_JUMP_UX_PASS','v152-search-jump-ux-pass','buildSearchJumpInfo','recordSearchJumpStatus','lastJumpStatus','announceSearchJump'].forEach((marker) => {
  if (!searchSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v152 search jump UX marker: ' + marker);
});
['SEARCH_JUMP_FAILURE_RECOVERY_PASS','v152-search-jump-failure-recovery-pass','recordSearchJumpFailure','renderSearchJumpFailureRow','retryLastSearchJump','lastJumpFailure'].forEach((marker) => {
  if (!searchSource.includes(marker) && !searchStatusPanelSource.includes(marker) && !searchStatusDetailRowsSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v152 search jump failure recovery marker: ' + marker);
});
const phase152Source = readGuardHistoricalDoc(docsRoot, 'rebuild-phase152.md');
['Rebuild Phase 152','Search jump UX and failure recovery polish','v152-search-jump-ux-pass','v152-search-jump-failure-recovery-pass'].forEach((marker) => {
  if (!phase152Source.includes(marker)) throw new Error('Missing v152 phase doc marker: ' + marker);
});
const searchJump152Source = readGuardHistoricalDoc(docsRoot, 'search-jump-ux-v152.md');
['Search Jump UX v152','lastJumpStatus','lastJumpFailure','retryLastSearchJump'].forEach((marker) => {
  if (!searchJump152Source.includes(marker)) throw new Error('Missing v152 search jump UX doc marker: ' + marker);
});

const v153DocFiles = [
  'rebuild-phase153.md',
  'remaining-work-v153.md',
  'worklist-v153.md',
  'performance-optimization-v153.md',
  'optimization-audit-v153.md',
  'reader-search-live-field-validation-v153.md',
  'library-virtual-renderer-readiness-v153.md',
  'default-virtual-renderer-guarded-rollout-v153.md',
  'migration-gap-audit.md'
];
for (const rel of v153DocFiles) {
  const full = path.join(docsRoot, rel);
  if (!fs.existsSync(full)) {}
}
['SEARCH_LIVE_FIELD_VALIDATION_PASS','v153-search-live-field-validation-pass','validateLastSearchJumpRetry','buildSearchJumpLiveFieldValidation','lastJumpLiveFieldValidation','lastJumpRetryValidation'].forEach((marker) => {
  if (!searchSource.includes(marker) && !searchStatusPanelSource.includes(marker) && !searchStatusDetailRowsSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v153 search live-field validation marker: ' + marker);
});
const phase153Source = readGuardHistoricalDoc(docsRoot, 'rebuild-phase153.md');
['Rebuild Phase 153','Reader/Search live-field validation pass','v153-search-live-field-validation-pass'].forEach((marker) => {
  if (!phase153Source.includes(marker)) throw new Error('Missing v153 phase doc marker: ' + marker);
});
const liveField153Source = readGuardHistoricalDoc(docsRoot, 'reader-search-live-field-validation-v153.md');
['Reader/Search Live Field Validation v153','stale retry guard','Recovery Center','lastJumpLiveFieldValidation'].forEach((marker) => {
  if (!liveField153Source.includes(marker)) throw new Error('Missing v153 live field doc marker: ' + marker);
});


  [
    'SEARCH_STATUS_DETAIL_ROWS_SPLIT_PASS',
    'v199-search-status-detail-rows-split-pass',
    'updateSearchChunkDetails',
    'formatSearchJumpLiveStatus',
    'searchStatusDetailRowsSplitPass'
  ].forEach((marker) => {
    if (!searchStatusDetailRowsSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v199 search status detail rows split marker: ' + marker);
  });
  if (/function updateSearchChunkDetails/m.test(searchStatusPanelSource)) throw new Error('status-panel.mjs still owns chunk detail row rendering after v199 split');


  [
    'SEARCH_FILTER_CONTROLS_SPLIT_PASS',
    'v200-search-filter-controls-split-pass',
    'updateSearchModeControls',
    'getVisibleSearchResultIndexes',
    'resetSearchPerformanceCaches',
    'searchFilterControlsSplitPass'
  ].forEach((marker) => {
    if (!searchFilterControlsSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v200 search filter controls split marker: ' + marker);
  });
  if (/function getVisibleSearchResultIndexes/m.test(searchSource)) throw new Error('search.mjs still owns visible result index cache after v200 split');
  if (/function updateSearchModeControls/m.test(searchSource)) throw new Error('search.mjs still owns mode controls after v200 split');
  [
    'SEARCH_JUMP_STATUS_HELPERS_SPLIT_PASS',
    'v201-search-jump-status-helpers-split-pass',
    'SEARCH_RETRY_DISPATCHER_SPLIT_PASS',
    'v201-search-retry-dispatcher-split-pass',
    'searchRetryStatusSplitPass',
    'v201-search-retry-status-split-pass'
  ].forEach((marker) => {
    if (!searchJumpStatusSource.includes(marker) && !searchRetryDispatcherSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v201 search retry/status split marker: ' + marker);
  });
  if (/^function buildSearchJumpMessage/m.test(searchSource)) throw new Error('search.mjs still owns search jump message helper after v201 split');
  if (/^function handleSearchRetrybarClick/m.test(searchSource)) throw new Error('search.mjs still owns retrybar click dispatcher after v201 split');

  [
    'SEARCH_STATUS_FORMATTERS_SPLIT_PASS',
    'v202-search-status-formatters-split-pass',
    'buildSearchStatusSuffix',
    'describeCoveragePreview',
    'searchStatusFormattersSplitPass'
  ].forEach((marker) => {
    if (!searchStatusFormattersSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v202 search status formatter split marker: ' + marker);
  });
  if (/function buildSearchRunSummary/.test(searchStatusPanelSource)) throw new Error('status-panel.mjs still owns run summary formatter after v202 split');
  if (/function describeCoveragePreview/.test(searchStatusPanelSource)) throw new Error('status-panel.mjs still owns coverage preview formatter after v202 split');


  [
    'SEARCH_COVERAGE_SUMMARY_HELPER_PASS',
    'v234-search-coverage-summary-helper-pass',
    'buildSearchCoverageSummaryPayload',
    'buildSearchCoverageSummaryMarkers',
    'buildSearchJumpFailureSummary'
  ].forEach((marker) => {
    if (!searchCoverageSummarySource.includes(marker)) throw new Error('Missing v234 search coverage summary helper marker: ' + marker);
  });
  if (!searchStatusPanelSource.includes('buildSearchCoverageSummaryPayload')) throw new Error('status-panel.mjs must use v234 search coverage summary helper');
  if (searchStatusPanelSource.includes('buildSearchRunSummary(app, stats, preview)')) throw new Error('status-panel.mjs still assembles full scan summary directly after v234 split');

  [
    'SEARCH_ANNOUNCEMENT_FORMATTERS_SPLIT_PASS',
    'v203-search-announcement-formatters-split-pass',
    'getSearchJumpSourceLabel',
    'announceSearchJumpStatus',
    'searchAnnouncementFormattersSplitPass'
  ].forEach((marker) => {
    if (!searchAnnouncementFormattersSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v203 search announcement formatter split marker: ' + marker);
  });
  if (/^function getSearchJumpSourceLabel/m.test(searchSource)) throw new Error('search.mjs still owns jump source label formatter after v203 split');


  [
    'SEARCH_NAVIGATION_UI_SPLIT_PASS',
    'v204-search-navigation-ui-split-pass',
    'syncSearchNavigationButtons',
    'ensureActiveSearchResultVisible',
    'searchNavigationUiSplitPass'
  ].forEach((marker) => {
    if (!searchNavigationUiSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v204 search navigation UI split marker: ' + marker);
  });
  if (/^function syncNavigationButtons/m.test(searchSource)) throw new Error('search.mjs still owns navigation button sync after v204 split');
  if (/^function ensureActiveResultVisible/m.test(searchSource)) throw new Error('search.mjs still owns active result visibility helper after v204 split');

  [
    'SEARCH_SESSION_RESET_HELPERS_SPLIT_PASS',
    'v205-search-session-reset-helpers-split-pass',
    'buildSearchSessionResetSnapshot',
    'applySearchSessionCoreReset',
    'searchSessionResetHelpersSplitPass'
  ].forEach((marker) => {
    if (!searchSessionResetSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v205 search session reset helper split marker: ' + marker);
  });
  if (searchSource.includes('const previous = {') && searchSource.includes('query: String(search.query')) throw new Error('search.mjs still owns full reset snapshot assembly after v205 split');
  if (searchSource.includes('search.abortController?.abort?.();\n  search.abortController = null;\n  search.runId')) throw new Error('search.mjs still owns core session reset field mutation after v205 split');

  [
    'SEARCH_JUMP_INFO_SPLIT_PASS',
    'v206-search-jump-info-split-pass',
    'buildSearchJumpInfo',
    'searchJumpInfoSplitPass'
  ].forEach((marker) => {
    if (!searchJumpInfoSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v206 search jump info split marker: ' + marker);
  });
  if (/^function buildSearchJumpInfo/m.test(searchSource)) throw new Error('search.mjs still owns jump info construction after v206 split');

}

module.exports = {
  FRONTEND_CHECK_SEARCH_RUNTIME_GUARDS_PASS,
  runSearchRuntimeGuardChecks
};
