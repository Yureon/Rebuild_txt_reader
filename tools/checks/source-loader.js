const fs = require('fs');
const path = require('path');
const { readSourceManifest, readFullSourceGroupManifest, combineSourceManifest, FRONTEND_CHECK_SOURCE_LOADER_MANIFEST_PASS } = require('./source-loader-manifest.js');

const FRONTEND_CHECK_SOURCE_LOADER_PASS = 'v184-frontend-check-source-loader-pass';
const FRONTEND_CHECK_SOURCE_LOADER_GROUPING_PASS = 'v227-source-loader-library-load-state-pass';

function read(full) {
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function loadFrontendCheckSources({ toolsDir, frontendCheckFile }) {
  if (!toolsDir) throw new Error('loadFrontendCheckSources requires toolsDir');
  if (!frontendCheckFile) throw new Error('loadFrontendCheckSources requires frontendCheckFile');

  const projectRoot = path.join(toolsDir, '..');
  const publicRoot = path.join(projectRoot, 'public');
  const root = path.join(publicRoot, 'scripts', 'rebuild');
  const docsRoot = path.join(projectRoot, 'docs');
  const checksRoot = path.join(toolsDir, 'checks');
  const readRebuildModule = (...parts) => read(path.join(root, ...parts));
  const readCheckModule = (...parts) => read(path.join(checksRoot, ...parts));
  function readSourceMap(baseDir, entries) {
    return Object.fromEntries(Object.entries(entries).map(([key, rel]) => [key, read(path.join(baseDir, ...rel))]));
  }
  function readRebuildSourceGroup(entries) {
    return readSourceMap(root, entries);
  }
  const manifestDrivenSourceGroups = readSourceManifest(root, {
    recoverySyncDevtoolsBridgesSource: ['features', 'recovery', 'sync-devtools-bridges.mjs'],
    recoveryLibraryDiagnosticsCallbacksSource: ['features', 'recovery', 'library-diagnostics-callbacks.mjs'],
    recoveryReadinessPassivePayloadsSource: ['features', 'recovery', 'library-virtual-readiness-passive-payloads.mjs'],
    recoveryCacheManagementPanelActionsSource: ['features', 'recovery', 'cache-management-panel-actions.mjs'],
    recoverySearchDiagnosticsCopyPayloadSource: ['features', 'recovery', 'search-diagnostics-copy-payload.mjs'],
    recoverySearchCoverageModalActionsSource: ['features', 'recovery', 'search-coverage-modal-actions.mjs'],
    readerRequestGuardsSource: ['features', 'reader', 'request-guards.mjs'],
    readerNavigationIntentSource: ['features', 'reader', 'navigation-intent.mjs'],
    readerManualDiagnosticsSnapshotSource: ['features', 'reader', 'manual-diagnostics-snapshot.mjs'],
    recoveryLibraryDiagnosticsVirtualPanelsSource: ['features', 'recovery', 'library-diagnostics-virtual-panels.mjs'],
    recoveryLibraryDiagnosticsVirtualReviewPanelsSource: ['features', 'recovery', 'library-diagnostics-virtual-review-panels.mjs'],
    recoveryLibraryVirtualReportsSurfaceSource: ['features', 'recovery', 'library-virtual-reports.mjs'],
    searchSessionRuntimeSource: ['features', 'search', 'session-runtime.mjs'],
    readerOpenStateSource: ['features', 'reader', 'open-state.mjs']
  });
  const fullSourceGroupManifest = readFullSourceGroupManifest(projectRoot);
  const manifestDrivenMaintenanceSource = combineSourceManifest({ ...fullSourceGroupManifest, ...manifestDrivenSourceGroups }, Object.keys(manifestDrivenSourceGroups));
  const fullManifestDrivenSource = combineSourceManifest(fullSourceGroupManifest);

  const frontendCheckSource = read(frontendCheckFile);
  const frontendCheckModuleManifestSource = read(path.join(checksRoot, 'module-manifest.js'));
  const frontendCheckUiLayeringSource = read(path.join(checksRoot, 'ui-layering.js'));
  const frontendCheckVersionMarkersSource = read(path.join(checksRoot, 'version-markers.js'));
  const frontendCheckRecoveryCenterGuardsSource = read(path.join(checksRoot, 'recovery-center-guards.js'));
  const frontendCheckSourceLoaderSource = read(path.join(checksRoot, 'source-loader.js'));
  const frontendCheckUtilsSource = read(path.join(checksRoot, 'check-utils.js'));
  const frontendCheckAppShellSource = read(path.join(checksRoot, 'app-shell-guards.js'));
  const frontendCheckLibraryVirtualSource = read(path.join(checksRoot, 'library-virtual-guards.js'));
  const frontendCheckLibraryVirtualSplitSource = read(path.join(checksRoot, 'library-virtual-split-guards.js'));
  const frontendCheckLibraryVirtualReportHistorySource = read(path.join(checksRoot, 'library-virtual-report-history-guards.js'));
  const frontendCheckSettingsShellQualitySource = read(path.join(checksRoot, 'settings-shell-quality-guards.js'));
  const frontendCheckSettingsModalSafeareaSource = read(path.join(checksRoot, 'settings-modal-safearea-guards.js'));
  const frontendCheckDevdebugNavigationSource = read(path.join(checksRoot, 'devdebug-navigation-guards.js'));
  const frontendCheckReaderOverlayQualitySource = read(path.join(checksRoot, 'reader-overlay-quality-guards.js'));
  const frontendCheckLibraryVirtualRuntimeBridgeSource = read(path.join(checksRoot, 'library-virtual-runtime-bridge-guards.js'));
  const frontendCheckLibraryVirtualPolicyRolloutSource = read(path.join(checksRoot, 'library-virtual-policy-rollout-guards.js'));
  const frontendCheckReaderSearchSource = read(path.join(checksRoot, 'reader-search-guards.js'));
  const frontendCheckReaderCacheLayoutSource = read(path.join(checksRoot, 'reader-cache-layout-guards.js'));
  
  const frontendCheckReaderRuntimeSource = read(path.join(checksRoot, 'reader-runtime-guards.js'));
  const frontendCheckSearchRuntimeSource = read(path.join(checksRoot, 'search-runtime-guards.js'));
  const frontendCheckRecoverySearchCacheSource = read(path.join(checksRoot, 'recovery-search-cache-guards.js'));
  const frontendCheckThemeDevtoolsSource = read(path.join(checksRoot, 'theme-devtools-guards.js'));
  const frontendCheckSyncRefactorSource = read(path.join(checksRoot, 'sync-refactor-guards.js'));
  const frontendCheckSplitGuardsSource = read(path.join(checksRoot, 'frontend-check-split-guards.js'));
  const frontendCheckSplitCoreHistorySource = read(path.join(checksRoot, 'frontend-check-split-core-history-guards.js'));
  const frontendCheckSplitDomainHistorySource = read(path.join(checksRoot, 'frontend-check-split-domain-history-guards.js'));
  const frontendCheckReadDataImportGuardsSource = read(path.join(checksRoot, 'read-data-import-guards.js'));
  const frontendCheckReadDataImportBoundaryGuardsSource = read(path.join(checksRoot, 'read-data-import-boundary-guards.js'));
  const frontendCheckReadDataPreviewGuardsSource = read(path.join(checksRoot, 'read-data-preview-guards.js'));
  const frontendCheckSafeAreaControlsSplitGuardsSource = read(path.join(checksRoot, 'safe-area-controls-split-guards.js'));
  const frontendCheckReadDataGuardUtilsSource = read(path.join(checksRoot, 'read-data-guard-utils.js'));
  const frontendCheckLatestDocIndexGuardSource = read(path.join(checksRoot, 'latest-doc-index-guard.js'));
  const frontendCheckModuleImportSmokeSource = read(path.join(checksRoot, 'frontend-module-import-smoke.js'));
  const frontendCheckLibraryLoadStateGuardSource = read(path.join(checksRoot, 'library-load-state-guards.js'));

  const shellSource = read(path.join(publicRoot, 'fragments', 'app-shell.html'));
  const appCssSource = read(path.join(publicRoot, 'styles', 'app.css'));
  const ownerCssSource = read(path.join(publicRoot, 'styles', 'owner.css'));
  const siteHtmlSource = read(path.join(publicRoot, 'site.html'));
  const mobileHtmlSource = read(path.join(publicRoot, 'mobile.html'));

  const librarySource = read(path.join(root, 'features', 'library.mjs'));
  const libraryModelSource = read(path.join(root, 'features', 'library-model.mjs'));
  const libraryLoadStateSource = read(path.join(root, 'features', 'library-load-state.mjs'));
  const libraryVirtualFallbackPolicySource = read(path.join(root, 'features', 'library-virtual-fallback-policy.mjs'));
  const libraryVirtualTrialDiagnosticsSource = read(path.join(root, 'features', 'library-virtual-trial-diagnostics.mjs'));
  const libraryRowDiagnosticsSource = read(path.join(root, 'features', 'library-row-diagnostics.mjs'));
  const libraryVirtualRowInspectionSource = read(path.join(root, 'features', 'library-virtual-row-inspection.mjs'));
  const libraryActionAuditSummarySource = read(path.join(root, 'features', 'library-action-audit-summary.mjs'));
  const libraryActionAuditDiagnosticsSource = read(path.join(root, 'features', 'library-action-audit-diagnostics.mjs'));
  const libraryVirtualGateDiagnosticsSource = read(path.join(root, 'features', 'library-virtual-gate-diagnostics.mjs'));
  const libraryPrototypeDiagnosticsSource = read(path.join(root, 'features', 'library-prototype-diagnostics.mjs'));
  const libraryVirtualSessionDiagnosticsSource = read(path.join(root, 'features', 'library-virtual-session-diagnostics.mjs'));
  const libraryVirtualHistoryRecordSource = read(path.join(root, 'features', 'library-virtual-history-record.mjs'));
  const libraryVirtualRenderCacheSource = read(path.join(root, 'features', 'library-virtual-render-cache.mjs'));
  const libraryVirtualRenderReportingSource = read(path.join(root, 'features', 'library-virtual-render-reporting.mjs'));
  const libraryVirtualGateAuditSource = read(path.join(root, 'features', 'library-virtual-gate-audit.mjs'));
  const libraryVirtualGateDetailSource = read(path.join(root, 'features', 'library-virtual-gate-detail.mjs'));
  const libraryVirtualSessionPayloadSource = read(path.join(root, 'features', 'library-virtual-session-payload.mjs'));
  const libraryVirtualSessionFallbackSource = read(path.join(root, 'features', 'library-virtual-session-fallback.mjs'));
  const libraryVirtualPrototypeWindowDiagnosticsSource = read(path.join(root, 'features', 'library-virtual-prototype-window-diagnostics.mjs'));
  const readerSource = read(path.join(root, 'features', 'reader.mjs'));
  const prefetchQueueSource = read(path.join(root, 'features', 'reader', 'prefetch-queue.mjs'));
  const readerPrefetchSnapshotSource = readRebuildModule('features', 'reader', 'prefetch-snapshot.mjs');
  const readerPrefetchScheduleSource = readRebuildModule('features', 'reader', 'prefetch-schedule.mjs');
  const offlineStatusSource = read(path.join(root, 'features', 'reader', 'offline-status.mjs'));
  const readerOfflineStatusFormattersSource = readRebuildModule('features', 'reader', 'offline-status-formatters.mjs');
  const readerChunkWindowSource = read(path.join(root, 'features', 'reader', 'chunk-window.mjs'));
  const readerLoadChunkSideEffectsSource = readRebuildModule('features', 'reader', 'load-chunk-side-effects.mjs');
  const readerChunkWindowDiagnosticsSource = readRebuildModule('features', 'reader', 'chunk-window-diagnostics.mjs');
  const readerChunkWindowPruneSource = readRebuildModule('features', 'reader', 'chunk-window-prune.mjs');
  const readerConstantsSource = read(path.join(root, 'features', 'reader', 'constants.mjs'));
  const readerCacheStoreSource = read(path.join(root, 'features', 'reader', 'cache-store.mjs'));
  const readerCacheDiagnosticsSource = read(path.join(root, 'features', 'reader', 'cache-diagnostics.mjs'));
  const readerCacheDiagnosticsUnavailableSource = read(path.join(root, 'features', 'reader', 'cache-diagnostics-unavailable.mjs'));
  const readerCacheRecordFormattersSource = read(path.join(root, 'features', 'reader', 'cache-record-formatters.mjs'));
  const readerCacheNovelStatsSource = read(path.join(root, 'features', 'reader', 'cache-novel-stats.mjs'));
  const readerCachePrunePlanSource = read(path.join(root, 'features', 'reader', 'cache-prune-plan.mjs'));
  const readerCachePruneDiagnosticsSource = readRebuildModule('features', 'reader', 'cache-prune-diagnostics.mjs');
  const readerCacheDeleteFormattersSource = readRebuildModule('features', 'reader', 'cache-delete-formatters.mjs');
  const readerVirtualLayoutSource = read(path.join(root, 'features', 'reader', 'virtual-layout.mjs'));
  const readerVirtualLayoutDiagnosticsSource = readRebuildModule('features', 'reader', 'virtual-layout-diagnostics.mjs');
  const readerVirtualLayoutReportLabelsSource = readRebuildModule('features', 'reader', 'virtual-layout-report-labels.mjs');
  const readerVirtualRowSignatureSource = readRebuildModule('features', 'reader', 'virtual-row-signature.mjs');
  const searchSource = read(path.join(root, 'features', 'search.mjs'));
  const searchMatcherSource = read(path.join(root, 'features', 'search', 'matcher.mjs'));
  const searchResultsViewSource = read(path.join(root, 'features', 'search', 'results-view.mjs'));
  const searchStatusPanelSource = read(path.join(root, 'features', 'search', 'status-panel.mjs'));
  const searchStatusFormattersSource = read(path.join(root, 'features', 'search', 'status-formatters.mjs'));
  const searchCoverageSummarySource = read(path.join(root, 'features', 'search', 'coverage-summary.mjs'));
  const searchRemoconUiSource = read(path.join(root, 'features', 'search', 'remocon-ui.mjs'));
  const searchStatusDetailRowsSource = read(path.join(root, 'features', 'search', 'status-detail-rows.mjs'));
  const searchFilterControlsSource = read(path.join(root, 'features', 'search', 'filter-controls.mjs'));
  const searchJumpStatusSource = read(path.join(root, 'features', 'search', 'jump-status.mjs'));
  const searchRetryDispatcherSource = read(path.join(root, 'features', 'search', 'retry-dispatcher.mjs'));
  const searchAnnouncementFormattersSource = read(path.join(root, 'features', 'search', 'announcement-formatters.mjs'));
  const searchNavigationUiSource = read(path.join(root, 'features', 'search', 'navigation-ui.mjs'));
  const searchSessionResetSource = read(path.join(root, 'features', 'search', 'session-reset.mjs'));
  const searchJumpInfoSource = read(path.join(root, 'features', 'search', 'jump-info.mjs'));
  const searchResultLabelsSource = read(path.join(root, 'features', 'search', 'result-labels.mjs'));
  const searchFilterSummarySource = read(path.join(root, 'features', 'search', 'filter-summary.mjs'));
  const recoveryLibraryVirtualReadinessPanelUtilsSource = read(path.join(root, 'features', 'recovery', 'library-virtual-readiness-panel-utils.mjs'));
  const searchResultsSource = searchResultsViewSource;

  const devtoolsSource = read(path.join(root, 'features', 'sync-devtools.mjs'));
  const devtoolsReportSource = read(path.join(root, 'features', 'devtools', 'report.mjs'));
  const devtoolsReportFormattersSource = read(path.join(root, 'features', 'devtools', 'report-formatters.mjs'));
  const devtoolsControlsSource = read(path.join(root, 'features', 'devtools', 'controls.mjs'));
  const appearanceSource = read(path.join(root, 'features', 'settings', 'appearance.mjs'));
  const themeEditorSource = read(path.join(root, 'features', 'settings', 'theme-editor.mjs'));
  const settingsThemeColorUtilsSource = readRebuildModule('features', 'settings', 'theme-color-utils.mjs');
  const settingsThemeFileUtilsSource = readRebuildModule('features', 'settings', 'theme-file-utils.mjs');
  const themePresetsSource = read(path.join(root, 'features', 'settings', 'theme-presets.mjs'));
  const customCssSource = read(path.join(root, 'features', 'settings', 'custom-css.mjs'));
  const settingsCustomCssUtilsSource = readRebuildModule('features', 'settings', 'custom-css-utils.mjs');
  const preprocessSource = read(path.join(root, 'features', 'settings', 'preprocess.mjs'));
  const preprocessSummarySource = read(path.join(root, 'features', 'settings', 'preprocess-summary.mjs'));
  const settingsFunctionalLabelsSource = readRebuildModule('features', 'settings', 'functional-labels.mjs');
  const settingsSafeAreaLabelsSource = readRebuildModule('features', 'settings', 'safe-area-labels.mjs');
  const settingsControlsSource = read(path.join(root, 'features', 'settings', 'controls.mjs'));
  const settingsControlDomUtilsSource = read(path.join(root, 'features', 'settings', 'control-dom-utils.mjs'));
  const settingsClockFormatSource = read(path.join(root, 'features', 'settings', 'clock-format.mjs'));
  const settingsSafeAreaControlsSource = read(path.join(root, 'features', 'settings', 'safe-area-controls.mjs'));
  const settingsSafeAreaConstantsSource = read(path.join(root, 'features', 'settings', 'safe-area-constants.mjs'));
  const settingsSafeAreaProfilesSource = read(path.join(root, 'features', 'settings', 'safe-area-profiles.mjs'));
  const settingsSafeAreaProfileActionsSource = read(path.join(root, 'features', 'settings', 'safe-area-profile-actions.mjs'));
  const settingsSafeAreaTemplateFactorySource = read(path.join(root, 'features', 'settings', 'safe-area-template-factory.mjs'));
  const settingsSafeAreaTemplateLabelsSource = readRebuildModule('features', 'settings', 'safe-area-template-labels.mjs');
  const settingsSafeAreaProfileLabelsSource = readRebuildModule('features', 'settings', 'safe-area-profile-labels.mjs');
  const settingsSafeAreaProfilePromptSource = readRebuildModule('features', 'settings', 'safe-area-profile-prompt.mjs');
  const settingsSafeAreaContextLabelsSource = readRebuildModule('features', 'settings', 'safe-area-context-labels.mjs');
  const settingsSafeAreaContextSource = read(path.join(root, 'features', 'settings', 'safe-area-context.mjs'));
  const settingsSafeAreaDebugSource = read(path.join(root, 'features', 'settings', 'safe-area-debug.mjs'));
  const settingsSafeAreaDebugFormattersSource = readRebuildModule('features', 'settings', 'safe-area-debug-formatters.mjs');
  const settingsSafeAreaSlotLayoutSource = read(path.join(root, 'features', 'settings', 'safe-area-slot-layout.mjs'));
  const settingsLibraryVirtualStatusSource = read(path.join(root, 'features', 'settings', 'library-virtual-status.mjs'));
  const settingsFontsSource = read(path.join(root, 'features', 'settings', 'fonts.mjs'));
  const settingsFontChoiceCardSource = read(path.join(root, 'features', 'settings', 'font-choice-card.mjs'));
  const safeAreaControlsCombinedSource = settingsSafeAreaControlsSource + '\n' + settingsSafeAreaConstantsSource + '\n' + settingsSafeAreaProfilesSource + '\n' + settingsSafeAreaProfileActionsSource + '\n' + settingsSafeAreaProfileLabelsSource + '\n' + settingsSafeAreaProfilePromptSource + '\n' + settingsSafeAreaContextLabelsSource + '\n' + settingsSafeAreaTemplateFactorySource + '\n' + settingsSafeAreaContextSource + '\n' + settingsSafeAreaDebugSource + '\n' + settingsSafeAreaDebugFormattersSource + '\n' + settingsSafeAreaSlotLayoutSource;
  const controlsSource = settingsControlsSource + '\n' + settingsControlDomUtilsSource + '\n' + settingsClockFormatSource + '\n' + safeAreaControlsCombinedSource + '\n' + settingsLibraryVirtualStatusSource;
  const uiSource = read(path.join(root, 'features', 'ui.mjs'));
  const elementsSource = read(path.join(root, 'features', 'ui', 'elements.mjs'));
  const readDataModalSource = read(path.join(root, 'features', 'bookmarks', 'read-data-modal.mjs'));
  const readDataModelSource = read(path.join(root, 'features', 'bookmarks', 'read-data-model.mjs'));
  const readDataImportSource = read(path.join(root, 'features', 'bookmarks', 'read-data-import.mjs'));
  const readDataImportConstantsSource = read(path.join(root, 'features', 'bookmarks', 'read-data-import-constants.mjs'));
  const readDataImportMergeSource = read(path.join(root, 'features', 'bookmarks', 'read-data-import-merge.mjs'));
  const readDataImportProgressMergeSource = read(path.join(root, 'features', 'bookmarks', 'read-data-import-progress-merge.mjs'));
  const readDataImportArrayMergeSource = read(path.join(root, 'features', 'bookmarks', 'read-data-import-array-merge.mjs'));
  const readDataImportDetailBuildersSource = read(path.join(root, 'features', 'bookmarks', 'read-data-import-detail-builders.mjs'));
  const readDataImportDiffExportSource = read(path.join(root, 'features', 'bookmarks', 'read-data-import-diff-export.mjs'));
  const readDataPreviewSource = read(path.join(root, 'features', 'bookmarks', 'read-data-preview.mjs'));
  const readDataPreviewFilterSource = read(path.join(root, 'features', 'bookmarks', 'read-data-preview-filter.mjs'));
  const readDataPreviewEntriesSource = read(path.join(root, 'features', 'bookmarks', 'read-data-preview-entries.mjs'));
  const readDataPreviewBulkToolbarSource = read(path.join(root, 'features', 'bookmarks', 'read-data-preview-bulk-toolbar.mjs'));
  const readDataPreviewResultsSource = read(path.join(root, 'features', 'bookmarks', 'read-data-preview-results.mjs'));
  const readDataPreviewDetailModalSource = read(path.join(root, 'features', 'bookmarks', 'read-data-preview-detail-modal.mjs'));
  const readDataRollbackSource = read(path.join(root, 'features', 'bookmarks', 'read-data-rollback.mjs'));
  const readDataImportCombinedSource = readDataImportSource + '\n' + readDataImportConstantsSource + '\n' + readDataImportMergeSource + '\n' + readDataImportProgressMergeSource + '\n' + readDataImportArrayMergeSource + '\n' + readDataImportDetailBuildersSource + '\n' + readDataImportDiffExportSource + '\n' + readDataPreviewSource + '\n' + readDataPreviewFilterSource + '\n' + readDataPreviewEntriesSource + '\n' + readDataPreviewBulkToolbarSource + '\n' + readDataPreviewResultsSource + '\n' + readDataPreviewDetailModalSource + '\n' + readDataRollbackSource;

  const recoverySearchDiagnosticsSource = read(path.join(root, 'features', 'recovery', 'search-diagnostics.mjs'));
  const recoveryCacheDiagnosticsSource = read(path.join(root, 'features', 'recovery', 'cache-diagnostics.mjs'));
  const recoveryLibraryDiagnosticsSource = read(path.join(root, 'features', 'recovery', 'library-diagnostics.mjs'));
  const recoveryManualReviewBundleSource = read(path.join(root, 'features', 'recovery', 'manual-review-bundle.mjs'));
  const recoveryManualReviewBundleConstantsSource = read(path.join(root, 'features', 'recovery', 'manual-review-bundle-constants.mjs'));
  const recoveryManualReviewReviewerSummarySectionsSource = read(path.join(root, 'features', 'recovery', 'manual-review-reviewer-summary-sections.mjs'));
  const recoveryExportUtilsSource = read(path.join(root, 'features', 'recovery', 'export-utils.mjs'));
  const recoveryButtonWiringSource = read(path.join(root, 'features', 'recovery', 'button-wiring.mjs'));
  const recoveryButtonWiringSafetyManifestSource = readRebuildModule('features', 'recovery', 'button-wiring-safety-manifest.mjs');
  const recoveryButtonWiringSafetyRendererSource = readRebuildModule('features', 'recovery', 'button-wiring-safety-renderer.mjs');
  const recoveryRuntimeSource = read(path.join(root, 'features', 'recovery', 'runtime.mjs'));
  const recoveryOrchestrationSource = readRebuildModule('features', 'recovery', 'orchestration.mjs');
  const recoverySummaryPanelSource = read(path.join(root, 'features', 'recovery', 'summary-panel.mjs'));
  const recoveryPolicyChecklistPanelSource = read(path.join(root, 'features', 'recovery', 'policy-checklist-panel.mjs'));
  const recoveryImportScopePanelSource = read(path.join(root, 'features', 'recovery', 'import-scope-panel.mjs'));
  const recoveryImportActionsSource = read(path.join(root, 'features', 'recovery', 'import-actions.mjs'));
  const recoveryImportWritebackSource = read(path.join(root, 'features', 'recovery', 'import-writeback.mjs'));
  const recoveryNavigationSource = read(path.join(root, 'features', 'recovery', 'navigation.mjs'));
  const recoveryActionUiSource = read(path.join(root, 'features', 'recovery', 'action-ui.mjs'));
  const recoveryDomSmokePanelSource = read(path.join(root, 'features', 'recovery', 'dom-smoke-panel.mjs'));
  const recoveryDomSmokeMarkersSource = read(path.join(root, 'features', 'recovery', 'dom-smoke-markers.mjs'));
  const recoveryDomSmokePanelRendererSource = read(path.join(root, 'features', 'recovery', 'dom-smoke-panel-renderer.mjs'));
  const recoveryDiagnosticsPanelSource = read(path.join(root, 'features', 'recovery', 'diagnostics-panel.mjs'));
  const recoveryLibraryFormattersSource = read(path.join(root, 'features', 'recovery', 'library-formatters.mjs'));
  const recoveryLibraryVirtualReportsSource = read(path.join(root, 'features', 'recovery', 'library-virtual-reports.mjs'));
  const recoveryLibraryVirtualReportConstantsSource = read(path.join(root, 'features', 'recovery', 'library-virtual-report-constants.mjs'));
  const recoveryLibraryVirtualReportUtilsSource = read(path.join(root, 'features', 'recovery', 'library-virtual-report-utils.mjs'));
  const recoveryLibraryVirtualBasicPanelsSource = read(path.join(root, 'features', 'recovery', 'library-virtual-basic-panels.mjs'));
  const recoveryLibraryVirtualChecklistHistorySource = read(path.join(root, 'features', 'recovery', 'library-virtual-checklist-history.mjs'));
  const recoveryLibraryVirtualReadinessReportsSource = read(path.join(root, 'features', 'recovery', 'library-virtual-readiness-reports.mjs'));
  const recoveryLibraryVirtualStaticPolicyGuardSource = readRebuildModule('features', 'recovery', 'library-virtual-static-policy-guard.mjs');
  const recoveryLibraryVirtualManualReviewWorkflowSource = readRebuildModule('features', 'recovery', 'library-virtual-manual-review-workflow.mjs');
  const recoveryLibraryVirtualReadinessPassiveReportsSource = read(path.join(root, 'features', 'recovery', 'library-virtual-readiness-passive-reports.mjs'));
  const recoveryLibraryVirtualReadinessFinalPanelUtilsSource = readRebuildModule('features', 'recovery', 'library-virtual-readiness-final-panel-utils.mjs');
  const recoveryLibraryVirtualReadinessSectionFactoriesSource = readRebuildModule('features', 'recovery', 'library-virtual-readiness-section-factories.mjs');
  const recoveryLibraryVirtualManualExperimentPanelRenderersSource = readRebuildModule('features', 'recovery', 'library-virtual-manual-experiment-panel-renderers.mjs');
  const recoveryLibraryVirtualStabilizationPanelRenderersSource = readRebuildModule('features', 'recovery', 'library-virtual-stabilization-panel-renderers.mjs');
  const recoveryLibraryVirtualPracticalRegressionPanelRenderersSource = readRebuildModule('features', 'recovery', 'library-virtual-practical-regression-panel-renderers.mjs');
  const recoveryLibraryVirtualDecisionMemoPanelRenderersSource = readRebuildModule('features', 'recovery', 'library-virtual-decision-memo-panel-renderers.mjs');
  const recoveryLibraryVirtualFinalSummaryUtilsSource = readRebuildModule('features', 'recovery', 'library-virtual-final-summary-utils.mjs');
  const recoveryLibraryVirtualFinalSummaryPayloadSource = readRebuildModule('features', 'recovery', 'library-virtual-final-summary-payload.mjs');
  const recoveryLibraryVirtualDecisionMemoPayloadSource = readRebuildModule('features', 'recovery', 'library-virtual-decision-memo-payload.mjs');
  const recoveryLibraryVirtualPracticalRegressionPayloadSource = readRebuildModule('features', 'recovery', 'library-virtual-practical-regression-payload.mjs');
  const recoveryLibraryVirtualManualExperimentPayloadSource = readRebuildModule('features', 'recovery', 'library-virtual-manual-experiment-payload.mjs');
  const recoveryLibraryVirtualPostStabilizationSmokePayloadSource = readRebuildModule('features', 'recovery', 'library-virtual-post-stabilization-smoke-payload.mjs');
  const recoveryLibraryVirtualPostStabilizationReviewPayloadSource = readRebuildModule('features', 'recovery', 'library-virtual-post-stabilization-review-payload.mjs');
  const recoveryLibraryVirtualRiskRegisterReportSource = read(path.join(root, 'features', 'recovery', 'library-virtual-risk-register-report.mjs'));
  const recoveryLibraryVirtualFinalAuditUtilsSource = read(path.join(root, 'features', 'recovery', 'library-virtual-final-audit-utils.mjs'));
  const recoveryLibraryVirtualEvidenceDiagnosticsSource = read(path.join(root, 'features', 'recovery', 'library-virtual-evidence-diagnostics.mjs'));
  const recoveryLibraryVirtualEvidenceUtilsSource = readRebuildModule('features', 'recovery', 'library-virtual-evidence-utils.mjs');
  const recoveryLibraryVirtualEvidencePanelRenderersSource = readRebuildModule('features', 'recovery', 'library-virtual-evidence-panel-renderers.mjs');
  const recoveryLibraryVirtualEvidenceFreshnessSource = read(path.join(root, 'features', 'recovery', 'library-virtual-evidence-freshness.mjs'));
  const recoveryLibraryVirtualOptinAuditSource = read(path.join(root, 'features', 'recovery', 'library-virtual-optin-audit.mjs'));
  const recoveryLibraryVirtualOptinPanelRenderersSource = readRebuildModule('features', 'recovery', 'library-virtual-optin-panel-renderers.mjs');
  const recoveryLibraryVirtualDiagnosticPayloadsSource = read(path.join(root, 'features', 'recovery', 'library-virtual-diagnostic-payloads.mjs'));
  const recoveryLibraryVirtualManualReviewChecklistSource = read(path.join(root, 'features', 'recovery', 'library-virtual-manual-review-checklist.mjs'));
  const recoveryLibraryVirtualManualReviewBundlePanelsSource = read(path.join(root, 'features', 'recovery', 'library-virtual-manual-review-bundle-panels.mjs'));
  const recoveryLibraryVirtualSessionPanelsSource = read(path.join(root, 'features', 'recovery', 'library-virtual-session-panels.mjs'));
  const recoveryLibraryVirtualReadinessPolicyPanelSource = read(path.join(root, 'features', 'recovery', 'library-virtual-readiness-policy-panel.mjs'));
  const recoveryCacheManagementPanelSource = read(path.join(root, 'features', 'recovery', 'cache-management-panel.mjs'));
  const recoverySearchPanelSource = read(path.join(root, 'features', 'recovery', 'search-panel.mjs'));
  const recoverySearchCoverageModalRenderersSource = readRebuildModule('features', 'recovery', 'search-coverage-modal-renderers.mjs');
  const recoveryLibraryDiagnosticsPanelSource = read(path.join(root, 'features', 'recovery', 'library-diagnostics-panel.mjs'));
  const recoveryLibraryDiagnosticsPanelRenderersSource = read(path.join(root, 'features', 'recovery', 'library-diagnostics-panel-renderers.mjs'));
  const recoveryLibraryDiagnosticsPanelCompositionSource = readRebuildModule('features', 'recovery', 'library-diagnostics-panel-composition.mjs');
  const recoveryLibraryDiagnosticsSamplesSource = read(path.join(root, 'features', 'recovery', 'library-diagnostics-samples.mjs'));
  const recoveryLibraryDiagnosticsCopyActionsSource = read(path.join(root, 'features', 'recovery', 'library-diagnostics-copy-actions.mjs'));
  const recoveryLibraryDiagnosticsCopyGroupsSource = read(path.join(root, 'features', 'recovery', 'library-diagnostics-copy-groups.mjs'));
  const recoveryLibraryDiagnosticsStatusRowsSource = read(path.join(root, 'features', 'recovery', 'library-diagnostics-status-rows.mjs'));
  const recoveryLibraryDiagnosticsPanelShellSource = read(path.join(root, 'features', 'recovery', 'library-diagnostics-panel-shell.mjs'));
  const recoveryLibraryDiagnosticsControlButtonsSource = read(path.join(root, 'features', 'recovery', 'library-diagnostics-control-buttons.mjs'));
  const recoveryLibraryDiagnosticsExportPayloadSource = read(path.join(root, 'features', 'recovery', 'library-diagnostics-export-payload.mjs'));
  const recoveryLibraryDiagnosticsSectionAssemblySource = read(path.join(root, 'features', 'recovery', 'library-diagnostics-section-assembly.mjs'));
  const recoveryLibraryDiagnosticsSectionGroupsSource = read(path.join(root, 'features', 'recovery', 'library-diagnostics-section-groups.mjs'));
  const recoveryCacheActionsSource = read(path.join(root, 'features', 'recovery', 'cache-actions.mjs'));
  const recoverySearchActionsSource = read(path.join(root, 'features', 'recovery', 'search-actions.mjs'));
  const recoverySnapshotExportSource = read(path.join(root, 'features', 'recovery', 'snapshot-export.mjs'));
  const recoveryLocalMaintenanceSource = read(path.join(root, 'features', 'recovery', 'local-maintenance-actions.mjs'));
  const recoveryModalLayerSource = read(path.join(root, 'features', 'recovery', 'modal-layer.mjs'));

  const syncFormattersSource = read(path.join(root, 'features', 'sync', 'sync-formatters.mjs'));
  const syncDeviceManagementSource = read(path.join(root, 'features', 'sync', 'device-management.mjs'));
  const remoteResumeSource = read(path.join(root, 'features', 'sync', 'remote-resume.mjs'));
  const periodicDeviceSyncSource = read(path.join(root, 'features', 'sync', 'periodic-device-sync.mjs'));
  const serverStateHydrationSource = read(path.join(root, 'features', 'sync', 'server-state-hydration.mjs'));

  const stateSource = read(path.join(root, 'state', 'app-state.mjs'));
  const utilsSource = read(path.join(root, 'core', 'utils.mjs'));
  const appShellRuntimeSource = read(path.join(root, 'core', 'app-shell.mjs'));

  const libraryVirtualReportsCombinedSource = devtoolsSource + '\n' + recoveryLibraryDiagnosticsPanelRenderersSource + '\n' + recoveryLibraryDiagnosticsPanelCompositionSource + '\n' + recoveryLibraryDiagnosticsSamplesSource + '\n' + recoveryLibraryDiagnosticsCopyActionsSource + '\n' + recoveryLibraryDiagnosticsCopyGroupsSource + '\n' + recoveryLibraryDiagnosticsStatusRowsSource + '\n' + recoveryLibraryDiagnosticsPanelShellSource + '\n' + recoveryLibraryDiagnosticsControlButtonsSource + '\n' + recoveryLibraryDiagnosticsExportPayloadSource + '\n' + recoveryLibraryDiagnosticsSectionAssemblySource + '\n' + recoveryLibraryDiagnosticsSectionGroupsSource + '\n' + recoveryLibraryVirtualReportsSource + '\n' + recoveryLibraryVirtualReportConstantsSource + '\n' + recoveryLibraryVirtualReportUtilsSource + '\n' + recoveryLibraryVirtualBasicPanelsSource + '\n' + recoveryLibraryVirtualChecklistHistorySource + '\n' + recoveryLibraryVirtualReadinessReportsSource + '\n' + recoveryLibraryVirtualStaticPolicyGuardSource + '\n' + recoveryLibraryVirtualManualReviewWorkflowSource + '\n' + recoveryLibraryVirtualReadinessPassiveReportsSource + '\n' + manifestDrivenSourceGroups.recoveryReadinessPassivePayloadsSource + '\n' + recoveryLibraryVirtualReadinessPanelUtilsSource + '\n' + recoveryLibraryVirtualReadinessSectionFactoriesSource + '\n' + recoveryLibraryVirtualFinalSummaryUtilsSource + '\n' + recoveryLibraryVirtualDecisionMemoPayloadSource + '\n' + recoveryLibraryVirtualPracticalRegressionPayloadSource + '\n' + recoveryLibraryVirtualManualExperimentPayloadSource + '\n' + recoveryLibraryVirtualPostStabilizationSmokePayloadSource + '\n' + recoveryLibraryVirtualRiskRegisterReportSource + '\n' + recoveryLibraryVirtualFinalAuditUtilsSource + '\n' + recoveryLibraryVirtualEvidenceDiagnosticsSource + '\n' + recoveryLibraryVirtualEvidenceUtilsSource + '\n' + recoveryLibraryVirtualEvidencePanelRenderersSource + '\n' + recoveryLibraryVirtualEvidenceFreshnessSource + '\n' + recoveryLibraryVirtualOptinAuditSource + '\n' + recoveryLibraryVirtualOptinPanelRenderersSource + '\n' + recoveryLibraryVirtualDiagnosticPayloadsSource + '\n' + readRebuildModule('features', 'recovery', 'library-virtual-fallback-sample-payload.mjs') + '\n' + readRebuildModule('features', 'recovery', 'library-virtual-trial-result-payload.mjs') + '\n' + readRebuildModule('features', 'recovery', 'library-row-height-diagnostics-payload.mjs') + '\n' + recoveryLibraryVirtualManualReviewChecklistSource + '\n' + recoveryLibraryVirtualManualReviewBundlePanelsSource + '\n' + readRebuildModule('features', 'recovery', 'library-virtual-manual-review-bundle-payload.mjs') + '\n' + recoveryLibraryVirtualSessionPanelsSource + '\n' + recoveryLibraryVirtualReadinessPolicyPanelSource + '\n' + recoveryLibraryDiagnosticsPanelSource + '\n' + manifestDrivenSourceGroups.recoveryLibraryDiagnosticsVirtualReviewPanelsSource;
  const domSmokeMarkerCombinedSource = devtoolsSource + '\n' + recoveryDomSmokePanelSource + '\n' + recoveryDomSmokeMarkersSource + '\n' + recoveryDomSmokePanelRendererSource;
  const devtoolsNavigationCombinedSource = devtoolsSource + '\n' + recoveryLibraryDiagnosticsPanelRenderersSource + '\n' + recoveryLibraryDiagnosticsPanelCompositionSource + '\n' + recoveryLibraryDiagnosticsSamplesSource + '\n' + recoveryLibraryDiagnosticsCopyActionsSource + '\n' + recoveryLibraryDiagnosticsCopyGroupsSource + '\n' + recoveryLibraryDiagnosticsStatusRowsSource + '\n' + recoveryLibraryDiagnosticsPanelShellSource + '\n' + recoveryLibraryDiagnosticsControlButtonsSource + '\n' + recoveryLibraryDiagnosticsExportPayloadSource + '\n' + recoveryLibraryDiagnosticsSectionAssemblySource + '\n' + recoveryLibraryDiagnosticsSectionGroupsSource + '\n' + recoveryNavigationSource + '\n' + recoveryActionUiSource + '\n' + recoveryCacheManagementPanelSource + '\n' + recoverySearchPanelSource + '\n' + recoveryLibraryDiagnosticsPanelSource + '\n' + manifestDrivenSourceGroups.recoveryLibraryDiagnosticsVirtualReviewPanelsSource;
  const manualReviewBundleCombinedSource = devtoolsSource + '\n' + recoveryManualReviewBundleSource + '\n' + recoveryManualReviewBundleConstantsSource + '\n' + recoveryManualReviewReviewerSummarySectionsSource;
  const recoverySearchPanelCombinedSource = devtoolsSource + '\n' + recoverySearchDiagnosticsSource + '\n' + recoverySearchPanelSource + '\n' + recoverySearchActionsSource + '\n' + recoverySearchCoverageModalRenderersSource + '\n' + manifestDrivenSourceGroups.searchSessionRuntimeSource;
  const recoveryCacheCombinedSource = devtoolsSource + '\n' + recoveryCacheDiagnosticsSource + '\n' + recoveryCacheManagementPanelSource + '\n' + recoveryCacheActionsSource + '\n' + recoveryDiagnosticsPanelSource;
  const recoveryModalLayerCombinedSource = devtoolsSource + '\n' + recoveryModalLayerSource + '\n' + recoveryCacheActionsSource + '\n' + recoverySearchActionsSource;

  return {
    fullManifestDrivenSource,
    fullSourceGroupManifest,
    fs,
    path,
    projectRoot,
    publicRoot,
    root,
    docsRoot,
    checksRoot,
    frontendCheckSource,
    frontendCheckModuleManifestSource,
    frontendCheckUiLayeringSource,
    frontendCheckVersionMarkersSource,
    frontendCheckRecoveryCenterGuardsSource,
    frontendCheckSourceLoaderSource,
    frontendCheckUtilsSource,
    frontendCheckAppShellSource,
    frontendCheckLibraryVirtualSource,
    frontendCheckLibraryVirtualSplitSource,
    frontendCheckLibraryVirtualReportHistorySource,
    frontendCheckSettingsShellQualitySource,
    frontendCheckSettingsModalSafeareaSource,
    frontendCheckDevdebugNavigationSource,
    frontendCheckReaderOverlayQualitySource,
    frontendCheckLibraryVirtualRuntimeBridgeSource,
    frontendCheckReaderSearchSource,
    frontendCheckReaderCacheLayoutSource,
    frontendCheckLibraryVirtualPolicyRolloutSource,
    
    frontendCheckReaderRuntimeSource,
    frontendCheckSearchRuntimeSource,
    frontendCheckRecoverySearchCacheSource,
    frontendCheckThemeDevtoolsSource,
    frontendCheckSyncRefactorSource,
    frontendCheckSplitGuardsSource,
    frontendCheckSplitCoreHistorySource,
    frontendCheckSplitDomainHistorySource,
    frontendCheckReadDataImportGuardsSource,
    frontendCheckReadDataImportBoundaryGuardsSource,
    frontendCheckReadDataPreviewGuardsSource,
    frontendCheckSafeAreaControlsSplitGuardsSource,
    frontendCheckReadDataGuardUtilsSource,
    frontendCheckLatestDocIndexGuardSource,
    frontendModuleImportSmokeSource: frontendCheckModuleImportSmokeSource,
    frontendCheckLibraryLoadStateGuardSource,
    shellSource,
    appCssSource,
    ownerCssSource,
    siteHtmlSource,
    mobileHtmlSource,
    librarySource,
    libraryModelSource,
    libraryLoadStateSource,
    libraryVirtualFallbackPolicySource,
    libraryVirtualTrialDiagnosticsSource,
    libraryRowDiagnosticsSource,
    libraryVirtualRowInspectionSource,
    libraryActionAuditSummarySource,
    libraryActionAuditDiagnosticsSource,
    libraryVirtualGateDiagnosticsSource,
    libraryPrototypeDiagnosticsSource,
    libraryVirtualSessionDiagnosticsSource,
    libraryVirtualHistoryRecordSource,
    libraryVirtualRenderCacheSource,
    libraryVirtualRenderReportingSource,
    libraryVirtualGateAuditSource,
    libraryVirtualGateDetailSource,
    libraryVirtualSessionPayloadSource,
    libraryVirtualSessionFallbackSource,
    libraryVirtualPrototypeWindowDiagnosticsSource,
    readerSource,
    prefetchQueueSource,
    readerPrefetchSnapshotSource,
    readerPrefetchScheduleSource,
    offlineStatusSource,
    readerOfflineStatusFormattersSource,
    readerChunkWindowSource,
    readerLoadChunkSideEffectsSource,
    readerChunkWindowDiagnosticsSource,
    readerChunkWindowPruneSource,
    readerConstantsSource,
    readerCacheStoreSource,
    readerCacheDiagnosticsSource,
    readerCacheDiagnosticsUnavailableSource,
    readerCacheRecordFormattersSource,
    readerCacheNovelStatsSource,
    readerCachePrunePlanSource,
    readerCachePruneDiagnosticsSource,
    readerCacheDeleteFormattersSource,
    readerVirtualLayoutSource,
    readerVirtualLayoutDiagnosticsSource,
    readerVirtualLayoutReportLabelsSource,
    readerVirtualRowSignatureSource,
    searchSource,
    searchMatcherSource,
    searchResultsViewSource,
    searchStatusPanelSource,
    searchStatusFormattersSource,
    searchCoverageSummarySource,
    searchRemoconUiSource,
    searchStatusDetailRowsSource,
    searchFilterControlsSource,
    searchJumpStatusSource,
    searchRetryDispatcherSource,
    searchAnnouncementFormattersSource,
    searchNavigationUiSource,
    searchSessionResetSource,
    searchJumpInfoSource,
    searchResultLabelsSource,
    searchFilterSummarySource,
    recoveryLibraryVirtualReadinessPanelUtilsSource,
    searchResultsSource,
    devtoolsSource,
    devtoolsReportSource,
    devtoolsReportFormattersSource,
    devtoolsControlsSource,
    appearanceSource,
    themeEditorSource,
    settingsThemeColorUtilsSource,
    settingsThemeFileUtilsSource,
    themePresetsSource,
    customCssSource,
    settingsCustomCssUtilsSource,
    preprocessSource,
    preprocessSummarySource,
    settingsFunctionalLabelsSource,
    settingsSafeAreaTemplateLabelsSource,
    settingsSafeAreaProfileLabelsSource,
    settingsSafeAreaProfilePromptSource,
    settingsSafeAreaContextLabelsSource,
    settingsSafeAreaLabelsSource,
    controlsSource,
    settingsControlsSource,
    settingsControlDomUtilsSource,
    settingsClockFormatSource,
    settingsSafeAreaControlsSource,
    settingsSafeAreaConstantsSource,
    settingsSafeAreaProfilesSource,
    settingsSafeAreaProfileActionsSource,
    settingsSafeAreaTemplateFactorySource,
    settingsSafeAreaContextSource,
    settingsSafeAreaDebugSource,
    settingsSafeAreaDebugFormattersSource,
    settingsSafeAreaSlotLayoutSource,
    safeAreaControlsCombinedSource,
    settingsLibraryVirtualStatusSource,
    settingsFontsSource,
    settingsFontChoiceCardSource,
    uiSource,
    elementsSource,
    readDataModalSource,
    readDataModelSource,
    readDataImportSource,
    readDataImportConstantsSource,
    readDataImportMergeSource,
    readDataImportProgressMergeSource,
    readDataImportArrayMergeSource,
    readDataImportDetailBuildersSource,
    readDataImportDiffExportSource,
    readDataPreviewSource,
    readDataPreviewFilterSource,
    readDataPreviewEntriesSource,
    readDataPreviewBulkToolbarSource,
    readDataPreviewResultsSource,
    readDataPreviewDetailModalSource,
    readDataRollbackSource,
    readDataImportCombinedSource,
    recoverySearchDiagnosticsSource,
    recoveryCacheDiagnosticsSource,
    recoveryLibraryDiagnosticsSource,
    recoveryManualReviewBundleSource,
    recoveryManualReviewBundleConstantsSource,
    recoveryManualReviewReviewerSummarySectionsSource,
    recoveryExportUtilsSource,
    recoveryButtonWiringSource,
    recoveryButtonWiringSafetyManifestSource,
    recoveryButtonWiringSafetyRendererSource,
    recoveryRuntimeSource,
    recoveryOrchestrationSource,
    recoverySummaryPanelSource,
    recoveryPolicyChecklistPanelSource,
    recoveryImportScopePanelSource,
    recoveryImportActionsSource,
    recoveryImportWritebackSource,
    recoveryNavigationSource,
    recoveryActionUiSource,
    recoveryDomSmokePanelSource,
    recoveryDomSmokeMarkersSource,
    recoveryDomSmokePanelRendererSource,
    recoveryDiagnosticsPanelSource,
    recoveryLibraryFormattersSource,
    recoveryLibraryVirtualReportsSource,
    recoveryLibraryVirtualReportConstantsSource,
    recoveryLibraryVirtualReportUtilsSource,
    recoveryLibraryVirtualBasicPanelsSource,
    recoveryLibraryVirtualChecklistHistorySource,
    recoveryLibraryVirtualReadinessReportsSource,
    recoveryLibraryVirtualStaticPolicyGuardSource,
    recoveryLibraryVirtualManualReviewWorkflowSource,
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
    recoveryLibraryVirtualPostStabilizationReviewPayloadSource,
    recoveryLibraryVirtualRiskRegisterReportSource,
    recoveryLibraryVirtualFinalAuditUtilsSource,
    recoveryLibraryVirtualEvidenceDiagnosticsSource,
    recoveryLibraryVirtualEvidenceUtilsSource,
    recoveryLibraryVirtualEvidencePanelRenderersSource,
    recoveryLibraryVirtualEvidenceFreshnessSource,
    recoveryLibraryVirtualOptinAuditSource,
    recoveryLibraryVirtualOptinPanelRenderersSource,
    recoveryLibraryVirtualDiagnosticPayloadsSource,
    recoveryLibraryVirtualManualReviewChecklistSource,
    recoveryLibraryVirtualManualReviewBundlePanelsSource,
    recoveryLibraryVirtualSessionPanelsSource,
    recoveryLibraryVirtualReadinessPolicyPanelSource,
    recoveryCacheManagementPanelSource,
    recoverySearchPanelSource,
    recoverySearchCoverageModalRenderersSource,
    recoveryLibraryDiagnosticsPanelSource,
    recoveryLibraryDiagnosticsPanelRenderersSource,
    recoveryLibraryDiagnosticsPanelCompositionSource,
    recoveryLibraryDiagnosticsSamplesSource,
    recoveryLibraryDiagnosticsCopyActionsSource,
    recoveryLibraryDiagnosticsCopyGroupsSource,
    recoveryLibraryDiagnosticsStatusRowsSource,
    recoveryLibraryDiagnosticsPanelShellSource,
    recoveryLibraryDiagnosticsControlButtonsSource,
    recoveryLibraryDiagnosticsExportPayloadSource,
    recoveryLibraryDiagnosticsSectionAssemblySource,
    recoveryLibraryDiagnosticsSectionGroupsSource,
    recoveryCacheActionsSource,
    recoverySearchActionsSource,
    recoverySnapshotExportSource,
    recoveryLocalMaintenanceSource,
    recoveryModalLayerSource,
    syncFormattersSource,
    syncDeviceManagementSource,
    remoteResumeSource,
    periodicDeviceSyncSource,
    serverStateHydrationSource,
    stateSource,
    utilsSource,
    appShellRuntimeSource,
    libraryVirtualReportsCombinedSource,
    domSmokeMarkerCombinedSource,
    devtoolsNavigationCombinedSource,
    manualReviewBundleCombinedSource,
    recoverySearchPanelCombinedSource,
    recoveryCacheCombinedSource,
    recoveryModalLayerCombinedSource,
    manifestDrivenMaintenanceSource,
    ...manifestDrivenSourceGroups
  };
}

module.exports = {
  FRONTEND_CHECK_SOURCE_LOADER_PASS,
  FRONTEND_CHECK_SOURCE_LOADER_GROUPING_PASS,
  FRONTEND_CHECK_SOURCE_LOADER_MANIFEST_PASS,
  loadFrontendCheckSources
};
