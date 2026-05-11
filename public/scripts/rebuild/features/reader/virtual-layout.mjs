import { clamp, createEl, escapeHtml } from '../../core/utils.mjs';
import { splitContentBlocks } from './text-blocks.mjs';
import { getVirtualChunkHeading, hasVirtualChunkHeading } from './chunk-headings.mjs';
import { decorateRowsWithGlobalBlocks, chunkCharToDocumentRatio, chunkCharToFileChar, chunkStateToDocumentRatio, estimateTotalBlocks, fileCharToChunkAddress, fileCharToDocumentRatio, hasBlockManifest, READER_FULL_FILE_CHAR_PROGRESS_PASS, READER_MANIFEST_BLOCK_CHAR_RANGES_PASS } from './coordinates.mjs';
import { buildVirtualLayoutDiagnosticsBoundary } from './virtual-layout-diagnostics.mjs';
import { buildVirtualRowDomSignature } from './virtual-row-signature.mjs';
import { READER_MULTI_FILE_BODY_ANCHOR_PASS, READER_VIRTUAL_SCROLL_STABILITY_PASS, applyVirtualScrollAnchor, captureVirtualScrollAnchor } from './virtual-scroll-stability.mjs';
import { READER_RENDER_WINDOW_ANCHOR_PASS, captureVirtualRenderWindowAnchor, restoreVirtualRenderWindowAnchor, syncVirtualSpacerHeights } from './virtual-render-stability.mjs';
import { READER_ACTIVE_RENDER_WINDOW_PIN_PASS, resolveStableVirtualRenderRange } from './virtual-window-range-stability.mjs';

export const READER_ANCHOR_TRACE_EXPORT_PASS = 'v444-reader-anchor-trace-export-pass';
export const READER_ANCHOR_TRACE_LOW_OVERHEAD_PASS = 'v450-reader-anchor-trace-low-overhead-pass';
export const READER_BODY_ANCHOR_INERTIA_RETAIN_PASS = 'v445-reader-body-anchor-inertia-retain-pass';
export const READER_INERTIA_FIXTURE_EXPANSION_PASS = 'v446-reader-inertia-fixture-expansion-pass';
const READER_ANCHOR_TRACE_LIMIT = 32;
const READER_SCROLL_BUFFER_PASS = 'v147-reader-scroll-buffer-pass';
const READER_CHUNK_WINDOW_BUFFER_PASS = 'v147-reader-chunk-window-buffer-pass';
const READER_ROW_DOM_POOL_PASS = 'v148-reader-row-dom-pool-pass';
const READER_VELOCITY_BUFFER_PASS = 'v149-reader-velocity-buffer-pass';
export const READER_SEARCH_TARGET_RESOLUTION_PASS = 'v151-reader-search-target-resolution-pass';
const VIRTUAL_OVERSCAN_MIN_PX = 2200;
const VIRTUAL_OVERSCAN_VIEWPORT_MULTIPLIER = 2.6;
const VIRTUAL_OVERSCAN_MAX_PX = 5600;
const VIRTUAL_OVERSCAN_VELOCITY_BOOST_MAX_PX = 3600;
const VIRTUAL_SCROLL_FAST_SPEED_PX_PER_MS = 1.35;
const VIRTUAL_SCROLL_VERY_FAST_SPEED_PX_PER_MS = 2.4;
const MAX_RENDERED_ROWS = 180;
const VIRTUAL_ACTIVE_RENDER_WINDOW_MAX_ROWS = 300;
const VIRTUAL_ACTIVE_RENDER_IDLE_COMPACT_GRACE_MS = 420;
const VIRTUAL_ROW_DOM_POOL_MAX = 300;
const HEIGHT_EPSILON = 2;
const SEARCH_MARK_CLASS = 'search-jump-highlight';
const SEARCH_TARGET_CLASS = 'reader-search-target';
const VIRTUAL_SCROLL_STABILITY_ANCHOR_OFFSET_PX = 36;
const VIRTUAL_SCROLL_ACTIVE_GRACE_MS = 240;
const VIRTUAL_MEASURE_IDLE_GRACE_MS = 180;
const VIRTUAL_RENDER_REUSE_MARGIN_MIN_PX = 900;
const VIRTUAL_RENDER_REUSE_MARGIN_VIEWPORT_MULTIPLIER = 1.15;
const READER_SCROLL_INPUT_DIAGNOSTICS_PASS = 'v241-reader-scroll-input-diagnostics-pass';
const READER_PREPEND_ANCHOR_PRESERVE_PASS = 'v283-reader-prepend-anchor-preserve-pass';
const READER_PREPEND_ANCHOR_GATED_PASS = 'v284-reader-prepend-anchor-gated-pass';
const READER_APPEND_ANCHOR_GATED_PASS = 'v285-reader-append-anchor-gated-pass';
const READER_APPEND_INCREMENTAL_LAYOUT_PASS = 'v286-reader-append-incremental-layout-pass';
const READER_SCROLL_SETTLE_COMPACTION_PASS = 'v288-reader-scroll-settle-compaction-pass';
const READER_ACTIVE_RENDER_PATCH_PASS = 'v289-reader-active-render-window-patch-pass';
const READER_SCROLL_SETTLE_NATIVE_FREEZE_PASS = 'v290-reader-scroll-settle-native-freeze-pass';
const READER_SCROLL_APPEND_RENDER_DEFER_PASS = 'v312-reader-scroll-append-render-defer-pass';
const READER_MULTI_EPISODE_APPEND_ANCHOR_PASS = 'v355-reader-multi-episode-append-anchor-pass';
const READER_APPEND_MEASURE_ANCHOR_PASS = 'v355-reader-append-measure-anchor-pass';
const READER_BOTTOM_PROGRESS_CLAMP_PASS = 'v357-reader-bottom-progress-clamp-pass';
const READER_SCROLL_BUFFER_PATCH_ANCHOR_PASS = 'v358-reader-scroll-buffer-patch-anchor-pass';
const READER_RATIO_SCROLL_TARGET_PASS = 'v359-reader-ratio-scroll-target-pass';
const READER_SLIDER_RATIO_SCROLL_ANCHOR_PASS = 'v464-reader-slider-ratio-scroll-anchor-pass';
const READER_SLIDER_BLOCK_DIRECT_ANCHOR_PASS = 'v465-reader-slider-block-direct-anchor-pass';
const READER_NAV_SLIDER_ANCHOR_OFFSET_TARGET_PASS = 'v516-reader-nav-slider-anchor-offset-target-pass';
const READER_SLIDER_CHAR_TARGET_ANCHOR_PASS = 'v474-reader-slider-nearest-char-anchor-pass';
const READER_SLIDER_MEASURED_CHAR_ANCHOR_PASS = 'v475-reader-slider-measured-char-anchor-pass';
const READER_SLIDER_MEASURE_CORRECTION_MAX_TRIES = 3;
const READER_FULL_FILE_CHAR_PROGRESS_DIRECT_PASS = 'v474-reader-full-file-char-progress-direct-pass';
const READER_FULL_FILE_VISIBLE_ROW_MEASURED_PROGRESS_PASS = 'v476-reader-full-file-visible-row-measured-progress-pass';
const READER_CONTAINED_VISIBLE_ROW_PROGRESS_PASS = 'v477-reader-contained-visible-row-progress-pass';
const READER_SLIDER_PROGRAMMATIC_SCROLL_ISOLATION_PASS = 'v477-reader-slider-programmatic-scroll-isolation-pass';
const READER_SLIDER_STALE_MEASURE_TARGET_CLEAR_PASS = 'v479-reader-slider-stale-measure-target-clear-pass';
const READER_PROGRAMMATIC_SCROLL_ISOLATION_PASS = 'v479-reader-programmatic-scroll-isolation-pass';
const READER_MANIFEST_BLOCK_FALLBACK_PROGRESS_PASS = 'v481-reader-manifest-block-fallback-progress-pass';
const READER_EPISODE_BOTTOM_ANCHOR_STRICT_GATE_PASS = 'v481-reader-episode-bottom-anchor-strict-gate-pass';
const READER_APPEND_SEAM_SCROLLTOP_DIAGNOSTIC_PASS = 'v481-reader-append-seam-scrolltop-diagnostic-pass';
const READER_APPEND_NATIVE_UPWARD_RETAIN_PASS = 'v481-reader-append-native-upward-retain-pass';
const READER_APPEND_FILE_CHAR_ANCHOR_PASS = 'v482-reader-append-file-char-anchor-pass';
const READER_NATIVE_FORWARD_MEASURE_FREEZE_PASS = 'v483-reader-native-forward-measure-freeze-pass';
const READER_FILE_CHAR_VIEWPORT_PROGRESS_PASS = 'v484-reader-file-char-viewport-progress-pass';
const READER_APPEND_SEAM_PROGRESS_DIAGNOSTIC_PASS = 'v484-reader-append-seam-progress-diagnostic-pass';
const READER_PREPEND_FILE_CHAR_ANCHOR_PASS = 'v485-reader-prepend-file-char-anchor-pass';
const READER_NATIVE_BACKWARD_MEASURE_FREEZE_PASS = 'v485-reader-native-backward-measure-freeze-pass';
const READER_PREPEND_SEAM_SCROLLTOP_DIAGNOSTIC_PASS = 'v487-reader-prepend-seam-scrolltop-diagnostic-pass';
const READER_EPISODE_BOTTOM_ANCHOR_PASS = 'v360-reader-episode-bottom-anchor-pass';
const READER_APPEND_DEFERRED_SPACER_SYNC_PASS = 'v372-reader-append-deferred-spacer-sync-pass';
const READER_APPEND_SEAM_RENDER_PASS = 'v373-reader-append-seam-render-pass';
const READER_APPEND_UPWARD_CORRECTION_GUARD_PASS = 'v374-reader-append-upward-correction-guard-pass';
const READER_APPEND_CORRECTION_GUARD_PASS = 'v375-reader-append-correction-guard-pass';
const READER_PRUNE_EXACT_ANCHOR_PASS = 'v376-reader-prune-exact-anchor-pass';
const READER_ACTIVE_LEADING_RETAIN_PASS = 'v377-reader-active-leading-retain-pass';
const READER_SETTLED_MEASURE_FLUSH_PASS = 'v377-reader-settled-measure-flush-pass';
const READER_TRUSTED_BOTTOM_PROGRESS_PASS = 'v378-reader-trusted-bottom-progress-pass';
const READER_SAFE_AREA_BODY_ROW_PROGRESS_PASS = 'v446-safe-area-body-row-progress-pass';
const READER_PROGRESS_STABLE_WITHOUT_MANIFEST_PASS = 'v447-reader-progress-stable-without-manifest-pass';
const READER_PROGRESS_PHASE_REPORT_PASS = 'v448-reader-progress-phase-report-pass';
const READER_MANIFEST_ADOPTION_GUARD_PASS = 'v448-reader-manifest-adoption-guard-pass';
const READER_APPEND_SEAM_70_85_FIXTURE_PASS = 'v448-reader-append-seam-70-85-fixture-pass';
const READER_MULTI_FILE_LATE_MANIFEST_HOLD_PASS = 'v504-reader-multi-file-late-manifest-hold-pass';
const READER_MOBILE_70_80_ANCHOR_HOLD_PASS = 'v472-reader-mobile-70-80-anchor-hold-pass';
const READER_SCROLL_BUFFER_APPEND_INERTIA_EXTEND_PASS = 'v449-reader-scroll-buffer-append-inertia-extend-pass';
const READER_APPEND_MICRO_CORRECTION_DAMP_PASS = 'v449-reader-append-micro-correction-damp-pass';
const READER_IPAD_SCROLL_COAST_RETAIN_PASS = 'v451-reader-ipad-scroll-coast-retain-pass';
const READER_IPAD_TOUCH_NATIVE_SCROLL_ANCHOR_PASS = 'v454-reader-ipad-touch-native-scroll-anchor-pass';
const READER_MULTI_FILE_NATIVE_EXACT_ANCHOR_PASS = 'v458-reader-multi-file-native-exact-anchor-pass';
const READER_MULTI_FILE_BOTTOM_ANCHOR_NATIVE_GUARD_PASS = 'v458-reader-multi-file-bottom-anchor-native-guard-pass';
const READER_MULTI_FILE_NATIVE_SCROLL_SETTLE_EXACT_ANCHOR_PASS = 'v461-reader-multi-file-native-scroll-settle-exact-anchor-pass';
const READER_SCROLL_SETTLE_EXACT_ANCHOR_RESTORE_PASS = 'v463-reader-scroll-settle-exact-anchor-restore-pass';
const READER_APPEND_INCREMENTAL_INDEX_DELTA_PASS = 'v460-reader-append-incremental-index-delta-pass';
const READER_APPEND_INCREMENTAL_INDEX_DELTA_V466_PASS = 'v466-reader-append-incremental-index-delta-pass';
const READER_PRUNE_PREFIX_DELTA_GUARD_PASS = 'v466-reader-prune-prefix-delta-guard-pass';
const READER_SMALL_EPISODE_CHUNK_BOUNDARY_PASS = 'v383-reader-small-episode-chunk-boundary-pass';
const READER_APPEND_SEAM_ANCHOR_CORRECTION_PASS = 'v390-reader-append-seam-anchor-correction-pass';
const READER_APPEND_SEAM_NATIVE_SCROLL_RETAIN_PASS = 'v429-reader-append-seam-native-scroll-retain-pass';
const READER_APPEND_SEAM_CHUNK_WINDOW_SOURCE_PASS = 'v429-reader-append-seam-chunk-window-source-pass';
const READER_NATIVE_FORWARD_SCROLL_RETAIN_PASS = 'v430-reader-native-forward-scroll-retain-pass';
const READER_SCROLL_APPEND_CHUNK_WINDOW_DEFER_PASS = 'v430-reader-scroll-append-chunk-window-defer-pass';
const READER_ACTIVE_FORWARD_RENDER_ANCHOR_SUPPRESS_PASS = 'v430-reader-active-forward-render-anchor-suppress-pass';
const READER_NATIVE_FORWARD_SEAM_TRANSIT_LOCK_PASS = 'v431-reader-native-forward-seam-transit-lock-pass';
const READER_SEAM_TRANSIT_MEASURE_DEFER_PASS = 'v431-reader-seam-transit-measure-defer-pass';
const READER_NATIVE_FORWARD_SEAM_RENDER_HOLD_PASS = 'v432-reader-native-forward-seam-render-hold-pass';
const READER_UNIFIED_APPEND_RESTORE_POLICY_PASS = 'v510-reader-unified-append-restore-policy-pass';
const READER_UNIFIED_APPEND_MEASURE_POLICY_PASS = 'v511-reader-unified-append-measure-policy-pass';
const READER_UNIFIED_VIEWPORT_RESTORE_POLICY_PASS = 'v513-reader-unified-viewport-restore-policy-pass';
const READER_MULTI_FILE_GUARD_CLEANUP_PASS = 'v522-reader-multi-file-guard-cleanup-pass';
const READER_ROW_MEASURED_MARGIN_HEIGHT_PASS = 'v519-reader-row-measured-margin-height-pass';
const READER_ACTUAL_BOTTOM_PROGRESS_TRUST_PASS = 'v520-reader-actual-bottom-progress-trust-pass';
const VIRTUAL_APPEND_SEAM_EDGE_ROWS = 48;
const VIRTUAL_APPEND_SEAM_MIN_PX = 900;
const VIRTUAL_APPEND_SEAM_VIEWPORT_MULTIPLIER = 1.35;
const VIRTUAL_APPEND_MEASURE_ANCHOR_GRACE_MS = 720;
const VIRTUAL_APPEND_CORRECTION_GUARD_GRACE_MS = 1200;
const VIRTUAL_APPEND_CORRECTION_GUARD_SETTLE_MS = 520;
const VIRTUAL_APPEND_CORRECTION_GUARD_MIN_DELTA_PX = 1;
const VIRTUAL_APPEND_SEAM_ANCHOR_CORRECTION_GRACE_MS = 1400;
const VIRTUAL_EPISODE_BOTTOM_ANCHOR_MIN_PX = 900;
const VIRTUAL_EPISODE_BOTTOM_ANCHOR_VIEWPORT_MULTIPLIER = 2.2;
const VIRTUAL_EPISODE_BOTTOM_ANCHOR_CHUNK_RATIO = 0.12;
const VIRTUAL_EPISODE_BOTTOM_ANCHOR_MAX_PX = 4200;
const VIRTUAL_ACTIVE_RENDER_PATCH_MAX_EDGE_ROWS = 72;
const VIRTUAL_ACTIVE_RETAIN_LEADING_GRACE_MS = 900;
const VIRTUAL_ACTIVE_RETAIN_LEADING_MAX_ROWS = 420;
const VIRTUAL_NATIVE_FORWARD_SEAM_TRANSIT_GRACE_MS = 1500;
const VIRTUAL_NATIVE_FORWARD_SEAM_TRANSIT_SETTLE_MS = 360;
const VIRTUAL_NATIVE_FORWARD_SEAM_RENDER_HOLD_MAX_ROWS = 960;
const VIRTUAL_SETTLED_MEASURE_FLUSH_GRACE_MS = 1200;
const VIRTUAL_SMALL_EPISODE_BOUNDARY_MAX_CHUNKS = 2;
const VIRTUAL_SMALL_EPISODE_BOUNDARY_MAX_ROWS = MAX_RENDERED_ROWS;
const VIRTUAL_BODY_ANCHOR_INERTIA_RETAIN_PX = 520;
const VIRTUAL_BODY_ANCHOR_INERTIA_SETTLE_MS = 420;
const VIRTUAL_SCROLL_BUFFER_APPEND_INERTIA_EXTEND_MS = 1250;
const VIRTUAL_APPEND_MICRO_CORRECTION_DAMP_MS = 1600;
const VIRTUAL_APPEND_MICRO_CORRECTION_DAMP_MIN_PX = 1;
const VIRTUAL_APPEND_MICRO_CORRECTION_DAMP_MAX_VIEWPORT_RATIO = 0.28;
const VIRTUAL_APPEND_MICRO_CORRECTION_DAMP_MAX_PX = 260;

export function ensureVirtualState(app) {
  if (!app.state.readerVirtual) {
    app.state.readerVirtual = {
      rows: [],
      heights: [],
      prefix: [0],
      totalHeight: 0,
      renderedStart: -1,
      renderedEnd: -1,
      measureCache: new Map(),
      renderRaf: 0,
      measureRaf: 0,
      layoutRevision: 0,
      rowElementPool: new Map(),
      rowElementPoolClock: 0,
      rowElementPoolPass: READER_ROW_DOM_POOL_PASS,
      velocityBufferPass: READER_VELOCITY_BUFFER_PASS,
      velocityBufferStats: createVelocityBufferStats(),
      rowElementPoolStats: createRowElementPoolStats(),
      rowMeasuredMarginHeightPass: READER_ROW_MEASURED_MARGIN_HEIGHT_PASS,
      lastRowMeasuredMarginHeight: null,
      pendingScrollTarget: null,
      pendingFocusRaf: 0,
      pendingFocusTries: 0,
      pendingSliderMeasureTarget: null,
      pendingSliderMeasureTries: 0,
      sliderMeasuredCharAnchorPass: READER_SLIDER_MEASURED_CHAR_ANCHOR_PASS,
      lastSliderMeasuredCharAnchor: null,
      sliderProgrammaticScrollUntil: 0,
      sliderProgrammaticScrollTop: null,
      lastSliderProgrammaticScrollIsolation: null,
      sliderStaleMeasureTargetClearPass: READER_SLIDER_STALE_MEASURE_TARGET_CLEAR_PASS,
      lastSliderStaleMeasureTargetClear: null,
      programmaticScrollIsolationPass: READER_PROGRAMMATIC_SCROLL_ISOLATION_PASS,
      programmaticScrollUntil: 0,
      programmaticScrollTop: null,
      programmaticScrollSource: '',
      lastProgrammaticScrollIsolation: null,
      containedVisibleRowProgressPass: READER_CONTAINED_VISIBLE_ROW_PROGRESS_PASS,
      lastContainedVisibleRowProgress: null,
      extending: false,
      rowIndexById: new Map(),
      rowIndexByGlobalBlock: new Map(),
      rowIndexByChunkBlock: new Map(),
      rowIndexesByChunk: new Map(),
      bufferPass: READER_SCROLL_BUFFER_PASS,
      scrollStabilityPass: READER_VIRTUAL_SCROLL_STABILITY_PASS,
      multiFileBodyAnchorPass: READER_MULTI_FILE_BODY_ANCHOR_PASS,
      multiFileNativeExactAnchorPass: READER_MULTI_FILE_NATIVE_EXACT_ANCHOR_PASS,
      multiFileBottomAnchorNativeGuardPass: READER_MULTI_FILE_BOTTOM_ANCHOR_NATIVE_GUARD_PASS,
      multiFileNativeScrollSettleExactAnchorPass: READER_MULTI_FILE_NATIVE_SCROLL_SETTLE_EXACT_ANCHOR_PASS,
      lastMultiFileNativeScrollSettleExactAnchor: null,
      scrollSettleExactAnchorRestorePass: READER_SCROLL_SETTLE_EXACT_ANCHOR_RESTORE_PASS,
      lastScrollSettleExactAnchorRestore: null,
      sliderRatioScrollAnchorPass: READER_SLIDER_RATIO_SCROLL_ANCHOR_PASS,
      appendIncrementalIndexDeltaV466Pass: READER_APPEND_INCREMENTAL_INDEX_DELTA_V466_PASS,
      prunePrefixDeltaGuardPass: READER_PRUNE_PREFIX_DELTA_GUARD_PASS,
      lastPrunePrefixDeltaGuard: null,
      bodyAnchorInertiaRetainPass: READER_BODY_ANCHOR_INERTIA_RETAIN_PASS,
      inertiaFixtureExpansionPass: READER_INERTIA_FIXTURE_EXPANSION_PASS,
      sliderStaleMeasureTargetClearPass: READER_SLIDER_STALE_MEASURE_TARGET_CLEAR_PASS,
      programmaticScrollIsolationPass: READER_PROGRAMMATIC_SCROLL_ISOLATION_PASS,
      anchorTracePass: READER_ANCHOR_TRACE_EXPORT_PASS,
      anchorTraceLowOverheadPass: READER_ANCHOR_TRACE_LOW_OVERHEAD_PASS,
      anchorTrace: [],
      anchorTraceSequence: 0,
      anchorTraceStats: { pushed: 0, dropped: 0, maxEvents: READER_ANCHOR_TRACE_LIMIT },
      lastAnchorTraceEvent: null,
      lastScrollStability: null,
      userScrollActiveUntil: 0,
      lastUserScrollSource: '',
      measureIdleTimer: 0,
      measureDeferralCount: 0,
      renderReuseCount: 0,
      lastRenderReuse: null,
      renderWindowAnchorPass: READER_RENDER_WINDOW_ANCHOR_PASS,
      lastRenderWindowStability: null,
      activeRenderWindowPinPass: READER_ACTIVE_RENDER_WINDOW_PIN_PASS,
      lastActiveRenderWindowPin: null,
      activeRenderWindowIdleTimer: 0,
      activeRenderWindowIdleCompacting: false,
      lastRenderScrollTop: 0,
      scrollInputDiagnosticsPass: READER_SCROLL_INPUT_DIAGNOSTICS_PASS,
      scrollInputStats: createScrollInputStats(),
      scrollCoastChunkWindowPass: '',
      lastScrollCoastChunkWindow: null,
      lastScrollCoastPrune: null,
      scrollCoastPruneTimer: 0,
      prependAnchorPreservePass: READER_PREPEND_ANCHOR_PRESERVE_PASS,
      lastPrependScrollStability: null,
      prependAnchorRecheckRaf: 0,
      prependAnchorGatedPass: READER_PREPEND_ANCHOR_GATED_PASS,
      lastPrependAnchorGate: null,
      prependFileCharAnchorPass: READER_PREPEND_FILE_CHAR_ANCHOR_PASS,
      lastPrependFileCharAnchorCapture: null,
      lastPrependFileCharAnchorRestore: null,
      lastPrependAnchorRestoredAt: 0,
      prependSeamScrollTopDiagnosticPass: READER_PREPEND_SEAM_SCROLLTOP_DIAGNOSTIC_PASS,
      lastPrependSeamScrollTopDiagnostic: null,
      nativeBackwardMeasureFreezePass: READER_NATIVE_BACKWARD_MEASURE_FREEZE_PASS,
      lastNativeBackwardMeasureFreeze: null,
      appendAnchorGatedPass: READER_APPEND_ANCHOR_GATED_PASS,
      lastAppendAnchorGate: null,
      appendIncrementalLayoutPass: READER_APPEND_INCREMENTAL_LAYOUT_PASS,
      appendIncrementalIndexDeltaPass: READER_APPEND_INCREMENTAL_INDEX_DELTA_PASS,
      lastAppendIncrementalIndexDelta: null,
      lastAppendIncrementalLayout: null,
      scrollSettleCompactionPass: READER_SCROLL_SETTLE_COMPACTION_PASS,
      lastScrollSettleCompaction: null,
      activeRenderPatchPass: READER_ACTIVE_RENDER_PATCH_PASS,
      lastActiveRenderPatch: null,
      scrollSettleNativeFreezePass: READER_SCROLL_SETTLE_NATIVE_FREEZE_PASS,
      lastScrollSettleNativeFreeze: null,
      scrollAppendRenderDeferPass: READER_SCROLL_APPEND_RENDER_DEFER_PASS,
      lastScrollAppendRenderDefer: null,
      appendDeferredSpacerSyncPass: READER_APPEND_DEFERRED_SPACER_SYNC_PASS,
      lastAppendDeferredSpacerSync: null,
      appendSeamRenderPass: READER_APPEND_SEAM_RENDER_PASS,
      lastAppendSeamRender: null,
      appendUpwardCorrectionGuardPass: READER_APPEND_UPWARD_CORRECTION_GUARD_PASS,
      lastAppendUpwardCorrectionGuard: null,
      appendCorrectionGuardPass: READER_APPEND_CORRECTION_GUARD_PASS,
      lastAppendCorrectionGuard: null,
      multiEpisodeAppendAnchorPass: READER_MULTI_EPISODE_APPEND_ANCHOR_PASS,
      appendMeasureAnchorPass: READER_APPEND_MEASURE_ANCHOR_PASS,
      bottomProgressClampPass: READER_BOTTOM_PROGRESS_CLAMP_PASS,
      episodeBottomAnchorPass: READER_EPISODE_BOTTOM_ANCHOR_PASS,
      lastEpisodeBottomAnchor: null,
      episodeBottomAnchorRecheckRaf: 0,
      scrollBufferPatchAnchorPass: READER_SCROLL_BUFFER_PATCH_ANCHOR_PASS,
      lastScrollBufferPatchAnchor: null,
      lastAppendAnchorRestoredAt: 0,
      lastAppendMeasureAnchorBypass: null,
      pruneExactAnchorPass: READER_PRUNE_EXACT_ANCHOR_PASS,
      lastPruneExactAnchor: null,
      activeLeadingRetainPass: READER_ACTIVE_LEADING_RETAIN_PASS,
      lastActiveLeadingRetain: null,
      settledMeasureFlushPass: READER_SETTLED_MEASURE_FLUSH_PASS,
      lastSettledMeasureFlush: null,
      trustedBottomProgressPass: READER_TRUSTED_BOTTOM_PROGRESS_PASS,
      lastTrustedBottomProgress: null,
      smallEpisodeChunkBoundaryPass: READER_SMALL_EPISODE_CHUNK_BOUNDARY_PASS,
      appendSeamAnchorCorrectionPass: READER_APPEND_SEAM_ANCHOR_CORRECTION_PASS,
      lastAppendSeamAnchorCorrection: null,
      appendSeamNativeScrollRetainPass: READER_APPEND_SEAM_NATIVE_SCROLL_RETAIN_PASS,
      appendSeamChunkWindowSourcePass: READER_APPEND_SEAM_CHUNK_WINDOW_SOURCE_PASS,
      nativeForwardScrollRetainPass: READER_NATIVE_FORWARD_SCROLL_RETAIN_PASS,
      lastNativeForwardScrollRetain: null,
      scrollAppendChunkWindowDeferPass: READER_SCROLL_APPEND_CHUNK_WINDOW_DEFER_PASS,
      activeForwardRenderAnchorSuppressPass: READER_ACTIVE_FORWARD_RENDER_ANCHOR_SUPPRESS_PASS,
      nativeForwardSeamTransitLockPass: READER_NATIVE_FORWARD_SEAM_TRANSIT_LOCK_PASS,
      lastNativeForwardSeamTransitLock: null,
      seamTransitMeasureDeferPass: READER_SEAM_TRANSIT_MEASURE_DEFER_PASS,
      nativeForwardSeamRenderHoldPass: READER_NATIVE_FORWARD_SEAM_RENDER_HOLD_PASS,
      lastNativeForwardSeamRenderHold: null,
      lastSeamTransitMeasureDefer: null,
      lastAppendSeamNativeScrollRetain: null,
      scrollBufferAppendInertiaExtendPass: READER_SCROLL_BUFFER_APPEND_INERTIA_EXTEND_PASS,
      lastScrollBufferAppendInertiaExtend: null,
      appendMicroCorrectionDampPass: READER_APPEND_MICRO_CORRECTION_DAMP_PASS,
      lastAppendMicroCorrectionDamp: null,
      ipadScrollCoastRetainPass: READER_IPAD_SCROLL_COAST_RETAIN_PASS,
      ipadTouchNativeScrollAnchorPass: READER_IPAD_TOUCH_NATIVE_SCROLL_ANCHOR_PASS,
      lastIpadTouchNativeScrollAnchor: null,
      lastIpadScrollCoastRetain: null
    };
  }
  app.els.reader?.classList.add('reader-virtualized');
  app.els.content?.classList.add('reader-virtual-content');
  return app.state.readerVirtual;
}

function createVelocityBufferStats() {
  return {
    pass: READER_VELOCITY_BUFFER_PASS,
    lastVelocityPxMs: 0,
    lastOverscanPx: 0,
    fastFrames: 0,
    veryFastFrames: 0
  };
}

function createScrollInputStats() {
  return {
    pass: READER_SCROLL_INPUT_DIAGNOSTICS_PASS,
    total: 0,
    bySource: {},
    lastSource: '',
    lastDurationMs: 0,
    lastMarkedAt: 0,
    lastActiveUntil: 0
  };
}

function createRowElementPoolStats() {
  return {
    pass: READER_ROW_DOM_POOL_PASS,
    created: 0,
    reused: 0,
    updated: 0,
    evicted: 0,
    pruned: 0,
    lastRenderReused: 0,
    lastRenderCreated: 0,
    lastRenderUpdated: 0
  };
}

function resetRowElementPoolStats(v) {
  v.rowElementPoolStats = createRowElementPoolStats();
}

export function resetVirtualDocument(app, { clearMeasures = false } = {}) {
  const v = ensureVirtualState(app);
  v.rows = [];
  v.heights = [];
  rebuildVirtualRowIndexes(v);
  v.prefix = [0];
  v.totalHeight = 0;
  v.renderedStart = -1;
  v.renderedEnd = -1;
  v.pendingScrollTarget = null;
  v.pendingSliderMeasureTarget = null;
  v.pendingSliderMeasureTries = 0;
  v.sliderProgrammaticScrollUntil = 0;
  v.sliderProgrammaticScrollTop = null;
  v.programmaticScrollUntil = 0;
  v.programmaticScrollTop = null;
  v.programmaticScrollSource = '';
  v.extending = false;
  if (clearMeasures) v.measureCache.clear();
  if (v.rowElementPool instanceof Map) v.rowElementPool.clear();
  v.rowElementPoolClock = 0;
  v.velocityBufferPass = READER_VELOCITY_BUFFER_PASS;
  v.velocityBufferStats = createVelocityBufferStats();
  v.lastScrollBufferVelocityPxMs = 0;
  v.scrollStabilityPass = READER_VIRTUAL_SCROLL_STABILITY_PASS;
  v.multiFileBodyAnchorPass = READER_MULTI_FILE_BODY_ANCHOR_PASS;
  v.multiFileNativeExactAnchorPass = READER_MULTI_FILE_NATIVE_EXACT_ANCHOR_PASS;
  v.multiFileBottomAnchorNativeGuardPass = READER_MULTI_FILE_BOTTOM_ANCHOR_NATIVE_GUARD_PASS;
  v.multiFileNativeScrollSettleExactAnchorPass = READER_MULTI_FILE_NATIVE_SCROLL_SETTLE_EXACT_ANCHOR_PASS;
  v.scrollSettleExactAnchorRestorePass = READER_SCROLL_SETTLE_EXACT_ANCHOR_RESTORE_PASS;
  v.lastScrollSettleExactAnchorRestore = null;
  v.lastMultiFileNativeExactAnchor = null;
  v.lastMultiFileBottomAnchorNativeGuard = null;
  v.lastMultiFileNativeScrollSettleExactAnchor = null;
  v.bodyAnchorInertiaRetainPass = READER_BODY_ANCHOR_INERTIA_RETAIN_PASS;
  v.lastBodyAnchorInertiaRetain = null;
  v.anchorTracePass = READER_ANCHOR_TRACE_EXPORT_PASS;
  v.anchorTraceLowOverheadPass = READER_ANCHOR_TRACE_LOW_OVERHEAD_PASS;
  v.anchorTrace = [];
  v.anchorTraceSequence = 0;
  v.anchorTraceStats = { pushed: 0, dropped: 0, maxEvents: READER_ANCHOR_TRACE_LIMIT };
  v.lastAnchorTraceEvent = null;
  v.lastScrollStability = null;
  v.userScrollActiveUntil = 0;
  v.lastUserScrollSource = '';
  v.measureDeferralCount = 0;
  v.renderReuseCount = 0;
  v.lastRenderReuse = null;
  v.renderWindowAnchorPass = READER_RENDER_WINDOW_ANCHOR_PASS;
  v.lastRenderWindowStability = null;
  v.activeRenderWindowPinPass = READER_ACTIVE_RENDER_WINDOW_PIN_PASS;
  v.lastActiveRenderWindowPin = null;
  v.activeRenderWindowIdleCompacting = false;
  v.lastRenderScrollTop = 0;
  v.scrollInputDiagnosticsPass = READER_SCROLL_INPUT_DIAGNOSTICS_PASS;
  v.scrollInputStats = createScrollInputStats();
  v.scrollCoastChunkWindowPass = '';
  v.lastScrollCoastChunkWindow = null;
  v.lastScrollCoastPrune = null;
  v.prependAnchorPreservePass = READER_PREPEND_ANCHOR_PRESERVE_PASS;
  v.lastPrependScrollStability = null;
  v.prependAnchorGatedPass = READER_PREPEND_ANCHOR_GATED_PASS;
  v.lastPrependAnchorGate = null;
  v.prependSeamScrollTopDiagnosticPass = READER_PREPEND_SEAM_SCROLLTOP_DIAGNOSTIC_PASS;
  v.lastPrependSeamScrollTopDiagnostic = null;
  v.appendAnchorGatedPass = READER_APPEND_ANCHOR_GATED_PASS;
  v.lastAppendAnchorGate = null;
  v.appendIncrementalLayoutPass = READER_APPEND_INCREMENTAL_LAYOUT_PASS;
  v.appendIncrementalIndexDeltaPass = READER_APPEND_INCREMENTAL_INDEX_DELTA_PASS;
  v.appendIncrementalIndexDeltaV466Pass = READER_APPEND_INCREMENTAL_INDEX_DELTA_V466_PASS;
  v.lastAppendIncrementalIndexDelta = null;
  v.prunePrefixDeltaGuardPass = READER_PRUNE_PREFIX_DELTA_GUARD_PASS;
  v.lastPrunePrefixDeltaGuard = null;
  v.lastAppendIncrementalLayout = null;
  v.scrollSettleCompactionPass = READER_SCROLL_SETTLE_COMPACTION_PASS;
  v.lastScrollSettleCompaction = null;
  v.activeRenderPatchPass = READER_ACTIVE_RENDER_PATCH_PASS;
  v.lastActiveRenderPatch = null;
  v.scrollSettleNativeFreezePass = READER_SCROLL_SETTLE_NATIVE_FREEZE_PASS;
  v.lastScrollSettleNativeFreeze = null;
  v.nativeForwardScrollRetainPass = READER_NATIVE_FORWARD_SCROLL_RETAIN_PASS;
  v.lastNativeForwardScrollRetain = null;
  v.scrollAppendRenderDeferPass = READER_SCROLL_APPEND_RENDER_DEFER_PASS;
  v.scrollAppendChunkWindowDeferPass = READER_SCROLL_APPEND_CHUNK_WINDOW_DEFER_PASS;
  v.lastScrollAppendRenderDefer = null;
  v.activeForwardRenderAnchorSuppressPass = READER_ACTIVE_FORWARD_RENDER_ANCHOR_SUPPRESS_PASS;
  v.nativeForwardSeamTransitLockPass = READER_NATIVE_FORWARD_SEAM_TRANSIT_LOCK_PASS;
  v.lastNativeForwardSeamTransitLock = null;
  v.seamTransitMeasureDeferPass = READER_SEAM_TRANSIT_MEASURE_DEFER_PASS;
  v.nativeForwardSeamRenderHoldPass = READER_NATIVE_FORWARD_SEAM_RENDER_HOLD_PASS;
  v.lastNativeForwardSeamRenderHold = null;
  v.lastSeamTransitMeasureDefer = null;
  v.appendDeferredSpacerSyncPass = READER_APPEND_DEFERRED_SPACER_SYNC_PASS;
  v.lastAppendDeferredSpacerSync = null;
  v.appendSeamRenderPass = READER_APPEND_SEAM_RENDER_PASS;
  v.lastAppendSeamRender = null;
  v.smallEpisodeChunkBoundaryPass = READER_SMALL_EPISODE_CHUNK_BOUNDARY_PASS;
  v.appendSeamAnchorCorrectionPass = READER_APPEND_SEAM_ANCHOR_CORRECTION_PASS;
  v.lastAppendSeamAnchorCorrection = null;
  v.appendSeamNativeScrollRetainPass = READER_APPEND_SEAM_NATIVE_SCROLL_RETAIN_PASS;
  v.appendSeamChunkWindowSourcePass = READER_APPEND_SEAM_CHUNK_WINDOW_SOURCE_PASS;
  v.scrollBufferAppendInertiaExtendPass = READER_SCROLL_BUFFER_APPEND_INERTIA_EXTEND_PASS;
  v.lastScrollBufferAppendInertiaExtend = null;
  v.appendMicroCorrectionDampPass = READER_APPEND_MICRO_CORRECTION_DAMP_PASS;
  v.lastAppendMicroCorrectionDamp = null;
  v.ipadTouchNativeScrollAnchorPass = READER_IPAD_TOUCH_NATIVE_SCROLL_ANCHOR_PASS;
  v.lastIpadTouchNativeScrollAnchor = null;
  v.lastAppendSeamNativeScrollRetain = null;
  v.multiFileGuardCleanupPass = READER_MULTI_FILE_GUARD_CLEANUP_PASS;
  v.lastMultiFileGuardCleanup = null;
  v.appendUpwardCorrectionGuardPass = READER_APPEND_UPWARD_CORRECTION_GUARD_PASS;
  v.lastAppendUpwardCorrectionGuard = null;
  v.lastAppendCorrectionGuard = null;
  v.multiEpisodeAppendAnchorPass = READER_MULTI_EPISODE_APPEND_ANCHOR_PASS;
  v.appendMeasureAnchorPass = READER_APPEND_MEASURE_ANCHOR_PASS;
  v.scrollBufferPatchAnchorPass = READER_SCROLL_BUFFER_PATCH_ANCHOR_PASS;
  v.lastScrollBufferPatchAnchor = null;
  v.ratioScrollTargetPass = READER_RATIO_SCROLL_TARGET_PASS;
  v.lastRatioScrollTarget = null;
  v.lastAppendAnchorRestoredAt = 0;
  v.lastAppendMeasureAnchorBypass = null;
  v.pruneExactAnchorPass = READER_PRUNE_EXACT_ANCHOR_PASS;
  v.lastPruneExactAnchor = null;
  resetRowElementPoolStats(v);
  window.cancelAnimationFrame(v.renderRaf);
  window.cancelAnimationFrame(v.measureRaf);
  window.cancelAnimationFrame(v.pendingFocusRaf);
  window.cancelAnimationFrame(v.appendAnchorRecheckRaf || 0);
  window.cancelAnimationFrame(v.prependAnchorRecheckRaf || 0);
  window.cancelAnimationFrame(v.renderWindowAnchorRecheckRaf || 0);
  window.cancelAnimationFrame(v.episodeBottomAnchorRecheckRaf || 0);
  window.clearTimeout(v.measureIdleTimer || 0);
  window.clearTimeout(v.activeRenderWindowIdleTimer || 0);
  window.clearTimeout(v.scrollCoastPruneTimer || 0);
  v.renderRaf = 0;
  v.measureRaf = 0;
  v.measureIdleTimer = 0;
  v.activeRenderWindowIdleTimer = 0;
  v.scrollCoastPruneTimer = 0;
  v.pendingFocusRaf = 0;
  v.appendAnchorRecheckRaf = 0;
  v.prependAnchorRecheckRaf = 0;
  v.renderWindowAnchorRecheckRaf = 0;
  v.episodeBottomAnchorRecheckRaf = 0;
  v.pendingFocusTries = 0;
  renderVirtual(app, { force: true });
}

