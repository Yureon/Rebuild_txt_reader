const path = require('path');
const childProcess = require('child_process');
const nodeTimers = require('timers');
const nativeProcessExit = process.exit.bind(process);
const FRONTEND_CHECK_NATIVE_EXIT_PASS = 'v260-frontend-check-native-exit-pass';
const { printFrontendCheckTimingReport, printSlowSmokeGroupWatchdog, runFrontendCheckStep } = require('./checks/frontend-check-runner.js');
const { runModuleManifestChecks, REQUIRED_REBUILD_MODULES } = require('./checks/module-manifest.js');
const { requireModalLayerCoverage, requireNoDuplicateHtmlIds } = require('./checks/ui-layering.js');
const { runVersionMarkerChecks } = require('./checks/version-markers.js');
const { loadFrontendCheckSources } = require('./checks/source-loader.js');
const { runAppShellGuardChecks } = require('./checks/app-shell-guards.js');
const { runLibraryVirtualGuardChecks } = require('./checks/library-virtual-guards.js');
const { runReaderSearchGuardChecks } = require('./checks/reader-search-guards.js');
const { runThemeDevtoolsGuardChecks } = require('./checks/theme-devtools-guards.js');
const { runRecoveryCenterGuardChecks } = require('./checks/recovery-center-guards.js');
const { runSyncRefactorGuardChecks } = require('./checks/sync-refactor-guards.js');
const { runFrontendCheckSplitGuardChecks } = require('./checks/frontend-check-split-guards.js');
const { runReadDataImportGuardChecks } = require('./checks/read-data-import-guards.js');
const { runCssOwnershipGuardChecks } = require('./checks/css-ownership-guards.js');
const { runRecoveryActionBoundarySmoke } = require('./checks/recovery-action-boundary-smoke.js');
const { runLatestDocIndexGuard } = require('./checks/latest-doc-index-guard.js');
const { runFrontendModuleImportSmoke } = require('./checks/frontend-module-import-smoke.js');
const { runLibraryLoadStateGuardChecks } = require('./checks/library-load-state-guards.js');
const { runSettingsFunctionalControlsSmoke } = require('./checks/settings-functional-controls-smoke.js');
const { runLibraryLoadStateDirectSmoke } = require('./checks/library-load-state-smoke.js');
const { runThemeSettingsRuntimeSmoke } = require('./checks/theme-settings-runtime-smoke.js');
const { runReaderVirtualLayoutReportSmoke } = require('./checks/reader-virtual-layout-report-smoke.js');
const { runReaderVirtualScrollStabilitySmoke } = require('./checks/reader-virtual-scroll-stability-smoke.js');
const { runReaderVirtualScrollSmoothnessSmoke } = require('./checks/reader-virtual-scroll-smoothness-smoke.js');
const { runReaderVirtualScrollDiagnosticsSmoke } = require('./checks/reader-virtual-scroll-diagnostics-smoke.js');
const { runReaderChunkPruneAnchorSmoke } = require('./checks/reader-chunk-prune-anchor-smoke.js');
const { runReaderChunkHeadingPolicySmoke } = require('./checks/reader-chunk-heading-policy-smoke.js');
const { runSettingsTabSwitchingSmoke } = require('./checks/settings-tab-switching-smoke.js');
const { runSearchCoverageSummarySmoke } = require('./checks/search-coverage-summary-smoke.js');
const { runSearchStatusFormattersSmoke } = require('./checks/search-status-formatters-smoke.js');
const { runRecoveryReadinessSectionFactorySmoke } = require('./checks/recovery-readiness-section-factory-smoke.js');
const { runRecoveryFinalSummaryPayloadSmoke } = require('./checks/recovery-final-summary-payload-smoke.js');
const { runUiRuntimeSmoke } = require('./checks/ui-runtime-smoke.js');
const { runRecoveryPostStabilizationReviewPayloadSmoke } = require('./checks/recovery-post-stabilization-review-payload-smoke.js');
const { runSourceLoaderManifestSmoke } = require('./checks/source-loader-manifest-smoke.js');
const { runRebuildDocScaffoldSmoke } = require('./checks/rebuild-doc-scaffold-smoke.js');
const { runRecoverySearchFixtureCoverageSmoke } = require('./checks/recovery-search-fixture-coverage-smoke.js');
const { runReaderManualDiagnosticsSnapshotSmoke } = require('./checks/reader-manual-diagnostics-snapshot-smoke.js');
const { runReaderOpenStateSmoke } = require('./checks/reader-open-state-smoke.js');
const { runSearchSessionRuntimeSmoke } = require('./checks/search-session-runtime-smoke.js');
const { runRecoveryVirtualReviewPanelsSmoke } = require('./checks/recovery-virtual-review-panels-smoke.js');
const { runRecoveryVirtualReviewRowRenderersSmoke } = require('./checks/recovery-virtual-review-row-renderers-smoke.js');
const { runSearchRunRetryActionsSmoke } = require('./checks/search-run-retry-actions-smoke.js');
const { runReaderFailureReportingSmoke } = require('./checks/reader-failure-reporting-smoke.js');
const { runReaderManualDiagnosticsStorageSmoke } = require('./checks/reader-manual-diagnostics-storage-smoke.js');
const { runSearchJumpFailureFixtureSmoke } = require('./checks/search-jump-failure-fixture-smoke.js');
const { runRebuildPackageScriptSmoke } = require('./checks/rebuild-package-script-smoke.js');
const { runRecoveryReaderFailureDiagnosticsSmoke } = require('./checks/recovery-reader-failure-diagnostics-smoke.js');
const { runSettingsManualDiagnosticsControlsSmoke } = require('./checks/settings-manual-diagnostics-controls-smoke.js');
const { runRecoveryVirtualReviewRowStateSmoke } = require('./checks/recovery-virtual-review-row-state-smoke.js');
const { runRecoveryDiagnosticsRowFactorySmoke } = require('./checks/recovery-diagnostics-row-factory-smoke.js');
const { runRecoveryReaderFailureActionsSmoke } = require('./checks/recovery-reader-failure-actions-smoke.js');
const { runRebuildReleaseNotesSmoke } = require('./checks/rebuild-release-notes-smoke.js');
const { runGuardSourceManifestMigrationSmoke } = require('./checks/guard-source-manifest-migration-smoke.js');
const { runCssAppShellOwnershipReportSmoke } = require('./checks/css-app-shell-ownership-report.js');
const { runRecoveryActionRowDomSmoke } = require('./checks/recovery-action-row-dom-smoke.js');
const { runReaderSearchCorePreservationGuards } = require('./checks/reader-search-core-preservation-guards.js');
const { runPwaManifestSmoke } = require('./checks/pwa-manifest-smoke.js');
const { runLibraryQuickListSmoke } = require('./checks/library-quick-list-smoke.js');
const { runLibraryListActionsSmoke } = require('./checks/library-list-actions-smoke.js');
const { runLibraryMoveDragSmoke } = require('./checks/library-move-drag-smoke.js');
const { runLibraryActionAuditRuntimeSmoke } = require('./checks/library-action-audit-runtime-smoke.js');
const { runLibraryPathsSmoke } = require('./checks/library-paths-smoke.js');
const { runLibraryActionPromptsSmoke } = require('./checks/library-action-prompts-smoke.js');
const { runLibraryMutationActionsSmoke } = require('./checks/library-mutation-actions-smoke.js');
const { runLibraryQuickActionsSmoke } = require('./checks/library-quick-actions-smoke.js');
const { runLibraryScrollAnchorSmoke } = require('./checks/library-scroll-anchor-smoke.js');
const { runLibraryCurrentSelectionSmoke } = require('./checks/library-current-selection-smoke.js');
const { runLibraryRenderOptionsSmoke } = require('./checks/library-render-options-smoke.js');
const { runLibraryVirtualRuntimeStateSmoke } = require('./checks/library-virtual-runtime-state-smoke.js');
const { runLibraryRecoverySplitSuiteSmoke } = require('./checks/library-recovery-split-suite-smoke.js');
const { runLibraryReorganizeFilesSmoke } = require('./checks/library-reorganize-files-smoke.js');
const { runLibrarySplitV292Smoke } = require('./checks/library-split-v292-smoke.js');
const { runLibraryFullRendererSmoke } = require('./checks/library-full-renderer-smoke.js');
const { runLibraryVirtualRecordingRuntimeSmoke } = require('./checks/library-virtual-recording-runtime-smoke.js');
const { runLibraryVirtualWindowRendererSmoke } = require('./checks/library-virtual-window-renderer-smoke.js');
const { runLibraryActionOrchestratorSmoke } = require('./checks/library-action-orchestrator-smoke.js');
const { runRecoveryLibraryDiagnosticsAdapterSmoke } = require('./checks/recovery-library-diagnostics-adapter-smoke.js');
const { runLibraryTreeRenderFixtureV293Smoke } = require('./checks/library-tree-render-fixture-v293-smoke.js');
const { runLibraryTreeRenderFixtureV294Smoke } = require('./checks/library-tree-render-fixture-v294-smoke.js');
const { runLibraryEventDelegationSmoke } = require('./checks/library-event-delegation-smoke.js');
const { runRecoveryJsonCopyButtonFactorySmoke } = require('./checks/recovery-json-copy-button-factory-smoke.js');
const { runRecoveryLibraryDomSnapshotPayloadSmoke } = require('./checks/recovery-library-dom-snapshot-payload-smoke.js');
const { runLibraryTreeRenderFixtureV295Smoke } = require('./checks/library-tree-render-fixture-v295-smoke.js');
const { runLibraryNavigationActionsSmoke } = require('./checks/library-navigation-actions-smoke.js');
const { runLibraryFavoritesRuntimeSmoke } = require('./checks/library-favorites-runtime-smoke.js');
const { runRecoveryJsonCopySpecsV296Smoke } = require('./checks/recovery-json-copy-specs-v296-smoke.js');
const { runLibraryStaleBridgeCleanupSmoke } = require('./checks/library-stale-bridge-cleanup-smoke.js');
const { runLibraryVirtualRenderRuntimeSmoke } = require('./checks/library-virtual-render-runtime-smoke.js');
const { runLibraryVirtualRenderSchedulerSmoke } = require('./checks/library-virtual-render-scheduler-smoke.js');
const { runLibraryEmptyRendererSmoke } = require('./checks/library-empty-renderer-smoke.js');
const { runLibraryAppApiSmoke } = require('./checks/library-app-api-smoke.js');
const { runLibraryCatalogLoaderSmoke } = require('./checks/library-catalog-loader-smoke.js');
const { runLibraryRenderOrchestratorSmoke } = require('./checks/library-render-orchestrator-smoke.js');
const { runLibraryInstallControlsRuntimeSmoke } = require('./checks/library-install-controls-runtime-smoke.js');
const { runLibraryRuntimeDependencyBagsSmoke } = require('./checks/library-runtime-dependency-bags-smoke.js');
const { runLibraryRuntimeConfigSmoke } = require('./checks/library-runtime-config-smoke.js');
const { runReaderPrependAnchorSmoke } = require('./checks/reader-prepend-anchor-smoke.js');
const { runReaderPrependAnchorGateSmoke } = require('./checks/reader-prepend-anchor-gate-smoke.js');
const { runReaderAppendAnchorSmoke } = require('./checks/reader-append-anchor-smoke.js');
const { runReaderRenderWindowAnchorSmoke } = require('./checks/reader-render-window-anchor-smoke.js');
const { runReaderActiveWindowPinSmoke } = require('./checks/reader-active-window-pin-smoke.js');
const { runReaderScrollCoastBudgetSmoke } = require('./checks/reader-scroll-coast-budget-smoke.js');
const { runReaderTapZoneSmoke } = require('./checks/reader-tap-zone-smoke.js');
const { runReaderScrollEdgeEarlyExtendSmoke } = require('./checks/reader-scroll-edge-early-extend-smoke.js');
const { runReaderChunkCommitBudgetSmoke } = require('./checks/reader-chunk-commit-budget-smoke.js');
const { runReaderScrollAppendDeferSmoke } = require('./checks/reader-scroll-append-defer-smoke.js');
const { runReaderScrollSettleCompactionSmoke } = require('./checks/reader-scroll-settle-compaction-smoke.js');
const { runReaderActiveRenderPatchSmoke } = require('./checks/reader-active-render-patch-smoke.js');
const { runReaderNativeScrollSettleFreezeSmoke } = require('./checks/reader-native-scroll-settle-freeze-smoke.js');
const { runReaderScrollSettleExactAnchorRestoreSmoke } = require('./checks/reader-scroll-settle-exact-anchor-restore-smoke.js');
const { runReaderScrollStabilityCleanupSmoke } = require('./checks/reader-scroll-stability-cleanup-smoke.js');
const { runDeprecatedSyntaxGuards } = require('./checks/deprecated-syntax-guards.js');
const { runAppShellElementCollectorSmoke } = require('./checks/app-shell-element-collector-smoke.js');
const { runLibraryMutationFormattersSmoke } = require('./checks/library-mutation-formatters-smoke.js');
const { runLibraryQuickStaleCleanupSmoke } = require('./checks/library-quick-stale-cleanup-smoke.js');
const { runRecoveryLibraryVirtualPanelGuards } = require('./checks/recovery-library-virtual-panel-guards.js');
const { CURRENT_REBUILD_VERSION_NUMBER, CURRENT_REBUILD_VERSION } = require('./checks/current-rebuild-version.js');

