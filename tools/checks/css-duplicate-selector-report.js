const CSS_DUPLICATE_SELECTOR_REPORT_PASS = 'v202-css-duplicate-selector-report-pass';

const DEFAULT_DUPLICATE_AUDIT_SELECTORS = [
  '#recovery-center-overlay',
  '#recovery-center-modal',
  '#search-nav-remote',
  '#safe-area-bar',
  '#nsearch-overlay',
  '#settings-panel',
  '#content',
  '#novel-list',
  '.recovery-section-title',
  '.recovery-cache-subtitle',
  '.nsearch-chunk-detail-row',
  '.safe-profile-summary',
  '.setting-block',
  '.devdbg-btn'
];

function countSelectorOccurrences(source, selector) {
  return String(source || '').split(selector).length - 1;
}

function buildCssDuplicateSelectorAuditReport(source, selectors = DEFAULT_DUPLICATE_AUDIT_SELECTORS) {
  const entries = selectors.map((selector) => ({ selector, count: countSelectorOccurrences(source, selector) }));
  return {
    pass: CSS_DUPLICATE_SELECTOR_REPORT_PASS,
    totalSelectors: entries.length,
    missing: entries.filter((entry) => entry.count < 1).map((entry) => entry.selector),
    highCount: entries.filter((entry) => entry.count > 120),
    entries
  };
}

module.exports = {
  CSS_DUPLICATE_SELECTOR_REPORT_PASS,
  DEFAULT_DUPLICATE_AUDIT_SELECTORS,
  buildCssDuplicateSelectorAuditReport,
  countSelectorOccurrences
};