export function rebuildVirtualRows(app, mode = 'replace', focusedChunk = 0, options = {}) {
  const v = ensureVirtualState(app);
  const prev = options.prev || snapshotVirtualScroll(app);
  const appendAnchor = captureAppendRebuildAnchor(app, mode, options);
  const prependAnchor = capturePrependRebuildAnchor(app, mode, options);
  if (tryAppendVirtualRowsIncrementally(app, mode, focusedChunk, { appendAnchor, options })) return;
  if (tryPruneVirtualRowsIncrementally(app, mode, focusedChunk, { options })) return;
  const entries = Array.from(app.state.loadedChunks.values()).sort((a,b) => a.chunk - b.chunk);
  const rows = [];
  entries.forEach(entry => {
    rows.push(...buildRowsForLoadedEntry(entry));
  });
  v.rows = decorateRowsWithGlobalBlocks(app, rows);
  rebuildVirtualRowIndexes(v);
  pruneVirtualMeasureCache(app);
  pruneVirtualRowElementPool(app);
  recalcVirtualLayout(app);

  if (mode === 'prepend' && prev) {
    if (prependAnchor) {
      restorePrependRebuildAnchor(app, prependAnchor, 'post-layout');
    } else {
      const delta = Math.max(0, v.totalHeight - prev.totalHeight);
      if (app.els.reader) app.els.reader.scrollTop = prev.scrollTop + delta;
    }
  } else if (mode === 'replace') {
    const target = options.searchIndex != null
      ? { chunk: focusedChunk, searchIndex: Number(options.searchIndex) || 0, query: options.query || app.state.search?.highlights?.query || '', matchLength: options.matchLength || app.state.search?.highlights?.matchLength || 0, source: options.source || '' }
      : options.targetAddress
        ? { ...options.targetAddress, chunk: focusedChunk, source: options.source || '' }
        : { chunk: focusedChunk, ratio: clamp(options.restoreRatio || 0, 0, 1), source: options.source || '' };
    scrollToVirtualTarget(app, target);
  } else if (mode === 'jump') {
    scrollToVirtualTarget(app, options.targetAddress ? { ...options.targetAddress, chunk: focusedChunk, source: options.source || '' } : { chunk: focusedChunk, ratio: clamp(options.restoreRatio || 0, 0, 1), source: options.source || '' });
  } else if (appendAnchor) {
    restoreAppendRebuildAnchor(app, appendAnchor, 'post-layout');
  }
  const forceRender = mode !== 'append';
  renderVirtual(app, { force: forceRender });
  if (appendAnchor) scheduleAppendRebuildAnchorRecheck(app, appendAnchor);
  if (prependAnchor) schedulePrependRebuildAnchorRecheck(app, prependAnchor);
}


function tryAppendVirtualRowsIncrementally(app, mode, focusedChunk, context = {}) {
  const v = ensureVirtualState(app);
  const startedAt = nowForDiagnostics();
  if (mode !== 'append' || context?.options?.incrementalLayout === false) {
    recordAppendIncrementalLayout(v, { applied: false, reason: 'not append mode', mode, startedAt });
    return false;
  }
  const chunk = Math.max(1, Number(focusedChunk) || 0);
  if (!chunk || !Array.isArray(v.rows) || !v.rows.length) {
    recordAppendIncrementalLayout(v, { applied: false, reason: 'no existing virtual rows', mode, chunk, startedAt });
    return false;
  }
  if (v.rowIndexesByChunk?.has(chunk)) {
    recordAppendIncrementalLayout(v, { applied: false, reason: 'chunk already indexed', mode, chunk, startedAt });
    return false;
  }
  const entries = Array.from(app.state.loadedChunks?.values?.() || []).sort((a, b) => Number(a.chunk) - Number(b.chunk));
  const appendedEntry = entries[entries.length - 1] || null;
  if (!appendedEntry || Number(appendedEntry.chunk) !== chunk) {
    recordAppendIncrementalLayout(v, { applied: false, reason: 'target chunk is not loaded window tail', mode, chunk, startedAt });
    return false;
  }
  const loadedBefore = new Set(entries.slice(0, -1).map(entry => Number(entry.chunk)).filter(Number.isFinite));
  const renderedChunks = collectRenderedChunkSet(v.rows);
  for (const renderedChunk of renderedChunks) {
    if (!loadedBefore.has(renderedChunk)) {
      recordAppendIncrementalLayout(v, { applied: false, reason: 'rendered chunk set is out of sync', mode, chunk, renderedChunk, startedAt });
      return false;
    }
  }
  for (const loadedChunk of loadedBefore) {
    if (!renderedChunks.has(loadedChunk)) {
      recordAppendIncrementalLayout(v, { applied: false, reason: 'loaded chunk missing from rendered rows', mode, chunk, loadedChunk, startedAt });
      return false;
    }
  }
  const rowsToAppend = buildRowsForLoadedEntry(appendedEntry);
  if (!rowsToAppend.length) {
    recordAppendIncrementalLayout(v, { applied: false, reason: 'appended entry has no rows', mode, chunk, startedAt });
    return false;
  }
  const beforeRows = v.rows.length;
  const beforeHeight = Number(v.totalHeight) || 0;
  const decoratedRows = decorateRowsWithGlobalBlocks(app, rowsToAppend);
  appendVirtualRowsDelta(app, decoratedRows, { chunk, beforeRows, beforeHeight, source: String(context?.options?.source || '') });
  let renderDefer = resolveAppendRenderDeferral(v, context?.options || {});
  const appendSeamRender = renderDefer.deferred
    ? resolveAppendSeamRenderGate(app, v, {
      chunk,
      source: String(context?.options?.source || ''),
      beforeRows,
      afterRows: v.rows.length,
      beforeHeight,
      afterHeight: Number(v.totalHeight) || 0
    })
    : recordAppendSeamRender(v, {
      immediate: false,
      skipped: true,
      reason: 'append render was not deferred',
      chunk,
      source: String(context?.options?.source || ''),
      beforeRows,
      afterRows: v.rows.length
    });
  if (renderDefer.deferred && appendSeamRender?.immediate) {
    renderDefer = {
      ...renderDefer,
      deferred: false,
      reason: 'append seam near viewport renders immediately',
      seamImmediate: true,
      seamReason: appendSeamRender.reason || '',
      seamPass: appendSeamRender.pass || READER_APPEND_SEAM_RENDER_PASS
    };
    recordAppendRenderDeferral(v, renderDefer);
  }
  const seamAnchorCorrection = resolveAppendSeamAnchorCorrectionGate(v, {
    phase: 'post-layout-incremental',
    anchorType: 'append',
    appendSeamRender
  });
  if (context.appendAnchor) restoreAppendRebuildAnchor(app, context.appendAnchor, 'post-layout-incremental');
  const deferredSpacerSync = renderDefer.deferred
    ? syncDeferredAppendSpacers(app, v, {
      chunk,
      source: String(context?.options?.source || ''),
      appendAnchor: !!context.appendAnchor,
      beforeHeight,
      afterHeight: Number(v.totalHeight) || 0
    })
    : null;
  if (renderDefer.deferred) scheduleVirtualRender(app);
  else renderVirtual(app, { force: false });
  if (context.appendAnchor) scheduleAppendRebuildAnchorRecheck(app, context.appendAnchor);
  recordAppendIncrementalLayout(v, {
    applied: true,
    reason: 'incremental append layout',
    mode,
    chunk,
    beforeRows,
    afterRows: v.rows.length,
    appendedRows: rowsToAppend.length,
    beforeHeight: Math.round(beforeHeight),
    afterHeight: Math.round(Number(v.totalHeight) || 0),
    durationMs: Math.round((nowForDiagnostics() - startedAt) * 10) / 10,
    source: String(context?.options?.source || ''),
    deferredRender: renderDefer.deferred,
    appendSeamImmediateRender: !!appendSeamRender?.immediate,
    appendSeamRenderPass: appendSeamRender?.pass || '',
    appendSeamRenderReason: appendSeamRender?.reason || '',
    appendSeamAnchorCorrection: !!seamAnchorCorrection?.allowCorrection,
    appendSeamAnchorCorrectionPass: seamAnchorCorrection?.pass || '',
    appendSeamAnchorCorrectionReason: seamAnchorCorrection?.reason || '',
    appendSeamNativeScrollRetainPass: seamAnchorCorrection?.nativeScrollRetainPass || '',
    appendSeamNativeScrollRetain: !!seamAnchorCorrection?.nativeScrollRetain,
    deferredSpacerSyncChanged: !!deferredSpacerSync?.changed,
    deferredSpacerSyncPass: deferredSpacerSync?.pass || '',
    renderDeferPass: renderDefer.pass,
    renderDeferReason: renderDefer.reason,
    startedAt
  });
  return true;
}


function resolveAppendSeamRenderGate(app, v, payload = {}) {
  const reader = app?.els?.reader || null;
  const beforeRows = Math.max(0, Math.round(Number(payload.beforeRows) || 0));
  const renderedEnd = Number.isFinite(Number(v?.renderedEnd)) ? Math.round(Number(v.renderedEnd)) : -1;
  const renderedStart = Number.isFinite(Number(v?.renderedStart)) ? Math.round(Number(v.renderedStart)) : -1;
  const oldTailStart = Math.max(0, beforeRows - VIRTUAL_APPEND_SEAM_EDGE_ROWS);
  const renderedTouchesTail = renderedEnd >= oldTailStart && renderedEnd <= beforeRows;
  const scrollTop = Math.max(0, Number(reader?.scrollTop) || 0);
  const clientHeight = Math.max(0, Number(reader?.clientHeight) || 0);
  const scrollBottom = scrollTop + clientHeight;
  const beforeHeight = Math.max(0, Number(payload.beforeHeight) || 0);
  const distanceToSeam = beforeHeight > 0 ? beforeHeight - scrollBottom : Infinity;
  const threshold = Math.max(VIRTUAL_APPEND_SEAM_MIN_PX, clientHeight * VIRTUAL_APPEND_SEAM_VIEWPORT_MULTIPLIER);
  const viewportNearSeam = Number.isFinite(distanceToSeam) && distanceToSeam <= threshold;
  const totalChunks = Math.max(1, Number(app?.state?.current?.totalChunks) || 1);
  const chunk = Math.max(1, Number(payload.chunk) || 1);
  const renderedRowCount = renderedEnd > renderedStart ? renderedEnd - Math.max(0, renderedStart) : 0;
  const wideRenderedTail = renderedStart <= 0 && renderedEnd >= beforeRows && renderedRowCount >= beforeRows;
  const smallEpisodeFinalAppend = totalChunks <= VIRTUAL_SMALL_EPISODE_BOUNDARY_MAX_CHUNKS
    && chunk === totalChunks
    && beforeRows <= VIRTUAL_SMALL_EPISODE_BOUNDARY_MAX_ROWS;
  const smallEpisodeBoundaryDefer = smallEpisodeFinalAppend && wideRenderedTail && renderedTouchesTail && !viewportNearSeam;
  const overscanTailOnly = renderedTouchesTail && !viewportNearSeam;
  const nativeForwardRetain = resolveNativeForwardScrollRetain(v, { source: String(payload.source || ''), phase: 'append-seam-render' });
  const seamTransitLock = resolveNativeForwardSeamTransitLock(v, { source: String(payload.source || ''), phase: 'append-seam-render' });
  const immediate = !!reader && beforeRows > 0 && viewportNearSeam && !nativeForwardRetain.retain && !seamTransitLock.locked;
  const reason = immediate
    ? 'viewport is near append seam'
    : seamTransitLock.locked
      ? 'native forward seam transit defers seam render until inertia settles'
      : nativeForwardRetain.retain
        ? 'native forward scroll append defers seam render to retain scrollTop'
      : !reader
        ? 'reader unavailable'
        : beforeRows <= 0
          ? 'previous row count unavailable'
          : smallEpisodeBoundaryDefer
            ? 'small episode boundary defers wide-tail seam render until viewport nears seam'
            : overscanTailOnly
              ? 'rendered tail is overscan-only; defer seam render until viewport nears seam'
              : 'append seam outside rendered window and viewport';
  return recordAppendSeamRender(v, {
    ...(payload || {}),
    immediate,
    reason,
    smallEpisodeBoundaryPass: READER_SMALL_EPISODE_CHUNK_BOUNDARY_PASS,
    smallEpisodeFinalAppend,
    smallEpisodeBoundaryDefer,
    overscanTailOnly,
    wideRenderedTail,
    totalChunks,
    chunk,
    renderedStart,
    renderedEnd,
    oldTailStart,
    renderedTouchesTail,
    viewportNearSeam,
    nativeForwardRetain: !!nativeForwardRetain.retain,
    nativeForwardRetainPass: nativeForwardRetain.pass || '',
    nativeForwardRetainReason: nativeForwardRetain.reason || '',
    seamTransitLock: !!seamTransitLock.locked,
    seamTransitLockPass: seamTransitLock.pass || '',
    seamTransitLockReason: seamTransitLock.reason || '',
    scrollTop: Math.round(scrollTop),
    scrollBottom: Math.round(scrollBottom),
    beforeHeight: Math.round(beforeHeight),
    distanceToSeam: Number.isFinite(distanceToSeam) ? Math.round(distanceToSeam) : null,
    threshold: Math.round(threshold)
  });
}

function recordAppendSeamRender(v, payload = {}) {
  if (!v) return null;
  v.appendSeamRenderPass = READER_APPEND_SEAM_RENDER_PASS;
  v.lastAppendSeamRender = {
    pass: READER_APPEND_SEAM_RENDER_PASS,
    ...(payload || {}),
    at: Date.now()
  };
  return v.lastAppendSeamRender;
}

function resolveAppendSeamAnchorCorrectionGate(v, context = {}, now = Date.now()) {
  const seam = context?.appendSeamRender || v?.lastAppendSeamRender || null;
  const ageMs = seam?.at ? Math.max(0, now - Number(seam.at)) : Infinity;
  const recent = Number.isFinite(ageMs) && ageMs <= VIRTUAL_APPEND_SEAM_ANCHOR_CORRECTION_GRACE_MS;
  const immediate = seam?.immediate === true;
  const viewportNearSeam = seam?.viewportNearSeam === true;
  const smallEpisodeBoundaryDefer = seam?.smallEpisodeBoundaryDefer === true;
  const append = resolveRecentForwardScrollBufferAppend(v, now);
  const appendWindow = isAppendCorrectionGuardWindowActive(v, now);
  const pending = !!v?.pendingScrollTarget;
  const userScrollSource = isUserScrollSource(v?.lastUserScrollSource);
  const seamTransitLock = resolveNativeForwardSeamTransitLock(v, { source: append.source, direction: append.direction, phase: context?.phase || '', anchorType: context?.anchorType || '' }, now);
  const nativeScrollRetain = !!(seamTransitLock.locked || (append.recent && appendWindow && !pending && userScrollSource));
  const wouldAllowCorrection = !!(immediate && viewportNearSeam && !smallEpisodeBoundaryDefer && recent && !nativeScrollRetain && !seamTransitLock.locked);
  const allowCorrection = false;
  const result = {
    pass: READER_APPEND_SEAM_ANCHOR_CORRECTION_PASS,
    nativeScrollRetainPass: READER_APPEND_SEAM_NATIVE_SCROLL_RETAIN_PASS,
    allowCorrection,
    nativeScrollRetain,
    cleanupPass: READER_MULTI_FILE_GUARD_CLEANUP_PASS,
    wouldAllowCorrection,
    reason: wouldAllowCorrection
      ? 'append seam correction exception disabled; unified native/explicit policies own scrollTop after v522 cleanup'
      : !seam
        ? 'append seam diagnostics unavailable'
        : seamTransitLock.locked
          ? 'native forward seam transit keeps native scrollTop at append seam'
          : nativeScrollRetain
            ? 'active forward scroll-buffer append keeps native scrollTop at append seam'
          : !recent
            ? 'append seam correction grace expired'
            : !immediate
              ? 'append seam did not render immediately'
              : smallEpisodeBoundaryDefer
                ? 'small episode boundary defers seam correction'
                : !viewportNearSeam
                  ? 'viewport is not near append seam'
                  : 'append seam correction unavailable',
    phase: String(context?.phase || ''),
    anchorType: String(context?.anchorType || ''),
    ageMs: Number.isFinite(ageMs) ? Math.round(ageMs) : null,
    immediate,
    viewportNearSeam,
    smallEpisodeBoundaryDefer,
    renderedTouchesTail: seam?.renderedTouchesTail === true,
    overscanTailOnly: seam?.overscanTailOnly === true,
    source: append.source,
    direction: append.direction,
    sourceMatchesForwardBuffer: !!append.sourceMatchesForwardBuffer,
    appendSeamChunkWindowSourcePass: append.chunkWindowSourcePass || '',
    appendWindow,
    pending,
    userScrollSource,
    seamTransitLock: !!seamTransitLock.locked,
    seamTransitLockPass: seamTransitLock.pass || '',
    seamTransitLockReason: seamTransitLock.reason || '',
    distanceToSeam: Number.isFinite(Number(seam?.distanceToSeam)) ? Math.round(Number(seam.distanceToSeam)) : null,
    threshold: Number.isFinite(Number(seam?.threshold)) ? Math.round(Number(seam.threshold)) : null
  };
  if (v) {
    v.appendSeamAnchorCorrectionPass = READER_APPEND_SEAM_ANCHOR_CORRECTION_PASS;
    v.appendSeamNativeScrollRetainPass = READER_APPEND_SEAM_NATIVE_SCROLL_RETAIN_PASS;
    v.appendSeamChunkWindowSourcePass = READER_APPEND_SEAM_CHUNK_WINDOW_SOURCE_PASS;
    v.lastAppendSeamAnchorCorrection = { ...result, at: now };
    v.multiFileGuardCleanupPass = READER_MULTI_FILE_GUARD_CLEANUP_PASS;
    v.lastMultiFileGuardCleanup = { pass: READER_MULTI_FILE_GUARD_CLEANUP_PASS, phase: result.phase, anchorType: result.anchorType, removedBehavior: 'append-seam-anchor-correction-allowance', wouldAllowCorrection, allowCorrection: false, reason: result.reason, at: now };
    v.lastAppendSeamNativeScrollRetain = {
      pass: READER_APPEND_SEAM_NATIVE_SCROLL_RETAIN_PASS,
      retain: nativeScrollRetain,
      reason: result.reason,
      phase: result.phase,
      anchorType: result.anchorType,
      source: append.source,
      direction: append.direction,
      sourceMatchesForwardBuffer: !!append.sourceMatchesForwardBuffer,
      appendSeamChunkWindowSourcePass: append.chunkWindowSourcePass || '',
      appendWindow,
      pending,
      userScrollSource,
      seamTransitLock: !!seamTransitLock.locked,
      seamTransitLockPass: seamTransitLock.pass || '',
      at: now
    };
  }
  return result;
}

function estimateVirtualAnchorDelta(reader = null, rows = [], prefix = [], anchor = null) {
  if (!reader || !anchor || !Array.isArray(rows) || !rows.length || !Array.isArray(prefix) || prefix.length < 2) return null;
  const rowId = String(anchor?.rowId || '');
  let rowIndex = rowId ? rows.findIndex(row => row?.id === rowId) : -1;
  if (rowIndex < 0) rowIndex = Math.round(Number(anchor?.rowIndex) || 0);
  if (rowIndex < 0 || rowIndex >= rows.length) return null;
  const rowTop = Number(prefix[rowIndex]) || 0;
  const offsetPx = readVirtualAnchorOffsetPx(anchor);
  const anchorOffsetPx = Math.max(0, Number(anchor?.anchorOffsetPx) || VIRTUAL_SCROLL_STABILITY_ANCHOR_OFFSET_PX);
  const targetScrollTop = Math.max(0, Math.round(rowTop + offsetPx - anchorOffsetPx));
  const currentScrollTop = Math.max(0, Number(reader.scrollTop) || 0);
  const deltaPx = targetScrollTop - currentScrollTop;
  return {
    rowId,
    rowIndex,
    targetScrollTop,
    currentScrollTop: Math.round(currentScrollTop),
    deltaPx: Math.round(Number(deltaPx) || 0)
  };
}

function readVirtualAnchorOffsetPx(anchor = null) {
  const offset = Number(anchor?.offsetPx);
  if (!Number.isFinite(offset)) return 0;
  return anchor?.bodyAnchorAdjusted ? offset : Math.max(0, offset);
}

function recordBodyAnchorInertiaRetain(v, payload = {}) {
  if (!v) return null;
  v.bodyAnchorInertiaRetainPass = READER_BODY_ANCHOR_INERTIA_RETAIN_PASS;
  v.lastBodyAnchorInertiaRetain = {
    pass: READER_BODY_ANCHOR_INERTIA_RETAIN_PASS,
    ...(payload || {}),
    at: Date.now()
  };
  return v.lastBodyAnchorInertiaRetain;
}

function resolveBodyAnchorInertiaRetain(app, v, reader, anchor, context = {}) {
  if (!v || !reader || !anchor?.bodyAnchorAdjusted) return { retain: false, pass: READER_BODY_ANCHOR_INERTIA_RETAIN_PASS, reason: 'not body-adjusted anchor' };
  const now = Date.now();
  const explicit = context?.explicit === true || context?.preserveAnchor === true;
  const pending = !!v.pendingScrollTarget;
  const phase = String(context?.phase || context?.reason || 'anchor-restore');
  const anchorType = String(context?.anchorType || 'viewport');
  const delta = estimateVirtualAnchorDelta(reader, v.rows, v.prefix, anchor);
  const deltaPx = Number(delta?.deltaPx) || 0;
  const absDeltaPx = Math.abs(deltaPx);
  const lastSource = String(v.lastUserScrollSource || '');
  const direction = String(context?.direction || v.lastScrollBufferDirection || v.lastAppendAnchorGate?.direction || '');
  const source = String(context?.source || v.lastAppendAnchorGate?.source || '');
  const activeUntil = Number(v.userScrollActiveUntil) || 0;
  const active = now < activeUntil;
  const append = resolveRecentForwardScrollBufferAppend(v, now);
  const recentGateAt = Number(v.lastAppendAnchorGate?.at) || 0;
  const recentGate = recentGateAt && (now - recentGateAt) <= VIRTUAL_BODY_ANCHOR_INERTIA_SETTLE_MS;
  const nativeScrollSource = isUserScrollSource(lastSource);
  const forwardIntent = direction !== 'backward';
  const viewportLimit = Math.max(VIRTUAL_BODY_ANCHOR_INERTIA_RETAIN_PX, Math.round((Number(reader.clientHeight) || 0) * 0.7));
  const smallCorrection = absDeltaPx >= 1 && absDeltaPx <= viewportLimit;
  const activeOrCoasting = active || append.recent || recentGate;
  const touchNativeSource = lastSource === 'touch-scroll' || lastSource === 'touch-coast';
  const retain = !explicit && !pending && nativeScrollSource && forwardIntent && activeOrCoasting && smallCorrection;
  if (touchNativeSource) recordIpadTouchNativeScrollAnchor(v, { phase, anchorType, source, direction, retain, reason: retain ? 'touch native scroll suppresses anchor correction during coast' : 'touch native scroll anchor guard evaluated', deltaPx: Math.round(deltaPx), active, appendRecent: !!append.recent, recentGate: !!recentGate });
  return {
    pass: READER_BODY_ANCHOR_INERTIA_RETAIN_PASS,
    retain,
    reason: retain
      ? 'body anchor correction suppressed to retain native scroll inertia'
      : explicit
        ? 'explicit restore may adjust scrollTop'
        : pending
          ? 'pending target may adjust scrollTop'
          : !nativeScrollSource
            ? 'no native scroll inertia source'
            : !forwardIntent
              ? 'backward scroll may preserve anchor'
              : !activeOrCoasting
                ? 'native scroll not active/coasting'
                : !smallCorrection
                  ? 'correction outside inertia retain window'
                  : 'body anchor inertia retain unavailable',
    phase,
    anchorType,
    source,
    direction,
    lastUserScrollSource: lastSource,
    active,
    appendRecent: !!append.recent,
    recentGate: !!recentGate,
    deltaPx: Math.round(deltaPx),
    absDeltaPx: Math.round(absDeltaPx),
    viewportLimit: Math.round(viewportLimit),
    rowId: anchor?.rowId || '',
    rowIndex: Number.isFinite(Number(anchor?.rowIndex)) ? Number(anchor.rowIndex) : -1,
    targetScrollTop: delta?.targetScrollTop ?? null,
    currentScrollTop: delta?.currentScrollTop ?? Math.round(Number(reader.scrollTop) || 0)
  };
}

function applyVirtualScrollAnchorWithInertiaGuard(app, v, reader, anchor, context = {}) {
  const retain = resolveBodyAnchorInertiaRetain(app, v, reader, anchor, context);
  if (retain.retain) {
    recordBodyAnchorInertiaRetain(v, retain);
    return {
      applied: false,
      reason: retain.reason,
      pass: READER_BODY_ANCHOR_INERTIA_RETAIN_PASS,
      suppressedBy: READER_BODY_ANCHOR_INERTIA_RETAIN_PASS,
      rowId: retain.rowId,
      rowIndex: retain.rowIndex,
      deltaPx: retain.deltaPx,
      bodyAnchorAdjusted: true
    };
  }
  return applyVirtualScrollAnchor({ reader, rows: v.rows, prefix: v.prefix, anchor });
}


function recordIpadTouchNativeScrollAnchor(v, payload = {}) {
  if (!v) return payload;
  v.ipadTouchNativeScrollAnchorPass = READER_IPAD_TOUCH_NATIVE_SCROLL_ANCHOR_PASS;
  v.lastIpadTouchNativeScrollAnchor = {
    pass: READER_IPAD_TOUCH_NATIVE_SCROLL_ANCHOR_PASS,
    ...(payload || {}),
    at: Date.now()
  };
  return v.lastIpadTouchNativeScrollAnchor;
}

function isForwardScrollBufferAppendSource(source = '') {
  const label = String(source || '');
  return label === READER_SCROLL_BUFFER_PASS || label === READER_CHUNK_WINDOW_BUFFER_PASS;
}

function resolveRecentForwardScrollBufferAppend(v, now = Date.now()) {
  const gate = v?.lastAppendAnchorGate || null;
  const source = String(gate?.source || '');
  const direction = String(gate?.direction || '');
  const explicit = String(gate?.reason || '') === 'explicit preserveAnchor';
  const ageMs = gate?.at ? Math.max(0, now - Number(gate.at)) : Infinity;
  const sourceMatchesForwardBuffer = isForwardScrollBufferAppendSource(source);
  const recent = sourceMatchesForwardBuffer
    && direction !== 'backward'
    && !explicit
    && ageMs <= VIRTUAL_APPEND_CORRECTION_GUARD_GRACE_MS;
  return { gate, source, direction, explicit, ageMs, recent, sourceMatchesForwardBuffer, chunkWindowSourcePass: READER_APPEND_SEAM_CHUNK_WINDOW_SOURCE_PASS };
}

function recordNativeForwardScrollRetain(v, payload = {}) {
  if (!v) return payload;
  v.nativeForwardScrollRetainPass = READER_NATIVE_FORWARD_SCROLL_RETAIN_PASS;
  v.lastNativeForwardScrollRetain = {
    pass: READER_NATIVE_FORWARD_SCROLL_RETAIN_PASS,
    ...(payload || {}),
    at: Date.now()
  };
  return v.lastNativeForwardScrollRetain;
}

function resolveNativeForwardScrollRetain(v, context = {}, now = Date.now()) {
  const source = String(context?.source || v?.lastAppendAnchorGate?.source || '');
  const direction = String(context?.direction || v?.lastAppendAnchorGate?.direction || v?.lastScrollBufferDirection || '');
  const lastUserScrollSource = String(v?.lastUserScrollSource || '');
  const pending = !!v?.pendingScrollTarget;
  const activeUntil = Number(v?.userScrollActiveUntil) || 0;
  const active = now < activeUntil;
  const userScrollSource = isUserScrollSource(lastUserScrollSource);
  const append = resolveRecentForwardScrollBufferAppend(v, now);
  const appendSource = isForwardScrollBufferAppendSource(source) || append.sourceMatchesForwardBuffer;
  const appendWindow = isAppendCorrectionGuardWindowActive(v, now);
  const recentUserScroll = userScrollSource && activeUntil > 0 && now - activeUntil <= VIRTUAL_ACTIVE_RETAIN_LEADING_GRACE_MS;
  const forward = direction !== 'backward' && append.direction !== 'backward';
  const phase = String(context?.phase || '');
  const renderWindowPhase = phase.startsWith('render-window');
  const retain = !pending && userScrollSource && forward && (active || appendWindow || recentUserScroll) && (appendSource || append.recent || renderWindowPhase);
  return recordNativeForwardScrollRetain(v, {
    pass: READER_NATIVE_FORWARD_SCROLL_RETAIN_PASS,
    retain,
    reason: retain
      ? 'native forward scroll owns scrollTop during active virtual render'
      : pending
        ? 'pending target allows virtual anchor correction'
        : !userScrollSource
          ? 'last input is not native scroll'
          : !forward
            ? 'backward scroll uses prepend/anchor handling'
            : !(active || appendWindow || recentUserScroll)
              ? 'native scroll retain window expired'
              : 'source is not forward scroll-buffer append',
    phase: String(context?.phase || ''),
    anchorType: String(context?.anchorType || ''),
    source,
    direction,
    lastUserScrollSource,
    active,
    appendWindow,
    recentUserScroll,
    appendRecent: !!append.recent,
    sourceMatchesForwardBuffer: !!appendSource,
    activeUntil
  });
}


function recordNativeForwardSeamTransitLock(v, payload = {}) {
  if (!v) return payload;
  v.nativeForwardSeamTransitLockPass = READER_NATIVE_FORWARD_SEAM_TRANSIT_LOCK_PASS;
  v.lastNativeForwardSeamTransitLock = {
    pass: READER_NATIVE_FORWARD_SEAM_TRANSIT_LOCK_PASS,
    ...(payload || {}),
    at: Date.now()
  };
  return v.lastNativeForwardSeamTransitLock;
}

function resolveNativeForwardSeamTransitLock(v, context = {}, now = Date.now()) {
  const append = resolveRecentForwardScrollBufferAppend(v, now);
  const source = String(context?.source || append.source || v?.lastAppendAnchorGate?.source || '');
  const direction = String(context?.direction || append.direction || v?.lastScrollBufferDirection || '');
  const pending = !!v?.pendingScrollTarget;
  const userScrollSource = isUserScrollSource(v?.lastUserScrollSource);
  const activeUntil = Number(v?.userScrollActiveUntil) || 0;
  const active = now < activeUntil;
  const appendAt = Number(append?.gate?.at) || 0;
  const settleUntil = activeUntil > 0 ? activeUntil + VIRTUAL_NATIVE_FORWARD_SEAM_TRANSIT_SETTLE_MS : 0;
  const appendUntil = appendAt > 0 ? appendAt + VIRTUAL_NATIVE_FORWARD_SEAM_TRANSIT_GRACE_MS : 0;
  const lockUntil = Math.max(settleUntil, appendUntil);
  const forward = direction !== 'backward' && append.direction !== 'backward';
  const sourceMatchesForwardBuffer = isForwardScrollBufferAppendSource(source) || append.sourceMatchesForwardBuffer;
  const activeOrSettling = active || (activeUntil > 0 && now <= settleUntil);
  const appendWindow = appendAt > 0 && now <= appendUntil;
  const locked = !pending && userScrollSource && forward && sourceMatchesForwardBuffer && append.recent && (activeOrSettling || appendWindow) && now <= lockUntil;
  return recordNativeForwardSeamTransitLock(v, {
    locked,
    reason: locked
      ? 'native forward seam transit owns scrollTop until inertia settles'
      : pending
        ? 'pending target allows seam correction'
        : !userScrollSource
          ? 'last input is not native scroll'
          : !forward
            ? 'backward scroll leaves seam transit lock'
            : !sourceMatchesForwardBuffer
              ? 'source is not forward scroll-buffer append'
              : !append.recent
                ? 'no recent forward seam append'
                : !(activeOrSettling || appendWindow)
                  ? 'native seam transit window expired'
                  : 'native seam transit lock unavailable',
    phase: String(context?.phase || ''),
    anchorType: String(context?.anchorType || ''),
    source,
    appendSource: append.source,
    direction,
    lastUserScrollSource: String(v?.lastUserScrollSource || ''),
    active,
    activeUntil,
    settleUntil,
    appendAt,
    appendUntil,
    lockUntil,
    remainingMs: locked ? Math.max(0, Math.round(lockUntil - now)) : 0,
    appendRecent: !!append.recent,
    sourceMatchesForwardBuffer: !!sourceMatchesForwardBuffer
  });
}


function resolveAnchorRowSnapshot(v = null, anchor = null) {
  const rows = Array.isArray(v?.rows) ? v.rows : [];
  let rowIndex = -1;
  const rowId = String(anchor?.rowId || '');
  if (rowId) rowIndex = rows.findIndex(row => row?.id === rowId);
  if (rowIndex < 0 && Number.isFinite(Number(anchor?.rowIndex))) rowIndex = Math.round(Number(anchor.rowIndex));
  const row = rowIndex >= 0 && rowIndex < rows.length ? rows[rowIndex] : null;
  const capturedRowIndex = Number.isFinite(Number(anchor?.capturedRowIndex)) ? Math.round(Number(anchor.capturedRowIndex)) : -1;
  const capturedRow = capturedRowIndex >= 0 && capturedRowIndex < rows.length ? rows[capturedRowIndex] : null;
  return {
    row,
    rowIndex: row ? rowIndex : -1,
    rowType: row ? String(row.type || '') : '',
    capturedRow,
    capturedRowIndex: capturedRow ? capturedRowIndex : -1,
    capturedRowType: capturedRow ? String(capturedRow.type || '') : ''
  };
}

function resolveUnifiedAppendRestorePolicy(app, v, reader, anchor = null, context = {}, now = Date.now()) {
  const phase = String(context?.phase || 'append-anchor');
  const explicit = context?.explicit === true || String(anchor?.appendAnchorGateReason || '') === 'explicit preserveAnchor';
  const multiFile = isMultiFileReader(app);
  const pending = !!v?.pendingScrollTarget;
  const source = String(context?.source || anchor?.sourceAtCapture || v?.lastAppendAnchorGate?.source || v?.lastScrollBufferAppendInertiaExtend?.source || '');
  const direction = String(context?.direction || anchor?.directionAtCapture || v?.lastAppendAnchorGate?.direction || v?.lastScrollBufferAppendInertiaExtend?.direction || v?.lastScrollBufferDirection || '');
  const lastUserScrollSource = String(context?.lastUserScrollSource || anchor?.lastUserScrollSourceAtCapture || v?.lastScrollBufferAppendInertiaExtend?.lastUserScrollSource || v?.lastUserScrollSource || '');
  const userScrollSource = isUserScrollSource(lastUserScrollSource);
  const active = isVirtualScrollActive(v, now);
  const append = resolveRecentForwardScrollBufferAppend(v, now);
  const appendWindow = isAppendCorrectionGuardWindowActive(v, now);
  const nativeForwardRetain = resolveNativeForwardScrollRetain(v, { source, direction, phase, anchorType: context?.anchorType || 'append' }, now);
  const seamTransitLock = resolveNativeForwardSeamTransitLock(v, { source, direction, phase, anchorType: context?.anchorType || 'append' }, now);
  const rowSnapshot = resolveAnchorRowSnapshot(v, anchor);
  const suppress = !!(reader && multiFile && !explicit && !pending && userScrollSource && direction !== 'backward' && (nativeForwardRetain.retain || seamTransitLock.locked || (append.recent && (active || appendWindow))));
  const result = {
    pass: READER_UNIFIED_APPEND_RESTORE_POLICY_PASS,
    suppress,
    reason: suppress
      ? 'multi-file native forward append keeps scrollTop until active chunk attach settles'
      : explicit
        ? 'explicit append anchor restore may adjust scrollTop'
        : pending
          ? 'pending target owns append restore'
          : !multiFile
            ? 'single-file append keeps legacy restore policy'
            : !userScrollSource
              ? 'last input is not native scroll'
              : direction === 'backward'
                ? 'backward scroll uses prepend policy'
                : 'append restore policy allows anchor correction',
    phase,
    source,
    direction,
    lastUserScrollSource,
    anchorType: String(context?.anchorType || 'append'),
    multiFile,
    explicit,
    pending,
    active,
    appendRecent: !!append.recent,
    appendWindow,
    nativeForwardRetain: !!nativeForwardRetain.retain,
    nativeForwardRetainPass: nativeForwardRetain.pass || '',
    seamTransitLock: !!seamTransitLock.locked,
    seamTransitLockPass: seamTransitLock.pass || '',
    rowType: rowSnapshot.rowType || '',
    capturedRowType: rowSnapshot.capturedRowType || '',
    rowId: anchor?.rowId || '',
    rowIndex: Number.isFinite(Number(anchor?.rowIndex)) ? Number(anchor.rowIndex) : -1
  };
  if (v) {
    v.unifiedAppendRestorePolicyPass = READER_UNIFIED_APPEND_RESTORE_POLICY_PASS;
    v.lastUnifiedAppendRestorePolicy = { ...result, at: now };
  }
  return result;
}

