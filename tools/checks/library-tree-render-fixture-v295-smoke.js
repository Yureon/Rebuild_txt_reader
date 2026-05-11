const fs = require('fs');
const path = require('path');

const LIBRARY_TREE_RENDER_FIXTURE_V295_SMOKE_PASS = 'v295-library-tree-render-fixture-validation-matrix-smoke-pass';

function runLibraryTreeRenderFixtureV295Smoke(projectRoot = path.join(__dirname, '..', '..')) {
  const fixture = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/library-tree-render-fixture.mjs'), 'utf8');
  [
    'v295-library-tree-render-fixture-validation-matrix-pass',
    'getLibraryTreeRenderBrowserValidationMatrix',
    'validateLibraryTreeRenderBrowserValidationMatrix',
    'desktop-wide-library',
    'mobile-library-overlay',
    'multi-file-active-episode',
    'favorite/bookmark marker tolerance'
  ].forEach(marker => {
    if (!fixture.includes(marker)) throw new Error('library tree fixture v295 marker missing: ' + marker);
  });
  return { pass: LIBRARY_TREE_RENDER_FIXTURE_V295_SMOKE_PASS };
}

module.exports = { LIBRARY_TREE_RENDER_FIXTURE_V295_SMOKE_PASS, runLibraryTreeRenderFixtureV295Smoke };
if (require.main === module) runLibraryTreeRenderFixtureV295Smoke();
