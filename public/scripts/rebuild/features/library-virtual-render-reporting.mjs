import { getLibraryWindowDomMetrics } from './library-row-diagnostics.mjs';

export const LIBRARY_VIRTUAL_RENDER_REPORTING_SPLIT_PASS = 'v206-library-virtual-render-reporting-split-pass';
export const LIBRARY_VIRTUAL_SCROLL_ROW_HEIGHT_FREEZE_PASS = 'v508-library-virtual-scroll-row-height-freeze-pass';

function clampLibraryRowHeight(value, fallback = 56) {
  const n = Number(value);
  const base = Number.isFinite(n) && n > 0 ? n : fallback;
  return Math.max(24, Math.min(160, Math.round(base || 56)));
}

function resolveStableLibraryRowHeight(app, measuredRowHeight, options = {}) {
  const measured = clampLibraryRowHeight(measuredRowHeight);
  if (options.source === 'virtual-scroll') {
    const stable = clampLibraryRowHeight(
      app?.state?.libraryVirtualStableRowHeight
        || app?.state?.libraryVirtualLastRender?.rowHeightEstimate
        || app?.state?.libraryRowHeightMeasurementLast?.fixedEstimatePx
        || measured,
      measured
    );
    return { rowHeight: stable, frozenForScroll: true, measured };
  }
  if (app?.state) app.state.libraryVirtualStableRowHeight = measured;
  return { rowHeight: measured, frozenForScroll: false, measured };
}

export function buildLibraryVirtualMetrics(app, visibleRows, options = {}) {
  const base = getLibraryWindowDomMetrics(app, { lightweight: options.source === 'virtual-scroll' });
  const stableRowHeight = resolveStableLibraryRowHeight(app, base.rowHeight, options);
  base.rowHeight = stableRowHeight.rowHeight;
  base.measuredRowHeight = stableRowHeight.measured;
  base.rowHeightFrozenForScroll = stableRowHeight.frozenForScroll;
  base.rowHeightFreezePass = stableRowHeight.frozenForScroll ? LIBRARY_VIRTUAL_SCROLL_ROW_HEIGHT_FREEZE_PASS : '';
  if (options.resetScroll) base.scrollTop = 0;
  const anchor = options.scrollAnchor || null;
  const rowHeight = Math.max(24, Math.min(160, Number(base.rowHeight) || 56));
  if (anchor?.key) {
    const anchorIndex = Array.isArray(visibleRows) ? visibleRows.findIndex(row => row?.key === anchor.key) : -1;
    if (anchorIndex >= 0) {
      base.scrollTop = Math.max(0, Math.round(anchorIndex * rowHeight - (Number(anchor.offset) || 0)));
      base.anchorApplied = true;
      base.anchorKey = anchor.key;
    } else {
      base.anchorApplied = false;
      base.anchorKey = anchor.key;
    }
  }
  if (options.followActive && Array.isArray(visibleRows)) {
    const activeIndex = visibleRows.findIndex(row => !!row.active);
    if (activeIndex >= 0) {
      const viewport = Math.max(120, Number(base.viewportHeight) || 640);
      const currentStart = Math.floor((Number(base.scrollTop) || 0) / rowHeight);
      const currentEnd = Math.ceil(((Number(base.scrollTop) || 0) + viewport) / rowHeight);
      if (activeIndex < currentStart + 1 || activeIndex >= currentEnd - 1) {
        base.scrollTop = Math.max(0, Math.round(activeIndex * rowHeight - viewport * 0.35));
        base.activeFollowApplied = true;
        base.activeFollowIndex = activeIndex;
      } else {
        base.activeFollowApplied = false;
        base.activeFollowIndex = activeIndex;
      }
    }
  }
  return base;
}

