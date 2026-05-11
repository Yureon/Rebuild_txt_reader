const FRONTEND_CHECK_LIBRARY_VIRTUAL_RUNTIME_BRIDGE_GUARDS_PASS = 'v188-frontend-check-library-virtual-runtime-bridge-guards-pass';

function runLibraryVirtualRuntimeBridgeGuardChecks(ctx) {
  const {
    libraryVirtualReportsCombinedSource,
    domSmokeMarkerCombinedSource,
    shellSource,
    controlsSource,
    stateSource
  } = ctx;

  ['getLibraryVirtualSettingsReadinessSummary','formatLibraryVirtualSettingsRelativeTime','libraryVirtualSettingsReadiness','libraryVirtualSettingsBlockers','libraryVirtualSettingsLightweight','libraryVirtualSettingsFinalAudit','readiness: snap.readiness','evidenceFreshness','freshnessLabel'].forEach((marker) => {
    if (!controlsSource.includes(marker)) throw new Error(`Missing v100/v103 read-only readiness summary bridge marker: ${marker}`);
  });
  if (!shellSource.includes('id="devdbg-library-virtual-btn"')) throw new Error('Missing v103 developer debug large-list entry button');
  ['libraryVirtualSettingsReadinessSummary','libraryVirtualLimitedOptInReadinessLast','libraryVirtualDiagnosticsLightweightLastTest','libraryVirtualFinalOptInAuditLast','libraryVirtualFinalOptInAuditFilter','libraryVirtualManualReviewLastBundleRef','libraryVirtualEvidenceFreshnessLast'].forEach((marker) => {
    if (!stateSource.includes(marker)) throw new Error(`Missing v102 runtime readiness state marker: ${marker}`);
  });
  ['rememberLibraryVirtualSettingsReadinessSummary','settings-readiness-runtime-summary','settingsSummaryReadOnly','libraryVirtualSettingsReadinessSummary','libraryVirtualFinalOptInAuditLast','libraryVirtualManualReviewLastBundleRef','libraryVirtualEvidenceFreshnessLast'].forEach((marker) => {
    if (!libraryVirtualReportsCombinedSource.includes(marker)) throw new Error(`Missing v100 Recovery-to-Settings readiness summary bridge marker: ${marker}`);
  });
  ['Window math diagnostics','Variable row-height diagnostics','Virtual renderer manual review checklist','Manual review bundle JSON','Manual review bundle shape','Manual review readiness export','Limited opt-in readiness screen','Final opt-in audit','Diagnostics lightweight test command','Checklist snapshot history / diff','Gated windowed renderer diagnostics','Safe trial confidence summary','Safe trial scenario controls','Safe trial result history','Action/DnD/long-press audit','Review checklist JSON','Review checklist diff JSON','Manual review bundle JSON','Manual review bundle shape JSON','Manual review summary JSON','Manual review blockers JSON','Manual review workflow JSON','Limited opt-in readiness JSON','Final opt-in audit JSON','Final audit compact summary JSON','Final audit filter: ALL','Final audit filter: blockers','Final audit filter: warnings','Diagnostic lightweight test JSON','Run lightweight diagnostics test','Diagnostics self-test expansion','Diagnostics self-test expansion JSON','Evidence freshness JSON','Readiness evidence freshness','Manual review workflow','Manual review workflow JSON','Pre-opt-in risk register','Risk register JSON','Manual experiment plan','Manual experiment plan JSON','Fallback sample JSON','Row height JSON'].forEach((marker) => {
    if (!libraryVirtualReportsCombinedSource.includes(marker)) throw new Error(`Missing v92 Recovery Center smoke-tracked label: ${marker}`);
  });
  if (!libraryVirtualReportsCombinedSource.includes("text:'DOM smoke marker JSON'")) throw new Error('Missing v92 live DOM smoke marker copy button');
  if (!domSmokeMarkerCombinedSource.includes("Recovery Center DOM smoke marker checks")) throw new Error('Missing v92 DOM smoke marker panel title');
}

module.exports = {
  FRONTEND_CHECK_LIBRARY_VIRTUAL_RUNTIME_BRIDGE_GUARDS_PASS,
  runLibraryVirtualRuntimeBridgeGuardChecks
};
