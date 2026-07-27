const fs = require('fs');
const path = require('path');

const LIBRARY_MOVE_DRAG_SMOKE_PASS = 'v276-library-move-drag-smoke-pass';

function requireMarker(source, marker, label) {
  if (!source.includes(marker)) throw new Error(`${label} missing marker: ${marker}`);
}

function runLibraryMoveDragSmoke(projectRoot) {
  const root = projectRoot || path.join(__dirname, '..', '..');
  const libraryPath = path.join(root, 'public/scripts/rebuild/features/library.mjs');
  const movePath = path.join(root, 'public/scripts/rebuild/features/library-move-picker.mjs');
  const dragPath = path.join(root, 'public/scripts/rebuild/features/library-drag-drop.mjs');
  const library = fs.readFileSync(libraryPath, 'utf8');
  const move = fs.readFileSync(movePath, 'utf8');
  const drag = fs.readFileSync(dragPath, 'utf8');

  requireMarker(library, "from './library-move-picker.mjs'", 'library move picker import');
  requireMarker(library, "from './library-drag-drop.mjs'", 'library drag/drop import');
  requireMarker(library, 'createLibraryDragDropHandlers(app, getLibraryDragDropDeps())', 'library drag/drop delegation');
  requireMarker(move, 'export function chooseLibraryMoveTarget', 'move picker module');
  requireMarker(move, 'collectLibraryMoveTargets', 'move target collector');
  requireMarker(drag, 'export function createLibraryDragDropHandlers', 'drag/drop handler factory');
  requireMarker(drag, 'export function validateLibraryMoveTarget', 'drag/drop move validation');
  requireMarker(drag, 'export function supportsNativeLibraryDnd', 'drag/drop native support export');
  requireMarker(library, 'supportsNativeLibraryDnd, validateLibraryMoveTarget', 'library native DnD diagnostic import');
  requireMarker(drag, 'application/x-txt-reader-library-item', 'drag/drop mime payload');

  if (/function\s+chooseLibraryMoveTarget\s*\(/.test(library)) throw new Error('library.mjs still owns move picker DOM helper');
  if (/function\s+handleLibraryDragStart\s*\(/.test(library)) throw new Error('library.mjs still owns drag-start handler');
  if (/function\s+libraryDraggableAttrs\s*\(/.test(library)) throw new Error('library.mjs still owns draggable attrs helper');
  return { pass: LIBRARY_MOVE_DRAG_SMOKE_PASS, modules: 2 };
}

module.exports = { LIBRARY_MOVE_DRAG_SMOKE_PASS, runLibraryMoveDragSmoke };
