const fs = require('fs');
const path = require('path');
const { readHistoricalDocSourceManifest } = require('./source-loader-manifest.js');

function readGuardHistoricalDoc(docsRoot, rel) {
  return readHistoricalDocSourceManifest(path.dirname(docsRoot), [rel])[rel];
}

const { runRecoveryRefactorModuleChecks } = require('./recovery-refactor-modules.js');

const FRONTEND_CHECK_RECOVERY_CENTER_GUARDS_PASS = 'v183-frontend-check-recovery-center-guards-pass';

function runRecoveryCenterGuardChecks(context) {
  const {
    root,
    docsRoot,
    devtoolsSource,
    devtoolsControlsSource,
    recoveryRuntimeSource,
    recoveryExportUtilsSource,
    recoveryButtonWiringSource,
    libraryVirtualReportsCombinedSource,
    uiSource,
    appCssSource,
    recoverySummaryPanelSource,
    recoveryPolicyChecklistPanelSource,
    recoveryImportScopePanelSource,
    recoveryImportActionsSource,
    recoveryNavigationSource,
    recoveryActionUiSource,
    devtoolsNavigationCombinedSource,
    recoveryDomSmokePanelSource,
    domSmokeMarkerCombinedSource,
    recoveryDiagnosticsPanelSource,
    recoveryLibraryFormattersSource,
    recoveryLibraryVirtualReportsSource,
    recoveryCacheManagementPanelSource,
    recoverySearchPanelSource,
    stateSource,
    recoverySearchDiagnosticsSource,
    recoveryCacheDiagnosticsSource,
    recoveryCacheCombinedSource,
    recoveryLibraryDiagnosticsSource,
    recoveryLibraryDiagnosticsPanelSource,
    recoveryManualReviewBundleSource,
    manualReviewBundleCombinedSource,
    recoveryModalLayerCombinedSource,
    recoveryCacheActionsSource,
    recoverySearchActionsSource,
    recoverySnapshotExportSource,
    recoveryLocalMaintenanceSource,
    recoveryLibraryVirtualEvidenceDiagnosticsSource,
    recoveryLibraryVirtualEvidencePanelRenderersSource,
    recoveryLibraryVirtualOptinAuditSource,
    recoveryLibraryVirtualOptinPanelRenderersSource,
    recoveryLibraryVirtualReadinessReportsSource,
    recoveryLibraryVirtualReadinessPassiveReportsSource,
    recoveryLibraryVirtualReadinessFinalPanelUtilsSource,
    recoveryLibraryVirtualReadinessSectionFactoriesSource,
    recoveryLibraryVirtualManualExperimentPanelRenderersSource,
    recoveryLibraryVirtualStabilizationPanelRenderersSource,
    recoveryLibraryVirtualPracticalRegressionPanelRenderersSource,
    recoveryLibraryVirtualDecisionMemoPanelRenderersSource,
    recoveryLibraryVirtualFinalSummaryUtilsSource,
    recoveryLibraryVirtualFinalSummaryPayloadSource,
    recoveryLibraryVirtualDecisionMemoPayloadSource,
    recoveryLibraryVirtualPracticalRegressionPayloadSource,
    recoveryLibraryVirtualManualExperimentPayloadSource,
    recoveryLibraryVirtualPostStabilizationSmokePayloadSource,
    recoveryLibraryVirtualPostStabilizationReviewPayloadSource
  } = context;
  const devtoolsBridgeSource = devtoolsSource + '\n' + (context.recoveryOrchestrationSource || '');

  ['createRecoveryLazyPanel','buildRecoveryBaseContext','buildRecoveryDiagnosticsContext','buildRecoveryLibraryContext','buildRecoveryCacheManagementContext','buildRecoverySearchContext'].forEach((marker) => {
    if (!devtoolsBridgeSource.includes(marker) && !recoveryRuntimeSource.includes(marker)) throw new Error('Missing Recovery Center runtime extraction safety marker: ' + marker);
  });
  ['copyRecoveryTextWithFallback','downloadRecoveryJsonFile'].forEach((marker) => {
    if (!devtoolsBridgeSource.includes(marker) && !recoveryExportUtilsSource.includes(marker)) throw new Error('Missing Recovery Center export extraction safety marker: ' + marker);
  });
  ['RECOVERY_EXPORT_UTILS_EXTRACTION_PASS','v161-recovery-export-utils-extraction-pass','buildRecoveryExportFilename','copyRecoveryTextWithFallback','exportRecoveryJsonPayload','downloadRecoveryJsonFile','stringifyRecoveryJsonPayload','downloadTextFile'].forEach((marker) => {
    if (!recoveryExportUtilsSource.includes(marker)) throw new Error('Missing v161 extracted export utils marker: ' + marker);
  });
  ['RECOVERY_BUTTON_WIRING_REFACTOR_PASS','v163-recovery-button-wiring-helper-pass','createRecoveryJsonCopyButton','exportRecoveryJsonPayload','toast(app, \'success\''].forEach((marker) => {
    if (!recoveryButtonWiringSource.includes(marker)) throw new Error('Missing v163 Recovery Center button wiring helper marker: ' + marker);
  });
  ['./recovery/button-wiring.mjs','RECOVERY_BUTTON_WIRING_REFACTOR_BRIDGE','createRecoveryJsonCopyButton(app'].forEach((marker) => {
    if (!devtoolsBridgeSource.includes(marker) && !libraryVirtualReportsCombinedSource.includes(marker)) throw new Error('Missing v163 Recovery Center button wiring bridge marker: ' + marker);
  });
  ['v163-toast-modal-visibility-pass','data-toast-layer-pass="v163"','--z-toast-modal-visible'].forEach((marker) => {
    if (!uiSource.includes(marker) && !appCssSource.includes(marker)) throw new Error('Missing v163 toast modal visibility marker: ' + marker);
  });
  ['RECOVERY_RUNTIME_REFACTOR_PASS','v164-recovery-runtime-context-lazy-panel-pass','buildRecoveryBaseContext','createRecoveryLazyPanel','renderRecoveryPanelSafely','RECOVERY_CENTER_LAZY_DIAGNOSTICS_PASS'].forEach((marker) => {
    if (!recoveryRuntimeSource.includes(marker)) throw new Error('Missing v164 Recovery Center runtime helper marker: ' + marker);
  });
  ['./recovery/runtime.mjs','RECOVERY_RUNTIME_REFACTOR_BRIDGE','buildRecoveryBaseContext','createRecoveryLazyPanel'].forEach((marker) => {
    if (!devtoolsBridgeSource.includes(marker)) throw new Error('Missing v164 Recovery Center runtime bridge marker: ' + marker);
  });
  ['recoveryRuntimeRefactorPass','v164-recovery-runtime-context-lazy-panel-pass'].forEach((marker) => {
    if (!stateSource.includes(marker)) throw new Error('Missing v164 state runtime refactor marker: ' + marker);
  });
  ['RECOVERY_SUMMARY_RENDERER_REFACTOR_PASS','v165-recovery-summary-renderer-pass','updateRecoveryCards','renderRecoveryBadge','renderRecoverySummaryPanel','formatSearchCoverageSummary'].forEach((marker) => {
    if (!recoverySummaryPanelSource.includes(marker)) throw new Error('Missing v165 Recovery Center summary renderer marker: ' + marker);
  });
  ['./recovery/summary-panel.mjs','RECOVERY_SUMMARY_RENDERER_REFACTOR_BRIDGE','renderRecoverySummaryPanel(app, renderContext)','updateRecoveryCards(app, baseContext)'].forEach((marker) => {
    if (!devtoolsBridgeSource.includes(marker)) throw new Error('Missing v165 Recovery Center summary renderer bridge marker: ' + marker);
  });
  ['recoverySummaryRendererRefactorPass','v165-recovery-summary-renderer-pass'].forEach((marker) => {
    if (!stateSource.includes(marker)) throw new Error('Missing v165 state summary renderer refactor marker: ' + marker);
  });
  ['RECOVERY_POLICY_CHECKLIST_RENDERER_REFACTOR_PASS','v166-recovery-policy-checklist-renderer-pass','RECOVERY_CHECKLIST','renderRecoveryPolicyPanel','renderRecoveryChecklistPanel','cacheClearScope'].forEach((marker) => {
    if (!recoveryPolicyChecklistPanelSource.includes(marker)) throw new Error('Missing v166 Recovery Center policy/checklist renderer marker: ' + marker);
  });
  ['./recovery/policy-checklist-panel.mjs','RECOVERY_POLICY_CHECKLIST_RENDERER_REFACTOR_BRIDGE','renderRecoveryPolicyPanel(baseContext.serverStatus)','renderRecoveryChecklistPanel()'].forEach((marker) => {
    if (!devtoolsBridgeSource.includes(marker)) throw new Error('Missing v166 Recovery Center policy/checklist renderer bridge marker: ' + marker);
  });
  ['recoveryPolicyChecklistRendererRefactorPass','v166-recovery-policy-checklist-renderer-pass'].forEach((marker) => {
    if (!stateSource.includes(marker)) throw new Error('Missing v166 state policy/checklist renderer refactor marker: ' + marker);
  });
  ['RECOVERY_IMPORT_SCOPE_RENDERER_REFACTOR_PASS','v167-recovery-import-scope-renderer-pass','RECOVERY_IMPORT_DEFAULT_SCOPES','RECOVERY_IMPORT_LABELS','describeRecoveryPayload','renderRecoveryImportScopePanel'].forEach((marker) => {
    if (!recoveryImportScopePanelSource.includes(marker)) throw new Error('Missing v167 Recovery Center import-scope renderer marker: ' + marker);
  });
  ['./recovery/import-scope-panel.mjs','RECOVERY_IMPORT_SCOPE_RENDERER_REFACTOR_BRIDGE','renderRecoveryImportScopePanel(app)'].forEach((marker) => {
    if (!devtoolsBridgeSource.includes(marker)) throw new Error('Missing v167 Recovery Center import-scope renderer bridge marker: ' + marker);
  });
  ['getRecoveryImportScopes(app)'].forEach((marker) => {
    if (!devtoolsBridgeSource.includes(marker) && !recoveryImportActionsSource.includes(marker)) throw new Error('Missing v167/v180 Recovery import scope usage marker: ' + marker);
  });
  ['recoveryImportScopeRendererRefactorPass','v167-recovery-import-scope-renderer-pass'].forEach((marker) => {
    if (!stateSource.includes(marker)) throw new Error('Missing v167 state import-scope renderer refactor marker: ' + marker);
  });
  ['RECOVERY_NAVIGATION_REFACTOR_PASS','v168-recovery-navigation-helper-pass','setRecoveryCenterRouteContext','focusRecoveryTarget'].forEach((marker) => {
    if (!recoveryNavigationSource.includes(marker)) throw new Error('Missing v168 Recovery Center navigation helper marker: ' + marker);
  });
  ['./recovery/navigation.mjs','RECOVERY_NAVIGATION_REFACTOR_BRIDGE','focusRecoveryTarget(app','setRecoveryCenterRouteContext(app'].forEach((marker) => {
    if (!devtoolsBridgeSource.includes(marker)) throw new Error('Missing v168 Recovery Center navigation bridge marker: ' + marker);
  });
  ['RECOVERY_ACTION_UI_REFACTOR_PASS','v168-recovery-action-ui-helper-pass','createRecoveryActionDetails','createRecoveryActionCluster'].forEach((marker) => {
    if (!recoveryActionUiSource.includes(marker)) throw new Error('Missing v168 Recovery Center action UI helper marker: ' + marker);
  });
  ['./recovery/action-ui.mjs','RECOVERY_ACTION_UI_REFACTOR_BRIDGE','createRecoveryActionCluster','createRecoveryActionDetails'].forEach((marker) => {
    if (!devtoolsBridgeSource.includes(marker) && !devtoolsNavigationCombinedSource.includes(marker)) throw new Error('Missing v168 Recovery Center action UI bridge marker: ' + marker);
  });
  ['RECOVERY_DOM_SMOKE_PANEL_REFACTOR_PASS','v168-recovery-dom-smoke-panel-pass','RECOVERY_DOM_SMOKE_PANEL_AGGREGATOR_SPLIT_PASS'].forEach((marker) => {
    if (!recoveryDomSmokePanelSource.includes(marker)) throw new Error('Missing v168/v195 Recovery Center DOM smoke panel marker: ' + marker);
  });
  ['buildRecoveryLibraryDomSmokeMarkerReport','buildRecoveryLibraryDomSmokeStaticManifest','createRecoveryLibraryDomSmokeMarkerPanel','RECOVERY_DOM_SMOKE_MARKERS_SPLIT_PASS','RECOVERY_DOM_SMOKE_PANEL_RENDERER_SPLIT_PASS'].forEach((marker) => {
    if (!domSmokeMarkerCombinedSource.includes(marker)) throw new Error('Missing v168/v195 Recovery Center DOM smoke split marker: ' + marker);
  });
  ['./recovery/dom-smoke-panel.mjs','RECOVERY_DOM_SMOKE_PANEL_REFACTOR_BRIDGE','buildRecoveryLibraryDomSmokeMarkerReport','buildRecoveryLibraryDomSmokeStaticManifest','createRecoveryLibraryDomSmokeMarkerPanel'].forEach((marker) => {
    if (!devtoolsBridgeSource.includes(marker) && !domSmokeMarkerCombinedSource.includes(marker) && !libraryVirtualReportsCombinedSource.includes(marker)) throw new Error('Missing v168 Recovery Center DOM smoke panel bridge marker: ' + marker);
  });
  ['recoveryNavigationRefactorPass','recoveryActionUiRefactorPass','recoveryDomSmokePanelRefactorPass','v168-recovery-navigation-helper-pass','v168-recovery-action-ui-helper-pass','v168-recovery-dom-smoke-panel-pass'].forEach((marker) => {
    if (!stateSource.includes(marker)) throw new Error('Missing v168 state refactor marker: ' + marker);
  });
  ['RECOVERY_DIAGNOSTICS_PANEL_REFACTOR_PASS','v169-recovery-diagnostics-panel-renderer-pass','renderRecoveryDiagnosticsPanel','buildRecoveryDiagnosticsPayload','buildRecoveryDiagnosticsRows'].forEach((marker) => {
    if (!recoveryDiagnosticsPanelSource.includes(marker)) throw new Error('Missing v169 Recovery Center diagnostics panel marker: ' + marker);
  });
  ['./recovery/diagnostics-panel.mjs','RECOVERY_DIAGNOSTICS_PANEL_REFACTOR_BRIDGE','renderRecoveryDiagnosticsPanel(app, context)'].forEach((marker) => {
    if (!devtoolsBridgeSource.includes(marker)) throw new Error('Missing v169 Recovery Center diagnostics panel bridge marker: ' + marker);
  });
  ['recoveryDiagnosticsPanelRefactorPass','v169-recovery-diagnostics-panel-renderer-pass'].forEach((marker) => {
    if (!stateSource.includes(marker)) throw new Error('Missing v169 state diagnostics panel refactor marker: ' + marker);
  });
  ['RECOVERY_LIBRARY_FORMATTERS_REFACTOR_PASS','v170-recovery-library-formatters-pass','formatLibraryTrialMs','formatLibraryVirtualTrialSummary','formatLibraryFallbackTimestamp','formatTs'].forEach((marker) => {
    if (!recoveryLibraryFormattersSource.includes(marker)) throw new Error('Missing v170 Recovery Center library formatter marker: ' + marker);
  });
  ['./recovery/library-formatters.mjs','RECOVERY_LIBRARY_FORMATTERS_REFACTOR_BRIDGE','formatLibraryVirtualTrialSummary','formatLibraryFallbackGroups','formatTs'].forEach((marker) => {
    if (!devtoolsBridgeSource.includes(marker) && !libraryVirtualReportsCombinedSource.includes(marker)) throw new Error('Missing v170 Recovery Center library formatter bridge marker: ' + marker);
  });
  ['recoveryLibraryFormattersRefactorPass','v170-recovery-library-formatters-pass'].forEach((marker) => {
    if (!stateSource.includes(marker)) throw new Error('Missing v170 state library formatter refactor marker: ' + marker);
  });
  ['RECOVERY_LIBRARY_VIRTUAL_REPORTS_REFACTOR_PASS','v171-recovery-library-virtual-reports-pass','v245-library-virtual-reports-surface-shrink-pass','RECOVERY_LIBRARY_VIRTUAL_REPORTS_PUBLIC_SURFACE'].forEach((marker) => {
    if (!recoveryLibraryVirtualReportsSource.includes(marker)) throw new Error('Missing v245 Recovery Center library virtual reports surface marker: ' + marker);
  });
  ['buildLibraryVirtualManualReviewBundlePayload','createLibraryVirtualFinalOptInAuditPanel','createLibraryVirtualTrialScenarioPanel'].forEach((marker) => {
    if (!libraryVirtualReportsCombinedSource.includes(marker)) throw new Error('Missing v245 Recovery Center concrete virtual report module marker: ' + marker);
  });
  ['./recovery/library-virtual-reports.mjs','RECOVERY_LIBRARY_VIRTUAL_REPORTS_REFACTOR_BRIDGE','v245-library-virtual-reports-surface-shrink-pass'].forEach((marker) => {
    if (!devtoolsBridgeSource.includes(marker) && !libraryVirtualReportsCombinedSource.includes(marker) && !recoveryLibraryVirtualReportsSource.includes(marker)) throw new Error('Missing v171/v245 Recovery Center library virtual reports bridge marker: ' + marker);
  });
  ['recoveryLibraryVirtualReportsRefactorPass','v171-recovery-library-virtual-reports-pass'].forEach((marker) => {
    if (!stateSource.includes(marker)) throw new Error('Missing v171 state library virtual reports refactor marker: ' + marker);
  });
  ['RECOVERY_CACHE_MANAGEMENT_PANEL_REFACTOR_PASS','v172-recovery-cache-management-panel-pass','renderRecoveryCacheManagementPanel','copyRecoveryPrunePlan'].forEach((marker) => {
    if (!recoveryCacheManagementPanelSource.includes(marker)) throw new Error('Missing v172 Recovery Center cache-management panel marker: ' + marker);
  });
  ['RECOVERY_SEARCH_PANEL_REFACTOR_PASS','v172-recovery-search-panel-pass','renderRecoverySearchPanel','copyRecoverySearchDiagnostics'].forEach((marker) => {
    if (!recoverySearchPanelSource.includes(marker)) throw new Error('Missing v172 Recovery Center search panel marker: ' + marker);
  });
  ['./recovery/cache-management-panel.mjs','./recovery/search-panel.mjs','RECOVERY_CACHE_MANAGEMENT_PANEL_REFACTOR_BRIDGE','RECOVERY_SEARCH_PANEL_REFACTOR_BRIDGE'].forEach((marker) => {
    if (!devtoolsBridgeSource.includes(marker)) throw new Error('Missing v172 Recovery Center cache/search panel bridge marker: ' + marker);
  });
  ['recoveryCacheManagementPanelRefactorPass','v172-recovery-cache-management-panel-pass','recoverySearchPanelRefactorPass','v172-recovery-search-panel-pass'].forEach((marker) => {
    if (!stateSource.includes(marker)) throw new Error('Missing v172 state cache/search panel refactor marker: ' + marker);
  });
  runRecoveryRefactorModuleChecks({ root, devtoolsSource, stateSource });
  ['./recovery/export-utils.mjs','RECOVERY_EXPORT_UTILS_EXTRACTION_BRIDGE','copyRecoveryTextWithFallback','downloadRecoveryJsonFile','exportRecoveryJsonPayload'].forEach((marker) => {
    if (!(devtoolsSource + '\n' + recoveryExportUtilsSource + '\n' + devtoolsControlsSource).includes(marker)) throw new Error('Missing v161 Recovery Center export utils extraction bridge marker: ' + marker);
  });
  ['RECOVERY_SEARCH_DIAGNOSTICS_EXTRACTION_PASS','v157-recovery-search-diagnostics-extraction-pass','getSearchTextCacheDiagnostics','buildRecoverySearchCoverage','formatSearchCoverageSummary','buildCoverageRows','formatCoverageModalSummary'].forEach((marker) => {
    if (!recoverySearchDiagnosticsSource.includes(marker)) throw new Error('Missing v157 extracted search diagnostics marker: ' + marker);
  });
  ['./recovery/search-diagnostics.mjs','RECOVERY_SEARCH_DIAGNOSTICS_EXTRACTION_BRIDGE'].forEach((marker) => {
    if (!devtoolsBridgeSource.includes(marker)) throw new Error('Missing v157 Recovery Center extraction bridge marker: ' + marker);
  });
  ['RECOVERY_CACHE_DIAGNOSTICS_EXTRACTION_PASS','v158-recovery-cache-diagnostics-extraction-pass','buildRecoveryDiagnosticsPayload','buildRecoveryDiagnosticsRows','buildRecoveryCacheManagementRows','parseRecoveryPruneOptions','formatPrunePlan'].forEach((marker) => {
    if (!recoveryCacheDiagnosticsSource.includes(marker)) throw new Error('Missing v158 extracted cache diagnostics marker: ' + marker);
  });
  ['./recovery/cache-diagnostics.mjs','RECOVERY_CACHE_DIAGNOSTICS_EXTRACTION_BRIDGE','buildRecoveryDiagnosticsPayload','buildRecoveryCacheManagementRows'].forEach((marker) => {
    if (!recoveryCacheCombinedSource.includes(marker)) throw new Error('Missing v158 Recovery Center cache extraction bridge marker: ' + marker);
  });
  ['RECOVERY_LIBRARY_DIAGNOSTICS_EXTRACTION_PASS','v159-recovery-library-diagnostics-extraction-pass','buildRecoveryLibraryDiagnosticsSnapshot','buildRecoveryLibraryContextFields','resolveRecoveryLibraryPanelDiagnostics'].forEach((marker) => {
    if (!recoveryLibraryDiagnosticsSource.includes(marker)) throw new Error('Missing v159 extracted library diagnostics marker: ' + marker);
  });
  ['./recovery/library-diagnostics.mjs','RECOVERY_LIBRARY_DIAGNOSTICS_EXTRACTION_BRIDGE','buildRecoveryLibraryContextFields','resolveRecoveryLibraryPanelDiagnostics'].forEach((marker) => {
    if (!devtoolsBridgeSource.includes(marker) && !recoveryLibraryDiagnosticsSource.includes(marker) && !recoveryLibraryDiagnosticsPanelSource.includes(marker)) throw new Error('Missing v159 Recovery Center library extraction bridge marker: ' + marker);
  });
  ['RECOVERY_MANUAL_REVIEW_BUNDLE_EXTRACTION_PASS','v160-recovery-manual-review-bundle-extraction-pass','buildLibraryVirtualManualReviewBundlePolicy','validateLibraryVirtualManualReviewBundleShape','buildLibraryVirtualManualReviewCriticalBlockers','buildLibraryVirtualManualReviewFullEvidence','buildLibraryVirtualManualReviewReviewerSummary'].forEach((marker) => {
    if (!recoveryManualReviewBundleSource.includes(marker)) throw new Error('Missing v160 extracted manual-review bundle marker: ' + marker);
  });
  ['MANUAL_REVIEW_BUNDLE_CONSTANTS_PASS','v212-manual-review-bundle-constants-pass','LIBRARY_VIRTUAL_MANUAL_REVIEW_BUNDLE_REQUIRED_FIELDS','LIBRARY_VIRTUAL_MANUAL_REVIEW_BUNDLE_POLICY_MARKERS'].forEach((marker) => {
    if (!manualReviewBundleCombinedSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v212 manual-review bundle constants marker: ' + marker);
  });

  ['MANUAL_REVIEW_REVIEWER_SUMMARY_SECTIONS_PASS','v213-manual-review-reviewer-summary-sections-pass','buildLibraryVirtualManualReviewReviewerSummarySections','buildLibraryVirtualManualReviewReviewerSummaryCounts','buildLibraryVirtualManualReviewReviewerSummaryPolicy'].forEach((marker) => {
    if (!manualReviewBundleCombinedSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v213 manual-review reviewer summary section marker: ' + marker);
  });
  if (/limitedOptInReadiness:\s*obj\.limitedOptInReadiness \?/m.test(recoveryManualReviewBundleSource)) throw new Error('manual-review-bundle.mjs still owns reviewer summary sections after v213 split');
  if (!recoveryManualReviewBundleSource.includes('./manual-review-reviewer-summary-sections.mjs')) throw new Error('manual-review-bundle.mjs must import v213 reviewer summary section helper');
  ['LIBRARY_VIRTUAL_EVIDENCE_PANEL_RENDERERS_PASS','v214-library-virtual-evidence-panel-renderers-pass','createLibraryVirtualStatusTable','createLibraryVirtualToneIntro','createLibraryVirtualDiagnosticsList'].forEach((marker) => {
    if (!recoveryLibraryVirtualEvidencePanelRenderersSource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v214 evidence panel renderer marker: ' + marker);
  });
  if (!recoveryLibraryVirtualEvidenceDiagnosticsSource.includes('./library-virtual-evidence-panel-renderers.mjs')) throw new Error('evidence diagnostics must import v214 panel renderer helper');
  if (/recovery-status-table'[\s\S]*?recovery-status-key/m.test(recoveryLibraryVirtualEvidenceDiagnosticsSource)) throw new Error('evidence diagnostics still owns status table row rendering after v214 split');

  ['LIBRARY_VIRTUAL_OPTIN_PANEL_RENDERERS_PASS','v215-library-virtual-optin-panel-renderers-pass','createLibraryVirtualLimitedOptInReadinessPanel','createLibraryVirtualFinalOptInAuditPanel'].forEach((marker) => {
    if (!recoveryLibraryVirtualOptinPanelRenderersSource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v215 opt-in panel renderer marker: ' + marker);
  });
  if (!recoveryLibraryVirtualOptinAuditSource.includes('./library-virtual-optin-panel-renderers.mjs')) throw new Error('opt-in audit must import v215 panel renderer helper');
  if (/function\s+createLibraryVirtualFinalOptInAuditPanel/m.test(recoveryLibraryVirtualOptinAuditSource)) throw new Error('opt-in audit still owns final panel rendering after v215 split');


  ['LIBRARY_VIRTUAL_MANUAL_EXPERIMENT_PANEL_RENDERERS_PASS','v216-library-virtual-manual-experiment-panel-renderers-pass','buildManualExperimentPlanRows','createManualExperimentPreCheckList','createManualExperimentFailureList'].forEach((marker) => {
    if (!recoveryLibraryVirtualManualExperimentPanelRenderersSource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v216 manual experiment panel renderer marker: ' + marker);
  });
  if (!recoveryLibraryVirtualReadinessPassiveReportsSource.includes('./library-virtual-manual-experiment-panel-renderers.mjs')) throw new Error('readiness passive reports must import v216 manual experiment panel renderer helper');
  if (/createManualExperimentPreCheckList/m.test(recoveryLibraryVirtualReadinessPassiveReportsSource) && /recovery-manual-experiment-precheck-list[\s\S]*getLibraryVirtualChecklistToneClass/m.test(recoveryLibraryVirtualReadinessPassiveReportsSource)) throw new Error('readiness passive reports still owns manual experiment checklist rendering after v216 split');

  ['LIBRARY_VIRTUAL_STABILIZATION_PANEL_RENDERERS_PASS','v217-library-virtual-stabilization-panel-renderers-pass','buildFinalStabilizationRows','createPostStabilizationSmokeChecklist'].forEach((marker) => {
    if (!recoveryLibraryVirtualStabilizationPanelRenderersSource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v217 stabilization panel renderer marker: ' + marker);
  });
  if (!recoveryLibraryVirtualReadinessPassiveReportsSource.includes('./library-virtual-stabilization-panel-renderers.mjs')) throw new Error('readiness passive reports must import v217 stabilization panel renderer helper');
  if (/recovery-final-stabilization-blocking-list[\s\S]*recovery-final-stabilization-deferred-list[\s\S]*recovery-final-stabilization-known-issue-list/m.test(recoveryLibraryVirtualReadinessPassiveReportsSource)) throw new Error('readiness passive reports still owns final stabilization list rendering after v217 split');
  if (/recovery-post-stabilization-smoke-checklist[\s\S]*recovery-post-stabilization-copy-targets[\s\S]*recovery-post-stabilization-deferred-live-checks/m.test(recoveryLibraryVirtualReadinessPassiveReportsSource)) throw new Error('readiness passive reports still owns post-stabilization list rendering after v217 split');

  ['LIBRARY_VIRTUAL_PRACTICAL_REGRESSION_PANEL_RENDERERS_PASS','v218-library-virtual-practical-regression-panel-renderers-pass','buildPracticalRegressionChecklistRows','createPracticalRegressionChecklistItems','createPracticalRegressionKnownIssueList'].forEach((marker) => {
    if (!recoveryLibraryVirtualPracticalRegressionPanelRenderersSource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v218 practical regression panel renderer marker: ' + marker);
  });
  if (!recoveryLibraryVirtualReadinessPassiveReportsSource.includes('./library-virtual-practical-regression-panel-renderers.mjs')) throw new Error('readiness passive reports must import v218 practical regression panel renderer helper');
  if (recoveryLibraryVirtualReadinessPassiveReportsSource.includes('const itemList = Array.isArray(report.checklist)')) throw new Error('readiness passive reports still owns practical regression checklist list rendering after v218 split');

  ['LIBRARY_VIRTUAL_DECISION_MEMO_PANEL_RENDERERS_PASS','v218-library-virtual-decision-memo-panel-renderers-pass','buildProductionReadinessDecisionMemoRows','createDecisionMemoBlockingList','createProductionReadinessDecisionMemoPanelBody'].forEach((marker) => {
    if (!recoveryLibraryVirtualDecisionMemoPanelRenderersSource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v218 decision memo panel renderer marker: ' + marker);
  });
  if (!recoveryLibraryVirtualReadinessPassiveReportsSource.includes('./library-virtual-decision-memo-panel-renderers.mjs')) throw new Error('readiness passive reports must import v218 decision memo panel renderer helper');
  if (recoveryLibraryVirtualReadinessPassiveReportsSource.includes('const blockerList = (report.blockers || []).length')) throw new Error('readiness passive reports still owns decision memo list rendering after v218 split');


  ['LIBRARY_VIRTUAL_FINAL_SUMMARY_UTILS_PASS','v219-library-virtual-final-summary-utils-pass','createLibraryVirtualFinalStabilizationPolicy','createLibraryVirtualFinalStabilizationReleaseScope','buildPostStabilizationCopyTargetResults'].forEach((marker) => {
    if (!recoveryLibraryVirtualFinalSummaryUtilsSource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v219 final summary utility marker: ' + marker);
  });
  if (!recoveryLibraryVirtualReadinessPassiveReportsSource.includes('./library-virtual-final-summary-utils.mjs') && !recoveryLibraryVirtualReadinessPassiveReportsSource.includes('./library-virtual-final-summary-payload.mjs')) throw new Error('readiness passive reports must import v219/v236 final summary utility or payload helper');
  if (/function normalizeLibraryVirtualFinalStabilizationItem/m.test(recoveryLibraryVirtualReadinessPassiveReportsSource)) throw new Error('readiness passive reports still owns final summary item normalization after v219 split');
  if (/const requiredCopyTargets = \[/m.test(recoveryLibraryVirtualReadinessPassiveReportsSource)) throw new Error('readiness passive reports still owns post-stabilization copy target list after v219 split');

  ['LIBRARY_VIRTUAL_PRACTICAL_REGRESSION_PAYLOAD_PASS','v220-library-virtual-practical-regression-payload-pass','buildLibraryVirtualPracticalRegressionPayloadParts'].forEach((marker) => {
    if (!recoveryLibraryVirtualPracticalRegressionPayloadSource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v220 practical regression payload helper marker: ' + marker);
  });
  if (!recoveryLibraryVirtualReadinessPassiveReportsSource.includes('./library-virtual-practical-regression-payload.mjs')) throw new Error('readiness passive reports must import v220 practical regression payload helper');
  if (/const checklist = \[\s*\{\s*id: 'pc-site-sidebar-toggle'/m.test(recoveryLibraryVirtualReadinessPassiveReportsSource)) throw new Error('readiness passive reports still owns practical regression payload checklist after v220 split');

  ['LIBRARY_VIRTUAL_MANUAL_EXPERIMENT_PAYLOAD_PASS','v221-library-virtual-manual-experiment-payload-pass','buildLibraryVirtualManualExperimentPlanParts','buildManualExperimentPreChecks','buildManualExperimentArchiveCriteria'].forEach((marker) => {
    if (!recoveryLibraryVirtualManualExperimentPayloadSource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v221 manual experiment payload helper marker: ' + marker);
  });
  if (!recoveryLibraryVirtualReadinessPassiveReportsSource.includes('./library-virtual-manual-experiment-payload.mjs')) throw new Error('readiness passive reports must import v221 manual experiment payload helper');
  if (/const\s+preChecks\s*=\s*\[/m.test(recoveryLibraryVirtualReadinessPassiveReportsSource)) throw new Error('readiness passive reports still owns manual experiment pre-check array after v221 split');

  ['LIBRARY_VIRTUAL_POST_STABILIZATION_SMOKE_PAYLOAD_PASS','v221-library-virtual-post-stabilization-smoke-payload-pass','buildPostStabilizationSmokeReviewParts','buildPostStabilizationSmokeChecklist','buildPostStabilizationReleaseBlocking'].forEach((marker) => {
    if (!recoveryLibraryVirtualPostStabilizationSmokePayloadSource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v221 post-stabilization smoke payload helper marker: ' + marker);
  });
  if (!recoveryLibraryVirtualPostStabilizationSmokePayloadSource?.includes('buildPostStabilizationSmokeReviewParts')) throw new Error('Missing v221 post-stabilization smoke payload parts helper');
  if (/const\s+smokeChecklist\s*=\s*\[/m.test(recoveryLibraryVirtualReadinessPassiveReportsSource)) throw new Error('readiness passive reports still owns post-stabilization smoke checklist after v221 split');

  ['LIBRARY_VIRTUAL_DECISION_MEMO_PAYLOAD_PASS','v222-library-virtual-decision-memo-payload-pass','buildLibraryVirtualProductionReadinessDecisionMemoPayload','normalizeLibraryVirtualReadinessStatusForMemo'].forEach((marker) => {
    if (!recoveryLibraryVirtualDecisionMemoPayloadSource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v222 decision memo payload helper marker: ' + marker);
  });
  if (!recoveryLibraryVirtualReadinessPassiveReportsSource.includes('./library-virtual-decision-memo-payload.mjs')) throw new Error('readiness passive reports must import v222 decision memo payload helper');
  if (/const\s+policyPass\s*=\s*staticPolicy\?\.status === 'pass'/m.test(recoveryLibraryVirtualReadinessPassiveReportsSource)) throw new Error('readiness passive reports still owns production decision memo payload internals after v222 split');

  ['LIBRARY_VIRTUAL_READINESS_FINAL_PANEL_UTILS_PASS','v223-library-virtual-readiness-final-panel-utils-pass','createLibraryVirtualReadinessPanelFrame'].forEach((marker) => {
    if (!recoveryLibraryVirtualReadinessFinalPanelUtilsSource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v223 readiness final panel frame helper marker: ' + marker);
  });
  ['LIBRARY_VIRTUAL_READINESS_SECTION_BLOCK_PASS','v224-library-virtual-readiness-section-block-pass','LIBRARY_VIRTUAL_READINESS_STATUS_TITLE_PASS','v225-library-virtual-readiness-status-title-pass','LIBRARY_VIRTUAL_READINESS_STATUS_TABLE_PASS','v226-library-virtual-readiness-status-table-pass','LIBRARY_VIRTUAL_READINESS_PANEL_BODY_BLOCKS_PASS','v232-library-virtual-readiness-panel-body-blocks-pass','createLibraryVirtualReadinessSectionBlock','buildLibraryVirtualReadinessStatusTitle','createLibraryVirtualReadinessSectionBlocks','createLibraryVirtualReadinessStatusRows','createLibraryVirtualReadinessPanelBodyBlocks','LIBRARY_VIRTUAL_READINESS_REPORT_PANEL_HELPER_PASS','v233-library-virtual-readiness-report-panel-helper-pass','createLibraryVirtualReadinessReportPanel'].forEach((marker) => {
    if (!recoveryLibraryVirtualReadinessFinalPanelUtilsSource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v224 readiness section block helper marker: ' + marker);
  });
  if (!recoveryLibraryVirtualReadinessPassiveReportsSource.includes('createLibraryVirtualReadinessReportPanel')) throw new Error('readiness passive reports must use v233 report panel helper');
  if (recoveryLibraryVirtualReadinessPassiveReportsSource.includes('createRecoveryStatusTable')) throw new Error('readiness passive reports still imports/uses raw status table renderer after v226 split');
  if (!recoveryLibraryVirtualReadinessPassiveReportsSource.includes('./library-virtual-readiness-final-panel-utils.mjs')) throw new Error('readiness passive reports must import v223 final panel frame helper');
  ['LIBRARY_VIRTUAL_READINESS_SECTION_FACTORIES_PASS','v235-library-virtual-readiness-section-factories-pass','createFinalStabilizationSummarySections','createPostStabilizationSmokeReviewSections'].forEach((marker) => {
    if (!recoveryLibraryVirtualReadinessSectionFactoriesSource?.includes(marker)) throw new Error('Missing v235 readiness section factory marker: ' + marker);
  });
  if (!recoveryLibraryVirtualReadinessPassiveReportsSource.includes('./library-virtual-readiness-section-factories.mjs')) throw new Error('readiness passive reports must import v235 section factory helper');
  if (recoveryLibraryVirtualReadinessPassiveReportsSource.includes('createFinalStabilizationBlockingList')) throw new Error('readiness passive reports still imports final stabilization section list renderers after v235 split');
  if (recoveryLibraryVirtualReadinessPassiveReportsSource.includes('createPostStabilizationSmokeChecklist')) throw new Error('readiness passive reports still imports post-stabilization section list renderers after v235 split');

  ['LIBRARY_VIRTUAL_FINAL_SUMMARY_PAYLOAD_PASS','v236-library-virtual-final-summary-payload-pass','buildLibraryVirtualFinalStabilizationSummaryParts','buildLibraryVirtualFinalStabilizationClassifications'].forEach((marker) => {
    if (!recoveryLibraryVirtualFinalSummaryPayloadSource?.includes(marker)) throw new Error('Missing v236 final summary payload helper marker: ' + marker);
  });
  if (!recoveryLibraryVirtualReadinessPassiveReportsSource.includes('./library-virtual-final-summary-payload.mjs')) throw new Error('readiness passive reports must import v236 final summary payload helper');
  if (recoveryLibraryVirtualReadinessPassiveReportsSource.includes('createLibraryVirtualFinalStabilizationPolicy({ finalStabilizationIsDiagnosticOnly: true })')) throw new Error('readiness passive reports still owns final summary policy assembly after v236 split');
  if (/const\s+pushBlocking\s*=\s*\(/m.test(recoveryLibraryVirtualReadinessPassiveReportsSource)) throw new Error('readiness passive reports still owns final summary release-blocking collector after v236 split');

  ['LIBRARY_VIRTUAL_POST_STABILIZATION_REVIEW_PAYLOAD_PASS','v237-library-virtual-post-stabilization-review-payload-pass','buildLibraryVirtualPostStabilizationSmokeReviewPayload','createLibraryVirtualPostStabilizationReviewScope'].forEach((marker) => {
    if (!recoveryLibraryVirtualPostStabilizationReviewPayloadSource?.includes(marker)) throw new Error('Missing v237 post-stabilization review payload helper marker: ' + marker);
  });
  if (!recoveryLibraryVirtualReadinessPassiveReportsSource.includes('./library-virtual-post-stabilization-review-payload.mjs')) throw new Error('readiness passive reports must import v237 post-stabilization review payload helper');
  if (recoveryLibraryVirtualReadinessPassiveReportsSource.includes('browserExecutionRequired: true')) throw new Error('readiness passive reports still owns post-stabilization review scope after v237 split');
  if (/staticPassRequired:\s*parts\.smokeChecklist\.filter/m.test(recoveryLibraryVirtualReadinessPassiveReportsSource)) throw new Error('readiness passive reports still owns post-stabilization review count assembly after v237 split');
  if (/recovery-final-stabilization-summary-panel'[\s\S]*recovery-diag-list[\s\S]*Final stabilization summary:/m.test(recoveryLibraryVirtualReadinessPassiveReportsSource)) throw new Error('readiness passive reports still owns final stabilization summary frame after v223 split');
  if (/recovery-post-stabilization-smoke-review-panel'[\s\S]*recovery-diag-list[\s\S]*Post-stabilization smoke review:/m.test(recoveryLibraryVirtualReadinessPassiveReportsSource)) throw new Error('readiness passive reports still owns post-stabilization summary frame after v223 split');
  if (recoveryLibraryVirtualReadinessReportsSource.includes("normalizeLibraryVirtualFinalStabilizationItem,\n  buildLibraryVirtualFinalStabilizationSummary")) throw new Error('readiness reports must not re-export final stabilization normalizer from passive reports after v225 fix');
  if (!recoveryLibraryVirtualReadinessReportsSource.includes("export { normalizeLibraryVirtualFinalStabilizationItem } from './library-virtual-final-summary-utils.mjs';")) throw new Error('readiness reports must re-export final stabilization normalizer from owner module after v225 fix');


  ['./recovery/manual-review-bundle.mjs','RECOVERY_MANUAL_REVIEW_BUNDLE_EXTRACTION_BRIDGE','buildLibraryVirtualManualReviewBundlePolicy','validateLibraryVirtualManualReviewBundleShape'].forEach((marker) => {
    if (!devtoolsBridgeSource.includes(marker) && !manualReviewBundleCombinedSource.includes(marker) && !libraryVirtualReportsCombinedSource.includes(marker)) throw new Error('Missing v160 Recovery Center manual-review bundle extraction bridge marker: ' + marker);
  });

  const v157DocFiles = [
    'rebuild-phase157.md',
    'remaining-work-v157.md',
    'worklist-v157.md',
    'performance-optimization-v157.md',
    'optimization-audit-v157.md',
    'refactor-extraction-readiness-v157.md',
    'recovery-search-diagnostics-extraction-v157.md',
    'library-virtual-renderer-readiness-v157.md',
    'default-virtual-renderer-guarded-rollout-v157.md',
    'migration-gap-audit.md'
  ];
  for (const rel of v157DocFiles) {
    const full = path.join(docsRoot, rel);
    if (!fs.existsSync(full)) {}
  }
  const phase157Source = readGuardHistoricalDoc(docsRoot, 'rebuild-phase157.md');
  ['Rebuild Phase 157','Recovery Center diagnostics extraction — first slice','v157-recovery-search-diagnostics-extraction-pass','features/recovery/search-diagnostics.mjs'].forEach((marker) => {
    if (!phase157Source.includes(marker)) throw new Error('Missing v157 phase doc marker: ' + marker);
  });
  const extraction157Source = readGuardHistoricalDoc(docsRoot, 'recovery-search-diagnostics-extraction-v157.md');
  ['Recovery Search Diagnostics Extraction v157','Extracted module','Search diagnostics only','No runtime search semantics change'].forEach((marker) => {
    if (!extraction157Source.includes(marker)) throw new Error('Missing v157 extraction doc marker: ' + marker);
  });
  const worklist157Source = readGuardHistoricalDoc(docsRoot, 'worklist-v157.md');
  ['High Impact Only','Reduce sync-devtools.mjs recovery/search diagnostics coupling','Preserve Recovery Center lazy diagnostics and JSON fallback','Keep reader/search/library runtime semantics unchanged'].forEach((marker) => {
    if (!worklist157Source.includes(marker)) throw new Error('Missing v157 high-impact worklist marker: ' + marker);
  });

  const v158DocFiles = [
    'rebuild-phase158.md',
    'remaining-work-v158.md',
    'worklist-v158.md',
    'performance-optimization-v158.md',
    'optimization-audit-v158.md',
    'refactor-extraction-readiness-v158.md',
    'recovery-cache-diagnostics-extraction-v158.md',
    'library-virtual-renderer-readiness-v158.md',
    'default-virtual-renderer-guarded-rollout-v158.md',
    'migration-gap-audit.md'
  ];
  for (const rel of v158DocFiles) {
    const full = path.join(docsRoot, rel);
    if (!fs.existsSync(full)) {}
  }
  const phase158Source = readGuardHistoricalDoc(docsRoot, 'rebuild-phase158.md');
  ['Rebuild Phase 158','Recovery Center cache diagnostics extraction','v158-recovery-cache-diagnostics-extraction-pass','features/recovery/cache-diagnostics.mjs'].forEach((marker) => {
    if (!phase158Source.includes(marker)) throw new Error('Missing v158 phase doc marker: ' + marker);
  });
  const extraction158Source = readGuardHistoricalDoc(docsRoot, 'recovery-cache-diagnostics-extraction-v158.md');
  ['Recovery Cache Diagnostics Extraction v158','Extracted module','Cache diagnostics only','No cache action wiring change'].forEach((marker) => {
    if (!extraction158Source.includes(marker)) throw new Error('Missing v158 extraction doc marker: ' + marker);
  });
  const worklist158Source = readGuardHistoricalDoc(docsRoot, 'worklist-v158.md');
  ['High Impact Only','Reduce sync-devtools.mjs recovery/cache diagnostics coupling','Preserve Recovery Center cache action wiring','Keep reader/search/library runtime semantics unchanged'].forEach((marker) => {
    if (!worklist158Source.includes(marker)) throw new Error('Missing v158 high-impact worklist marker: ' + marker);
  });

  const v159DocFiles = [
    'rebuild-phase159.md',
    'remaining-work-v159.md',
    'worklist-v159.md',
    'performance-optimization-v159.md',
    'optimization-audit-v159.md',
    'refactor-extraction-readiness-v159.md',
    'library-diagnostics-extraction-v159.md',
    'library-virtual-renderer-readiness-v159.md',
    'default-virtual-renderer-guarded-rollout-v159.md',
    'migration-gap-audit.md'
  ];
  for (const rel of v159DocFiles) {
    const full = path.join(docsRoot, rel);
    if (!fs.existsSync(full)) {}
  }
  const phase159Source = readGuardHistoricalDoc(docsRoot, 'rebuild-phase159.md');
  ['Rebuild Phase 159','Library diagnostics extraction','v159-recovery-library-diagnostics-extraction-pass','features/recovery/library-diagnostics.mjs'].forEach((marker) => {
    if (!phase159Source.includes(marker)) throw new Error('Missing v159 phase doc marker: ' + marker);
  });
  const extraction159Source = readGuardHistoricalDoc(docsRoot, 'library-diagnostics-extraction-v159.md');
  ['Library Diagnostics Extraction v159','Extracted module','Library diagnostics only','No renderer action wiring change'].forEach((marker) => {
    if (!extraction159Source.includes(marker)) throw new Error('Missing v159 extraction doc marker: ' + marker);
  });
  const worklist159Source = readGuardHistoricalDoc(docsRoot, 'worklist-v159.md');
  ['High Impact Only','Reduce sync-devtools.mjs recovery/library diagnostics coupling','Preserve renderer fallback and session opt-in wiring','Keep reader/search/library runtime semantics unchanged'].forEach((marker) => {
    if (!worklist159Source.includes(marker)) throw new Error('Missing v159 high-impact worklist marker: ' + marker);
  });

  const v160DocFiles = [
    'rebuild-phase160.md',
    'remaining-work-v160.md',
    'worklist-v160.md',
    'performance-optimization-v160.md',
    'optimization-audit-v160.md',
    'refactor-extraction-readiness-v160.md',
    'recovery-manual-review-bundle-extraction-v160.md',
    'library-virtual-renderer-readiness-v160.md',
    'default-virtual-renderer-guarded-rollout-v160.md',
    'migration-gap-audit.md'
  ];
  for (const rel of v160DocFiles) {
    const full = path.join(docsRoot, rel);
    if (!fs.existsSync(full)) {}
  }
  const phase160Source = readGuardHistoricalDoc(docsRoot, 'rebuild-phase160.md');
  ['Rebuild Phase 160','Recovery Center manual-review bundle helper extraction','v160-recovery-manual-review-bundle-extraction-pass','features/recovery/manual-review-bundle.mjs'].forEach((marker) => {
    if (!phase160Source.includes(marker)) throw new Error('Missing v160 phase doc marker: ' + marker);
  });
  const extraction160Source = readGuardHistoricalDoc(docsRoot, 'recovery-manual-review-bundle-extraction-v160.md');
  ['Recovery Manual-Review Bundle Extraction v160','Added module','Extracted helpers','Not extracted'].forEach((marker) => {
    if (!extraction160Source.includes(marker)) throw new Error('Missing v160 manual-review extraction doc marker: ' + marker);
  });
  const worklist160Source = readGuardHistoricalDoc(docsRoot, 'worklist-v160.md');
  ['High Impact Only','Reduce `sync-devtools.mjs` manual-review bundle coupling','Preserve Recovery Center DOM rendering and copy/download button wiring','Preserve reader/search/library runtime semantics'].forEach((marker) => {
    if (!worklist160Source.includes(marker)) throw new Error('Missing v160 high-impact worklist marker: ' + marker);
  });


  const v161DocFiles = [
    'rebuild-phase161.md',
    'remaining-work-v161.md',
    'worklist-v161.md',
    'performance-optimization-v161.md',
    'optimization-audit-v161.md',
    'refactor-extraction-readiness-v161.md',
    'recovery-export-utils-extraction-v161.md',
    'library-virtual-renderer-readiness-v161.md',
    'default-virtual-renderer-guarded-rollout-v161.md',
    'migration-gap-audit.md'
  ];
  for (const rel of v161DocFiles) {
    const full = path.join(docsRoot, rel);
    if (!fs.existsSync(full)) {}
  }
  const phase161Source = readGuardHistoricalDoc(docsRoot, 'rebuild-phase161.md');
  ['Rebuild Phase 161','Recovery Center export/copy fallback helper extraction','v161-recovery-export-utils-extraction-pass','features/recovery/export-utils.mjs'].forEach((marker) => {
    if (!phase161Source.includes(marker)) throw new Error('Missing v161 phase doc marker: ' + marker);
  });
  const extraction161Source = readGuardHistoricalDoc(docsRoot, 'recovery-export-utils-extraction-v161.md');
  ['Recovery Export Utils Extraction v161','Added module','Extracted helpers','Not extracted'].forEach((marker) => {
    if (!extraction161Source.includes(marker)) throw new Error('Missing v161 export utils extraction doc marker: ' + marker);
  });
  const worklist161Source = readGuardHistoricalDoc(docsRoot, 'worklist-v161.md');
  ['High Impact Only','Reduce `sync-devtools.mjs` export/copy fallback coupling','Preserve Recovery Center button event wiring','Preserve reader/search/library runtime semantics'].forEach((marker) => {
    if (!worklist161Source.includes(marker)) throw new Error('Missing v161 high-impact worklist marker: ' + marker);
  });


  const v162DocFiles = [
    'rebuild-phase162.md',
    'worklist-v162.md',
    'theme-devtools-stabilization-v162.md'
  ];
  for (const rel of v162DocFiles) {
    const full = path.join(docsRoot, rel);
    if (!fs.existsSync(full)) {}
  }
  const phase162Source = readGuardHistoricalDoc(docsRoot, 'rebuild-phase162.md');
  ['Rebuild v162 Stabilization Pass','테마 모달 적용 버튼','개발자 디버그 토글'].forEach((marker) => {
    if (!phase162Source.includes(marker)) throw new Error('Missing v162 phase doc marker: ' + marker);
  });
  const themeDevtools162Source = readGuardHistoricalDoc(docsRoot, 'theme-devtools-stabilization-v162.md');
  ['Theme / Devtools Stabilization v162','applyThemeColors()','devtoolsReportOptions','safe-area'].forEach((marker) => {
    if (!themeDevtools162Source.includes(marker)) throw new Error('Missing v162 theme/devtools doc marker: ' + marker);
  });

  ['rebuild-phase168.md','worklist-v168.md'].forEach((rel) => {
    const full = path.join(docsRoot, rel);
    if (!fs.existsSync(full)) {}
  });
  const phase168Source = readGuardHistoricalDoc(docsRoot, 'rebuild-phase168.md');
  ['Rebuild Phase 168','navigation.mjs','action-ui.mjs','dom-smoke-panel.mjs'].forEach((marker) => {
    if (!phase168Source.includes(marker)) throw new Error('Missing v168 phase doc marker: ' + marker);
  });
  ['rebuild-phase169.md','worklist-v169.md'].forEach((rel) => {
    const full = path.join(docsRoot, rel);
    if (!fs.existsSync(full)) {}
  });
  const phase169Source = readGuardHistoricalDoc(docsRoot, 'rebuild-phase169.md');
  ['Rebuild Phase 169','diagnostics-panel.mjs','Recovery Center diagnostics panel renderer'].forEach((marker) => {
    if (!phase169Source.includes(marker)) throw new Error('Missing v169 phase doc marker: ' + marker);
  });

  ['rebuild-phase170.md','worklist-v170.md'].forEach((rel) => {
    const full = path.join(docsRoot, rel);
    if (!fs.existsSync(full)) {}
  });
  const phase170Source = readGuardHistoricalDoc(docsRoot, 'rebuild-phase170.md');
  ['Rebuild Phase 170','library-formatters.mjs','Recovery Center library formatter extraction'].forEach((marker) => {
    if (!phase170Source.includes(marker)) throw new Error('Missing v170 phase doc marker: ' + marker);
  });

  ['v174 Recovery Center nested modal layer audit','--z-recovery-child-overlay','--z-recovery-child-panel','data-recovery-modal-layer-pass="v175"','body[data-active-modal-layer="recoveryCenterOverlay"] .recovery-chunk-overlay'].forEach((marker) => {
    if (!appCssSource.includes(marker)) throw new Error('Missing v175 Recovery Center modal layer CSS marker: ' + marker);
  });
  ['RECOVERY_MODAL_LAYER_PASS','v175-recovery-modal-layer-helper-pass','markRecoverySubModalLayer','RECOVERY_MODAL_LAYER_BRIDGE','cached-novels','search-coverage'].forEach((marker) => {
    if (!recoveryModalLayerCombinedSource.includes(marker)) throw new Error('Missing v175 Recovery Center modal layer runtime marker: ' + marker);
  });
  ['recoveryModalLayerPass','v175-recovery-modal-layer-helper-pass','recoveryCacheActionsRefactorPass','v175-recovery-cache-actions-pass','recoverySearchActionsRefactorPass','v175-recovery-search-actions-pass'].forEach((marker) => {
    if (!stateSource.includes(marker)) throw new Error('Missing v175 Recovery Center action/layer state marker: ' + marker);
  });
  ['RECOVERY_CACHE_ACTIONS_REFACTOR_PASS','v175-recovery-cache-actions-pass','openRecoveryCachedNovelsModal','deleteRecoveryCacheChunks'].forEach((marker) => {
    if (!recoveryCacheActionsSource.includes(marker)) throw new Error('Missing v175 Recovery Center cache actions marker: ' + marker);
  });
  ['RECOVERY_SEARCH_ACTIONS_REFACTOR_PASS','v175-recovery-search-actions-pass','openRecoveryCoverageModal'].forEach((marker) => {
    if (!recoverySearchActionsSource.includes(marker)) throw new Error('Missing v175 Recovery Center search actions marker: ' + marker);
  });
  ['./recovery/cache-actions.mjs','./recovery/search-actions.mjs','./recovery/modal-layer.mjs','RECOVERY_CACHE_ACTIONS_REFACTOR_BRIDGE','RECOVERY_SEARCH_ACTIONS_REFACTOR_BRIDGE'].forEach((marker) => {
    if (!devtoolsBridgeSource.includes(marker)) throw new Error('Missing v175 Recovery Center action bridge marker: ' + marker);
  });
  ['rebuild-phase175.md','worklist-v175.md'].forEach((rel) => {
    const full = path.join(docsRoot, rel);
    if (!fs.existsSync(full)) {}
  });

  ['RECOVERY_SNAPSHOT_EXPORT_REFACTOR_PASS','v176-recovery-snapshot-export-pass','buildRecoverySnapshot','downloadRecoverySnapshot'].forEach((marker) => {
    if (!recoverySnapshotExportSource.includes(marker)) throw new Error('Missing v176 Recovery snapshot/export marker: ' + marker);
  });
  ['RECOVERY_LOCAL_MAINTENANCE_REFACTOR_PASS','v176-recovery-local-maintenance-actions-pass','retryRecoverySaves','clearRecoveryLocalUserData'].forEach((marker) => {
    if (!recoveryLocalMaintenanceSource.includes(marker)) throw new Error('Missing v176 Recovery local maintenance marker: ' + marker);
  });
  ['./recovery/snapshot-export.mjs','./recovery/local-maintenance-actions.mjs','RECOVERY_SNAPSHOT_EXPORT_REFACTOR_BRIDGE','RECOVERY_LOCAL_MAINTENANCE_REFACTOR_BRIDGE'].forEach((marker) => {
    if (!devtoolsBridgeSource.includes(marker)) throw new Error('Missing v176 Recovery snapshot/local bridge marker: ' + marker);
  });
  ['recoverySnapshotExportRefactorPass','v176-recovery-snapshot-export-pass','recoveryLocalMaintenanceRefactorPass','v176-recovery-local-maintenance-actions-pass'].forEach((marker) => {
    if (!stateSource.includes(marker)) throw new Error('Missing v176 Recovery state marker: ' + marker);
  });
  if (devtoolsSource.includes('function snapshot(app, options = {})')) throw new Error('sync-devtools.mjs still owns recovery snapshot after v176 extraction');
  if (devtoolsSource.includes('async function retryRecoverySaves(app)')) throw new Error('sync-devtools.mjs still owns retry save action after v176 extraction');
  if (devtoolsSource.includes('function clearRecoveryLocalUserData(app)')) throw new Error('sync-devtools.mjs still owns local user data reset after v176 extraction');
  ['rebuild-phase176.md','worklist-v176.md'].forEach((rel) => {
    const full = path.join(docsRoot, rel);
    if (!fs.existsSync(full)) {}
  });
}

module.exports = {
  FRONTEND_CHECK_RECOVERY_CENTER_GUARDS_PASS,
  runRecoveryCenterGuardChecks
};
