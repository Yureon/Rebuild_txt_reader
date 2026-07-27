const fs = require('fs');
const path = require('path');

const LIBRARY_VIRTUAL_WINDOW_RENDERER_SMOKE_PASS = 'v294-library-virtual-window-renderer-smoke-pass';

function runLibraryVirtualWindowRendererSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const renderer = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/library-virtual-window-renderer.mjs'), 'utf8');
  const library = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/library.mjs'), 'utf8');
  [
    'LIBRARY_VIRTUAL_WINDOW_RENDERER_PASS',
    'v294-library-virtual-window-renderer-pass',
    'buildLibraryVirtualWindowFragment',
    'applyLibraryVirtualWindowFragment',
    'renderLibraryVirtualWindowDom',
    'getLibraryVirtualWindowRendererContract',
    "from './library-virtual-row-inspection.mjs'"
  ].forEach(marker => {
    if (!renderer.includes(marker)) throw new Error('library virtual window renderer marker missing: ' + marker);
  });
  const runtime = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/library-virtual-render-runtime.mjs'), 'utf8');
  const rendererBridgeInLibrary = library.includes("from './library-virtual-window-renderer.mjs'") && library.includes('renderLibraryVirtualWindowDom({');
  const rendererBridgeInRuntime = runtime.includes("from './library-virtual-window-renderer.mjs'") && runtime.includes('renderLibraryVirtualWindowDom({');
  if (!rendererBridgeInLibrary && !rendererBridgeInRuntime) throw new Error('virtual window renderer bridge missing from library/runtime');
  if (library.includes('document.createDocumentFragment();\n  fragment.append(createRootDropZone())')) throw new Error('library.mjs still owns virtual window fragment body');
  return { pass: LIBRARY_VIRTUAL_WINDOW_RENDERER_SMOKE_PASS };
}

module.exports = { LIBRARY_VIRTUAL_WINDOW_RENDERER_SMOKE_PASS, runLibraryVirtualWindowRendererSmoke };
if (require.main === module) runLibraryVirtualWindowRendererSmoke();
