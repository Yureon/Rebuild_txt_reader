const FRONTEND_CHECK_THEME_DEVTOOLS_GUARDS_PASS = 'v184-frontend-check-theme-devtools-guards-pass';

function runThemeDevtoolsGuardChecks(ctx) {
  const {
    themeEditorSource,
    appearanceSource,
    themePresetsSource,
    devtoolsReportSource,
    devtoolsReportFormattersSource,
    devtoolsSource,
    devtoolsControlsSource,
    stateSource
  } = ctx;

['THEME_EDITOR_QUALITY_PASS','v162-theme-apply-pass','applyThemeColors(colors)','document.body','Graphite Amber','Charcoal Amber'].forEach((marker) => {
  if (!themeEditorSource.includes(marker) && !appearanceSource.includes(marker) && !themePresetsSource.includes(marker)) throw new Error('Missing v162 theme stabilization marker: ' + marker);
});
['DEVTOOLS_REPORT_PASS','v162-devtools-friendly-report','formatDevtoolsReport','collectDevtoolsOptionsFromInputs','summarizeDevtoolsOptions','./report-formatters.mjs'].forEach((marker) => {
  if (!devtoolsReportSource.includes(marker)) throw new Error('Missing v162/v195 devtools report marker: ' + marker);
});
['DEVTOOLS_REPORT_FORMATTERS_SPLIT_PASS','appendSection','buildErrorRows','summarizeConnection','summarizeObject'].forEach((marker) => {
  if (!devtoolsReportFormattersSource.includes(marker)) throw new Error('Missing v195 devtools report formatter marker: ' + marker);
});
['setupDevtoolsReportControls','devtoolsReportOptions','formatDevtoolsReport(app, snapshot, options)','DEVTOOLS_REPORT_PASS'].forEach((marker) => {
  if (!(devtoolsSource + '\n' + devtoolsControlsSource).includes(marker)) throw new Error('Missing v162 devtools wiring marker: ' + marker);
});
['v161-refactor-safety-net-pass','v161-extraction-readiness-pass','v157-recovery-search-diagnostics-extraction-pass','v158-recovery-cache-diagnostics-extraction-pass','v159-recovery-library-diagnostics-extraction-pass','refactorSafetyNetPass','extractionReadinessPass','recoverySearchDiagnosticsExtractionPass','recoveryCacheDiagnosticsExtractionPass','recoveryLibraryDiagnosticsExtractionPass','recoveryManualReviewBundleExtractionPass','recoveryExportUtilsExtractionPass','v161-recovery-export-utils-extraction-pass'].forEach((marker) => {
  if (!stateSource.includes(marker)) throw new Error('Missing v161 state/readiness marker: ' + marker);
});
}

module.exports = {
  FRONTEND_CHECK_THEME_DEVTOOLS_GUARDS_PASS,
  runThemeDevtoolsGuardChecks
};
