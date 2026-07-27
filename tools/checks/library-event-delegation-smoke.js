const fs = require('fs');
const path = require('path');

const LIBRARY_EVENT_DELEGATION_SMOKE_PASS = 'v295-library-event-delegation-smoke-pass';

function runLibraryEventDelegationSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const mod = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/library-event-delegation.mjs'), 'utf8');
  [
    'v295-library-event-delegation-runtime-pass',
    'v295-library-long-press-runtime-pass',
    'installLibraryEventDelegationRuntime',
    'clearLibraryLongPressRuntime',
    'getLibraryActionTargetRuntime',
    'pointerdown',
    'pointermove',
    'contextmenu',
    'createLibraryDragDropHandlers',
    'v371-library-left-disclosure-event-pass',
    'v371-library-folder-row-click-pass',
    'v371-library-title-overflow-gate-pass',
    'toggleCategoryFolderRuntime',
    'toggleEpisodeNovelRuntime',
    'updateLibraryTitleOverflowRuntime',
    'folder-toggle-btn',
    'episode-toggle-btn'
  ].forEach(marker => {
    if (!mod.includes(marker)) throw new Error('library event delegation marker missing: ' + marker);
  });
  const library = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/library.mjs'), 'utf8');
  if (!library.includes("from './library-event-delegation.mjs'") && !library.includes("from './library-event-delegation-bridge.mjs'")) throw new Error('library.mjs does not import event delegation runtime or v301 bridge');
  if (library.includes('const LONG_PRESS_MS') || library.includes('function handleLibraryPointerDown')) throw new Error('long-press implementation was not moved out of library.mjs');
  return { pass: LIBRARY_EVENT_DELEGATION_SMOKE_PASS };
}

module.exports = { LIBRARY_EVENT_DELEGATION_SMOKE_PASS, runLibraryEventDelegationSmoke };
if (require.main === module) runLibraryEventDelegationSmoke();
