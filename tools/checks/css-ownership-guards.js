const { buildCssDuplicateSelectorAuditReport, CSS_DUPLICATE_SELECTOR_REPORT_PASS } = require('./css-duplicate-selector-report.js');
const FRONTEND_CHECK_CSS_OWNERSHIP_GUARDS_PASS = 'v197-css-ownership-guard-pass';

function runCssOwnershipGuardChecks(ctx) {
  const { appCssSource, ownerCssSource = '' } = ctx;
  const splitOwnerCssSource = ownerCssSource || '';
  const cssOwnershipSource = appCssSource + '\n' + splitOwnerCssSource;
  [
    'v196-css-ownership-index-pass',
    'v197-css-ownership-guard-pass',
    'v198-css-ownership-hardening-pass',
    'v200-css-duplicate-selector-audit-pass',
    'v201-css-duplicate-selector-guard-hardening-pass',
    'v202-css-duplicate-selector-report-pass',
    'v203-continuity-prompt-cadence-rule-pass',
    'v204-css-duplicate-selector-audit-doc-pass',
    'v205-css-audit-ownership-doc-extension-pass',
    'v206-css-duplicate-selector-audit-table-pass',
    'v207-css-audit-guard-rationale-pass',
    'v208-css-audit-report-maintenance-pass',
    'v209-css-audit-guard-maintenance-pass',
    'v210-css-duplicate-selector-threshold-doc-pass',
    'v211-css-service-boundary-audit-pass',
    'v212-css-maintenance-expanded-audit-pass',
    'v213-css-ownership-marker-refresh-pass',
    'v214-css-ownership-guard-refresh-pass',
    'v215-css-maintenance-marker-pass',
    'v216-css-maintenance-marker-pass',
    'v217-css-maintenance-marker-pass',
    'v218-css-ownership-guard-refresh-pass',
    'v219-css-ownership-guard-refresh-pass',
    'v220-css-ownership-guard-refresh-pass',
    'v221-css-ownership-guard-refresh-pass',
    'v222-css-ownership-checkpoint-continuity-pass',
    'Base/layout/library list',
    'Reader/safe area/navigation',
    'Search UI',
    'Settings/theme/safe-area controls',
    'Modal/layering policy'
  ].forEach((marker) => {
    if (!appCssSource.includes(marker)) throw new Error('Missing CSS ownership marker: ' + marker);
  });
  ['Recovery/devtools diagnostics', 'v503-owner-css-split-pass'].forEach((marker) => {
    if (!cssOwnershipSource.includes(marker)) throw new Error('Missing CSS ownership marker: ' + marker);
  });
  [
    '#search-nav-remote',
    '#safe-area-bar',
    '#nsearch-overlay',
    '#settings-panel',
    '#content',
    '#novel-list',
    '.reader',
    '.nsearch-chunk-detail-row'
  ].forEach((selector) => {
    if (!appCssSource.includes(selector)) throw new Error('Missing guarded CSS selector: ' + selector);
  });
  [
    '#recovery-center-overlay',
    '#recovery-center-modal',
    '.recovery-cache-subtitle'
  ].forEach((selector) => {
    if (!cssOwnershipSource.includes(selector)) throw new Error('Missing guarded CSS selector: ' + selector);
  });
  [
    '--z-reader-search-remocon',
    'body.modal-layer-open #search-nav-remote[data-reader-overlay-pass].open'
  ].forEach((marker) => {
    if (!appCssSource.includes(marker)) throw new Error('Missing guarded CSS layering marker: ' + marker);
  });
  ['z-index:230', 'z-index:231'].forEach((marker) => {
    if (!cssOwnershipSource.includes(marker)) throw new Error('Missing guarded CSS layering marker: ' + marker);
  });


  const report = buildCssDuplicateSelectorAuditReport(cssOwnershipSource);
  const thresholdPolicy = { pass:'v222-css-ownership-checkpoint-continuity-pass', strictLimit:80, relaxedLimit:120, inheritedFrom:'v210-css-duplicate-selector-threshold-doc-pass', maintainedFrom:'v221-css-ownership-guard-refresh-pass' };
  if (!thresholdPolicy.pass || !appCssSource.includes(thresholdPolicy.pass)) throw new Error('Missing CSS duplicate selector threshold policy marker');
  if (report.pass !== CSS_DUPLICATE_SELECTOR_REPORT_PASS) throw new Error('CSS duplicate selector report pass marker mismatch');
  if (report.missing.length) throw new Error('Missing CSS duplicate-audit selector: ' + report.missing.join(', '));
  const criticalDuplicateSelectors = new Set(['#recovery-center-overlay', '#recovery-center-modal', '#search-nav-remote', '#safe-area-bar', '#nsearch-overlay']);
  report.entries.forEach((entry) => {
    const strictLimit = criticalDuplicateSelectors.has(entry.selector) ? 80 : 120;
    if (entry.count > strictLimit) throw new Error('Unexpectedly high duplicate CSS selector count: ' + entry.selector + ' = ' + entry.count);
  });
}

module.exports = {
  FRONTEND_CHECK_CSS_OWNERSHIP_GUARDS_PASS,
  runCssOwnershipGuardChecks
};
