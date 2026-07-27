const fs = require('fs');
const path = require('path');

const LIBRARY_SPLIT_V292_SMOKE_PASS = 'v292-library-split-smoke-pass';

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function requireIncludes(source, markers, label) {
  const missing = markers.filter(marker => !source.includes(marker));
  if (missing.length) throw new Error(`${label} missing markers: ${missing.join(', ')}`);
}

function requireNoLocalFunctions(source, names, label) {
  const leaked = names.filter(name => new RegExp(`function\\s+${name}\\s*\\(`).test(source));
  if (leaked.length) throw new Error(`${label} leaked local functions: ${leaked.join(', ')}`);
}

function runLibrarySplitV292Smoke(projectRoot = path.join(__dirname, '..', '..')) {
  const library = read(projectRoot, 'public/scripts/rebuild/features/library.mjs');
  const rowsRuntime = read(projectRoot, 'public/scripts/rebuild/features/library-virtual-rows-runtime.mjs');
  const treeRenderer = read(projectRoot, 'public/scripts/rebuild/features/library-tree-renderer.mjs');
  const fixture = read(projectRoot, 'public/scripts/rebuild/features/library-tree-render-fixture.mjs');
  const moduleManifest = read(projectRoot, 'tools/checks/module-manifest.js');
  const frontendCheck = read(projectRoot, 'tools/check_rebuild_frontend.js');

  requireIncludes(library, [
    "from './library-virtual-rows-runtime.mjs'",
    "from './library-tree-renderer.mjs'",
    'getLibraryCurrentWindowRows',
    'getLibraryVirtualRows',
    "from './library-full-renderer.mjs'"
  ], 'library v292 split bridge');
  requireNoLocalFunctions(library, [
    'getLibraryVirtualRowsSignature',
    'isLibraryVirtualRowsCacheMatch',
    'getLibraryCurrentWindowRows',
    'renderTree',
    'createNovelItem',
    'formatNovelMeta'
  ], 'library.mjs');

  requireIncludes(rowsRuntime, [
    'LIBRARY_VIRTUAL_ROWS_RUNTIME_PASS',
    'v292-library-virtual-rows-runtime-pass',
    'getLibraryVirtualRowsSignature',
    'isLibraryVirtualRowsCacheMatch',
    'getLibraryVirtualRows',
    'getLibraryCurrentWindowRows',
    'rowsRuntimePass'
  ], 'library virtual rows runtime module');

  requireIncludes(treeRenderer, [
    'LIBRARY_TREE_RENDERER_PASS',
    'v292-library-tree-renderer-pass',
    'formatNovelMeta',
    'createNovelItem',
    'createEpisodeList',
    'appendNovelItem',
    'renderLibraryTree',
    'libraryDraggableAttrs'
  ], 'library tree renderer module');

  requireIncludes(fixture, [
    'LIBRARY_TREE_RENDER_FIXTURE_V292_PASS',
    'v292-library-tree-render-fixture-contract-pass',
    'summarizeLibraryTreeRenderFixtureContract',
    'library-tree-renderer.mjs',
    'library-virtual-rows-runtime.mjs',
    'requiredDatasets',
    'actionTypes'
  ], 'library tree render fixture contract');

  requireIncludes(moduleManifest, [
    'features/library-virtual-rows-runtime.mjs',
    'features/library-tree-renderer.mjs'
  ], 'module manifest v292 modules');
  requireIncludes(frontendCheck, [
    'runLibrarySplitV292Smoke',
    'library split v292 smoke'
  ], 'frontend check v292 smoke wiring');

  console.log('library split v292 smoke OK');
  return { pass: LIBRARY_SPLIT_V292_SMOKE_PASS, ok: true };
}

module.exports = { LIBRARY_SPLIT_V292_SMOKE_PASS, runLibrarySplitV292Smoke };
if (require.main === module) runLibrarySplitV292Smoke();
