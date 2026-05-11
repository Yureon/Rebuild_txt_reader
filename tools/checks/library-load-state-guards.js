const LIBRARY_LOAD_STATE_GUARD_PASS = 'v227-library-load-state-guard-pass';

function runLibraryLoadStateGuardChecks(ctx = {}) {
  const { librarySource = '', libraryLoadStateSource = '', frontendModuleImportSmokeSource = '' } = ctx;
  if (!libraryLoadStateSource.includes("LIBRARY_LOAD_STATE_HELPER_PASS = 'v227-library-load-state-helper-pass'")) {
    throw new Error('Missing v227 library load-state helper pass marker');
  }
  if (!/async function loadLibrary\(app, options = \{\}\)/.test(librarySource)) {
    throw new Error('library.mjs must define loadLibrary(app, options) for app.library.load boot path');
  }
  if (!librarySource.includes('applyLibraryCatalogState(app.state, payload)')) {
    throw new Error('loadLibrary must apply fetched catalog through applyLibraryCatalogState');
  }
  if (!librarySource.includes('const payload = await app.api.novels()')) {
    throw new Error('loadLibrary must fetch /api/novels via app.api.novels()');
  }
  ['libraryFilteredNovelsCache','libraryVirtualRowsCache','libraryVirtualWindowRenderCache','libraryVirtualGateCache'].forEach((field) => {
    if (!libraryLoadStateSource.includes(`state.${field} = null`)) {
      throw new Error(`library load-state helper must reset ${field}`);
    }
  });
  if (!frontendModuleImportSmokeSource.includes('features/library-load-state.mjs')) {
    throw new Error('frontend module import smoke must include library-load-state.mjs');
  }
  return { pass: LIBRARY_LOAD_STATE_GUARD_PASS };
}

module.exports = { LIBRARY_LOAD_STATE_GUARD_PASS, runLibraryLoadStateGuardChecks };
