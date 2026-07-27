import { buildVirtualLayoutCopyLabel, buildVirtualLayoutExportShapeReport, buildVirtualLayoutReportSummary } from './virtual-layout-report-labels.mjs';
import { buildReaderManualDiagnosticsSnapshot } from './manual-diagnostics-snapshot.mjs';

export const READER_VIRTUAL_LAYOUT_DIAGNOSTICS_HELPER_PASS = 'v220-reader-virtual-layout-diagnostics-helper-pass';
export const READER_VIRTUAL_LAYOUT_DIAGNOSTICS_BOUNDARY_PASS = 'v222-reader-virtual-layout-diagnostics-boundary-pass';
export const READER_VIRTUAL_LAYOUT_DIAGNOSTICS_REPORT_SURFACE_PASS = 'v223-reader-virtual-layout-diagnostics-report-surface-pass';
export const READER_ANCHOR_TRACE_DIAGNOSTICS_PASS = 'v444-reader-anchor-trace-diagnostics-pass';
export const READER_ROW_MEASURE_CACHE_DIAGNOSTICS_PASS = 'v453-reader-row-measure-cache-diagnostics-pass';
export const READER_DEBUG_SNAPSHOT_PROGRESS_PASS = 'v487-reader-debug-snapshot-progress-pass';

export function createVirtualLayoutUnavailableDiagnostics(content = null, reason = 'virtual state not initialized') {
  return {
    available: false,
    reason,
    mountedRows: content ? content.querySelectorAll?.('.reader-vrow[data-virtual-id]')?.length || 0 : 0
  };
}


function buildRowMeasureCacheDiagnostics({ rows = [], liveMeasureCacheSize = 0, measureCacheSize = 0, rowElementPoolStats = null, rowElementPoolSize = 0, mountedRows = 0 } = {}) {
  const rowCount = Array.isArray(rows) ? rows.length : 0;
  const live = Math.max(0, Number(liveMeasureCacheSize) || 0);
  const measured = Math.max(0, Number(measureCacheSize) || 0);
  const mounted = Math.max(0, Number(mountedRows) || 0);
  const pool = rowElementPoolStats && typeof rowElementPoolStats === 'object' ? rowElementPoolStats : {};
  const reused = Math.max(0, Number(pool.reused) || 0);
  const created = Math.max(0, Number(pool.created) || 0);
  const poolOps = reused + created;
  return {
    pass: READER_ROW_MEASURE_CACHE_DIAGNOSTICS_PASS,
    rowCount,
    liveMeasureCacheSize: live,
    measureCacheSize: measured,
    staleMeasureCacheSize: Math.max(0, measured - live),
    measureCoverageRatio: rowCount ? Math.round((live / rowCount) * 10000) / 10000 : 0,
    rowElementPoolSize: Math.max(0, Number(rowElementPoolSize) || 0),
    mountedRows: mounted,
    poolReuseRatio: poolOps ? Math.round((reused / poolOps) * 10000) / 10000 : 0,
    lastRenderReused: Math.max(0, Number(pool.lastRenderReused) || 0),
    lastRenderCreated: Math.max(0, Number(pool.lastRenderCreated) || 0)
  };
}

