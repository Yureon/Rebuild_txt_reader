export const LIBRARY_VIRTUAL_DIAGNOSTICS_CAPTURE_SPLIT_PASS = 'v307-library-virtual-diagnostics-capture-split-pass';

export function getLibraryVirtualDiagnosticsRowHeightMeasurement(app, deps = {}) {
  const lastRender = app?.state?.libraryVirtualLastRender || null;
  const lastMeasurement = app?.state?.libraryRowHeightMeasurementLast || null;
  const fixedEstimatePx = Number(lastRender?.rowHeightEstimate || lastRender?.rowHeight || lastMeasurement?.fixedEstimatePx || 56);
  return deps.getLibraryRowHeightMeasurementDiagnostics?.(app, { fixedEstimatePx }) || null;
}

export function captureLibraryVirtualDiagnosticsRawState(app, deps = {}) {
  const state = app?.state || {};
  const novelList = app?.els?.novelList || null;
  const currentWindowRows = deps.getLibraryCurrentWindowRows?.(app) || null;
  const active = novelList?.dataset?.libraryVirtualActive === '1';
  return {
    state,
    currentWindowRows,
    active,
    requested: deps.isLibraryVirtualRendererRequested?.(app) || false,
    enabled: deps.isLibraryVirtualRendererEnabled?.(app) || false,
    rowHeightMeasurement: getLibraryVirtualDiagnosticsRowHeightMeasurement(app, deps),
    rawFallbackHistory: Array.isArray(state.libraryVirtualFallbackHistory) ? state.libraryVirtualFallbackHistory : [],
    renderHistory: Array.isArray(state.libraryVirtualRenderHistory) ? state.libraryVirtualRenderHistory : []
  };
}
