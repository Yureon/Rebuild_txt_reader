const fs = require('fs');
const path = require('path');

function runLibraryRenderOptionsSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const libraryPath = path.join(projectRoot, 'public/scripts/rebuild/features/library.mjs');
  const helperPath = path.join(projectRoot, 'public/scripts/rebuild/features/library-render-options.mjs');
  const rowsRuntimePath = path.join(projectRoot, 'public/scripts/rebuild/features/library-virtual-rows-runtime.mjs');
  const library = fs.readFileSync(libraryPath, 'utf8');
  const helper = fs.readFileSync(helperPath, 'utf8');
  const rowsRuntime = fs.readFileSync(rowsRuntimePath, 'utf8');
  const requiredLibrary = [
    "from './library-render-options.mjs'",
    'normalizeLibraryRenderOptions(options)'
  ];
  const requiredRowsRuntime = [
    "from './library-render-options.mjs'",
    'getLibrarySetSignature(app?.state?.collapsedFolders)',
    'getLibrarySetSignature(app?.state?.expandedEpisodeNovels)',
    'LIBRARY_VIRTUAL_ROWS_RUNTIME_PASS'
  ];
  const requiredHelper = [
    'LIBRARY_RENDER_OPTIONS_PASS',
    'normalizeLibraryRenderOptions',
    'getLibrarySetSignature',
    'followActive',
    'scrollAnchor'
  ];
  const missingLibrary = requiredLibrary.filter(token => !library.includes(token));
  const missingRowsRuntime = requiredRowsRuntime.filter(token => !rowsRuntime.includes(token));
  const missingHelper = requiredHelper.filter(token => !helper.includes(token));
  if (missingLibrary.length || missingRowsRuntime.length || missingHelper.length) {
    throw new Error('library render options smoke failed: ' + JSON.stringify({ missingLibrary, missingRowsRuntime, missingHelper }));
  }
  if (/function\s+normalizeLibraryRenderOptions\s*\(/.test(library) || /function\s+getLibrarySetSignature\s*\(/.test(library)) {
    throw new Error('render option helpers should stay outside library.mjs');
  }
  console.log('Library render options smoke OK');
  return { ok: true };
}

module.exports = { runLibraryRenderOptionsSmoke };

if (require.main === module) runLibraryRenderOptionsSmoke();
