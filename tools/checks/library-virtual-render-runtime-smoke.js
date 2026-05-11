const fs = require('fs');
const path = require('path');

const LIBRARY_VIRTUAL_RENDER_RUNTIME_SMOKE_PASS = 'v297-library-virtual-render-runtime-smoke-pass';

function runLibraryVirtualRenderRuntimeSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const runtimePath = path.join(projectRoot, 'public/scripts/rebuild/features/library-virtual-render-runtime.mjs');
  const libraryPath = path.join(projectRoot, 'public/scripts/rebuild/features/library.mjs');
  const runtime = fs.readFileSync(runtimePath, 'utf8');
  const library = fs.readFileSync(libraryPath, 'utf8');
  [
    'LIBRARY_VIRTUAL_RENDER_RUNTIME_PASS',
    'v297-library-virtual-render-runtime-pass',
    'renderLibraryVirtualIfEnabledRuntime',
    'renderLibraryVirtualWindowRuntime',
    'getLibraryVirtualGateRuntime',
    "from './library-virtual-window-renderer.mjs'",
    "from './library-virtual-gate-audit.mjs'"
  ].forEach(marker => {
    if (!runtime.includes(marker)) throw new Error('library virtual render runtime marker missing: ' + marker);
  });
  if (!library.includes("from './library-virtual-render-runtime.mjs'")) throw new Error('library.mjs does not import virtual render runtime');
  if (!library.includes('renderLibraryVirtualIfEnabledRuntime(app, box, novels, options,')) throw new Error('library.mjs virtual render bridge missing');
  if (library.includes('function renderLibraryVirtualWindow(app, box, novels')) throw new Error('library.mjs still owns virtual window render body');
  if (library.includes("from './library-virtual-gate-audit.mjs'")) throw new Error('library.mjs still imports virtual gate audit directly');
  if (library.includes("from './library-virtual-render-cache.mjs'")) throw new Error('library.mjs still imports virtual render cache directly');
  return { pass: LIBRARY_VIRTUAL_RENDER_RUNTIME_SMOKE_PASS };
}

module.exports = { LIBRARY_VIRTUAL_RENDER_RUNTIME_SMOKE_PASS, runLibraryVirtualRenderRuntimeSmoke };
if (require.main === module) runLibraryVirtualRenderRuntimeSmoke();