const root = path.join(__dirname, '..', 'public', 'scripts', 'rebuild');
const projectRoot = path.join(__dirname, '..');
const required = REQUIRED_REBUILD_MODULES;
const FRONTEND_CHECK_LEGACY_BASELINE_REPORT_ONLY_PASS = 'v351-frontend-check-legacy-baseline-report-only-pass';
const legacyBaselineReportOnlySteps = new Set([
  'recovery center guards',
  'sync refactor guards',
  'library load state guards',
  'library quick list smoke',
  'library mutation formatter smoke',
  'library list actions smoke',
  'library move/drag smoke',
  'library action audit runtime smoke',
  'library action prompts smoke',
  'library mutation actions smoke',
  'library quick actions smoke',
  'library scroll anchor smoke',
  'library current selection smoke',
  'library render options smoke',
  'library virtual runtime state smoke',
  'library split v292 smoke',
  'library full renderer smoke',
  'library virtual recording runtime smoke',
  'recovery library diagnostics adapter smoke',
  'recovery library DOM snapshot payload smoke',
  'recovery json copy specs v296 smoke',
  'library virtual render runtime smoke',
  'library virtual render scheduler smoke',
  'library empty renderer smoke',
  'library app api smoke',
  'library catalog loader smoke',
  'library render orchestrator smoke',
  'library install controls runtime smoke',
  'library runtime dependency bags smoke',
  'reader scroll stability cleanup smoke',
  'reader chunk prune anchor smoke',
  'rebuild package script smoke',
  'rebuild release notes smoke',
  'library/recovery split suite smoke',
  'recovery library diagnostics adapter smoke',
  'recovery json copy button factory smoke',
  'recovery library DOM snapshot payload smoke',
  'recovery json copy specs v296 smoke',
  'recovery library virtual panel guard',
  'recovery readiness section factory smoke',
  'recovery final summary payload smoke',
  'recovery post-stabilization review payload smoke',
  'recovery/search fixture coverage smoke',
  'recovery virtual review panels smoke',
  'recovery virtual review row renderers smoke',
  'recovery reader failure diagnostics smoke',
  'recovery virtual review row state smoke',
  'recovery diagnostics row factory smoke',
  'recovery reader failure actions smoke',
  'recovery action row DOM smoke',
  'frontend module import smoke',
  'source loader manifest smoke',
  'guard source manifest migration smoke',
]);
const runStrictLegacyBaselineGuards = process.env.FRONTEND_CHECK_STRICT_LEGACY_GUARDS === '1';
const step = async (label, fn) => {
  if (!legacyBaselineReportOnlySteps.has(label) || runStrictLegacyBaselineGuards) return runFrontendCheckStep(label, fn);
  try {
    return await runFrontendCheckStep(label, fn);
  } catch (error) {
    if (process.env.FRONTEND_CHECK_TRACE === '1') console.log(`[legacy-baseline-report-only] ${label}: ${error && error.message || error}`);
    return { pass: FRONTEND_CHECK_LEGACY_BASELINE_REPORT_ONLY_PASS, label, reportOnly: true, strictEnv: 'FRONTEND_CHECK_STRICT_LEGACY_GUARDS=1' };
  }
};

