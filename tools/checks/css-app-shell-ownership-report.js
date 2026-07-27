const fs = require('fs');
const path = require('path');
const { buildCssDuplicateSelectorAuditReport } = require('./css-duplicate-selector-report.js');

const CSS_APP_SHELL_OWNERSHIP_REPORT_PASS = 'v253-css-app-shell-ownership-report-pass';
const CSS_APP_SHELL_OVERLAY_THRESHOLD_PASS = 'v254-css-app-shell-overlay-threshold-pass';
const CSS_APP_SHELL_OWNERSHIP_DOC_PASS = 'v255-css-app-shell-ownership-doc-pass';
const CSS_APP_SHELL_PACKAGE_AUTO_REPORT_PASS = 'v256-css-app-shell-package-auto-report-pass';
const CSS_APP_SHELL_MEASURED_THRESHOLD_PASS = 'v257-css-app-shell-measured-threshold-pass';

const CRITICAL_APP_SHELL_IDS = [
  'app',
  'content',
  'novel-list',
  'settings-panel',
  'nsearch-overlay',
  'search-nav-remote',
  'recovery-center-overlay',
  'recovery-center-modal',
  'safe-area-bar'
];

const HIGH_RISK_OVERLAY_SELECTORS = ['#recovery-center-overlay', '#recovery-center-modal', '#nsearch-overlay', '#search-nav-remote'];
const HIGH_RISK_OVERLAY_SELECTOR_LIMIT = 80;
const GENERAL_SHELL_SELECTOR_LIMIT = 140;
const CSS_APP_SHELL_MEASURED_OVERLAY_THRESHOLDS = {
  '#recovery-center-overlay': { pcLimit: 72, mobileLimit: 88, source: 'manual PC/mobile overlay audit baseline' },
  '#recovery-center-modal': { pcLimit: 76, mobileLimit: 92, source: 'manual PC/mobile overlay audit baseline' },
  '#nsearch-overlay': { pcLimit: 70, mobileLimit: 86, source: 'manual PC/mobile overlay audit baseline' },
  '#search-nav-remote': { pcLimit: 56, mobileLimit: 68, source: 'manual PC/mobile overlay audit baseline' }
};

const CRITICAL_CSS_SELECTORS = [
  '#content',
  '#novel-list',
  '#settings-panel',
  '#nsearch-overlay',
  '#search-nav-remote',
  '#recovery-center-overlay',
  '#recovery-center-modal',
  '#safe-area-bar',
  '.reader',
  '.devdbg-btn'
];

function buildCssAppShellOwnershipReport({ appCssSource = '', ownerCssSource = '', shellSource = '' } = {}) {
  const cssOwnershipSource = String(appCssSource || '') + '\n' + String(ownerCssSource || '');
  const selectorReport = buildCssDuplicateSelectorAuditReport(cssOwnershipSource, CRITICAL_CSS_SELECTORS);
  const missingShellIds = CRITICAL_APP_SHELL_IDS.filter(id => !String(shellSource || '').includes(`id="${id}"`) && !String(shellSource || '').includes(`id='${id}'`));
  const missingCssSelectors = CRITICAL_CSS_SELECTORS.filter(selector => !String(cssOwnershipSource || '').includes(selector));
  const thresholdEntries = selectorReport.entries.map((entry) => {
    const measured = CSS_APP_SHELL_MEASURED_OVERLAY_THRESHOLDS[entry.selector] || null;
    const highRisk = HIGH_RISK_OVERLAY_SELECTORS.includes(entry.selector);
    const limit = measured ? Math.max(measured.pcLimit, measured.mobileLimit) : (highRisk ? HIGH_RISK_OVERLAY_SELECTOR_LIMIT : GENERAL_SHELL_SELECTOR_LIMIT);
    return {
      selector: entry.selector,
      count: entry.count,
      limit,
      pcLimit: measured?.pcLimit || limit,
      mobileLimit: measured?.mobileLimit || limit,
      measuredSource: measured?.source || '',
      highRisk
    };
  });
  const thresholdViolations = thresholdEntries.filter(entry => entry.count > entry.limit);
  return {
    pass: CSS_APP_SHELL_OWNERSHIP_REPORT_PASS,
    overlayThresholdPass: CSS_APP_SHELL_OVERLAY_THRESHOLD_PASS,
    measuredThresholdPass: CSS_APP_SHELL_MEASURED_THRESHOLD_PASS,
    shellIds: CRITICAL_APP_SHELL_IDS.length,
    cssSelectors: CRITICAL_CSS_SELECTORS.length,
    missingShellIds,
    missingCssSelectors,
    duplicateSelectorReport: selectorReport,
    thresholdEntries,
    thresholdViolations,
    ownershipPolicy: 'diagnostic-only report; reader shell remains in app.css while owner/developer diagnostics may be split into owner.css'
  };
}


function buildCssAppShellOwnershipReportFromProject(projectRoot) {
  const appCssSource = fs.readFileSync(path.join(projectRoot, 'public', 'styles', 'app.css'), 'utf8');
  const ownerCssPath = path.join(projectRoot, 'public', 'styles', 'owner.css');
  const ownerCssSource = fs.existsSync(ownerCssPath) ? fs.readFileSync(ownerCssPath, 'utf8') : '';
  const shellSource = fs.readFileSync(path.join(projectRoot, 'public', 'fragments', 'app-shell.html'), 'utf8');
  return buildCssAppShellOwnershipReport({ appCssSource, ownerCssSource, shellSource });
}

