import { buildLibraryVirtualFailureCategories, getLibraryVirtualFailureCategoryLabel, getLibraryVirtualFailureSuggestion, isLibraryVirtualBlockingFallbackRecord } from './library-virtual-fallback-policy.mjs';
import { buildLibraryAutoEnableDiagnosticsPayload, summarizeLibraryWindowRowsForDiagnostics } from './library-virtual-gate-diagnostics.mjs';
import { summarizeLibraryRowHeightMeasurement } from './library-row-diagnostics.mjs';
import { getLibraryVirtualDiagnosticsRowHeightMeasurement } from './library-virtual-diagnostics-capture.mjs';

export const LIBRARY_VIRTUAL_DIAGNOSTICS_FORMATTERS_SPLIT_PASS = 'v307-library-virtual-diagnostics-formatters-split-pass';

export function buildLibraryVirtualFallbackDiagnosticsForApp(app, currentWindowRows = null, deps = {}) {
  const requested = deps.isLibraryVirtualRendererEnabled?.(app) || false;
  const active = app.els.novelList?.dataset?.libraryVirtualActive === '1';
  const rawFallbackHistory = Array.isArray(app.state.libraryVirtualFallbackHistory) ? app.state.libraryVirtualFallbackHistory : [];
  const blockingHistory = rawFallbackHistory.filter(isLibraryVirtualBlockingFallbackRecord);
  const latestBlocking = isLibraryVirtualBlockingFallbackRecord(app.state.libraryVirtualLastFallback)
    ? app.state.libraryVirtualLastFallback
    : blockingHistory[blockingHistory.length - 1] || null;
  const renderHistory = Array.isArray(app.state.libraryVirtualRenderHistory) ? app.state.libraryVirtualRenderHistory : [];
  const informationalFullRenderHistory = renderHistory.filter(record => record?.mode === 'full' && record?.blocking === false);
  const latestInformationalFullRender = informationalFullRenderHistory[informationalFullRenderHistory.length - 1] || null;
  const latestGate = latestBlocking?.gate || null;
  const category = latestBlocking?.category || latestGate?.primaryCategory || '';
  const categoryCounts = {};
  blockingHistory.forEach(record => {
    const key = record?.category || record?.gate?.primaryCategory || 'unknown';
    categoryCounts[key] = (categoryCounts[key] || 0) + 1;
  });
  const datasetWindowed = active;
  const actualRenderer = datasetWindowed ? 'windowed' : (requested ? 'full fallback' : 'full');
  const fallingBack = !!requested && !active;
  return {
    requested,
    active,
    actualRenderer,
    fallingBack,
    blockingFailure: !!fallingBack && !!latestBlocking,
    informationalFullRender: !!latestInformationalFullRender,
    historySemantics: 'fallbackHistory is blocking-only; informational full renders are derived from renderHistory',
    latest: latestBlocking,
    latestBlocking,
    latestInformationalFullRender,
    latestCategory: category,
    latestCategoryLabel: latestBlocking ? getLibraryVirtualFailureCategoryLabel(category) : 'None',
    latestSuggestedAction: latestBlocking ? getLibraryVirtualFailureSuggestion(category) : 'blocking gate failure는 아직 기록되지 않았습니다. 최근 full-render reason과 gate 상태를 함께 확인하세요.',
    latestGate,
    categoryCounts,
    categoryGroups: latestGate?.categoryGroups || buildLibraryVirtualFailureCategories(latestGate?.problems || [], latestGate),
    fallbackHistory: blockingHistory,
    blockingFallbackHistory: blockingHistory,
    rawFallbackHistory,
    informationalFullRenderHistory,
    informationalFullRenderCount: informationalFullRenderHistory.length,
    renderHistory,
    currentWindowRows: summarizeLibraryWindowRowsForDiagnostics(currentWindowRows || deps.getLibraryCurrentWindowRows?.(app)),
    safeTrial: deps.getLibraryVirtualTrialDiagnostics?.(app) || null,
    computedAt: Date.now()
  };
}

export function buildLibraryAutoEnableDiagnosticsForApp(app, currentWindowRows = null, deps = {}) {
  return buildLibraryAutoEnableDiagnosticsPayload({
    rowsInfo: currentWindowRows || deps.getLibraryCurrentWindowRows?.(app),
    threshold: deps.autoEnableRowThreshold,
    renderDiag: app.state.libraryVirtualLastRender || null,
    fallback: app.state.libraryVirtualLastFallback || null,
    flagEnabled: deps.isLibraryVirtualRendererEnabled?.(app) || false,
    active: app.els.novelList?.dataset?.libraryVirtualActive === '1'
  });
}

export function summarizeFullRenderRowHeight(app, deps = {}) {
  const rowHeightMeasurement = deps.getLibraryRowHeightMeasurementDiagnostics?.(app) || null;
  return {
    rowHeightEstimate: rowHeightMeasurement?.fixedEstimatePx || rowHeightMeasurement?.stats?.average || null,
    rowHeightMeasurement: summarizeLibraryRowHeightMeasurement(rowHeightMeasurement)
  };
}

export { getLibraryVirtualDiagnosticsRowHeightMeasurement };
