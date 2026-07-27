import { computeLibraryWindow } from './library-model.mjs';
import { getLibraryVirtualWindowRenderSignature, rememberLibraryVirtualWindowRender, shouldSkipLibraryVirtualDomRender } from './library-virtual-render-cache.mjs';
import { buildLibraryVirtualMetrics, buildLibraryVirtualWindowRenderRecord } from './library-virtual-render-reporting.mjs';
import { getActualLibraryRowDiagnostics, getLibraryInteractionSafety, getLibraryVirtualGateSignature } from './library-virtual-row-inspection.mjs';
import { buildLibraryVirtualGateAudit } from './library-virtual-gate-audit.mjs';
import { renderLibraryVirtualWindowDom } from './library-virtual-window-renderer.mjs';

export const LIBRARY_VIRTUAL_RENDER_RUNTIME_PASS = 'v297-library-virtual-render-runtime-pass';
export const LIBRARY_VIRTUAL_BOUNDED_FAILURE_PASS = 'v674-library-virtual-bounded-failure-pass';
export const LIBRARY_VIRTUAL_SCROLL_ANCHOR_RESTORE_PASS = 'v510-library-virtual-scroll-anchor-restore-pass';
export const LIBRARY_VIRTUAL_ANCHOR_SINGLE_RESTORE_PASS = 'v511-library-virtual-anchor-single-restore-pass';
export const LIBRARY_VIRTUAL_SCROLL_RESTORE_DECISION_PASS = 'v517-library-virtual-scroll-restore-decision-pass';

function estimateLibraryVisibleRows(app, novels = [], stopAfter = 750) {
  const source = Array.isArray(novels) ? novels : [];
  let rows = source.length;
  if (rows > stopAfter) return rows;
  const expanded = app?.state?.expandedEpisodeNovels;
  for (const novel of source) {
    if (!novel?.isMultiFile || !expanded?.has?.(novel.id)) continue;
    rows += Array.isArray(novel.episodes) ? novel.episodes.length : 0;
    if (rows > stopAfter) break;
  }
  return rows;
}

export function renderLibraryVirtualIfEnabledRuntime(app, box, novels, options = {}, deps = {}) {
  const estimatedRows = estimateLibraryVisibleRows(app, novels);
  if (!deps.isLibraryVirtualRendererEnabled?.(app)) {
    const autoFallbackActive = app?.state?.libraryVirtualAutoFallback?.active === true;
    return {
      rendered:false,
      reason:autoFallbackActive ? 'auto-fallback-active' : 'flag-off',
      blocking:autoFallbackActive,
      rowCount:estimatedRows,
      pass:autoFallbackActive ? LIBRARY_VIRTUAL_BOUNDED_FAILURE_PASS : ''
    };
  }
  try {
    return renderLibraryVirtualWindowRuntime(app, box, novels, options, deps);
  } catch (error) {
    deps.recordLibraryVirtualFallback?.(app, {
      reason:'render-exception',
      blocking:true,
      category:'render-exception',
      rowCount:estimatedRows,
      error,
      source:options.source || 'render',
      at:Date.now()
    });
    return {
      rendered:false,
      reason:'render-exception',
      blocking:true,
      rowCount:estimatedRows,
      pass:LIBRARY_VIRTUAL_BOUNDED_FAILURE_PASS
    };
  }
}

