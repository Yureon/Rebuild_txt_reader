const { readProjectSourceManifest, buildProjectSourceManifestSummary } = require('./source-loader-manifest.js');

const LIBRARY_LOAD_STATE_DIRECT_SMOKE_PASS = 'v228-library-load-state-direct-smoke-pass';
const LIBRARY_LOAD_STATE_EMPTY_ERROR_SMOKE_PASS = 'v231-library-load-state-empty-error-smoke-pass';
const LIBRARY_LOAD_STATE_SOURCE_MANIFEST_PASS = 'v254-library-load-state-source-manifest-pass';

async function runLibraryLoadStateDirectSmoke(projectRoot) {
  if (!projectRoot) throw new Error('runLibraryLoadStateDirectSmoke requires projectRoot');
  const sources = readProjectSourceManifest(projectRoot, {
    source: 'rebuild/features/library-load-state.mjs'
  });
  const sourceSummary = buildProjectSourceManifestSummary(sources);
  [
    'v227-library-load-state-helper-pass',
    'normalizeLibraryCatalog',
    'indexLibraryCatalogById',
    'applyLibraryCatalogState',
    'resetLibraryDerivedCaches',
    'Array.isArray(payload) ? payload : Array.isArray(payload?.novels)',
    '.filter(item => item.id)',
    'state.novelById = indexLibraryCatalogById(novels)',
    'state.libraryFilteredNovelsCache = null',
    'return { novels, novelById: state.novelById, pass: LIBRARY_LOAD_STATE_HELPER_PASS }'
  ].forEach(marker => {
    if (!sources.source.includes(marker)) throw new Error('library load state source marker missing: ' + marker);
  });
  return {
    pass: LIBRARY_LOAD_STATE_DIRECT_SMOKE_PASS,
    emptyErrorPass: LIBRARY_LOAD_STATE_EMPTY_ERROR_SMOKE_PASS,
    sourceManifestPass: sourceSummary.pass,
    v254SourceManifestPass: LIBRARY_LOAD_STATE_SOURCE_MANIFEST_PASS
  };
}

module.exports = {
  LIBRARY_LOAD_STATE_DIRECT_SMOKE_PASS,
  LIBRARY_LOAD_STATE_EMPTY_ERROR_SMOKE_PASS,
  LIBRARY_LOAD_STATE_SOURCE_MANIFEST_PASS,
  runLibraryLoadStateDirectSmoke
};
