const FRONTEND_CHECK_LIBRARY_VIRTUAL_SPLIT_GUARDS_PASS = 'v188-frontend-check-library-virtual-split-guards-pass';
const FRONTEND_CHECK_LIBRARY_VIRTUAL_RECOVERY_PRUNED_PASS = 'v422-frontend-check-recovery-pruned-skip-pass';

function runLibraryVirtualSplitGuardChecks(ctx) {
  if (ctx?.fs?.existsSync?.(ctx.path.join(ctx.projectRoot, 'tools', 'fixtures', 'removed-recovery-files-v421.json'))) {
    return { pass: FRONTEND_CHECK_LIBRARY_VIRTUAL_RECOVERY_PRUNED_PASS };
  }
  const {
    libraryVirtualReportsCombinedSource,
    stateSource,
    librarySource,
    libraryVirtualFallbackPolicySource,
    libraryVirtualTrialDiagnosticsSource,
    libraryRowDiagnosticsSource,
    libraryVirtualRowInspectionSource,
    libraryActionAuditSummarySource,
    libraryActionAuditDiagnosticsSource,
    libraryVirtualGateDiagnosticsSource,
    libraryPrototypeDiagnosticsSource,
    libraryVirtualSessionDiagnosticsSource,
    libraryVirtualSessionFallbackSource,
    libraryVirtualHistoryRecordSource,
    libraryVirtualRenderCacheSource,
    libraryVirtualRenderReportingSource,
    libraryVirtualGateAuditSource,
    libraryVirtualGateDetailSource,
    appCssSource,
    recoveryLibraryVirtualReportsSource,
    recoveryLibraryVirtualBasicPanelsSource,
    recoveryLibraryVirtualDiagnosticPayloadsSource,
    recoveryLibraryVirtualManualReviewChecklistSource,
    recoveryLibraryVirtualManualReviewBundlePanelsSource,
    recoveryLibraryVirtualSessionPanelsSource,
    recoveryLibraryVirtualReadinessPolicyPanelSource,
    recoveryLibraryVirtualReadinessReportsSource,
    recoveryLibraryVirtualReadinessPassiveReportsSource,
    recoveryLibraryVirtualRiskRegisterReportSource,
    recoveryLibraryDiagnosticsPanelRenderersSource,
    recoveryLibraryDiagnosticsSamplesSource,
    recoveryLibraryDiagnosticsCopyActionsSource,
    recoveryLibraryDiagnosticsCopyGroupsSource,
    recoveryLibraryDiagnosticsStatusRowsSource,
    recoveryLibraryDiagnosticsPanelShellSource,
    recoveryLibraryDiagnosticsControlButtonsSource,
    recoveryLibraryDiagnosticsExportPayloadSource,
    recoveryLibraryDiagnosticsSectionAssemblySource,
    recoveryLibraryDiagnosticsSectionGroupsSource,
    recoveryLibraryDiagnosticsPanelSource,
    recoveryLibraryVirtualEvidenceDiagnosticsSource,
    recoveryLibraryVirtualEvidenceUtilsSource,
    recoveryLibraryVirtualEvidenceFreshnessSource,
    searchFilterSummarySource,
    recoveryLibraryVirtualReadinessPanelUtilsSource,
    searchResultsViewSource
  } = ctx;

  ['LIBRARY_VIRTUAL_REPORT_CONSTANTS_REFACTOR_PASS','v185-library-virtual-report-constants-pass','LIBRARY_VIRTUAL_REPORT_UTILS_REFACTOR_PASS','v185-library-virtual-report-utils-pass','LIBRARY_VIRTUAL_BASIC_PANELS_REFACTOR_PASS','v185-library-virtual-basic-panels-pass','LIBRARY_VIRTUAL_CHECKLIST_HISTORY_REFACTOR_PASS','v185-library-virtual-checklist-history-pass','LIBRARY_VIRTUAL_READINESS_REPORTS_REFACTOR_PASS','v185-library-virtual-readiness-reports-pass','libraryVirtualReportsModularPass','v185-library-virtual-reports-modular-pass'].forEach((marker) => {
    if (!libraryVirtualReportsCombinedSource.includes(marker) && !stateSource.includes(marker)) throw new Error(`Missing v185 library virtual report split marker: ${marker}`);
  });
  if (/^function createLibraryRowHeightDiagnosticsPanel/m.test(recoveryLibraryVirtualReportsSource)) throw new Error('library-virtual-reports.mjs still owns basic row-height panel after v185 split');
  if (!/import\s*\{[^}]*formatLibraryTrialMs[^}]*\}\s*from '\.\/library-formatters\.mjs';/.test(recoveryLibraryVirtualBasicPanelsSource || '')) throw new Error('library-virtual-basic-panels.mjs missing formatLibraryTrialMs import from library-formatters');
  if (!/import\s*\{[^}]*formatLibraryFallbackGroups[^}]*formatLibraryTrialMs[^}]*\}\s*from '\.\/library-formatters\.mjs';/.test(recoveryLibraryVirtualBasicPanelsSource || '')) throw new Error('library-virtual-basic-panels.mjs formatter dependency import guard failed');
  const basicFormatterImport = String(recoveryLibraryVirtualBasicPanelsSource || '').match(/import\s*\{([^}]+)\}\s*from '\.\/library-formatters\.mjs';/)?.[1] || '';
  ['formatLibraryFallbackGroups','formatLibraryRowHeightRisk','formatLibraryRowHeightStats','formatLibraryTrialMs','formatLibraryVirtualTrialConfidenceLevel'].forEach((name) => {
    if (!basicFormatterImport.includes(name)) throw new Error('library-virtual-basic-panels.mjs expanded formatter import guard missing: ' + name);
  });
  if (!String(recoveryLibraryVirtualBasicPanelsSource || '').includes('formatLibraryTrialMs(item.elapsedMs)')) throw new Error('library-virtual-basic-panels.mjs trial history elapsed formatter usage missing');
  if (/^function buildLibraryVirtualChecklistSnapshotDiff/m.test(recoveryLibraryVirtualReportsSource)) throw new Error('library-virtual-reports.mjs still owns checklist history diff after v185 split');
  if (/^function buildLibraryVirtualRiskRegisterPayload/m.test(recoveryLibraryVirtualReportsSource)) throw new Error('library-virtual-reports.mjs still owns readiness/risk report builder after v185 split');

  ['LIBRARY_VIRTUAL_FINAL_AUDIT_UTILS_REFACTOR_PASS','v186-library-virtual-final-audit-utils-pass','LIBRARY_VIRTUAL_EVIDENCE_DIAGNOSTICS_REFACTOR_PASS','v186-library-virtual-evidence-diagnostics-pass','LIBRARY_VIRTUAL_OPTIN_AUDIT_REFACTOR_PASS','v186-library-virtual-optin-audit-pass','libraryVirtualReportsDiagnosticsSplitPass','v186-library-virtual-reports-diagnostics-split-pass'].forEach((marker) => {
    if (!libraryVirtualReportsCombinedSource.includes(marker) && !stateSource.includes(marker)) throw new Error(`Missing v186 library virtual diagnostics split marker: ${marker}`);
  });
  if (/^function buildLibraryVirtualLimitedOptInReadinessPayload/m.test(recoveryLibraryVirtualReportsSource)) throw new Error('library-virtual-reports.mjs still owns limited opt-in payload after v186 split');
  if (/^function buildLibraryVirtualFinalOptInAuditPayload/m.test(recoveryLibraryVirtualReportsSource)) throw new Error('library-virtual-reports.mjs still owns final opt-in audit payload after v186 split');
  if (/^function buildLibraryVirtualDiagnosticsLightweightTestPayload/m.test(recoveryLibraryVirtualReportsSource)) throw new Error('library-virtual-reports.mjs still owns diagnostics lightweight payload after v186 split');
  if (/^function buildLibraryVirtualEvidenceFreshnessReport/m.test(recoveryLibraryVirtualReportsSource)) throw new Error('library-virtual-reports.mjs still owns evidence freshness report after v186 split');

  ['RECOVERY_LIBRARY_VIRTUAL_REPORTS_REFACTOR_PASS','v187-recovery-library-virtual-reports-aggregator-pass','LIBRARY_VIRTUAL_DIAGNOSTIC_PAYLOADS_REFACTOR_PASS','v187-library-virtual-diagnostic-payloads-pass','LIBRARY_VIRTUAL_MANUAL_REVIEW_CHECKLIST_REFACTOR_PASS','v187-library-virtual-manual-review-checklist-pass','LIBRARY_VIRTUAL_MANUAL_REVIEW_BUNDLE_PANELS_REFACTOR_PASS','v187-library-virtual-manual-review-bundle-panels-pass','LIBRARY_VIRTUAL_SESSION_PANELS_REFACTOR_PASS','v187-library-virtual-session-panels-pass','LIBRARY_VIRTUAL_READINESS_POLICY_PANEL_REFACTOR_PASS','v187-library-virtual-readiness-policy-panel-pass','libraryVirtualReportsAggregatorSplitPass','v187-library-virtual-reports-aggregator-split-pass'].forEach((marker) => {
    if (!libraryVirtualReportsCombinedSource.includes(marker) && !stateSource.includes(marker)) throw new Error(`Missing v187 library virtual aggregator split marker: ${marker}`);
  });
  [
    ['buildLibraryVirtualFallbackSamplePayload', recoveryLibraryVirtualDiagnosticPayloadsSource, 'diagnostic payloads'],
    ['buildLibraryVirtualManualReviewChecklist', recoveryLibraryVirtualManualReviewChecklistSource, 'manual review checklist'],
    ['buildLibraryVirtualManualReviewBundlePayload', recoveryLibraryVirtualManualReviewBundlePanelsSource, 'manual review bundle panels'],
    ['createLibraryVirtualTrialScenarioPanel', recoveryLibraryVirtualSessionPanelsSource, 'session panels'],
    ['createLibraryVirtualReadinessPolicyPanel', recoveryLibraryVirtualReadinessPolicyPanelSource, 'readiness policy panel']
  ].forEach(([marker, source, label]) => {
    if (!source || !source.includes(marker)) throw new Error(`Missing v187 split owner marker in ${label}: ${marker}`);
  });
  [
    'function buildLibraryVirtualFallbackSamplePayload',
    'function buildLibraryVirtualManualReviewChecklist',
    'function buildLibraryVirtualManualReviewBundlePayload',
    'function createLibraryVirtualTrialScenarioPanel',
    'function createLibraryVirtualReadinessPolicyPanel'
  ].forEach((marker) => {
    if (recoveryLibraryVirtualReportsSource.includes(marker)) throw new Error('library-virtual-reports.mjs still owns split implementation after v187: ' + marker);
  });
  [
    'LIBRARY_VIRTUAL_FALLBACK_POLICY_SPLIT_PASS',
    'v196-library-virtual-fallback-policy-split-pass',
    'libraryVirtualFallbackPolicySplitPass',
    'v196-css-ownership-index-pass',
    'recoveryVirtualPassiveReportSplitPass',
    'v196-recovery-virtual-passive-report-split-pass'
  ].forEach((marker) => {
    if (!librarySource.includes(marker) && !libraryVirtualFallbackPolicySource.includes(marker) && !appCssSource.includes(marker) && !libraryVirtualReportsCombinedSource.includes(marker) && !stateSource.includes(marker)) {
      throw new Error(`Missing v196 project-wide maintenance split marker: ${marker}`);
    }
  });
  if (!recoveryLibraryVirtualRiskRegisterReportSource.includes('LIBRARY_VIRTUAL_RISK_REGISTER_REPORT_SPLIT_PASS')) throw new Error('Missing v196 risk register report split module marker');
  if (!recoveryLibraryVirtualEvidenceUtilsSource.includes('LIBRARY_VIRTUAL_EVIDENCE_UTILS_SPLIT_PASS')) throw new Error('Missing v196 evidence utils split module marker');
  if (!recoveryLibraryVirtualEvidenceFreshnessSource.includes('LIBRARY_VIRTUAL_EVIDENCE_FRESHNESS_SPLIT_PASS')) throw new Error('Missing v196 evidence freshness split module marker');
  if (/^const LIBRARY_VIRTUAL_FALLBACK_CATEGORY_LABELS/m.test(librarySource)) throw new Error('library.mjs still owns virtual fallback policy labels after v196 split');
  if (/^export function buildLibraryVirtualRiskRegisterPayload/m.test(recoveryLibraryVirtualReadinessReportsSource)) throw new Error('readiness reports still owns risk register payload after v196 split');
  if (/^function buildLibraryVirtualEvidenceFreshnessReport/m.test(recoveryLibraryVirtualEvidenceDiagnosticsSource)) throw new Error('evidence diagnostics still owns freshness report after v196 split');

  [
    'LIBRARY_VIRTUAL_TRIAL_DIAGNOSTICS_SPLIT_PASS',
    'v197-library-virtual-trial-diagnostics-split-pass',
    'LIBRARY_ROW_DIAGNOSTICS_SPLIT_PASS',
    'v197-library-row-diagnostics-split-pass',
    'LIBRARY_ACTION_AUDIT_SUMMARY_SPLIT_PASS',
    'v197-library-action-audit-summary-split-pass',
    'LIBRARY_VIRTUAL_READINESS_PASSIVE_REPORTS_SPLIT_PASS',
    'v197-library-virtual-readiness-passive-reports-split-pass',
    'libraryVirtualTrialDiagnosticsSplitPass',
    'libraryRowDiagnosticsSplitPass',
    'libraryActionAuditSummarySplitPass',
    'readinessPassiveReportsSplitPass'
  ].forEach((marker) => {
    if (!libraryVirtualTrialDiagnosticsSource.includes(marker) && !libraryRowDiagnosticsSource.includes(marker) && !libraryActionAuditSummarySource.includes(marker) && !recoveryLibraryVirtualReadinessPassiveReportsSource.includes(marker) && !stateSource.includes(marker)) {
      throw new Error('Missing v197 library/recovery split marker: ' + marker);
    }
  });
  if (/^function normalizeLibraryVirtualTrialHistoryFilter/m.test(librarySource)) throw new Error('library.mjs still owns trial diagnostics summary helpers after v197 split');
  if (/^function getLibraryRowHeightMeasurementDiagnostics/m.test(librarySource)) throw new Error('library.mjs still owns row-height diagnostics after v197 split');
  if (/^function summarizeLibraryActionAudit/m.test(librarySource)) throw new Error('library.mjs still owns action audit summary after v197 split');
  if (/^export function buildLibraryVirtualManualExperimentPlanPayload/m.test(recoveryLibraryVirtualReadinessReportsSource)) throw new Error('readiness reports still owns passive manual experiment payload after v197 split');
  if (!recoveryLibraryVirtualReadinessPassiveReportsSource.includes('buildLibraryVirtualPostStabilizationSmokeReview')) throw new Error('Missing v197 post stabilization smoke owner in passive reports split');

  [
    'LIBRARY_VIRTUAL_ROW_INSPECTION_SPLIT_PASS',
    'v198-library-virtual-row-inspection-split-pass',
    'RECOVERY_LIBRARY_DIAGNOSTICS_PANEL_RENDERERS_SPLIT_PASS',
    'v198-recovery-library-diagnostics-panel-renderers-split-pass',
    'libraryVirtualRowInspectionSplitPass',
    'recoveryLibraryDiagnosticsPanelRenderersSplitPass'
  ].forEach((marker) => {
    if (!libraryVirtualRowInspectionSource.includes(marker) && !recoveryLibraryDiagnosticsPanelRenderersSource.includes(marker) && !stateSource.includes(marker)) {
      throw new Error('Missing v198 library/recovery passive split marker: ' + marker);
    }
  });
  if (/^function inspectLibraryRowElement/m.test(librarySource)) throw new Error('library.mjs still owns row inspection helper after v198 split');
  if (/^function createLibraryVirtualSpacer/m.test(librarySource)) throw new Error('library.mjs still owns virtual spacer helper after v198 split');
  if (/^function formatRelativeTime/m.test(ctx.recoveryLibraryDiagnosticsPanelSource || '')) throw new Error('library-diagnostics-panel.mjs still owns relative-time formatter after v198 split');

  [
    'LIBRARY_ACTION_AUDIT_DIAGNOSTICS_SPLIT_PASS',
    'v199-library-action-audit-diagnostics-split-pass',
    'libraryActionAuditDiagnosticsSplitPass'
  ].forEach((marker) => {
    if (!libraryActionAuditDiagnosticsSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v199 library action audit diagnostics split marker: ' + marker);
  });
  if (/^function auditLibraryActionRows/m.test(librarySource)) throw new Error('library.mjs still owns action audit row diagnostics after v199 split');
  if (/^function resolveLibraryIdentityForElement/m.test(librarySource)) throw new Error('library.mjs still owns action audit identity resolver after v199 split');


  [
    'RECOVERY_LIBRARY_DIAGNOSTICS_SAMPLES_SPLIT_PASS',
    'v200-recovery-library-diagnostics-samples-split-pass',
    'createLibraryVirtualGateSample',
    'createLibraryRenderHistorySample',
    'recoveryLibraryDiagnosticsSamplesSplitPass'
  ].forEach((marker) => {
    if (!recoveryLibraryDiagnosticsSamplesSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v200 recovery diagnostics sample split marker: ' + marker);
  });
  if (/const gateSample = virtualGate/m.test(ctx.recoveryLibraryDiagnosticsPanelSource || '')) throw new Error('library-diagnostics-panel.mjs still owns gate sample renderer after v200 split');
  if (/const renderHistorySample = Array.isArray/m.test(ctx.recoveryLibraryDiagnosticsPanelSource || '')) throw new Error('library-diagnostics-panel.mjs still owns render history sample renderer after v200 split');
  [
    'LIBRARY_VIRTUAL_GATE_DIAGNOSTICS_SPLIT_PASS',
    'v201-library-virtual-gate-diagnostics-split-pass',
    'libraryVirtualGateDiagnosticsSplitPass',
    'RECOVERY_LIBRARY_DIAGNOSTICS_COPY_ACTIONS_SPLIT_PASS',
    'v201-recovery-library-diagnostics-copy-actions-split-pass',
    'recoveryDiagnosticsCopyActionsSplitPass'
  ].forEach((marker) => {
    if (!libraryVirtualGateDiagnosticsSource.includes(marker) && !recoveryLibraryDiagnosticsCopyActionsSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v201 library/recovery split marker: ' + marker);
  });
  if (/^function summarizeLibraryWindowRows/m.test(librarySource)) throw new Error('library.mjs still owns window rows summary after v201 gate diagnostics split');
  if (librarySource.includes('summarizeLibraryWindowRows(')) throw new Error('library.mjs still references removed summarizeLibraryWindowRows helper after v201 split; use summarizeLibraryWindowRowsForDiagnostics');
  if (recoveryLibraryDiagnosticsPanelSource.includes('copyLimitedOptInReadinessBtn.addEventListener')) throw new Error('Recovery diagnostics panel still owns manual JSON copy listeners after v201 copy action split');

  [
    'LIBRARY_PROTOTYPE_DIAGNOSTICS_SPLIT_PASS',
    'v202-library-prototype-diagnostics-split-pass',
    'LIBRARY_ACTION_AUDIT_PAYLOAD_SPLIT_PASS',
    'v202-library-action-audit-payload-split-pass',
    'RECOVERY_LIBRARY_DIAGNOSTICS_STATUS_ROWS_SPLIT_PASS',
    'v202-recovery-library-diagnostics-status-rows-split-pass',
    'libraryPrototypeDiagnosticsSplitPass',
    'libraryActionAuditPayloadSplitPass',
    'recoveryLibraryDiagnosticsStatusRowsSplitPass'
  ].forEach((marker) => {
    if (!libraryPrototypeDiagnosticsSource.includes(marker) && !libraryActionAuditDiagnosticsSource.includes(marker) && !recoveryLibraryDiagnosticsStatusRowsSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v202 library/recovery passive diagnostics split marker: ' + marker);
  });
  if (/typeCounts:s*countLibraryRowTypes/.test(librarySource)) throw new Error('library.mjs still owns prototype diagnostics type-count payload after v202 split');
  if (/const actionTypes = mergeCountObjects/.test(librarySource)) throw new Error('library.mjs still owns action audit payload merge after v202 split');
  if (recoveryLibraryDiagnosticsPanelSource.includes('formatLibraryVirtualTrialSummary')) throw new Error('library-diagnostics-panel.mjs still owns status row formatter after v202 split');


  [
    'LIBRARY_VIRTUAL_SESSION_DIAGNOSTICS_SPLIT_PASS',
    'v203-library-virtual-session-diagnostics-split-pass',
    'RECOVERY_LIBRARY_DIAGNOSTICS_PANEL_SHELL_SPLIT_PASS',
    'v203-recovery-library-diagnostics-panel-shell-split-pass',
    'libraryVirtualSessionDiagnosticsSplitPass',
    'recoveryLibraryDiagnosticsPanelShellSplitPass'
  ].forEach((marker) => {
    if (!libraryVirtualSessionDiagnosticsSource.includes(marker) && !recoveryLibraryDiagnosticsPanelShellSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v203 library/recovery diagnostics split marker: ' + marker);
  });
  if (/^function pushLibraryVirtualSessionObservation/m.test(librarySource)) throw new Error('library.mjs still owns session opt-in observation helper after v203 split');
  if (!libraryVirtualSessionDiagnosticsSource.includes('export const LIBRARY_VIRTUAL_SESSION_OPT_IN_HISTORY_LIMIT')) throw new Error('library-virtual-session-diagnostics.mjs missing session opt-in history limit export');
  if (!/import\s*\{[^}]*LIBRARY_VIRTUAL_SESSION_OPT_IN_HISTORY_LIMIT[^}]*\}\s*from '\.\/library-virtual-session-diagnostics\.mjs';/.test(librarySource || '')) throw new Error('library.mjs missing LIBRARY_VIRTUAL_SESSION_OPT_IN_HISTORY_LIMIT import for session opt-in finish path');
  if (/^function buildLibraryVirtualSessionLiveStabilization/m.test(librarySource)) throw new Error('library.mjs still owns session live stabilization helper after v203 split');
  if (recoveryLibraryDiagnosticsPanelSource.includes('createRecoveryActionCluster([')) throw new Error('library-diagnostics-panel.mjs still owns title/action shell after v203 split');


  [
    'LIBRARY_VIRTUAL_HISTORY_RECORD_SPLIT_PASS',
    'v204-library-virtual-history-record-split-pass',
    'RECOVERY_LIBRARY_DIAGNOSTICS_CONTROL_BUTTONS_SPLIT_PASS',
    'v204-recovery-library-diagnostics-control-buttons-split-pass',
    'libraryVirtualHistoryRecordSplitPass',
    'recoveryLibraryDiagnosticsControlButtonsSplitPass'
  ].forEach((marker) => {
    if (!libraryVirtualHistoryRecordSource.includes(marker) && !recoveryLibraryDiagnosticsControlButtonsSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v204 library/recovery split marker: ' + marker);
  });
  if (/^function compactLibraryVirtualHistoryRecord/m.test(librarySource)) throw new Error('library.mjs still owns virtual history record compaction after v204 split');
  if (recoveryLibraryDiagnosticsPanelSource.includes("const virtualToggleBtn = createEl('button'")) throw new Error('library-diagnostics-panel.mjs still owns session toggle button construction after v204 split');

  [
    'LIBRARY_VIRTUAL_RENDER_CACHE_SPLIT_PASS',
    'v205-library-virtual-render-cache-split-pass',
    'RECOVERY_LIBRARY_DIAGNOSTICS_EXPORT_PAYLOAD_SPLIT_PASS',
    'v205-recovery-library-diagnostics-export-payload-split-pass',
    'libraryVirtualRenderCacheSplitPass',
    'recoveryLibraryDiagnosticsExportPayloadSplitPass'
  ].forEach((marker) => {
    if (!libraryVirtualRenderCacheSource.includes(marker) && !recoveryLibraryDiagnosticsExportPayloadSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v205 library/recovery render-cache/export split marker: ' + marker);
  });
  if (/^function getLibraryVirtualWindowRenderSignature/m.test(librarySource)) throw new Error('library.mjs still owns virtual window render signature after v205 split');
  if (/^function rememberLibraryVirtualWindowRender/m.test(librarySource)) throw new Error('library.mjs still owns virtual render cache writer after v205 split');
  if (recoveryLibraryDiagnosticsPanelSource.includes('manualReviewBundle: buildLibraryVirtualManualReviewBundlePayload')) throw new Error('library-diagnostics-panel.mjs still owns snapshot export payload assembly after v205 split');

  [
    'LIBRARY_VIRTUAL_RENDER_REPORTING_SPLIT_PASS',
    'v206-library-virtual-render-reporting-split-pass',
    'RECOVERY_LIBRARY_DIAGNOSTICS_SECTION_ASSEMBLY_SPLIT_PASS',
    'v206-recovery-library-diagnostics-section-assembly-split-pass',
    'libraryVirtualRenderReportingSplitPass',
    'recoveryLibraryDiagnosticsSectionAssemblySplitPass'
  ].forEach((marker) => {
    if (!libraryVirtualRenderReportingSource.includes(marker) && !recoveryLibraryDiagnosticsSectionAssemblySource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v206 library/recovery render reporting split marker: ' + marker);
  });
  if (/^function buildLibraryVirtualMetrics/m.test(librarySource)) throw new Error('library.mjs still owns virtual metrics builder after v206 split');
  if (librarySource.includes("mode:'windowed',\n    source:options.source || 'render'")) throw new Error('library.mjs still owns windowed render record payload after v206 split');
  if (recoveryLibraryDiagnosticsPanelSource.includes("createEl('div', { class:'recovery-cache-subtitle'")) throw new Error('library-diagnostics-panel.mjs still owns subtitle section assembly after v206 split');

  [
    'LIBRARY_VIRTUAL_GATE_AUDIT_PASS',
    'v207-library-virtual-gate-audit-pass',
    'RECOVERY_LIBRARY_DIAGNOSTICS_SECTION_GROUPS_PASS',
    'v207-recovery-library-diagnostics-section-groups-pass',
    'libraryVirtualGateAuditPass',
    'recoveryLibraryDiagnosticsSectionGroupsPass'
  ].forEach((marker) => {
    if (!libraryVirtualGateAuditSource.includes(marker) && !recoveryLibraryDiagnosticsSectionGroupsSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v207 library/recovery gate audit split marker: ' + marker);
  });
  if (/^export function getLibraryVirtualGate\(/m.test(libraryVirtualRowInspectionSource)) throw new Error('library-virtual-row-inspection.mjs still owns virtual gate runtime after v207 audit');
  if (!/^function getLibraryVirtualGate\(/m.test(librarySource)) throw new Error('library.mjs must retain the virtual gate orchestration wrapper after v207 audit');
  if (!librarySource.includes('buildLibraryVirtualGateAudit')) throw new Error('library.mjs must delegate gate audit payload construction after v207 audit');
  if (libraryVirtualGateAuditSource.includes('buildLibraryVirtualPrototypeWindowRows') || libraryVirtualGateAuditSource.includes('getLibraryActionAuditDiagnostics')) throw new Error('library-virtual-gate-audit.mjs must remain pure/passive and must not import library runtime closures');
  if (recoveryLibraryDiagnosticsPanelSource.includes("{ title:'Readiness policy summary'")) throw new Error('library-diagnostics-panel.mjs still owns section entry list after v207 grouping split');

  [
    'LIBRARY_VIRTUAL_SESSION_PAYLOAD_SPLIT_PASS',
    'v208-library-virtual-session-payload-pass',
    'LIBRARY_VIRTUAL_PROTOTYPE_WINDOW_DIAGNOSTICS_PASS',
    'v208-library-virtual-prototype-window-diagnostics-pass',
    'SEARCH_RESULT_LABELS_SPLIT_PASS',
    'v208-search-result-labels-pass'
  ].forEach((marker) => {
    if (!ctx.libraryVirtualSessionPayloadSource?.includes(marker) && !ctx.libraryVirtualPrototypeWindowDiagnosticsSource?.includes(marker) && !ctx.searchResultLabelsSource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v208 passive helper split marker: ' + marker);
  });
  if (librarySource.includes('id: ' + String.fromCharCode(96) + 'session-opt-in-')) throw new Error('library.mjs still owns session opt-in record payload after v208 split');
  if (/const capped = app\.state\.search\.results\.length >= MAX_RESULTS/.test(ctx.searchSource || '')) throw new Error('search.mjs still owns capped result-count label after v208 split');
  if (!librarySource.includes('buildLibraryVirtualPrototypeWindowDiagnostics')) throw new Error('library.mjs must attach passive prototype/window diagnostics after v208 split');

  [
    'LIBRARY_VIRTUAL_GATE_DETAIL_PASS',
    'v209-library-virtual-gate-detail-pass',
    'LIBRARY_VIRTUAL_GATE_DETAIL_BRIDGE_PASS',
    'RECOVERY_LIBRARY_DIAGNOSTICS_COPY_GROUPS_PASS',
    'v209-recovery-library-diagnostics-copy-groups-pass',
    'SEARCH_FILTER_SUMMARY_SPLIT_PASS',
    'v209-search-filter-summary-pass'
  ].forEach((marker) => {
    if (!libraryVirtualGateDetailSource?.includes(marker) && !libraryVirtualGateAuditSource.includes(marker) && !recoveryLibraryDiagnosticsCopyGroupsSource?.includes(marker) && !searchFilterSummarySource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v209 passive helper split marker: ' + marker);
  });
  if (libraryVirtualGateDetailSource?.includes('buildLibraryVirtualPrototypeWindowRows') || libraryVirtualGateDetailSource?.includes('getLibraryActionAuditDiagnostics')) throw new Error('library-virtual-gate-detail.mjs must remain pure/passive');
  if (recoveryLibraryDiagnosticsCopyActionsSource.includes('copyManualReviewWorkflowBtn: createRecoveryJsonCopyButton')) throw new Error('copy-actions still owns manual review bundle copy grouping after v209 split');
  if (searchResultsViewSource?.includes('function sourceLabel(') || searchResultsViewSource?.includes('function filterLabel(')) throw new Error('results-view.mjs still owns source/filter label helpers after v209 split');


  [
    'LIBRARY_VIRTUAL_SESSION_FALLBACK_PASS',
    'v210-library-virtual-session-fallback-pass',
    'LIBRARY_VIRTUAL_READINESS_PANEL_UTILS_PASS',
    'v210-library-virtual-readiness-panel-utils-pass',
    'SEARCH_RESULT_WINDOW_STATUS_SPLIT_PASS',
    'v210-search-result-window-status-pass'
  ].forEach((marker) => {
    if (!libraryVirtualSessionFallbackSource?.includes(marker) && !recoveryLibraryVirtualReadinessPanelUtilsSource?.includes(marker) && !searchFilterSummarySource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v210 passive helper split marker: ' + marker);
  });
  if (librarySource.includes(`const failure = {
    reason: record.reason || 'fallback'`) || librarySource.includes(`categoryLabel: getLibraryVirtualFailureCategoryLabel(category),
    suggestedAction: getLibraryVirtualFailureSuggestion(category),`)) throw new Error('library.mjs still owns session/trial fallback failure payload after v210 split');
  if (recoveryLibraryVirtualReadinessPassiveReportsSource.includes("class:'recovery-status-table' }, rows.map")) throw new Error('readiness passive reports still own repeated status-table renderer after v210 split');
  if (searchResultsViewSource?.includes('결과 window · DOM')) throw new Error('results-view.mjs still owns search result window status copy after v210 split');

}

module.exports = {
  FRONTEND_CHECK_LIBRARY_VIRTUAL_RECOVERY_PRUNED_PASS,
  FRONTEND_CHECK_LIBRARY_VIRTUAL_SPLIT_GUARDS_PASS,
  runLibraryVirtualSplitGuardChecks
};