export function renderLibraryVirtualWindowRuntime(app, box, novels, options = {}, deps = {}) {
  const rowsInfo = deps.getLibraryVirtualRows?.(app, novels) || { visibleRows: [] };
  const visibleRows = rowsInfo.visibleRows || [];
  if (!visibleRows.length) return { rendered:false, reason:'no-visible-rows' };
  const virtualScrollAnchor = captureLibraryVirtualScrollAnchor(app, visibleRows, options, deps);
  const metrics = buildLibraryVirtualMetrics(app, visibleRows, { ...options, scrollAnchor: virtualScrollAnchor || options.scrollAnchor || null });
  const windowPlan = computeLibraryWindow(visibleRows, {
    ...metrics,
    rowsAlreadyVisible: true,
    activeIndex: rowsInfo.activeIndex,
    activeRow: rowsInfo.activeRow
  });
  const gate = getLibraryVirtualGateRuntime(app, visibleRows, windowPlan, {
    allowCache: options.source === 'virtual-scroll',
    rowsInfo,
    deps
  });
  if (!gate.allowed) {
    deps.recordLibraryVirtualFallback?.(app, {
      reason:gate.reason || 'gate-blocked',
      blocking:true,
      rowCount:visibleRows.length,
      gate,
      category:gate.primaryCategory || 'unknown',
      source:options.source || 'render',
      at:Date.now()
    });
    return {
      rendered:false,
      reason:gate.reason || 'gate-blocked',
      blocking:true,
      rowCount:visibleRows.length,
      pass:LIBRARY_VIRTUAL_BOUNDED_FAILURE_PASS
    };
  }

  const windowRenderSignature = getLibraryVirtualWindowRenderSignature(rowsInfo, windowPlan);
  if (shouldSkipLibraryVirtualDomRender(app, box, options, windowRenderSignature, windowPlan, rowsInfo)) {
    app.state.libraryVirtualLastRenderSkip = {
      pass: deps.renderWindowSkipPass,
      reason: app.state.libraryVirtualLastScrollWindowHold?.pass ? 'scroll-window-hold' : 'window-unchanged',
      source: options.source || 'render',
      scrollWindowHoldPass: app.state.libraryVirtualLastScrollWindowHold?.pass || '',
      signature: windowRenderSignature,
      rowCount: visibleRows.length,
      renderStart: Number(windowPlan.renderStart) || 0,
      renderEnd: Number(windowPlan.renderEnd) || 0,
      rowsCacheHit: !!rowsInfo.cacheHit,
      gateCacheHit: !!gate.cacheHit,
      at: Date.now()
    };
    return { rendered:true, reason:'window-unchanged' };
  }

  const previousScrollTop = Math.max(0, Number(windowPlan.scrollTop ?? box.scrollTop) || 0);
  const domRender = renderLibraryVirtualWindowDom({
    app,
    box,
    visibleRows,
    windowPlan,
    previousScrollTop,
    restoreScrollTop: !(virtualScrollAnchor || options.scrollAnchor),
    deps: deps.getLibraryVirtualWindowRendererDeps?.(app) || {}
  });
  const { start, end, renderRows } = domRender;
  const anchorRestored = restoreLibraryVirtualScrollAnchor(app, virtualScrollAnchor || options.scrollAnchor || null, options, deps);
  const rowHeightMeasurement = options.source === 'virtual-scroll'
    ? (metrics.rowHeightMeasurement || null)
    : deps.getLibraryRowHeightMeasurementDiagnostics?.(app, { fixedEstimatePx: windowPlan.rowHeight });
  if (rowHeightMeasurement?.available) app.state.libraryRowHeightMeasurementLast = rowHeightMeasurement;
  rememberLibraryVirtualWindowRender(app, windowRenderSignature, windowPlan, rowsInfo, renderRows.length, {
    renderWindowSkipPass: deps.renderWindowSkipPass
  });
  deps.recordLibraryVirtualRender?.(app, buildLibraryVirtualWindowRenderRecord({
    options,
    visibleRows,
    rowsInfo,
    windowPlan,
    renderRows,
    gate,
    metrics,
    anchorRestored,
    scrollAnchor: virtualScrollAnchor || options.scrollAnchor || null,
    singleAnchorRestorePass: domRender.applyResult?.singleAnchorRestorePass || '',
    rowHeightMeasurement,
    summarizeRowHeightMeasurement: deps.summarizeLibraryRowHeightMeasurement,
    rowsCachePass: deps.rowsCachePass,
    renderWindowSkipPass: deps.renderWindowSkipPass,
    start,
    end
  }));
  app.state.libraryVirtualLastFallback = null;
  return { rendered:true, reason:'windowed' };
}


function captureLibraryVirtualScrollAnchor(app, visibleRows = [], options = {}, deps = {}) {
  if (options.scrollAnchor) return options.scrollAnchor;
  if (options.source !== 'virtual-scroll' || options.resetScroll || options.followActive) return null;
  const anchor = deps.getLibraryScrollAnchor?.(app) || null;
  if (!anchor?.key) return null;
  const rowIndex = Array.isArray(visibleRows) ? visibleRows.findIndex(row => row?.key === anchor.key) : -1;
  if (rowIndex < 0) return null;
  const enriched = {
    ...anchor,
    rowIndex,
    pass: LIBRARY_VIRTUAL_SCROLL_ANCHOR_RESTORE_PASS,
    reason: 'virtual scroll render keeps the current top row anchored across window replacement'
  };
  if (app?.state) {
    app.state.libraryVirtualLastScrollAnchor = {
      ...enriched,
      captured: true,
      at: Date.now()
    };
  }
  return enriched;
}


