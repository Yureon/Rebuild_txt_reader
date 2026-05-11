const fs = require('fs');
const path = require('path');

const SEARCH_RUN_RETRY_ACTIONS_SMOKE_PASS = 'v247-search-run-retry-actions-smoke-pass';

function runSearchRunRetryActionsSmoke(projectRoot) {
  const runSource = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/search/run-actions.mjs'), 'utf8');
  const retrySource = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/search/retry-actions.mjs'), 'utf8');
  ['v247-search-run-actions-pass', 'buildSearchRunRequest', 'beginSearchRun', 'finishSearchRun'].forEach(marker => {
    if (!runSource.includes(marker)) throw new Error('search run actions marker missing: ' + marker);
  });
  ['v247-search-retry-actions-pass', 'buildSearchRetryRequest', 'beginSearchRetry', 'finishSearchRetry', 'buildSearchRetryDoneMessage'].forEach(marker => {
    if (!retrySource.includes(marker)) throw new Error('search retry actions marker missing: ' + marker);
  });
  const searchSource = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/search.mjs'), 'utf8');
  ['buildSearchRunRequest', 'buildSearchRetryRequest'].forEach(marker => {
    if (!searchSource.includes(marker)) throw new Error('search runtime not wired to helper: ' + marker);
  });
  return { pass: SEARCH_RUN_RETRY_ACTIONS_SMOKE_PASS };
}

module.exports = { SEARCH_RUN_RETRY_ACTIONS_SMOKE_PASS, runSearchRunRetryActionsSmoke };