function normalizeAnchorTraceEvent(event = {}) {
  return {
    pass: event.pass || READER_ANCHOR_TRACE_DIAGNOSTICS_PASS,
    seq: Math.max(0, Number(event.seq) || 0),
    event: String(event.event || ''),
    mode: event.mode === 'multi-file' ? 'multi-file' : 'single-file',
    phase: String(event.phase || ''),
    anchorType: String(event.anchorType || ''),
    source: String(event.source || ''),
    direction: String(event.direction || ''),
    traceId: String(event.traceId || ''),
    applied: event.applied === true,
    reason: String(event.reason || ''),
    suppressedBy: String(event.suppressedBy || ''),
    rowId: String(event.rowId || ''),
    rowIndex: Number.isFinite(Number(event.rowIndex)) ? Number(event.rowIndex) : -1,
    capturedRowId: String(event.capturedRowId || ''),
    capturedRowIndex: Number.isFinite(Number(event.capturedRowIndex)) ? Number(event.capturedRowIndex) : -1,
    bodyAnchorAdjusted: event.bodyAnchorAdjusted === true,
    deltaPx: Math.round(Number(event.deltaPx) || 0),
    offsetPx: Math.round(Number(event.offsetPx) || 0),
    anchorOffsetPx: Math.round(Number(event.anchorOffsetPx) || 0),
    chunk: Math.max(1, Math.round(Number(event.chunk) || 1)),
    totalChunks: Math.max(1, Math.round(Number(event.totalChunks) || 1)),
    episodeIdx: Number.isFinite(Number(event.episodeIdx)) ? Number(event.episodeIdx) : -1,
    episodeCount: Math.max(0, Math.round(Number(event.episodeCount) || 0)),
    hasEpisode: event.hasEpisode === true,
    loadedChunks: Math.max(0, Math.round(Number(event.loadedChunks) || 0)),
    renderedStart: Number.isFinite(Number(event.renderedStart)) ? Number(event.renderedStart) : -1,
    renderedEnd: Number.isFinite(Number(event.renderedEnd)) ? Number(event.renderedEnd) : -1,
    layoutRevision: Math.max(0, Math.round(Number(event.layoutRevision) || 0)),
    scrollTop: Math.max(0, Math.round(Number(event.scrollTop) || 0)),
    clientHeight: Math.max(0, Math.round(Number(event.clientHeight) || 0)),
    scrollHeight: Math.max(0, Math.round(Number(event.scrollHeight) || 0)),
    scrollHeightSource: String(event.scrollHeightSource || ''),
    lowOverheadPass: String(event.lowOverheadPass || ''),
    at: Math.max(0, Number(event.at) || 0)
  };
}

function summarizeAnchorTrace(trace = [], current = null) {
  const events = (Array.isArray(trace) ? trace : []).map(normalizeAnchorTraceEvent);
  const recent = events.slice(-16);
  const singleFileEvents = recent.filter(event => event.mode === 'single-file').length;
  const multiFileEvents = recent.filter(event => event.mode === 'multi-file').length;
  const appliedCount = recent.filter(event => event.applied === true).length;
  const suppressedCount = recent.filter(event => /suppress|freeze|guard|missing|skipped/i.test(event.reason + ' ' + event.suppressedBy)).length;
  const last = recent.at?.(-1) || null;
  const currentMode = current?.novel?.isMultiFile && current?.episode ? 'multi-file' : 'single-file';
  return {
    pass: READER_ANCHOR_TRACE_DIAGNOSTICS_PASS,
    currentMode,
    count: recent.length,
    totalCount: events.length,
    singleFileEvents,
    multiFileEvents,
    appliedCount,
    suppressedCount,
    lastEvent: last ? {
      seq: last.seq,
      event: last.event,
      mode: last.mode,
      phase: last.phase,
      anchorType: last.anchorType,
      applied: last.applied,
      reason: last.reason,
      rowId: last.rowId,
      rowIndex: last.rowIndex,
      deltaPx: last.deltaPx
    } : null,
    label: recent.length ? `anchor trace ${recent.length} · single ${singleFileEvents} · multi ${multiFileEvents} · applied ${appliedCount}` : `anchor trace none · ${currentMode}`
  };
}