export function buildLibraryVirtualWindowRenderRecord({
  options = {},
  visibleRows = [],
  rowsInfo = {},
  windowPlan = {},
  renderRows = [],
  gate = {},
  metrics = {},
  anchorRestored = false,
  scrollAnchor = null,
  rowHeightMeasurement = null,
  summarizeRowHeightMeasurement = value => value,
  rowsCachePass = '',
  renderWindowSkipPass = '',
  singleAnchorRestorePass = '',
  start = 0,
  end = 0
} = {}) {
  return {
    mode:'windowed',
    kind:'windowed-render',
    blocking:false,
    reason:'windowed',
    source:options.source || 'render',
    rowCount:Array.isArray(visibleRows) ? visibleRows.length : 0,
    renderedRows:Array.isArray(renderRows) ? renderRows.length : 0,
    rowsCachePass,
    rowsCacheHit:!!rowsInfo.cacheHit,
    renderWindowSkipPass,
    renderStart:Math.max(0, Number(start) || 0),
    renderEnd:Math.max(Math.max(0, Number(start) || 0), Number(end) || 0),
    rowHeight:windowPlan.rowHeight,
    rowHeightEstimate:windowPlan.rowHeight,
    rowHeightMeasurement:summarizeRowHeightMeasurement(rowHeightMeasurement),
    topSpacerHeight:windowPlan.topSpacerHeight || 0,
    bottomSpacerHeight:windowPlan.bottomSpacerHeight || 0,
    gate,
    scrollPolicy: {
      resetScroll:!!options.resetScroll,
      anchorKey:options.scrollAnchor?.key || metrics.anchorKey || '',
      anchorApplied:!!metrics.anchorApplied,
      anchorRestored:!!anchorRestored,
      virtualScrollAnchorPass: scrollAnchor?.pass || '',
      singleAnchorRestorePass,
      virtualScrollAnchorKey: scrollAnchor?.key || '',
      virtualScrollAnchorOffset: Number.isFinite(Number(scrollAnchor?.offset)) ? Math.round(Number(scrollAnchor.offset)) : null,
      followActive:!!options.followActive,
      activeFollowApplied:!!metrics.activeFollowApplied,
      activeFollowIndex:Number.isFinite(Number(metrics.activeFollowIndex)) ? Number(metrics.activeFollowIndex) : null,
      computedScrollTop:windowPlan.scrollTop,
      rowHeightFreezePass:metrics.rowHeightFreezePass || '',
      rowHeightFrozenForScroll:!!metrics.rowHeightFrozenForScroll,
      measuredRowHeight:metrics.measuredRowHeight || null
    },
    at:Date.now()
  };
}

export function buildLibraryVirtualRenderDiagnosticsPayload({
  defaultRolloutPass = '',
  defaultRolloutEnabled = false,
  autoFallbackActive = false,
  autoFallback = null,
  wideWindow = {},
  enabled = false,
  requested = false,
  active = false,
  sessionOptIn = null,
  lastRender = null,
  fallback = {},
  renderHistory = [],
  currentWindowRows = null,
  scrollAnchor = null,
  rowHeightMeasurement = null,
  autoEnable = null,
  actionAudit = null,
  safeTrial = null,
  pendingRaf = false,
  historyLimit = 20
} = {}) {
  return {
    available: true,
    enabled: !!enabled,
    requested: !!requested,
    defaultRollout: {
      pass: defaultRolloutPass,
      enabledByDefault: !!defaultRolloutEnabled,
      fallbackToFullOnFailure: true,
      autoFallbackActive: !!autoFallbackActive,
      autoFallback,
      widerWindow: wideWindow
    },
    active: !!active,
    sessionOptIn,
    lastRender,
    lastFallback: fallback.latestBlocking || null,
    lastBlockingFallback: fallback.latestBlocking || null,
    latestInformationalFullRender: fallback.latestInformationalFullRender || null,
    renderHistory: Array.isArray(renderHistory) ? renderHistory.slice(-historyLimit) : [],
    fallbackHistory: fallback.blockingFallbackHistory || [],
    blockingFallbackHistory: fallback.blockingFallbackHistory || [],
    informationalFullRenderHistory: fallback.informationalFullRenderHistory || [],
    fallbackHistorySemantics: fallback.historySemantics,
    currentWindowRows,
    rowHeightMeasurement,
    autoEnable,
    actionAudit,
    fallback,
    safeTrial,
    pendingRaf: !!pendingRaf
  };
}