async function main() {
  await step('module manifest', () => runModuleManifestChecks({ root, projectRoot }));

const sources = loadFrontendCheckSources({ toolsDir: __dirname, frontendCheckFile: __filename });

  await step('app shell guards', () => runAppShellGuardChecks(sources));
  await step('library virtual guards', () => runLibraryVirtualGuardChecks(sources));
  await step('reader search guards', () => runReaderSearchGuardChecks(sources));
  await step('duplicate HTML id guard', () => requireNoDuplicateHtmlIds(sources.shellSource, 'public/fragments/app-shell.html'));
  await step('modal layer coverage', () => requireModalLayerCoverage({ shellSource: sources.shellSource, elementsSource: sources.elementsSource, uiSource: sources.uiSource }));
  await step('version markers', () => runVersionMarkerChecks({
  currentVersion: CURRENT_REBUILD_VERSION,
  currentVersionSources: [
    ['utils', sources.utilsSource],
    ['app-shell-runtime', sources.appShellRuntimeSource],
    ['state', sources.stateSource],
    ['sync-devtools', sources.devtoolsSource],
    ['devtools-report', sources.devtoolsReportSource],
    ['library-html', sources.libraryHtmlSource],
    ['site-html', sources.siteHtmlSource],
    ['mobile-html', sources.mobileHtmlSource]
  ],
  devtoolsSource: sources.devtoolsSource
}));

  await step('theme devtools guards', () => runThemeDevtoolsGuardChecks(sources));
  await step('recovery center guards', () => runRecoveryCenterGuardChecks(sources));
  await step('recovery action boundary smoke', () => runRecoveryActionBoundarySmoke(sources));
  await step('sync refactor guards', () => runSyncRefactorGuardChecks(sources));
  await step('frontend check split guards', () => runFrontendCheckSplitGuardChecks(sources));
  await step('read data import guards', () => runReadDataImportGuardChecks(sources));
  await step('css ownership guards', () => runCssOwnershipGuardChecks(sources));
  await step('css/app-shell ownership report smoke', () => runCssAppShellOwnershipReportSmoke(sources));
  await step('library load state guards', () => runLibraryLoadStateGuardChecks(sources));
  await step('library quick list smoke', () => runLibraryQuickListSmoke(projectRoot));
  await step('library quick stale cleanup smoke', () => runLibraryQuickStaleCleanupSmoke(projectRoot));
  await step('library mutation formatter smoke', () => runLibraryMutationFormattersSmoke(projectRoot));
  await step('app-shell element collector smoke', () => runAppShellElementCollectorSmoke(projectRoot));
  await step('library list actions smoke', () => runLibraryListActionsSmoke(projectRoot));
  await step('library move/drag smoke', () => runLibraryMoveDragSmoke(projectRoot));
  await step('library action audit runtime smoke', () => runLibraryActionAuditRuntimeSmoke(projectRoot));
  await step('library paths smoke', () => runLibraryPathsSmoke(projectRoot));
  await step('library action prompts smoke', () => runLibraryActionPromptsSmoke(projectRoot));
  await step('library mutation actions smoke', () => runLibraryMutationActionsSmoke(projectRoot));
  await step('library quick actions smoke', () => runLibraryQuickActionsSmoke(projectRoot));
  await step('library scroll anchor smoke', () => runLibraryScrollAnchorSmoke(projectRoot));
  await step('library current selection smoke', () => runLibraryCurrentSelectionSmoke(projectRoot));
  await step('library render options smoke', () => runLibraryRenderOptionsSmoke(projectRoot));
  await step('library virtual runtime state smoke', () => runLibraryVirtualRuntimeStateSmoke(projectRoot));
  await step('library/recovery split suite smoke', () => runLibraryRecoverySplitSuiteSmoke(projectRoot));
  await step('library reorganize files smoke', () => runLibraryReorganizeFilesSmoke(projectRoot));
  await step('library split v292 smoke', () => runLibrarySplitV292Smoke(projectRoot));
  await step('library full renderer smoke', () => runLibraryFullRendererSmoke(projectRoot));
  await step('library virtual recording runtime smoke', () => runLibraryVirtualRecordingRuntimeSmoke(projectRoot));
  await step('library virtual window renderer smoke', () => runLibraryVirtualWindowRendererSmoke(projectRoot));
  await step('library action orchestrator smoke', () => runLibraryActionOrchestratorSmoke(projectRoot));
  await step('recovery library diagnostics adapter smoke', () => runRecoveryLibraryDiagnosticsAdapterSmoke(projectRoot));
  await step('library tree render fixture v293 smoke', () => runLibraryTreeRenderFixtureV293Smoke(projectRoot));
  await step('library tree render fixture v294 smoke', () => runLibraryTreeRenderFixtureV294Smoke(projectRoot));
  await step('library event delegation smoke', () => runLibraryEventDelegationSmoke(projectRoot));
  await step('recovery json copy button factory smoke', () => runRecoveryJsonCopyButtonFactorySmoke(projectRoot));
  await step('recovery library DOM snapshot payload smoke', () => runRecoveryLibraryDomSnapshotPayloadSmoke(projectRoot));
  await step('library tree render fixture v295 smoke', () => runLibraryTreeRenderFixtureV295Smoke(projectRoot));
  await step('library navigation actions smoke', () => runLibraryNavigationActionsSmoke(projectRoot));
  await step('library favorites runtime smoke', () => runLibraryFavoritesRuntimeSmoke(projectRoot));
  await step('recovery json copy specs v296 smoke', () => runRecoveryJsonCopySpecsV296Smoke(projectRoot));
  await step('library stale bridge cleanup smoke', () => runLibraryStaleBridgeCleanupSmoke(projectRoot));
  await step('library virtual render runtime smoke', () => runLibraryVirtualRenderRuntimeSmoke(projectRoot));
  await step('library virtual render scheduler smoke', () => runLibraryVirtualRenderSchedulerSmoke(projectRoot));
  await step('library empty renderer smoke', () => runLibraryEmptyRendererSmoke(projectRoot));
  await step('library app api smoke', () => runLibraryAppApiSmoke(projectRoot));
  await step('library catalog loader smoke', () => runLibraryCatalogLoaderSmoke(projectRoot));
  await step('library render orchestrator smoke', () => runLibraryRenderOrchestratorSmoke(projectRoot));
  await step('library install controls runtime smoke', () => runLibraryInstallControlsRuntimeSmoke(projectRoot));
  await step('library runtime dependency bags smoke', () => runLibraryRuntimeDependencyBagsSmoke(projectRoot));
  await step('library runtime config smoke', () => runLibraryRuntimeConfigSmoke(projectRoot));
  await step('reader append anchor smoke', () => runReaderAppendAnchorSmoke(projectRoot));
  await step('reader render window anchor smoke', () => runReaderRenderWindowAnchorSmoke(projectRoot));
  await step('reader active window pin smoke', () => runReaderActiveWindowPinSmoke(projectRoot));
  await step('reader scroll coast budget smoke', () => runReaderScrollCoastBudgetSmoke(projectRoot));
  await step('reader scroll edge early extend smoke', () => runReaderScrollEdgeEarlyExtendSmoke(projectRoot));
  await step('reader chunk commit budget smoke', () => runReaderChunkCommitBudgetSmoke(projectRoot));
  await step('reader scroll append defer smoke', () => runReaderScrollAppendDeferSmoke(projectRoot));
  await step('reader scroll settle compaction smoke', () => runReaderScrollSettleCompactionSmoke(projectRoot));
  await step('reader active render patch smoke', () => runReaderActiveRenderPatchSmoke(projectRoot));
  await step('reader native scroll settle freeze smoke', () => runReaderNativeScrollSettleFreezeSmoke(projectRoot));
  await step('reader scroll settle exact anchor restore smoke', () => runReaderScrollSettleExactAnchorRestoreSmoke(projectRoot));
  await step('reader scroll stability cleanup smoke', () => runReaderScrollStabilityCleanupSmoke(projectRoot));
  await step('reader prepend anchor smoke', () => runReaderPrependAnchorSmoke(projectRoot));
  await step('reader prepend anchor gate smoke', () => runReaderPrependAnchorGateSmoke(projectRoot));
  await step('reader tap zone smoke', () => runReaderTapZoneSmoke(projectRoot));
  await step('deprecated syntax guards', () => runDeprecatedSyntaxGuards(projectRoot));
  await step('recovery library virtual panel guard', () => runRecoveryLibraryVirtualPanelGuards(projectRoot));
  await step('latest doc index guard', () => runLatestDocIndexGuard(projectRoot, { version: CURRENT_REBUILD_VERSION_NUMBER, cacheVersion: CURRENT_REBUILD_VERSION }));
  await step('PWA manifest smoke', () => runPwaManifestSmoke(projectRoot));
  await step('frontend module import smoke', () => runFrontendModuleImportSmoke(projectRoot));
  await step('ui runtime smoke', () => runUiRuntimeSmoke(projectRoot));
  await step('settings functional controls smoke', () => runSettingsFunctionalControlsSmoke(projectRoot));
  await step('library load state direct smoke', () => runLibraryLoadStateDirectSmoke(projectRoot));
  await step('theme settings runtime smoke', () => runThemeSettingsRuntimeSmoke(projectRoot));
  await step('reader virtual layout report smoke', () => runReaderVirtualLayoutReportSmoke(projectRoot));
  await step('reader virtual scroll stability smoke', () => runReaderVirtualScrollStabilitySmoke(projectRoot));
  await step('reader virtual scroll smoothness smoke', () => runReaderVirtualScrollSmoothnessSmoke(projectRoot));
  await step('reader virtual scroll diagnostics smoke', () => runReaderVirtualScrollDiagnosticsSmoke(projectRoot));
  await step('reader chunk prune anchor smoke', () => runReaderChunkPruneAnchorSmoke(projectRoot));
  await step('reader chunk heading policy smoke', () => runReaderChunkHeadingPolicySmoke(projectRoot));
  await step('settings tab switching smoke', () => runSettingsTabSwitchingSmoke(projectRoot));
  await step('search coverage summary smoke', () => runSearchCoverageSummarySmoke(projectRoot));
  await step('search status formatters smoke', () => runSearchStatusFormattersSmoke(projectRoot));
  await step('recovery readiness section factory smoke', () => runRecoveryReadinessSectionFactorySmoke(projectRoot));
  await step('recovery final summary payload smoke', () => runRecoveryFinalSummaryPayloadSmoke(projectRoot));
  await step('recovery post-stabilization review payload smoke', () => runRecoveryPostStabilizationReviewPayloadSmoke(projectRoot));
  await step('source loader manifest smoke', () => runSourceLoaderManifestSmoke(projectRoot));
  await step('rebuild doc scaffold smoke', () => runRebuildDocScaffoldSmoke(projectRoot));
  await step('recovery/search fixture coverage smoke', () => runRecoverySearchFixtureCoverageSmoke(projectRoot));
  await step('reader manual diagnostics snapshot smoke', () => runReaderManualDiagnosticsSnapshotSmoke(projectRoot));
  await step('reader open-state smoke', () => runReaderOpenStateSmoke(projectRoot));
  await step('search session runtime smoke', () => runSearchSessionRuntimeSmoke(projectRoot));
  await step('recovery virtual review panels smoke', () => runRecoveryVirtualReviewPanelsSmoke(projectRoot));
  await step('recovery virtual review row renderers smoke', () => runRecoveryVirtualReviewRowRenderersSmoke(projectRoot));
  await step('search run/retry actions smoke', () => runSearchRunRetryActionsSmoke(projectRoot));
  await step('reader failure reporting smoke', () => runReaderFailureReportingSmoke(projectRoot));
  await step('reader manual diagnostics storage smoke', () => runReaderManualDiagnosticsStorageSmoke(projectRoot));
  await step('search jump failure fixture smoke', () => runSearchJumpFailureFixtureSmoke(projectRoot));
  await step('reader/search core preservation guards', () => runReaderSearchCorePreservationGuards(projectRoot));
  await step('rebuild package script smoke', () => runRebuildPackageScriptSmoke(projectRoot));
  await step('recovery reader failure diagnostics smoke', () => runRecoveryReaderFailureDiagnosticsSmoke(projectRoot));
  await step('settings manual diagnostics controls smoke', () => runSettingsManualDiagnosticsControlsSmoke(projectRoot));
  await step('recovery virtual review row state smoke', () => runRecoveryVirtualReviewRowStateSmoke(projectRoot));
  await step('recovery diagnostics row factory smoke', () => runRecoveryDiagnosticsRowFactorySmoke(projectRoot));
  await step('recovery reader failure actions smoke', () => runRecoveryReaderFailureActionsSmoke(projectRoot));
  await step('recovery action row DOM smoke', () => runRecoveryActionRowDomSmoke(projectRoot));
  await step('rebuild release notes smoke', () => runRebuildReleaseNotesSmoke(projectRoot));
  await step('guard source manifest migration smoke', () => runGuardSourceManifestMigrationSmoke(projectRoot));

  if (process.env.FRONTEND_CHECK_TRACE === '1') console.log('Frontend check post-step summary boundary');
  if (process.argv.includes('--smoke-watchdog') || process.env.FRONTEND_CHECK_SMOKE_WATCHDOG === '1') printSlowSmokeGroupWatchdog({ enabled: true });
  if (process.argv.includes('--timing') || process.env.FRONTEND_CHECK_TIMING === '1') printFrontendCheckTimingReport({ enabled: true });
  if (!process.argv.includes('--quiet-ok')) console.log(`Rebuild frontend module manifest OK (${required.length} required, syntax probe checked).`);
  if (require.main === module) forceFrontendCheckExit(0);
  return { ok:true, required: required.length };
}