function recordNativeForwardSeamRenderHold(v, payload = {}) {
  if (!v) return payload;
  v.nativeForwardSeamRenderHoldPass = READER_NATIVE_FORWARD_SEAM_RENDER_HOLD_PASS;
  v.lastNativeForwardSeamRenderHold = {
    pass: READER_NATIVE_FORWARD_SEAM_RENDER_HOLD_PASS,
    ...(payload || {}),
    at: Date.now()
  };
  return v.lastNativeForwardSeamRenderHold;
}

function resolveNativeForwardSeamRenderHold(v, context = {}, now = Date.now()) {
  const lock = resolveNativeForwardSeamTransitLock(v, { ...(context || {}), phase: context?.phase || 'render-range-hold', anchorType: context?.anchorType || 'render-window' }, now);
  const previousStart = Number.isFinite(Number(context?.previousStart)) ? Math.round(Number(context.previousStart)) : -1;
  const requestedStart = Number.isFinite(Number(context?.requestedStart)) ? Math.round(Number(context.requestedStart)) : -1;
  const previousEnd = Number.isFinite(Number(context?.previousEnd)) ? Math.round(Number(context.previousEnd)) : -1;
  const requestedEnd = Number.isFinite(Number(context?.requestedEnd)) ? Math.round(Number(context.requestedEnd)) : -1;
  const rowCount = Math.max(0, Math.round(Number(context?.rowCount) || 0));
  const canHoldStart = lock.locked && previousStart >= 0 && previousEnd > previousStart && requestedStart > previousStart;
  let start = requestedStart;
  let end = requestedEnd;
  let retainedRows = 0;
  let truncated = false;
  if (canHoldStart) {
    start = previousStart;
    end = Math.max(requestedEnd, previousEnd);
    const maxRows = Math.max(VIRTUAL_ACTIVE_RETAIN_LEADING_MAX_ROWS, VIRTUAL_NATIVE_FORWARD_SEAM_RENDER_HOLD_MAX_ROWS);
    if (end - start > maxRows) {
      truncated = true;
      end = Math.min(rowCount, Math.max(requestedEnd, start + maxRows));
    }
    retainedRows = Math.max(0, requestedStart - start);
  }
  return recordNativeForwardSeamRenderHold(v, {
    hold: !!canHoldStart,
    locked: !!lock.locked,
    reason: canHoldStart
      ? 'native forward seam transit keeps rendered leading rows and top spacer stable'
      : lock.locked
        ? 'native forward seam transit active but render start did not advance'
        : lock.reason || 'native forward seam render hold unavailable',
    phase: String(context?.phase || ''),
    anchorType: String(context?.anchorType || ''),
    previousStart,
    previousEnd,
    requestedStart,
    requestedEnd,
    start,
    end,
    retainedRows,
    truncated,
    rowCount,
    maxRows: VIRTUAL_NATIVE_FORWARD_SEAM_RENDER_HOLD_MAX_ROWS,
    seamTransitLockPass: lock.pass || '',
    remainingMs: Math.round(Number(lock.remainingMs) || 0)
  });
}

function isAppendCorrectionGuardWindowActive(v, now = Date.now()) {
  const activeUntil = Number(v?.userScrollActiveUntil) || 0;
  const append = resolveRecentForwardScrollBufferAppend(v, now);
  const appendAt = Number(append?.gate?.at) || 0;
  const settleUntil = Math.max(activeUntil + VIRTUAL_APPEND_CORRECTION_GUARD_SETTLE_MS, appendAt + VIRTUAL_APPEND_CORRECTION_GUARD_GRACE_MS);
  return append.recent && now <= settleUntil;
}

export function resolveAppendCorrectionGuard(app, anchor = null, context = {}) {
  const reader = app?.els?.reader || null;
  const v = ensureVirtualState(app);
  const now = Date.now();
  const append = resolveRecentForwardScrollBufferAppend(v, now);
  const activeWindow = isAppendCorrectionGuardWindowActive(v, now);
  const pending = !!v?.pendingScrollTarget;
  const nativeScrollSource = isUserScrollSource(v?.lastUserScrollSource);
  const delta = context?.delta || estimateVirtualAnchorDelta(reader, v?.rows || [], v?.prefix || [], anchor);
  const deltaPx = Number(delta?.deltaPx) || 0;
  const magnitude = Math.abs(deltaPx);
  const seamAnchorCorrection = resolveAppendSeamAnchorCorrectionGate(v, {
    phase: context?.phase || '',
    anchorType: context?.anchorType || '',
    appendSeamRender: context?.appendSeamRender || null
  }, now);
  const seamAllowsCorrection = seamAnchorCorrection?.allowCorrection === true;
  const suppress = !!reader
    && !pending
    && nativeScrollSource
    && append.recent
    && activeWindow
    && !seamAllowsCorrection
    && magnitude > VIRTUAL_APPEND_CORRECTION_GUARD_MIN_DELTA_PX;
  return recordAppendCorrectionGuard(v, {
    pass: READER_APPEND_CORRECTION_GUARD_PASS,
    suppress,
    reason: suppress
      ? 'recent forward scroll-buffer append keeps native scrollTop during correction grace'
      : seamAllowsCorrection
        ? 'append seam correction exception disabled during append grace'
        : pending
          ? 'pending target allows correction'
          : !nativeScrollSource
            ? 'last input is not native scroll'
            : !append.recent
              ? 'no recent forward scroll-buffer append'
            : !activeWindow
              ? 'append correction grace expired'
              : 'correction delta below threshold',
    phase: String(context?.phase || ''),
    anchorType: String(context?.anchorType || ''),
    source: append.source,
    direction: append.direction,
    explicit: append.explicit,
    nativeScrollSource,
    sourceMatchesForwardBuffer: !!append.sourceMatchesForwardBuffer,
    appendSeamChunkWindowSourcePass: append.chunkWindowSourcePass || '',
    ageMs: Number.isFinite(append.ageMs) ? Math.round(append.ageMs) : null,
    activeUntil: Number(v?.userScrollActiveUntil) || 0,
    fallbackDeltaPx: Math.round(Number(context?.fallbackDeltaPx) || 0),
    appendSeamAnchorCorrectionPass: seamAnchorCorrection?.pass || '',
    appendSeamAnchorCorrection: seamAllowsCorrection,
    appendSeamAnchorCorrectionReason: seamAnchorCorrection?.reason || '',
    ...(delta || {})
  });
}

function recordAppendCorrectionGuard(v, payload = {}) {
  if (!v) return payload;
  v.appendCorrectionGuardPass = READER_APPEND_CORRECTION_GUARD_PASS;
  v.lastAppendCorrectionGuard = {
    pass: READER_APPEND_CORRECTION_GUARD_PASS,
    ...(payload || {}),
    at: Date.now()
  };
  return v.lastAppendCorrectionGuard;
}

export function resolveAppendPruneDeferral(app, options = {}) {
  const v = ensureVirtualState(app);
  const now = Date.now();
  const append = resolveRecentForwardScrollBufferAppend(v, now);
  const pending = !!v?.pendingScrollTarget;
  const activeUntil = Number(v?.userScrollActiveUntil) || 0;
  const appendAt = Number(append?.gate?.at) || 0;
  const targetAt = Math.max(activeUntil + VIRTUAL_APPEND_CORRECTION_GUARD_SETTLE_MS, appendAt + VIRTUAL_APPEND_CORRECTION_GUARD_GRACE_MS);
  const remainingMs = Math.max(0, targetAt - now);
  const defer = !options.force && !pending && append.recent && remainingMs > 0;
  const delayMs = defer ? Math.max(120, Math.min(900, Math.round(remainingMs))) : 0;
  return recordAppendCorrectionGuard(v, {
    pass: READER_APPEND_CORRECTION_GUARD_PASS,
    suppress: defer,
    defer,
    reason: defer
      ? 'recent forward scroll-buffer append defers chunk-window prune'
      : pending
        ? 'pending target allows prune'
        : !append.recent
          ? 'no recent forward scroll-buffer append'
          : 'append prune grace expired',
    phase: String(options?.phase || 'chunk-window-prune'),
    anchorType: 'prune',
    source: append.source,
    direction: append.direction,
    explicit: append.explicit,
    sourceMatchesForwardBuffer: !!append.sourceMatchesForwardBuffer,
    appendSeamChunkWindowSourcePass: append.chunkWindowSourcePass || '',
    ageMs: Number.isFinite(append.ageMs) ? Math.round(append.ageMs) : null,
    delayMs,
    activeUntil,
    loadedChunks: Math.round(Number(options?.loadedChunks) || 0),
    maxLoadedChunks: Math.round(Number(options?.maxLoadedChunks) || 0),
    removedBeforeHeight: Math.round(Number(options?.removedBeforeHeight) || 0)
  });
}

function resolveNativeScrollTransitionState(v, now = Date.now()) {
  const activeUntil = Number(v?.userScrollActiveUntil) || 0;
  const active = now < activeUntil;
  const userScrollSource = isUserScrollSource(v?.lastUserScrollSource);
  const settledForMs = activeUntil > 0 ? Math.max(0, now - activeUntil) : Infinity;
  const appendWindow = isAppendCorrectionGuardWindowActive(v, now);
  const recentUserScroll = userScrollSource && activeUntil > 0 && settledForMs <= VIRTUAL_ACTIVE_RETAIN_LEADING_GRACE_MS;
  const direction = String(v?.lastScrollBufferDirection || '');
  return {
    active,
    userScrollSource,
    activeUntil,
    settledForMs: Number.isFinite(settledForMs) ? Math.round(settledForMs) : null,
    appendWindow,
    recentUserScroll,
    direction,
    forward: direction !== 'backward'
  };
}

function resolveActiveLeadingRetain(v, range = {}) {
  const now = Date.now();
  const state = resolveNativeScrollTransitionState(v, now);
  const previousStart = Math.round(Number(range.previousStart));
  const previousEnd = Math.round(Number(range.previousEnd));
  const requestedStart = Math.round(Number(range.start));
  const requestedEnd = Math.round(Number(range.end));
  const rowCount = Math.max(0, Math.round(Number(range.rowCount) || 0));
  const canRetain = previousStart >= 0
    && previousEnd > previousStart
    && requestedStart > previousStart
    && rowCount > 0
    && !v?.pendingScrollTarget
    && state.userScrollSource
    && state.forward
    && (state.active || state.appendWindow || state.recentUserScroll);
  let start = requestedStart;
  let end = requestedEnd;
  let retainedRows = 0;
  let truncated = false;
  if (canRetain) {
    start = previousStart;
    end = Math.max(requestedEnd, previousEnd);
    const maxRows = Math.max(VIRTUAL_ACTIVE_RENDER_WINDOW_MAX_ROWS, VIRTUAL_ACTIVE_RETAIN_LEADING_MAX_ROWS);
    if (end - start > maxRows) {
      truncated = true;
      end = Math.min(rowCount, start + maxRows);
      if (end < requestedEnd) {
        end = Math.min(rowCount, requestedEnd);
        start = Math.max(0, end - maxRows);
      }
    }
    retainedRows = Math.max(0, requestedStart - start);
  }
  const result = {
    pass: READER_ACTIVE_LEADING_RETAIN_PASS,
    retain: !!canRetain && start < requestedStart,
    reason: canRetain ? 'native forward scroll retains leading rows until settle' : 'no leading retain needed',
    previousStart,
    previousEnd,
    requestedStart,
    requestedEnd,
    start,
    end,
    retainedRows,
    truncated,
    active: state.active,
    appendWindow: state.appendWindow,
    recentUserScroll: state.recentUserScroll,
    direction: state.direction,
    settledForMs: state.settledForMs
  };
  recordActiveLeadingRetain(v, result);
  return result;
}

function recordActiveLeadingRetain(v, payload = {}) {
  if (!v) return payload;
  v.activeLeadingRetainPass = READER_ACTIVE_LEADING_RETAIN_PASS;
  v.lastActiveLeadingRetain = {
    pass: READER_ACTIVE_LEADING_RETAIN_PASS,
    ...(payload || {}),
    at: Date.now()
  };
  return v.lastActiveLeadingRetain;
}

function resolveAppendUpwardCorrectionGuard(app, v, reader, anchor, context = {}) {
  const gate = v?.lastAppendAnchorGate || null;
  const source = String(gate?.source || '');
  const direction = String(gate?.direction || '');
  const explicit = String(gate?.reason || '') === 'explicit preserveAnchor';
  const ageMs = gate?.at ? Math.max(0, Date.now() - Number(gate.at)) : Infinity;
  const recentForwardBufferAppend = isForwardScrollBufferAppendSource(source)
    && direction !== 'backward'
    && !explicit
    && ageMs <= VIRTUAL_APPEND_MEASURE_ANCHOR_GRACE_MS;
  const delta = estimateVirtualAnchorDelta(reader, v?.rows || [], v?.prefix || [], anchor);
  const upward = !!delta && Number(delta.deltaPx) < -1;
  const active = isVirtualScrollActive(v);
  const activeWindow = isAppendCorrectionGuardWindowActive(v);
  const activeUntil = Number(v?.userScrollActiveUntil) || 0;
  const settledForMs = activeUntil > 0 ? Math.max(0, Date.now() - activeUntil) : Infinity;
  const recentNativeSettle = activeUntil > 0 && settledForMs <= VIRTUAL_ACTIVE_RETAIN_LEADING_GRACE_MS;
  const nativeScrollSource = isUserScrollSource(v?.lastUserScrollSource);
  const nativeForwardRetain = !!(nativeScrollSource && (active || activeWindow || recentNativeSettle));
  const seamAnchorCorrection = resolveAppendSeamAnchorCorrectionGate(v, {
    phase: context?.phase || '',
    anchorType: context?.anchorType || ''
  });
  const seamAllowsCorrection = seamAnchorCorrection?.allowCorrection === true;
  const suppress = !!reader && !v?.pendingScrollTarget && recentForwardBufferAppend && upward && nativeForwardRetain;
  const result = recordAppendUpwardCorrectionGuard(v, {
    pass: READER_APPEND_UPWARD_CORRECTION_GUARD_PASS,
    suppress,
    reason: suppress
      ? 'recent forward scroll-buffer append suppresses upward anchor correction after chunk attach'
      : seamAllowsCorrection
        ? 'append seam correction exception disabled for upward correction'
        : !recentForwardBufferAppend
          ? 'no recent forward scroll-buffer append'
          : !upward
            ? 'anchor correction is not upward'
            : !nativeForwardRetain
              ? 'no native forward scroll retain window for upward correction'
              : 'reader unavailable or pending target',
    phase: String(context?.phase || ''),
    anchorType: String(context?.anchorType || ''),
    source,
    direction,
    explicit,
    ageMs: Number.isFinite(ageMs) ? Math.round(ageMs) : null,
    active,
    activeWindow,
    nativeScrollSource,
    recentNativeSettle,
    nativeForwardRetain,
    appendNativeUpwardRetainPass: READER_APPEND_NATIVE_UPWARD_RETAIN_PASS,
    appendSeamAnchorCorrectionPass: seamAnchorCorrection?.pass || '',
    appendSeamAnchorCorrection: seamAllowsCorrection,
    appendSeamAnchorCorrectionReason: seamAnchorCorrection?.reason || '',
    ...(delta || {})
  });
  if (v) {
    v.appendNativeUpwardRetainPass = READER_APPEND_NATIVE_UPWARD_RETAIN_PASS;
    v.lastAppendNativeUpwardRetain = {
      pass: READER_APPEND_NATIVE_UPWARD_RETAIN_PASS,
      suppress: !!result.suppress,
      reason: result.reason,
      phase: result.phase,
      anchorType: result.anchorType,
      deltaPx: Math.round(Number(result.deltaPx) || 0),
      source,
      direction,
      nativeForwardRetain,
      appendSeamAnchorCorrection: seamAllowsCorrection,
      at: Date.now()
    };
  }
  return result;
}

function recordAppendUpwardCorrectionGuard(v, payload = {}) {
  if (!v) return payload;
  v.appendUpwardCorrectionGuardPass = READER_APPEND_UPWARD_CORRECTION_GUARD_PASS;
  v.lastAppendUpwardCorrectionGuard = {
    pass: READER_APPEND_UPWARD_CORRECTION_GUARD_PASS,
    ...(payload || {}),
    at: Date.now()
  };
  return v.lastAppendUpwardCorrectionGuard;
}

function resolveAppendRenderDeferral(v, options = {}) {
  const source = String(options?.source || '');
  const active = isVirtualScrollActive(v);
  const pending = !!v?.pendingScrollTarget;
  const userScrollSource = isUserScrollSource(v?.lastUserScrollSource);
  const scrollBufferAppend = isForwardScrollBufferAppendSource(source);
  const deferred = scrollBufferAppend && active && userScrollSource && !pending;
  const reason = deferred
    ? (source === READER_CHUNK_WINDOW_BUFFER_PASS ? 'active chunk-window scroll buffer append render scheduled' : 'active scroll buffer append render scheduled')
    : pending
      ? 'pending scroll target renders immediately'
      : active && userScrollSource
        ? 'non-buffer active append renders immediately'
        : 'idle append renders immediately';
  const result = {
    pass: READER_SCROLL_APPEND_RENDER_DEFER_PASS,
    deferred,
    reason,
    source,
    scrollBufferAppend,
    chunkWindowDeferPass: source === READER_CHUNK_WINDOW_BUFFER_PASS ? READER_SCROLL_APPEND_CHUNK_WINDOW_DEFER_PASS : '',
    active,
    userScrollSource,
    pending,
    activeUntil: Number(v?.userScrollActiveUntil) || 0
  };
  recordAppendRenderDeferral(v, result);
  return result;
}

function recordAppendRenderDeferral(v, payload = {}) {
  if (!v) return;
  v.scrollAppendRenderDeferPass = READER_SCROLL_APPEND_RENDER_DEFER_PASS;
  v.scrollAppendChunkWindowDeferPass = READER_SCROLL_APPEND_CHUNK_WINDOW_DEFER_PASS;
  v.lastScrollAppendRenderDefer = {
    pass: READER_SCROLL_APPEND_RENDER_DEFER_PASS,
    ...payload,
    at: Date.now()
  };
}

function syncDeferredAppendSpacers(app, v, payload = {}) {
  const content = app?.els?.content || null;
  const renderedStart = Number.isFinite(Number(v?.renderedStart)) ? Number(v.renderedStart) : -1;
  const renderedEnd = Number.isFinite(Number(v?.renderedEnd)) ? Number(v.renderedEnd) : -1;
  let result = { changed: false, topChanged: false, bottomChanged: false, reason: '' };
  if (!content || renderedStart < 0 || renderedEnd <= renderedStart) {
    result.reason = 'rendered window unavailable';
  } else {
    const seamTransitLock = resolveNativeForwardSeamTransitLock(v, { source: String(payload?.source || ''), phase: 'deferred-spacer-sync' });
    if (seamTransitLock.locked) {
      const bottom = content.querySelector?.('.reader-virtual-bottom') || null;
      const desiredBottom = Math.max(0, Math.round(Number(v.totalHeight) - (Number(v.prefix[renderedEnd]) || 0)));
      const currentBottom = Math.max(0, Math.round(parseFloat(String(bottom?.style?.height || '0')) || 0));
      const nextBottom = `${Math.max(currentBottom, desiredBottom)}px`;
      const bottomChanged = !!bottom && bottom.style.height !== nextBottom;
      if (bottomChanged) bottom.style.height = nextBottom;
      result = {
        changed: bottomChanged,
        topChanged: false,
        bottomChanged,
        reason: 'native seam transit syncs bottom spacer monotonically',
        seamTransitLock: true,
        seamTransitLockPass: seamTransitLock.pass || '',
        desiredBottom,
        currentBottom
      };
    } else {
      result = { ...syncRenderedVirtualSpacers(app, v, content), reason: 'deferred append spacer sync' };
    }
  }
  return recordAppendDeferredSpacerSync(v, {
    ...(payload || {}),
    ...result,
    renderedStart,
    renderedEnd,
    totalHeight: Math.round(Number(v?.totalHeight) || 0)
  });
}

function recordAppendDeferredSpacerSync(v, payload = {}) {
  if (!v) return null;
  v.appendDeferredSpacerSyncPass = READER_APPEND_DEFERRED_SPACER_SYNC_PASS;
  v.lastAppendDeferredSpacerSync = {
    pass: READER_APPEND_DEFERRED_SPACER_SYNC_PASS,
    ...(payload || {}),
    at: Date.now()
  };
  return v.lastAppendDeferredSpacerSync;
}

function buildRowsForLoadedEntry(entry) {
  if (!entry) return [];
  const chunk = Number(entry.chunk) || 0;
  const rows = [{
    id: `${chunk}:h`,
    type: 'header',
    chunk,
    blockIndex: -1,
    start: 0,
    end: 0,
    title: getVirtualChunkHeading(entry),
    totalChunks: entry.totalChunks
  }];
  (entry.blocks || splitContentBlocks(entry.content)).forEach(block => {
    rows.push({
      id: `${chunk}:b:${block.index}`,
      type: 'body',
      chunk,
      blockIndex: block.index,
      start: block.start,
      end: block.end,
      text: block.text,
      totalChunks: entry.totalChunks
    });
  });
  return rows;
}

function collectRenderedChunkSet(rows) {
  const set = new Set();
  (rows || []).forEach(row => {
    const chunk = Number(row?.chunk);
    if (Number.isFinite(chunk) && chunk > 0) set.add(chunk);
  });
  return set;
}

function recordAppendIncrementalLayout(v, payload = {}) {
  if (!v) return;
  v.appendIncrementalLayoutPass = READER_APPEND_INCREMENTAL_LAYOUT_PASS;
  v.lastAppendIncrementalLayout = {
    pass: READER_APPEND_INCREMENTAL_LAYOUT_PASS,
    ...payload,
    at: Date.now()
  };
}

function recordAppendIncrementalIndexDelta(v, payload = {}) {
  if (!v) return null;
  v.appendIncrementalIndexDeltaPass = READER_APPEND_INCREMENTAL_INDEX_DELTA_PASS;
  v.appendIncrementalIndexDeltaV466Pass = READER_APPEND_INCREMENTAL_INDEX_DELTA_V466_PASS;
  v.lastAppendIncrementalIndexDelta = { pass: READER_APPEND_INCREMENTAL_INDEX_DELTA_PASS, v466Pass: READER_APPEND_INCREMENTAL_INDEX_DELTA_V466_PASS, ...payload, at: Date.now() };
  return v.lastAppendIncrementalIndexDelta;
}

function appendVirtualRowsDelta(app, rowsToAppend = [], context = {}) {
  const v = ensureVirtualState(app);
  const rows = Array.isArray(rowsToAppend) ? rowsToAppend : [];
  const startIndex = Array.isArray(v.rows) ? v.rows.length : 0;
  if (!rows.length) return recordAppendIncrementalIndexDelta(v, { applied:false, reason:'no rows to append', ...context });
  if (!Array.isArray(v.rows)) v.rows = [];
  if (!Array.isArray(v.heights)) v.heights = [];
  if (!Array.isArray(v.prefix) || !v.prefix.length) v.prefix = [0];
  if (!(v.rowIndexById instanceof Map)) v.rowIndexById = new Map();
  if (!(v.rowIndexByGlobalBlock instanceof Map)) v.rowIndexByGlobalBlock = new Map();
  if (!(v.rowIndexByChunkBlock instanceof Map)) v.rowIndexByChunkBlock = new Map();
  if (!(v.rowIndexesByChunk instanceof Map)) v.rowIndexesByChunk = new Map();
  let total = Number(v.totalHeight);
  if (!Number.isFinite(total)) total = Number(v.prefix[v.prefix.length - 1]) || 0;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const index = startIndex + i;
    v.rows.push(row);
    if (row?.id) v.rowIndexById.set(row.id, index);
    const chunk = Number(row?.chunk);
    if (Number.isFinite(chunk)) {
      if (!v.rowIndexesByChunk.has(chunk)) v.rowIndexesByChunk.set(chunk, []);
      v.rowIndexesByChunk.get(chunk).push(index);
    }
    if (row?.type === 'body') {
      const globalBlock = Number(row.globalBlockIndex);
      if (Number.isFinite(globalBlock) && globalBlock >= 0) v.rowIndexByGlobalBlock.set(globalBlock, index);
      const block = Number(row.blockIndex);
      if (Number.isFinite(chunk) && Number.isFinite(block) && block >= 0) v.rowIndexByChunkBlock.set(`${chunk}:${block}`, index);
    }
    const h = getRowHeight(app, row);
    v.heights[index] = h;
    total += h;
    v.prefix[index + 1] = total;
  }
  v.totalHeight = total;
  return recordAppendIncrementalIndexDelta(v, { applied:true, reason:'append rows indexed by delta without full reindex or full prefix recompute', v466Pass: READER_APPEND_INCREMENTAL_INDEX_DELTA_V466_PASS, appendIncrementalIndexDeltaV466Pass: READER_APPEND_INCREMENTAL_INDEX_DELTA_V466_PASS, startIndex, appendedRows:rows.length, beforeHeight:Math.round(Number(context.beforeHeight)||0), afterHeight:Math.round(total), ...context });
}


function tryPruneVirtualRowsIncrementally(app, mode, focusedChunk, context = {}) {
  const v = ensureVirtualState(app);
  const startedAt = nowForDiagnostics();
  const prunedChunks = Array.isArray(context?.options?.prunedChunks)
    ? context.options.prunedChunks.map(Number).filter(Number.isFinite)
    : [];
  const removedSet = new Set(prunedChunks);
  if (mode !== 'prune' || !removedSet.size || context?.options?.incrementalPrune === false) {
    recordPrunePrefixDeltaGuard(v, { applied: false, reason: mode !== 'prune' ? 'not prune mode' : !removedSet.size ? 'no pruned chunks supplied' : 'incremental prune disabled', mode, focusedChunk, startedAt });
    return false;
  }
  if (!Array.isArray(v.rows) || !v.rows.length || !Array.isArray(v.prefix) || v.prefix.length !== v.rows.length + 1) {
    recordPrunePrefixDeltaGuard(v, { applied: false, reason: 'virtual rows or prefix unavailable', mode, focusedChunk, prunedChunks, startedAt });
    return false;
  }
  const firstKeptIndex = v.rows.findIndex(row => !removedSet.has(Number(row?.chunk)));
  if (firstKeptIndex < 0) {
    recordPrunePrefixDeltaGuard(v, { applied: false, reason: 'prune would remove every row', mode, focusedChunk, prunedChunks, startedAt });
    return false;
  }
  let lastKeptIndex = -1;
  for (let i = v.rows.length - 1; i >= 0; i -= 1) {
    if (!removedSet.has(Number(v.rows[i]?.chunk))) { lastKeptIndex = i; break; }
  }
  if (lastKeptIndex < firstKeptIndex) {
    recordPrunePrefixDeltaGuard(v, { applied: false, reason: 'kept row range invalid', mode, focusedChunk, prunedChunks, startedAt });
    return false;
  }
  for (let i = firstKeptIndex; i <= lastKeptIndex; i += 1) {
    if (removedSet.has(Number(v.rows[i]?.chunk))) {
      recordPrunePrefixDeltaGuard(v, { applied: false, reason: 'removed chunk is inside kept range', mode, focusedChunk, prunedChunks, firstKeptIndex, lastKeptIndex, startedAt });
      return false;
    }
  }
  const loadedChunks = new Set(Array.from(app.state.loadedChunks?.keys?.() || []).map(Number).filter(Number.isFinite));
  for (const row of v.rows.slice(firstKeptIndex, lastKeptIndex + 1)) {
    const chunk = Number(row?.chunk);
    if (Number.isFinite(chunk) && !loadedChunks.has(chunk)) {
      recordPrunePrefixDeltaGuard(v, { applied: false, reason: 'kept row chunk is no longer loaded', mode, focusedChunk, prunedChunks, missingChunk: chunk, startedAt });
      return false;
    }
  }
  const beforeRows = v.rows.length;
  const beforeHeight = Math.round(Number(v.totalHeight) || Number(v.prefix[v.prefix.length - 1]) || 0);
  const topDelta = Math.max(0, Number(v.prefix[firstKeptIndex]) || 0);
  const nextRows = v.rows.slice(firstKeptIndex, lastKeptIndex + 1);
  const nextHeights = Array.isArray(v.heights) && v.heights.length === beforeRows
    ? v.heights.slice(firstKeptIndex, lastKeptIndex + 1)
    : nextRows.map(row => getRowHeight(app, row));
  const nextPrefix = [];
  for (let i = firstKeptIndex; i <= lastKeptIndex + 1; i += 1) {
    nextPrefix.push(Math.max(0, (Number(v.prefix[i]) || 0) - topDelta));
  }
  const removedRows = v.rows.filter(row => removedSet.has(Number(row?.chunk)));
  const removedIds = new Set(removedRows.map(row => row?.id).filter(Boolean));
  pruneVirtualMeasureCacheByIds(v, removedIds);
  pruneVirtualRowElementPoolByIds(v, removedIds);
  v.rows = nextRows;
  v.heights = nextHeights;
  v.prefix = nextPrefix;
  v.totalHeight = Math.max(0, Number(nextPrefix[nextPrefix.length - 1]) || 0);
  v.renderedStart = shiftRenderedIndex(v.renderedStart, firstKeptIndex, nextRows.length);
  v.renderedEnd = shiftRenderedIndex(v.renderedEnd, firstKeptIndex, nextRows.length);
  if (v.renderedStart >= v.renderedEnd) { v.renderedStart = -1; v.renderedEnd = -1; }
  rebuildVirtualRowIndexes(v);
  renderVirtual(app, { force: true });
  recordPrunePrefixDeltaGuard(v, { applied: true, reason: 'edge prune kept prefix delta without rebuilding rows from loaded chunks', mode, focusedChunk, prunedChunks, beforeRows, afterRows: nextRows.length, removedRows: removedRows.length, beforeHeight, afterHeight: Math.round(Number(v.totalHeight) || 0), topDelta: Math.round(topDelta), firstKeptIndex, lastKeptIndex, source: String(context?.options?.source || ''), durationMs: Math.round((nowForDiagnostics() - startedAt) * 10) / 10, startedAt });
  return true;
}

function shiftRenderedIndex(value, removedBefore, rowCount) {
  const index = Math.round(Number(value));
  if (!Number.isFinite(index) || index < 0) return -1;
  return clamp(index - Math.max(0, Number(removedBefore) || 0), 0, Math.max(0, Number(rowCount) || 0));
}

function pruneVirtualMeasureCacheByIds(v, ids) {
  if (!(v?.measureCache instanceof Map) || !(ids instanceof Set) || !ids.size) return 0;
  let pruned = 0;
  ids.forEach(id => { if (v.measureCache.delete(id)) pruned += 1; });
  return pruned;
}

function pruneVirtualRowElementPoolByIds(v, ids) {
  if (!(v?.rowElementPool instanceof Map) || !(ids instanceof Set) || !ids.size) return 0;
  let pruned = 0;
  ids.forEach(id => { if (v.rowElementPool.delete(id)) pruned += 1; });
  if (pruned && v.rowElementPoolStats) v.rowElementPoolStats.pruned = Math.max(0, Number(v.rowElementPoolStats.pruned) || 0) + pruned;
  return pruned;
}

function recordPrunePrefixDeltaGuard(v, payload = {}) {
  if (!v) return null;
  v.prunePrefixDeltaGuardPass = READER_PRUNE_PREFIX_DELTA_GUARD_PASS;
  v.lastPrunePrefixDeltaGuard = { pass: READER_PRUNE_PREFIX_DELTA_GUARD_PASS, ...(payload || {}), at: Date.now() };
  return v.lastPrunePrefixDeltaGuard;
}

function nowForDiagnostics() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}

function resolveReaderAnchorTraceMode(app = null) {
  const current = app?.state?.current || null;
  return current?.novel?.isMultiFile && current?.episode ? 'multi-file' : 'single-file';
}

function buildReaderAnchorTraceContext(app = null, v = null, reader = null, extra = {}) {
  const current = app?.state?.current || null;
  const episodeCount = Array.isArray(current?.novel?.episodes) ? current.novel.episodes.length : 0;
  return {
    mode: resolveReaderAnchorTraceMode(app),
    phase: String(extra.phase || ''),
    anchorType: String(extra.anchorType || ''),
    source: String(extra.source || ''),
    direction: String(extra.direction || v?.lastScrollBufferDirection || ''),
    chunk: Math.max(1, Math.round(Number(current?.chunk) || 1)),
    totalChunks: Math.max(1, Math.round(Number(current?.totalChunks) || 1)),
    episodeIdx: Number.isFinite(Number(current?.episodeIdx)) ? Number(current.episodeIdx) : -1,
    episodeCount,
    hasEpisode: !!current?.episode,
    loadedChunks: app?.state?.loadedChunks?.size || 0,
    rowCount: Array.isArray(v?.rows) ? v.rows.length : 0,
    renderedStart: Number.isFinite(Number(v?.renderedStart)) ? Number(v.renderedStart) : -1,
    renderedEnd: Number.isFinite(Number(v?.renderedEnd)) ? Number(v.renderedEnd) : -1,
    layoutRevision: Number(v?.layoutRevision) || 0,
    scrollTop: Math.round(Number(reader?.scrollTop) || 0),
    clientHeight: Math.round(Number(reader?.clientHeight) || 0),
    scrollHeight: Math.round(Math.max(Number(v?.totalHeight) || 0, Number(reader?.clientHeight) || 0)),
    scrollHeightSource: 'virtual-total-height',
    lowOverheadPass: READER_ANCHOR_TRACE_LOW_OVERHEAD_PASS
  };
}

function pushReaderAnchorTrace(app = null, v = null, payload = {}) {
  if (!v) return payload;
  const seq = Math.max(0, Number(v.anchorTraceSequence) || 0) + 1;
  v.anchorTraceSequence = seq;
  v.anchorTracePass = READER_ANCHOR_TRACE_EXPORT_PASS;
  const event = {
    pass: READER_ANCHOR_TRACE_EXPORT_PASS,
    seq,
    at: Date.now(),
    ...(payload || {})
  };
  if (!Array.isArray(v.anchorTrace)) v.anchorTrace = [];
  if (!v.anchorTraceStats || typeof v.anchorTraceStats !== 'object') {
    v.anchorTraceStats = { pushed: 0, dropped: 0, maxEvents: READER_ANCHOR_TRACE_LIMIT };
  }
  if (v.anchorTrace.length >= READER_ANCHOR_TRACE_LIMIT) {
    v.anchorTrace.shift();
    v.anchorTraceStats.dropped = Math.max(0, Number(v.anchorTraceStats.dropped) || 0) + 1;
  }
  v.anchorTrace.push(event);
  v.anchorTraceStats.pushed = Math.max(0, Number(v.anchorTraceStats.pushed) || 0) + 1;
  v.anchorTraceStats.maxEvents = READER_ANCHOR_TRACE_LIMIT;
  v.anchorTraceLowOverheadPass = READER_ANCHOR_TRACE_LOW_OVERHEAD_PASS;
  v.lastAnchorTraceEvent = event;
  return event;
}

function traceCapturedAnchor(app = null, v = null, reader = null, phase = '', anchor = null, extra = {}) {
  if (!anchor || !v) return anchor;
  const context = buildReaderAnchorTraceContext(app, v, reader, { ...(extra || {}), phase, anchorType: extra.anchorType || anchor.anchorType || '' });
  const traceId = String(anchor.traceId || `${Date.now().toString(36)}-${Math.max(0, Number(v.anchorTraceSequence) || 0) + 1}`);
  const tracedAnchor = {
    ...anchor,
    traceId,
    anchorTracePass: READER_ANCHOR_TRACE_EXPORT_PASS,
    traceMode: context.mode,
    tracePhase: phase,
    traceAnchorType: context.anchorType
  };
  const rowSnapshot = resolveAnchorRowSnapshot(v, tracedAnchor);
  pushReaderAnchorTrace(app, v, {
    event: 'capture',
    traceId,
    ...context,
    rowId: tracedAnchor.rowId || '',
    rowIndex: Number.isFinite(Number(tracedAnchor.rowIndex)) ? Number(tracedAnchor.rowIndex) : -1,
    rowType: rowSnapshot.rowType,
    capturedRowId: tracedAnchor.capturedRowId || '',
    capturedRowIndex: Number.isFinite(Number(tracedAnchor.capturedRowIndex)) ? Number(tracedAnchor.capturedRowIndex) : -1,
    capturedRowType: rowSnapshot.capturedRowType,
    bodyAnchorAdjusted: tracedAnchor.bodyAnchorAdjusted === true,
    offsetPx: Math.round(Number(tracedAnchor.offsetPx) || 0),
    anchorOffsetPx: Math.round(Number(tracedAnchor.anchorOffsetPx) || 0)
  });
  return tracedAnchor;
}

function traceAnchorResult(app = null, v = null, reader = null, phase = '', anchor = null, result = null, extra = {}) {
  if (!v) return result;
  const context = buildReaderAnchorTraceContext(app, v, reader, { ...(extra || {}), phase, anchorType: extra.anchorType || anchor?.traceAnchorType || '' });
  const rowSnapshot = resolveAnchorRowSnapshot(v, anchor);
  pushReaderAnchorTrace(app, v, {
    event: 'restore',
    traceId: String(anchor?.traceId || ''),
    ...context,
    applied: result?.applied === true,
    reason: String(result?.reason || ''),
    rowId: result?.rowId || anchor?.rowId || '',
    rowIndex: Number.isFinite(Number(result?.rowIndex)) ? Number(result.rowIndex) : (Number.isFinite(Number(anchor?.rowIndex)) ? Number(anchor.rowIndex) : -1),
    rowType: rowSnapshot.rowType,
    capturedRowId: anchor?.capturedRowId || '',
    capturedRowIndex: rowSnapshot.capturedRowIndex,
    capturedRowType: rowSnapshot.capturedRowType,
    deltaPx: Math.round(Number(result?.deltaPx) || 0),
    suppressedBy: String(result?.suppressedBy || '')
  });
  return result;
}

