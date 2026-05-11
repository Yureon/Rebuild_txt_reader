const fs = require('fs');
const path = require('path');

const LIBRARY_FULL_RENDERER_SMOKE_PASS = 'v293-library-full-renderer-smoke-pass';

function runLibraryFullRendererSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const fullRenderer = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/library-full-renderer.mjs'), 'utf8');
  const library = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/library.mjs'), 'utf8');
  [
    'LIBRARY_FULL_RENDERER_PASS',
    'v293-library-full-renderer-pass',
    'buildLibraryFullRenderRecord',
    'renderLibraryFull',
    "from './library-model.mjs'",
    "from './library-prototype-rows.mjs'",
    "from './library-tree-renderer.mjs'",
    'restoreLibraryScrollAnchor',
    'recordLibraryVirtualRender'
  ].forEach(marker => {
    if (!fullRenderer.includes(marker)) throw new Error('library full renderer marker missing: ' + marker);
  });
  if (!library.includes("from './library-full-renderer.mjs'")) throw new Error('library.mjs does not import full renderer runtime');
  if (!library.includes('renderLibraryFullRuntime(app, box, novels, reason, options, getLibraryFullRendererDeps(app))')) throw new Error('library.mjs full renderer bridge missing');
  if (library.includes('const tree = buildTree(novels);')) throw new Error('library.mjs still owns full tree build body');
  return { pass: LIBRARY_FULL_RENDERER_SMOKE_PASS };
}

module.exports = { LIBRARY_FULL_RENDERER_SMOKE_PASS, runLibraryFullRendererSmoke };
if (require.main === module) runLibraryFullRendererSmoke();