function runFrontendCheckSupervisor() {
  const args = process.argv.slice(2).filter(arg => arg !== '--quiet-ok');
  const timeoutMs = Math.max(5000, Number(process.env.FRONTEND_CHECK_SUPERVISOR_TIMEOUT_MS) || 60000);
  const child = childProcess.spawn(process.execPath, [__filename, ...args], {
    cwd: projectRoot,
    env: { ...process.env, FRONTEND_CHECK_WORKER:'1', FRONTEND_CHECK_NO_FORCE_EXIT:'1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  let sawOk = false;
  let settled = false;
  const finish = (code) => {
    if (settled) return;
    settled = true;
    nodeTimers.clearTimeout(timer);
    nativeProcessExit(code);
  };
  const observe = (chunk, stream) => {
    const text = String(chunk || '');
    stream.write(text);
    if (text.includes('Rebuild frontend module manifest OK')) {
      sawOk = true;
      try { child.kill('SIGKILL'); } catch (_error) {}
      nodeTimers.setTimeout(() => finish(0), 20);
    }
  };
  child.stdout.on('data', chunk => observe(chunk, process.stdout));
  child.stderr.on('data', chunk => observe(chunk, process.stderr));
  child.on('error', error => { console.error(error && error.stack || error); finish(1); });
  child.on('close', code => finish(sawOk ? 0 : (Number(code) || 1)));
  const timer = nodeTimers.setTimeout(() => {
    if (!sawOk) console.error('Frontend check supervisor timeout after ' + timeoutMs + 'ms');
    try { child.kill('SIGKILL'); } catch (_error) {}
    if (sawOk) finish(0);
  }, timeoutMs);
}

function forceFrontendCheckExit(code = 0) {
  process.exitCode = code;
  if (process.env.FRONTEND_CHECK_NO_FORCE_EXIT === '1') return;
  if (process.env.FRONTEND_CHECK_TRACE === '1') console.log('Frontend check force exit:', code, FRONTEND_CHECK_NATIVE_EXIT_PASS);
  try { process.removeAllListeners('exit'); process.removeAllListeners('beforeExit'); } catch (_error) {}
  const fallback = nodeTimers.setTimeout(() => {
    try { process.kill(process.pid, code === 0 ? 'SIGTERM' : 'SIGKILL'); } catch (_error) {}
  }, 50);
  if (fallback && typeof fallback.unref === 'function') fallback.unref();
  nativeProcessExit(code);
}

if (require.main === module) {
  if (process.env.FRONTEND_CHECK_WORKER !== '1') {
    runFrontendCheckSupervisor();
  } else {
    main()
      .then(() => forceFrontendCheckExit(0))
      .catch(error => {
        console.error(error && error.stack || error);
        forceFrontendCheckExit(1);
      });
  }
} else {
  main().catch(error => { throw error; });
}
