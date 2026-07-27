const {
  requireConstArrayEntries,
  requirePolicyMarker
} = require('./check-utils.js');

const FRONTEND_CHECK_LIBRARY_VIRTUAL_REPORT_HISTORY_GUARDS_PASS = 'v188-frontend-check-library-virtual-report-history-guards-pass';

function runLibraryVirtualReportHistoryGuardChecks(ctx) {
  const {
    libraryVirtualReportsCombinedSource,
    domSmokeMarkerCombinedSource,
    manualReviewBundleCombinedSource,
    librarySource,
    libraryVirtualFallbackPolicySource,
    libraryVirtualHistoryRecordSource,
    libraryVirtualRenderReportingSource
  } = ctx;

  ['LIBRARY_VIRTUAL_CHECKLIST_SCHEMA_VERSION','validateLibraryVirtualManualReviewChecklistShape','buildLibraryVirtualChecklistFreshness','severityCounts','freshness.markers','Review checklist JSON shape check'].forEach((marker) => {
    if (!libraryVirtualReportsCombinedSource.includes(marker)) throw new Error(`Missing v90 checklist evidence marker: ${marker}`);
  });
  ['LIBRARY_VIRTUAL_CHECKLIST_HISTORY_LIMIT','buildLibraryVirtualChecklistSnapshotDiff','Review checklist diff JSON','Checklist snapshot history / diff','snapshotHistoryPolicy'].forEach((marker) => {
    if (!libraryVirtualReportsCombinedSource.includes(marker)) throw new Error(`Missing v91 checklist snapshot/diff marker: ${marker}`);
  });
  ['RECOVERY_LIBRARY_DOM_SMOKE_MARKER_SCHEMA_VERSION','RECOVERY_LIBRARY_DOM_SMOKE_MARKERS','buildRecoveryLibraryDomSmokeMarkerReport','buildRecoveryLibraryDomSmokeStaticManifest','createRecoveryLibraryDomSmokeMarkerPanel','DOM smoke marker JSON','Recovery Center DOM smoke marker checks','recovery-dom-smoke-panel'].forEach((marker) => {
    if (!domSmokeMarkerCombinedSource.includes(marker)) throw new Error(`Missing v92 Recovery Center DOM smoke marker: ${marker}`);
  });
  ['LIBRARY_VIRTUAL_CHECKLIST_DIFF_FILTERS','getLibraryVirtualChecklistDiffFilter','clearLibraryVirtualChecklistSnapshotHistory','formatLibraryVirtualChecklistDiffSummary','Diff filter: critical changed','Clear checklist history','filteredDiff'].forEach((marker) => {
    if (!libraryVirtualReportsCombinedSource.includes(marker)) throw new Error(`Missing v94 checklist diff usability marker: ${marker}`);
  });
  ['LIBRARY_VIRTUAL_MANUAL_REVIEW_BUNDLE_SCHEMA_VERSION','buildLibraryVirtualManualReviewBundlePayload','createLibraryVirtualManualReviewBundlePanel','Manual review bundle JSON','recovery-manual-review-bundle-panel','button-manual-review-bundle-json','manualReviewBundle: buildLibraryVirtualManualReviewBundlePayload'].forEach((marker) => {
    if (!libraryVirtualReportsCombinedSource.includes(marker)) throw new Error(`Missing v94 manual review bundle marker: ${marker}`);
  });
  ['LIBRARY_VIRTUAL_MANUAL_REVIEW_BUNDLE_REQUIRED_FIELDS','LIBRARY_VIRTUAL_MANUAL_REVIEW_BUNDLE_POLICY_MARKERS','validateLibraryVirtualManualReviewBundleShape','buildLibraryVirtualManualReviewBundlePolicy','createLibraryVirtualManualReviewBundleShapePanel','Manual review bundle shape','Manual review bundle shape JSON','recovery-manual-review-bundle-shape-panel','button-manual-review-bundle-shape-json','shapeCheck = validateLibraryVirtualManualReviewBundleShape'].forEach((marker) => {
    if (!libraryVirtualReportsCombinedSource.includes(marker)) throw new Error(`Missing v95 manual review bundle shape marker: ${marker}`);
  });
  ['LIBRARY_VIRTUAL_MANUAL_REVIEW_READINESS_EXPORT_SCHEMA_VERSION','LIBRARY_VIRTUAL_MANUAL_REVIEW_BLOCKER_CATEGORIES','buildLibraryVirtualManualReviewReviewerSummary','buildLibraryVirtualManualReviewFullEvidence','buildLibraryVirtualManualReviewCriticalBlockers','createLibraryVirtualManualReviewReadinessExportPanel','Manual review readiness export','Manual review summary JSON','Manual review blockers JSON','recovery-manual-review-readiness-export-panel','button-manual-review-summary-json','button-manual-review-blockers-json','reviewerSummary','fullEvidence','criticalBlockers'].forEach((marker) => {
    if (!libraryVirtualReportsCombinedSource.includes(marker)) throw new Error(`Missing v96 manual review readiness export marker: ${marker}`);
  });
  ['LIBRARY_VIRTUAL_DIAGNOSTICS_LIGHTWEIGHT_TEST_SCHEMA_VERSION','LIBRARY_VIRTUAL_DIAGNOSTICS_LIGHTWEIGHT_TEST_COMMANDS','buildLibraryVirtualDiagnosticsLightweightTestPayload','createLibraryVirtualDiagnosticsLightweightTestPanel','pushLibraryVirtualDiagnosticsLightweightTestResult','Diagnostics lightweight test command','Diagnostic lightweight test JSON','Run lightweight diagnostics test','recovery-diagnostics-lightweight-test-panel','button-diagnostics-lightweight-test-json','button-diagnostics-lightweight-run','diagnosticLightweightTest','manual-review-readiness-lightweight-static'].forEach((marker) => {
    if (!libraryVirtualReportsCombinedSource.includes(marker)) throw new Error(`Missing v97 lightweight diagnostics test marker: ${marker}`);
  });
  ['LIBRARY_VIRTUAL_LIMITED_OPT_IN_READINESS_SCHEMA_VERSION','LIBRARY_VIRTUAL_LIMITED_OPT_IN_READINESS_REQUIRED_CHECKS','buildLibraryVirtualLimitedOptInReadinessPayload','createLibraryVirtualLimitedOptInReadinessPanel','pushLibraryVirtualLimitedOptInReadinessCheck','Limited opt-in readiness screen','Limited opt-in readiness JSON','recovery-limited-opt-in-readiness-panel','button-limited-opt-in-readiness-json','limitedOptInReadiness','ready-for-manual-experiment-review','enableActionAvailable: false'].forEach((marker) => {
    if (!libraryVirtualReportsCombinedSource.includes(marker)) throw new Error(`Missing v98 limited opt-in readiness marker: ${marker}`);
  });
  ['LIBRARY_VIRTUAL_FINAL_OPT_IN_AUDIT_SCHEMA_VERSION','LIBRARY_VIRTUAL_FINAL_OPT_IN_AUDIT_REQUIRED_CHECKS','buildLibraryVirtualFinalOptInAuditPayload','createLibraryVirtualFinalOptInAuditPanel','pushLibraryVirtualFinalOptInAuditCheck','Final opt-in audit','Final opt-in audit JSON','recovery-final-opt-in-audit-panel','button-final-opt-in-audit-json','finalOptInAudit','final-audit-clear','implementationStillRequiresExplicitLaterChange'].forEach((marker) => {
    if (!libraryVirtualReportsCombinedSource.includes(marker)) throw new Error(`Missing v100 final opt-in audit marker: ${marker}`);
  });
  ['LIBRARY_VIRTUAL_FINAL_OPT_IN_AUDIT_FILTERS','LIBRARY_VIRTUAL_FINAL_OPT_IN_AUDIT_CHECK_CATEGORIES','LIBRARY_VIRTUAL_FINAL_OPT_IN_AUDIT_CATEGORY_LABELS','getLibraryVirtualFinalOptInAuditFilter','setLibraryVirtualFinalOptInAuditFilter','applyLibraryVirtualFinalOptInAuditFilter','buildLibraryVirtualFinalOptInAuditCategoryGroups','buildLibraryVirtualFinalOptInAuditCompactSummary','Final audit compact summary JSON','Final audit filter: ALL','Final audit filter: blockers','Final audit filter: warnings','recovery-final-audit-filter-actions','recovery-final-audit-category-groups','blockerCategoryGroups','warningCategoryGroups','compactSummary'].forEach((marker) => {
    if (!libraryVirtualReportsCombinedSource.includes(marker)) throw new Error(`Missing v102 final audit usability marker: ${marker}`);
  });
  ['LIBRARY_VIRTUAL_STATIC_POLICY_GUARD_SCHEMA_VERSION','LIBRARY_VIRTUAL_STATIC_POLICY_GUARD_REQUIRED_ASSERTIONS','buildLibraryVirtualStaticPolicyGuard','staticPolicyGuard','static-policy-guard','no-production-enable-action','full-fallback-reset-only','productionOptInActionExposed: false','enableActionExposed: false','automaticEnableAllowed: false'].forEach((marker) => {
    if (!libraryVirtualReportsCombinedSource.includes(marker)) throw new Error(`Missing v102 static policy hardening marker: ${marker}`);
  });
  [
    ['fallback policy windowed kind', libraryVirtualFallbackPolicySource, "record?.mode === 'windowed'", "return 'windowed-render'"],
    ['fallback policy windowed label', libraryVirtualFallbackPolicySource, "'windowed-render': 'Windowed render'", "'windowed-render': 'windowed renderer가 정상 실행된 정보성 기록입니다."],
    ['history compact non-blocking windowed', libraryVirtualHistoryRecordSource, "kind === 'windowed-render' ? 'windowed-render'", "mode: record.mode || (kind === 'windowed-render' ? 'windowed'"],
    ['window render record explicit non-blocking kind', libraryVirtualRenderReportingSource, "kind:'windowed-render'", "blocking:false"],
    ['diagnostics row-height estimate from last render', librarySource, 'getLibraryVirtualDiagnosticsRowHeightMeasurement', 'lastRender?.rowHeightEstimate || lastRender?.rowHeight']
  ].forEach(([label, source, ...markers]) => {
    markers.forEach((marker) => {
      if (!String(source || '').includes(marker)) throw new Error(`Missing v262 library virtual render-report classification marker (${label}): ${marker}`);
    });
  });
  requireConstArrayEntries(manualReviewBundleCombinedSource, 'LIBRARY_VIRTUAL_MANUAL_REVIEW_BUNDLE_REQUIRED_FIELDS', ['version','generatedAt','source','policy','staticPolicyGuard','checklist','checklistDiff','domSmoke','rowHeight','safeTrial','fallback','gate','actionAudit','prototype','windowRows','diagnostics'], 'manual review bundle required fields');
  requireConstArrayEntries(manualReviewBundleCombinedSource, 'LIBRARY_VIRTUAL_MANUAL_REVIEW_BUNDLE_EVIDENCE_FIELDS', ['checklist','checklistDiff','domSmoke','rowHeight','safeTrial','fallback','gate','actionAudit','prototype','windowRows','diagnostics'], 'manual review bundle evidence fields');
  requireConstArrayEntries(manualReviewBundleCombinedSource, 'LIBRARY_VIRTUAL_MANUAL_REVIEW_BLOCKER_CATEGORIES', ['checklist','shape','policy','evidence','domSmoke','rowHeight','fallback','gate','actionAudit','prototype','safeTrial'], 'critical blocker categories');
  requireConstArrayEntries(libraryVirtualReportsCombinedSource, 'LIBRARY_VIRTUAL_DIAGNOSTICS_LIGHTWEIGHT_TEST_COMMANDS', ['manual-review-bundle-shape','manual-review-policy-markers','manual-review-readiness-export','recovery-dom-smoke-static-markers','copy-target-marker-shape','copy-payload-shape','dom-export-payload-linkage','settings-summary-latest-match','final-audit-filter-state','limited-opt-in-readiness-screen','final-opt-in-audit','static-policy-guard'], 'lightweight diagnostics commands');
  requireConstArrayEntries(libraryVirtualReportsCombinedSource, 'LIBRARY_VIRTUAL_LIMITED_OPT_IN_READINESS_REQUIRED_CHECKS', ['diagnostic-only-policy','bundle-shape-pass','critical-blockers-clear','manual-review-checklist-ready','safe-trial-confidence-ready','windowed-qualified-coverage-complete','row-height-risk-low','action-audit-safe','prototype-and-interaction-safe','dom-smoke-markers-pass'], 'limited opt-in readiness required checks');
  requireConstArrayEntries(libraryVirtualReportsCombinedSource, 'LIBRARY_VIRTUAL_FINAL_OPT_IN_AUDIT_REQUIRED_CHECKS', ['policy-guard','static-policy-guard','bundle-shape','readiness-export','critical-blockers','limited-readiness','lightweight-diagnostics','settings-summary-readonly','safe-trial','row-height','action-dnd-longpress','prototype-interaction','dom-smoke'], 'final opt-in audit required checks');
  requireConstArrayEntries(libraryVirtualReportsCombinedSource, 'LIBRARY_VIRTUAL_FINAL_OPT_IN_AUDIT_FILTERS', ['all','blockers','warnings'], 'final audit filters');
  ['autoEnableAllowed','settingsToggleExposed','recoveryCenterOnlyControls','enableActionExposed','productionOptInActionExposed','automaticEnableAllowed'].forEach((key) => {
    const expected = key === 'recoveryCenterOnlyControls' ? 'true' : 'false';
    requirePolicyMarker(manualReviewBundleCombinedSource, key, expected);
  });
  requirePolicyMarker(manualReviewBundleCombinedSource, 'defaultEnabled', 'true');
  if (!manualReviewBundleCombinedSource.includes('fallbackToFullOnFailure: true')) throw new Error('Missing v140 fallbackToFullOnFailure policy marker');
  requireConstArrayEntries(libraryVirtualReportsCombinedSource, 'LIBRARY_VIRTUAL_STATIC_POLICY_GUARD_REQUIRED_ASSERTIONS', ['guarded-default-on','auto-full-fallback','no-auto-enable','no-settings-toggle','no-production-enable-action','runtime-only-diagnostics','full-fallback-reset-only'], 'static policy guard assertions');
  ['section-diagnostics-lightweight-test','panel-diagnostics-lightweight-test','button-diagnostics-lightweight-test-json','button-diagnostics-lightweight-run','section-limited-opt-in-readiness','panel-limited-opt-in-readiness','button-limited-opt-in-readiness-json','section-final-opt-in-audit','panel-final-opt-in-audit','button-final-opt-in-audit-json'].forEach((marker) => {
    if (!domSmokeMarkerCombinedSource.includes(marker)) throw new Error(`Missing v100 DOM smoke marker id: ${marker}`);
  });
  ['LIBRARY_VIRTUAL_DIAGNOSTICS_COPY_PAYLOAD_TARGETS','LIBRARY_VIRTUAL_DIAGNOSTICS_SELF_TEST_SCHEMA_VERSION','buildLibraryVirtualDiagnosticsCopyPayloadShapeReport','buildLibraryVirtualDiagnosticsDomExportLinkReport','buildLibraryVirtualSettingsSummaryMatchReport','buildLibraryVirtualFinalAuditFilterStateReport','buildLibraryVirtualDiagnosticsSelfTestExpansionPayload','createLibraryVirtualDiagnosticsSelfTestExpansionPanel','Diagnostics self-test expansion','Diagnostics self-test expansion JSON','copyPayloadShape','domExportLinkage','settingsSummaryMatch','finalAuditFilterState','diagnosticSelfTestExpansion'].forEach((marker) => {
    if (!libraryVirtualReportsCombinedSource.includes(marker)) throw new Error(`Missing v104 diagnostics self-test expansion marker: ${marker}`);
  });
  ['section-diagnostics-selftest-expansion','panel-diagnostics-selftest-expansion','button-diagnostics-selftest-expansion-json'].forEach((marker) => {
    if (!domSmokeMarkerCombinedSource.includes(marker)) throw new Error(`Missing v104 diagnostics self-test DOM smoke marker id: ${marker}`);
  });
  ['LIBRARY_VIRTUAL_EVIDENCE_FRESHNESS_SCHEMA_VERSION','LIBRARY_VIRTUAL_EVIDENCE_FRESHNESS_TARGETS','buildLibraryVirtualEvidenceFreshnessReport','createLibraryVirtualEvidenceFreshnessPanel','Readiness evidence freshness','Evidence freshness JSON','evidenceFreshness','staleBlockers','staleWarnings','evidence-freshness-ready','evidence-freshness'].forEach((marker) => {
    if (!libraryVirtualReportsCombinedSource.includes(marker)) throw new Error(`Missing v105 evidence freshness marker: ${marker}`);
  });
  ['section-evidence-freshness','panel-evidence-freshness','button-evidence-freshness-json'].forEach((marker) => {
    if (!domSmokeMarkerCombinedSource.includes(marker)) throw new Error(`Missing v105 evidence freshness DOM smoke marker id: ${marker}`);
  });
  requireConstArrayEntries(libraryVirtualReportsCombinedSource, 'LIBRARY_VIRTUAL_DIAGNOSTICS_COPY_PAYLOAD_TARGETS', ['Manual review bundle JSON','Manual review bundle shape JSON','Manual review summary JSON','Manual review blockers JSON','Manual review workflow JSON','Risk register JSON','Limited opt-in readiness JSON','Final opt-in audit JSON','Final audit compact summary JSON','Diagnostic lightweight test JSON','Diagnostics self-test expansion JSON','Evidence freshness JSON','DOM smoke marker JSON','Row height JSON','Action audit JSON','현재 window rows JSON'], 'diagnostics copy payload targets');
  ['button-final-audit-compact-summary-json','button-final-audit-filter-all','button-final-audit-filter-blockers','button-final-audit-filter-warnings'].forEach((marker) => {
    if (!domSmokeMarkerCombinedSource.includes(marker)) throw new Error(`Missing v102 DOM smoke marker id: ${marker}`);
  });
  ['LIBRARY_VIRTUAL_MANUAL_REVIEW_WORKFLOW_SCHEMA_VERSION','LIBRARY_VIRTUAL_MANUAL_REVIEW_WORKFLOW_STEPS','buildLibraryVirtualManualReviewWorkflowPayload','createLibraryVirtualManualReviewWorkflowPanel','Manual review workflow','Manual review workflow JSON','recovery-manual-review-workflow-panel','button-manual-review-workflow-json','workflowIsDiagnosticOnly','nextDiagnostics'].forEach((marker) => {
    if (!libraryVirtualReportsCombinedSource.includes(marker)) throw new Error(`Missing v106 manual review workflow marker: ${marker}`);
  });
  ['LIBRARY_VIRTUAL_RISK_REGISTER_SCHEMA_VERSION','LIBRARY_VIRTUAL_RISK_REGISTER_CATEGORIES','LIBRARY_VIRTUAL_RISK_REGISTER_REQUIRED_FIELDS','buildLibraryVirtualRiskRegisterPayload','createLibraryVirtualRiskRegisterPanel','buildLibraryVirtualRiskRegisterCategoryGroups','Pre-opt-in risk register','Risk register JSON','recovery-risk-register-panel','button-risk-register-json','riskRegisterIsDiagnosticOnly','riskRegister'].forEach((marker) => {
    if (!libraryVirtualReportsCombinedSource.includes(marker)) throw new Error(`Missing v107 pre-opt-in risk register marker: ${marker}`);
  });
  ['section-risk-register','panel-risk-register','button-risk-register-json'].forEach((marker) => {
    if (!domSmokeMarkerCombinedSource.includes(marker)) throw new Error(`Missing v107 risk register DOM smoke marker id: ${marker}`);
  });
  ['LIBRARY_VIRTUAL_MANUAL_EXPERIMENT_PLAN_SCHEMA_VERSION','LIBRARY_VIRTUAL_MANUAL_EXPERIMENT_PLAN_REQUIRED_FIELDS','LIBRARY_VIRTUAL_MANUAL_EXPERIMENT_PLAN_SECTION_IDS','buildLibraryVirtualManualExperimentPlanPayload','createLibraryVirtualManualExperimentPlanPanel','Manual experiment plan','Manual experiment plan JSON','recovery-manual-experiment-plan-panel','button-manual-experiment-plan-json','manualExperimentPlanIsReadOnly','manualExperimentPlanIsDiagnosticOnly','manualExperimentPlan'].forEach((marker) => {
    if (!libraryVirtualReportsCombinedSource.includes(marker)) throw new Error(`Missing v108 manual experiment plan marker: ${marker}`);
  });
  ['section-manual-experiment-plan','panel-manual-experiment-plan','button-manual-experiment-plan-json'].forEach((marker) => {
    if (!domSmokeMarkerCombinedSource.includes(marker)) throw new Error(`Missing v108 manual experiment plan DOM smoke marker id: ${marker}`);
  });
  requireConstArrayEntries(libraryVirtualReportsCombinedSource, 'LIBRARY_VIRTUAL_MANUAL_EXPERIMENT_PLAN_SECTION_IDS', ['pre-checks','observation-plan','failure-criteria','rollback-plan','archive-criteria','archive-plan'], 'manual experiment plan sections');
  requireConstArrayEntries(libraryVirtualReportsCombinedSource, 'LIBRARY_VIRTUAL_MANUAL_EXPERIMENT_ARCHIVE_CRITERIA_IDS', ['must-include-policy-guard','must-include-failure-evidence','must-include-rollback-verification','must-include-freshness-timestamp','must-state-no-enable-decision'], 'manual experiment archive criteria ids');
  ['buildLibraryVirtualFinalAuditReviewInstructions','buildLibraryVirtualFinalOptInAuditFirstNextActions','firstNextActionsByCategory','reviewInstructions','humanReviewNotes','fullEvidenceRef'].forEach((marker) => {
    if (!libraryVirtualReportsCombinedSource.includes(marker)) throw new Error(`Missing v103 final audit reviewer cleanup marker: ${marker}`);
  });
}

module.exports = {
  FRONTEND_CHECK_LIBRARY_VIRTUAL_REPORT_HISTORY_GUARDS_PASS,
  runLibraryVirtualReportHistoryGuardChecks
};
