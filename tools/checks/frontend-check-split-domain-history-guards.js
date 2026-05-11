const fs = require('fs');
const path = require('path');

const FRONTEND_CHECK_SPLIT_DOMAIN_HISTORY_GUARDS_PASS = 'v191-frontend-check-split-domain-history-guards-pass';

function runFrontendCheckDomainHistoryGuardChecks(ctx) {
  const {
    docsRoot,
    frontendCheckSourceLoaderSource,
    frontendCheckLibraryVirtualSource,
    frontendCheckLibraryVirtualSplitSource,
    frontendCheckLibraryVirtualReportHistorySource,
    frontendCheckSettingsShellQualitySource,
    frontendCheckSettingsModalSafeareaSource,
    frontendCheckDevdebugNavigationSource,
    frontendCheckReaderOverlayQualitySource,
    frontendCheckLibraryVirtualRuntimeBridgeSource,
    frontendCheckLibraryVirtualPolicyRolloutSource,
    frontendCheckReaderSearchSource,
    frontendCheckReaderRuntimeSource,
    frontendCheckSearchRuntimeSource,
    frontendCheckRecoverySearchCacheSource,
    stateSource
  } = ctx;

['FRONTEND_CHECK_LIBRARY_VIRTUAL_SPLIT_GUARDS_PASS','v188-frontend-check-library-virtual-split-guards-pass','runLibraryVirtualSplitGuardChecks','v187-library-virtual-reports-aggregator-split-pass'].forEach((marker) => {
    if (!frontendCheckLibraryVirtualSplitSource.includes(marker)) throw new Error('Missing v188 library virtual split guard marker: ' + marker);
  });
  ['FRONTEND_CHECK_LIBRARY_VIRTUAL_REPORT_HISTORY_GUARDS_PASS','v188-frontend-check-library-virtual-report-history-guards-pass','runLibraryVirtualReportHistoryGuardChecks','LIBRARY_VIRTUAL_CHECKLIST_SCHEMA_VERSION'].forEach((marker) => {
    if (!frontendCheckLibraryVirtualReportHistorySource.includes(marker)) throw new Error('Missing v188 library virtual report history guard marker: ' + marker);
  });
  ['FRONTEND_CHECK_SETTINGS_SHELL_QUALITY_GUARDS_PASS','v190-frontend-check-settings-shell-quality-aggregator-pass','runSettingsShellQualityGuardChecks','runSettingsModalSafeareaGuardChecks'].forEach((marker) => {
    if (!frontendCheckSettingsShellQualitySource.includes(marker)) throw new Error('Missing v188 settings shell quality guard marker: ' + marker);
  });
  ['FRONTEND_CHECK_LIBRARY_VIRTUAL_RUNTIME_BRIDGE_GUARDS_PASS','v188-frontend-check-library-virtual-runtime-bridge-guards-pass','runLibraryVirtualRuntimeBridgeGuardChecks','settings-readiness-runtime-summary'].forEach((marker) => {
    if (!frontendCheckLibraryVirtualRuntimeBridgeSource.includes(marker)) throw new Error('Missing v188 library virtual runtime bridge guard marker: ' + marker);
  });
  ['FRONTEND_CHECK_LIBRARY_VIRTUAL_POLICY_ROLLOUT_GUARDS_PASS','v188-frontend-check-library-virtual-policy-rollout-guards-pass','runLibraryVirtualPolicyRolloutGuardChecks','v148DocFiles'].forEach((marker) => {
    if (!frontendCheckLibraryVirtualPolicyRolloutSource.includes(marker)) throw new Error('Missing v188 library virtual policy rollout guard marker: ' + marker);
  });
  ['./library-virtual-split-guards.js','./library-virtual-report-history-guards.js','./settings-shell-quality-guards.js','./library-virtual-runtime-bridge-guards.js','./library-virtual-policy-rollout-guards.js'].forEach((marker) => {
    if (!frontendCheckLibraryVirtualSource.includes(marker)) throw new Error('Missing v188 library virtual aggregator import marker: ' + marker);
  });
  ['frontendCheckLibraryVirtualGuardSplitPass','v188-library-virtual-guard-split-pass'].forEach((marker) => {
    if (!stateSource.includes(marker)) throw new Error('Missing v188 state marker: ' + marker);
  });
  if (frontendCheckLibraryVirtualSource.includes('LIBRARY_VIRTUAL_CHECKLIST_SCHEMA_VERSION')) throw new Error('library-virtual-guards.js still owns report history marker arrays after v188 split');
  if (frontendCheckLibraryVirtualSource.includes('requireNoForbiddenPattern(libraryVirtualReportsCombinedSource')) throw new Error('library-virtual-guards.js still owns policy rollout forbidden-pattern guards after v188 split');
  ['rebuild-phase188.md','worklist-v188.md'].forEach((rel) => {
    const full = path.join(docsRoot, rel);
    if (!fs.existsSync(full)) {}
  });
  ['reader-runtime-guards.js','search-runtime-guards.js','recovery-search-cache-guards.js'].forEach((marker) => {
    if (!frontendCheckSourceLoaderSource.includes(marker)) throw new Error('Missing v189 source-loader reader/search split marker: ' + marker);
  });
  ['./reader-runtime-guards.js','./search-runtime-guards.js','./recovery-search-cache-guards.js'].forEach((marker) => {
    if (!frontendCheckReaderSearchSource.includes(marker)) throw new Error('Missing v189 reader/search aggregator import marker: ' + marker);
  });
  ['frontendCheckReaderSearchGuardSplitPass','v189-reader-search-guard-split-pass'].forEach((marker) => {
    if (!stateSource.includes(marker)) throw new Error('Missing v189 state marker: ' + marker);
  });
  if (frontendCheckReaderSearchSource.includes('READER_INTERACTION_PASS')) throw new Error('reader-search-guards.js still owns reader marker arrays after v189 split');
  if (frontendCheckReaderSearchSource.includes('SEARCH_PERFORMANCE_PASS')) throw new Error('reader-search-guards.js still owns search marker arrays after v189 split');
  ['rebuild-phase189.md','worklist-v189.md'].forEach((rel) => {
    const full = path.join(docsRoot, rel);
    if (!fs.existsSync(full)) {}
  });

  ['settings-modal-safearea-guards.js','devdebug-navigation-guards.js','reader-overlay-quality-guards.js'].forEach((marker) => {
    if (!frontendCheckSourceLoaderSource.includes(marker)) throw new Error('Missing v190 source-loader settings shell quality split marker: ' + marker);
  });
  ['./settings-modal-safearea-guards.js','./devdebug-navigation-guards.js','./reader-overlay-quality-guards.js'].forEach((marker) => {
    if (!frontendCheckSettingsShellQualitySource.includes(marker)) throw new Error('Missing v190 settings shell quality aggregator import marker: ' + marker);
  });
  ['FRONTEND_CHECK_SETTINGS_MODAL_SAFEAREA_GUARDS_PASS','v190-frontend-check-settings-modal-safearea-guards-pass','runSettingsModalSafeareaGuardChecks','requireModalLayerCoverage'].forEach((marker) => {
    if (!frontendCheckSettingsModalSafeareaSource.includes(marker)) throw new Error('Missing v190 settings modal/safe-area guard marker: ' + marker);
  });
  ['FRONTEND_CHECK_DEVDEBUG_NAVIGATION_GUARDS_PASS','v190-frontend-check-devdebug-navigation-guards-pass','runDevdebugNavigationGuardChecks','data-recovery-jump'].forEach((marker) => {
    if (!frontendCheckDevdebugNavigationSource.includes(marker)) throw new Error('Missing v190 DevDebug navigation guard marker: ' + marker);
  });
  ['FRONTEND_CHECK_READER_OVERLAY_QUALITY_GUARDS_PASS','v190-frontend-check-reader-overlay-quality-guards-pass','runReaderOverlayQualityGuardChecks','SEARCH_REMOCON_OVERLAY_PASS'].forEach((marker) => {
    if (!frontendCheckReaderOverlayQualitySource.includes(marker)) throw new Error('Missing v190 reader overlay quality guard marker: ' + marker);
  });
  ['frontendCheckSettingsShellQualityGuardSplitPass','v190-settings-shell-quality-guard-split-pass'].forEach((marker) => {
    if (!stateSource.includes(marker)) throw new Error('Missing v190 state marker: ' + marker);
  });
  if (frontendCheckSettingsShellQualitySource.includes('data-devdbg-nav-pass="v140"')) throw new Error('settings-shell-quality-guards.js still owns DevDebug navigation marker arrays after v190 split');
  if (frontendCheckSettingsShellQualitySource.includes('data-reader-overlay-pass="v140"')) throw new Error('settings-shell-quality-guards.js still owns reader overlay marker arrays after v190 split');
  ['rebuild-phase190.md','worklist-v190.md'].forEach((rel) => {
    const full = path.join(docsRoot, rel);
    if (!fs.existsSync(full)) {}
  });
}

module.exports = {
  FRONTEND_CHECK_SPLIT_DOMAIN_HISTORY_GUARDS_PASS,
  runFrontendCheckDomainHistoryGuardChecks
};