function captureAppendRebuildAnchor(app, mode, options = {}) {
  if (mode !== 'append' || options.preserveAnchor === false) return null;
  const reader = app?.els?.reader || null;
  if (!reader) return null;
  const v = recalcVirtualLayout(app);
  if (v.pendingScrollTarget) return null;
  const gate = resolveAppendAnchorGate(reader, v, options);
  recordAppendAnchorGate(v, gate);
  if (!gate.allowed) return null;
  const exactNativeAnchor = shouldCaptureExactNativeAnchor(app, v);
  recordMultiFileNativeExactAnchor(v, {
    ...resolveMultiFileNativeExactAnchorState(app, v),
    phase: 'append-capture',
    anchorType: 'append',
    preferBodyRows: !exactNativeAnchor,
    source: String(v.lastUserScrollSource || '')
  });
  const anchor = enrichAppendAnchorWithFileChar(app, v, traceCapturedAnchor(app, v, reader, 'append-capture', captureVirtualScrollAnchor({
    reader,
    rows: v.rows,
    prefix: v.prefix,
    anchorOffsetPx: VIRTUAL_SCROLL_STABILITY_ANCHOR_OFFSET_PX,
    preferBodyRows: !exactNativeAnchor
  }), { anchorType: 'append', source: options?.source || '', direction: v?.lastScrollBufferDirection || '' }));
  if (!anchor) return null;
  return {
    ...anchor,
    appendPreservePass: 'v277-reader-append-anchor-preserve-pass',
    appendAnchorGatedPass: READER_APPEND_ANCHOR_GATED_PASS,
    appendAnchorGateReason: gate.reason,
    capturedScrollHeight: Number(reader.scrollHeight) || 0,
    capturedClientHeight: Number(reader.clientHeight) || 0,
    activeAtCapture: !!gate.activeUserScroll,
    nearBottomAtCapture: !!gate.nearBottom,
    sourceAtCapture: gate.source,
    directionAtCapture: gate.direction,
    lastUserScrollSourceAtCapture: gate.lastUserScrollSource
  };
}


function enrichAppendAnchorWithFileChar(app, v, anchor = null) {
  if (!anchor || !v?.rows?.length) return anchor;
  const rowIndex = Number.isFinite(Number(anchor.rowIndex)) ? Math.round(Number(anchor.rowIndex)) : -1;
  const row = rowIndex >= 0 ? v.rows[rowIndex] : null;
  if (!row || row.type !== 'body') return anchor;
  const rowTop = Number(v.prefix?.[rowIndex]) || 0;
  const rowBottom = Number(v.prefix?.[rowIndex + 1]) || rowTop;
  const rowHeight = Math.max(1, rowBottom - rowTop);
  const rowRatio = clamp((Number(anchor.offsetPx) || 0) / rowHeight, 0, 1);
  const localStart = Math.max(0, Number(row.start) || 0);
  const localEnd = Math.max(localStart, Number(row.end) || localStart);
  const localCharIndex = Math.round(localStart + (localEnd - localStart) * rowRatio);
  const fileCharIndex = Number.isFinite(Number(row.fileCharStart)) && Number.isFinite(Number(row.fileCharEnd))
    ? Math.round(Number(row.fileCharStart) + (Math.max(Number(row.fileCharStart), Number(row.fileCharEnd)) - Number(row.fileCharStart)) * rowRatio)
    : chunkCharToFileChar(app, row.chunk, localCharIndex);
  if (!Number.isFinite(Number(fileCharIndex))) return anchor;
  v.appendFileCharAnchorPass = READER_APPEND_FILE_CHAR_ANCHOR_PASS;
  v.lastAppendFileCharAnchorCapture = {
    pass: READER_APPEND_FILE_CHAR_ANCHOR_PASS,
    blockCharRangesPass: row.manifestBlockCharRangesPass || '',
    rowId: row.id || '',
    rowIndex,
    chunk: Number(row.chunk) || 0,
    blockIndex: Number(row.blockIndex) || 0,
    localCharIndex,
    fileCharIndex: Math.max(0, Math.round(Number(fileCharIndex))),
    rowRatio,
    reason: 'append anchor captured stable file char coordinate before chunk attach',
    at: Date.now()
  };
  return {
    ...anchor,
    fileCharAnchorPass: READER_APPEND_FILE_CHAR_ANCHOR_PASS,
    blockCharRangesPass: row.manifestBlockCharRangesPass || '',
    fileCharIndex: Math.max(0, Math.round(Number(fileCharIndex))),
    charIndex: localCharIndex,
    charAnchorRatio: rowRatio,
    anchorRowChunk: Number(row.chunk) || 0,
    anchorBlockIndex: Number(row.blockIndex) || 0
  };
}


function enrichPrependAnchorWithFileChar(app, v, anchor = null) {
  if (!anchor || !v?.rows?.length) return anchor;
  const rowIndex = Number.isFinite(Number(anchor.rowIndex)) ? Math.round(Number(anchor.rowIndex)) : -1;
  const row = rowIndex >= 0 ? v.rows[rowIndex] : null;
  if (!row || row.type !== 'body') return anchor;
  const rowTop = Number(v.prefix?.[rowIndex]) || 0;
  const rowBottom = Number(v.prefix?.[rowIndex + 1]) || rowTop;
  const rowHeight = Math.max(1, rowBottom - rowTop);
  const rowRatio = clamp((Number(anchor.offsetPx) || 0) / rowHeight, 0, 1);
  const localStart = Math.max(0, Number(row.start) || 0);
  const localEnd = Math.max(localStart, Number(row.end) || localStart);
  const localCharIndex = Math.round(localStart + (localEnd - localStart) * rowRatio);
  const fileCharIndex = Number.isFinite(Number(row.fileCharStart)) && Number.isFinite(Number(row.fileCharEnd))
    ? Math.round(Number(row.fileCharStart) + (Math.max(Number(row.fileCharStart), Number(row.fileCharEnd)) - Number(row.fileCharStart)) * rowRatio)
    : chunkCharToFileChar(app, row.chunk, localCharIndex);
  if (!Number.isFinite(Number(fileCharIndex))) return anchor;
  v.prependFileCharAnchorPass = READER_PREPEND_FILE_CHAR_ANCHOR_PASS;
  v.lastPrependFileCharAnchorCapture = {
    pass: READER_PREPEND_FILE_CHAR_ANCHOR_PASS,
    blockCharRangesPass: row.manifestBlockCharRangesPass || '',
    rowId: row.id || '',
    rowIndex,
    chunk: Number(row.chunk) || 0,
    blockIndex: Number(row.blockIndex) || 0,
    localCharIndex,
    fileCharIndex: Math.max(0, Math.round(Number(fileCharIndex))),
    rowRatio,
    reason: 'prepend anchor captured stable file char coordinate before chunk attach',
    at: Date.now()
  };
  return {
    ...anchor,
    fileCharAnchorPass: READER_PREPEND_FILE_CHAR_ANCHOR_PASS,
    blockCharRangesPass: row.manifestBlockCharRangesPass || '',
    fileCharIndex: Math.max(0, Math.round(Number(fileCharIndex))),
    charIndex: localCharIndex,
    charAnchorRatio: rowRatio,
    anchorRowChunk: Number(row.chunk) || 0,
    anchorBlockIndex: Number(row.blockIndex) || 0
  };
}

function resolveAppendAnchorGate(reader, v, options = {}) {
  const source = String(options?.source || '');
  const direction = String(v?.lastScrollBufferDirection || '');
  const lastUserScrollSource = String(v?.lastUserScrollSource || '');
  const explicit = options?.preserveAnchor === true;
  const active = isVirtualScrollActive(v);
  const activeUserScroll = active && isUserScrollSource(lastUserScrollSource);
  const bufferAppend = isForwardScrollBufferAppendSource(source);
  const forwardIntent = direction !== 'backward';
  const nearBottom = isReaderNearVirtualBottom(reader);
  const shouldPreserve = explicit || active || nearBottom;
  const nativeBottomGrowth = activeUserScroll && bufferAppend && forwardIntent && !explicit;
  const allowed = nativeBottomGrowth ? false : shouldPreserve;
  let reason = 'append anchor not needed';
  if (explicit) reason = 'explicit preserveAnchor';
  else if (nativeBottomGrowth) reason = 'active forward buffer append keeps native scrollTop without append anchor';
  else if (allowed && activeUserScroll) reason = 'active non-buffer append anchor preserve';
  else if (allowed && nearBottom) reason = 'near-bottom append anchor preserve';
  else if (allowed) reason = 'append anchor preserve';
  return {
    pass: READER_APPEND_ANCHOR_GATED_PASS,
    allowed,
    reason,
    active,
    activeUserScroll,
    nearBottom,
    source,
    direction,
    lastUserScrollSource,
    nativeBottomGrowth,
    multiEpisodeAppendAnchorPass: READER_MULTI_EPISODE_APPEND_ANCHOR_PASS,
    scrollTop: Math.round(Number(reader?.scrollTop) || 0),
    remainingBottom: Math.round(Math.max(0, (Number(reader?.scrollHeight) || 0) - (Number(reader?.scrollTop) || 0) - (Number(reader?.clientHeight) || 0)))
  };
}

function recordAppendAnchorGate(v, gate) {
  if (!v || !gate) return;
  v.appendAnchorGatedPass = READER_APPEND_ANCHOR_GATED_PASS;
  v.lastAppendAnchorGate = { ...gate, at: Date.now() };
}


function recordAppendMicroCorrectionDamp(v, payload = {}) {
  if (!v) return payload;
  v.appendMicroCorrectionDampPass = READER_APPEND_MICRO_CORRECTION_DAMP_PASS;
  v.lastAppendMicroCorrectionDamp = {
    pass: READER_APPEND_MICRO_CORRECTION_DAMP_PASS,
    ...(payload || {}),
    at: Date.now()
  };
  return v.lastAppendMicroCorrectionDamp;
}

function resolveAppendMicroCorrectionDamp(app, v, reader, anchor, context = {}) {
  const now = Date.now();
  const gate = v?.lastAppendAnchorGate || null;
  const inertia = v?.lastScrollBufferAppendInertiaExtend || null;
  const gateAgeMs = gate?.at ? Math.max(0, now - Number(gate.at)) : Infinity;
  const inertiaAgeMs = inertia?.at ? Math.max(0, now - Number(inertia.at)) : Infinity;
  const source = String(gate?.source || inertia?.source || '');
  const direction = String(gate?.direction || inertia?.direction || '');
  const explicit = context?.explicit === true || String(gate?.reason || '') === 'explicit preserveAnchor';
  const pending = !!v?.pendingScrollTarget;
  const recentForwardBufferAppend = isForwardScrollBufferAppendSource(source)
    && direction !== 'backward'
    && !explicit
    && Math.min(gateAgeMs, inertiaAgeMs) <= VIRTUAL_APPEND_MICRO_CORRECTION_DAMP_MS;
  const delta = estimateVirtualAnchorDelta(reader, v?.rows || [], v?.prefix || [], anchor);
  const deltaPx = Number(delta?.deltaPx) || 0;
  const magnitude = Math.abs(deltaPx);
  const viewportLimit = Math.max(96, Math.min(VIRTUAL_APPEND_MICRO_CORRECTION_DAMP_MAX_PX, Math.round((Number(reader?.clientHeight) || 0) * VIRTUAL_APPEND_MICRO_CORRECTION_DAMP_MAX_VIEWPORT_RATIO)));
  const smallCorrection = magnitude >= VIRTUAL_APPEND_MICRO_CORRECTION_DAMP_MIN_PX && magnitude <= viewportLimit;
  const nativeScrollSource = isUserScrollSource(v?.lastUserScrollSource);
  const suppress = !!reader && !pending && recentForwardBufferAppend && nativeScrollSource && smallCorrection;
  return recordAppendMicroCorrectionDamp(v, {
    suppress,
    reason: suppress
      ? 'recent forward buffer append dampens sub-block anchor correction'
      : pending
        ? 'pending target allows micro correction'
        : !recentForwardBufferAppend
          ? 'no recent forward buffer append for micro correction damp'
          : !nativeScrollSource
            ? 'no native scroll source for micro correction damp'
            : !smallCorrection
              ? 'correction outside micro damp window'
              : 'micro correction damp unavailable',
    phase: String(context?.phase || ''),
    anchorType: String(context?.anchorType || ''),
    source,
    direction,
    explicit,
    gateAgeMs: Number.isFinite(gateAgeMs) ? Math.round(gateAgeMs) : null,
    inertiaAgeMs: Number.isFinite(inertiaAgeMs) ? Math.round(inertiaAgeMs) : null,
    viewportLimit: Math.round(viewportLimit),
    deltaPx: Math.round(deltaPx),
    magnitude: Math.round(magnitude),
    rowId: anchor?.rowId || '',
    rowIndex: Number.isFinite(Number(anchor?.rowIndex)) ? Number(anchor.rowIndex) : -1,
    ...(delta || {})
  });
}


function resolveFileCharAnchorBodyRow(v, address = null) {
  if (!v || !address) return null;
  const chunk = Math.max(1, Number(address.chunk) || 1);
  const charIndex = Number(address.charIndex);
  if (!Number.isFinite(charIndex)) return null;
  const exact = resolveNearestBodyRowByChar(v, chunk, charIndex);
  if (!exact || !Number.isFinite(Number(exact.rowIndex)) || Number(exact.rowIndex) < 0) return null;
  const row = v.rows[Number(exact.rowIndex)] || null;
  if (!row || row.type !== 'body') return null;
  return { row, rowIndex: Number(exact.rowIndex), charIndex: Number(exact.charIndex), nearest: exact.nearest === true, reason: exact.reason || '' };
}

function applyAppendFileCharAnchor(app, v, reader, anchor, context = {}) {
  if (!reader || !v || !anchor || !Number.isFinite(Number(anchor.fileCharIndex))) return null;
  const address = fileCharToChunkAddress(app, anchor.fileCharIndex);
  const target = resolveFileCharAnchorBodyRow(v, address);
  if (!target) return null;
  const rowTop = Number(v.prefix?.[target.rowIndex]) || 0;
  const rowBottom = Number(v.prefix?.[target.rowIndex + 1]) || rowTop;
  const rowHeight = Math.max(1, rowBottom - rowTop);
  const blockOffset = estimateInRowOffset(target.row, target.charIndex, rowHeight);
  const anchorOffsetPx = Math.max(0, Number(anchor.anchorOffsetPx) || VIRTUAL_SCROLL_STABILITY_ANCHOR_OFFSET_PX);
  const targetScrollTop = Math.max(0, Math.round(rowTop + blockOffset - anchorOffsetPx));
  const currentScrollTop = Math.max(0, Number(reader.scrollTop) || 0);
  const deltaPx = targetScrollTop - currentScrollTop;
  const result = {
    pass: READER_APPEND_FILE_CHAR_ANCHOR_PASS,
    bodyAnchorPass: anchor?.bodyAnchorPass || READER_MULTI_FILE_BODY_ANCHOR_PASS,
    blockCharRangesPass: address.blockCharRangesPass || anchor.blockCharRangesPass || '',
    applied: false,
    reason: '',
    rowId: target.row?.id || '',
    rowIndex: target.rowIndex,
    deltaPx: Math.round(deltaPx),
    fileCharIndex: Math.max(0, Math.round(Number(anchor.fileCharIndex))),
    charIndex: Math.max(0, Math.round(Number(target.charIndex))),
    chunk: Number(target.row?.chunk) || Number(address.chunk) || 0,
    blockIndex: Number(target.row?.blockIndex) || Number(address.blockIndex) || 0,
    globalBlockIndex: Number(target.row?.globalBlockIndex) || Number(address.globalBlockIndex) || 0,
    nearest: target.nearest === true,
    phase: String(context?.phase || '')
  };
  if (!Number.isFinite(deltaPx) || Math.abs(deltaPx) < 1) {
    result.reason = 'file char anchor already within threshold';
  } else {
    reader.scrollTop = targetScrollTop;
    result.applied = true;
    result.reason = target.nearest
      ? 'append restore used nearest body row from stable file char coordinate'
      : 'append restore used stable file char coordinate';
  }
  v.appendFileCharAnchorPass = READER_APPEND_FILE_CHAR_ANCHOR_PASS;
  v.lastAppendFileCharAnchorRestore = {
    ...result,
    reason: result.reason,
    at: Date.now()
  };
  return result;
}


function applyPrependFileCharAnchor(app, v, reader, anchor, context = {}) {
  if (!reader || !v || !anchor || !Number.isFinite(Number(anchor.fileCharIndex))) return null;
  const address = fileCharToChunkAddress(app, anchor.fileCharIndex);
  const target = resolveFileCharAnchorBodyRow(v, address);
  if (!target) return null;
  const rowTop = Number(v.prefix?.[target.rowIndex]) || 0;
  const rowBottom = Number(v.prefix?.[target.rowIndex + 1]) || rowTop;
  const rowHeight = Math.max(1, rowBottom - rowTop);
  const blockOffset = estimateInRowOffset(target.row, target.charIndex, rowHeight);
  const anchorOffsetPx = Math.max(0, Number(anchor.anchorOffsetPx) || VIRTUAL_SCROLL_STABILITY_ANCHOR_OFFSET_PX);
  const targetScrollTop = Math.max(0, Math.round(rowTop + blockOffset - anchorOffsetPx));
  const currentScrollTop = Math.max(0, Number(reader.scrollTop) || 0);
  const deltaPx = targetScrollTop - currentScrollTop;
  const result = {
    pass: READER_PREPEND_FILE_CHAR_ANCHOR_PASS,
    bodyAnchorPass: anchor?.bodyAnchorPass || READER_MULTI_FILE_BODY_ANCHOR_PASS,
    blockCharRangesPass: address.blockCharRangesPass || anchor.blockCharRangesPass || '',
    applied: false,
    reason: '',
    rowId: target.row?.id || '',
    rowIndex: target.rowIndex,
    deltaPx: Math.round(deltaPx),
    fileCharIndex: Math.max(0, Math.round(Number(anchor.fileCharIndex))),
    charIndex: Math.max(0, Math.round(Number(target.charIndex))),
    chunk: Number(target.row?.chunk) || Number(address.chunk) || 0,
    blockIndex: Number(target.row?.blockIndex) || Number(address.blockIndex) || 0,
    globalBlockIndex: Number(target.row?.globalBlockIndex) || Number(address.globalBlockIndex) || 0,
    nearest: target.nearest === true,
    phase: String(context?.phase || '')
  };
  if (!Number.isFinite(deltaPx) || Math.abs(deltaPx) < 1) {
    result.reason = 'file char prepend anchor already within threshold';
  } else {
    reader.scrollTop = targetScrollTop;
    result.applied = true;
    result.reason = target.nearest
      ? 'prepend restore used nearest body row from stable file char coordinate'
      : 'prepend restore used stable file char coordinate';
  }
  v.prependFileCharAnchorPass = READER_PREPEND_FILE_CHAR_ANCHOR_PASS;
  v.lastPrependFileCharAnchorRestore = {
    ...result,
    reason: result.reason,
    at: Date.now()
  };
  return result;
}

function restoreAppendRebuildAnchor(app, anchor, phase = 'post-layout') {
  if (!anchor) return null;
  const reader = app?.els?.reader || null;
  const v = recalcVirtualLayout(app);
  const scrollTopBefore = Math.round(Number(reader?.scrollTop) || 0);
  if (!reader || v.pendingScrollTarget) return null;
  const explicit = anchor?.appendAnchorGateReason === 'explicit preserveAnchor';
  if (shouldFreezeNativeSettledScroll(app, { reason: `append-anchor-${phase}`, explicit, anchorType: 'append' })) {
    return recordSuppressedScrollStability(v, { phase, anchorType: 'append', rowId: anchor?.rowId || '', rowIndex: anchor?.rowIndex });
  }
  const restorePolicy = resolveUnifiedAppendRestorePolicy(app, v, reader, anchor, { phase, anchorType: 'append', explicit });
  const correctionGuard = restorePolicy?.suppress ? null : resolveAppendCorrectionGuard(app, anchor, { phase, anchorType: 'append' });
  const microDamp = restorePolicy?.suppress || correctionGuard?.suppress ? null : resolveAppendMicroCorrectionDamp(app, v, reader, anchor, { phase, anchorType: 'append', explicit });
  const upwardGuard = restorePolicy?.suppress || correctionGuard?.suppress || microDamp?.suppress ? null : resolveAppendUpwardCorrectionGuard(app, v, reader, anchor, { phase, anchorType: 'append' });
  const result = restorePolicy?.suppress
    ? { applied: false, reason: restorePolicy.reason, pass: READER_UNIFIED_APPEND_RESTORE_POLICY_PASS, rowId: restorePolicy.rowId || '', rowIndex: Number(restorePolicy.rowIndex) || -1, deltaPx: 0, suppressedBy: READER_UNIFIED_APPEND_RESTORE_POLICY_PASS }
    : correctionGuard?.suppress
      ? { applied: false, reason: correctionGuard.reason, pass: READER_APPEND_CORRECTION_GUARD_PASS, rowId: correctionGuard.rowId || '', rowIndex: Number(correctionGuard.rowIndex) || -1, deltaPx: Number(correctionGuard.deltaPx) || 0, suppressedBy: READER_APPEND_CORRECTION_GUARD_PASS }
      : microDamp?.suppress
        ? { applied: false, reason: microDamp.reason, pass: READER_APPEND_MICRO_CORRECTION_DAMP_PASS, rowId: microDamp.rowId || '', rowIndex: Number(microDamp.rowIndex) || -1, deltaPx: Number(microDamp.deltaPx) || 0, suppressedBy: READER_APPEND_MICRO_CORRECTION_DAMP_PASS }
        : upwardGuard?.suppress
          ? { applied: false, reason: upwardGuard.reason, pass: READER_APPEND_UPWARD_CORRECTION_GUARD_PASS, rowId: upwardGuard.rowId || '', rowIndex: Number(upwardGuard.rowIndex) || -1, deltaPx: Number(upwardGuard.deltaPx) || 0, suppressedBy: READER_APPEND_UPWARD_CORRECTION_GUARD_PASS }
          : (applyAppendFileCharAnchor(app, v, reader, anchor, { phase, anchorType: 'append', explicit })
            || applyVirtualScrollAnchorWithInertiaGuard(app, v, reader, anchor, { phase, anchorType: 'append', explicit }));
  traceAnchorResult(app, v, reader, `append-${phase}`, anchor, result, { anchorType: 'append', bodyAnchorAdjusted: !!anchor?.bodyAnchorAdjusted });
  v.scrollStabilityPass = READER_VIRTUAL_SCROLL_STABILITY_PASS;
  v.lastAppendScrollStability = {
    ...(result || {}),
    phase,
    appendPreservePass: anchor.appendPreservePass || '',
    appendAnchorGatedPass: anchor.appendAnchorGatedPass || READER_APPEND_ANCHOR_GATED_PASS,
    appendAnchorGateReason: anchor.appendAnchorGateReason || '',
    activeAtCapture: !!anchor.activeAtCapture,
    nearBottomAtCapture: !!anchor.nearBottomAtCapture,
    sourceAtCapture: anchor.sourceAtCapture || '',
    directionAtCapture: anchor.directionAtCapture || '',
    lastUserScrollSourceAtCapture: anchor.lastUserScrollSourceAtCapture || ''
  };
  recordAppendSeamScrollTopDiagnostic(v, {
    phase,
    applied: result?.applied === true,
    reason: String(result?.reason || ''),
    suppressedBy: String(result?.suppressedBy || ''),
    rowId: anchor?.rowId || result?.rowId || '',
    rowIndex: Number.isFinite(Number(anchor?.rowIndex)) ? Number(anchor.rowIndex) : Number(result?.rowIndex) || -1,
    fileCharAnchorPass: anchor?.fileCharAnchorPass || result?.pass === READER_APPEND_FILE_CHAR_ANCHOR_PASS ? READER_APPEND_FILE_CHAR_ANCHOR_PASS : '',
    fileCharIndex: Number.isFinite(Number(anchor?.fileCharIndex)) ? Math.round(Number(anchor.fileCharIndex)) : null,
    scrollTopBefore,
    scrollTopAfter: Math.round(Number(reader.scrollTop) || 0),
    deltaPx: Math.round((Number(reader.scrollTop) || 0) - scrollTopBefore),
    sourceAtCapture: anchor.sourceAtCapture || '',
    directionAtCapture: anchor.directionAtCapture || '',
    lastUserScrollSourceAtCapture: anchor.lastUserScrollSourceAtCapture || ''
  });
  if (result?.applied) {
    v.lastScrollStability = result;
    v.lastAppendAnchorRestoredAt = Date.now();
  }
  return result;
}

function recordAppendSeamScrollTopDiagnostic(v, payload = {}) {
  if (!v) return payload;
  v.appendSeamScrollTopDiagnosticPass = READER_APPEND_SEAM_SCROLLTOP_DIAGNOSTIC_PASS;
  v.lastAppendSeamScrollTopDiagnostic = {
    pass: READER_APPEND_SEAM_SCROLLTOP_DIAGNOSTIC_PASS,
    ...(payload || {}),
    at: Date.now()
  };
  return v.lastAppendSeamScrollTopDiagnostic;
}

function hasRecentAppendAnchorRestore(v, now = Date.now()) {
  const restoredAt = Number(v?.lastAppendAnchorRestoredAt) || 0;
  return restoredAt > 0 && now - restoredAt <= VIRTUAL_APPEND_MEASURE_ANCHOR_GRACE_MS;
}

function resolveScrollBufferPatchAnchorGate(v, now = Date.now()) {
  const gate = v?.lastAppendAnchorGate || null;
  const source = String(gate?.source || '');
  const direction = String(gate?.direction || '');
  const ageMs = gate?.at ? Math.max(0, now - Number(gate.at)) : Infinity;
  const appendRestored = hasRecentAppendAnchorRestore(v, now);
  const recentScrollBufferAppend = isForwardScrollBufferAppendSource(source) && direction !== 'backward' && ageMs <= VIRTUAL_APPEND_MEASURE_ANCHOR_GRACE_MS;
  const nativeForwardRetain = resolveNativeForwardScrollRetain(v, { source, direction, phase: 'scroll-buffer-patch-anchor' }, now);
  const allowed = !v?.pendingScrollTarget && !nativeForwardRetain.retain && (appendRestored || recentScrollBufferAppend);
  return {
    pass: READER_SCROLL_BUFFER_PATCH_ANCHOR_PASS,
    allowed,
    reason: allowed
      ? 'scroll-buffer append window patch anchor restore'
      : nativeForwardRetain.retain
        ? 'native forward scroll keeps scrollTop without patch anchor restore'
        : v?.pendingScrollTarget
          ? 'pending target blocks patch anchor restore'
          : 'no recent scroll-buffer append anchor',
    source,
    direction,
    nativeForwardRetain: !!nativeForwardRetain.retain,
    nativeForwardRetainPass: nativeForwardRetain.pass || '',
    appendRestored,
    recentScrollBufferAppend,
    ageMs: Number.isFinite(ageMs) ? Math.round(ageMs) : null
  };
}

function recordScrollBufferPatchAnchor(v, payload = {}) {
  if (!v) return null;
  v.scrollBufferPatchAnchorPass = READER_SCROLL_BUFFER_PATCH_ANCHOR_PASS;
  v.lastScrollBufferPatchAnchor = {
    pass: READER_SCROLL_BUFFER_PATCH_ANCHOR_PASS,
    ...(payload || {}),
    at: Date.now()
  };
  return v.lastScrollBufferPatchAnchor;
}

function recordAppendMeasureAnchorBypass(v, payload = {}) {
  if (!v) return null;
  v.appendMeasureAnchorPass = READER_APPEND_MEASURE_ANCHOR_PASS;
  v.lastAppendMeasureAnchorBypass = {
    pass: READER_APPEND_MEASURE_ANCHOR_PASS,
    ...(payload || {}),
    at: Date.now()
  };
  return v.lastAppendMeasureAnchorBypass;
}

function scheduleAppendRebuildAnchorRecheck(app, anchor) {
  const v = ensureVirtualState(app);
  if (!anchor || v.appendAnchorRecheckRaf) return;
  v.appendAnchorRecheckRaf = window.requestAnimationFrame(() => {
    v.appendAnchorRecheckRaf = 0;
    restoreAppendRebuildAnchor(app, anchor, 'post-render');
  });
}

function capturePrependRebuildAnchor(app, mode, options = {}) {
  if (mode !== 'prepend' || options.preserveAnchor === false) return null;
  const reader = app?.els?.reader || null;
  if (!reader) return null;
  const v = recalcVirtualLayout(app);
  if (v.pendingScrollTarget) return null;
  const gate = resolvePrependAnchorGate(reader, v, options);
  recordPrependAnchorGate(v, gate);
  if (!gate.allowed) return null;
  const exactNativeAnchor = shouldCaptureExactNativeAnchor(app, v);
  recordMultiFileNativeExactAnchor(v, {
    ...resolveMultiFileNativeExactAnchorState(app, v),
    phase: 'prepend-capture',
    anchorType: 'prepend',
    preferBodyRows: !exactNativeAnchor,
    source: String(v.lastUserScrollSource || '')
  });
  const anchor = enrichPrependAnchorWithFileChar(app, v, traceCapturedAnchor(app, v, reader, 'prepend-capture', captureVirtualScrollAnchor({
    reader,
    rows: v.rows,
    prefix: v.prefix,
    anchorOffsetPx: VIRTUAL_SCROLL_STABILITY_ANCHOR_OFFSET_PX,
    preferBodyRows: !exactNativeAnchor
  }), { anchorType: 'prepend', source: options?.source || '', direction: v?.lastScrollBufferDirection || '' }));
  if (!anchor) return null;
  return {
    ...anchor,
    prependPreservePass: READER_PREPEND_ANCHOR_PRESERVE_PASS,
    prependAnchorGatedPass: READER_PREPEND_ANCHOR_GATED_PASS,
    prependAnchorGateReason: gate.reason,
    capturedScrollHeight: Number(reader.scrollHeight) || 0,
    capturedClientHeight: Number(reader.clientHeight) || 0,
    activeAtCapture: !!gate.activeUserScroll,
    nearTopAtCapture: !!gate.nearTop,
    sourceAtCapture: gate.source,
    directionAtCapture: gate.direction,
    lastUserScrollSourceAtCapture: gate.lastUserScrollSource
  };
}

function resolvePrependAnchorGate(reader, v, options = {}) {
  const source = String(options?.source || '');
  const direction = String(v?.lastScrollBufferDirection || '');
  const lastUserScrollSource = String(v?.lastUserScrollSource || '');
  const explicit = options?.preserveAnchor === true;
  const scrollTop = Math.max(0, Number(reader?.scrollTop) || 0);
  const clientHeight = Math.max(1, Number(reader?.clientHeight) || 1);
  const nearTopLimit = Math.max(240, clientHeight * 0.75);
  const nearTop = scrollTop <= nearTopLimit;
  const active = isVirtualScrollActive(v);
  const activeUserScroll = active && isUserScrollSource(lastUserScrollSource);
  const bufferPrepend = source === READER_SCROLL_BUFFER_PASS;
  const backwardIntent = direction === 'backward';
  const allowed = explicit || (activeUserScroll && nearTop && bufferPrepend && backwardIntent);
  let reason = 'idle prepend uses height-delta fallback';
  if (explicit) reason = 'explicit preserveAnchor';
  else if (!activeUserScroll) reason = active ? 'non-scroll prepend uses height-delta fallback' : 'idle prepend uses height-delta fallback';
  else if (!nearTop) reason = 'prepend away from top uses height-delta fallback';
  else if (!bufferPrepend) reason = 'non-buffer prepend uses height-delta fallback';
  else if (!backwardIntent) reason = 'non-backward prepend uses height-delta fallback';
  else reason = 'active upward edge prepend anchor preserve';
  return {
    pass: READER_PREPEND_ANCHOR_GATED_PASS,
    allowed,
    reason,
    active,
    activeUserScroll,
    nearTop,
    nearTopLimit: Math.round(nearTopLimit),
    scrollTop: Math.round(scrollTop),
    source,
    direction,
    lastUserScrollSource
  };
}

function recordPrependAnchorGate(v, gate) {
  if (!v || !gate) return;
  v.prependAnchorGatedPass = READER_PREPEND_ANCHOR_GATED_PASS;
  v.lastPrependAnchorGate = { ...gate, at: Date.now() };
}

function restorePrependRebuildAnchor(app, anchor, phase = 'post-layout') {
  if (!anchor) return null;
  const reader = app?.els?.reader || null;
  const v = recalcVirtualLayout(app);
  const scrollTopBefore = Math.round(Number(reader?.scrollTop) || 0);
  if (!reader || v.pendingScrollTarget) return null;
  const explicit = anchor?.prependAnchorGateReason === 'explicit preserveAnchor';
  if (shouldFreezeNativeSettledScroll(app, { reason: `prepend-anchor-${phase}`, explicit, anchorType: 'prepend' })) {
    const suppressed = recordSuppressedScrollStability(v, { phase, anchorType: 'prepend', rowId: anchor?.rowId || '', rowIndex: anchor?.rowIndex });
    recordPrependSeamScrollTopDiagnostic(v, {
      phase,
      applied: false,
      reason: String(suppressed?.reason || 'native settled scroll freeze suppressed prepend restore'),
      suppressedBy: String(suppressed?.suppressedBy || READER_SCROLL_SETTLE_NATIVE_FREEZE_PASS),
      rowId: anchor?.rowId || '',
      rowIndex: Number.isFinite(Number(anchor?.rowIndex)) ? Number(anchor.rowIndex) : -1,
      fileCharAnchorPass: anchor?.fileCharAnchorPass || '',
      fileCharIndex: Number.isFinite(Number(anchor?.fileCharIndex)) ? Math.round(Number(anchor.fileCharIndex)) : null,
      scrollTopBefore,
      scrollTopAfter: Math.round(Number(reader.scrollTop) || 0),
      deltaPx: Math.round((Number(reader.scrollTop) || 0) - scrollTopBefore),
      sourceAtCapture: anchor.sourceAtCapture || '',
      directionAtCapture: anchor.directionAtCapture || '',
      lastUserScrollSourceAtCapture: anchor.lastUserScrollSourceAtCapture || ''
    });
    return suppressed;
  }
  const result = applyPrependFileCharAnchor(app, v, reader, anchor, { phase, anchorType: 'prepend', explicit })
    || applyVirtualScrollAnchorWithInertiaGuard(app, v, reader, anchor, { phase, anchorType: 'prepend', explicit });
  traceAnchorResult(app, v, reader, `prepend-${phase}`, anchor, result, { anchorType: 'prepend', bodyAnchorAdjusted: !!anchor?.bodyAnchorAdjusted });
  v.scrollStabilityPass = READER_VIRTUAL_SCROLL_STABILITY_PASS;
  v.prependAnchorPreservePass = READER_PREPEND_ANCHOR_PRESERVE_PASS;
  v.lastPrependScrollStability = {
    ...(result || {}),
    phase,
    prependPreservePass: anchor.prependPreservePass || READER_PREPEND_ANCHOR_PRESERVE_PASS,
    prependAnchorGatedPass: anchor.prependAnchorGatedPass || READER_PREPEND_ANCHOR_GATED_PASS,
    prependAnchorGateReason: anchor.prependAnchorGateReason || '',
    activeAtCapture: !!anchor.activeAtCapture,
    nearTopAtCapture: !!anchor.nearTopAtCapture,
    sourceAtCapture: anchor.sourceAtCapture || '',
    directionAtCapture: anchor.directionAtCapture || '',
    lastUserScrollSourceAtCapture: anchor.lastUserScrollSourceAtCapture || '',
    fileCharAnchorPass: anchor.fileCharAnchorPass || result?.pass === READER_PREPEND_FILE_CHAR_ANCHOR_PASS ? READER_PREPEND_FILE_CHAR_ANCHOR_PASS : '',
    fileCharIndex: Number.isFinite(Number(anchor?.fileCharIndex)) ? Math.round(Number(anchor.fileCharIndex)) : null,
    capturedScrollHeight: Number(anchor.capturedScrollHeight) || 0,
    currentScrollHeight: Math.round(Number(reader.scrollHeight) || 0)
  };
  recordPrependSeamScrollTopDiagnostic(v, {
    phase,
    applied: result?.applied === true,
    reason: String(result?.reason || ''),
    suppressedBy: String(result?.suppressedBy || ''),
    rowId: anchor?.rowId || result?.rowId || '',
    rowIndex: Number.isFinite(Number(anchor?.rowIndex)) ? Number(anchor.rowIndex) : Number(result?.rowIndex) || -1,
    fileCharAnchorPass: anchor?.fileCharAnchorPass || result?.pass === READER_PREPEND_FILE_CHAR_ANCHOR_PASS ? READER_PREPEND_FILE_CHAR_ANCHOR_PASS : '',
    fileCharIndex: Number.isFinite(Number(anchor?.fileCharIndex)) ? Math.round(Number(anchor.fileCharIndex)) : null,
    scrollTopBefore,
    scrollTopAfter: Math.round(Number(reader.scrollTop) || 0),
    deltaPx: Math.round((Number(reader.scrollTop) || 0) - scrollTopBefore),
    sourceAtCapture: anchor.sourceAtCapture || '',
    directionAtCapture: anchor.directionAtCapture || '',
    lastUserScrollSourceAtCapture: anchor.lastUserScrollSourceAtCapture || ''
  });
  if (result?.applied) {
    v.lastScrollStability = result;
    v.lastPrependAnchorRestoredAt = Date.now();
  }
  return v.lastPrependScrollStability;
}

function recordPrependSeamScrollTopDiagnostic(v, payload = {}) {
  if (!v) return payload;
  v.prependSeamScrollTopDiagnosticPass = READER_PREPEND_SEAM_SCROLLTOP_DIAGNOSTIC_PASS;
  v.lastPrependSeamScrollTopDiagnostic = {
    pass: READER_PREPEND_SEAM_SCROLLTOP_DIAGNOSTIC_PASS,
    ...(payload || {}),
    at: Date.now()
  };
  return v.lastPrependSeamScrollTopDiagnostic;
}

function schedulePrependRebuildAnchorRecheck(app, anchor) {
  const v = ensureVirtualState(app);
  if (!anchor || v.prependAnchorRecheckRaf) return;
  v.prependAnchorRecheckRaf = window.requestAnimationFrame(() => {
    v.prependAnchorRecheckRaf = 0;
    restorePrependRebuildAnchor(app, anchor, 'post-render');
  });
}

