const fs = require('fs');
const path = require('path');

function requireMarker(source, marker, label) {
  if (!String(source || '').includes(marker)) throw new Error(`library list actions smoke missing ${label}: ${marker}`);
}

function runLibraryListActionsSmoke(projectRoot) {
  const root = projectRoot || path.join(__dirname, '..', '..');
  const library = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/library.mjs'), 'utf8');
  const actions = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/library-list-actions.mjs'), 'utf8');
  const elements = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/ui/elements.mjs'), 'utf8');

  requireMarker(library, "from './library-list-actions.mjs'", 'library action module import');
  requireMarker(library, 'installListActionSheet(app, on, { runAction: action => runListAction(app, action) });', 'list action install bridge');
  requireMarker(library, 'function getLibraryActionTarget(app, target)', 'action target bridge');
  requireMarker(library, 'delete app.els.libraryQuickList.dataset.delegatedLibraryQuickEvents', 'quick delegation cleanup guard');
  requireMarker(actions, 'export function installListActionSheet(app, on, { runAction } = {})', 'install export');
  requireMarker(actions, 'export function getLibraryActionTargetFromElement(app, target', 'target resolver export');
  requireMarker(actions, 'export function openListActionSheet(app, actionTarget)', 'open export');
  requireMarker(actions, 'export function closeListActionSheet(app)', 'close export');
  requireMarker(actions, 'export function targetTypeLabel(type)', 'target label export');
  requireMarker(elements, "'list-action-overlay'", 'action sheet overlay collector');
  requireMarker(elements, "'list-action-delete'", 'action sheet delete collector');
  return { ok: true };
}

if (require.main === module) {
  runLibraryListActionsSmoke(path.join(__dirname, '..', '..'));
  console.log('library list actions smoke OK');
}

module.exports = { runLibraryListActionsSmoke };
