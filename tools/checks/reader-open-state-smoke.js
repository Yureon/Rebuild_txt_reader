const { readProjectSourceManifest } = require('./source-loader-manifest.js');

const READER_OPEN_STATE_SMOKE_PASS = 'v246-reader-open-state-smoke-pass';

function runReaderOpenStateSmoke(projectRoot) {
  const { source, reader } = readProjectSourceManifest(projectRoot, {
    source: { root:'rebuild', path:'features/reader/open-state.mjs' },
    reader: { root:'rebuild', path:'features/reader.mjs' }
  });
  ['v246-reader-open-state-boundary-pass', 'buildReaderOpenCurrentState', 'resetReaderOpenRuntimeState'].forEach(marker => {
    if (!source.includes(marker)) throw new Error('reader open-state marker missing: ' + marker);
  });
  ['buildReaderOpenCurrentState', 'resetReaderOpenRuntimeState'].forEach(marker => {
    if (!reader.includes(marker)) throw new Error('reader open-state bridge marker missing: ' + marker);
  });
  return { pass: READER_OPEN_STATE_SMOKE_PASS };
}

module.exports = { READER_OPEN_STATE_SMOKE_PASS, runReaderOpenStateSmoke };