function isReaderNearVirtualBottom(reader) {
  const scrollHeight = Math.max(0, Number(reader?.scrollHeight) || 0);
  const scrollTop = Math.max(0, Number(reader?.scrollTop) || 0);
  const clientHeight = Math.max(1, Number(reader?.clientHeight) || 1);
  return scrollHeight - scrollTop - clientHeight < Math.max(240, clientHeight * 0.5);
}

export function snapshotVirtualScroll(app) {
  const v = ensureVirtualState(app);
  recalcVirtualLayout(app);
  return {
    scrollTop: app.els.reader?.scrollTop || 0,
    totalHeight: v.totalHeight || 0
  };
}

export function captureVirtualViewportAnchor(app, options = {}) {
  const reader = app?.els?.reader || null;
  if (!reader) return null;
  const v = recalcVirtualLayout(app);
  const exactNativeAnchor = shouldCaptureExactNativeAnchor(app, v);
  recordMultiFileNativeExactAnchor(v, {
    ...resolveMultiFileNativeExactAnchorState(app, v),
    phase: options.reason || options.source || 'viewport-capture',
    anchorType: 'viewport',
    preferBodyRows: !exactNativeAnchor,
    source: String(v.lastUserScrollSource || '')
  });
  return traceCapturedAnchor(app, v, reader, options.reason || options.source || 'viewport-capture', captureVirtualScrollAnchor({
    reader,
    rows: v.rows,
    prefix: v.prefix,
    anchorOffsetPx: options.anchorOffsetPx || VIRTUAL_SCROLL_STABILITY_ANCHOR_OFFSET_PX,
    preferBodyRows: !exactNativeAnchor
  }), { anchorType: 'viewport', source: options.source || '' });
}

export function restoreVirtualViewportAnchor(app, anchor = null, options = {}) {
  const reader = app?.els?.reader || null;
  const v = recalcVirtualLayout(app);
  if (!reader) return null;
  v.scrollStabilityPass = READER_VIRTUAL_SCROLL_STABILITY_PASS;
  if (shouldFreezeNativeSettledScroll(app, { reason: options.reason || options.source || 'viewport-anchor', explicit: options.explicit === true, anchorType: 'viewport' })) {
    return recordSuppressedScrollStability(v, { phase: options.reason || options.source || 'viewport-anchor', anchorType: 'viewport', rowId: anchor?.rowId || '', rowIndex: anchor?.rowIndex, fallbackDeltaPx: Math.round(Number(options.fallbackDeltaPx) || 0) });
  }
  const fallbackDeltaPx = Math.round(Number(options.fallbackDeltaPx) || 0);
  const fallbackGuardDelta = fallbackDeltaPx > 0
    ? {
        rowId: anchor?.rowId || '',
        rowIndex: Number.isFinite(Number(anchor?.rowIndex)) ? Number(anchor.rowIndex) : -1,
        currentScrollTop: Math.round(Number(reader.scrollTop) || 0),
        targetScrollTop: Math.max(0, Math.round((Number(reader.scrollTop) || 0) - fallbackDeltaPx)),
        deltaPx: -fallbackDeltaPx
      }
    : null;
  const viewportRestorePolicy = resolveUnifiedAppendRestorePolicy(app, v, reader, anchor, {
    phase: options.reason || options.source || 'viewport-anchor',
    anchorType: 'viewport',
    explicit: options.explicit === true,
    source: options.source || anchor?.sourceAtCapture || v?.lastAppendAnchorGate?.source || v?.lastScrollBufferAppendInertiaExtend?.source || '',
    direction: anchor?.directionAtCapture || v?.lastAppendAnchorGate?.direction || v?.lastScrollBufferAppendInertiaExtend?.direction || v?.lastScrollBufferDirection || '',
    lastUserScrollSource: anchor?.lastUserScrollSourceAtCapture || v?.lastScrollBufferAppendInertiaExtend?.lastUserScrollSource || v?.lastUserScrollSource || ''
  });
  if (viewportRestorePolicy?.suppress) {
    v.lastScrollStability = { applied: false, reason: viewportRestorePolicy.reason, pass: READER_UNIFIED_VIEWPORT_RESTORE_POLICY_PASS, rowId: viewportRestorePolicy.rowId || '', rowIndex: Number(viewportRestorePolicy.rowIndex) || -1, deltaPx: 0, fallbackDeltaPx, suppressedBy: READER_UNIFIED_APPEND_RESTORE_POLICY_PASS };
    traceAnchorResult(app, v, reader, options.reason || options.source || 'viewport-anchor', anchor, v.lastScrollStability, { anchorType: 'viewport', source: options.source || '', bodyAnchorAdjusted: !!anchor?.bodyAnchorAdjusted });
    return v.lastScrollStability;
  }
  const correctionGuard = resolveAppendCorrectionGuard(app, anchor, {
    phase: options.reason || options.source || 'viewport-anchor',
    anchorType: 'viewport',
    fallbackDeltaPx,
    delta: fallbackGuardDelta || null
  });
  if (correctionGuard?.suppress) {
    v.lastScrollStability = { applied: false, reason: correctionGuard.reason, pass: READER_APPEND_CORRECTION_GUARD_PASS, rowId: correctionGuard.rowId || '', rowIndex: Number(correctionGuard.rowIndex) || -1, deltaPx: Number(correctionGuard.deltaPx) || 0, fallbackDeltaPx, suppressedBy: READER_APPEND_CORRECTION_GUARD_PASS };
    return v.lastScrollStability;
  }
  const microDamp = resolveAppendMicroCorrectionDamp(app, v, reader, anchor, { phase: options.reason || options.source || 'viewport-anchor', anchorType: 'viewport', explicit: options.explicit === true });
  if (microDamp?.suppress) {
    v.lastScrollStability = { applied: false, reason: microDamp.reason, pass: READER_APPEND_MICRO_CORRECTION_DAMP_PASS, rowId: microDamp.rowId || '', rowIndex: Number(microDamp.rowIndex) || -1, deltaPx: Number(microDamp.deltaPx) || 0, fallbackDeltaPx, suppressedBy: READER_APPEND_MICRO_CORRECTION_DAMP_PASS };
    return v.lastScrollStability;
  }
  const result = applyVirtualScrollAnchorWithInertiaGuard(app, v, reader, anchor, { phase: options.reason || options.source || 'viewport-restore', anchorType: 'viewport', source: options.source || '', explicit: options.explicit === true });
  traceAnchorResult(app, v, reader, options.reason || options.source || 'viewport-restore', anchor, result, { anchorType: 'viewport', source: options.source || '', bodyAnchorAdjusted: !!anchor?.bodyAnchorAdjusted });
  if (result?.applied) {
    v.lastScrollStability = result;
    return result;
  }
  if (String(anchor?.rowId || '') && result?.reason === 'anchor row missing') {
    v.pruneExactAnchorPass = READER_PRUNE_EXACT_ANCHOR_PASS;
    v.lastPruneExactAnchor = {
      pass: READER_PRUNE_EXACT_ANCHOR_PASS,
      applied: false,
      reason: 'exact anchor row missing; fallback skipped',
      rowId: anchor?.rowId || '',
      rowIndex: Number.isFinite(Number(anchor?.rowIndex)) ? Number(anchor.rowIndex) : -1,
      fallbackDeltaPx,
      source: options.source || options.reason || 'viewport-anchor',
      at: Date.now()
    };
    v.lastScrollStability = { ...(result || {}), reason: v.lastPruneExactAnchor.reason, fallbackDeltaPx, suppressedBy: READER_PRUNE_EXACT_ANCHOR_PASS };
    return v.lastScrollStability;
  }
  if (fallbackDeltaPx > 0) {
    const previousTop = Math.max(0, Number(reader.scrollTop) || 0);
    const targetTop = Math.max(0, previousTop - fallbackDeltaPx);
    if (Math.abs(targetTop - previousTop) >= 1) {
      reader.scrollTop = targetTop;
      v.lastScrollStability = {
        pass: READER_VIRTUAL_SCROLL_STABILITY_PASS,
        applied: true,
        reason: 'fallback delta adjusted',
        rowId: anchor?.rowId || '',
        rowIndex: Number.isFinite(Number(anchor?.rowIndex)) ? Number(anchor.rowIndex) : -1,
        deltaPx: Math.round(targetTop - previousTop),
        fallbackDeltaPx
      };
      return v.lastScrollStability;
    }
  }
  v.lastScrollStability = result || { pass: READER_VIRTUAL_SCROLL_STABILITY_PASS, applied: false, reason: 'unavailable' };
  return v.lastScrollStability;
}

export function recalcVirtualLayout(app) {
  const v = ensureVirtualState(app);
  const heights = new Array(v.rows.length);
  const prefix = [0];
  let total = 0;
  v.rows.forEach((row, idx) => {
    const h = getRowHeight(app, row);
    heights[idx] = h;
    total += h;
    prefix.push(total);
  });
  v.heights = heights;
  v.prefix = prefix;
  v.totalHeight = total;
  return v;
}

function getRowHeight(app, row) {
  const v = ensureVirtualState(app);
  const measured = v.measureCache.get(row.id);
  if (Number.isFinite(measured) && measured > 0) return measured;
  return estimateRowHeight(app, row);
}

function estimateRowHeight(app, row) {
  if (row.type === 'header') return hasVirtualChunkHeading(row) ? 76 : 0;
  const prefs = app.state.prefs || {};
  const fontSize = clamp(prefs.readerFontSize || 18, 10, 40);
  const lineHeight = clamp(prefs.lineHeight || 2.1, 1.2, 3.5);
  const contentWidth = Math.max(280, app.els.content?.clientWidth || clamp(prefs.width || 700, 320, 1100));
  const padH = clamp(prefs.padH || 28, 0, 120) * 2;
  const usableWidth = Math.max(220, contentWidth - padH);
  const charsPerLine = Math.max(12, Math.floor(usableWidth / (fontSize * 0.92)));
  const lines = String(row.text || '').split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
  return Math.max(48, Math.ceil(lines * fontSize * lineHeight + 18));
}


export function extendScrollBufferAppendInertia(app, context = {}) {
  const v = ensureVirtualState(app);
  const now = Date.now();
  const direction = String(context?.direction || 'forward');
  const lastSource = String(v.lastUserScrollSource || '');
  const userScrollSource = isUserScrollSource(lastSource);
  const forward = direction !== 'backward';
  const requestedMs = Math.max(VIRTUAL_SCROLL_BUFFER_APPEND_INERTIA_EXTEND_MS, Number(context?.durationMs) || 0);
  const until = now + requestedMs;
  const extended = !!(userScrollSource && forward && !v.pendingScrollTarget);
  if (extended) v.userScrollActiveUntil = Math.max(Number(v.userScrollActiveUntil) || 0, until);
  v.scrollBufferAppendInertiaExtendPass = READER_SCROLL_BUFFER_APPEND_INERTIA_EXTEND_PASS;
  v.lastScrollBufferAppendInertiaExtend = {
    pass: READER_SCROLL_BUFFER_APPEND_INERTIA_EXTEND_PASS,
    extended,
    reason: extended
      ? 'forward scroll-buffer append extends native inertia protection until chunk commit settles'
      : !userScrollSource
        ? 'no native scroll source for append inertia extension'
        : !forward
          ? 'backward append inertia extension skipped'
          : v.pendingScrollTarget
            ? 'pending target skips append inertia extension'
            : 'append inertia extension unavailable',
    source: String(context?.source || ''),
    direction,
    targetChunk: Number.isFinite(Number(context?.targetChunk)) ? Math.round(Number(context.targetChunk)) : null,
    remainingBottom: Number.isFinite(Number(context?.remainingBottom)) ? Math.round(Number(context.remainingBottom)) : null,
    edgePx: Number.isFinite(Number(context?.edgePx)) ? Math.round(Number(context.edgePx)) : null,
    activeUntil: Number(v.userScrollActiveUntil) || 0,
    requestedMs: Math.round(requestedMs),
    lastUserScrollSource: lastSource,
    at: now
  };
  return v.lastScrollBufferAppendInertiaExtend;
}

export function markVirtualScrollActivity(app, { source = 'scroll', durationMs = VIRTUAL_SCROLL_ACTIVE_GRACE_MS } = {}) {
  const v = ensureVirtualState(app);
  const now = Date.now();
  const sourceLabel = String(source || 'scroll');
  const requested = Math.max(60, Number(durationMs) || VIRTUAL_SCROLL_ACTIVE_GRACE_MS);
  const until = now + requested;
  v.userScrollActiveUntil = Math.max(Number(v.userScrollActiveUntil) || 0, until);
  v.lastUserScrollSource = sourceLabel;
  const stats = v.scrollInputStats || createScrollInputStats();
  stats.pass = READER_SCROLL_INPUT_DIAGNOSTICS_PASS;
  stats.total = (Number(stats.total) || 0) + 1;
  stats.bySource = stats.bySource && typeof stats.bySource === 'object' ? stats.bySource : {};
  stats.bySource[sourceLabel] = (Number(stats.bySource[sourceLabel]) || 0) + 1;
  stats.lastSource = sourceLabel;
  stats.lastDurationMs = requested;
  stats.lastMarkedAt = now;
  stats.lastActiveUntil = v.userScrollActiveUntil;
  v.scrollInputStats = stats;
  if (sourceLabel === 'touch-coast' || sourceLabel === 'touch-scroll') {
    v.ipadScrollCoastRetainPass = READER_IPAD_SCROLL_COAST_RETAIN_PASS;
    v.lastIpadScrollCoastRetain = {
      pass: READER_IPAD_SCROLL_COAST_RETAIN_PASS,
      source: sourceLabel,
      retained: true,
      requestedMs: Math.round(requested),
      activeUntil: Number(v.userScrollActiveUntil) || 0,
      viewport: Math.round(Number(app?.els?.reader?.clientHeight) || 0),
      reason: 'touch native scroll coast keeps virtual render and measure writes in active-scroll mode',
      at: now
    };
  }
  return v.userScrollActiveUntil;
}

function isVirtualScrollActive(v, now = Date.now()) {
  return now < (Number(v?.userScrollActiveUntil) || 0);
}

function isUserScrollSource(source = '') {
  const label = String(source || '');
  return label === 'scroll' || label === 'drag-pan' || label === 'touch-scroll' || label === 'touch-coast';
}


function isMultiFileReader(app = null) {
  const current = app?.state?.current || null;
  return !!(current?.novel?.isMultiFile && current?.episode);
}

function resolveMultiFileNativeExactAnchorState(app = null, v = null, now = Date.now()) {
  const activeUntil = Number(v?.userScrollActiveUntil) || 0;
  const active = now < activeUntil;
  const settledForMs = activeUntil > 0 ? Math.max(0, now - activeUntil) : Infinity;
  const recentNativeSettle = activeUntil > 0 && settledForMs <= VIRTUAL_ACTIVE_RETAIN_LEADING_GRACE_MS;
  const source = String(v?.lastUserScrollSource || '');
  const userScrollSource = isUserScrollSource(source);
  const appendWindow = isAppendCorrectionGuardWindowActive(v, now);
  const pending = !!v?.pendingScrollTarget;
  const multiFile = isMultiFileReader(app);
  const exact = !!(multiFile && !pending && userScrollSource && (active || recentNativeSettle || appendWindow));
  return {
    pass: READER_MULTI_FILE_NATIVE_SCROLL_SETTLE_EXACT_ANCHOR_PASS,
    exact,
    multiFile,
    pending,
    userScrollSource,
    source,
    active,
    recentNativeSettle,
    appendWindow,
    activeUntil,
    settledForMs: Number.isFinite(settledForMs) ? Math.round(settledForMs) : null,
    reason: exact
      ? 'multi-file native scroll/settle keeps captured row exact'
      : !multiFile
        ? 'single-file reader may use body-row remap'
        : pending
          ? 'pending target may remap to body row'
          : !userScrollSource
            ? 'last input is not native scroll'
            : !(active || recentNativeSettle || appendWindow)
              ? 'native scroll exact-anchor window expired'
              : 'multi-file exact anchor unavailable'
  };
}

function shouldCaptureExactNativeAnchor(app = null, v = null, now = Date.now()) {
  return resolveMultiFileNativeExactAnchorState(app, v, now).exact;
}

function resolveScrollSettleExactAnchorRestore(app = null, v = null, context = {}, now = Date.now()) {
  const state = resolveMultiFileNativeExactAnchorState(app, v, now);
  const restore = !!(state.exact && !state.active && state.multiFile && state.userScrollSource && !state.pending);
  return {
    pass: READER_SCROLL_SETTLE_EXACT_ANCHOR_RESTORE_PASS,
    restore,
    ...state,
    phase: String(context?.phase || ''),
    anchorType: String(context?.anchorType || ''),
    reason: restore
      ? 'native inertia just settled; keep exact captured row for delayed measure/render restore'
      : state.reason
  };
}

function recordScrollSettleExactAnchorRestore(v = null, payload = {}) {
  if (!v) return payload;
  v.scrollSettleExactAnchorRestorePass = READER_SCROLL_SETTLE_EXACT_ANCHOR_RESTORE_PASS;
  v.lastScrollSettleExactAnchorRestore = {
    pass: READER_SCROLL_SETTLE_EXACT_ANCHOR_RESTORE_PASS,
    ...payload,
    at: Date.now()
  };
  return v.lastScrollSettleExactAnchorRestore;
}

function recordMultiFileNativeExactAnchor(v = null, payload = {}) {
  if (!v) return payload;
  v.multiFileNativeExactAnchorPass = READER_MULTI_FILE_NATIVE_EXACT_ANCHOR_PASS;
  v.multiFileNativeScrollSettleExactAnchorPass = READER_MULTI_FILE_NATIVE_SCROLL_SETTLE_EXACT_ANCHOR_PASS;
  v.lastMultiFileNativeExactAnchor = {
    pass: READER_MULTI_FILE_NATIVE_EXACT_ANCHOR_PASS,
    ...payload,
    at: Date.now()
  };
  v.lastMultiFileNativeScrollSettleExactAnchor = {
    pass: READER_MULTI_FILE_NATIVE_SCROLL_SETTLE_EXACT_ANCHOR_PASS,
    ...payload,
    at: Date.now()
  };
  return v.lastMultiFileNativeExactAnchor;
}

function recordMultiFileBottomAnchorNativeGuard(v = null, payload = {}) {
  if (!v) return payload;
  v.multiFileBottomAnchorNativeGuardPass = READER_MULTI_FILE_BOTTOM_ANCHOR_NATIVE_GUARD_PASS;
  v.lastMultiFileBottomAnchorNativeGuard = {
    pass: READER_MULTI_FILE_BOTTOM_ANCHOR_NATIVE_GUARD_PASS,
    ...payload,
    at: Date.now()
  };
  return v.lastMultiFileBottomAnchorNativeGuard;
}

function resolveNativeScrollSettleFreeze(app, options = {}) {
  const v = ensureVirtualState(app);
  const explicit = options?.explicit === true;
  const now = Date.now();
  const activeUntil = Number(v.userScrollActiveUntil) || 0;
  const active = isVirtualScrollActive(v, now);
  const pending = !!v.pendingScrollTarget;
  const userScrollSource = isUserScrollSource(v.lastUserScrollSource);
  const seamAnchorCorrection = resolveAppendSeamAnchorCorrectionGate(v, {
    phase: String(options?.reason || 'native-scroll-settle'),
    anchorType: String(options?.anchorType || '')
  }, now);
  const seamAllowsCorrection = seamAnchorCorrection?.allowCorrection === true;
  const seamTransitLock = resolveNativeForwardSeamTransitLock(v, { phase: String(options?.reason || 'native-scroll-settle'), anchorType: String(options?.anchorType || '') }, now);
  const freeze = !explicit && !pending && userScrollSource && activeUntil > 0 && (seamTransitLock.locked || (!active && !seamAllowsCorrection));
  return {
    pass: READER_SCROLL_SETTLE_NATIVE_FREEZE_PASS,
    freeze,
    reason: seamTransitLock.locked
      ? 'native forward seam transit freeze'
      : seamAllowsCorrection
        ? 'append seam correction exception disabled during native settle'
        : String(options?.reason || 'native-scroll-settle'),
    explicit,
    pending,
    active,
    userScrollSource,
    lastUserScrollSource: String(v.lastUserScrollSource || ''),
    activeUntil,
    settledForMs: activeUntil > 0 ? Math.max(0, Math.round(now - activeUntil)) : 0,
    scrollTop: Math.round(Number(app?.els?.reader?.scrollTop) || 0),
    anchorType: String(options?.anchorType || ''),
    appendSeamAnchorCorrectionPass: seamAnchorCorrection?.pass || '',
    appendSeamAnchorCorrection: seamAllowsCorrection,
    appendSeamAnchorCorrectionReason: seamAnchorCorrection?.reason || '',
    seamTransitLock: !!seamTransitLock.locked,
    seamTransitLockPass: seamTransitLock.pass || '',
    seamTransitLockReason: seamTransitLock.reason || ''
  };
}

function recordNativeScrollSettleFreeze(v, gate = {}, extra = {}) {
  if (!v) return gate;
  v.scrollSettleNativeFreezePass = READER_SCROLL_SETTLE_NATIVE_FREEZE_PASS;
  v.lastScrollSettleNativeFreeze = {
    pass: READER_SCROLL_SETTLE_NATIVE_FREEZE_PASS,
    ...(gate || {}),
    ...(extra || {}),
    at: Date.now()
  };
  return v.lastScrollSettleNativeFreeze;
}

export function shouldFreezeNativeSettledScroll(app, options = {}) {
  const v = ensureVirtualState(app);
  const gate = resolveNativeScrollSettleFreeze(app, options);
  if (gate.freeze || options.record === true) recordNativeScrollSettleFreeze(v, gate, options.extra || null);
  return !!gate.freeze;
}


function recordNativeForwardMeasureFreeze(v, payload = {}) {
  if (!v) return payload;
  v.nativeForwardMeasureFreezePass = READER_NATIVE_FORWARD_MEASURE_FREEZE_PASS;
  v.lastNativeForwardMeasureFreeze = {
    pass: READER_NATIVE_FORWARD_MEASURE_FREEZE_PASS,
    ...(payload || {}),
    at: Date.now()
  };
  return v.lastNativeForwardMeasureFreeze;
}

function resolveNativeForwardMeasureCommitFreeze(app = null, v = null, context = {}, now = Date.now()) {
  const pending = !!(v?.pendingScrollTarget || v?.pendingSliderMeasureTarget);
  const multiFile = isMultiFileReader(app);
  const source = String(v?.lastUserScrollSource || '');
  const userScrollSource = isUserScrollSource(source);
  const append = resolveRecentForwardScrollBufferAppend(v, now);
  const direction = String(append?.direction || v?.lastScrollBufferDirection || '');
  const forward = direction !== 'backward';
  const activeUntil = Number(v?.userScrollActiveUntil) || 0;
  const active = activeUntil > 0 && now < activeUntil;
  const settledForMs = activeUntil > 0 ? Math.max(0, now - activeUntil) : Infinity;
  const recentNativeSettle = activeUntil > 0 && settledForMs <= VIRTUAL_ACTIVE_RETAIN_LEADING_GRACE_MS;
  const appendWindow = isAppendCorrectionGuardWindowActive(v, now);
  const recentAppendAnchor = context?.recentAppendAnchor === true;
  const settleExactRestore = context?.settleExactMeasureAnchorRestore === true;
  const freeze = !!(
    multiFile &&
    !pending &&
    userScrollSource &&
    forward &&
    (append.recent || appendWindow || recentAppendAnchor) &&
    (active || recentNativeSettle || appendWindow || recentAppendAnchor || settleExactRestore)
  );
  return recordNativeForwardMeasureFreeze(v, {
    freeze,
    reason: freeze
      ? 'native forward append/settle keeps scrollTop while measured heights are adopted'
      : pending
        ? 'pending target allows measure correction'
        : !multiFile
          ? 'single-file reader keeps existing measure anchor behavior'
          : !userScrollSource
            ? 'last input is not native scroll'
            : !forward
              ? 'backward scroll keeps existing measure anchor behavior'
              : !(append.recent || appendWindow || recentAppendAnchor)
                ? 'no recent forward append measure window'
                : 'native forward measure freeze unavailable',
    phase: String(context?.phase || ''),
    anchorType: String(context?.anchorType || ''),
    source,
    direction,
    active,
    recentNativeSettle,
    settledForMs: Number.isFinite(settledForMs) ? Math.round(settledForMs) : null,
    appendRecent: !!append.recent,
    appendWindow,
    recentAppendAnchor,
    settleExactMeasureAnchorRestore: settleExactRestore
  });
}


function recordNativeBackwardMeasureFreeze(v, payload = {}) {
  if (!v) return payload;
  v.nativeBackwardMeasureFreezePass = READER_NATIVE_BACKWARD_MEASURE_FREEZE_PASS;
  v.lastNativeBackwardMeasureFreeze = {
    pass: READER_NATIVE_BACKWARD_MEASURE_FREEZE_PASS,
    ...(payload || {}),
    at: Date.now()
  };
  return v.lastNativeBackwardMeasureFreeze;
}

function hasRecentPrependAnchorRestore(v, now = Date.now()) {
  const restoredAt = Number(v?.lastPrependAnchorRestoredAt) || 0;
  return restoredAt > 0 && now - restoredAt <= VIRTUAL_APPEND_MEASURE_ANCHOR_GRACE_MS;
}

function resolveRecentBackwardScrollBufferPrepend(v = null, now = Date.now()) {
  const gate = v?.lastPrependAnchorGate || null;
  const source = String(gate?.source || '');
  const direction = String(gate?.direction || '');
  const ageMs = gate?.at ? Math.max(0, now - Number(gate.at)) : Infinity;
  const recent = source === READER_SCROLL_BUFFER_PASS && direction === 'backward' && ageMs <= VIRTUAL_APPEND_MEASURE_ANCHOR_GRACE_MS;
  return { recent, source, direction, ageMs: Number.isFinite(ageMs) ? Math.round(ageMs) : null };
}

function resolveNativeBackwardMeasureCommitFreeze(app = null, v = null, context = {}, now = Date.now()) {
  const pending = !!(v?.pendingScrollTarget || v?.pendingSliderMeasureTarget);
  const multiFile = isMultiFileReader(app);
  const source = String(v?.lastUserScrollSource || '');
  const userScrollSource = isUserScrollSource(source);
  const prepend = resolveRecentBackwardScrollBufferPrepend(v, now);
  const activeUntil = Number(v?.userScrollActiveUntil) || 0;
  const active = activeUntil > 0 && now < activeUntil;
  const settledForMs = activeUntil > 0 ? Math.max(0, now - activeUntil) : Infinity;
  const recentNativeSettle = activeUntil > 0 && settledForMs <= VIRTUAL_ACTIVE_RETAIN_LEADING_GRACE_MS;
  const recentPrependAnchor = context?.recentPrependAnchor === true;
  const freeze = !!(
    multiFile &&
    !pending &&
    userScrollSource &&
    prepend.recent &&
    (active || recentNativeSettle || recentPrependAnchor)
  );
  return recordNativeBackwardMeasureFreeze(v, {
    freeze,
    reason: freeze
      ? 'native backward prepend/settle keeps scrollTop while measured heights are adopted'
      : pending
        ? 'pending target allows measure correction'
        : !multiFile
          ? 'single-file reader keeps existing measure anchor behavior'
          : !userScrollSource
            ? 'last input is not native scroll'
            : !prepend.recent
              ? 'no recent backward prepend measure window'
              : 'native backward measure freeze unavailable',
    phase: String(context?.phase || ''),
    anchorType: String(context?.anchorType || ''),
    source,
    direction: prepend.direction,
    active,
    recentNativeSettle,
    settledForMs: Number.isFinite(settledForMs) ? Math.round(settledForMs) : null,
    prependRecent: !!prepend.recent,
    prependAgeMs: prepend.ageMs,
    recentPrependAnchor
  });
}

function recordSuppressedScrollStability(v, payload = {}) {
  const result = {
    pass: READER_VIRTUAL_SCROLL_STABILITY_PASS,
    applied: false,
    reason: 'native scroll settle freeze',
    freezePass: payload.freezePass || READER_SCROLL_SETTLE_NATIVE_FREEZE_PASS,
    rowId: payload.rowId || '',
    rowIndex: Number.isFinite(Number(payload.rowIndex)) ? Number(payload.rowIndex) : -1,
    deltaPx: 0,
    phase: payload.phase || '',
    anchorType: payload.anchorType || '',
    fallbackDeltaPx: Math.round(Number(payload.fallbackDeltaPx) || 0)
  };
  if (v) {
    v.scrollStabilityPass = READER_VIRTUAL_SCROLL_STABILITY_PASS;
    v.lastScrollStability = result;
  }
  return result;
}

function recordSeamTransitMeasureDefer(v, payload = {}) {
  if (!v) return payload;
  v.seamTransitMeasureDeferPass = READER_SEAM_TRANSIT_MEASURE_DEFER_PASS;
  v.lastSeamTransitMeasureDefer = {
    pass: READER_SEAM_TRANSIT_MEASURE_DEFER_PASS,
    ...(payload || {}),
    at: Date.now()
  };
  return v.lastSeamTransitMeasureDefer;
}

function flushRenderedMeasureCacheForSettle(app, v, content, context = {}) {
  if (!content || !v || v.pendingScrollTarget) return { changed: false, reason: 'unavailable' };
  const now = Date.now();
  const state = resolveNativeScrollTransitionState(v, now);
  const force = context?.force === true;
  const seamTransitLock = resolveNativeForwardSeamTransitLock(v, { phase: context?.phase || 'measure-flush' }, now);
  if (!force && seamTransitLock.locked) {
    return recordSeamTransitMeasureDefer(v, {
      changed: false,
      reason: 'native forward seam transit defers visible measurement flush',
      phase: String(context?.phase || ''),
      active: state.active,
      appendWindow: state.appendWindow,
      recentUserScroll: state.recentUserScroll,
      settledForMs: state.settledForMs,
      seamTransitLock: true,
      seamTransitLockPass: seamTransitLock.pass || '',
      remainingMs: Math.round(Number(seamTransitLock.remainingMs) || 0),
      renderedStart: Number.isFinite(Number(v.renderedStart)) ? Number(v.renderedStart) : -1,
      renderedEnd: Number.isFinite(Number(v.renderedEnd)) ? Number(v.renderedEnd) : -1
    });
  }
  const shouldFlush = force || v.activeRenderWindowIdleCompacting || state.appendWindow || (state.userScrollSource && state.activeUntil > 0 && state.settledForMs !== null && state.settledForMs <= VIRTUAL_SETTLED_MEASURE_FLUSH_GRACE_MS);
  if (!shouldFlush) return { changed: false, reason: 'outside settle window' };
  const updates = collectVirtualMeasureUpdates(app);
  let changed = false;
  if (updates instanceof Map && updates.size) {
    for (const [id, measured] of updates.entries()) {
      const old = v.measureCache.get(id);
      if (!Number.isFinite(old) || Math.abs(old - measured) > HEIGHT_EPSILON) {
        v.measureCache.set(id, measured);
        changed = true;
      }
    }
    if (changed) recalcVirtualLayout(app);
  }
  const result = {
    pass: READER_SETTLED_MEASURE_FLUSH_PASS,
    changed,
    reason: changed ? 'visible rows measured before settle render' : 'visible measurements already current',
    updates: updates instanceof Map ? updates.size : 0,
    phase: String(context?.phase || ''),
    active: state.active,
    appendWindow: state.appendWindow,
    recentUserScroll: state.recentUserScroll,
    settledForMs: state.settledForMs,
    renderedStart: Number.isFinite(Number(v.renderedStart)) ? Number(v.renderedStart) : -1,
    renderedEnd: Number.isFinite(Number(v.renderedEnd)) ? Number(v.renderedEnd) : -1
  };
  v.settledMeasureFlushPass = READER_SETTLED_MEASURE_FLUSH_PASS;
  v.lastSettledMeasureFlush = { ...result, at: Date.now() };
  return result;
}

function scheduleIdleMeasure(app) {
  const v = ensureVirtualState(app);
  window.clearTimeout(v.measureIdleTimer || 0);
  const delay = Math.max(VIRTUAL_MEASURE_IDLE_GRACE_MS, (Number(v.userScrollActiveUntil) || 0) - Date.now() + VIRTUAL_MEASURE_IDLE_GRACE_MS);
  v.measureDeferralCount = (Number(v.measureDeferralCount) || 0) + 1;
  v.measureIdleTimer = window.setTimeout(() => {
    v.measureIdleTimer = 0;
    scheduleMeasure(app);
  }, delay);
}


export function scheduleVirtualRender(app) {
  const v = ensureVirtualState(app);
  if (v.renderRaf) return;
  v.renderRaf = window.requestAnimationFrame(() => {
    v.renderRaf = 0;
    renderVirtual(app);
  });
}

export function renderVirtual(app, { force = false } = {}) {
  const reader = app.els.reader;
  const content = app.els.content;
  if (!reader || !content) return;
  const v = recalcVirtualLayout(app);
  content.classList.add('reader-virtual-content');
  if (!v.rows.length) {
    const nodes = [];
    if (app.els.chunkLoading) nodes.push(app.els.chunkLoading);
    content.replaceChildren(...nodes);
    return;
  }

  flushRenderedMeasureCacheForSettle(app, v, content, { phase: force ? 'force-render' : 'render-before-range' });
  const currentScrollTop = Math.max(0, Number(reader.scrollTop) || 0);
  const previousRenderScrollTop = Number.isFinite(Number(v.lastRenderScrollTop)) ? Number(v.lastRenderScrollTop) : currentScrollTop;
  v.lastRenderScrollTop = currentScrollTop;
  const previousStart = Number.isFinite(Number(v.renderedStart)) ? Number(v.renderedStart) : -1;
  const previousEnd = Number.isFinite(Number(v.renderedEnd)) ? Number(v.renderedEnd) : -1;
  const episodeBottomAnchor = captureEpisodeBottomAnchor(app, { phase: 'render-capture', force });
  const renderAnchor = episodeBottomAnchor ? null : captureRenderWindowAnchor(app, v, reader, { force });
  if (!force && canReuseRenderedWindow(v, reader)) {
    const syncResult = syncRenderedVirtualSpacers(app, v, content);
    if (syncResult.changed && episodeBottomAnchor) {
      restoreEpisodeBottomAnchor(app, episodeBottomAnchor, 'spacer-sync');
      scheduleEpisodeBottomAnchorRecheck(app, episodeBottomAnchor, 'spacer-sync-raf');
    } else if (renderAnchor && syncResult.changed) {
      restoreRenderWindowAnchor(app, renderAnchor, 'spacer-sync');
      scheduleRenderWindowAnchorRecheck(app, renderAnchor, 'spacer-sync-raf');
    }
    return;
  }

  const overscanPx = getVirtualOverscanPx(app, reader);
  const viewportTop = Math.max(0, currentScrollTop - overscanPx);
  const viewportBottom = currentScrollTop + reader.clientHeight + overscanPx;
  const naturalRange = findVisibleRange(v, viewportTop, viewportBottom);
  const transitionState = resolveNativeScrollTransitionState(v);
  const seamRenderLock = resolveNativeForwardSeamTransitLock(v, { phase: 'render-range', anchorType: 'render-window' });
  const activeWindowMaxRows = seamRenderLock.locked
    ? VIRTUAL_NATIVE_FORWARD_SEAM_RENDER_HOLD_MAX_ROWS
    : (transitionState.active || transitionState.appendWindow || transitionState.recentUserScroll)
      ? VIRTUAL_ACTIVE_RETAIN_LEADING_MAX_ROWS
      : VIRTUAL_ACTIVE_RENDER_WINDOW_MAX_ROWS;
  const stableRange = resolveStableVirtualRenderRange({
    force,
    active: isVirtualScrollActive(v) || seamRenderLock.locked,
    naturalStart: naturalRange.start,
    naturalEnd: naturalRange.end,
    renderedStart: v.renderedStart,
    renderedEnd: v.renderedEnd,
    rowCount: v.rows.length,
    maxRows: activeWindowMaxRows,
    scrollTop: currentScrollTop,
    previousScrollTop: previousRenderScrollTop
  });
  const leadingRetain = resolveActiveLeadingRetain(v, { previousStart, previousEnd, start: stableRange.start, end: stableRange.end, rowCount: v.rows.length });
  let { start, end } = stableRange;
  if (leadingRetain?.retain) {
    start = leadingRetain.start;
    end = leadingRetain.end;
  }
  const seamRenderHold = resolveNativeForwardSeamRenderHold(v, {
    phase: 'render-range',
    anchorType: 'render-window',
    previousStart,
    previousEnd,
    requestedStart: start,
    requestedEnd: end,
    rowCount: v.rows.length
  });
  if (seamRenderHold?.hold) {
    start = seamRenderHold.start;
    end = seamRenderHold.end;
  }
  v.activeRenderWindowPinPass = READER_ACTIVE_RENDER_WINDOW_PIN_PASS;
  v.lastActiveRenderWindowPin = {
    ...stableRange,
    scrollTop: Math.round(currentScrollTop),
    previousScrollTop: Math.round(previousRenderScrollTop),
    activeUntil: Number(v.userScrollActiveUntil) || 0,
    requestedStart: stableRange.start,
    requestedEnd: stableRange.end,
    leadingRetainPass: leadingRetain?.pass || '',
    leadingRetained: !!leadingRetain?.retain,
    leadingRetainedRows: Math.round(Number(leadingRetain?.retainedRows) || 0),
    activeWindowMaxRows,
    seamRenderLockPass: seamRenderLock?.pass || '',
    seamRenderLocked: !!seamRenderLock?.locked,
    seamRenderHoldPass: seamRenderHold?.pass || '',
    seamRenderHeld: !!seamRenderHold?.hold,
    seamRenderHeldRows: Math.round(Number(seamRenderHold?.retainedRows) || 0)
  };
  if (stableRange.pinned || leadingRetain?.retain) scheduleActiveRenderWindowIdleCompaction(app);
  if (!force && start === v.renderedStart && end === v.renderedEnd) return;
  const topHeight = v.prefix[start] || 0;
  const bottomHeight = Math.max(0, v.totalHeight - (v.prefix[end] || 0));
  const stats = v.rowElementPoolStats || createRowElementPoolStats();
  stats.lastRenderReused = 0;
  stats.lastRenderCreated = 0;
  stats.lastRenderUpdated = 0;
  v.rowElementPoolStats = stats;

  const patched = !force && (isVirtualScrollActive(v) || seamRenderLock.locked) && patchActiveVirtualRenderWindow(app, v, content, {
    previousStart,
    previousEnd,
    start,
    end,
    topHeight,
    bottomHeight
  });
  v.renderedStart = start;
  v.renderedEnd = end;

  if (!patched) {
    const fragment = document.createDocumentFragment();
    fragment.append(createEl('div', { class:'reader-virtual-spacer reader-virtual-top', style:`height:${Math.max(0, Math.round(topHeight))}px` }));
    for (let i = start; i < end; i += 1) fragment.append(getPooledVirtualRow(app, v.rows[i]));
    fragment.append(createEl('div', { class:'reader-virtual-spacer reader-virtual-bottom', style:`height:${Math.max(0, Math.round(bottomHeight))}px` }));
    if (app.els.chunkLoading) fragment.append(app.els.chunkLoading);
    content.replaceChildren(fragment);
    recordActiveRenderPatch(v, {
      applied: false,
      reason: 'full replace',
      active: isVirtualScrollActive(v),
      previousStart,
      previousEnd,
      start,
      end,
      rows: Math.max(0, end - start)
    });
  }
  if (episodeBottomAnchor) {
    restoreEpisodeBottomAnchor(app, episodeBottomAnchor, patched ? 'window-patch-bottom' : 'window-replace-bottom');
    scheduleEpisodeBottomAnchorRecheck(app, episodeBottomAnchor, patched ? 'window-patch-bottom-raf' : 'window-replace-bottom-raf');
  } else if (renderAnchor) {
    const patchAnchorGate = patched ? resolveScrollBufferPatchAnchorGate(v) : null;
    const shouldRestore = !patched || !!patchAnchorGate?.allowed;
    if (shouldRestore) {
      const phase = patched ? 'window-patch' : 'window-replace';
      const result = restoreRenderWindowAnchor(app, renderAnchor, phase);
      if (patched) recordScrollBufferPatchAnchor(v, { ...(patchAnchorGate || {}), result });
      scheduleRenderWindowAnchorRecheck(app, renderAnchor, patched ? 'window-patch-raf' : 'window-replace-raf');
    } else if (patched) {
      recordScrollBufferPatchAnchor(v, { ...(patchAnchorGate || {}), result: { applied: false, reason: 'patch anchor gate blocked' } });
    }
  }
  scheduleMeasure(app);
  scheduleResolvePendingTarget(app);
}



