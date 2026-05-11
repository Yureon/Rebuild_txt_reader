const fs = require('fs');
const path = require('path');

function runLibraryScrollAnchorSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const libraryPath = path.join(projectRoot, 'public/scripts/rebuild/features/library.mjs');
  const helperPath = path.join(projectRoot, 'public/scripts/rebuild/features/library-scroll-anchor.mjs');
  const library = fs.readFileSync(libraryPath, 'utf8');
  const helper = fs.readFileSync(helperPath, 'utf8');
  const requiredLibrary = [
    "from './library-scroll-anchor.mjs'",
    'getLibraryScrollAnchor(app)',
    'restoreLibraryScrollAnchor(app,'
  ];
  const requiredHelper = [
    'findLibraryRowElementByKey',
    'getLibraryScrollAnchor',
    'restoreLibraryScrollAnchor',
    "from './library-row-diagnostics.mjs'"
  ];
  const missingLibrary = requiredLibrary.filter(token => !library.includes(token));
  const missingHelper = requiredHelper.filter(token => !helper.includes(token));
  if (missingLibrary.length || missingHelper.length) {
    throw new Error('library scroll anchor smoke failed: ' + JSON.stringify({ missingLibrary, missingHelper }));
  }
  if (/function\s+findLibraryRowElementByKey\s*\(/.test(library)) {
    throw new Error('findLibraryRowElementByKey should stay in library-scroll-anchor.mjs');
  }
  console.log('Library scroll anchor smoke OK');
  return { ok: true };
}

module.exports = { runLibraryScrollAnchorSmoke };

if (require.main === module) runLibraryScrollAnchorSmoke();
