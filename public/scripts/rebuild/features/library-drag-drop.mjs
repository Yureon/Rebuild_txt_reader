import { persistLibraryUi } from '../state/app-state.mjs';
import { toast } from './ui.mjs';
import { canUseLibraryAction, isUserLibraryPathAllowed, targetTypeLabel } from './library-list-actions.mjs';

const LIBRARY_DND_MIME = 'application/x-txt-reader-library-item';
const LIBRARY_DND_TEXT = 'text/plain';
const LIBRARY_DND_HOVER_OPEN_DEFAULT_MS = 650;
const LIBRARY_DND_HOVER_OPEN_MIN_MS = 250;
const LIBRARY_DND_HOVER_OPEN_MAX_MS = 1500;
export const LIBRARY_DRAG_PERMISSION_UI_PASS = 'v493-library-drag-target-policy-ui-pass';

export function libraryDraggableAttrs(app, type, dataset = {}) {
  const native = supportsNativeLibraryDnd(app);
  const allowed = native && canDragLibraryItem(app, type, dataset);
  return {
    draggable: allowed ? 'true' : null,
    dataset:{ ...dataset, libraryDraggable:allowed ? 'true' : 'false', dndType:type, nativeDnd:allowed ? '1' : '0' }
  };
}

export function createLibraryDragDropHandlers(app, deps = {}) {
  return {
    handleDragStart: ev => handleLibraryDragStart(app, ev, deps),
    handleDragOver: ev => handleLibraryDragOver(app, ev, deps),
    handleDragLeave: ev => handleLibraryDragLeave(app, ev),
    handleDrop: ev => handleLibraryDrop(app, ev, deps),
    finishDrag: () => finishLibraryDrag(app, deps)
  };
}

export function finishLibraryDrag(app, deps = {}) {
  deps.clearLongPress?.(app);
  cancelLibraryHoverOpen(app);
  clearLibraryDropTarget(app);
  if (app?.state?.libraryDragElement?.classList) {
    app.state.libraryDragElement.classList.remove('dragging');
  }
  if (app?.els?.novelList) app.els.novelList.classList.remove('library-drag-active');
  if (app?.state) {
    app.state.libraryDragSource = null;
    app.state.libraryDragElement = null;
    window.setTimeout(() => { app.state.librarySuppressClick = false; }, 0);
  }
}

export function validateLibraryMoveTarget(source, targetPath, deps = {}) {
  const normalizedTarget = normalizeWithDeps(deps, targetPath);
  if (!source) return { valid:false, targetPath: normalizedTarget, reason:'' };
  if (source.type === 'folder') {
    const sourcePath = deps.formatFolderPath?.(source.folderKey) || normalizeWithDeps(deps, source.folderKey);
    const sourceParent = deps.parentFolderPath?.(source.folderKey) || '';
    if (!sourcePath) return { valid:false, targetPath: normalizedTarget, reason:'이동할 수 없는 폴더' };
    if (normalizedTarget === sourcePath || normalizedTarget.startsWith(`${sourcePath} > `)) {
      return { valid:false, targetPath: normalizedTarget, reason:'자기 자신 또는 하위 폴더로 이동할 수 없습니다.' };
    }
    if (normalizedTarget === sourceParent) return { valid:false, targetPath: normalizedTarget, reason:'이미 해당 위치입니다.' };
  }
  if (source.type === 'novel') {
    const currentPath = normalizeWithDeps(deps, source.novel?.categoryPath || '');
    if (normalizedTarget === currentPath) return { valid:false, targetPath: normalizedTarget, reason:'이미 해당 폴더입니다.' };
    if (source.novel?.isMultiFile) {
      const sourcePath = normalizeWithDeps(deps, [source.novel.categoryPath, source.novel.title].filter(Boolean).join(' > '));
      if (normalizedTarget === sourcePath || normalizedTarget.startsWith(`${sourcePath} > `)) {
        return { valid:false, targetPath: normalizedTarget, reason:'작품 폴더 자신 또는 하위로 이동할 수 없습니다.' };
      }
    }
  }
  if (source.type === 'episode') {
    const currentPath = deps.getCurrentLibraryPath?.(source) || '';
    if (normalizedTarget === currentPath) return { valid:false, targetPath: normalizedTarget, reason:'이미 해당 폴더입니다.' };
  }
  if (deps.app && !isUserLibraryPathAllowed(deps.app, normalizedTarget)) return { valid:false, targetPath: normalizedTarget, reason:'이동 대상은 현재 계정의 라이브러리 접근 범위 안이어야 합니다.' };
  return { valid:true, targetPath: normalizedTarget, reason: normalizedTarget ? `${normalizedTarget}로 이동` : '루트로 이동' };
}

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

function getLibraryDndHoverOpenMs(app) {
  const raw = Number(app?.state?.prefs?.libraryDndHoverOpenDelay);
  if (!Number.isFinite(raw)) return LIBRARY_DND_HOVER_OPEN_DEFAULT_MS;
  return Math.max(LIBRARY_DND_HOVER_OPEN_MIN_MS, Math.min(LIBRARY_DND_HOVER_OPEN_MAX_MS, Math.round(raw)));
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

export function canDragLibraryItem(app, type, dataset = {}) {
  if (!app?.state?.userAccessSnapshot?.userId) return true;
  if (type !== 'folder') return false;
  return canUseLibraryAction(app, { type:'folder', folderKey:dataset.folderKey || '', subtitle:dataset.folderKey || '' }, 'move');
}

export function canStartLibraryDrag(app, source) {
  if (!source) return false;
  if (!app?.state?.userAccessSnapshot?.userId) return true;
  return canUseLibraryAction(app, source, 'move');
}

function serializeDragSource(source) {
  if (source.type === 'folder') return { type:'folder', folderKey: source.folderKey, title: source.title };
  if (source.type === 'episode') return { type:'episode', novelId: source.novel?.id, episodeId: source.episode?.id, title: source.title };
  return { type:'novel', novelId: source.novel?.id, title: source.title };
}

export function supportsNativeLibraryDnd(app) {
  if (app?.state?.prefs?.libraryNativeDnd === false) return false;
  if (app?.isMobileProfile || app?.state?.profile === 'mobile') return false;
  try {
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return false;
  } catch {}
  return true;
}

function normalizeWithDeps(deps, value) {
  if (typeof deps.normalizePromptCategory === 'function') return deps.normalizePromptCategory(value);
  return String(value || '').split('>').map(x => x.trim()).filter(Boolean).join(' > ');
}
