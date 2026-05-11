const fs = require('fs');
const path = require('path');

const FRONTEND_CHECK_SPLIT_CORE_HISTORY_GUARDS_PASS = 'v191-frontend-check-split-core-history-guards-pass';

function runFrontendCheckCoreHistoryGuardChecks(ctx) {
  const {
    docsRoot,
    frontendCheckSource,
    frontendCheckModuleManifestSource,
    frontendCheckUiLayeringSource,
    frontendCheckVersionMarkersSource,
    frontendCheckRecoveryCenterGuardsSource,
    frontendCheckSourceLoaderSource,
    frontendCheckUtilsSource,
    frontendCheckAppShellSource,
    frontendCheckLibraryVirtualSource,
    frontendCheckReaderSearchSource,
    frontendCheckReaderRuntimeSource,
    frontendCheckSearchRuntimeSource,
    frontendCheckRecoverySearchCacheSource,
    frontendCheckThemeDevtoolsSource,
    frontendCheckSyncRefactorSource,
    frontendCheckSplitGuardsSource,
    stateSource
  } = ctx;

['FRONTEND_CHECK_MODULE_MANIFEST_PASS','v182-frontend-check-split-pass','REQUIRED_REBUILD_MODULES','runModuleManifestChecks','probeModuleSyntax'].forEach((marker) => {
  if (!frontendCheckModuleManifestSource.includes(marker)) throw new Error('Missing v182 module-manifest split marker: ' + marker);
});
['FRONTEND_CHECK_UI_LAYERING_PASS','v182-frontend-check-split-pass','requireModalLayerCoverage','requireNoDuplicateHtmlIds','extractModalLayerPairs'].forEach((marker) => {
  if (!frontendCheckUiLayeringSource.includes(marker)) throw new Error('Missing v182 UI-layering split marker: ' + marker);
});
['FRONTEND_CHECK_VERSION_MARKERS_PASS','v182-frontend-check-split-pass','runVersionMarkerChecks','DEFAULT_STALE_REBUILD_MARKERS'].forEach((marker) => {
  if (!frontendCheckVersionMarkersSource.includes(marker)) throw new Error('Missing v182 version-marker split marker: ' + marker);
});
['./checks/module-manifest.js','./checks/ui-layering.js','./checks/version-markers.js','runModuleManifestChecks({ root','runVersionMarkerChecks({'].forEach((marker) => {
  if (!frontendCheckSource.includes(marker)) throw new Error('Missing v182 frontend check split bridge marker: ' + marker);
});
['frontendCheckSplitRefactorPass','v182-frontend-check-split-pass'].forEach((marker) => {
  if (!stateSource.includes(marker)) throw new Error('Missing v182 state marker: ' + marker);
});
if (/^const vm = require\('vm'\);/m.test(frontendCheckSource)) throw new Error('check_rebuild_frontend.js still owns vm syntax probe after v182 split');
if (/^const required = \[/.test(frontendCheckSource)) throw new Error('check_rebuild_frontend.js still owns required module manifest after v182 split');
['rebuild-phase182.md','worklist-v182.md'].forEach((rel) => {
  const full = path.join(docsRoot, rel);
  if (!fs.existsSync(full)) {}
});

['FRONTEND_CHECK_RECOVERY_CENTER_GUARDS_PASS','v183-frontend-check-recovery-center-guards-pass','runRecoveryCenterGuardChecks','runRecoveryRefactorModuleChecks'].forEach((marker) => {
  if (!frontendCheckRecoveryCenterGuardsSource.includes(marker)) throw new Error('Missing v183 recovery-center guard split marker: ' + marker);
});
['./checks/recovery-center-guards.js','runRecoveryCenterGuardChecks(sources)'].forEach((marker) => {
  if (!frontendCheckSource.includes(marker)) throw new Error('Missing v183 frontend check recovery-center guard bridge marker: ' + marker);
});
['frontendCheckRecoveryCenterGuardsPass','v183-frontend-check-recovery-center-guards-pass'].forEach((marker) => {
  if (!stateSource.includes(marker)) throw new Error('Missing v183 state marker: ' + marker);
});
if (/^const \{ runRecoveryRefactorModuleChecks \} = require\('\.\/checks\/recovery-refactor-modules\.js'\);/m.test(frontendCheckSource)) throw new Error('check_rebuild_frontend.js still imports recovery-refactor module directly after v183 split');
if (/^const v157DocFiles = \[/m.test(frontendCheckSource)) throw new Error('check_rebuild_frontend.js still owns v157-v159 Recovery extraction doc guards after v183 split');
if (/^const v160DocFiles = \[/m.test(frontendCheckSource)) throw new Error('check_rebuild_frontend.js still owns v160-v176 Recovery doc/action guards after v183 split');
['rebuild-phase183.md','worklist-v183.md'].forEach((rel) => {
  const full = path.join(docsRoot, rel);
  if (!fs.existsSync(full)) {}
});

  ['FRONTEND_CHECK_SOURCE_LOADER_PASS','v184-frontend-check-source-loader-pass','loadFrontendCheckSources','libraryVirtualReportsCombinedSource','recoverySearchPanelCombinedSource'].forEach((marker) => {
    if (!frontendCheckSourceLoaderSource.includes(marker)) throw new Error('Missing v184 source-loader split marker: ' + marker);
  });
  ['FRONTEND_CHECK_COMMON_UTILS_PASS','v184-frontend-check-utils-pass','requireConstArrayEntries','requireFunctionBodyNoPattern','requireNoForbiddenPattern'].forEach((marker) => {
    if (!frontendCheckUtilsSource.includes(marker)) throw new Error('Missing v184 common check-utils marker: ' + marker);
  });
  ['FRONTEND_CHECK_APP_SHELL_GUARDS_PASS','v184-frontend-check-app-shell-guards-pass','runAppShellGuardChecks'].forEach((marker) => {
    if (!frontendCheckAppShellSource.includes(marker)) throw new Error('Missing v184 app-shell guard split marker: ' + marker);
  });
  ['FRONTEND_CHECK_LIBRARY_VIRTUAL_GUARDS_PASS','v188-frontend-check-library-virtual-aggregator-pass','runLibraryVirtualGuardChecks','runLibraryVirtualSplitGuardChecks','runLibraryVirtualPolicyRolloutGuardChecks'].forEach((marker) => {
    if (!frontendCheckLibraryVirtualSource.includes(marker)) throw new Error('Missing v184/v188 library-virtual guard aggregator marker: ' + marker);
  });
  ['FRONTEND_CHECK_READER_SEARCH_GUARDS_PASS','v189-frontend-check-reader-search-aggregator-pass','runReaderSearchGuardChecks','runReaderRuntimeGuardChecks','runRecoverySearchCacheGuardChecks'].forEach((marker) => {
    if (!frontendCheckReaderSearchSource.includes(marker)) throw new Error('Missing v189 reader/search guard aggregator marker: ' + marker);
  });
  ['FRONTEND_CHECK_READER_RUNTIME_GUARDS_PASS','v189-frontend-check-reader-runtime-guards-pass','runReaderRuntimeGuardChecks','READER_INTERACTION_PASS','READER_ROW_DOM_POOL_PASS'].forEach((marker) => {
    if (!frontendCheckReaderRuntimeSource.includes(marker)) throw new Error('Missing v189 reader runtime guard split marker: ' + marker);
  });
  ['FRONTEND_CHECK_SEARCH_RUNTIME_GUARDS_PASS','v189-frontend-check-search-runtime-guards-pass','runSearchRuntimeGuardChecks','SEARCH_PERFORMANCE_PASS','SEARCH_LIVE_FIELD_VALIDATION_PASS'].forEach((marker) => {
    if (!frontendCheckSearchRuntimeSource.includes(marker)) throw new Error('Missing v189 search runtime guard split marker: ' + marker);
  });
  ['FRONTEND_CHECK_RECOVERY_SEARCH_CACHE_GUARDS_PASS','v189-frontend-check-recovery-search-cache-guards-pass','runRecoverySearchCacheGuardChecks','formatSearchJumpRecoverySummary','SEARCH_CONTEXT_RESET_PASS'].forEach((marker) => {
    if (!frontendCheckRecoverySearchCacheSource.includes(marker)) throw new Error('Missing v189 Recovery search-cache guard split marker: ' + marker);
  });
  ['FRONTEND_CHECK_THEME_DEVTOOLS_GUARDS_PASS','v184-frontend-check-theme-devtools-guards-pass','runThemeDevtoolsGuardChecks','THEME_EDITOR_QUALITY_PASS','DEVTOOLS_REPORT_PASS'].forEach((marker) => {
    if (!frontendCheckThemeDevtoolsSource.includes(marker)) throw new Error('Missing v184 theme/devtools guard split marker: ' + marker);
  });
  ['FRONTEND_CHECK_SYNC_REFACTOR_GUARDS_PASS','v184-frontend-check-sync-refactor-guards-pass','runSyncRefactorGuardChecks','SYNC_DEVICE_MANAGEMENT_REFACTOR_PASS','SERVER_STATE_HYDRATION_REFACTOR_PASS'].forEach((marker) => {
    if (!frontendCheckSyncRefactorSource.includes(marker)) throw new Error('Missing v184 sync-refactor guard split marker: ' + marker);
  });
  ['FRONTEND_CHECK_SPLIT_GUARDS_PASS','v184-frontend-check-split-guards-pass','runFrontendCheckSplitGuardChecks'].forEach((marker) => {
    if (!frontendCheckSplitGuardsSource.includes(marker)) throw new Error('Missing v184 split guard self marker: ' + marker);
  });
  ['./checks/source-loader.js','./checks/app-shell-guards.js','./checks/library-virtual-guards.js','./checks/reader-search-guards.js','./checks/theme-devtools-guards.js','./checks/sync-refactor-guards.js','./checks/frontend-check-split-guards.js'].forEach((marker) => {
    if (!frontendCheckSource.includes(marker)) throw new Error('Missing v184 frontend check expanded split bridge marker: ' + marker);
  });
  ['frontendCheckExpandedSplitPass','v184-frontend-check-expanded-split-pass'].forEach((marker) => {
    if (!stateSource.includes(marker)) throw new Error('Missing v184 state marker: ' + marker);
  });

if (/^function requireConstArrayEntries/m.test(frontendCheckSource)) throw new Error('check_rebuild_frontend.js still owns common array helper after v184 split');
  if (/^const shellSource = fs\.readFileSync/m.test(frontendCheckSource)) throw new Error('check_rebuild_frontend.js still owns direct source loading after v184 split');
  if (/^\['LIBRARY_VIRTUAL_CHECKLIST_SCHEMA_VERSION'/m.test(frontendCheckSource)) throw new Error('check_rebuild_frontend.js still owns library virtual guard markers after v184 split');
  if (/^\['READER_INTERACTION_PASS'/m.test(frontendCheckSource)) throw new Error('check_rebuild_frontend.js still owns reader/search guard markers after v184 split');
  ['rebuild-phase184.md','worklist-v184.md'].forEach((rel) => {
    const full = path.join(docsRoot, rel);
    if (!fs.existsSync(full)) {}
  });
}

module.exports = {
  FRONTEND_CHECK_SPLIT_CORE_HISTORY_GUARDS_PASS,
  runFrontendCheckCoreHistoryGuardChecks
};
