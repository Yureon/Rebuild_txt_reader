const fs = require('fs');
const path = require('path');

function runLibraryVirtualRuntimeStateSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const libraryPath = path.join(projectRoot, 'public/scripts/rebuild/features/library.mjs');
  const helperPath = path.join(projectRoot, 'public/scripts/rebuild/features/library-virtual-runtime-state.mjs');
  const library = fs.readFileSync(libraryPath, 'utf8');
  const helper = fs.readFileSync(helperPath, 'utf8');
  const requiredLibrary = [
    "from './library-virtual-runtime-state.mjs'",
    'resetLibraryVirtualAutoFallbackState(app, reason',
    'persistLibraryVirtualAutoFallback,'
  ];
  const requiredHelper = [
    'LIBRARY_VIRTUAL_RUNTIME_STATE_PASS',
    'normalizeLibraryVirtualAutoFallbackForRuntime',
    'isLibraryVirtualRendererRequested',
    'isLibraryVirtualRendererEnabled',
    'persistLibraryVirtualAutoFallback',
    'resetLibraryVirtualAutoFallbackState'
  ];
  const missingLibrary = requiredLibrary.filter(token => !library.includes(token));
  const missingHelper = requiredHelper.filter(token => !helper.includes(token));
  if (missingLibrary.length || missingHelper.length) {
    throw new Error('library virtual runtime state smoke failed: ' + JSON.stringify({ missingLibrary, missingHelper }));
  }
  const extractedFunctions = [
    'normalizeLibraryVirtualAutoFallbackForRuntime',
    'isLibraryVirtualAutoFallbackActive',
    'isLibraryVirtualDefaultRolloutEnabled',
    'isLibraryVirtualRendererRequested',
    'isLibraryVirtualRendererEnabled',
    'isLibraryVirtualSessionOptInActive',
    'isLibraryVirtualTrialActive',
    'persistLibraryVirtualAutoFallback'
  ];
  const leaked = extractedFunctions.filter(name => new RegExp('function\\s+' + name + '\\s*\\(').test(library));
  if (leaked.length) {
    throw new Error('library virtual runtime helpers should stay extracted: ' + leaked.join(', '));
  }
  if (!helper.includes("v282-library-virtual-runtime-state-pass")) {
    throw new Error('runtime state helper missing v282 pass marker');
  }
  console.log('Library virtual runtime state smoke OK');
  return { ok: true };
}

module.exports = { runLibraryVirtualRuntimeStateSmoke };

if (require.main === module) runLibraryVirtualRuntimeStateSmoke();
