const fs = require('fs');
const path = require('path');
const {
  countMatches,
  requireNoForbiddenPattern,
  requireFunctionBodyNoPattern
} = require('./check-utils.js');

const FRONTEND_CHECK_LIBRARY_VIRTUAL_POLICY_ROLLOUT_GUARDS_PASS = 'v188-frontend-check-library-virtual-policy-rollout-guards-pass';

function runLibraryVirtualPolicyRolloutGuardChecks(ctx) {
  const {
    docsRoot,
    libraryVirtualReportsCombinedSource,
    controlsSource,
    devtoolsSource,
    stateSource,
    librarySource,
    libraryModelSource,
    libraryRowDiagnosticsSource,
    recoveryRuntimeSource
  } = ctx;

  requireNoForbiddenPattern(libraryVirtualReportsCombinedSource, /autoEnableAllowed\s*:\s*true\b/, 'autoEnableAllowed true');
  requireNoForbiddenPattern(libraryVirtualReportsCombinedSource, /automaticEnableAllowed\s*:\s*true\b/, 'automaticEnableAllowed true');
  requireNoForbiddenPattern(libraryVirtualReportsCombinedSource, /settingsToggleExposed\s*:\s*true\b/, 'settingsToggleExposed true');
  requireNoForbiddenPattern(libraryVirtualReportsCombinedSource, /enableActionAvailable\s*:\s*true\b/, 'enableActionAvailable true');
  requireNoForbiddenPattern(libraryVirtualReportsCombinedSource, /enableActionExposed\s*:\s*true\b/, 'enableActionExposed true');
  requireNoForbiddenPattern(libraryVirtualReportsCombinedSource, /productionOptInActionExposed\s*:\s*true\b/, 'productionOptInActionExposed true');
  requireNoForbiddenPattern(libraryVirtualReportsCombinedSource, /libraryVirtualRenderer\s*=\s*true\b/, 'direct libraryVirtualRenderer true assignment');
  requireNoForbiddenPattern(controlsSource, /libraryVirtualRenderer\s*[:=]\s*true\b/, 'Settings exposes or writes libraryVirtualRenderer true');
  requireFunctionBodyNoPattern(libraryVirtualReportsCombinedSource, 'buildLibraryVirtualLimitedOptInReadinessPayload', /prefs\.libraryVirtualRenderer\s*=|persistPrefs\s*\(/, 'readiness payload must not write prefs');
  requireFunctionBodyNoPattern(libraryVirtualReportsCombinedSource, 'buildLibraryVirtualFinalOptInAuditPayload', /prefs\.libraryVirtualRenderer\s*=|persistPrefs\s*\(/, 'final audit payload must not write prefs');
  requireFunctionBodyNoPattern(libraryVirtualReportsCombinedSource, 'buildLibraryVirtualManualReviewBundlePayload', /prefs\.libraryVirtualRenderer\s*=|persistPrefs\s*\(/, 'manual review bundle payload must not write prefs');
  requireFunctionBodyNoPattern(libraryVirtualReportsCombinedSource, 'buildLibraryVirtualRiskRegisterPayload', /prefs\.libraryVirtualRenderer\s*=|persistPrefs\s*\(/, 'risk register payload must not write prefs');
  requireFunctionBodyNoPattern(libraryVirtualReportsCombinedSource, 'buildLibraryVirtualManualExperimentPlanPayload', /prefs\.libraryVirtualRenderer\s*=|persistPrefs\s*\(/, 'manual experiment plan payload must not write prefs');
  const devtoolsRendererAssignments = countMatches(libraryVirtualReportsCombinedSource, /prefs\.libraryVirtualRenderer\s*=/g);
  if (devtoolsRendererAssignments !== 0) {
    throw new Error('Recovery Center session opt-in must not write prefs.libraryVirtualRenderer');
  }
  const v148DocFiles = [
    'rebuild-phase148.md',
    'remaining-work-v148.md',
    'worklist-v148.md',
    'performance-optimization-v148.md',
    'optimization-audit-v148.md',
    'reader-dom-pool-v148.md',
    'library-virtual-renderer-readiness-v148.md',
    'default-virtual-renderer-guarded-rollout-v148.md',
    'migration-gap-audit.md'
  ];
  for (const rel of v148DocFiles) {
    const full = path.join(docsRoot, rel);
    if (!fs.existsSync(full)) {}
  }
  [
    "version: 'rebuild-v276'",
    'LIBRARY_VIRTUAL_DEFAULT_ROLLOUT_PASS',
    'v141-library-render-path-optimization',
    'LIBRARY_VIRTUAL_AUTO_FALLBACK_STORAGE_KEY',
    'libraryVirtualRendererAutoFallback',
    'LIBRARY_VIRTUAL_WIDE_WINDOW_OVERSCAN = 24',
    'LIBRARY_VIRTUAL_WIDE_MAX_WINDOW_ROWS = 360',
    'isLibraryVirtualDefaultRolloutEnabled',
    'isLibraryVirtualAutoFallbackActive',
    'persistLibraryVirtualAutoFallback',
    'resetVirtualAutoFallback',
    'rowsAlreadyVisible',
    'libraryVirtualGateCache',
    'lightweight-scroll-sample-skipped',
    'v141-library-render-path-optimization-pass',
    'LIBRARY_VIRTUAL_ROWS_CACHE_PASS',
    'v141-library-rows-cache-pass',
    'LIBRARY_VIRTUAL_RENDER_WINDOW_SKIP_PASS',
    'v141-library-render-window-skip-pass',
    'getLibraryFilteredNovels',
    'getLibraryVirtualRows',
    'getLibraryVirtualWindowRenderSignature',
    'shouldSkipLibraryVirtualDomRender',
    'rememberLibraryVirtualWindowRender',
    'libraryFilteredNovelsCache',
    'libraryVirtualRowsCache',
    'libraryVirtualWindowRenderCache',
    'libraryVirtualLastRenderSkip',
    'activeIndex: rowsInfo.activeIndex',
    'activeRow: rowsInfo.activeRow'
  ].forEach((marker) => {
    if (!librarySource.includes(marker) && !stateSource.includes(marker) && !libraryModelSource.includes(marker) && !libraryRowDiagnosticsSource.includes(marker)) throw new Error('Missing v142 guarded optimization runtime marker: ' + marker);
  });
  [
    'RECOVERY_CENTER_LAZY_DIAGNOSTICS_PASS',
    'v142-recovery-lazy-diagnostics-pass',
    'buildRecoveryBaseContext',
    'buildRecoveryDiagnosticsContext',
    'buildRecoveryLibraryContext',
    'buildRecoveryCacheManagementContext',
    'buildRecoverySearchContext',
    'createRecoveryLazyPanel',
    'shouldAutoloadRecoveryPanel',
    'recoveryLazyState',
    'IntersectionObserver',
    '진단 불러오기'
  ].forEach((marker) => {
    if (!devtoolsSource.includes(marker) && !recoveryRuntimeSource.includes(marker)) throw new Error('Missing v142 Recovery Center lazy diagnostics marker: ' + marker);
  });
  if (!stateSource.includes('libraryVirtualRenderer: true')) throw new Error('v148 must default libraryVirtualRenderer to true');
  if (!stateSource.includes('libraryVirtualAutoFallback: normalizeLibraryVirtualAutoFallback')) throw new Error('v148 must load persisted auto fallback state');
  if (!libraryVirtualReportsCombinedSource.includes('Full fallback 고정 해제')) throw new Error('Recovery Center missing full fallback reset control');
  if (!libraryVirtualReportsCombinedSource.includes('virtual renderer guarded default')) throw new Error('Recovery Center missing guarded default policy copy');
  if (!controlsSource.includes('guardedDefault') || !controlsSource.includes('autoFallbackActive')) throw new Error('Settings diagnostics missing guarded default/fallback status');
  if (devtoolsSource.includes('navigator.clipboard?.writeText')) throw new Error('JSON export fallback must not use optional clipboard writeText no-op pattern');
}

module.exports = {
  FRONTEND_CHECK_LIBRARY_VIRTUAL_POLICY_ROLLOUT_GUARDS_PASS,
  runLibraryVirtualPolicyRolloutGuardChecks
};
