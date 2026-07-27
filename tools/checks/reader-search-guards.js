const { runReaderRuntimeGuardChecks } = require('./reader-runtime-guards.js');
const { runSearchRuntimeGuardChecks } = require('./search-runtime-guards.js');
const { runRecoverySearchCacheGuardChecks } = require('./recovery-search-cache-guards.js');
const { runReaderCacheLayoutGuardChecks } = require('./reader-cache-layout-guards.js');

const FRONTEND_CHECK_READER_SEARCH_GUARDS_PASS = 'v189-frontend-check-reader-search-aggregator-pass';

function runReaderSearchGuardChecks(ctx) {
  runReaderRuntimeGuardChecks(ctx);
  runSearchRuntimeGuardChecks(ctx);
  runRecoverySearchCacheGuardChecks(ctx);
  runReaderCacheLayoutGuardChecks(ctx);
}

module.exports = {
  FRONTEND_CHECK_READER_SEARCH_GUARDS_PASS,
  runReaderSearchGuardChecks
};