function patchActiveVirtualRenderWindow(app, v, content, range = {}) {
  const previousStart = Math.round(Number(range.previousStart));
  const previousEnd = Math.round(Number(range.previousEnd));
  const start = Math.round(Number(range.start));
  const end = Math.round(Number(range.end));
  if (!content || !Array.isArray(v?.rows)) return recordActiveRenderPatch(v, { applied: false, reason: 'unavailable' });
  if (previousStart < 0 || previousEnd <= previousStart || start < 0 || end <= start) {
    return recordActiveRenderPatch(v, { applied: false, reason: 'invalid range', previousStart, previousEnd, start, end });
  }
  const overlaps = start < previousEnd && end > previousStart;
  if (!overlaps) return recordActiveRenderPatch(v, { applied: false, reason: 'non-overlap', previousStart, previousEnd, start, end });
  const seamRenderHold = resolveNativeForwardSeamRenderHold(v, {
    phase: 'active-render-window-patch',
    anchorType: 'render-window',
    previousStart,
    previousEnd,
    requestedStart: start,
    requestedEnd: end,
    rowCount: Array.isArray(v.rows) ? v.rows.length : 0
  });
  if (seamRenderHold.locked && start > previousStart) {
    return recordActiveRenderPatch(v, {
      applied: false,
      reason: 'native forward seam render hold blocks front row removal during inertia',
      previousStart,
      previousEnd,
      start,
      end,
      seamRenderHoldPass: seamRenderHold.pass || '',
      seamRenderHoldReason: seamRenderHold.reason || ''
    });
  }
  const frontAdds = Math.max(0, previousStart - start);
  const backAdds = Math.max(0, end - previousEnd);
  const frontRemoves = Math.max(0, start - previousStart);
  const backRemoves = Math.max(0, previousEnd - end);
  const edgeWork = frontAdds + backAdds + frontRemoves + backRemoves;
  if (edgeWork > VIRTUAL_ACTIVE_RENDER_PATCH_MAX_EDGE_ROWS) {
    return recordActiveRenderPatch(v, { applied: false, reason: 'edge work too large', previousStart, previousEnd, start, end, edgeWork });
  }
  const top = content.querySelector?.('.reader-virtual-top') || null;
  const bottom = content.querySelector?.('.reader-virtual-bottom') || null;
  if (!top || !bottom || top.parentNode !== content || bottom.parentNode !== content) {
    return recordActiveRenderPatch(v, { applied: false, reason: 'spacers missing', previousStart, previousEnd, start, end });
  }
  const currentRows = () => Array.from(content.children || []).filter(node => node?.classList?.contains('reader-vrow'));
  const initialDomRows = currentRows().length;
  if (initialDomRows !== Math.max(0, previousEnd - previousStart)) {
    return recordActiveRenderPatch(v, { applied: false, reason: 'row count mismatch', previousStart, previousEnd, start, end, domRows: initialDomRows });
  }

  for (let i = 0; i < frontRemoves; i += 1) {
    const first = currentRows()[0];
    if (first) first.remove();
  }
  for (let i = 0; i < backRemoves; i += 1) {
    const rows = currentRows();
    const last = rows[rows.length - 1];
    if (last) last.remove();
  }
  if (frontAdds) {
    const fragment = document.createDocumentFragment();
    for (let i = start; i < previousStart; i += 1) fragment.append(getPooledVirtualRow(app, v.rows[i]));
    content.insertBefore(fragment, currentRows()[0] || bottom);
  }
  if (backAdds) {
    const fragment = document.createDocumentFragment();
    for (let i = previousEnd; i < end; i += 1) fragment.append(getPooledVirtualRow(app, v.rows[i]));
    content.insertBefore(fragment, bottom);
  }
  if (!seamRenderHold.locked) {
    top.style.height = `${Math.max(0, Math.round(Number(range.topHeight) || 0))}px`;
  }
  const nextBottomHeight = seamRenderHold.locked
    ? Math.max(Math.round(parseFloat(String(bottom.style.height || '0')) || 0), Math.round(Number(range.bottomHeight) || 0))
    : Math.max(0, Math.round(Number(range.bottomHeight) || 0));
  bottom.style.height = `${Math.max(0, nextBottomHeight)}px`;
  if (app.els.chunkLoading && app.els.chunkLoading.parentNode !== content) content.append(app.els.chunkLoading);
  return recordActiveRenderPatch(v, {
    applied: true,
    reason: 'active overlap patch',
    previousStart,
    previousEnd,
    start,
    end,
    frontAdds,
    backAdds,
    frontRemoves,
    backRemoves,
    edgeWork,
    rows: Math.max(0, end - start),
    seamRenderHoldPass: seamRenderHold?.pass || '',
    seamRenderHold: !!seamRenderHold?.locked,
    seamRenderHoldReason: seamRenderHold?.reason || ''
  });
}

function recordActiveRenderPatch(v, payload = {}) {
  if (!v) return false;
  const applied = !!payload.applied;
  v.activeRenderPatchPass = READER_ACTIVE_RENDER_PATCH_PASS;
  v.lastActiveRenderPatch = {
    pass: READER_ACTIVE_RENDER_PATCH_PASS,
    ...payload,
    applied,
    at: Date.now()
  };
  return applied;
}


function captureRenderWindowAnchor(app, v, reader, { force = false } = {}) {
  if (force || v.pendingScrollTarget) return null;
  const active = isVirtualScrollActive(v);
  const seamTransitLock = resolveNativeForwardSeamTransitLock(v, { phase: 'render-window-capture', anchorType: 'render-window' });
  if (seamTransitLock.locked) return null;
  const nativeForwardRetain = resolveNativeForwardScrollRetain(v, { phase: 'render-window-capture', anchorType: 'render-window' });
  if (nativeForwardRetain.retain) return null;
  const settleExactRenderAnchor = resolveScrollSettleExactAnchorRestore(app, v, { phase: 'render-window-capture', anchorType: 'render-window' });
  const nativeFreeze = shouldFreezeNativeSettledScroll(app, { reason: 'render-window-capture', anchorType: 'render-window' });
  if (nativeFreeze && !settleExactRenderAnchor.restore) return null;
  if (v.activeRenderWindowIdleCompacting) {
    recordScrollSettleCompaction(v, {
      skippedAnchor: !settleExactRenderAnchor.restore,
      reason: settleExactRenderAnchor.restore
        ? 'idle compaction captures exact native-settle anchor'
        : 'idle compaction keeps native scrollTop',
      active,
      scrollSettleExactAnchorRestore: !!settleExactRenderAnchor.restore,
      scrollTop: Math.round(Number(reader?.scrollTop) || 0),
      renderedStart: Number.isFinite(Number(v.renderedStart)) ? Number(v.renderedStart) : -1,
      renderedEnd: Number.isFinite(Number(v.renderedEnd)) ? Number(v.renderedEnd) : -1
    });
    if (!settleExactRenderAnchor.restore) return null;
  }
  const exactNativeAnchor = shouldCaptureExactNativeAnchor(app, v) || !!settleExactRenderAnchor.restore;
  recordMultiFileNativeExactAnchor(v, {
    ...resolveMultiFileNativeExactAnchorState(app, v),
    phase: 'render-window-capture',
    active: exactNativeAnchor,
    preferBodyRows: !exactNativeAnchor,
    source: String(v.lastUserScrollSource || '')
  });
  const anchor = traceCapturedAnchor(app, v, reader, 'render-window-capture', captureVirtualRenderWindowAnchor({
    reader,
    rows: v.rows,
    prefix: v.prefix,
    pendingScrollTarget: v.pendingScrollTarget,
    active: active || !!settleExactRenderAnchor.restore,
    anchorOffsetPx: VIRTUAL_SCROLL_STABILITY_ANCHOR_OFFSET_PX,
    preferBodyRows: !exactNativeAnchor
  }), { anchorType: 'render-window' });
  if (anchor && settleExactRenderAnchor.restore) {
    anchor.scrollSettleExactAnchorRestorePass = READER_SCROLL_SETTLE_EXACT_ANCHOR_RESTORE_PASS;
    recordScrollSettleExactAnchorRestore(v, {
      ...settleExactRenderAnchor,
      captured: true,
      rowId: anchor.rowId || '',
      rowIndex: Number.isFinite(Number(anchor.rowIndex)) ? Number(anchor.rowIndex) : -1
    });
  }
  return anchor;
}

function recordScrollSettleCompaction(v, payload = {}) {
  if (!v) return;
  v.scrollSettleCompactionPass = READER_SCROLL_SETTLE_COMPACTION_PASS;
  v.lastScrollSettleCompaction = {
    pass: READER_SCROLL_SETTLE_COMPACTION_PASS,
    ...payload,
    at: Date.now()
  };
}

function restoreRenderWindowAnchor(app, anchor, phase = 'post-render') {
  if (!anchor) return null;
  const reader = app?.els?.reader || null;
  const v = recalcVirtualLayout(app);
  if (!reader || v.pendingScrollTarget) return null;
  const seamTransitLock = resolveNativeForwardSeamTransitLock(v, { phase: `render-window-${phase}`, anchorType: 'render-window' });
  if (seamTransitLock.locked) {
    const result = { applied: false, reason: seamTransitLock.reason, phase, renderWindowAnchorPass: READER_RENDER_WINDOW_ANCHOR_PASS, suppressedBy: READER_NATIVE_FORWARD_SEAM_TRANSIT_LOCK_PASS, rowId: anchor?.rowId || '', rowIndex: Number(anchor?.rowIndex) || -1, deltaPx: 0 };
    v.renderWindowAnchorPass = READER_RENDER_WINDOW_ANCHOR_PASS;
    v.activeForwardRenderAnchorSuppressPass = READER_ACTIVE_FORWARD_RENDER_ANCHOR_SUPPRESS_PASS;
    v.lastRenderWindowStability = result;
    return result;
  }
  const nativeForwardRetain = resolveNativeForwardScrollRetain(v, { phase: `render-window-${phase}`, anchorType: 'render-window' });
  if (nativeForwardRetain.retain) {
    const result = { applied: false, reason: nativeForwardRetain.reason, phase, renderWindowAnchorPass: READER_RENDER_WINDOW_ANCHOR_PASS, suppressedBy: READER_ACTIVE_FORWARD_RENDER_ANCHOR_SUPPRESS_PASS, rowId: anchor?.rowId || '', rowIndex: Number(anchor?.rowIndex) || -1, deltaPx: 0 };
    v.renderWindowAnchorPass = READER_RENDER_WINDOW_ANCHOR_PASS;
    v.activeForwardRenderAnchorSuppressPass = READER_ACTIVE_FORWARD_RENDER_ANCHOR_SUPPRESS_PASS;
    v.lastRenderWindowStability = result;
    return result;
  }
  const settleExactRestoreAnchor = anchor?.scrollSettleExactAnchorRestorePass === READER_SCROLL_SETTLE_EXACT_ANCHOR_RESTORE_PASS;
  if (shouldFreezeNativeSettledScroll(app, { reason: `render-window-${phase}`, anchorType: 'render-window' }) && !settleExactRestoreAnchor) {
    return recordSuppressedScrollStability(v, { phase, anchorType: 'render-window', rowId: anchor?.rowId || '', rowIndex: anchor?.rowIndex });
  }
  if (settleExactRestoreAnchor) {
    recordScrollSettleExactAnchorRestore(v, {
      phase: `render-window-${phase}`,
      anchorType: 'render-window',
      restore: true,
      reason: 'render window restore bypasses native-settle freeze for exact anchor',
      rowId: anchor?.rowId || '',
      rowIndex: Number.isFinite(Number(anchor?.rowIndex)) ? Number(anchor.rowIndex) : -1
    });
  }
  const correctionGuard = resolveAppendCorrectionGuard(app, anchor, { phase, anchorType: 'render-window' });
  const microDamp = correctionGuard?.suppress ? null : resolveAppendMicroCorrectionDamp(app, v, reader, anchor, { phase, anchorType: 'render-window' });
  const upwardGuard = correctionGuard?.suppress || microDamp?.suppress ? null : resolveAppendUpwardCorrectionGuard(app, v, reader, anchor, { phase, anchorType: 'render-window' });
  const result = correctionGuard?.suppress
    ? { applied: false, reason: correctionGuard.reason, phase, renderWindowAnchorPass: READER_RENDER_WINDOW_ANCHOR_PASS, rowId: correctionGuard.rowId || '', rowIndex: Number(correctionGuard.rowIndex) || -1, deltaPx: Number(correctionGuard.deltaPx) || 0, suppressedBy: READER_APPEND_CORRECTION_GUARD_PASS }
    : microDamp?.suppress
      ? { applied: false, reason: microDamp.reason, phase, renderWindowAnchorPass: READER_RENDER_WINDOW_ANCHOR_PASS, rowId: microDamp.rowId || '', rowIndex: Number(microDamp.rowIndex) || -1, deltaPx: Number(microDamp.deltaPx) || 0, suppressedBy: READER_APPEND_MICRO_CORRECTION_DAMP_PASS }
      : upwardGuard?.suppress
        ? { applied: false, reason: upwardGuard.reason, phase, renderWindowAnchorPass: READER_RENDER_WINDOW_ANCHOR_PASS, rowId: upwardGuard.rowId || '', rowIndex: Number(upwardGuard.rowIndex) || -1, deltaPx: Number(upwardGuard.deltaPx) || 0, suppressedBy: READER_APPEND_UPWARD_CORRECTION_GUARD_PASS }
        : applyVirtualScrollAnchorWithInertiaGuard(app, v, reader, anchor, { phase, anchorType: 'render-window' });
  traceAnchorResult(app, v, reader, `render-window-${phase}`, anchor, result, { anchorType: 'render-window', bodyAnchorAdjusted: !!anchor?.bodyAnchorAdjusted });
  v.renderWindowAnchorPass = READER_RENDER_WINDOW_ANCHOR_PASS;
  v.lastRenderWindowStability = result;
  if (result?.applied) v.lastScrollStability = result;
  return result;
}

function scheduleRenderWindowAnchorRecheck(app, anchor, phase = 'post-render-raf') {
  const v = ensureVirtualState(app);
  if (!anchor || v.renderWindowAnchorRecheckRaf) return;
  v.renderWindowAnchorRecheckRaf = window.requestAnimationFrame(() => {
    v.renderWindowAnchorRecheckRaf = 0;
    restoreRenderWindowAnchor(app, anchor, phase);
  });
}

function syncRenderedVirtualSpacers(app, v, content) {
  const topHeight = v.renderedStart >= 0 ? v.prefix[v.renderedStart] || 0 : 0;
  const bottomHeight = v.renderedEnd >= 0 ? Math.max(0, v.totalHeight - (v.prefix[v.renderedEnd] || 0)) : 0;
  const seamRenderHold = resolveNativeForwardSeamRenderHold(v, {
    phase: 'spacer-sync-rendered-window',
    anchorType: 'render-window',
    previousStart: v.renderedStart,
    previousEnd: v.renderedEnd,
    requestedStart: v.renderedStart,
    requestedEnd: v.renderedEnd,
    rowCount: Array.isArray(v.rows) ? v.rows.length : 0
  });
  let result = null;
  if (seamRenderHold.locked) {
    const bottom = content?.querySelector?.('.reader-virtual-bottom') || null;
    const currentBottom = Math.max(0, Math.round(parseFloat(String(bottom?.style?.height || '0')) || 0));
    const nextBottom = `${Math.max(currentBottom, Math.round(bottomHeight))}px`;
    const bottomChanged = !!bottom && bottom.style.height !== nextBottom;
    if (bottomChanged) bottom.style.height = nextBottom;
    result = {
      changed: bottomChanged,
      topChanged: false,
      bottomChanged,
      pass: READER_NATIVE_FORWARD_SEAM_RENDER_HOLD_PASS,
      reason: 'native forward seam render hold preserves top spacer and grows bottom spacer only',
      seamRenderHold: true,
      currentBottom,
      bottomHeight: Math.round(bottomHeight)
    };
  } else {
    result = syncVirtualSpacerHeights(content, { topHeight, bottomHeight });
  }
  if (result.changed) {
    v.lastRenderReuse = {
      ...(v.lastRenderReuse || {}),
      spacerSync: result,
      topHeight: Math.round(topHeight),
      bottomHeight: Math.round(bottomHeight)
    };
  }
  return result;
}

function canReuseRenderedWindow(v, reader) {
  if (!reader || !Array.isArray(v?.prefix) || v.renderedStart < 0 || v.renderedEnd <= v.renderedStart) return false;
  const scrollTop = Math.max(0, Number(reader.scrollTop) || 0);
  const viewport = Math.max(1, Number(reader.clientHeight) || 0);
  const renderedTop = Math.max(0, Number(v.prefix[v.renderedStart]) || 0);
  const renderedBottom = Math.max(renderedTop, Number(v.prefix[v.renderedEnd]) || 0);
  const margin = Math.max(VIRTUAL_RENDER_REUSE_MARGIN_MIN_PX, Math.round(viewport * VIRTUAL_RENDER_REUSE_MARGIN_VIEWPORT_MULTIPLIER));
  const requiredTop = Math.max(0, scrollTop - margin);
  const requiredBottom = scrollTop + viewport + margin;
  const reusable = renderedTop <= requiredTop && renderedBottom >= requiredBottom;
  if (reusable) {
    v.renderReuseCount = (Number(v.renderReuseCount) || 0) + 1;
    v.lastRenderReuse = {
      reused: true,
      margin,
      scrollTop: Math.round(scrollTop),
      renderedStart: v.renderedStart,
      renderedEnd: v.renderedEnd
    };
  }
  return reusable;
}


function scheduleActiveRenderWindowIdleCompaction(app) {
  const v = ensureVirtualState(app);
  window.clearTimeout(v.activeRenderWindowIdleTimer || 0);
  const delay = Math.max(
    VIRTUAL_ACTIVE_RENDER_IDLE_COMPACT_GRACE_MS,
    (Number(v.userScrollActiveUntil) || 0) - Date.now() + VIRTUAL_ACTIVE_RENDER_IDLE_COMPACT_GRACE_MS
  );
  v.activeRenderWindowIdleTimer = window.setTimeout(() => {
    v.activeRenderWindowIdleTimer = 0;
    v.activeRenderWindowIdleCompacting = true;
    try {
      renderVirtual(app, { force: false });
    } finally {
      v.activeRenderWindowIdleCompacting = false;
    }
  }, delay);
}

function getVirtualOverscanPx(app, reader) {
  const viewport = Math.max(1, Number(reader?.clientHeight) || 0);
  const v = ensureVirtualState(app);
  const velocity = Math.max(0, Number(v.lastScrollBufferVelocityPxMs) || 0);
  const boost = clamp(Math.round(velocity * 1500), 0, VIRTUAL_OVERSCAN_VELOCITY_BOOST_MAX_PX);
  const value = clamp(Math.round(viewport * VIRTUAL_OVERSCAN_VIEWPORT_MULTIPLIER) + boost, VIRTUAL_OVERSCAN_MIN_PX, VIRTUAL_OVERSCAN_MAX_PX + VIRTUAL_OVERSCAN_VELOCITY_BOOST_MAX_PX);
  const stats = v.velocityBufferStats || createVelocityBufferStats();
  stats.lastVelocityPxMs = Math.round(velocity * 1000) / 1000;
  stats.lastOverscanPx = value;
  if (velocity >= VIRTUAL_SCROLL_FAST_SPEED_PX_PER_MS) stats.fastFrames += 1;
  if (velocity >= VIRTUAL_SCROLL_VERY_FAST_SPEED_PX_PER_MS) stats.veryFastFrames += 1;
  v.velocityBufferStats = stats;
  v.velocityBufferPass = READER_VELOCITY_BUFFER_PASS;
  return value;
}

function findVisibleRange(v, top, bottom) {
  if (!v.rows.length) return { start: 0, end: 0 };
  const start = findStartIndex(v, top);
  const endByViewport = upperBound(v.prefix, bottom, start, v.rows.length);
  const end = Math.max(start + 1, Math.min(v.rows.length, endByViewport, start + MAX_RENDERED_ROWS));
  return { start, end };
}

function findStartIndex(v, top) {
  let lo = 0;
  let hi = v.rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((v.prefix[mid + 1] || 0) < top) lo = mid + 1;
    else hi = mid;
  }
  return Math.max(0, Math.min(v.rows.length - 1, lo));
}

