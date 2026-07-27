const { runFrontendCheckCoreHistoryGuardChecks } = require('./frontend-check-split-core-history-guards.js');
const { runFrontendCheckDomainHistoryGuardChecks } = require('./frontend-check-split-domain-history-guards.js');

const FRONTEND_CHECK_SPLIT_GUARDS_LEGACY_PASS = 'v184-frontend-check-split-guards-pass';
const FRONTEND_CHECK_SPLIT_GUARDS_PASS = 'v191-frontend-check-split-history-aggregator-pass';

function runFrontendCheckSplitGuardChecks(ctx) {
  const { frontendCheckSourceLoaderSource, frontendCheckSplitCoreHistorySource, frontendCheckSplitDomainHistorySource, stateSource } = ctx;

  runFrontendCheckCoreHistoryGuardChecks(ctx);
  runFrontendCheckDomainHistoryGuardChecks(ctx);

  ['frontend-check-split-core-history-guards.js','frontend-check-split-domain-history-guards.js'].forEach((marker) => {
    if (!frontendCheckSourceLoaderSource.includes(marker)) throw new Error('Missing v191 split-history source-loader marker: ' + marker);
  });
  ['FRONTEND_CHECK_SPLIT_CORE_HISTORY_GUARDS_PASS','runFrontendCheckCoreHistoryGuardChecks'].forEach((marker) => {
    if (!frontendCheckSplitCoreHistorySource.includes(marker)) throw new Error('Missing v191 core split-history guard marker: ' + marker);
  });
  ['FRONTEND_CHECK_SPLIT_DOMAIN_HISTORY_GUARDS_PASS','runFrontendCheckDomainHistoryGuardChecks'].forEach((marker) => {
    if (!frontendCheckSplitDomainHistorySource.includes(marker)) throw new Error('Missing v191 domain split-history guard marker: ' + marker);
  });
  ['frontendCheckSplitHistoryGuardSplitPass','v191-frontend-check-split-history-pass'].forEach((marker) => {
    if (!stateSource.includes(marker)) throw new Error('Missing v191 state marker: ' + marker);
  });
}

module.exports = {
  FRONTEND_CHECK_SPLIT_GUARDS_PASS,
  runFrontendCheckSplitGuardChecks
};
