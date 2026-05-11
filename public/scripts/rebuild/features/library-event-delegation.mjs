export const LIBRARY_EVENT_DELEGATION_RUNTIME_PASS = 'v295-library-event-delegation-runtime-pass';
export const LIBRARY_LONG_PRESS_RUNTIME_PASS = 'v295-library-long-press-runtime-pass';
export const LIBRARY_LEFT_DISCLOSURE_EVENT_PASS = 'v371-library-left-disclosure-event-pass';
export const LIBRARY_FOLDER_ROW_CLICK_PASS = 'v371-library-folder-row-click-pass';
export const LIBRARY_TITLE_OVERFLOW_GATE_PASS = 'v371-library-title-overflow-gate-pass';

export const LIBRARY_LONG_PRESS_DEFAULTS = Object.freeze({
  ms: 560,
  cancelPx: 10
});

function getElementTarget(ev) {
  return ev?.target instanceof Element ? ev.target : null;
}

function getNovelList(app) {
  return app?.els?.novelList || null;
}

export function getLibraryActionTargetRuntime(app, target, deps = {}) {
  const fn = deps?.getLibraryActionTargetFromElement;
  if (typeof fn !== 'function') return null;
  return fn(app, target, { formatFolderPath: deps.formatFolderPath });
}

export function clearLibraryLongPressRuntime(app, options = {}) {
  const win = options.windowObject || globalThis.window;
  if (app?.state?.libraryLongPressTimer) {
    win?.clearTimeout?.(app.state.libraryLongPressTimer);
    app.state.libraryLongPressTimer = 0;
  }
  if (app?.state) app.state.libraryLongPressPoint = null;
}


export function toggleCategoryFolderRuntime(app, key, deps = {}) {
  if (!key) return false;
  const anchor = deps.getLibraryScrollAnchor?.(app) || null;
  if (app.state.collapsedFolders.has(key)) app.state.collapsedFolders.delete(key);
  else app.state.collapsedFolders.add(key);
  deps.persistLibraryUi?.(app.state);
  deps.renderLibrary?.(app, { source:'folder-toggle-button', scrollAnchor:anchor, followActive:false });
  return true;
}

export function toggleEpisodeNovelRuntime(app, novelId, deps = {}) {
  const id = String(novelId || '');
  if (!id || !app?.state?.novelById?.has?.(id)) return false;
  const novel = app.state.novelById.get(id);
  if (!novel?.isMultiFile) return false;
  const anchor = deps.getLibraryScrollAnchor?.(app) || null;
  if (app.state.expandedEpisodeNovels.has(id)) app.state.expandedEpisodeNovels.delete(id);
  else app.state.expandedEpisodeNovels.add(id);
  deps.persistLibraryUi?.(app.state);
  deps.renderLibrary?.(app, { source:'episode-toggle-button', scrollAnchor:anchor, followActive:false });
  return true;
}

function getLibraryTitleMarqueeForTarget(target) {
  if (!target || typeof target.closest !== 'function') return null;
  const direct = target.closest('.library-title-marquee');
  if (direct) return direct;
  const row = target.closest('.cat-header,.novel-item,.ep-item');
  if (!row || typeof row.querySelector !== 'function') return null;
  return row.querySelector('.library-title-marquee');
}

export function updateLibraryTitleOverflowRuntime(target) {
  const title = getLibraryTitleMarqueeForTarget(target);
  if (!title || typeof title.querySelector !== 'function') return false;
  const text = title.querySelector('.library-title-text');
  if (!text) return false;
  const boxWidth = Number(title.clientWidth) || 0;
  const textWidth = Number(text.scrollWidth) || 0;
  const overflow = boxWidth > 0 && textWidth > boxWidth + 2;
  title.classList?.toggle?.('is-overflow', overflow);
  return overflow;
}