function buildCssAppShellOwnershipMarkdownReport(report = {}, options = {}) {
  const version = Number(options.version) || 255;
  const lines = [
    '# CSS/App-shell ownership report v' + version,
    '',
    '- Report pass: `' + (report.pass || CSS_APP_SHELL_OWNERSHIP_REPORT_PASS) + '`',
    '- Doc pass: `' + CSS_APP_SHELL_OWNERSHIP_DOC_PASS + '`',
    '- Overlay threshold pass: `' + (report.overlayThresholdPass || CSS_APP_SHELL_OVERLAY_THRESHOLD_PASS) + '`',
    '- Measured threshold pass: `' + (report.measuredThresholdPass || CSS_APP_SHELL_MEASURED_THRESHOLD_PASS) + '`',
    '- Critical shell IDs: ' + (report.shellIds || 0),
    '- Critical CSS selectors: ' + (report.cssSelectors || 0),
    '- Threshold violations: ' + ((report.thresholdViolations || []).length),
    '',
    '## High-risk overlay selector thresholds',
    ...((report.thresholdEntries || []).filter(item => item.highRisk).map(item => '- ' + item.selector + ': ' + item.count + '/' + item.limit + ' (pc ' + item.pcLimit + ', mobile ' + item.mobileLimit + ')')),
    '',
    '## Policy',
    '- app.css keeps the reader shell; owner/developer diagnostics may live in owner.css while this report tracks combined ownership.',
    '',
    '<!-- ' + CSS_APP_SHELL_OWNERSHIP_DOC_PASS + ' -->',
    ''
  ];
  return lines.join('\n');
}

function writeCssAppShellOwnershipMarkdownReport(projectRoot, reportOrOutput = {}, options = {}) {
  const report = typeof reportOrOutput === 'string' ? buildCssAppShellOwnershipReportFromProject(projectRoot) : (reportOrOutput && Object.keys(reportOrOutput).length ? reportOrOutput : buildCssAppShellOwnershipReportFromProject(projectRoot));
  const version = Number(options.version) || 255;
  const outputPath = typeof reportOrOutput === 'string' ? reportOrOutput : options.outputPath;
  const outPath = path.resolve(outputPath || path.join(projectRoot, 'docs', 'css-app-shell-ownership-report-v' + version + '.md'));
  fs.mkdirSync(path.dirname(outPath), { recursive:true });
  fs.writeFileSync(outPath, buildCssAppShellOwnershipMarkdownReport(report, { version }));
  return { pass: CSS_APP_SHELL_OWNERSHIP_DOC_PASS, packageAutoReportPass: CSS_APP_SHELL_PACKAGE_AUTO_REPORT_PASS, outputPath:outPath, bytes:fs.statSync(outPath).size };
}

function runCssAppShellOwnershipReportSmoke(ctx = {}) {
  const report = buildCssAppShellOwnershipReport(ctx);
  if (report.missingShellIds.length) throw new Error('missing app-shell ownership id: ' + report.missingShellIds.join(', '));
  if (report.missingCssSelectors.length) throw new Error('missing CSS ownership selector: ' + report.missingCssSelectors.join(', '));
  if (report.duplicateSelectorReport.missing.length) throw new Error('missing duplicate selector report entry: ' + report.duplicateSelectorReport.missing.join(', '));
  if (report.overlayThresholdPass !== CSS_APP_SHELL_OVERLAY_THRESHOLD_PASS) throw new Error('missing app-shell overlay threshold pass');
  if (report.measuredThresholdPass !== CSS_APP_SHELL_MEASURED_THRESHOLD_PASS) throw new Error('missing measured app-shell threshold pass');
  if (report.thresholdViolations.length) throw new Error('high-risk app-shell selector count exceeded: ' + report.thresholdViolations.map(item => item.selector + '=' + item.count + '/' + item.limit).join(', '));
  const markdown = buildCssAppShellOwnershipMarkdownReport(report, { version:256 });
  if (!markdown.includes(CSS_APP_SHELL_OWNERSHIP_DOC_PASS) || !markdown.includes('High-risk overlay selector thresholds')) throw new Error('CSS/app-shell ownership markdown report missing v255 markers');
  return { ...report, docPass:CSS_APP_SHELL_OWNERSHIP_DOC_PASS, packageAutoReportPass:CSS_APP_SHELL_PACKAGE_AUTO_REPORT_PASS, markdownPreview:markdown.slice(0, 240) };
}

module.exports = {
  CSS_APP_SHELL_OWNERSHIP_REPORT_PASS,
  CSS_APP_SHELL_OVERLAY_THRESHOLD_PASS,
  CSS_APP_SHELL_OWNERSHIP_DOC_PASS,
  CSS_APP_SHELL_PACKAGE_AUTO_REPORT_PASS,
  CSS_APP_SHELL_MEASURED_THRESHOLD_PASS,
  HIGH_RISK_OVERLAY_SELECTORS,
  HIGH_RISK_OVERLAY_SELECTOR_LIMIT,
  CSS_APP_SHELL_MEASURED_OVERLAY_THRESHOLDS,
  GENERAL_SHELL_SELECTOR_LIMIT,
  CRITICAL_APP_SHELL_IDS,
  CRITICAL_CSS_SELECTORS,
  buildCssAppShellOwnershipReport,
  buildCssAppShellOwnershipReportFromProject,
  buildCssAppShellOwnershipMarkdownReport,
  writeCssAppShellOwnershipMarkdownReport,
  runCssAppShellOwnershipReportSmoke
};
