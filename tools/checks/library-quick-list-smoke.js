const fs = require('fs');
const path = require('path');

function requireMarker(source, marker, label) {
  if (!String(source || '').includes(marker)) throw new Error(`library quick list smoke missing ${label}: ${marker}`);
}

function runLibraryQuickListSmoke(projectRoot) {
  const root = projectRoot || path.join(__dirname, '..', '..');
  const shell = fs.readFileSync(path.join(root, 'public/fragments/app-shell.html'), 'utf8');
  const library = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/library.mjs'), 'utf8');
  const quickList = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/library-quick-list.mjs'), 'utf8');
  const elements = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/ui/elements.mjs'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'public/styles/app.css'), 'utf8');

  requireMarker(shell, 'id="library-quick-list"', 'app shell quick container');
  requireMarker(shell, 'data-library-quick-pass="v273"', 'v273 app shell marker');
  requireMarker(elements, "'library-quick-list'", 'element collector id');
  requireMarker(quickList, 'export function renderLibraryQuickList(app)', 'quick list renderer module export');
  requireMarker(quickList, 'function getLibraryQuickRecentItems(app', 'recent quick item builder');
  requireMarker(quickList, 'function getLibraryQuickFavoriteItems(app', 'favorite quick item builder');
  requireMarker(library, 'function openLibraryQuickItem(app, item)', 'quick item opener');
  requireMarker(library, 'installLibraryQuickListDelegation(app, on, {', 'quick list event delegation bridge');
  requireMarker(quickList, 'export function installLibraryQuickListDelegation(app, on, handlers = {})', 'quick list event delegation module');
  requireMarker(library, 'renderLibraryQuickList(app);', 'render path refresh');
  requireMarker(css, '.library-quick-list', 'quick list CSS');
  requireMarker(css, '.library-quick-main', 'quick main button CSS');
  requireMarker(css, '.library-quick-actions', 'quick action button CSS');
  requireMarker(library, 'function revealLibraryQuickItemInList(app, item)', 'quick reveal handler');
  requireMarker(quickList, 'export function removeLibraryQuickRecentItem(app, item)', 'quick recent remove handler');
  requireMarker(quickList, 'LIBRARY_QUICK_UI_STORAGE_KEY', 'quick persisted UI state');
  requireMarker(css, '.library-quick-item', 'quick item CSS');
  return { ok: true };
}

if (require.main === module) {
  runLibraryQuickListSmoke(path.join(__dirname, '..', '..'));
  console.log('library quick list smoke OK');
}

module.exports = { runLibraryQuickListSmoke };