function handleLibraryClick(app, ev, deps = {}) {
  const box = getNovelList(app);
  const target = getElementTarget(ev);
  if (!box || !target) return;
  if (app.state.librarySuppressClick) {
    app.state.librarySuppressClick = false;
    ev.preventDefault?.();
    ev.stopPropagation?.();
    return;
  }

  const actionBtn = target.closest('.library-action-btn');
  if (actionBtn && box.contains(actionBtn)) {
    ev.preventDefault?.();
    ev.stopPropagation?.();
    deps.openListActionSheet?.(app, deps.getLibraryActionTarget?.(app, actionBtn));
    return;
  }

  const folderToggle = target.closest('.folder-toggle-btn');
  if (folderToggle && box.contains(folderToggle)) {
    ev.preventDefault?.();
    ev.stopPropagation?.();
    toggleCategoryFolderRuntime(app, folderToggle.dataset.folderKey || '', deps);
    return;
  }

  const episodeToggle = target.closest('.episode-toggle-btn');
  if (episodeToggle && box.contains(episodeToggle)) {
    ev.preventDefault?.();
    ev.stopPropagation?.();
    toggleEpisodeNovelRuntime(app, episodeToggle.dataset.novelId || '', deps);
    return;
  }

  const epItem = target.closest('.ep-item');
  if (epItem && box.contains(epItem)) {
    ev.stopPropagation?.();
    deps.openEpisodeFromElement?.(app, epItem);
    return;
  }
  const folderHeader = target.closest('.cat-header');
  if (folderHeader && box.contains(folderHeader)) {
    ev.preventDefault?.();
    ev.stopPropagation?.();
    const btn = folderHeader.querySelector?.('.folder-toggle-btn');
    toggleCategoryFolderRuntime(app, btn?.dataset?.folderKey || '', deps);
    return;
  }
  const novelItem = target.closest('.novel-item');
  if (novelItem && box.contains(novelItem)) deps.openNovelFromElement?.(app, novelItem);
}

function handleLibraryContextMenu(app, ev, deps = {}) {
  const box = getNovelList(app);
  const target = getElementTarget(ev);
  if (!box || !target) return;
  const actionTarget = deps.getLibraryActionTarget?.(app, target);
  if (!actionTarget) return;
  ev.preventDefault?.();
  deps.openListActionSheet?.(app, actionTarget);
}

function handleLibraryPointerDown(app, ev, deps = {}) {
  const box = getNovelList(app);
  const target = getElementTarget(ev);
  if (!box || !target || ev.button !== 0) return;
  if (target.closest('button,input,textarea,select,a')) return;
  const actionTarget = deps.getLibraryActionTarget?.(app, target);
  if (!actionTarget) return;
  clearLibraryLongPressRuntime(app, deps);
  const pointerId = ev.pointerId;
  const win = deps.windowObject || globalThis.window;
  app.state.libraryLongPressPoint = { pointerId, x: ev.clientX, y: ev.clientY };
  app.state.libraryLongPressTimer = win?.setTimeout?.(() => {
    app.state.libraryLongPressTimer = 0;
    app.state.librarySuppressClick = true;
    try { box.releasePointerCapture?.(pointerId); } catch {}
    deps.openListActionSheet?.(app, actionTarget);
  }, deps.longPressMs || LIBRARY_LONG_PRESS_DEFAULTS.ms);
}

function handleLibraryPointerMove(app, ev, deps = {}) {
  const start = app?.state?.libraryLongPressPoint;
  if (!start || start.pointerId !== ev.pointerId) return;
  const dx = Math.abs(Number(ev.clientX) - Number(start.x));
  const dy = Math.abs(Number(ev.clientY) - Number(start.y));
  const cancelPx = deps.longPressCancelPx || LIBRARY_LONG_PRESS_DEFAULTS.cancelPx;
  if (Math.max(dx, dy) >= cancelPx) clearLibraryLongPressRuntime(app, deps);
}

export function installLibraryEventDelegationRuntime(app, on, deps = {}) {
  const box = getNovelList(app);
  if (!box || box.dataset.delegatedLibraryEvents === '1') return;
  box.dataset.delegatedLibraryEvents = '1';
  on(box, 'click', ev => handleLibraryClick(app, ev, deps));
  on(box, 'pointerover', ev => updateLibraryTitleOverflowRuntime(getElementTarget(ev)));
  on(box, 'focusin', ev => updateLibraryTitleOverflowRuntime(getElementTarget(ev)));
  on(box, 'contextmenu', ev => handleLibraryContextMenu(app, ev, deps));
  on(box, 'pointerdown', ev => handleLibraryPointerDown(app, ev, deps));
  on(box, 'pointermove', ev => handleLibraryPointerMove(app, ev, deps));
  on(box, 'pointerup', () => clearLibraryLongPressRuntime(app, deps));
  on(box, 'pointercancel', () => clearLibraryLongPressRuntime(app, deps));
  on(box, 'pointerleave', () => clearLibraryLongPressRuntime(app, deps));
  const dragDropFactory = deps.createLibraryDragDropHandlers;
  const dragDrop = typeof dragDropFactory === 'function'
    ? dragDropFactory(app, deps.getLibraryDragDropDeps?.())
    : null;
  if (dragDrop) {
    on(box, 'dragstart', dragDrop.handleDragStart);
    on(box, 'dragover', dragDrop.handleDragOver);
    on(box, 'dragleave', dragDrop.handleDragLeave);
    on(box, 'drop', dragDrop.handleDrop);
    on(box, 'dragend', dragDrop.finishDrag);
  }
}
