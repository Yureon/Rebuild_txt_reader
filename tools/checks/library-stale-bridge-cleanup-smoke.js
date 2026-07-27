const fs = require('fs');
const path = require('path');

const LIBRARY_STALE_BRIDGE_CLEANUP_SMOKE_PASS = 'v296-library-stale-bridge-cleanup-smoke-pass';

function runLibraryStaleBridgeCleanupSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const library = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/library.mjs'), 'utf8');
  [
    'LIBRARY_LOAD_STATE_HELPER_BRIDGE',
    'v283 split bridge markers',
    'diagnostics split guard continuity'
  ].forEach(marker => {
    if (library.includes(marker)) throw new Error('stale library split bridge marker remains: ' + marker);
  });
  const releaseHistory = path.join(projectRoot, 'docs', 'release-history.md');
  const docs = fs.existsSync(releaseHistory) ? fs.readFileSync(releaseHistory, 'utf8') : '';
  if (docs && !docs.includes('v296-library-stale-bridge-cleanup-smoke-pass')) throw new Error('v296 consolidated docs do not mention stale bridge cleanup smoke');
  return { pass: LIBRARY_STALE_BRIDGE_CLEANUP_SMOKE_PASS };
}

module.exports = { LIBRARY_STALE_BRIDGE_CLEANUP_SMOKE_PASS, runLibraryStaleBridgeCleanupSmoke };
if (require.main === module) runLibraryStaleBridgeCleanupSmoke();
