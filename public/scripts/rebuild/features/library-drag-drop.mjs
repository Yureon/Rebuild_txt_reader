import { persistLibraryUi } from '../state/app-state.mjs';
import { toast } from './ui.mjs';
import { targetTypeLabel } from './library-list-actions.mjs';
import { canStartLibraryDrag, finishLibraryDrag, supportsNativeLibraryDnd, validateLibraryMoveTarget } from './library-drag-drop-contract.mjs';
export { canDragLibraryItem, canStartLibraryDrag, finishLibraryDrag, libraryDraggableAttrs, supportsNativeLibraryDnd, validateLibraryMoveTarget } from './library-drag-drop-contract.mjs';

const LIBRARY_DND_MIME = 'application/x-txt-reader-library-item';
const LIBRARY_DND_TEXT = 'text/plain';
export const LIBRARY_DND_HOVER_OPEN_DELAY_MS = 650;
export const LIBRARY_DRAG_PERMISSION_UI_PASS = 'v493-library-drag-target-policy-ui-pass';


function normalizeWithDeps(deps, value) {
  if (typeof deps?.normalizePromptCategory === 'function') return deps.normalizePromptCategory(value);
  return String(value || '').split('>').map(part => part.trim()).filter(Boolean).join(' > ');
}

export function createLibraryDragDropHandlers(app, deps = {}) {
  return {
    handleDragStart: ev => handleLibraryDragStart(app, ev, deps),
    handleDragOver: ev => handleLibraryDragOver(app, ev, deps),
    handleDragLeave: ev => handleLibraryDragLeave(app, ev, deps),
    handleDrop: ev => handleLibraryDrop(app, ev, deps),
    finishDrag: () => finishLibraryDrag(app, deps)
  };
}

// Compatibility contract retained in the lightweight module:
// libraryDraggable:allowed ? 'true' : 'false'
// draggable: allowed ? 'true' : null
// if (type !== 'folder') return false
// 이동 대상은 현재 계정의 라이브러리 접근 범위 안이어야 합니다.

function handleLibraryDragStart(app, ev, deps) {
  const box = app?.els?.novelList;
  const target = ev.target instanceof Element ? ev.target : null;
  if (!supportsNativeLibraryDnd(app)) {
    ev.preventDefault();
    return;
  }
  if (!box || !target || !ev.dataTransfer) return;
  if (target.closest('button,input,textarea,select,a')) {
    ev.preventDefault();
    return;
  }
  const dragElement = target.closest('[data-library-draggable="true"]');
  if (!dragElement || !box.contains(dragElement)) return;
  const actionTarget = deps.getLibraryActionTarget?.(app, dragElement);
  if (!actionTarget) return;
  if (!canStartLibraryDrag(app, actionTarget)) {
    ev.preventDefault();
    return;
  }
  deps.clearLongPress?.(app);
  app.state.librarySuppressClick = true;
  app.state.libraryDragSource = actionTarget;
  app.state.libraryDragElement = dragElement;
  dragElement.classList.add('dragging');
  box.classList.add('library-drag-active');
  const payload = serializeDragSource(actionTarget);
  try { ev.dataTransfer.setData(LIBRARY_DND_MIME, JSON.stringify(payload)); } catch {}
  try { ev.dataTransfer.setData(LIBRARY_DND_TEXT, payload.title || targetTypeLabel(actionTarget.type)); } catch {}
  ev.dataTransfer.effectAllowed = 'move';
}

function handleLibraryDragOver(app, ev, deps) {
  const drop = resolveLibraryDropTarget(app, ev, deps);
  clearLibraryDropTarget(app, drop && drop.element || null);
  if (!drop) {
    cancelLibraryHoverOpen(app);
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'none';
    return;
  }
  ev.preventDefault();
  if (!drop.valid) {
    cancelLibraryHoverOpen(app);
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'none';
    markLibraryDropTarget(app, drop.element, drop.reason, true);
    return;
  }
  if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
  markLibraryDropTarget(app, drop.element, drop.reason, false);
  scheduleLibraryHoverOpen(app, drop);
}

function handleLibraryDragLeave(app, ev) {
  const box = app?.els?.novelList;
  if (!box || !(ev.target instanceof Element)) return;
  const next = ev.relatedTarget instanceof Element ? ev.relatedTarget : null;
  if (next && box.contains(next)) return;
  clearLibraryDropTarget(app);
}

async function handleLibraryDrop(app, ev, deps) {
  const drop = resolveLibraryDropTarget(app, ev, deps);
  if (!drop || !drop.valid) {
    if (drop && drop.reason) toast(app, 'warn', '이동 불가', drop.reason);
    finishLibraryDrag(app, deps);
    return;
  }
  ev.preventDefault();
  const source = app.state.libraryDragSource || readDragSourceFromEvent(app, ev, deps);
  finishLibraryDrag(app, deps);
  if (!source) return;
  try {
    await deps.moveDraggedLibraryItem?.(app, source, drop.targetPath);
  } catch (error) {
    console.warn('library drop failed', error);
  }
}

