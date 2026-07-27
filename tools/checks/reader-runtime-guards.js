const path = require('path');
const { readHistoricalDocSourceManifest } = require('./source-loader-manifest.js');

function readGuardHistoricalDoc(docsRoot, rel) {
  return readHistoricalDocSourceManifest(path.dirname(docsRoot), [rel])[rel];
}


const FRONTEND_CHECK_READER_RUNTIME_GUARDS_PASS = 'v189-frontend-check-reader-runtime-guards-pass';

function runReaderRuntimeGuardChecks(ctx) {
  const {
    docsRoot,
    readerSource,
    prefetchQueueSource,
    readerPrefetchSnapshotSource,
    readerPrefetchScheduleSource,
    offlineStatusSource,
    readerOfflineStatusFormattersSource,
    readerChunkWindowSource,
    readerChunkWindowDiagnosticsSource,
    readerChunkWindowPruneSource,
    readerVirtualLayoutSource,
    readerVirtualLayoutDiagnosticsSource,
    readerVirtualLayoutReportLabelsSource,
    readerVirtualRowSignatureSource,
    searchSource,
    searchRemoconUiSource,
    stateSource,
    uiSource,
    appCssSource,
    shellSource
  } = ctx;

['READER_INTERACTION_PASS','v143-reader-interaction-pass','installReaderInteractionControls','handleReaderTap','handleReaderSwipe','toggleReaderChrome','animateReaderScrollBy'].forEach((marker) => {
  if (!readerSource.includes(marker)) throw new Error('Missing v143 reader interaction marker: ' + marker);
});
['reader-bars-hidden','#toolbar','#nav-bar','#safe-area-bar','reader-drag-panning','library-move-settings-card'].forEach((marker) => {
  if (!appCssSource.includes(marker)) throw new Error('Missing v143 reader interaction CSS marker: ' + marker);
});
if (!shellSource.includes('data-settings-relocated-from="func-panel-v143"')) throw new Error('Missing v143 relocated library movement settings marker');
{
  const funcPanelStart = shellSource.indexOf('id="func-panel"');
  const funcPanelEnd = shellSource.indexOf('id="fstatusbar-panel"', funcPanelStart);
  const funcPanel = shellSource.slice(funcPanelStart, funcPanelEnd > funcPanelStart ? funcPanelEnd : shellSource.length);
  if (funcPanel.includes('라이브러리 이동')) throw new Error('v143 must move library movement settings out of the function tab control panel');
}
['READER_CACHE_WARMUP_PASS','v144-reader-cache-warmup-pass','scheduleReaderInteractionWarmup','readerCacheWarmupPass'].forEach((marker) => {
  if (!readerSource.includes(marker)) throw new Error('Missing v144 reader warmup marker: ' + marker);
});
['READER_PREFETCH_WARMUP_PASS','PREFETCH_SCHEDULE_COALESCE_MS','skippedLoaded','skippedDuplicate','skippedCoalesced','dropped'].forEach((marker) => {
  if (!prefetchQueueSource.includes(marker)) throw new Error('Missing v144 prefetch optimization marker: ' + marker);
});
['buildReaderPrefetchScheduleSignature','buildReaderPrefetchCandidates'].forEach((marker) => {
  if (!prefetchQueueSource.includes(marker) && !readerPrefetchScheduleSource?.includes(marker)) throw new Error('Missing v144/v214 prefetch schedule helper marker: ' + marker);
});
['OFFLINE_COVERAGE_COALESCE_PASS','v144-offline-coverage-coalescing-pass','requestOfflineCoverageRefresh','PREFETCH_COVERAGE_REFRESH_MS','offlineCoverageRefreshRunning'].forEach((marker) => {
  if (!offlineStatusSource.includes(marker)) throw new Error('Missing v144 offline coverage coalescing marker: ' + marker);
});
['READER_OFFLINE_STATUS_FORMATTERS_PASS','v215-reader-offline-status-formatters-pass','buildOfflineButtonTitle','buildOfflinePanelViewModel','normalizeOfflineFailedChunks'].forEach((marker) => {
  if (!readerOfflineStatusFormattersSource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v215 offline status formatter marker: ' + marker);
});
if (!offlineStatusSource.includes('./offline-status-formatters.mjs')) throw new Error('offline-status.mjs must import v215 offline status formatter helper');
if (/function\s+normalizeFailedChunks/m.test(offlineStatusSource)) throw new Error('offline-status.mjs still owns failed chunk normalization after v215 split');
const phase144Source = readGuardHistoricalDoc(docsRoot, 'rebuild-phase144.md');
['Rebuild Phase 144','Reader cache and chunk warmup optimization','v144-reader-cache-warmup-pass','v144-offline-coverage-coalescing-pass'].forEach((marker) => {
  if (!phase144Source.includes(marker)) throw new Error('Missing v144 phase doc marker: ' + marker);
});
const readerCacheWarmup144Source = readGuardHistoricalDoc(docsRoot, 'reader-cache-warmup-v144.md');
['prefetch schedule coalescing','skip diagnostics','offline coverage coalescing','interaction-aware warmup'].forEach((marker) => {
  if (!readerCacheWarmup144Source.includes(marker)) throw new Error('Missing v144 reader cache/warmup doc marker: ' + marker);
});
['READER_MOBILE_STABILITY_PASS','v146-mobile-interaction-stability-pass','readerMobileStabilityPass','isMobileLibraryOverlayOpen','markReaderSuppressNextClick','shouldSuppressReaderClick','readerSuppressNextClickUntil'].forEach((marker) => {
  if (!readerSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v146 reader mobile stability marker: ' + marker);
});
['MOBILE_LIBRARY_STABILITY_PASS','v146-mobile-library-sidebar-stability-pass','mobileLibraryStabilityPass','sidebarSwipe','library-open'].forEach((marker) => {
  if (!uiSource.includes(marker)) throw new Error('Missing v146 mobile sidebar stability marker: ' + marker);
});
['SITE_SIDEBAR_CLOSE_BINDING_PASS','v209-site-sidebar-close-binding-pass','siteSidebarCloseBindingPass','closeFromSidebarButton','library-collapsed'].forEach((marker) => {
  if (!uiSource.includes(marker)) throw new Error('Missing v209 site sidebar close binding marker: ' + marker);
});
['SEARCH_REMOCON_VIEWPORT_CLAMP_PASS','v146-search-remocon-viewport-clamp-pass','scheduleSearchRemoteViewportClamp','remoteClampRaf','visualViewport','rectWidth'].forEach((marker) => {
  if (!searchSource.includes(marker) && !searchRemoconUiSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v146 search remocon viewport marker: ' + marker);
});
['v146-mobile-interaction-stability-pass','v146-mobile-library-sidebar-stability-pass','v146-search-remocon-viewport-clamp-pass','body.mobile-library-overlay.library-open','body.reader-bars-hidden #search-nav-remote'].forEach((marker) => {
  if (!appCssSource.includes(marker)) throw new Error('Missing v146 mobile interaction CSS marker: ' + marker);
});
const phase146Source = readGuardHistoricalDoc(docsRoot, 'rebuild-phase146.md');
['Rebuild Phase 146','Mobile interaction stability pass','v146-mobile-interaction-stability-pass','v146-mobile-library-sidebar-stability-pass','v146-search-remocon-viewport-clamp-pass'].forEach((marker) => {
  if (!phase146Source.includes(marker)) throw new Error('Missing v146 phase doc marker: ' + marker);
});
['SEARCH_REMOCON_UI_SPLIT_PASS','v198-search-remocon-ui-split-pass','installSearchRemoteDrag','applyRemotePosition','searchRemoconUiSplitPass'].forEach((marker) => {
  if (!searchRemoconUiSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v198 search remocon UI split marker: ' + marker);
});
if (/function installSearchRemoteDrag/m.test(searchSource)) throw new Error('search.mjs still owns remocon drag helper after v198 split');
const mobileInteraction146Source = readGuardHistoricalDoc(docsRoot, 'mobile-interaction-stability-v146.md');
['ghost click suppression','mobile sidebar swipe close','visualViewport remocon clamp','safe-area remains visible'].forEach((marker) => {
  if (!mobileInteraction146Source.includes(marker)) throw new Error('Missing v146 mobile interaction doc marker: ' + marker);
});

['READER_SCROLL_BUFFER_PASS','v147-reader-scroll-buffer-pass','readerScrollBufferPass'].forEach((marker) => {
  if (!readerSource.includes(marker)) throw new Error('Missing v147 reader scroll buffer marker: ' + marker);
});
['READER_CHUNK_WINDOW_BUFFER_PASS','MAX_EXTEND_BATCH','warmAheadFromScroll','getReaderChunkExtendEdgePx'].forEach((marker) => {
  if (!readerChunkWindowSource.includes(marker)) throw new Error('Missing v147 chunk window buffer marker: ' + marker);
});
['READER_CHUNK_WINDOW_DIAGNOSTICS_PASS','v218-reader-chunk-window-diagnostics-pass','READER_CHUNK_WINDOW_EDGE_LIMITS','getReaderChunkWindowExtendEdgePx','getReaderChunkWindowExtendBatchSize','getReaderChunkWindowWarmRadius'].forEach((marker) => {
  if (!readerChunkWindowDiagnosticsSource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v218 chunk-window diagnostics helper marker: ' + marker);
});
if (!readerChunkWindowSource.includes('./chunk-window-diagnostics.mjs')) throw new Error('chunk-window.mjs must import v218 diagnostics helper');
['READER_CHUNK_WINDOW_PRUNE_HELPER_PASS','v219-reader-chunk-window-prune-helper-pass','buildReaderChunkPrunePlan','sumRemovedChunkHeightBeforeVisible'].forEach((marker) => {
  if (!readerChunkWindowPruneSource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v219 chunk-window prune helper marker: ' + marker);
});
if (!readerChunkWindowSource.includes('./chunk-window-prune.mjs')) throw new Error('chunk-window.mjs must import v219 prune helper');
if (/while \(chunks\.length > MAX_LOADED_CHUNKS\)[\s\S]*app\.state\.loadedChunks\.delete\(remove\)/m.test(readerChunkWindowSource)) throw new Error('chunk-window.mjs still owns prune selection loop after v219 split');
['READER_SCROLL_BUFFER_PREFETCH_PASS','v147-reader-scroll-buffer-pass','bufferPass'].forEach((marker) => {
  if (!prefetchQueueSource.includes(marker)) throw new Error('Missing v147 prefetch buffer marker: ' + marker);
});
['READER_SCROLL_BUFFER_PASS','VIRTUAL_OVERSCAN_MIN_PX','VIRTUAL_OVERSCAN_VIEWPORT_MULTIPLIER','MAX_RENDERED_ROWS = 180','bufferPass'].forEach((marker) => {
  if (!readerVirtualLayoutSource.includes(marker)) throw new Error('Missing v147 virtual layout buffer marker: ' + marker);
});
['READER_VIRTUAL_LAYOUT_DIAGNOSTICS_HELPER_PASS','v220-reader-virtual-layout-diagnostics-helper-pass','buildVirtualLayoutDiagnosticsSnapshot','createVirtualLayoutUnavailableDiagnostics'].forEach((marker) => {
  if (!readerVirtualLayoutDiagnosticsSource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v220 virtual layout diagnostics helper marker: ' + marker);
});
if (!readerVirtualLayoutSource.includes('./virtual-layout-diagnostics.mjs')) throw new Error('virtual-layout.mjs must import v220 diagnostics helper');
if (/const liveIds = new Set\(rows\.map\(row => row\?\.id\)/m.test(readerVirtualLayoutSource)) throw new Error('virtual-layout.mjs still owns diagnostics snapshot internals after v220 split');
['READER_VIRTUAL_LAYOUT_DIAGNOSTICS_BOUNDARY_PASS','v222-reader-virtual-layout-diagnostics-boundary-pass','buildVirtualLayoutDiagnosticsBoundary'].forEach((marker) => {
  if (!readerVirtualLayoutDiagnosticsSource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v222 virtual layout diagnostics boundary marker: ' + marker);
});
if (/if \(!v\) return createVirtualLayoutUnavailableDiagnostics\(content\)/m.test(readerVirtualLayoutSource)) throw new Error('virtual-layout.mjs still owns unavailable diagnostics boundary after v222 split');

['READER_VIRTUAL_LAYOUT_DIAGNOSTICS_REPORT_SURFACE_PASS','v223-reader-virtual-layout-diagnostics-report-surface-pass','buildVirtualLayoutDiagnosticsReportSurface','attachVirtualLayoutDiagnosticsReportSurface'].forEach((marker) => {
  if (!readerVirtualLayoutDiagnosticsSource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v223 virtual layout diagnostics report surface marker: ' + marker);
});
if (/reportSurface:\s*\{/m.test(readerVirtualLayoutSource)) throw new Error('virtual-layout.mjs must not own diagnostics report surface assembly after v223 split');
['READER_VIRTUAL_LAYOUT_REPORT_LABELS_PASS','v224-reader-virtual-layout-report-labels-pass','READER_VIRTUAL_LAYOUT_EXPORT_SUMMARY_PASS','v225-reader-virtual-layout-export-summary-pass','READER_VIRTUAL_LAYOUT_EXPORT_SHAPE_GUARD_PASS','v226-reader-virtual-layout-export-shape-guard-pass','READER_VIRTUAL_LAYOUT_EXPORT_PAYLOAD_SHAPE_REPORT_PASS','v232-reader-virtual-layout-export-payload-shape-report-pass','READER_VIRTUAL_LAYOUT_REPORT_SURFACE_SHAPE_GUARD_PASS','v235-reader-virtual-layout-report-surface-shape-guard-pass','v236-reader-virtual-layout-available-boundary-smoke-pass','formatVirtualLayoutAvailability','formatVirtualLayoutStatusLabel','buildVirtualLayoutCopyLabel','buildVirtualLayoutReportSummary','buildVirtualLayoutExportSummary','isVirtualLayoutExportSummaryShape','buildVirtualLayoutExportShapeReport','isVirtualLayoutReportSurfaceShape'].forEach((marker) => {
  if (!readerVirtualLayoutReportLabelsSource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v224 virtual layout report labels marker: ' + marker);
});
if (!readerVirtualLayoutDiagnosticsSource?.includes('./virtual-layout-report-labels.mjs')) throw new Error('virtual-layout-diagnostics.mjs must import v224 report label helper');
if (!readerVirtualLayoutDiagnosticsSource?.includes('buildVirtualLayoutReportSummary')) throw new Error('virtual-layout-diagnostics.mjs must use v225 report summary helper');
if (!readerVirtualLayoutDiagnosticsSource?.includes('buildVirtualLayoutExportShapeReport')) throw new Error('virtual-layout-diagnostics.mjs must attach v232 export shape report helper');
if (/rendered \$\{renderedRows\} rows \/ mounted \$\{mountedRows\}/m.test(readerVirtualLayoutDiagnosticsSource)) throw new Error('virtual-layout-diagnostics.mjs still owns report status label template after v224 split');

['READER_VIRTUAL_ROW_SIGNATURE_HELPER_PASS','v221-reader-virtual-row-signature-helper-pass','buildVirtualRowDomSignature','getVirtualRowTextSignature'].forEach((marker) => {
  if (!readerVirtualRowSignatureSource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v221 virtual row signature helper marker: ' + marker);
});
if (!readerVirtualLayoutSource.includes('./virtual-row-signature.mjs')) throw new Error('virtual-layout.mjs must import v221 row signature helper');
if (/function\s+getVirtualRowTextSignature/m.test(readerVirtualLayoutSource)) throw new Error('virtual-layout.mjs still owns row text signature helper after v221 split');
const phase147Source = readGuardHistoricalDoc(docsRoot, 'rebuild-phase147.md');
['Rebuild Phase 147','Reader long-scroll stability and buffered chunk pass','v147-reader-scroll-buffer-pass','v147-reader-chunk-window-buffer-pass'].forEach((marker) => {
  if (!phase147Source.includes(marker)) throw new Error('Missing v147 phase doc marker: ' + marker);
});
const readerBuffer147Source = readGuardHistoricalDoc(docsRoot, 'reader-scroll-buffer-v147.md');
['loaded chunk window','adaptive virtual overscan','earlier edge append/prepend','scroll-direction warmup'].forEach((marker) => {
  if (!readerBuffer147Source.includes(marker)) throw new Error('Missing v147 reader buffer doc marker: ' + marker);
});
['READER_ROW_DOM_POOL_PASS','v148-reader-row-dom-pool-pass','VIRTUAL_ROW_DOM_POOL_MAX','rowElementPool','rowElementPoolStats','getPooledVirtualRow','buildVirtualRowDomSignature','pruneVirtualRowElementPool','rowElementPoolPass'].forEach((marker) => {
  if (!readerVirtualLayoutSource.includes(marker)) throw new Error('Missing v148 reader row DOM pool marker: ' + marker);
});
const phase148Source = readGuardHistoricalDoc(docsRoot, 'rebuild-phase148.md');
['Rebuild Phase 148','Reader DOM pool and measured row reuse audit','v148-reader-row-dom-pool-pass','rowElementPoolStats'].forEach((marker) => {
  if (!phase148Source.includes(marker)) throw new Error('Missing v148 phase doc marker: ' + marker);
});
const readerDomPool148Source = readGuardHistoricalDoc(docsRoot, 'reader-dom-pool-v148.md');
['DOM row pool','pooled row reuse','bounded pool cap','search highlight signature'].forEach((marker) => {
  if (!readerDomPool148Source.includes(marker)) throw new Error('Missing v148 reader DOM pool doc marker: ' + marker);
});
['READER_VELOCITY_BUFFER_PASS','v149-reader-velocity-buffer-pass','readerVelocityBufferPass'].forEach((marker) => {
  if (!readerSource.includes(marker)) throw new Error('Missing v149 reader velocity marker: ' + marker);
});
['READER_VELOCITY_CHUNK_WINDOW_PASS','v149-reader-velocity-chunk-window-pass','lastScrollBufferVelocityPxMs','getReaderScrollVelocity'].forEach((marker) => {
  if (!readerChunkWindowSource.includes(marker)) throw new Error('Missing v149 chunk-window velocity marker: ' + marker);
});
['velocityBoostMaxPx','fastScrollSpeedPxPerMs','veryFastScrollSpeedPxPerMs'].forEach((marker) => {
  if (!readerChunkWindowDiagnosticsSource?.includes(marker)) throw new Error('Missing v149/v218 chunk-window velocity policy marker: ' + marker);
});
['READER_VELOCITY_BUFFER_PASS','v149-reader-velocity-buffer-pass','VIRTUAL_OVERSCAN_VELOCITY_BOOST_MAX_PX','velocityBufferStats','lastVelocityPxMs','MAX_RENDERED_ROWS = 180','VIRTUAL_ROW_DOM_POOL_MAX = 300'].forEach((marker) => {
  if (!readerVirtualLayoutSource.includes(marker)) throw new Error('Missing v149 virtual velocity marker: ' + marker);
});
['READER_VELOCITY_PREFETCH_PASS','v149-reader-velocity-prefetch-pass','velocityPrefetchPass','lastVelocityPxMs'].forEach((marker) => {
  if (!prefetchQueueSource.includes(marker)) throw new Error('Missing v149 prefetch velocity marker: ' + marker);
});

['READER_PREFETCH_SNAPSHOT_HELPER_PASS','v213-reader-prefetch-snapshot-helper-pass','buildReaderPrefetchSnapshot'].forEach((marker) => {
  if (!readerPrefetchSnapshotSource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v213 prefetch snapshot helper marker: ' + marker);
});
if (!prefetchQueueSource.includes('./prefetch-snapshot.mjs')) throw new Error('prefetch-queue.mjs must import v213 prefetch snapshot helper');
if (/export\s+function\s+getReaderPrefetchSnapshot[\s\S]*?enqueued:\s*Number\(stats\.enqueued\)/m.test(prefetchQueueSource)) throw new Error('prefetch-queue.mjs still owns snapshot shape after v213 split');
['READER_PREFETCH_SCHEDULE_HELPER_PASS','v214-reader-prefetch-schedule-helper-pass','buildReaderPrefetchCandidates','buildReaderPrefetchScheduleSignature','getReaderPrefetchRadiusFromNetwork'].forEach((marker) => {
  if (!readerPrefetchScheduleSource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v214 prefetch schedule helper marker: ' + marker);
});
if (!prefetchQueueSource.includes('./prefetch-schedule.mjs')) throw new Error('prefetch-queue.mjs must import v214 prefetch schedule helper');
if (/function\s+buildCandidates/m.test(prefetchQueueSource) || /function\s+buildPrefetchScheduleSignature/m.test(prefetchQueueSource)) throw new Error('prefetch-queue.mjs still owns prefetch candidate/signature helpers after v214 split');

const phase149Source = readGuardHistoricalDoc(docsRoot, 'rebuild-phase149.md');
['Rebuild Phase 149','Reader scroll restore precision and velocity buffer tuning','v149-reader-velocity-buffer-pass','v149-search-all-chunks-complete-scan-pass'].forEach((marker) => {
  if (!phase149Source.includes(marker)) throw new Error('Missing v149 phase doc marker: ' + marker);
});
const readerVelocity149Source = readGuardHistoricalDoc(docsRoot, 'reader-velocity-buffer-v149.md');
['velocity-based edge threshold','adaptive virtual overscan','prefetch radius boost','bounded buffer'].forEach((marker) => {
  if (!readerVelocity149Source.includes(marker)) throw new Error('Missing v149 reader velocity doc marker: ' + marker);
});
const phase143Source = readGuardHistoricalDoc(docsRoot, 'rebuild-phase143.md');
['Rebuild Phase 143','Reader interaction and cache/warmup audit','v143-reader-interaction-pass','reader-bars-hidden'].forEach((marker) => {
  if (!phase143Source.includes(marker)) throw new Error('Missing v143 phase doc marker: ' + marker);
});
const readerInteraction143Source = readGuardHistoricalDoc(docsRoot, 'reader-interaction-v143.md');
['PC drag panning','tap navigation','center chrome toggle','swipe navigation','safe-area remains visible'].forEach((marker) => {
  if (!readerInteraction143Source.includes(marker)) throw new Error('Missing v143 reader interaction doc marker: ' + marker);
});
}

module.exports = {
  FRONTEND_CHECK_READER_RUNTIME_GUARDS_PASS,
  runReaderRuntimeGuardChecks
};
