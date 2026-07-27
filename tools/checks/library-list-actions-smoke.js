const fs = require('fs');
const path = require('path');

function requireMarker(source, marker, label) {
  if (!String(source || '').includes(marker)) throw new Error(`library list actions smoke missing ${label}: ${marker}`);
}

function runLibraryListActionsSmoke(projectRoot) {
  const root = projectRoot || path.join(__dirname, '..', '..');
  const library = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/library.mjs'), 'utf8');
  const installer = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/library-install-orchestrator.mjs'), 'utf8');
  const eventBridge = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/library-event-delegation-bridge.mjs'), 'utf8');
  const installControls = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/library-install-controls-runtime.mjs'), 'utf8');
  const actions = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/library-list-actions.mjs'), 'utf8');
  const elements = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/ui/elements.mjs'), 'utf8');

  requireMarker(library, "from './library-install-orchestrator.mjs'", 'library install orchestrator import');
  requireMarker(installer, "from './library-list-actions.mjs'", 'list action module import');
  requireMarker(installer, 'installListActionSheet(app, on, { runAction: action => refs.runListAction?.(app, action) });', 'list action install bridge');
  requireMarker(eventBridge, 'getLibraryActionTargetFromElement', 'action target bridge');
  requireMarker(installControls, 'delete app.els.libraryQuickList.dataset.delegatedLibraryQuickEvents', 'quick delegation cleanup guard');
  requireMarker(actions, 'export function installListActionSheet(app, on, { runAction } = {})', 'install export');
  requireMarker(actions, 'export function getLibraryActionTargetFromElement(app, target', 'target resolver export');
  requireMarker(actions, 'export function openListActionSheet(app, actionTarget)', 'open export');
  requireMarker(actions, 'export function closeListActionSheet(app)', 'close export');
  requireMarker(actions, 'export function targetTypeLabel(type)', 'target label export');
  requireMarker(actions, 'actionTarget?.novel?.isVirtualEpisodeGroup', 'virtual episode group mutation guard');
  requireMarker(actions, 'isNovelFavoriteForState', 'variant alias favorite state');
  requireMarker(elements, "'list-action-overlay'", 'action sheet overlay collector');
  requireMarker(elements, "'list-action-delete'", 'action sheet delete collector');
  return { ok: true };
}

if (require.main === module) {
  runLibraryListActionsSmoke(path.join(__dirname, '..', '..'));
  console.log('library list actions smoke OK');
}

module.exports = { runLibraryListActionsSmoke };
