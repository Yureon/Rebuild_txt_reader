const fs = require('fs');
const path = require('path');

const LIBRARY_QUICK_ACTIONS_SMOKE_PASS = 'v277-library-quick-actions-smoke-pass';

function runLibraryQuickActionsSmoke(projectRoot) {
  const root = projectRoot || path.join(__dirname, '..', '..');
  const library = fs.readFileSync(path.join(root, 'public', 'scripts', 'rebuild', 'features', 'library.mjs'), 'utf8');
  const quickActions = fs.readFileSync(path.join(root, 'public', 'scripts', 'rebuild', 'features', 'library-quick-actions.mjs'), 'utf8');
  function assertContains(source, needle, label) {
    if (!source.includes(needle)) throw new Error(`${label} missing: ${needle}`);
  }
  function assertNotContains(source, needle, label) {
    if (source.includes(needle)) throw new Error(`${label} should not contain: ${needle}`);
  }
  assertContains(library, "from './library-quick-actions.mjs'", 'library quick actions import');
  assertContains(library, 'closeSidebarAfterLibraryOpen', 'library quick open dependency');
  assertContains(library, 'getLibraryFilteredNovels, renderLibrary, toast', 'library quick reveal dependencies');
  assertNotContains(library, 'function highlightLibraryQuickTarget', 'library.mjs local quick target highlighter');
  assertContains(quickActions, 'export function openLibraryQuickItem', 'quick actions open export');
  assertContains(quickActions, 'export function revealLibraryQuickItemInList', 'quick actions reveal export');
  assertContains(quickActions, 'findEpisodeForSnapshot', 'quick actions multi-file resume helper');
  return { pass: LIBRARY_QUICK_ACTIONS_SMOKE_PASS };
}

if (require.main === module) console.log(JSON.stringify(runLibraryQuickActionsSmoke(path.join(__dirname, '..', '..'))));

module.exports = { LIBRARY_QUICK_ACTIONS_SMOKE_PASS, runLibraryQuickActionsSmoke };