function upperBound(values, target, min = 0, max = values.length - 1) {
  let lo = Math.max(0, min);
  let hi = Math.max(lo, Math.min(values.length - 1, max));
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((values[mid] || 0) <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function rebuildVirtualRowIndexes(v) {
  v.rowIndexById = new Map();
  v.rowIndexByGlobalBlock = new Map();
  v.rowIndexByChunkBlock = new Map();
  v.rowIndexesByChunk = new Map();
  (v.rows || []).forEach((row, index) => {
    if (row?.id) v.rowIndexById.set(row.id, index);
    const chunk = Number(row?.chunk);
    if (Number.isFinite(chunk)) {
      if (!v.rowIndexesByChunk.has(chunk)) v.rowIndexesByChunk.set(chunk, []);
      v.rowIndexesByChunk.get(chunk).push(index);
    }
    if (row?.type === 'body') {
      const globalBlock = Number(row.globalBlockIndex);
      if (Number.isFinite(globalBlock) && globalBlock >= 0) v.rowIndexByGlobalBlock.set(globalBlock, index);
      const block = Number(row.blockIndex);
      if (Number.isFinite(chunk) && Number.isFinite(block) && block >= 0) v.rowIndexByChunkBlock.set(`${chunk}:${block}`, index);
    }
  });
}

function getPooledVirtualRow(app, row) {
  const v = ensureVirtualState(app);
  if (!(v.rowElementPool instanceof Map)) v.rowElementPool = new Map();
  const stats = v.rowElementPoolStats || createRowElementPoolStats();
  v.rowElementPoolStats = stats;
  const id = row?.id || '';
  if (!id) {
    stats.created += 1;
    stats.lastRenderCreated += 1;
    return renderVirtualRow(app, row);
  }
  const signature = buildVirtualRowDomSignature({ app, row, rowDomPoolPass: READER_ROW_DOM_POOL_PASS });
  const cached = v.rowElementPool.get(id);
  if (cached?.el && cached.signature === signature) {
    cached.lastUsed = ++v.rowElementPoolClock;
    stats.reused += 1;
    stats.lastRenderReused += 1;
    return cached.el;
  }
  const el = renderVirtualRow(app, row);
  v.rowElementPool.set(id, { el, signature, lastUsed: ++v.rowElementPoolClock });
  if (cached?.el) {
    stats.updated += 1;
    stats.lastRenderUpdated += 1;
  } else {
    stats.created += 1;
    stats.lastRenderCreated += 1;
  }
  pruneVirtualRowElementPool(app);
  return el;
}

function renderVirtualRow(app, row) {
  if (row.type === 'header') {
    const title = String(row.title || '').trim();
    const className = title ? 'reader-vrow reader-vrow-header' : 'reader-vrow reader-vrow-header reader-vrow-header-empty';
    return createEl('section', { class:className, dataset:{ virtualId: row.id, chunk: row.chunk } }, title ? [
      createEl('h2', { text: title })
    ] : []);
  }
  const body = renderBodyHtml(app, row);
  return createEl('section', { class:'reader-vrow reader-vrow-body', dataset:{ virtualId: row.id, chunk: row.chunk, block: row.blockIndex, globalBlock: row.globalBlockIndex ?? '' } }, [
    createEl('div', { class:'reader-block-text', safeHtml: body || '(빈 블록)' })
  ]);
}

function renderBodyHtml(app, row) {
  const h = app.state.search?.highlights || null;
  const query = h && h.chunk === row.chunk ? h.query : '';
  if (!query) return escapeHtml(row.text || '');
  const targetIndex = Number.isFinite(Number(h.index)) ? Number(h.index) : null;
  const matchLength = Number(h.matchLength) || String(query).length;
  return highlightRowText(row.text || '', query, false, {
    absoluteTargetIndex: targetIndex,
    rowStart: Number(row.start) || 0,
    matchLength
  });
}

function highlightRowText(text, query, caseSensitive, options = {}) {
  const source = String(text ?? '');
  const needle = String(query ?? '');
  if (!needle) return escapeHtml(source);
  const haystack = caseSensitive ? source : source.toLowerCase();
  const target = caseSensitive ? needle : needle.toLowerCase();
  const localTarget = Number(options.absoluteTargetIndex) - Number(options.rowStart || 0);
  let pos = 0;
  let out = '';
  while (target) {
    const idx = haystack.indexOf(target, pos);
    if (idx < 0) break;
    out += escapeHtml(source.slice(pos, idx));
    const isTarget = Number.isFinite(localTarget) && idx === localTarget;
    const cls = isTarget ? `${SEARCH_MARK_CLASS} ${SEARCH_TARGET_CLASS}` : SEARCH_MARK_CLASS;
    const data = isTarget ? ` data-search-target="1" data-search-index="${escapeHtml(String(options.absoluteTargetIndex))}"` : '';
    out += `<mark class="${cls}"${data}>${escapeHtml(source.slice(idx, idx + needle.length))}</mark>`;
    pos = idx + needle.length;
  }
  out += escapeHtml(source.slice(pos));
  return out;
}

function getLoadedChunkNumbers(app) {
  return Array.from(app?.state?.loadedChunks?.keys?.() || []).map(Number).filter(Number.isFinite);
}

function resolveEpisodeBottomAnchorThreshold(reader, bounds = null) {
  const viewport = Math.max(1, Number(reader?.clientHeight) || 1);
  const chunkHeight = Math.max(1, Number(bounds?.height) || 1);
  const dynamic = Math.max(
    VIRTUAL_EPISODE_BOTTOM_ANCHOR_MIN_PX,
    viewport * VIRTUAL_EPISODE_BOTTOM_ANCHOR_VIEWPORT_MULTIPLIER,
    chunkHeight * VIRTUAL_EPISODE_BOTTOM_ANCHOR_CHUNK_RATIO
  );
  return Math.max(VIRTUAL_EPISODE_BOTTOM_ANCHOR_MIN_PX, Math.min(VIRTUAL_EPISODE_BOTTOM_ANCHOR_MAX_PX, dynamic));
}

function captureEpisodeBottomAnchor(app, options = {}) {
  const v = ensureVirtualState(app);
  const reader = app?.els?.reader || null;
  const current = app?.state?.current || null;
  if (!reader || !current || v.pendingScrollTarget || options?.force) return null;
  const totalChunks = Math.max(1, Number(current.totalChunks) || 1);
  const loadedChunks = getLoadedChunkNumbers(app);
  const maxLoadedChunk = loadedChunks.length ? Math.max(...loadedChunks) : Number(current.chunk) || 1;
  if (maxLoadedChunk < totalChunks) return null;
  const bounds = getChunkBounds(app, totalChunks);
  if (!bounds) return null;
  const scrollTop = Math.max(0, Number(reader.scrollTop) || 0);
  const clientHeight = Math.max(1, Number(reader.clientHeight) || 1);
  const scrollHeight = Math.max(0, Number(reader.scrollHeight) || 0);
  const maxTop = Math.max(0, scrollHeight - clientHeight);
  const viewportBottom = scrollTop + clientHeight;
  if (viewportBottom < bounds.top) return null;
  const remainingBottom = Math.max(0, maxTop - scrollTop);
  const virtualRemainingBottom = Math.max(0, (Number(bounds.bottom) || 0) - viewportBottom);
  const nativeBottomGuard = shouldCaptureExactNativeAnchor(app, v) && remainingBottom > 2;
  if (nativeBottomGuard) {
    recordMultiFileBottomAnchorNativeGuard(v, {
      phase: String(options?.phase || ''),
      suppressed: true,
      reason: 'multi-file native scroll has not reached actual bottom',
      remainingBottom: Math.round(remainingBottom),
      virtualRemainingBottom: Math.round(virtualRemainingBottom),
      source: String(v.lastUserScrollSource || '')
    });
    return null;
  }
  const thresholdPx = resolveEpisodeBottomAnchorThreshold(reader, bounds);
  const strictGate = resolveEpisodeBottomAnchorStrictGate(app, v, {
    phase: String(options?.phase || ''),
    remainingBottom,
    virtualRemainingBottom,
    thresholdPx,
    clientHeight,
    totalChunks,
    maxLoadedChunk,
    source: String(v.lastUserScrollSource || '')
  });
  if (!strictGate.allowed) return null;
  return {
    pass: READER_EPISODE_BOTTOM_ANCHOR_PASS,
    phase: String(options?.phase || ''),
    chunk: totalChunks,
    remainingBottom,
    virtualRemainingBottom,
    thresholdPx,
    scrollTop,
    scrollHeight,
    clientHeight,
    maxTop,
    chunkTop: Number(bounds.top) || 0,
    chunkBottom: Number(bounds.bottom) || 0,
    totalHeight: Number(v.totalHeight) || 0,
    at: Date.now()
  };
}

function resolveEpisodeBottomAnchorStrictGate(app, v, payload = {}) {
  const current = app?.state?.current || null;
  const clientHeight = Math.max(1, Number(payload.clientHeight) || Number(app?.els?.reader?.clientHeight) || 1);
  const remainingBottom = Math.max(0, Number(payload.remainingBottom) || 0);
  const virtualRemainingBottom = Math.max(0, Number(payload.virtualRemainingBottom) || 0);
  const legacyThresholdPx = Math.max(0, Number(payload.thresholdPx) || 0);
  const actualThresholdPx = Math.max(96, Math.min(640, Math.round(clientHeight * 0.35)));
  const virtualThresholdPx = Math.max(128, Math.min(900, Math.round(clientHeight * 0.5)));
  const legacyBottomZone = remainingBottom <= legacyThresholdPx || virtualRemainingBottom <= legacyThresholdPx;
  const strictBottomZone = remainingBottom <= actualThresholdPx && virtualRemainingBottom <= virtualThresholdPx;
  const allowed = legacyBottomZone && strictBottomZone;
  const result = {
    pass: READER_EPISODE_BOTTOM_ANCHOR_STRICT_GATE_PASS,
    allowed,
    reason: allowed
      ? 'actual and virtual bottom are both within strict bottom zone'
      : !legacyBottomZone
        ? 'outside legacy episode bottom anchor zone'
        : remainingBottom > actualThresholdPx
          ? 'actual DOM bottom is not close enough for bottom-distance restore'
          : 'virtual bottom is not close enough for bottom-distance restore',
    phase: String(payload.phase || ''),
    multiFile: !!(current?.novel?.isMultiFile && current?.episode),
    chunk: Math.max(1, Number(payload.maxLoadedChunk) || Number(current?.chunk) || 1),
    totalChunks: Math.max(1, Number(payload.totalChunks) || Number(current?.totalChunks) || 1),
    remainingBottom: Math.round(remainingBottom),
    virtualRemainingBottom: Math.round(virtualRemainingBottom),
    legacyThresholdPx: Math.round(legacyThresholdPx),
    actualThresholdPx,
    virtualThresholdPx,
    source: String(payload.source || ''),
    at: Date.now()
  };
  v.episodeBottomAnchorStrictGatePass = READER_EPISODE_BOTTOM_ANCHOR_STRICT_GATE_PASS;
  v.lastEpisodeBottomAnchorStrictGate = result;
  return result;
}

function restoreEpisodeBottomAnchor(app, anchor = null, phase = 'episode-bottom') {
  const v = ensureVirtualState(app);
  const reader = app?.els?.reader || null;
  if (!reader || !anchor || v.pendingScrollTarget) return recordEpisodeBottomAnchor(v, anchor, { applied: false, reason: 'unavailable or pending target', phase });
  const clientHeight = Math.max(1, Number(reader.clientHeight) || Number(anchor.clientHeight) || 1);
  const scrollHeight = Math.max(0, Number(reader.scrollHeight) || 0);
  const maxTop = Math.max(0, scrollHeight - clientHeight);
  const remainingBottom = Math.max(0, Number(anchor.remainingBottom) || 0);
  const targetTop = Math.max(0, Math.round(maxTop - remainingBottom));
  const currentTop = Math.max(0, Number(reader.scrollTop) || 0);
  const deltaPx = targetTop - currentTop;
  const applied = Number.isFinite(deltaPx) && Math.abs(deltaPx) >= 1;
  if (applied) reader.scrollTop = targetTop;
  return recordEpisodeBottomAnchor(v, anchor, {
    applied,
    reason: applied ? 'bottom distance restored' : 'below threshold',
    phase,
    targetTop,
    currentTop,
    deltaPx,
    currentScrollHeight: scrollHeight,
    currentClientHeight: clientHeight
  });
}

function recordEpisodeBottomAnchor(v, anchor = null, result = {}) {
  if (!v) return result;
  v.episodeBottomAnchorPass = READER_EPISODE_BOTTOM_ANCHOR_PASS;
  v.lastEpisodeBottomAnchor = {
    pass: READER_EPISODE_BOTTOM_ANCHOR_PASS,
    ...(anchor || {}),
    ...(result || {}),
    remainingBottom: Math.round(Number(anchor?.remainingBottom) || 0),
    virtualRemainingBottom: Math.round(Number(anchor?.virtualRemainingBottom) || 0),
    thresholdPx: Math.round(Number(anchor?.thresholdPx) || 0),
    targetTop: Math.round(Number(result?.targetTop) || 0),
    deltaPx: Math.round(Number(result?.deltaPx) || 0),
    at: Date.now()
  };
  return v.lastEpisodeBottomAnchor;
}

function scheduleEpisodeBottomAnchorRecheck(app, anchor = null, phase = 'episode-bottom-raf') {
  const v = ensureVirtualState(app);
  if (!anchor || v.episodeBottomAnchorRecheckRaf) return;
  v.episodeBottomAnchorRecheckRaf = window.requestAnimationFrame(() => {
    v.episodeBottomAnchorRecheckRaf = 0;
    restoreEpisodeBottomAnchor(app, anchor, phase);
  });
}

function scheduleMeasure(app) {
  const v = ensureVirtualState(app);
  if (v.measureRaf) return;
  v.measureRaf = window.requestAnimationFrame(() => {
    v.measureRaf = 0;
    if (!v.pendingScrollTarget && !v.pendingSliderMeasureTarget && isVirtualScrollActive(v)) {
      scheduleIdleMeasure(app);
      return;
    }
    const updates = collectVirtualMeasureUpdates(app);
    if (updates.size) {
      commitVirtualMeasureUpdates(app, updates);
    } else if (v.pendingSliderMeasureTarget) {
      clearPendingSliderMeasureTarget(app, { phase: 'measure-noop', reason: 'measure produced no changed row heights' });
    }
  });
}

function readCssPx(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : 0;
}

function measureVirtualRowOuterHeight(el) {
  if (!el) return 0;
  let rectHeight = 0;
  try { rectHeight = Number(el.getBoundingClientRect?.().height) || 0; } catch {}
  if (rectHeight <= 0) return 0;
  let marginTop = 0;
  let marginBottom = 0;
  try {
    const view = el.ownerDocument?.defaultView || globalThis?.window || null;
    const style = view?.getComputedStyle?.(el);
    marginTop = readCssPx(style?.marginTop);
    marginBottom = readCssPx(style?.marginBottom);
  } catch {}
  return Math.ceil(rectHeight + marginTop + marginBottom);
}

function collectVirtualMeasureUpdates(app) {
  const v = ensureVirtualState(app);
  const updates = new Map();
  let measuredRows = 0;
  let marginAdjustedRows = 0;
  let marginPxTotal = 0;
  app.els.content?.querySelectorAll('.reader-vrow[data-virtual-id]').forEach(el => {
    const id = el.dataset.virtualId;
    const measured = measureVirtualRowOuterHeight(el);
    if (!id || measured <= 0) return;
    measuredRows += 1;
    let rectHeight = 0;
    try { rectHeight = Math.ceil(Number(el.getBoundingClientRect?.().height) || 0); } catch {}
    const marginPx = Math.max(0, measured - rectHeight);
    if (marginPx > 0) {
      marginAdjustedRows += 1;
      marginPxTotal += marginPx;
    }
    const old = v.measureCache.get(id);
    if (!Number.isFinite(old) || Math.abs(old - measured) > HEIGHT_EPSILON) updates.set(id, measured);
  });
  v.rowMeasuredMarginHeightPass = READER_ROW_MEASURED_MARGIN_HEIGHT_PASS;
  v.lastRowMeasuredMarginHeight = {
    pass: READER_ROW_MEASURED_MARGIN_HEIGHT_PASS,
    measuredRows,
    marginAdjustedRows,
    marginPxTotal: Math.round(marginPxTotal),
    updates: updates.size,
    reason: 'virtual row measured heights include vertical margins so virtual totalHeight and DOM scrollHeight use the same row box basis',
    at: Date.now()
  };
  return updates;
}

function commitVirtualMeasureUpdates(app, updates) {
  const v = ensureVirtualState(app);
  if (!(updates instanceof Map) || !updates.size) return false;
  if (!v.pendingScrollTarget && !v.pendingSliderMeasureTarget && isVirtualScrollActive(v)) {
    scheduleIdleMeasure(app);
    return false;
  }
  const seamTransitLock = resolveNativeForwardSeamTransitLock(v, { phase: 'measure-commit', anchorType: 'measure' });
  if (!v.pendingScrollTarget && seamTransitLock.locked) {
    recordSeamTransitMeasureDefer(v, {
      changed: false,
      reason: 'native forward seam transit defers measure commit',
      phase: 'measure-commit',
      updates: updates.size,
      seamTransitLock: true,
      seamTransitLockPass: seamTransitLock.pass || '',
      remainingMs: Math.round(Number(seamTransitLock.remainingMs) || 0)
    });
    scheduleIdleMeasure(app);
    return false;
  }
  const reader = app.els.reader;
  const nativeFreezeRequested = shouldFreezeNativeSettledScroll(app, { reason: 'measure-commit', anchorType: 'measure' });
  const recentAppendAnchor = hasRecentAppendAnchorRestore(v);
  const recentPrependAnchor = hasRecentPrependAnchorRestore(v);
  const settleExactMeasureAnchor = resolveScrollSettleExactAnchorRestore(app, v, { phase: 'measure-commit', anchorType: 'measure' });
  const nativeForwardMeasureFreeze = resolveNativeForwardMeasureCommitFreeze(app, v, { phase: 'measure-commit', anchorType: 'measure', recentAppendAnchor, settleExactMeasureAnchorRestore: !!settleExactMeasureAnchor.restore });
  const nativeBackwardMeasureFreeze = resolveNativeBackwardMeasureCommitFreeze(app, v, { phase: 'measure-commit', anchorType: 'measure', recentPrependAnchor, settleExactMeasureAnchorRestore: !!settleExactMeasureAnchor.restore });
  const freezeNativeScroll = (nativeFreezeRequested && !recentAppendAnchor && !recentPrependAnchor && !settleExactMeasureAnchor.restore) || nativeForwardMeasureFreeze.freeze || nativeBackwardMeasureFreeze.freeze;
  if (nativeFreezeRequested && recentAppendAnchor && !nativeForwardMeasureFreeze.freeze) {
    recordAppendMeasureAnchorBypass(v, {
      reason: 'recent append anchor keeps measure correction enabled',
      graceMs: VIRTUAL_APPEND_MEASURE_ANCHOR_GRACE_MS,
      restoredAgoMs: Math.max(0, Date.now() - (Number(v.lastAppendAnchorRestoredAt) || 0))
    });
  }
  if (nativeFreezeRequested && settleExactMeasureAnchor.restore && !nativeForwardMeasureFreeze.freeze) {
    recordScrollSettleExactAnchorRestore(v, {
      ...settleExactMeasureAnchor,
      reason: 'measure commit uses exact native-settle anchor instead of frozen scrollTop'
    });
  }
  const episodeBottomAnchor = !v.pendingScrollTarget && !v.pendingSliderMeasureTarget && !nativeForwardMeasureFreeze.freeze && !nativeBackwardMeasureFreeze.freeze
    ? captureEpisodeBottomAnchor(app, { phase: 'measure-capture' })
    : null;
  const exactNativeMeasureAnchor = shouldCaptureExactNativeAnchor(app, v) || !!settleExactMeasureAnchor.restore;
  if (!episodeBottomAnchor && !freezeNativeScroll && !v.pendingScrollTarget && !v.pendingSliderMeasureTarget) {
    recordMultiFileNativeExactAnchor(v, {
      ...resolveMultiFileNativeExactAnchorState(app, v),
      phase: 'measure-capture',
      active: exactNativeMeasureAnchor,
      preferBodyRows: !exactNativeMeasureAnchor,
      source: String(v.lastUserScrollSource || '')
    });
  }
  const anchor = !episodeBottomAnchor && !freezeNativeScroll && !v.pendingScrollTarget && !v.pendingSliderMeasureTarget
    ? traceCapturedAnchor(app, v, reader, 'measure-capture', captureVirtualScrollAnchor({ reader, rows: v.rows, prefix: v.prefix, anchorOffsetPx: VIRTUAL_SCROLL_STABILITY_ANCHOR_OFFSET_PX, preferBodyRows: !exactNativeMeasureAnchor }), { anchorType: 'measure' })
    : null;
  let changed = false;
  for (const [id, measured] of updates.entries()) {
    const old = v.measureCache.get(id);
    if (!Number.isFinite(old) || Math.abs(old - measured) > HEIGHT_EPSILON) {
      v.measureCache.set(id, measured);
      changed = true;
    }
  }
  if (!changed) return false;
  recalcVirtualLayout(app);
  if (applyPendingSliderMeasureTarget(app, v, { phase: 'measure-commit' })) {
    scheduleVirtualRender(app);
  } else if (v.pendingScrollTarget && v.pendingFocusTries < 10) {
    scrollToVirtualTarget(app, v.pendingScrollTarget, { fromMeasure: true });
  } else if (episodeBottomAnchor) {
    restoreEpisodeBottomAnchor(app, episodeBottomAnchor, 'measure-commit-bottom');
    scheduleVirtualRender(app);
    scheduleEpisodeBottomAnchorRecheck(app, episodeBottomAnchor, 'measure-commit-bottom-raf');
  } else if (freezeNativeScroll) {
    recordSuppressedScrollStability(v, { phase: 'measure-commit', anchorType: 'measure', freezePass: nativeForwardMeasureFreeze.freeze ? READER_NATIVE_FORWARD_MEASURE_FREEZE_PASS : nativeBackwardMeasureFreeze.freeze ? READER_NATIVE_BACKWARD_MEASURE_FREEZE_PASS : READER_SCROLL_SETTLE_NATIVE_FREEZE_PASS });
    scheduleVirtualRender(app);
  } else {
    v.scrollStabilityPass = READER_VIRTUAL_SCROLL_STABILITY_PASS;
    const unifiedMeasurePolicy = resolveUnifiedAppendRestorePolicy(app, v, reader, anchor, {
      phase: 'measure-commit',
      anchorType: 'measure',
      source: v?.lastAppendAnchorGate?.source || v?.lastScrollBufferAppendInertiaExtend?.source || '',
      direction: v?.lastAppendAnchorGate?.direction || v?.lastScrollBufferAppendInertiaExtend?.direction || v?.lastScrollBufferDirection || '',
      lastUserScrollSource: anchor?.lastUserScrollSourceAtCapture || v?.lastScrollBufferAppendInertiaExtend?.lastUserScrollSource || v?.lastUserScrollSource || ''
    });
    const correctionGuard = unifiedMeasurePolicy?.suppress ? null : resolveAppendCorrectionGuard(app, anchor, { phase: 'measure-commit', anchorType: 'measure' });
    const microDamp = unifiedMeasurePolicy?.suppress || correctionGuard?.suppress ? null : resolveAppendMicroCorrectionDamp(app, v, reader, anchor, { phase: 'measure-commit', anchorType: 'measure' });
    const upwardGuard = unifiedMeasurePolicy?.suppress || correctionGuard?.suppress || microDamp?.suppress ? null : resolveAppendUpwardCorrectionGuard(app, v, reader, anchor, { phase: 'measure-commit', anchorType: 'measure' });
    v.lastScrollStability = unifiedMeasurePolicy?.suppress
      ? { applied: false, reason: unifiedMeasurePolicy.reason, pass: READER_UNIFIED_APPEND_MEASURE_POLICY_PASS, rowId: unifiedMeasurePolicy.rowId || '', rowIndex: Number(unifiedMeasurePolicy.rowIndex) || -1, deltaPx: 0, suppressedBy: READER_UNIFIED_APPEND_RESTORE_POLICY_PASS }
      : correctionGuard?.suppress
        ? { applied: false, reason: correctionGuard.reason, pass: READER_APPEND_CORRECTION_GUARD_PASS, rowId: correctionGuard.rowId || '', rowIndex: Number(correctionGuard.rowIndex) || -1, deltaPx: Number(correctionGuard.deltaPx) || 0, suppressedBy: READER_APPEND_CORRECTION_GUARD_PASS }
        : microDamp?.suppress
          ? { applied: false, reason: microDamp.reason, pass: READER_APPEND_MICRO_CORRECTION_DAMP_PASS, rowId: microDamp.rowId || '', rowIndex: Number(microDamp.rowIndex) || -1, deltaPx: Number(microDamp.deltaPx) || 0, suppressedBy: READER_APPEND_MICRO_CORRECTION_DAMP_PASS }
          : upwardGuard?.suppress
            ? { applied: false, reason: upwardGuard.reason, pass: READER_APPEND_UPWARD_CORRECTION_GUARD_PASS, rowId: upwardGuard.rowId || '', rowIndex: Number(upwardGuard.rowIndex) || -1, deltaPx: Number(upwardGuard.deltaPx) || 0, suppressedBy: READER_APPEND_UPWARD_CORRECTION_GUARD_PASS }
            : applyVirtualScrollAnchorWithInertiaGuard(app, v, reader, anchor, { phase: 'measure-commit', anchorType: 'measure' });
    traceAnchorResult(app, v, reader, 'measure-commit', anchor, v.lastScrollStability, { anchorType: 'measure', bodyAnchorAdjusted: !!anchor?.bodyAnchorAdjusted });
    scheduleVirtualRender(app);
  }
  return true;
}




export function clearPendingSliderMeasureTarget(app, meta = {}) {
  const state = ensureVirtualState(app);
  const target = state.pendingSliderMeasureTarget || null;
  if (!target) return false;
  state.pendingSliderMeasureTarget = null;
  state.pendingSliderMeasureTries = 0;
  if (meta?.clearProgrammaticScroll === true) {
    state.sliderProgrammaticScrollUntil = 0;
    state.sliderProgrammaticScrollTop = null;
  }
  state.sliderStaleMeasureTargetClearPass = READER_SLIDER_STALE_MEASURE_TARGET_CLEAR_PASS;
  state.lastSliderStaleMeasureTargetClear = {
    pass: READER_SLIDER_STALE_MEASURE_TARGET_CLEAR_PASS,
    phase: String(meta?.phase || ''),
    reason: String(meta?.reason || 'pending slider measured target cleared before it can be applied stale'),
    chunk: Number(target.chunk) || 0,
    charIndex: Number.isFinite(Number(target.charIndex)) ? Number(target.charIndex) : null,
    clearedProgrammaticScroll: meta?.clearProgrammaticScroll === true,
    at: Date.now()
  };
  return true;
}

function applyPendingSliderMeasureTarget(app, v = null, meta = {}) {
  const state = v || ensureVirtualState(app);
  const target = state.pendingSliderMeasureTarget;
  if (!target) return false;
  const tries = Math.max(0, Number(state.pendingSliderMeasureTries) || 0);
  if (tries >= READER_SLIDER_MEASURE_CORRECTION_MAX_TRIES) {
    state.pendingSliderMeasureTarget = null;
    state.pendingSliderMeasureTries = 0;
    state.lastSliderMeasuredCharAnchor = { pass: READER_SLIDER_MEASURED_CHAR_ANCHOR_PASS, applied: false, reason: 'maximum measured correction tries exhausted', tries, phase: String(meta?.phase || ''), at: Date.now() };
    return false;
  }
  const reader = app?.els?.reader || null;
  const beforeTop = Math.max(0, Number(reader?.scrollTop) || 0);
  state.pendingSliderMeasureTries = tries + 1;
  state.sliderMeasuredCharAnchorPass = READER_SLIDER_MEASURED_CHAR_ANCHOR_PASS;
  scrollToVirtualTarget(app, target, { fromMeasure: true, sliderMeasureCorrection: true });
  const afterTop = Math.max(0, Number(reader?.scrollTop) || 0);
  state.pendingSliderMeasureTarget = null;
  state.pendingSliderMeasureTries = 0;
  state.lastSliderMeasuredCharAnchor = { pass: READER_SLIDER_MEASURED_CHAR_ANCHOR_PASS, applied: true, done: true, tries: tries + 1, phase: String(meta?.phase || ''), chunk: Number(target.chunk) || 0, charIndex: Number.isFinite(Number(target.charIndex)) ? Number(target.charIndex) : null, beforeTop: Math.round(beforeTop), afterTop: Math.round(afterTop), deltaPx: Math.round(afterTop - beforeTop), reason: 'nav-slider char target is re-applied after measured row heights update; pendingScrollTarget/scrollIntoView is not used', at: Date.now() };
  return true;
}

export function scrollToVirtualTarget(app, target = {}, meta = {}) {
  const reader = app.els.reader;
  if (!reader) return;
  const address = resolveVirtualAddress(app, target);
  if (!address) return;
  if (target.searchIndex != null) {
    const vState = ensureVirtualState(app);
    vState.searchTargetResolutionPass = READER_SEARCH_TARGET_RESOLUTION_PASS;
    vState.lastSearchTargetResolution = { pass: READER_SEARCH_TARGET_RESOLUTION_PASS, chunk: Number(address.chunk) || 0, rowIndex: Number(address.rowIndex) || 0, charIndex: Number(address.charIndex) || 0, at: Date.now() };
  }
  const v = recalcVirtualLayout(app);
  const source = String(target.source || '');
  if (source === 'nav-slider') {
    v.userScrollActiveUntil = 0;
    v.lastUserScrollSource = 'programmatic-slider';
    v.sliderRatioScrollAnchorPass = READER_SLIDER_RATIO_SCROLL_ANCHOR_PASS;
  }
  const row = v.rows[address.rowIndex];
  const rowTop = v.prefix[address.rowIndex] || 0;
  const rowHeight = Math.max(1, v.heights[address.rowIndex] || getRowHeight(app, row));
  const viewport = Math.max(1, reader.clientHeight || 1);
  const pureRatioTarget = target.ratio != null && target.blockIndex == null && target.searchIndex == null && target.charIndex == null && target.globalBlockIndex == null;
  const directBlockScrollTarget = source === 'nav-slider' && target.directScroll === true && (target.globalBlockIndex != null || target.blockIndex != null);
  let targetTop;
  if (directBlockScrollTarget) {
    const terminalSliderTarget = target.sliderTerminal === true || Number(target.documentRatio) >= 0.999 || Number(target.ratio) >= 0.999;
    const alignOffset = VIRTUAL_SCROLL_STABILITY_ANCHOR_OFFSET_PX;
    const blockOffset = row?.type === 'body' ? estimateInRowOffset(row, address.charIndex, rowHeight) : 0;
    targetTop = terminalSliderTarget ? Math.max(0, (Number(v.totalHeight) || rowTop + rowHeight) - viewport) : rowTop + blockOffset - alignOffset;
    v.pendingScrollTarget = null;
    v.pendingFocusTries = 0;
    if (!meta.sliderMeasureCorrection && target.charAnchor === true) {
      v.pendingSliderMeasureTarget = { ...target, source: 'nav-slider', directScroll: true, charAnchor: true, sliderMeasuredCharAnchorPass: READER_SLIDER_MEASURED_CHAR_ANCHOR_PASS };
      v.pendingSliderMeasureTries = 0;
    }
    v.sliderBlockDirectAnchorPass = READER_SLIDER_BLOCK_DIRECT_ANCHOR_PASS;
    v.navSliderAnchorOffsetTargetPass = READER_NAV_SLIDER_ANCHOR_OFFSET_TARGET_PASS;
    v.lastSliderBlockDirectAnchor = { pass: READER_SLIDER_BLOCK_DIRECT_ANCHOR_PASS, navSliderAnchorOffsetTargetPass: READER_NAV_SLIDER_ANCHOR_OFFSET_TARGET_PASS, measuredCharAnchorPass: READER_SLIDER_MEASURED_CHAR_ANCHOR_PASS, fullFileCharProgressPass: READER_FULL_FILE_CHAR_PROGRESS_PASS, source, chunk: Number(address.chunk) || 0, blockIndex: Number(address.blockIndex) || 0, globalBlockIndex: Number(address.globalBlockIndex) || 0, charIndex: Number(address.charIndex) || 0, anchorOffsetPx: alignOffset, targetTop: Math.round(targetTop), pendingSliderMeasureTarget: !!v.pendingSliderMeasureTarget, terminalSliderTarget, reason: terminalSliderTarget ? 'slider terminal target uses measured virtual bottom and keeps char anchor correction pending' : 'slider manifest block target aligns the target char to the same viewport anchor used by progress measurement', at: Date.now() };
  } else if (pureRatioTarget) {
    const bounds = getChunkBounds(app, address.chunk);
    const ratio = clamp(target.ratio || 0, 0, 1);
    const chunkTop = bounds ? bounds.top : rowTop;
    const chunkHeight = bounds ? Math.max(1, bounds.height) : rowHeight;
    const ratioAnchorOffset = source === 'nav-slider' ? VIRTUAL_SCROLL_STABILITY_ANCHOR_OFFSET_PX : 0;
    targetTop = ratio >= 0.999
      ? Math.max(0, chunkTop + chunkHeight - viewport)
      : chunkTop + chunkHeight * ratio - ratioAnchorOffset;
    v.pendingScrollTarget = null;
    v.pendingFocusTries = 0;
    v.ratioScrollTargetPass = READER_RATIO_SCROLL_TARGET_PASS;
    v.lastRatioScrollTarget = {
      pass: READER_RATIO_SCROLL_TARGET_PASS,
      chunk: Number(address.chunk) || 0,
      ratio,
      source,
      targetTop: Math.round(targetTop),
      pendingTarget: false,
      reason: ratio >= 0.999 ? 'bottom ratio uses direct scroll without row scrollIntoView' : 'ratio target uses direct scroll without row scrollIntoView',
      at: Date.now()
    };
    if (source === 'nav-slider') {
      v.lastSliderRatioScrollAnchor = {
        pass: READER_SLIDER_RATIO_SCROLL_ANCHOR_PASS,
        source,
        chunk: Number(address.chunk) || 0,
        ratio,
        navSliderAnchorOffsetTargetPass: source === 'nav-slider' ? READER_NAV_SLIDER_ANCHOR_OFFSET_TARGET_PASS : '',
        anchorOffsetPx: source === 'nav-slider' ? ratioAnchorOffset : null,
        targetTop: Math.round(targetTop),
        pendingTarget: false,
        at: Date.now()
      };
    }
  } else {
    const blockOffset = row.type === 'body' ? estimateInRowOffset(row, address.charIndex, rowHeight) : 0;
    const align = target.align || (target.searchIndex != null ? 'center' : 'start');
    const alignOffset = align === 'center' ? viewport * 0.42 : 96;
    targetTop = rowTop + blockOffset - alignOffset;
    v.pendingScrollTarget = {
      ...address,
      query: target.query || app.state.search?.highlights?.query || '',
      matchLength: target.matchLength || app.state.search?.highlights?.matchLength || 0,
      align: target.align || 'center'
    };
    v.pendingFocusTries = meta.fromMeasure ? v.pendingFocusTries : 0;
  }
  const appliedTop = Math.max(0, Math.round(targetTop));
  reader.scrollTop = appliedTop;
  if (source === 'nav-slider') {
    v.sliderProgrammaticScrollIsolationPass = READER_SLIDER_PROGRAMMATIC_SCROLL_ISOLATION_PASS;
    v.sliderProgrammaticScrollUntil = Date.now() + (meta.sliderMeasureCorrection ? 180 : 260);
    v.sliderProgrammaticScrollTop = appliedTop;
    v.lastSliderProgrammaticScrollIsolation = {
      pass: READER_SLIDER_PROGRAMMATIC_SCROLL_ISOLATION_PASS,
      active: true,
      phase: meta.sliderMeasureCorrection ? 'measure-correction-scroll' : 'initial-slider-scroll',
      scrollTop: appliedTop,
      reason: 'nav-slider scroll is isolated from native user-scroll side effects until the synthetic scroll event is consumed',
      at: Date.now()
    };
  }
  renderVirtual(app, { force: true });
}

function resolveVirtualAddress(app, target = {}) {
  const v = recalcVirtualLayout(app);
  if (!v.rows.length) return null;
  const chunk = Number(target.chunk) || Number(app.state.current?.chunk) || 1;
  let rowIndex = -1;
  let charIndex = Number.isFinite(Number(target.charIndex)) ? Number(target.charIndex) : null;
  if (target.searchIndex != null) charIndex = Number(target.searchIndex) || 0;
  const charAnchorTarget = target.charAnchor === true && charIndex != null;
  if (charAnchorTarget) {
    const resolved = resolveNearestBodyRowByChar(v, chunk, charIndex);
    rowIndex = Number.isFinite(Number(resolved?.rowIndex)) ? Number(resolved.rowIndex) : -1;
    if (rowIndex >= 0) charIndex = Number(resolved.charIndex);
    if (rowIndex >= 0 && target.sliderCharTargetPass) {
      v.sliderCharTargetAnchorPass = READER_SLIDER_CHAR_TARGET_ANCHOR_PASS;
      v.lastSliderCharTargetAnchor = {
        pass: READER_SLIDER_CHAR_TARGET_ANCHOR_PASS,
        chunk,
        charIndex,
        rowIndex,
        nearestCharAnchor: resolved.nearest === true,
        reason: resolved.reason || 'nav slider resolves row by target char before block/global fallback',
        at: Date.now()
      };
    }
  }
  if (rowIndex < 0 && target.globalBlockIndex != null) {
    const globalBlockIndex = Math.max(0, Math.round(Number(target.globalBlockIndex) || 0));
    rowIndex = v.rowIndexByGlobalBlock?.get(globalBlockIndex) ?? -1;
  }
  if (rowIndex < 0 && target.blockIndex != null) {
    const blockIndex = Math.max(0, Number(target.blockIndex) || 0);
    rowIndex = v.rowIndexByChunkBlock?.get(`${chunk}:${blockIndex}`) ?? -1;
    if (rowIndex < 0) {
      const indexes = (v.rowIndexesByChunk?.get(chunk) || []).filter(index => v.rows[index]?.type === 'body');
      if (indexes.length) rowIndex = indexes[Math.min(blockIndex, indexes.length - 1)];
    }
  }
  if (rowIndex < 0 && target.globalBlockIndex != null) {
    const globalBlockIndex = Math.max(0, Math.round(Number(target.globalBlockIndex) || 0));
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const [globalBlock, index] of (v.rowIndexByGlobalBlock || new Map()).entries()) {
      const distance = Math.abs(Number(globalBlock) - globalBlockIndex);
      if (distance < bestDistance) { bestDistance = distance; bestIndex = index; }
    }
    rowIndex = bestIndex;
  }
  if (rowIndex < 0 && charIndex != null) {
    const indexes = v.rowIndexesByChunk?.get(chunk) || [];
    rowIndex = indexes.find(index => {
      const row = v.rows[index];
      return row?.type === 'body' && row.start <= charIndex && charIndex < row.end;
    }) ?? -1;
    if (rowIndex < 0) rowIndex = indexes.find(index => {
      const row = v.rows[index];
      return row?.type === 'body' && row.start <= charIndex && charIndex <= row.end;
    }) ?? -1;
  }
  if (rowIndex < 0) rowIndex = (v.rowIndexesByChunk?.get(chunk) || []).find(index => v.rows[index]?.type === 'body') ?? -1;
  if (rowIndex < 0) rowIndex = (v.rowIndexesByChunk?.get(chunk) || [])[0] ?? -1;
  if (rowIndex < 0) rowIndex = 0;
  const row = v.rows[rowIndex];
  if (charIndex == null && row?.type === 'body') charIndex = Number(row.start) || 0;
  return {
    chunk: Number(row?.chunk) || chunk,
    rowIndex,
    rowId: row?.id || '',
    blockIndex: row?.type === 'body' ? Number(row.blockIndex) || 0 : -1,
    globalBlockIndex: row?.type === 'body' ? Number(row.globalBlockIndex) || 0 : -1,
    charIndex: charIndex == null ? 0 : clamp(charIndex, Number(row?.start) || 0, Number(row?.end) || charIndex)
  };
}


function resolveNearestBodyRowByChar(v, chunk, charIndex) {
  const indexes = (v.rowIndexesByChunk?.get(chunk) || []).filter(index => v.rows[index]?.type === 'body');
  if (!indexes.length || charIndex == null) return null;
  let best = null;
  for (const index of indexes) {
    const row = v.rows[index];
    const start = Number(row.start) || 0;
    const end = Math.max(start, Number(row.end) || start);
    if (start <= charIndex && charIndex < end) return { rowIndex: index, charIndex: clamp(charIndex, start, end), nearest: false, reason: 'charIndex is inside body row' };
    if (start <= charIndex && charIndex <= end) return { rowIndex: index, charIndex: clamp(charIndex, start, end), nearest: false, reason: 'charIndex is on body row boundary' };
    const clamped = clamp(charIndex, start, end);
    const distance = Math.abs(charIndex - clamped);
    if (!best || distance < best.distance) {
      best = { rowIndex: index, charIndex: clamped, distance, nearest: true, reason: 'charIndex fell between reachable body rows; nearest body row was used before block/global fallback' };
    }
  }
  return best;
}

function estimateInRowOffset(row, charIndex, rowHeight) {
  const start = Number(row.start) || 0;
  const end = Math.max(start + 1, Number(row.end) || start + 1);
  const index = clamp(Number(charIndex) || start, start, end);
  const ratio = clamp((index - start) / Math.max(1, end - start), 0, 1);
  return Math.max(0, Math.min(rowHeight * 0.85, rowHeight * ratio));
}

function scheduleResolvePendingTarget(app) {
  const v = ensureVirtualState(app);
  if (!v.pendingScrollTarget || v.pendingFocusRaf) return;
  v.pendingFocusRaf = window.requestAnimationFrame(() => {
    v.pendingFocusRaf = 0;
    resolvePendingTarget(app);
  });
}

function resolvePendingTarget(app) {
  const v = ensureVirtualState(app);
  const target = v.pendingScrollTarget;
  if (!target) return;
  v.pendingFocusTries += 1;
  const content = app.els.content;
  const reader = app.els.reader;
  const rowEl = target.rowId ? content?.querySelector(`[data-virtual-id="${cssEscape(target.rowId)}"]`) : null;
  const mark = content?.querySelector(`.${SEARCH_TARGET_CLASS}`);
  if (mark) {
    mark.scrollIntoView({ block: target.align || 'center', inline: 'nearest', behavior: 'auto' });
    v.pendingScrollTarget = null;
    v.pendingFocusTries = 0;
    return;
  }
  if (rowEl && target.query === '') {
    rowEl.scrollIntoView({ block: target.align || 'start', inline: 'nearest', behavior: 'auto' });
    v.pendingScrollTarget = null;
    v.pendingFocusTries = 0;
    return;
  }
  if (reader && v.pendingFocusTries < 8) {
    scheduleVirtualRender(app);
    scheduleResolvePendingTarget(app);
  } else {
    v.pendingScrollTarget = null;
    v.pendingFocusTries = 0;
  }
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(value));
  return String(value).replace(/[^a-zA-Z0-9_-]/g, ch => '\\' + ch);
}

export function hasVirtualChunkRows(app, chunk) {
  const v = ensureVirtualState(app);
  const targetChunk = Math.max(1, Math.round(Number(chunk) || 0));
  const indexes = v.rowIndexesByChunk instanceof Map ? v.rowIndexesByChunk.get(targetChunk) : null;
  return Array.isArray(indexes) && indexes.length > 0;
}

export function getVirtualLayoutDiagnostics(app) {
  return buildVirtualLayoutDiagnosticsBoundary({
    app,
    v: app?.state?.readerVirtual || null,
    content: app?.els?.content || null,
    reader: app?.els?.reader || null,
    constants: {
      scrollBufferPass: READER_SCROLL_BUFFER_PASS,
      velocityBufferPass: READER_VELOCITY_BUFFER_PASS,
      rowDomPoolPass: READER_ROW_DOM_POOL_PASS,
      searchTargetResolutionPass: READER_SEARCH_TARGET_RESOLUTION_PASS,
      scrollStabilityPass: READER_VIRTUAL_SCROLL_STABILITY_PASS,
      multiFileBodyAnchorPass: READER_MULTI_FILE_BODY_ANCHOR_PASS,
      multiFileNativeExactAnchorPass: READER_MULTI_FILE_NATIVE_EXACT_ANCHOR_PASS,
      multiFileBottomAnchorNativeGuardPass: READER_MULTI_FILE_BOTTOM_ANCHOR_NATIVE_GUARD_PASS,
      multiFileNativeScrollSettleExactAnchorPass: READER_MULTI_FILE_NATIVE_SCROLL_SETTLE_EXACT_ANCHOR_PASS,
      lastMultiFileNativeScrollSettleExactAnchor: null,
      scrollSettleExactAnchorRestorePass: READER_SCROLL_SETTLE_EXACT_ANCHOR_RESTORE_PASS,
      lastScrollSettleExactAnchorRestore: null,
      sliderRatioScrollAnchorPass: READER_SLIDER_RATIO_SCROLL_ANCHOR_PASS,
      appendIncrementalIndexDeltaV466Pass: READER_APPEND_INCREMENTAL_INDEX_DELTA_V466_PASS,
      prunePrefixDeltaGuardPass: READER_PRUNE_PREFIX_DELTA_GUARD_PASS,
      lastPrunePrefixDeltaGuard: null,
      bodyAnchorInertiaRetainPass: READER_BODY_ANCHOR_INERTIA_RETAIN_PASS,
      inertiaFixtureExpansionPass: READER_INERTIA_FIXTURE_EXPANSION_PASS,
      sliderStaleMeasureTargetClearPass: READER_SLIDER_STALE_MEASURE_TARGET_CLEAR_PASS,
      programmaticScrollIsolationPass: READER_PROGRAMMATIC_SCROLL_ISOLATION_PASS,
      anchorTracePass: READER_ANCHOR_TRACE_EXPORT_PASS,
      anchorTraceLowOverheadPass: READER_ANCHOR_TRACE_LOW_OVERHEAD_PASS,
      anchorTraceLimit: READER_ANCHOR_TRACE_LIMIT,
      overscanMinPx: VIRTUAL_OVERSCAN_MIN_PX,
      overscanViewportMultiplier: VIRTUAL_OVERSCAN_VIEWPORT_MULTIPLIER,
      overscanMaxPx: VIRTUAL_OVERSCAN_MAX_PX,
      overscanVelocityBoostMaxPx: VIRTUAL_OVERSCAN_VELOCITY_BOOST_MAX_PX,
      maxRenderedRows: MAX_RENDERED_ROWS,
      rowElementPoolMax: VIRTUAL_ROW_DOM_POOL_MAX,
      scrollActiveGraceMs: VIRTUAL_SCROLL_ACTIVE_GRACE_MS,
      measureIdleGraceMs: VIRTUAL_MEASURE_IDLE_GRACE_MS,
      renderReuseMarginMinPx: VIRTUAL_RENDER_REUSE_MARGIN_MIN_PX,
      renderReuseMarginViewportMultiplier: VIRTUAL_RENDER_REUSE_MARGIN_VIEWPORT_MULTIPLIER,
      rowMeasuredMarginHeightPass: READER_ROW_MEASURED_MARGIN_HEIGHT_PASS,
      scrollInputDiagnosticsPass: READER_SCROLL_INPUT_DIAGNOSTICS_PASS,
      renderWindowAnchorPass: READER_RENDER_WINDOW_ANCHOR_PASS,
      scrollSettleCompactionPass: READER_SCROLL_SETTLE_COMPACTION_PASS,
      activeRenderPatchPass: READER_ACTIVE_RENDER_PATCH_PASS,
      scrollSettleNativeFreezePass: READER_SCROLL_SETTLE_NATIVE_FREEZE_PASS,
      activeRenderPatchMaxEdgeRows: VIRTUAL_ACTIVE_RENDER_PATCH_MAX_EDGE_ROWS,
      episodeBottomAnchorPass: READER_EPISODE_BOTTOM_ANCHOR_PASS,
      episodeBottomAnchorMinPx: VIRTUAL_EPISODE_BOTTOM_ANCHOR_MIN_PX,
      episodeBottomAnchorMaxPx: VIRTUAL_EPISODE_BOTTOM_ANCHOR_MAX_PX,
      activeRenderWindowPinPass: READER_ACTIVE_RENDER_WINDOW_PIN_PASS,
      activeRenderWindowMaxRows: VIRTUAL_ACTIVE_RENDER_WINDOW_MAX_ROWS,
      activeRenderWindowIdleCompactGraceMs: VIRTUAL_ACTIVE_RENDER_IDLE_COMPACT_GRACE_MS,
      prependAnchorPreservePass: READER_PREPEND_ANCHOR_PRESERVE_PASS,
      prependAnchorGatedPass: READER_PREPEND_ANCHOR_GATED_PASS,
      lastPrependAnchorGate: app?.state?.readerVirtual?.lastPrependAnchorGate || null,
      lastTrustedBottomProgress: app?.state?.readerVirtual?.lastTrustedBottomProgress || null,
      actualBottomProgressTrustPass: READER_ACTUAL_BOTTOM_PROGRESS_TRUST_PASS,
      lastActualBottomProgressTrust: app?.state?.readerVirtual?.lastActualBottomProgressTrust || null,
      multiFileGuardCleanupPass: READER_MULTI_FILE_GUARD_CLEANUP_PASS,
      lastMultiFileGuardCleanup: app?.state?.readerVirtual?.lastMultiFileGuardCleanup || null,
      nativeForwardScrollRetainPass: READER_NATIVE_FORWARD_SCROLL_RETAIN_PASS,
      scrollAppendChunkWindowDeferPass: READER_SCROLL_APPEND_CHUNK_WINDOW_DEFER_PASS,
      activeForwardRenderAnchorSuppressPass: READER_ACTIVE_FORWARD_RENDER_ANCHOR_SUPPRESS_PASS,
      nativeForwardSeamTransitLockPass: READER_NATIVE_FORWARD_SEAM_TRANSIT_LOCK_PASS,
      nativeForwardSeamRenderHoldPass: READER_NATIVE_FORWARD_SEAM_RENDER_HOLD_PASS,
      seamTransitMeasureDeferPass: READER_SEAM_TRANSIT_MEASURE_DEFER_PASS,
      safeAreaBodyRowProgressPass: READER_SAFE_AREA_BODY_ROW_PROGRESS_PASS,
      progressStableWithoutManifestPass: READER_PROGRESS_STABLE_WITHOUT_MANIFEST_PASS,
      progressPhaseReportPass: READER_PROGRESS_PHASE_REPORT_PASS,
      manifestAdoptionGuardPass: READER_MANIFEST_ADOPTION_GUARD_PASS,
      appendSeam7085FixturePass: READER_APPEND_SEAM_70_85_FIXTURE_PASS,
      mobile7080AnchorHoldPass: READER_MOBILE_70_80_ANCHOR_HOLD_PASS,
      fullFileCharProgressPass: READER_FULL_FILE_CHAR_PROGRESS_PASS,
      scrollBufferAppendInertiaExtendPass: READER_SCROLL_BUFFER_APPEND_INERTIA_EXTEND_PASS,
      appendMicroCorrectionDampPass: READER_APPEND_MICRO_CORRECTION_DAMP_PASS,
      ipadScrollCoastRetainPass: READER_IPAD_SCROLL_COAST_RETAIN_PASS,
      ipadTouchNativeScrollAnchorPass: READER_IPAD_TOUCH_NATIVE_SCROLL_ANCHOR_PASS,
      bufferAppendCurrentChunkRetainPass: 'v447-reader-buffer-append-current-chunk-retain-pass',
      inertiaFixtureExpansionPass: READER_INERTIA_FIXTURE_EXPANSION_PASS,
      sliderStaleMeasureTargetClearPass: READER_SLIDER_STALE_MEASURE_TARGET_CLEAR_PASS,
      programmaticScrollIsolationPass: READER_PROGRAMMATIC_SCROLL_ISOLATION_PASS,
      manifestBlockFallbackProgressPass: READER_MANIFEST_BLOCK_FALLBACK_PROGRESS_PASS,
      episodeBottomAnchorStrictGatePass: READER_EPISODE_BOTTOM_ANCHOR_STRICT_GATE_PASS,
      appendSeamProgressDiagnosticPass: READER_APPEND_SEAM_PROGRESS_DIAGNOSTIC_PASS,
      appendSeamScrollTopDiagnosticPass: READER_APPEND_SEAM_SCROLLTOP_DIAGNOSTIC_PASS,
      prependSeamScrollTopDiagnosticPass: READER_PREPEND_SEAM_SCROLLTOP_DIAGNOSTIC_PASS,
      nativeForwardMeasureFreezePass: READER_NATIVE_FORWARD_MEASURE_FREEZE_PASS,
      nativeBackwardMeasureFreezePass: READER_NATIVE_BACKWARD_MEASURE_FREEZE_PASS
    },
    createVelocityBufferStats,
    createRowElementPoolStats
  });
}

export function getChunkBounds(app, chunk) {
  const v = recalcVirtualLayout(app);
  const indexes = v.rowIndexesByChunk?.get(Number(chunk)) || [];
  if (!indexes.length) return null;
  const first = indexes[0];
  const last = indexes[indexes.length - 1];
  const top = v.prefix[first] || 0;
  const bottom = v.prefix[last + 1] || top;
  return { first, last, top, bottom, height: Math.max(1, bottom - top) };
}

export function getVisibleRow(app) {
  const reader = app.els.reader;
  if (!reader) return null;
  const v = recalcVirtualLayout(app);
  if (!v.rows.length) return null;
  const target = reader.scrollTop + 36;
  const index = Math.max(0, Math.min(v.rows.length - 1, upperBound(v.prefix, target, 0, v.rows.length) - 1));
  return { row: v.rows[index], index, top: v.prefix[index] || 0, bottom: v.prefix[index + 1] || 0 };
}

export function getVisibleChunk(app) {
  return Number(getVisibleRow(app)?.row?.chunk) || Number(app.state.current?.chunk) || 1;
}

function shouldUseRenderedBodyRowProgress(app, v = null) {
  const state = v || ensureVirtualState(app);
  const now = Date.now();
  return !!(
    state?.pendingSliderMeasureTarget ||
    (Number(state?.sliderProgrammaticScrollUntil) || 0) >= now
  );
}

