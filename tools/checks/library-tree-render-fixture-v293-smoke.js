const fs = require('fs');
const path = require('path');

const LIBRARY_TREE_RENDER_FIXTURE_V293_SMOKE_PASS = 'v293-library-tree-render-fixture-smoke-pass';

function runLibraryTreeRenderFixtureV293Smoke(projectRoot = path.join(__dirname, '..', '..')) {
  const fixture = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/library-tree-render-fixture.mjs'), 'utf8');
  [
    'LIBRARY_TREE_RENDER_FIXTURE_V293_PASS',
    'v293-library-tree-render-fixture-dom-snapshot-pass',
    'getLibraryTreeRenderFixtureDomSnapshotContract',
    'validateLibraryTreeRenderFixtureDomSnapshot',
    'requiredDatasetBySelector',
    'sampleFixtureShape',
    '.cat-body',
    '.ep-list.open .ep-item',
    'full tree DOM snapshot contract before renderer extraction'
  ].forEach(marker => {
    if (!fixture.includes(marker)) throw new Error('library tree fixture v293 marker missing: ' + marker);
  });
  return { pass: LIBRARY_TREE_RENDER_FIXTURE_V293_SMOKE_PASS };
}

module.exports = { LIBRARY_TREE_RENDER_FIXTURE_V293_SMOKE_PASS, runLibraryTreeRenderFixtureV293Smoke };
if (require.main === module) runLibraryTreeRenderFixtureV293Smoke();
