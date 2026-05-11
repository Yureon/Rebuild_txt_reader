const fs = require('fs');
const path = require('path');

const LIBRARY_INSTALL_CONTROLS_RUNTIME_SMOKE_PASS = 'v298-library-install-controls-runtime-smoke-pass';

function runLibraryInstallControlsRuntimeSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const runtime = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/library-install-controls-runtime.mjs'), 'utf8');
  const library = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/library.mjs'), 'utf8');
  ['LIBRARY_INSTALL_CONTROLS_RUNTIME_PASS', 'v298-library-install-controls-runtime-pass', 'createLibraryFilteredRenderRuntime', 'installLibraryControlHandlersRuntime', 'cleanupLibraryRuntime'].forEach(marker => {
    if (!runtime.includes(marker)) throw new Error('library install controls marker missing: ' + marker);
  });
  if (!library.includes("from './library-install-controls-runtime.mjs'")) throw new Error('library.mjs does not import install controls runtime');
  if (!library.includes('installLibraryControlHandlersRuntime(app, on, renderFilteredLibrary,')) throw new Error('library.mjs install controls bridge missing');
  if (library.includes("on(app.els.search, 'input'")) throw new Error('library.mjs still owns search input handler');
  return { pass: LIBRARY_INSTALL_CONTROLS_RUNTIME_SMOKE_PASS };
}

module.exports = { LIBRARY_INSTALL_CONTROLS_RUNTIME_SMOKE_PASS, runLibraryInstallControlsRuntimeSmoke };
if (require.main === module) runLibraryInstallControlsRuntimeSmoke();
