const { readProjectSourceManifest } = require('./source-loader-manifest.js');

const SEARCH_SESSION_RUNTIME_SMOKE_PASS = 'v246-search-session-runtime-smoke-pass';

function runSearchSessionRuntimeSmoke(projectRoot) {
  const { source, search } = readProjectSourceManifest(projectRoot, {
    source: { root:'rebuild', path:'features/search/session-runtime.mjs' },
    search: { root:'rebuild', path:'features/search.mjs' }
  });
  ['v246-search-session-runtime-boundary-pass', 'resetSearchRuntimeSession', 'resetSearchRuntimeForReaderChange'].forEach(marker => {
    if (!source.includes(marker)) throw new Error('search session runtime marker missing: ' + marker);
  });
  ['resetSearchRuntimeSession', 'resetSearchRuntimeForReaderChange'].forEach(marker => {
    if (!search.includes(marker)) throw new Error('search runtime bridge marker missing: ' + marker);
  });
  return { pass: SEARCH_SESSION_RUNTIME_SMOKE_PASS };
}

module.exports = { SEARCH_SESSION_RUNTIME_SMOKE_PASS, runSearchSessionRuntimeSmoke };
