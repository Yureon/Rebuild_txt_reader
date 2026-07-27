const fs = require('fs');
const path = require('path');

const LIBRARY_QUICK_STALE_CLEANUP_SMOKE_PASS = 'v276-library-quick-stale-cleanup-smoke-pass';

function runLibraryQuickStaleCleanupSmoke(projectRoot) {
  if (!projectRoot) throw new Error('runLibraryQuickStaleCleanupSmoke requires projectRoot');
  const quick = fs.readFileSync(path.join(projectRoot, 'public', 'scripts', 'rebuild', 'features', 'library-quick-list.mjs'), 'utf8');
  const css = fs.readFileSync(path.join(projectRoot, 'public', 'styles', 'app.css'), 'utf8');
  ['cleanupLibraryQuickStaleItems', "libraryQuickAction:'cleanup-stale'", 'isStaleLibraryQuickRecent', '삭제되었거나 찾을 수 없는 항목'].forEach(marker => {
    if (!quick.includes(marker)) throw new Error('quick stale cleanup missing marker: ' + marker);
  });
  ['library-quick-stale-note', 'library-quick-stale-cleanup'].forEach(marker => {
    if (!css.includes(marker)) throw new Error('quick stale cleanup CSS missing marker: ' + marker);
  });
  return { pass: LIBRARY_QUICK_STALE_CLEANUP_SMOKE_PASS };
}

module.exports = { LIBRARY_QUICK_STALE_CLEANUP_SMOKE_PASS, runLibraryQuickStaleCleanupSmoke };
