const fs = require('fs');
const path = require('path');

const LIBRARY_EMPTY_RENDERER_SMOKE_PASS = 'v297-library-empty-renderer-smoke-pass';

function runLibraryEmptyRendererSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const renderer = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/library-empty-renderer.mjs'), 'utf8');
  const library = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/library.mjs'), 'utf8');
  [
    'LIBRARY_EMPTY_RENDERER_PASS',
    'v297-library-empty-renderer-pass',
    'renderLibraryEmptyStateRuntime',
    'kind:\'informational-empty-state\'',
    'reason:\'empty-list\''
  ].forEach(marker => {
    if (!renderer.includes(marker)) throw new Error('library empty renderer marker missing: ' + marker);
  });
  if (!library.includes("from './library-empty-renderer.mjs'")) throw new Error('library.mjs does not import empty renderer');
  if (!library.includes('renderLibraryEmptyStateRuntime(app, box, options,')) throw new Error('library.mjs empty renderer bridge missing');
  if (library.includes("createEl('div', { class:'list-empty-state'")) throw new Error('library.mjs still owns empty-state DOM construction');
  return { pass: LIBRARY_EMPTY_RENDERER_SMOKE_PASS };
}

module.exports = { LIBRARY_EMPTY_RENDERER_SMOKE_PASS, runLibraryEmptyRendererSmoke };
if (require.main === module) runLibraryEmptyRendererSmoke();
