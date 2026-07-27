import { buildLibraryVirtualRenderDiagnosticsPayload } from './library-virtual-render-reporting.mjs';
import { summarizeLibraryActionAudit } from './library-action-audit-summary.mjs';
import { summarizeLibraryWindowRowsForDiagnostics } from './library-virtual-gate-diagnostics.mjs';
import { captureLibraryVirtualDiagnosticsRawState, getLibraryVirtualDiagnosticsRowHeightMeasurement } from './library-virtual-diagnostics-capture.mjs';
import { buildLibraryAutoEnableDiagnosticsForApp, buildLibraryVirtualFallbackDiagnosticsForApp, summarizeFullRenderRowHeight } from './library-virtual-diagnostics-formatters.mjs';

export const LIBRARY_VIRTUAL_DIAGNOSTICS_SUMMARY_PASS = 'v283-library-virtual-diagnostics-summary-pass';
export const LIBRARY_VIRTUAL_DIAGNOSTICS_SUMMARY_SPLIT_PASS = 'v307-library-virtual-diagnostics-summary-split-pass';

export function buildLibraryVirtualRenderDiagnosticsForApp(app, deps = {}) {
  const raw = captureLibraryVirtualDiagnosticsRawState(app, deps);
  const fallback = buildLibraryVirtualFallbackDiagnosticsForApp(app, raw.currentWindowRows, deps);
  return buildLibraryVirtualRenderDiagnosticsPayload({
    defaultRolloutPass: deps.defaultRolloutPass,
    defaultRolloutEnabled: deps.isLibraryVirtualDefaultRolloutEnabled?.(app) || false,
    autoFallbackActive: deps.isLibraryVirtualAutoFallbackActive?.(app) || false,
    autoFallback: raw.state.libraryVirtualAutoFallback || null,
    wideWindow: deps.wideWindow || null,
    enabled: raw.enabled,
    requested: raw.requested,
    active: raw.active,
    sessionOptIn: deps.getLibraryVirtualSessionOptInDiagnostics?.(app) || null,
    lastRender: raw.state.libraryVirtualLastRender || null,
    fallback,
    renderHistory: raw.state.libraryVirtualRenderHistory,
    currentWindowRows: summarizeLibraryWindowRowsForDiagnostics(raw.currentWindowRows),
    rowHeightMeasurement: raw.rowHeightMeasurement,
    autoEnable: buildLibraryAutoEnableDiagnosticsForApp(app, raw.currentWindowRows, deps),
    actionAudit: summarizeLibraryActionAudit(deps.getLibraryActionAuditDiagnostics?.(app)),
    safeTrial: deps.getLibraryVirtualTrialDiagnostics?.(app) || null,
    pendingRaf: !!raw.state.libraryVirtualRenderRaf,
    historyLimit: deps.historyLimit
  });
}

export {
  captureLibraryVirtualDiagnosticsRawState,
  getLibraryVirtualDiagnosticsRowHeightMeasurement,
  buildLibraryVirtualFallbackDiagnosticsForApp,
  buildLibraryAutoEnableDiagnosticsForApp,
  summarizeFullRenderRowHeight
};
