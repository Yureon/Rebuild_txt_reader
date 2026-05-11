const fs = require('fs');
const path = require('path');

const LIBRARY_TREE_RENDER_FIXTURE_V294_SMOKE_PASS = 'v294-library-tree-render-fixture-browser-sample-smoke-pass';

function runLibraryTreeRenderFixtureV294Smoke(projectRoot = path.join(__dirname, '..', '..')) {
  const fixture = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/library-tree-render-fixture.mjs'), 'utf8');
  [
    'LIBRARY_TREE_RENDER_FIXTURE_V294_PASS',
    'v294-library-tree-render-fixture-browser-sample-pass',
    'getLibraryTreeRenderBrowserFixtureSample',
    'validateLibraryTreeRenderBrowserFixtureSample',
    'nested folder, multi-file, active, favorite, bookmark, and collapsed',
    'expectedCounts',
    'missingSampleSelectors'
  ].forEach(marker => {
    if (!fixture.includes(marker)) throw new Error('library tree fixture v294 marker missing: ' + marker);
  });
  return { pass: LIBRARY_TREE_RENDER_FIXTURE_V294_SMOKE_PASS };
}

module.exports = { LIBRARY_TREE_RENDER_FIXTURE_V294_SMOKE_PASS, runLibraryTreeRenderFixtureV294Smoke };
if (require.main === module) runLibraryTreeRenderFixtureV294Smoke();
