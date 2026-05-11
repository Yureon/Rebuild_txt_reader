const fs = require('fs');
const path = require('path');

const LIBRARY_RUNTIME_DEPENDENCY_BAGS_SMOKE_PASS = 'v299-library-runtime-dependency-bags-smoke-pass';

function runLibraryRuntimeDependencyBagsSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const runtimePath = path.join(projectRoot, 'public/scripts/rebuild/features/library-runtime-dependency-bags.mjs');
  const libraryPath = path.join(projectRoot, 'public/scripts/rebuild/features/library.mjs');
  const runtime = fs.readFileSync(runtimePath, 'utf8');
  const library = fs.readFileSync(libraryPath, 'utf8');
  [
    'LIBRARY_RUNTIME_DEPENDENCY_BAGS_PASS',
    'v299-library-runtime-dependency-bags-pass',
    'createLibraryVirtualTrialRuntimeDeps',
    'createLibraryVirtualSessionRuntimeDeps',
    'createLibraryVirtualDiagnosticsDeps',
    'createLibraryVirtualRecordingDeps',
    'createLibraryActionOrchestratorDeps',
    'createLibraryDragDropDeps',
    'createLibraryNavigationDeps'
  ].forEach(marker => {
    if (!runtime.includes(marker)) throw new Error('runtime dependency bags marker missing: ' + marker);
  });
  if (!library.includes("from './library-runtime-dependency-bags.mjs'")) throw new Error('library.mjs does not import runtime dependency bags');
  if (!library.includes('createLibraryActionOrchestratorDeps(app,')) throw new Error('action orchestrator dependency bag bridge missing');
  if (!library.includes('createLibraryNavigationDeps({ closeSidebarAfterLibraryOpen')) throw new Error('navigation dependency bag bridge missing');
  if (library.includes('function getLibraryFullRendererDeps(app) {\n  return {')) throw new Error('library.mjs still owns full renderer dependency object literal');
  if (library.includes('function getLibraryVirtualDiagnosticsDeps(app) {\n  return {')) throw new Error('library.mjs still owns virtual diagnostics dependency object literal');
  return { pass: LIBRARY_RUNTIME_DEPENDENCY_BAGS_SMOKE_PASS };
}

module.exports = { LIBRARY_RUNTIME_DEPENDENCY_BAGS_SMOKE_PASS, runLibraryRuntimeDependencyBagsSmoke };
if (require.main === module) runLibraryRuntimeDependencyBagsSmoke();
