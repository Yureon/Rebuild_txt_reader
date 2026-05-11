const fs = require('fs');
const path = require('path');

const LIBRARY_RENDER_ORCHESTRATOR_SMOKE_PASS = 'v298-library-render-orchestrator-smoke-pass';

function runLibraryRenderOrchestratorSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const runtime = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/library-render-orchestrator.mjs'), 'utf8');
  const library = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/library.mjs'), 'utf8');
  ['LIBRARY_RENDER_ORCHESTRATOR_PASS', 'v298-library-render-orchestrator-pass', 'renderLibraryOrchestratorRuntime', 'novel-list-rendering', 'renderLibraryVirtualIfEnabled'].forEach(marker => {
    if (!runtime.includes(marker)) throw new Error('library render orchestrator marker missing: ' + marker);
  });
  if (!library.includes("from './library-render-orchestrator.mjs'")) throw new Error('library.mjs does not import render orchestrator runtime');
  if (!library.includes('renderLibraryOrchestratorRuntime(app, options,')) throw new Error('library.mjs render orchestrator bridge missing');
  if (library.includes("box.classList.add('novel-list-rendering')")) throw new Error('library.mjs still owns render orchestration body');
  return { pass: LIBRARY_RENDER_ORCHESTRATOR_SMOKE_PASS };
}

module.exports = { LIBRARY_RENDER_ORCHESTRATOR_SMOKE_PASS, runLibraryRenderOrchestratorSmoke };
if (require.main === module) runLibraryRenderOrchestratorSmoke();