export function buildVirtualLayoutDiagnosticsSnapshot({ app = null, v = null, content = null, reader = null, constants = {}, createVelocityBufferStats = null, createRowElementPoolStats = null } = {}) {
  const rows = Array.isArray(v?.rows) ? v.rows : [];
  const liveIds = new Set(rows.map(row => row?.id).filter(Boolean));
  const measureKeys = v?.measureCache instanceof Map ? Array.from(v.measureCache.keys()) : [];
  const liveMeasureCacheSize = measureKeys.filter(key => liveIds.has(key)).length;
  const renderedStart = Number(v?.renderedStart);
  const renderedEnd = Number(v?.renderedEnd);
  const renderedRows = renderedStart >= 0 && renderedEnd >= renderedStart ? Math.max(0, renderedEnd - renderedStart) : 0;
  const rowIndexesByChunk = v?.rowIndexesByChunk instanceof Map ? v.rowIndexesByChunk : new Map();
  const bodyRows = rows.filter(row => row?.type === 'body').length;
  const headerRows = rows.filter(row => row?.type === 'header').length;
  const mountedRows = content ? content.querySelectorAll?.('.reader-vrow[data-virtual-id]')?.length || 0 : 0;
  const mountedBodyRows = content ? content.querySelectorAll?.('.reader-vrow-body[data-virtual-id]')?.length || 0 : 0;
  const rowElementPoolSize = v?.rowElementPool instanceof Map ? v.rowElementPool.size : 0;
  const rowElementPoolStats = v?.rowElementPoolStats || createRowElementPoolStats?.() || null;
  const rowMeasureCacheDiagnostics = buildRowMeasureCacheDiagnostics({ rows, liveMeasureCacheSize, measureCacheSize: measureKeys.length, rowElementPoolStats, rowElementPoolSize, mountedRows });
  const diagnostics = {
    available: true,
    rows: rows.length,
    bodyRows,
    headerRows,
    loadedChunks: app?.state?.loadedChunks?.size || 0,
    indexedChunks: rowIndexesByChunk.size,
    renderedStart: Number.isFinite(renderedStart) ? renderedStart : -1,
    renderedEnd: Number.isFinite(renderedEnd) ? renderedEnd : -1,
    renderedRows,
    bufferPass: v?.bufferPass || constants.scrollBufferPass,
    velocityBufferPass: v?.velocityBufferPass || constants.velocityBufferPass,
    velocityBufferStats: v?.velocityBufferStats || createVelocityBufferStats?.() || null,
    rowElementPoolPass: v?.rowElementPoolPass || constants.rowDomPoolPass,
    rowMeasuredMarginHeightPass: v?.rowMeasuredMarginHeightPass || constants.rowMeasuredMarginHeightPass || '',
    lastRowMeasuredMarginHeight: v?.lastRowMeasuredMarginHeight || null,
    actualBottomProgressTrustPass: v?.actualBottomProgressTrustPass || constants.actualBottomProgressTrustPass || '',
    lastActualBottomProgressTrust: v?.lastActualBottomProgressTrust || constants.lastActualBottomProgressTrust || null,
    multiFileGuardCleanupPass: v?.multiFileGuardCleanupPass || constants.multiFileGuardCleanupPass || '',
    lastMultiFileGuardCleanup: v?.lastMultiFileGuardCleanup || constants.lastMultiFileGuardCleanup || null,
    searchTargetResolutionPass: v?.searchTargetResolutionPass || constants.searchTargetResolutionPass,
    scrollStabilityPass: v?.scrollStabilityPass || constants.scrollStabilityPass,
    multiFileBodyAnchorPass: v?.multiFileBodyAnchorPass || constants.multiFileBodyAnchorPass || '',
    multiFileNativeExactAnchorPass: v?.multiFileNativeExactAnchorPass || constants.multiFileNativeExactAnchorPass || '',
    multiFileBottomAnchorNativeGuardPass: v?.multiFileBottomAnchorNativeGuardPass || constants.multiFileBottomAnchorNativeGuardPass || '',
    multiFileNativeScrollSettleExactAnchorPass: v?.multiFileNativeScrollSettleExactAnchorPass || constants.multiFileNativeScrollSettleExactAnchorPass || '',
    lastMultiFileNativeScrollSettleExactAnchor: v?.lastMultiFileNativeScrollSettleExactAnchor || null,
    scrollSettleExactAnchorRestorePass: v?.scrollSettleExactAnchorRestorePass || constants.scrollSettleExactAnchorRestorePass || '',
    lastScrollSettleExactAnchorRestore: v?.lastScrollSettleExactAnchorRestore || null,
    lastMultiFileNativeExactAnchor: v?.lastMultiFileNativeExactAnchor || null,
    lastMultiFileBottomAnchorNativeGuard: v?.lastMultiFileBottomAnchorNativeGuard || null,
    bodyAnchorInertiaRetainPass: v?.bodyAnchorInertiaRetainPass || constants.bodyAnchorInertiaRetainPass || '',
    lastBodyAnchorInertiaRetain: v?.lastBodyAnchorInertiaRetain || null,
    safeAreaBodyRowProgressPass: v?.safeAreaBodyRowProgressPass || constants.safeAreaBodyRowProgressPass || '',
    progressStableWithoutManifestPass: v?.progressStableWithoutManifestPass || constants.progressStableWithoutManifestPass || '',
    progressPhaseReportPass: v?.progressPhaseReportPass || constants.progressPhaseReportPass || '',
    manifestAdoptionGuardPass: v?.manifestAdoptionGuardPass || constants.manifestAdoptionGuardPass || '',
    appendSeam7085FixturePass: v?.appendSeam7085FixturePass || constants.appendSeam7085FixturePass || '',
    manifestBlockFallbackProgressPass: v?.manifestBlockFallbackProgressPass || constants.manifestBlockFallbackProgressPass || '',
    lastManifestBlockFallbackProgress: v?.lastManifestBlockFallbackProgress || null,
    episodeBottomAnchorStrictGatePass: v?.episodeBottomAnchorStrictGatePass || constants.episodeBottomAnchorStrictGatePass || '',
    lastEpisodeBottomAnchorStrictGate: v?.lastEpisodeBottomAnchorStrictGate || null,
    appendSeamProgressDiagnosticPass: v?.appendSeamProgressDiagnosticPass || constants.appendSeamProgressDiagnosticPass || '',
    lastAppendSeamProgressDiagnostic: v?.lastAppendSeamProgressDiagnostic || null,
    appendSeamScrollTopDiagnosticPass: v?.appendSeamScrollTopDiagnosticPass || constants.appendSeamScrollTopDiagnosticPass || '',
    lastAppendSeamScrollTopDiagnostic: v?.lastAppendSeamScrollTopDiagnostic || null,
    prependSeamScrollTopDiagnosticPass: v?.prependSeamScrollTopDiagnosticPass || constants.prependSeamScrollTopDiagnosticPass || '',
    lastPrependSeamScrollTopDiagnostic: v?.lastPrependSeamScrollTopDiagnostic || null,
    debugSnapshotProgressPass: READER_DEBUG_SNAPSHOT_PROGRESS_PASS,
    lastReaderSliderProgressDiagnostic: app?.state?.lastReaderSliderProgressDiagnostic || null,
    lastReaderCoordinatePolicy: app?.state?.lastReaderCoordinatePolicy || null,
    lastSafeAreaMultiFileProgress: app?.state?.lastSafeAreaMultiFileProgress || null,
    lastAppendFileCharAnchorCapture: v?.lastAppendFileCharAnchorCapture || null,
    lastAppendFileCharAnchorRestore: v?.lastAppendFileCharAnchorRestore || null,
    lastPrependFileCharAnchorCapture: v?.lastPrependFileCharAnchorCapture || null,
    lastPrependFileCharAnchorRestore: v?.lastPrependFileCharAnchorRestore || null,
    nativeForwardMeasureFreezePass: v?.nativeForwardMeasureFreezePass || constants.nativeForwardMeasureFreezePass || '',
    lastNativeForwardMeasureFreeze: v?.lastNativeForwardMeasureFreeze || null,
    nativeBackwardMeasureFreezePass: v?.nativeBackwardMeasureFreezePass || constants.nativeBackwardMeasureFreezePass || '',
    lastNativeBackwardMeasureFreeze: v?.lastNativeBackwardMeasureFreeze || null,
    scrollBufferAppendInertiaExtendPass: v?.scrollBufferAppendInertiaExtendPass || constants.scrollBufferAppendInertiaExtendPass || '',
    lastScrollBufferAppendInertiaExtend: v?.lastScrollBufferAppendInertiaExtend || null,
    appendMicroCorrectionDampPass: v?.appendMicroCorrectionDampPass || constants.appendMicroCorrectionDampPass || '',
    lastAppendMicroCorrectionDamp: v?.lastAppendMicroCorrectionDamp || null,
    ipadScrollCoastRetainPass: v?.ipadScrollCoastRetainPass || constants.ipadScrollCoastRetainPass || '',
    ipadTouchNativeScrollAnchorPass: v?.ipadTouchNativeScrollAnchorPass || constants.ipadTouchNativeScrollAnchorPass || '',
    lastIpadTouchNativeScrollAnchor: v?.lastIpadTouchNativeScrollAnchor || null,
    lastIpadScrollCoastRetain: v?.lastIpadScrollCoastRetain || null,
    lastSafeAreaBodyRowProgress: v?.lastSafeAreaBodyRowProgress || null,
    lastProgressStableWithoutManifest: v?.lastProgressStableWithoutManifest || null,
    lastProgressPhaseReport: v?.lastProgressPhaseReport || null,
    lastManifestAdoptionGuard: v?.lastManifestAdoptionGuard || null,
    lastAppendSeam7085Fixture: v?.lastAppendSeam7085Fixture || null,
    bufferAppendCurrentChunkRetainPass: v?.bufferAppendCurrentChunkRetainPass || constants.bufferAppendCurrentChunkRetainPass || '',
    lastBufferAppendCurrentChunkRetain: v?.lastBufferAppendCurrentChunkRetain || null,
    inertiaFixtureExpansionPass: v?.inertiaFixtureExpansionPass || constants.inertiaFixtureExpansionPass || '',
    anchorTracePass: v?.anchorTracePass || constants.anchorTracePass || READER_ANCHOR_TRACE_DIAGNOSTICS_PASS,
    anchorTraceLowOverheadPass: v?.anchorTraceLowOverheadPass || constants.anchorTraceLowOverheadPass || '',
    anchorTraceLimit: Math.max(1, Number(constants.anchorTraceLimit) || 32),
    anchorTraceStats: v?.anchorTraceStats && typeof v.anchorTraceStats === 'object' ? {
      pushed: Math.max(0, Number(v.anchorTraceStats.pushed) || 0),
      dropped: Math.max(0, Number(v.anchorTraceStats.dropped) || 0),
      maxEvents: Math.max(1, Number(v.anchorTraceStats.maxEvents) || Math.max(1, Number(constants.anchorTraceLimit) || 32))
    } : null,
    anchorTrace: (Array.isArray(v?.anchorTrace) ? v.anchorTrace : []).slice(-Math.max(1, Number(constants.anchorTraceLimit) || 32)).map(normalizeAnchorTraceEvent),
    anchorTraceSummary: summarizeAnchorTrace(v?.anchorTrace, app?.state?.current || null),
    lastAnchorTraceEvent: v?.lastAnchorTraceEvent ? normalizeAnchorTraceEvent(v.lastAnchorTraceEvent) : null,
    lastScrollStability: v?.lastScrollStability || null,
    lastUserScrollSource: v?.lastUserScrollSource || '',
    userScrollActive: Date.now() < (Number(v?.userScrollActiveUntil) || 0),
    measureDeferralCount: Number(v?.measureDeferralCount) || 0,
    renderReuseCount: Number(v?.renderReuseCount) || 0,
    lastRenderReuse: v?.lastRenderReuse || null,
    renderWindowAnchorPass: v?.renderWindowAnchorPass || constants.renderWindowAnchorPass || '',
    lastRenderWindowStability: v?.lastRenderWindowStability || null,
    scrollSettleCompactionPass: v?.scrollSettleCompactionPass || constants.scrollSettleCompactionPass || '',
    lastScrollSettleCompaction: v?.lastScrollSettleCompaction || null,
    activeRenderPatchPass: v?.activeRenderPatchPass || constants.activeRenderPatchPass || '',
    lastActiveRenderPatch: v?.lastActiveRenderPatch || null,
    scrollSettleNativeFreezePass: v?.scrollSettleNativeFreezePass || constants.scrollSettleNativeFreezePass || '',
    lastScrollSettleNativeFreeze: v?.lastScrollSettleNativeFreeze || null,
    nativeForwardScrollRetainPass: v?.nativeForwardScrollRetainPass || constants.nativeForwardScrollRetainPass || '',
    lastNativeForwardScrollRetain: v?.lastNativeForwardScrollRetain || null,
    nativeForwardSeamTransitLockPass: v?.nativeForwardSeamTransitLockPass || constants.nativeForwardSeamTransitLockPass || '',
    lastNativeForwardSeamTransitLock: v?.lastNativeForwardSeamTransitLock || null,
    nativeForwardSeamRenderHoldPass: v?.nativeForwardSeamRenderHoldPass || constants.nativeForwardSeamRenderHoldPass || '',
    lastNativeForwardSeamRenderHold: v?.lastNativeForwardSeamRenderHold || null,
    seamTransitMeasureDeferPass: v?.seamTransitMeasureDeferPass || constants.seamTransitMeasureDeferPass || '',
    lastSeamTransitMeasureDefer: v?.lastSeamTransitMeasureDefer || null,
    scrollAppendChunkWindowDeferPass: v?.scrollAppendChunkWindowDeferPass || constants.scrollAppendChunkWindowDeferPass || '',
    activeForwardRenderAnchorSuppressPass: v?.activeForwardRenderAnchorSuppressPass || constants.activeForwardRenderAnchorSuppressPass || '',
    scrollInputDiagnosticsPass: v?.scrollInputDiagnosticsPass || constants.scrollInputDiagnosticsPass || '',
    scrollInputStats: v?.scrollInputStats || null,
    lastSearchTargetResolution: v?.lastSearchTargetResolution || null,
    overscanMinPx: constants.overscanMinPx,
    overscanViewportMultiplier: constants.overscanViewportMultiplier,
    overscanMaxPx: constants.overscanMaxPx,
    overscanVelocityBoostMaxPx: constants.overscanVelocityBoostMaxPx,
    maxRenderedRows: constants.maxRenderedRows,
    rowElementPoolMax: constants.rowElementPoolMax,
    mountedRows,
    mountedBodyRows,
    measureCacheSize: measureKeys.length,
    rowElementPoolSize,
    rowElementPoolStats,
    rowMeasureCacheDiagnosticsPass: READER_ROW_MEASURE_CACHE_DIAGNOSTICS_PASS,
    rowMeasureCacheDiagnostics,
    liveMeasureCacheSize,
    staleMeasureCacheSize: Math.max(0, measureKeys.length - liveMeasureCacheSize),
    heightCount: Array.isArray(v?.heights) ? v.heights.length : 0,
    prefixCount: Array.isArray(v?.prefix) ? v.prefix.length : 0,
    estimatedRows: Math.max(0, rows.length - liveMeasureCacheSize),
    totalHeight: Math.round(Number(v?.totalHeight) || 0),
    readerScrollTop: Math.round(Number(reader?.scrollTop) || 0),
    readerClientHeight: Math.round(Number(reader?.clientHeight) || 0),
    pendingScrollTarget: !!v?.pendingScrollTarget,
    pendingFocusTries: Number(v?.pendingFocusTries) || 0,
    renderScheduled: !!v?.renderRaf,
    measureScheduled: !!v?.measureRaf,
    measureIdleScheduled: !!v?.measureIdleTimer,
    scrollActiveGraceMs: constants.scrollActiveGraceMs,
    measureIdleGraceMs: constants.measureIdleGraceMs,
    renderReuseMarginMinPx: constants.renderReuseMarginMinPx,
    renderReuseMarginViewportMultiplier: constants.renderReuseMarginViewportMultiplier,
    layoutRevision: Number(v?.layoutRevision) || 0
  };
  diagnostics.manualDiagnosticsSnapshot = buildReaderManualDiagnosticsSnapshot(app, diagnostics);
  return diagnostics;
}


