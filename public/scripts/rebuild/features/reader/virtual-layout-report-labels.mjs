export const READER_VIRTUAL_LAYOUT_REPORT_LABELS_PASS = 'v224-reader-virtual-layout-report-labels-pass';
export const READER_VIRTUAL_LAYOUT_EXPORT_SUMMARY_PASS = 'v225-reader-virtual-layout-export-summary-pass';
export const READER_VIRTUAL_LAYOUT_EXPORT_SHAPE_GUARD_PASS = 'v226-reader-virtual-layout-export-shape-guard-pass';
export const READER_VIRTUAL_LAYOUT_EXPORT_PAYLOAD_SHAPE_REPORT_PASS = 'v232-reader-virtual-layout-export-payload-shape-report-pass';
export const READER_VIRTUAL_LAYOUT_REPORT_SURFACE_SHAPE_GUARD_PASS = 'v235-reader-virtual-layout-report-surface-shape-guard-pass';
export const READER_VIRTUAL_LAYOUT_AVAILABLE_BOUNDARY_SMOKE_PASS = 'v236-reader-virtual-layout-available-boundary-smoke-pass';

export function formatVirtualLayoutAvailability(diagnostics = {}) {
  return diagnostics?.available === false ? 'unavailable' : 'available';
}

export function formatVirtualLayoutStatusLabel(diagnostics = {}) {
  if (diagnostics?.available === false) return String(diagnostics?.reason || 'unavailable');
  const mountedRows = Math.max(0, Number(diagnostics?.mountedRows) || 0);
  const renderedRows = Math.max(0, Number(diagnostics?.renderedRows) || 0);
  return `rendered ${renderedRows} rows / mounted ${mountedRows}`;
}

export function buildVirtualLayoutCopyLabel(diagnostics = {}) {
  return buildVirtualLayoutExportSummary(diagnostics).copyLabel;
}


export function buildVirtualLayoutReportSummary(diagnostics = {}) {
  const staleMeasureCacheSize = Math.max(0, Number(diagnostics?.staleMeasureCacheSize) || 0);
  const manualHistory = diagnostics?.manualDiagnosticsSnapshot?.history || null;
  const anchorTraceSummary = diagnostics?.anchorTraceSummary || null;
  return {
    availability: formatVirtualLayoutAvailability(diagnostics),
    statusLabel: formatVirtualLayoutStatusLabel(diagnostics),
    staleMeasureCacheSize,
    manualDiagnosticsLabel: manualHistory?.label || 'manual checks none',
    manualDiagnosticsHistoryCount: Math.max(0, Number(manualHistory?.count) || 0),
    anchorTraceLabel: anchorTraceSummary?.label || 'anchor trace none',
    anchorTraceCount: Math.max(0, Number(anchorTraceSummary?.count) || 0),
    diagnosticsOnly: true
  };
}

export function buildVirtualLayoutExportSummary(diagnostics = {}) {
  const summary = buildVirtualLayoutReportSummary(diagnostics);
  return {
    ...summary,
    copyLabel: `${summary.availability} · ${summary.statusLabel} · stale measure ${summary.staleMeasureCacheSize} · ${summary.manualDiagnosticsLabel} · ${summary.anchorTraceLabel}`
  };
}


export function isVirtualLayoutExportSummaryShape(summary = null) {
  return !!summary
    && typeof summary.availability === 'string'
    && typeof summary.statusLabel === 'string'
    && typeof summary.copyLabel === 'string'
    && typeof summary.manualDiagnosticsLabel === 'string'
    && typeof summary.manualDiagnosticsHistoryCount === 'number'
    && typeof summary.anchorTraceLabel === 'string'
    && typeof summary.anchorTraceCount === 'number'
    && typeof summary.diagnosticsOnly === 'boolean';
}

export function buildVirtualLayoutExportShapeReport(diagnostics = {}) {
  const summary = buildVirtualLayoutExportSummary(diagnostics);
  return {
    pass: READER_VIRTUAL_LAYOUT_EXPORT_PAYLOAD_SHAPE_REPORT_PASS,
    valid: isVirtualLayoutExportSummaryShape(summary),
    summary
  };
}


export function isVirtualLayoutReportSurfaceShape(surface = null) {
  return !!surface
    && surface.pass === 'v223-reader-virtual-layout-diagnostics-report-surface-pass'
    && typeof surface.availability === 'string'
    && typeof surface.statusLabel === 'string'
    && typeof surface.copyLabel === 'string'
    && typeof surface.manualDiagnosticsLabel === 'string'
    && typeof surface.manualDiagnosticsHistoryCount === 'number'
    && typeof surface.anchorTraceLabel === 'string'
    && typeof surface.anchorTraceCount === 'number'
    && surface.diagnosticsOnly === true
    && !!surface.exportShapeReport
    && surface.exportShapeReport.valid === true;
}
