const fs = require('fs');
const path = require('path');

const LIBRARY_ACTION_ORCHESTRATOR_SMOKE_PASS = 'v294-library-action-orchestrator-smoke-pass';

function runLibraryActionOrchestratorSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const orchestrator = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/library-action-orchestrator.mjs'), 'utf8');
  const library = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/library.mjs'), 'utf8');
  [
    'LIBRARY_ACTION_ORCHESTRATOR_PASS',
    'v294-library-action-orchestrator-pass',
    'runLibraryListActionRuntime',
    'moveDraggedLibraryItemRuntime',
    'withLibraryMutationRuntime',
    'getLibraryActionOrchestratorContract',
    'injectedBoundaries'
  ].forEach(marker => {
    if (!orchestrator.includes(marker)) throw new Error('library action orchestrator marker missing: ' + marker);
  });
  if (!library.includes("from './library-action-orchestrator.mjs'") && !library.includes("from './library-action-orchestrator-bridge.mjs'")) throw new Error('library.mjs does not import action orchestrator or v301 bridge');
  if (!library.includes('getLibraryActionOrchestratorDeps(app)') && !library.includes('createLibraryActionOrchestratorBridge')) throw new Error('library.mjs action orchestrator deps bridge missing');
  if (library.includes('async function renameActionTarget') || library.includes('async function withLibraryMutation')) throw new Error('library.mjs still owns extracted action mutation runtime body');
  return { pass: LIBRARY_ACTION_ORCHESTRATOR_SMOKE_PASS };
}

module.exports = { LIBRARY_ACTION_ORCHESTRATOR_SMOKE_PASS, runLibraryActionOrchestratorSmoke };
if (require.main === module) runLibraryActionOrchestratorSmoke();
