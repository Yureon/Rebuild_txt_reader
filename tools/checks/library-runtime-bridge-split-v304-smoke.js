const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const LIBRARY_RUNTIME_BRIDGE_SPLIT_V304_SMOKE_PASS = 'v304-library-runtime-bridge-split-smoke-pass';

async function runLibraryRuntimeBridgeSplitV304Smoke(projectRoot = path.join(__dirname, '..', '..')) {
  const libraryPath = path.join(projectRoot, 'public/scripts/rebuild/features/library.mjs');
  const library = fs.readFileSync(libraryPath, 'utf8');
  const modules = [
    ['library-runtime-deps-bridge.mjs', 'v304-library-runtime-deps-bridge-pass'],
    ['library-virtual-operations-bridge.mjs', 'v304-library-virtual-operations-bridge-pass'],
    ['library-core-operations-bridge.mjs', 'v304-library-core-operations-bridge-pass'],
    ['library-install-orchestrator.mjs', 'v304-library-install-orchestrator-pass']
  ];
  for (const [file, marker] of modules) {
    const source = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features', file), 'utf8');
    if (!source.includes(marker)) throw new Error(`v304 split marker missing: ${marker}`);
    if (!library.includes(`from './${file}'`)) throw new Error(`library.mjs missing v304 split import: ${file}`);
  }
  [
    'createLibraryVirtualTrialRuntimeDeps',
    'recordLibraryVirtualTrialObservationRuntime',
    'renderLibraryOrchestratorRuntime',
    'createLibraryAppApiRuntime',
    'installLibraryQuickListDelegation'
  ].forEach(marker => {
    if (library.includes(marker)) throw new Error(`library.mjs still owns v304 split implementation marker: ${marker}`);
  });
  if (!library.includes('function getLibraryVirtualGate(') || !library.includes('buildLibraryVirtualGateAudit')) {
    throw new Error('library.mjs must retain guarded virtual gate wrapper marker');
  }
  const lineCount = library.split(/\r?\n/).length;
  if (lineCount > 180) throw new Error('library.mjs v304 split line count regression: ' + lineCount);

  for (const [file] of modules) {
    await import(pathToFileURL(path.join(projectRoot, 'public/scripts/rebuild/features', file)).href);
  }
  return { pass: LIBRARY_RUNTIME_BRIDGE_SPLIT_V304_SMOKE_PASS, modules: modules.length, lineCount };
}

module.exports = { LIBRARY_RUNTIME_BRIDGE_SPLIT_V304_SMOKE_PASS, runLibraryRuntimeBridgeSplitV304Smoke };
if (require.main === module) {
  runLibraryRuntimeBridgeSplitV304Smoke().catch(error => { console.error(error && error.stack || error); process.exit(1); });
}