function resolveRenderedBodyRowInfoAtAnchor(app, fallbackRowInfo = null, v = null) {
  const state = v || ensureVirtualState(app);
  if (!shouldUseRenderedBodyRowProgress(app, state)) return fallbackRowInfo;
  const reader = app?.els?.reader || null;
  const content = app?.els?.content || null;
  if (!reader || !content || !state?.rows?.length) return fallbackRowInfo;
  let readerRect = null;
  try { readerRect = reader.getBoundingClientRect?.(); } catch {}
  if (!readerRect) return fallbackRowInfo;
  const anchorClientY = Number(readerRect.top || 0) + VIRTUAL_SCROLL_STABILITY_ANCHOR_OFFSET_PX;
  let best = null;
  let bestDistance = Infinity;
  try {
    content.querySelectorAll?.('.reader-vrow-body[data-virtual-id]')?.forEach?.(el => {
      const id = String(el?.dataset?.virtualId || '');
      if (!id) return;
      const index = state.rowIndexById instanceof Map ? state.rowIndexById.get(id) : -1;
      if (!Number.isFinite(Number(index)) || Number(index) < 0) return;
      const row = state.rows[Number(index)];
      if (!row || row.type !== 'body') return;
      let rect = null;
      try { rect = el.getBoundingClientRect?.(); } catch {}
      const height = Math.max(0, Number(rect?.height) || 0);
      if (!rect || height <= 0) return;
      const topClient = Number(rect.top) || 0;
      const bottomClient = Number(rect.bottom) || topClient + height;
      const contains = anchorClientY >= topClient && anchorClientY <= bottomClient;
      if (!contains) return;
      const distance = 0;
      if (!best || distance < bestDistance) {
        const scrollTop = Math.max(0, Number(reader.scrollTop) || 0);
        const top = scrollTop + topClient - Number(readerRect.top || 0);
        best = { row, index: Number(index), top, bottom: top + height, measured: true, contains, distance, height };
        bestDistance = distance;
      }
    });
  } catch {}
  if (!best) {
    state.containedVisibleRowProgressPass = READER_CONTAINED_VISIBLE_ROW_PROGRESS_PASS;
    state.lastContainedVisibleRowProgress = {
      pass: READER_CONTAINED_VISIBLE_ROW_PROGRESS_PASS,
      applied: false,
      fallbackRowId: fallbackRowInfo?.row?.id || '',
      reason: 'rendered-row progress is limited to a row that actually contains the reader anchor; nearest-row fallback is disabled to avoid progress jumps',
      at: Date.now()
    };
    return fallbackRowInfo;
  }
  state.fullFileVisibleRowMeasuredProgressPass = READER_FULL_FILE_VISIBLE_ROW_MEASURED_PROGRESS_PASS;
  state.containedVisibleRowProgressPass = READER_CONTAINED_VISIBLE_ROW_PROGRESS_PASS;
  state.lastContainedVisibleRowProgress = {
    pass: READER_CONTAINED_VISIBLE_ROW_PROGRESS_PASS,
    applied: true,
    rowId: best.row?.id || '',
    chunk: Number(best.row?.chunk) || 0,
    blockIndex: Number(best.row?.blockIndex) || 0,
    containsAnchor: best.contains === true,
    measuredHeight: Math.round(Number(best.height) || Math.max(1, best.bottom - best.top)),
    fallbackRowId: fallbackRowInfo?.row?.id || '',
    reason: 'progress may use actual rendered body row bounds only while a programmatic slider seek is settling and only when the row contains the reader anchor',
    at: Date.now()
  };
  state.lastFullFileVisibleRowMeasuredProgress = {
    pass: READER_FULL_FILE_VISIBLE_ROW_MEASURED_PROGRESS_PASS,
    containedPass: READER_CONTAINED_VISIBLE_ROW_PROGRESS_PASS,
    rowId: best.row?.id || '',
    chunk: Number(best.row?.chunk) || 0,
    blockIndex: Number(best.row?.blockIndex) || 0,
    containsAnchor: best.contains === true,
    distancePx: 0,
    measuredHeight: Math.round(Number(best.height) || Math.max(1, best.bottom - best.top)),
    fallbackRowId: fallbackRowInfo?.row?.id || '',
    reason: 'progress uses actual rendered body row bounds only for contained slider-settle rows; no measureCache write is performed from progress reads',
    at: Date.now()
  };
  return best;
}

export function isProgrammaticSliderScrollEvent(app) {
  const v = ensureVirtualState(app);
  const now = Date.now();
  const until = Number(v.sliderProgrammaticScrollUntil) || 0;
  const reader = app?.els?.reader || null;
  const top = Math.round(Number(reader?.scrollTop) || 0);
  const expectedTop = Number.isFinite(Number(v.sliderProgrammaticScrollTop)) ? Math.round(Number(v.sliderProgrammaticScrollTop)) : null;
  const active = until >= now && (expectedTop == null || Math.abs(top - expectedTop) <= Math.max(96, Math.round((Number(reader?.clientHeight) || 0) * 0.25)));
  if (active) {
    v.sliderProgrammaticScrollIsolationPass = READER_SLIDER_PROGRAMMATIC_SCROLL_ISOLATION_PASS;
    v.lastSliderProgrammaticScrollIsolation = {
      pass: READER_SLIDER_PROGRAMMATIC_SCROLL_ISOLATION_PASS,
      active: true,
      scrollTop: top,
      expectedTop,
      remainingMs: Math.max(0, Math.round(until - now)),
      reason: 'nav-slider programmatic scroll updates render/progress without marking native user scroll or extending chunk window',
      at: now
    };
    return true;
  }
  return false;
}


export function markProgrammaticReaderScroll(app, meta = {}) {
  const v = ensureVirtualState(app);
  const reader = app?.els?.reader || null;
  const durationMs = Math.max(80, Math.min(1200, Number(meta?.durationMs) || 180));
  v.programmaticScrollIsolationPass = READER_PROGRAMMATIC_SCROLL_ISOLATION_PASS;
  v.programmaticScrollUntil = Date.now() + durationMs;
  v.programmaticScrollTop = Number.isFinite(Number(meta?.scrollTop)) ? Math.round(Number(meta.scrollTop)) : (reader ? Math.round(Number(reader.scrollTop) || 0) : null);
  v.programmaticScrollSource = String(meta?.source || 'programmatic');
  v.lastProgrammaticScrollIsolation = {
    pass: READER_PROGRAMMATIC_SCROLL_ISOLATION_PASS,
    active: true,
    source: v.programmaticScrollSource,
    scrollTop: v.programmaticScrollTop,
    durationMs,
    reason: 'programmatic reader scroll is isolated from native user-scroll side effects and chunk-window extension',
    at: Date.now()
  };
}

export function isProgrammaticReaderScrollEvent(app) {
  const v = ensureVirtualState(app);
  const now = Date.now();
  const until = Number(v.programmaticScrollUntil) || 0;
  const reader = app?.els?.reader || null;
  const top = Math.round(Number(reader?.scrollTop) || 0);
  const expectedTop = Number.isFinite(Number(v.programmaticScrollTop)) ? Math.round(Number(v.programmaticScrollTop)) : null;
  const active = until >= now && (expectedTop == null || Math.abs(top - expectedTop) <= Math.max(96, Math.round((Number(reader?.clientHeight) || 0) * 0.30)));
  if (active) {
    v.programmaticScrollIsolationPass = READER_PROGRAMMATIC_SCROLL_ISOLATION_PASS;
    v.lastProgrammaticScrollIsolation = {
      pass: READER_PROGRAMMATIC_SCROLL_ISOLATION_PASS,
      active: true,
      source: String(v.programmaticScrollSource || 'programmatic'),
      scrollTop: top,
      expectedTop,
      remainingMs: Math.max(0, Math.round(until - now)),
      reason: 'programmatic reader scroll updates render/progress without marking native user scroll or extending chunk window',
      at: now
    };
    return true;
  }
  return false;
}

export function getViewportAddress(app) {
  const rowInfo = getVisibleRow(app);
  if (!rowInfo?.row) return { chunk: Number(app.state.current?.chunk) || 1, blockIndex: 0, globalBlockIndex: 0, charIndex: 0, fileCharIndex: null, ratio: 0, documentRatio: 0 };
  const reader = app.els.reader;
  const v = ensureVirtualState(app);
  const coarseProgressRowInfo = resolveVisibleBodyRowInfo(app, rowInfo, v) || rowInfo;
  const progressRowInfo = resolveRenderedBodyRowInfoAtAnchor(app, coarseProgressRowInfo, v) || coarseProgressRowInfo;
  const row = progressRowInfo.row || rowInfo.row;
  const rowHeight = Math.max(1, Number(progressRowInfo.bottom) - Number(progressRowInfo.top) || 1);
  const rowRatio = clamp(((reader?.scrollTop || 0) + VIRTUAL_SCROLL_STABILITY_ANCHOR_OFFSET_PX - Number(progressRowInfo.top || 0)) / rowHeight, 0, 1);
  const start = Number(row.start) || 0;
  const end = Math.max(start, Number(row.end) || start);
  const localCharIndex = row.type === 'body' ? Math.round(start + (end - start) * rowRatio) : 0;
  const chunkState = getChunkViewportState(app);
  const chunk = Number(row.chunk) || Number(rowInfo.row.chunk) || Number(app.state.current?.chunk) || 1;
  const blockIndex = row.type === 'body' ? Number(row.blockIndex) || 0 : -1;
  const globalBlockIndex = row.type === 'body' ? Number(row.globalBlockIndex) || 0 : -1;
  const exactManifest = hasBlockManifest(app);
  const fileCharProgress = row.type === 'body' && exactManifest ? resolveViewportFileCharProgress(app, row, rowRatio, localCharIndex) : null;
  const bodyChunkRatio = row.type === 'body' ? resolveVisibleBodyChunkRatio(app, progressRowInfo, v) : null;
  const stableChunkRatio = Number.isFinite(Number(fileCharProgress?.chunkRatio))
    ? Number(fileCharProgress.chunkRatio)
    : Number.isFinite(Number(bodyChunkRatio))
      ? Number(bodyChunkRatio)
      : chunkState.ratio;
  const fallbackDocumentRatio = chunkRatioFallbackToDocumentRatio(app, chunk, stableChunkRatio);
  const manifestDocumentRatio = row.type === 'body' && exactManifest
    ? (Number.isFinite(Number(fileCharProgress?.documentRatio))
      ? Number(fileCharProgress.documentRatio)
      : chunkStateToDocumentRatio(app, chunk, stableChunkRatio))
    : null;
  if (row.type === 'body' && exactManifest) {
    v.manifestBlockFallbackProgressPass = READER_MANIFEST_BLOCK_FALLBACK_PROGRESS_PASS;
    v.fileCharViewportProgressPass = READER_FILE_CHAR_VIEWPORT_PROGRESS_PASS;
    v.lastManifestBlockFallbackProgress = {
      pass: READER_MANIFEST_BLOCK_FALLBACK_PROGRESS_PASS,
      fileCharViewportProgressPass: READER_FILE_CHAR_VIEWPORT_PROGRESS_PASS,
      chunk,
      stableChunkRatio,
      localCharIndex,
      fileCharIndex: Number.isFinite(Number(fileCharProgress?.fileCharIndex)) ? Math.round(Number(fileCharProgress.fileCharIndex)) : null,
      documentRatio: manifestDocumentRatio,
      reason: 'manifest progress prefers stable file char coordinates before block/chunk ratio fallbacks',
      at: Date.now()
    };
    v.lastFileCharViewportProgress = {
      pass: READER_FILE_CHAR_VIEWPORT_PROGRESS_PASS,
      chunk,
      blockIndex,
      globalBlockIndex,
      charIndex: localCharIndex,
      fileCharIndex: Number.isFinite(Number(fileCharProgress?.fileCharIndex)) ? Math.round(Number(fileCharProgress.fileCharIndex)) : null,
      chunkRatio: Number.isFinite(Number(fileCharProgress?.chunkRatio)) ? Number(fileCharProgress.chunkRatio) : stableChunkRatio,
      documentRatio: manifestDocumentRatio,
      source: fileCharProgress?.source || 'fallback',
      reason: 'viewport progress is based on fileCharIndex / totalFileChars when manifest char ranges are available',
      at: Date.now()
    };
  }
  const guarded = resolveManifestAdoptionDocumentRatio(app, {
    row,
    capturedRow: rowInfo.row,
    chunk,
    exactManifest,
    manifestDocumentRatio,
    fallbackDocumentRatio,
    bodyChunkRatio,
    fileCharIndex: fileCharProgress?.fileCharIndex ?? null,
    fileCharDocumentRatio: manifestDocumentRatio,
    chunkStateRatio: chunkState.ratio
  });
  const rowDocumentRatio = guarded.documentRatio;
  if (exactManifest && row.type === 'body') {
    v.fullFileCharProgressDirectPass = READER_FULL_FILE_CHAR_PROGRESS_DIRECT_PASS;
    v.lastFullFileCharProgressDirect = {
      pass: READER_FULL_FILE_CHAR_PROGRESS_DIRECT_PASS,
      fileCharViewportProgressPass: READER_FILE_CHAR_VIEWPORT_PROGRESS_PASS,
      chunk,
      charIndex: localCharIndex,
      fileCharIndex: Number.isFinite(Number(fileCharProgress?.fileCharIndex)) ? Math.round(Number(fileCharProgress.fileCharIndex)) : null,
      documentRatio: rowDocumentRatio,
      mode: guarded.mode,
      reason: 'visible body row file char position is the progress source; no terminal 100% clamp',
      at: Date.now()
    };
  }
  const progressPayload = {
    row,
    capturedRow: rowInfo.row,
    chunk,
    exactManifest,
    bodyChunkRatio,
    fileCharIndex: fileCharProgress?.fileCharIndex ?? null,
    fileCharDocumentRatio: manifestDocumentRatio,
    chunkStateRatio: chunkState.ratio,
    fallbackDocumentRatio,
    manifestDocumentRatio,
    documentRatio: rowDocumentRatio,
    guard: guarded
  };
  recordProgressStableWithoutManifest(app, progressPayload);
  recordProgressPhaseReport(app, progressPayload);
  return {
    chunk,
    blockIndex,
    globalBlockIndex,
    charIndex: localCharIndex,
    fileCharIndex: Number.isFinite(Number(fileCharProgress?.fileCharIndex)) ? Math.round(Number(fileCharProgress.fileCharIndex)) : null,
    ratio: stableChunkRatio,
    documentRatio: rowDocumentRatio,
    guardedDocumentRatio: rowDocumentRatio,
    fileCharDocumentRatio: Number.isFinite(Number(manifestDocumentRatio)) ? clamp(Number(manifestDocumentRatio), 0, 1) : null,
    manifestDocumentRatio: Number.isFinite(Number(manifestDocumentRatio)) ? clamp(Number(manifestDocumentRatio), 0, 1) : null,
    fallbackDocumentRatio: Number.isFinite(Number(fallbackDocumentRatio)) ? clamp(Number(fallbackDocumentRatio), 0, 1) : null,
    progressGuardMode: guarded.mode || ''
  };
}

export function getChunkViewportState(app) {
  const c = app.state.current;
  const reader = app.els.reader;
  if (!c || !reader) return { chunk: 1, ratio: 0 };
  const totalChunks = Math.max(1, Number(c.totalChunks) || 1);
  const v = recalcVirtualLayout(app);
  const scrollTop = Math.max(0, Number(reader.scrollTop) || 0);
  const scrollHeight = Math.max(0, Number(reader.scrollHeight) || 0);
  const clientHeight = Math.max(0, Number(reader.clientHeight) || 0);
  const maxTop = Math.max(0, scrollHeight - clientHeight);
  const remainingBottom = Math.max(0, maxTop - scrollTop);
  const virtualMaxTop = Math.max(0, (Number(v.totalHeight) || scrollHeight) - clientHeight);
  const virtualRemainingBottom = Math.max(0, virtualMaxTop - scrollTop);
  const loadedChunks = Array.from(app.state.loadedChunks?.keys?.() || []).map(Number).filter(Number.isFinite);
  const maxLoadedChunk = loadedChunks.length ? Math.max(...loadedChunks) : Number(c.chunk) || 1;
  const rowInfo = getVisibleRow(app);
  const coarseProgressRowInfo = resolveVisibleBodyRowInfo(app, rowInfo, v) || rowInfo;
  const progressRowInfo = resolveRenderedBodyRowInfoAtAnchor(app, coarseProgressRowInfo, v) || coarseProgressRowInfo;
  const chunk = Number(progressRowInfo?.row?.chunk) || Number(rowInfo?.row?.chunk) || Number(c.chunk) || 1;
  const bounds = getChunkBounds(app, chunk);
  const terminal = resolveTrustedBottomProgress(app, {
    chunk,
    totalChunks,
    maxLoadedChunk,
    remainingBottom,
    virtualRemainingBottom,
    rowIndex: progressRowInfo?.index ?? rowInfo?.index,
    rowCount: v.rows.length,
    rowId: progressRowInfo?.row?.id || rowInfo?.row?.id || ''
  });
  if (terminal.trusted) {
    v.bottomProgressClampPass = READER_BOTTOM_PROGRESS_CLAMP_PASS;
    v.lastBottomProgressClamp = {
      pass: READER_BOTTOM_PROGRESS_CLAMP_PASS,
      trustedBottomProgressPass: terminal.pass,
      chunk: totalChunks,
      remainingBottom: Math.round(remainingBottom),
      virtualRemainingBottom: Math.round(virtualRemainingBottom),
      rowIndex: Number.isFinite(Number(progressRowInfo?.index ?? rowInfo?.index)) ? Math.round(Number(progressRowInfo?.index ?? rowInfo.index)) : -1,
      rowCount: v.rows.length,
      at: Date.now()
    };
    return { chunk: totalChunks, ratio: 1 };
  }
  if (!bounds) return { chunk, ratio: 0 };
  const chunkProgressRow = progressRowInfo?.row || null;
  const progressRowHeight = Math.max(1, Number(progressRowInfo?.bottom) - Number(progressRowInfo?.top) || 1);
  const progressRowRatio = chunkProgressRow?.type === 'body'
    ? clamp((scrollTop + VIRTUAL_SCROLL_STABILITY_ANCHOR_OFFSET_PX - Number(progressRowInfo.top || 0)) / progressRowHeight, 0, 1)
    : null;
  const start = Number(chunkProgressRow?.start) || 0;
  const end = Math.max(start, Number(chunkProgressRow?.end) || start);
  const progressLocalChar = chunkProgressRow?.type === 'body' && progressRowRatio != null ? Math.round(start + (end - start) * progressRowRatio) : null;
  const fileCharProgress = chunkProgressRow?.type === 'body' && hasBlockManifest(app) ? resolveViewportFileCharProgress(app, chunkProgressRow, progressRowRatio, progressLocalChar) : null;
  let ratio = Number.isFinite(Number(fileCharProgress?.chunkRatio)) ? Number(fileCharProgress.chunkRatio) : resolveVisibleBodyChunkRatio(app, progressRowInfo, v);
  recordSafeAreaBodyRowProgress(app, rowInfo, progressRowInfo, ratio);
  if (ratio == null) ratio = clamp((scrollTop - bounds.top) / Math.max(1, bounds.height), 0, 1);
  if (Number.isFinite(Number(fileCharProgress?.fileCharIndex))) {
    v.fileCharViewportProgressPass = READER_FILE_CHAR_VIEWPORT_PROGRESS_PASS;
    v.lastChunkViewportFileCharProgress = {
      pass: READER_FILE_CHAR_VIEWPORT_PROGRESS_PASS,
      chunk,
      ratio,
      fileCharIndex: Math.round(Number(fileCharProgress.fileCharIndex)),
      source: fileCharProgress.source || '',
      reason: 'chunk viewport state uses stable file char coordinate before body-count chunk ratio',
      at: Date.now()
    };
  }
  return { chunk, ratio };
}

function resolveVisibleBodyRowInfo(app, rowInfo, v = null) {
  const state = v || ensureVirtualState(app);
  const row = rowInfo?.row || null;
  if (!row) return null;
  if (row.type === 'body') return rowInfo;
  const indexes = state.rowIndexesByChunk?.get(Number(row.chunk) || 0) || [];
  const currentIndex = Number.isFinite(Number(rowInfo?.index)) ? Number(rowInfo.index) : -1;
  let best = -1;
  for (const index of indexes) {
    if (index > currentIndex && state.rows[index]?.type === 'body') { best = index; break; }
  }
  if (best < 0) {
    for (let i = indexes.length - 1; i >= 0; i -= 1) {
      const index = indexes[i];
      if (index < currentIndex && state.rows[index]?.type === 'body') { best = index; break; }
    }
  }
  if (best < 0) return null;
  return { row: state.rows[best], index: best, top: state.prefix[best] || 0, bottom: state.prefix[best + 1] || state.prefix[best] || 0 };
}

function recordSafeAreaBodyRowProgress(app, rowInfo, progressRowInfo, ratio) {
  const v = ensureVirtualState(app);
  v.safeAreaBodyRowProgressPass = READER_SAFE_AREA_BODY_ROW_PROGRESS_PASS;
  v.lastSafeAreaBodyRowProgress = {
    pass: READER_SAFE_AREA_BODY_ROW_PROGRESS_PASS,
    capturedRowId: rowInfo?.row?.id || '',
    capturedRowType: rowInfo?.row?.type || '',
    rowId: progressRowInfo?.row?.id || '',
    rowType: progressRowInfo?.row?.type || '',
    chunk: Number(progressRowInfo?.row?.chunk) || Number(rowInfo?.row?.chunk) || 0,
    ratio: Number.isFinite(Number(ratio)) ? Number(ratio) : null,
    bodyRowAdjusted: !!(rowInfo?.row && progressRowInfo?.row && rowInfo.row.id !== progressRowInfo.row.id),
    at: Date.now()
  };
}

function recordProgressStableWithoutManifest(app, payload = {}) {
  const v = ensureVirtualState(app);
  const exactManifest = payload?.exactManifest === true;
  const guard = payload?.guard || null;
  v.progressStableWithoutManifestPass = READER_PROGRESS_STABLE_WITHOUT_MANIFEST_PASS;
  v.lastProgressStableWithoutManifest = {
    pass: READER_PROGRESS_STABLE_WITHOUT_MANIFEST_PASS,
    exactManifest,
    mode: guard?.mode || (exactManifest ? 'manifest-block-ratio' : 'chunk-ratio-fallback'),
    rowId: payload?.row?.id || '',
    rowType: payload?.row?.type || '',
    capturedRowId: payload?.capturedRow?.id || '',
    capturedRowType: payload?.capturedRow?.type || '',
    chunk: Math.max(1, Number(payload?.chunk) || 1),
    bodyChunkRatio: Number.isFinite(Number(payload?.bodyChunkRatio)) ? Number(payload.bodyChunkRatio) : null,
    fileCharIndex: Number.isFinite(Number(payload?.fileCharIndex)) ? Math.round(Number(payload.fileCharIndex)) : null,
    fileCharDocumentRatio: Number.isFinite(Number(payload?.fileCharDocumentRatio)) ? Number(payload.fileCharDocumentRatio) : null,
    chunkStateRatio: Number.isFinite(Number(payload?.chunkStateRatio)) ? Number(payload.chunkStateRatio) : null,
    fallbackDocumentRatio: Number.isFinite(Number(payload?.fallbackDocumentRatio)) ? Number(payload.fallbackDocumentRatio) : null,
    manifestDocumentRatio: Number.isFinite(Number(payload?.manifestDocumentRatio)) ? Number(payload.manifestDocumentRatio) : null,
    documentRatio: Number.isFinite(Number(payload?.documentRatio)) ? Number(payload.documentRatio) : null,
    heldByManifestAdoptionGuard: guard?.held === true,
    delta: Number.isFinite(Number(guard?.delta)) ? Number(guard.delta) : null,
    at: Date.now()
  };
  return v.lastProgressStableWithoutManifest;
}


function chunkRatioFallbackToDocumentRatio(app, chunk, ratio = 0) {
  const current = app?.state?.current || null;
  const totalChunks = Math.max(1, Number(current?.totalChunks) || 1);
  const idx = clamp(Number(chunk) || Number(current?.chunk) || 1, 1, totalChunks);
  return clamp(((idx - 1) + clamp(Number(ratio) || 0, 0, 1)) / totalChunks, 0, 1);
}

function resolveViewportFileCharProgress(app, row = null, rowRatio = 0, localCharIndex = 0) {
  if (!row || row.type !== 'body') return null;
  const chunk = Math.max(1, Number(row.chunk) || Number(app?.state?.current?.chunk) || 1);
  const safeRatio = clamp(Number(rowRatio) || 0, 0, 1);
  const fileStart = Number(row.fileCharStart);
  const fileEnd = Number(row.fileCharEnd);
  let fileCharIndex = null;
  let source = '';
  if (Number.isFinite(fileStart) && Number.isFinite(fileEnd) && fileEnd >= fileStart) {
    fileCharIndex = fileStart + Math.max(0, fileEnd - fileStart) * safeRatio;
    source = row.manifestBlockCharRangesPass ? 'manifest-block-char-range' : 'manifest-chunk-char-range';
  } else {
    const absolute = chunkCharToFileChar(app, chunk, localCharIndex);
    if (Number.isFinite(Number(absolute))) {
      fileCharIndex = Number(absolute);
      source = 'chunk-char';
    }
  }
  if (!Number.isFinite(Number(fileCharIndex))) return null;
  const documentRatio = fileCharToDocumentRatio(app, fileCharIndex);
  if (documentRatio == null || !Number.isFinite(Number(documentRatio))) return null;
  const address = fileCharToChunkAddress(app, fileCharIndex);
  const chunkRatio = Number(address?.chunk) === chunk && Number.isFinite(Number(address?.ratio))
    ? clamp(Number(address.ratio), 0, 1)
    : safeRatio;
  return {
    pass: READER_FILE_CHAR_VIEWPORT_PROGRESS_PASS,
    fileCharIndex: Math.max(0, Math.round(Number(fileCharIndex))),
    documentRatio,
    chunkRatio,
    source
  };
}

function resolveManifestAdoptionDocumentRatio(app, payload = {}) {
  const v = ensureVirtualState(app);
  const exactManifest = payload?.exactManifest === true;
  const fallback = clamp(Number(payload?.fallbackDocumentRatio) || 0, 0, 1);
  const rawManifest = payload?.manifestDocumentRatio;
  const manifestValue = rawManifest == null ? NaN : Number(rawManifest);
  const manifest = Number.isFinite(manifestValue) ? clamp(manifestValue, 0, 1) : null;
  const current = app?.state?.current || null;
  const now = Date.now();
  const activeUserScroll = isVirtualScrollActive(v, now) && isUserScrollSource(v.lastUserScrollSource);
  const inSeamBand = fallback >= 0.68 && fallback <= 0.86;
  const delta = manifest == null ? 0 : manifest - fallback;
  const significantBackward = delta <= -0.02;
  const significantJump = Math.abs(delta) >= 0.04;
  const multiFile = !!(current?.novel?.isMultiFile && current?.episode);
  const mobileMultiFile = !!(multiFile && typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)')?.matches || Math.min(window.innerWidth || 9999, window.innerHeight || 9999) <= 900));
  const lateActiveManifestHold = !!(multiFile && fallback > 0.86 && fallback < 0.985 && significantBackward);
  const legacyWouldHold = !!(exactManifest && manifest != null && activeUserScroll && ((inSeamBand && (significantBackward || significantJump || mobileMultiFile)) || lateActiveManifestHold));
  const shouldHold = false;
  const result = {
    pass: READER_MANIFEST_ADOPTION_GUARD_PASS,
    cleanupPass: READER_MULTI_FILE_GUARD_CLEANUP_PASS,
    legacyWouldHold,
    mode: !exactManifest || manifest == null
      ? 'chunk-ratio-fallback'
      : shouldHold
        ? 'manifest-adoption-held-fallback'
        : 'manifest-block-ratio',
    exactManifest,
    held: shouldHold,
    activeUserScroll,
    inSeamBand,
    lateActiveManifestHold,
    cleanupReason: legacyWouldHold ? 'legacy multi-file seam-band manifest hold disabled; file-char/manifest coordinates are now adopted directly' : '',
    chunk: Math.max(1, Number(payload?.chunk) || Number(current?.chunk) || 1),
    fallbackDocumentRatio: fallback,
    manifestDocumentRatio: manifest,
    documentRatio: shouldHold || manifest == null ? fallback : manifest,
    delta: manifest == null ? null : delta,
    rowId: payload?.row?.id || '',
    rowType: payload?.row?.type || '',
    capturedRowId: payload?.capturedRow?.id || '',
    capturedRowType: payload?.capturedRow?.type || '',
    episodeId: current?.episode?.id || null,
    multiFile,
    at: now
  };
  v.manifestAdoptionGuardPass = READER_MANIFEST_ADOPTION_GUARD_PASS;
  v.lastManifestAdoptionGuard = result;
  if (legacyWouldHold) {
    v.multiFileGuardCleanupPass = READER_MULTI_FILE_GUARD_CLEANUP_PASS;
    v.lastMultiFileGuardCleanup = { pass: READER_MULTI_FILE_GUARD_CLEANUP_PASS, phase: 'manifest-adoption', removedBehavior: 'multi-file-seam-band-manifest-hold', fallbackDocumentRatio: fallback, manifestDocumentRatio: manifest, documentRatio: result.documentRatio, inSeamBand, lateActiveManifestHold, at: now };
  }
  return result;
}

function recordProgressPhaseReport(app, payload = {}) {
  const v = ensureVirtualState(app);
  const guard = payload?.guard || null;
  const report = {
    pass: READER_PROGRESS_PHASE_REPORT_PASS,
    phase: guard?.held ? 'manifest-adoption-held' : (payload?.exactManifest === true ? 'manifest-adoption' : 'fallback-progress'),
    mode: guard?.mode || '',
    chunk: Math.max(1, Number(payload?.chunk) || 1),
    rowId: payload?.row?.id || '',
    rowType: payload?.row?.type || '',
    capturedRowId: payload?.capturedRow?.id || '',
    capturedRowType: payload?.capturedRow?.type || '',
    bodyChunkRatio: Number.isFinite(Number(payload?.bodyChunkRatio)) ? Number(payload.bodyChunkRatio) : null,
    fileCharIndex: Number.isFinite(Number(payload?.fileCharIndex)) ? Math.round(Number(payload.fileCharIndex)) : null,
    fileCharDocumentRatio: Number.isFinite(Number(payload?.fileCharDocumentRatio)) ? Number(payload.fileCharDocumentRatio) : null,
    chunkStateRatio: Number.isFinite(Number(payload?.chunkStateRatio)) ? Number(payload.chunkStateRatio) : null,
    fallbackDocumentRatio: Number.isFinite(Number(payload?.fallbackDocumentRatio)) ? Number(payload.fallbackDocumentRatio) : null,
    manifestDocumentRatio: Number.isFinite(Number(payload?.manifestDocumentRatio)) ? Number(payload.manifestDocumentRatio) : null,
    documentRatio: Number.isFinite(Number(payload?.documentRatio)) ? Number(payload.documentRatio) : null,
    heldByManifestAdoptionGuard: guard?.held === true,
    activeUserScroll: guard?.activeUserScroll === true,
    at: Date.now()
  };
  v.progressPhaseReportPass = READER_PROGRESS_PHASE_REPORT_PASS;
  v.lastProgressPhaseReport = report;
  if (false && Number(report.fallbackDocumentRatio) >= 0.68 && Number(report.fallbackDocumentRatio) <= 0.86) {
    v.appendSeam7085FixturePass = READER_APPEND_SEAM_70_85_FIXTURE_PASS;
    v.lastAppendSeam7085Fixture = {
      pass: READER_APPEND_SEAM_70_85_FIXTURE_PASS,
      phase: report.phase,
      mode: report.mode,
      chunk: report.chunk,
      fallbackDocumentRatio: report.fallbackDocumentRatio,
      manifestDocumentRatio: report.manifestDocumentRatio,
      fileCharIndex: report.fileCharIndex,
      fileCharDocumentRatio: report.fileCharDocumentRatio,
      heldByManifestAdoptionGuard: report.heldByManifestAdoptionGuard,
      at: report.at
    };
  }
  if (payload?.exactManifest === true && (resolveRecentForwardScrollBufferAppend(v).recent || isAppendCorrectionGuardWindowActive(v))) {
    v.appendSeamProgressDiagnosticPass = READER_APPEND_SEAM_PROGRESS_DIAGNOSTIC_PASS;
    v.lastAppendSeamProgressDiagnostic = {
      pass: READER_APPEND_SEAM_PROGRESS_DIAGNOSTIC_PASS,
      phase: report.phase,
      mode: report.mode,
      chunk: report.chunk,
      fileCharViewportProgressPass: READER_FILE_CHAR_VIEWPORT_PROGRESS_PASS,
      fileCharIndex: report.fileCharIndex,
      fileCharDocumentRatio: report.fileCharDocumentRatio,
      fallbackDocumentRatio: report.fallbackDocumentRatio,
      manifestDocumentRatio: report.manifestDocumentRatio,
      documentRatio: report.documentRatio,
      heldByManifestAdoptionGuard: report.heldByManifestAdoptionGuard,
      reason: 'append/seam progress diagnostic records file-char ratio against fallback/manifest ratios',
      at: report.at
    };
  }
  return report;
}

function resolveVisibleBodyChunkRatio(app, rowInfo, v = null) {
  const state = v || ensureVirtualState(app);
  const row = rowInfo?.row || null;
  if (!row || row.type !== 'body') return null;
  const chunk = Number(row.chunk) || Number(app?.state?.current?.chunk) || 1;
  const indexes = state.rowIndexesByChunk?.get(chunk) || [];
  let bodyCount = 0;
  for (const index of indexes) if (state.rows[index]?.type === 'body') bodyCount += 1;
  const blockIndex = Math.max(0, Number(row.blockIndex) || 0);
  if (!bodyCount) return null;
  const reader = app?.els?.reader || null;
  const rowHeight = Math.max(1, Number(rowInfo.bottom) - Number(rowInfo.top) || 1);
  const rowRatio = clamp(((Number(reader?.scrollTop) || 0) + VIRTUAL_SCROLL_STABILITY_ANCHOR_OFFSET_PX - Number(rowInfo.top || 0)) / rowHeight, 0, 1);
  return clamp((Math.min(blockIndex, bodyCount - 1) + rowRatio) / Math.max(1, bodyCount), 0, 1);
}



function resolveTrustedBottomProgress(app, payload = {}) {
  const v = ensureVirtualState(app);
  const totalChunks = Math.max(1, Number(payload.totalChunks) || 1);
  const maxLoadedChunk = Math.max(1, Number(payload.maxLoadedChunk) || 1);
  const chunk = Math.max(1, Number(payload.chunk) || 1);
  const rowCount = Math.max(0, Number(payload.rowCount) || 0);
  const rowIndex = Number.isFinite(Number(payload.rowIndex)) ? Math.round(Number(payload.rowIndex)) : -1;
  const remainingBottom = Math.max(0, Number(payload.remainingBottom) || 0);
  const virtualRemainingBottom = Math.max(0, Number(payload.virtualRemainingBottom) || 0);
  const terminalRowsRemaining = rowIndex >= 0 && rowCount > 0 ? Math.max(0, rowCount - rowIndex - 1) : Infinity;
  const terminal = maxLoadedChunk >= totalChunks && chunk >= totalChunks;
  const actualBottom = terminal && remainingBottom <= 2;
  const virtualBottom = virtualRemainingBottom <= 2;
  const viewportAnchorTerminal = virtualBottom && terminalRowsRemaining <= 1;
  const trusted = terminal && actualBottom && (virtualBottom || viewportAnchorTerminal || terminalRowsRemaining >= 0);
  const trustMode = trusted
    ? (virtualBottom && terminalRowsRemaining <= 1 ? 'actual-virtual-terminal-row' : 'actual-dom-terminal-bottom')
    : '';
  if (trusted && trustMode === 'actual-dom-terminal-bottom') {
    v.actualBottomProgressTrustPass = READER_ACTUAL_BOTTOM_PROGRESS_TRUST_PASS;
    v.lastActualBottomProgressTrust = {
      pass: READER_ACTUAL_BOTTOM_PROGRESS_TRUST_PASS,
      remainingBottom: Math.round(remainingBottom),
      virtualRemainingBottom: Math.round(virtualRemainingBottom),
      rowIndex,
      rowCount,
      terminalRowsRemaining: Number.isFinite(terminalRowsRemaining) ? terminalRowsRemaining : null,
      reason: 'actual DOM bottom is authoritative for terminal progress; viewport anchor row may still be above the last body row on tall screens',
      at: Date.now()
    };
  }
  const result = {
    pass: READER_TRUSTED_BOTTOM_PROGRESS_PASS,
    actualBottomProgressTrustPass: trusted && trustMode === 'actual-dom-terminal-bottom' ? READER_ACTUAL_BOTTOM_PROGRESS_TRUST_PASS : '',
    trustMode,
    trusted,
    reason: trusted
      ? (trustMode === 'actual-dom-terminal-bottom' ? 'actual DOM bottom reached at terminal chunk' : 'dom and virtual bottoms agree at terminal row')
      : !terminal
        ? 'not terminal chunk or final chunk not loaded'
        : remainingBottom > 2
          ? 'dom bottom still has remaining space'
          : virtualRemainingBottom > 2
            ? 'actual bottom reached but virtual bottom accounting still has remaining space'
            : 'visible row is not terminal enough for 100% clamp',
    chunk,
    totalChunks,
    maxLoadedChunk,
    remainingBottom: Math.round(remainingBottom),
    virtualRemainingBottom: Math.round(virtualRemainingBottom),
    rowIndex,
    rowCount,
    terminalRowsRemaining: Number.isFinite(terminalRowsRemaining) ? terminalRowsRemaining : null,
    rowId: String(payload.rowId || '')
  };
  v.trustedBottomProgressPass = READER_TRUSTED_BOTTOM_PROGRESS_PASS;
  v.lastTrustedBottomProgress = { ...result, at: Date.now() };
  return result;
}

export function invalidateVirtualLayout(app) {
  const v = ensureVirtualState(app);
  v.measureCache.clear();
  v.renderedStart = -1;
  v.renderedEnd = -1;
  recalcVirtualLayout(app);
  scheduleVirtualRender(app);
}

export function pruneVirtualMeasureCache(app) {
  const v = ensureVirtualState(app);
  if (!(v.measureCache instanceof Map) || !v.measureCache.size) return;
  const liveIds = new Set(v.rows.map(row => row.id));
  for (const key of Array.from(v.measureCache.keys())) {
    if (!liveIds.has(key)) v.measureCache.delete(key);
  }
}

export function pruneVirtualRowElementPool(app) {
  const v = ensureVirtualState(app);
  if (!(v.rowElementPool instanceof Map) || !v.rowElementPool.size) return;
  const stats = v.rowElementPoolStats || createRowElementPoolStats();
  const liveIds = new Set((v.rows || []).map(row => row?.id).filter(Boolean));
  for (const key of Array.from(v.rowElementPool.keys())) {
    if (!liveIds.has(key)) {
      v.rowElementPool.delete(key);
      stats.pruned += 1;
    }
  }
  while (v.rowElementPool.size > VIRTUAL_ROW_DOM_POOL_MAX) {
    let victimKey = '';
    let oldest = Number.POSITIVE_INFINITY;
    for (const [key, entry] of v.rowElementPool.entries()) {
      const lastUsed = Number(entry?.lastUsed) || 0;
      if (lastUsed < oldest) { oldest = lastUsed; victimKey = key; }
    }
    if (!victimKey) break;
    v.rowElementPool.delete(victimKey);
    stats.evicted += 1;
  }
  v.rowElementPoolStats = stats;
}