function resolveLibraryVirtualScrollRestoreOptions(options = {}, anchor = null) {
  const source = String(options.source || '');
  const virtualScroll = source === 'virtual-scroll';
  return {
    pass: LIBRARY_VIRTUAL_SCROLL_RESTORE_DECISION_PASS,
    mode: virtualScroll && anchor?.nearBottom ? 'bottom-edge-retain' : virtualScroll ? 'virtual-scroll-row-anchor' : 'explicit-row-anchor',
    source,
    preferBottomEdge: virtualScroll,
    skipMissingAnchorFallback: virtualScroll,
    anchorThresholdPx: virtualScroll ? 4 : 1
  };
}

function restoreLibraryVirtualScrollAnchor(app, anchor = null, options = {}, deps = {}) {
  if (!anchor) return false;
  const restoreOptions = resolveLibraryVirtualScrollRestoreOptions(options, anchor);
  const restored = !!deps.restoreLibraryScrollAnchor?.(app, anchor, restoreOptions);
  if (app?.state) {
    app.state.libraryVirtualLastScrollAnchorRestore = {
      pass: LIBRARY_VIRTUAL_SCROLL_ANCHOR_RESTORE_PASS,
      source: String(options.source || ''),
      restored,
      key: anchor.key || '',
      offset: Math.round(Number(anchor.offset) || 0),
      rowIndex: Number.isFinite(Number(anchor.rowIndex)) ? Math.round(Number(anchor.rowIndex)) : null,
      scrollTopBefore: Math.round(Number(anchor.scrollTop) || 0),
      scrollTopAfter: Math.round(Number(app?.els?.novelList?.scrollTop) || 0),
      restoreDecisionPass: restoreOptions.pass || '',
      restoreMode: restoreOptions.mode || '',
      bottomDistance: Number.isFinite(Number(anchor.bottomDistance)) ? Math.round(Number(anchor.bottomDistance)) : null,
      nearBottom: !!anchor.nearBottom,
      reason: restored
        ? 'virtual scroll window render restored captured anchor using the selected scroll restore policy'
        : 'virtual scroll anchor row was not rendered; native scrollTop was left in place',
      at: Date.now()
    };
  }
  return restored;
}

export function getLibraryVirtualGateRuntime(app, visibleRows, windowPlan, options = {}) {
  const deps = options.deps || {};
  const startedAt = Date.now();
  const rows = Array.isArray(visibleRows) ? visibleRows : [];
  const signature = getLibraryVirtualGateSignature(rows, { activeKey: options.rowsInfo?.activeKey || options.activeKey || '' });
  const cachedGate = app?.state?.libraryVirtualGateCache;
  if (options.allowCache === true && cachedGate?.signature === signature && cachedGate?.gate?.allowed === true) {
    return {
      ...cachedGate.gate,
      cached: true,
      cacheHit: true,
      computedAt: Date.now()
    };
  }
  const proto = deps.buildLibraryVirtualPrototypeWindowRows?.(app, {
    includeRootDropZone:true,
    decorateRows:true,
    rowsInfo: options.rowsInfo || null,
    windowPlan
  }) || { inspectedRows: [] };
  const prototypeRows = proto.inspectedRows || [];
  const interactionSafety = getLibraryInteractionSafety(prototypeRows);
  const actionAudit = deps.getLibraryActionAuditDiagnostics?.(app) || null;
  const actualRows = getActualLibraryRowDiagnostics(app);
  const gate = buildLibraryVirtualGateAudit({
    rows,
    prototypeRows,
    interactionSafety,
    actionAudit,
    actualRows,
    alreadyVirtual: app.els.novelList?.dataset?.libraryVirtualActive === '1',
    cacheSignature: signature,
    startedAt,
    rowsCachePass: deps.rowsCachePass,
    rowsCacheHit: !!proto.rowsCacheHit,
    maintenancePass: proto.maintenancePass,
    prototypeWindowDiagnostics: proto.diagnostics || null
  });
  app.state.libraryVirtualGateCache = { signature, gate, at: Date.now(), rowCount: rows.length };
  return gate;
}
