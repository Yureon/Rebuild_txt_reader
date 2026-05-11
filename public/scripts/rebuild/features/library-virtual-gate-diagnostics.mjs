import { summarizeLibraryRowHeightMeasurement } from './library-row-diagnostics.mjs';

export const LIBRARY_VIRTUAL_GATE_DIAGNOSTICS_SPLIT_PASS = 'v201-library-virtual-gate-diagnostics-split-pass';

export function summarizeLibraryWindowRowsForDiagnostics(windowRows = {}) {
  const rows = Array.isArray(windowRows.rows) ? windowRows.rows : [];
  return {
    available: !!windowRows.available,
    totalRows: Number(windowRows.totalRows) || 0,
    renderStart: Number(windowRows.window?.renderStart) || 0,
    renderEnd: Number(windowRows.window?.renderEnd) || 0,
    renderCount: rows.length,
    activeInWindow: !!windowRows.window?.activeInWindow,
    activeIndex: Number.isFinite(Number(windowRows.window?.activeIndex)) ? Number(windowRows.window.activeIndex) : null,
    rowHeightMeasurement: summarizeLibraryRowHeightMeasurement(windowRows.rowHeightMeasurement || null),
    sample: rows.slice(0, 20)
  };
}

export function buildLibraryAutoEnableDiagnosticsPayload(info = {}) {
  const rowsInfo = info.rowsInfo || null;
  const rowCount = Number(rowsInfo?.totalRows) || 0;
  const threshold = Number(info.threshold) || 0;
  const gate = info.renderDiag?.gate || info.fallback?.gate || null;
  return {
    thresholdRows: threshold,
    currentRows: rowCount,
    meetsThreshold: rowCount >= threshold,
    flagEnabled: !!info.flagEnabled,
    active: !!info.active,
    lastGateAllowed: gate ? !!gate.allowed : null,
    lastGateReason: gate?.reason || '',
    recommended: rowCount >= threshold && (gate ? !!gate.allowed : true),
    note: 'diagnostic-only; no automatic enable is performed'
  };
}