function clearLibraryDropTarget(app, except = null) {
  const active = app?.state?.libraryDropTargetElement;
  if (active && active !== except) {
    active.classList.remove('drop-target', 'drop-target-invalid', 'drag-hover-open');
    active.removeAttribute('data-drop-hint');
    app.state.libraryDropTargetElement = null;
  }
}

function markLibraryDropTarget(app, element, hint = '', invalid = false) {
  if (!element || !app?.state) return;
  app.state.libraryDropTargetElement = element;
  element.classList.add('drop-target');
  element.classList.toggle('drop-target-invalid', !!invalid);
  if (hint) element.setAttribute('data-drop-hint', hint);
  else element.removeAttribute('data-drop-hint');
}

function resolveLibraryDropTarget(app, ev, deps) {
  const box = app?.els?.novelList;
  const source = app?.state?.libraryDragSource || readDragSourceFromEvent(app, ev, deps);
  const target = ev.target instanceof Element ? ev.target : null;
  if (!box || !source || !target) return null;

  const rootZone = target.closest && target.closest('.library-root-dropzone');
  if (rootZone && box.contains(rootZone)) return validateLibraryDrop(app, source, '', rootZone, deps);

  const folder = target.closest && target.closest('.cat-header');
  if (folder && box.contains(folder)) {
    const folderKey = folder.dataset.folderKey || '';
    return validateLibraryDrop(app, source, deps.formatFolderPath?.(folderKey) || normalizeWithDeps(deps, folderKey), folder, deps);
  }
  return null;
}

function validateLibraryDrop(app, source, targetPath, element, deps) {
  if (!canStartLibraryDrag(app, source)) {
    return { valid:false, targetPath: normalizeWithDeps(deps, targetPath), reason:'이동 권한이 없습니다.', element };
  }
  return { ...validateLibraryMoveTarget(source, targetPath, { ...deps, app }), element };
}

function scheduleLibraryHoverOpen(app, drop) {
  if (!drop || !drop.valid || !drop.element || !drop.element.classList?.contains('cat-header')) {
    cancelLibraryHoverOpen(app);
    return;
  }
  const folderKey = drop.element.dataset.folderKey || '';
  if (!folderKey || !app.state.collapsedFolders?.has(folderKey)) {
    cancelLibraryHoverOpen(app);
    return;
  }
  if (app.state.libraryDragHoverKey === folderKey && app.state.libraryDragHoverTimer) return;
  cancelLibraryHoverOpen(app);
  app.state.libraryDragHoverKey = folderKey;
  app.state.libraryDragHoverTimer = window.setTimeout(() => {
    app.state.libraryDragHoverTimer = 0;
    app.state.libraryDragHoverKey = '';
    app.state.collapsedFolders.delete(folderKey);
    persistLibraryUi(app.state);
    drop.element.classList.remove('collapsed');
    drop.element.classList.add('drag-hover-open');
    const body = drop.element.nextElementSibling;
    if (body && body.classList?.contains('cat-body')) body.style.display = 'block';
  }, getLibraryDndHoverOpenMs(app));
}

function cancelLibraryHoverOpen(app) {
  if (app?.state?.libraryDragHoverTimer) {
    window.clearTimeout(app.state.libraryDragHoverTimer);
    app.state.libraryDragHoverTimer = 0;
  }
  if (app?.state) app.state.libraryDragHoverKey = '';
}

function getLibraryDndHoverOpenMs() {
  return LIBRARY_DND_HOVER_OPEN_DELAY_MS;
}

function readDragSourceFromEvent(app, ev, deps) {
  if (!ev || !ev.dataTransfer) return null;
  let raw = '';
  try { raw = ev.dataTransfer.getData(LIBRARY_DND_MIME); } catch {}
  if (!raw) return null;
  let payload = null;
  try { payload = JSON.parse(raw); } catch { return null; }
  if (!payload || !payload.type) return null;
  if (payload.type === 'folder') {
    return { type:'folder', folderKey: payload.folderKey || '', title: payload.title || '폴더', subtitle: deps.formatFolderPath?.(payload.folderKey || '') || '루트' };
  }
  if (payload.type === 'novel') {
    const novel = app.state.novelById.get(payload.novelId || '');
    return novel ? { type:'novel', novel, title:novel.title || novel.fileName || '작품', subtitle:novel.categoryPath || '루트' } : null;
  }
  if (payload.type === 'episode') {
    const novel = app.state.novelById.get(payload.novelId || '');
    const episode = (novel?.episodes || []).find(ep => ep.id === payload.episodeId);
    return novel && episode ? { type:'episode', novel, episode, title:episode.title || episode.fileName || '회차', subtitle:novel.title || novel.id } : null;
  }
  return null;
}

function serializeDragSource(source) {
  if (source.type === 'folder') return { type:'folder', folderKey: source.folderKey, title: source.title };
  if (source.type === 'episode') return { type:'episode', novelId: source.novel?.id, episodeId: source.episode?.id, title: source.title };
  return { type:'novel', novelId: source.novel?.id, title: source.title };
}

