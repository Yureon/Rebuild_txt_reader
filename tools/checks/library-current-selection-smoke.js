const fs = require('fs');
const path = require('path');

function runLibraryCurrentSelectionSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const libraryPath = path.join(projectRoot, 'public/scripts/rebuild/features/library.mjs');
  const helperPath = path.join(projectRoot, 'public/scripts/rebuild/features/library-current-selection.mjs');
  const library = fs.readFileSync(libraryPath, 'utf8');
  const helper = fs.readFileSync(helperPath, 'utf8');
  const requiredLibrary = [
    "from './library-current-selection.mjs'",
    'getLibraryCurrentKey(app)',
    'getLibraryFilteredNovels(app'
  ];
  const requiredHelper = [
    'LIBRARY_CURRENT_SELECTION_PASS',
    'filterLibraryNovels',
    'getLibraryCurrentKey',
    'getLibraryFilteredNovels',
    'libraryFilteredNovelsCache'
  ];
  const missingLibrary = requiredLibrary.filter(token => !library.includes(token));
  const missingHelper = requiredHelper.filter(token => !helper.includes(token));
  if (missingLibrary.length || missingHelper.length) {
    throw new Error('library current selection smoke failed: ' + JSON.stringify({ missingLibrary, missingHelper }));
  }
  if (/function\s+getLibraryFilteredNovels\s*\(/.test(library) || /function\s+filterNovels\s*\(/.test(library)) {
    throw new Error('library filtering helper should stay in library-current-selection.mjs');
  }
  console.log('Library current selection smoke OK');
  return { ok: true };
}

module.exports = { runLibraryCurrentSelectionSmoke };

if (require.main === module) runLibraryCurrentSelectionSmoke();
