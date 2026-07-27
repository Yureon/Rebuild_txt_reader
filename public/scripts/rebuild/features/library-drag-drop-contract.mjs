import { canUseLibraryAction, isUserLibraryPathAllowed } from './library-list-actions.mjs';

export const LIBRARY_DND_LIGHTWEIGHT_CONTRACT_PASS = 'v599-library-dnd-lightweight-contract-pass';

export function libraryDraggableAttrs(app, type, dataset = {}) {
  const native = supportsNativeLibraryDnd(app);
  const allowed = native && canDragLibraryItem(app, type, dataset);
  return {
    draggable: allowed ? 'true' : null,
    dataset:{ ...dataset, libraryDraggable:allowed ? 'true' : 'false', dndType:type, nativeDnd:allowed ? '1' : '0' }
  };
}

export function finishLibraryDrag(app, deps = {}) {
  deps.clearLongPress?.(app);
  const win = globalThis.window;
  if (app?.state?.libraryDragHoverTimer) {
    win?.clearTimeout?.(app.state.libraryDragHoverTimer);
    app.state.libraryDragHoverTimer = 0;
  }
  if (app?.state) app.state.libraryDragHoverKey = '';
  const active = app?.state?.libraryDropTargetElement;
  if (active?.classList) {
    active.classList.remove('drop-target', 'drop-target-invalid', 'drag-hover-open');
    active.removeAttribute?.('data-drop-hint');
  }
  if (app?.state) app.state.libraryDropTargetElement = null;
  if (app?.state?.libraryDragElement?.classList) app.state.libraryDragElement.classList.remove('dragging');
  if (app?.els?.novelList) app.els.novelList.classList.remove('library-drag-active');
  if (app?.state) {
    app.state.libraryDragSource = null;
    app.state.libraryDragElement = null;
    win?.setTimeout?.(() => { app.state.librarySuppressClick = false; }, 0);
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
  if (deps.app && !isUserLibraryPathAllowed(deps.app, normalizedTarget)) {
    return { valid:false, targetPath: normalizedTarget, reason:'이동 대상은 현재 계정의 라이브러리 접근 범위 안이어야 합니다.' };
  }
  return { valid:true, targetPath: normalizedTarget, reason: normalizedTarget ? `${normalizedTarget}로 이동` : '루트로 이동' };
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

export function supportsNativeLibraryDnd(app) {
  if (app?.state?.prefs?.libraryNativeDnd === false) return false;
  if (app?.isMobileProfile || app?.state?.profile === 'mobile') return false;
  try {
    if (globalThis.window?.matchMedia?.('(pointer: coarse)').matches) return false;
  } catch {}
  return true;
}

function normalizeWithDeps(deps, value) {
  if (typeof deps.normalizePromptCategory === 'function') return deps.normalizePromptCategory(value);
  return String(value || '').split('>').map(x => x.trim()).filter(Boolean).join(' > ');
}