export function buildVirtualLayoutDiagnosticsBoundary({ app = null, v = null, content = null, reader = null, constants = {}, createVelocityBufferStats = null, createRowElementPoolStats = null } = {}) {
  if (!v) return attachVirtualLayoutDiagnosticsReportSurface(createVirtualLayoutUnavailableDiagnostics(content));
  return attachVirtualLayoutDiagnosticsReportSurface(buildVirtualLayoutDiagnosticsSnapshot({
    app,
    v,
    content,
    reader,
    constants,
    createVelocityBufferStats,
    createRowElementPoolStats
  }));
}

export function buildVirtualLayoutDiagnosticsReportSurface(diagnostics = {}) {
  const summary = buildVirtualLayoutReportSummary(diagnostics);
  return {
    pass: READER_VIRTUAL_LAYOUT_DIAGNOSTICS_REPORT_SURFACE_PASS,
    ...summary,
    copyLabel: buildVirtualLayoutCopyLabel(diagnostics),
    exportShapeReport: buildVirtualLayoutExportShapeReport(diagnostics)
  };
}

export function attachVirtualLayoutDiagnosticsReportSurface(diagnostics = {}) {
  return {
    ...diagnostics,
    reportSurface: buildVirtualLayoutDiagnosticsReportSurface(diagnostics)
  };
}
