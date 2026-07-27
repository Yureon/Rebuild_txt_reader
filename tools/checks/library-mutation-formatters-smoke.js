const fs = require('fs');
const path = require('path');

const LIBRARY_MUTATION_FORMATTERS_SMOKE_PASS = 'v276-library-mutation-formatters-smoke-pass';

function requireMarker(source, marker, label) {
  if (!source.includes(marker)) throw new Error(label + ' missing marker: ' + marker);
}

function runLibraryMutationFormattersSmoke(projectRoot) {
  if (!projectRoot) throw new Error('runLibraryMutationFormattersSmoke requires projectRoot');
  const formatter = fs.readFileSync(path.join(projectRoot, 'public', 'scripts', 'rebuild', 'features', 'library-mutation-formatters.mjs'), 'utf8');
  const library = fs.readFileSync(path.join(projectRoot, 'public', 'scripts', 'rebuild', 'features', 'library.mjs'), 'utf8');
  requireMarker(formatter, 'buildLibraryDeleteConfirmMessage', 'formatter source');
  requireMarker(formatter, 'describeLibraryMutationError', 'formatter source');
  requireMarker(library, "from './library-mutation-formatters.mjs'", 'library import');
  if (/function describeLibraryMutationError\(/.test(library)) throw new Error('library.mjs should not own mutation error formatter');
  if ((library.match(/toast\(app, 'success', '목록 작업', successMessage\)/g) || []).length !== 1) throw new Error('library mutation success toast must be emitted once');
  return { pass: LIBRARY_MUTATION_FORMATTERS_SMOKE_PASS };
}

module.exports = { LIBRARY_MUTATION_FORMATTERS_SMOKE_PASS, runLibraryMutationFormattersSmoke };
