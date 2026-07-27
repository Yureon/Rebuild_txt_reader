import { clearLibraryLongPressRuntime, getLibraryActionTargetRuntime, installLibraryEventDelegationRuntime } from './library-event-delegation.mjs';
import { getLibraryActionTargetFromElement, openListActionSheet } from './library-list-actions.mjs';

export const LIBRARY_EVENT_DELEGATION_BRIDGE_PASS = 'v301-library-event-delegation-bridge-pass';

export const LIBRARY_DND_LAZY_LOAD_PASS = 'v599-library-dnd-lazy-load-pass';
let dragDropModule = null;
let dragDropModulePromise = null;

export function preloadLibraryDragDropRuntime() {
  if (dragDropModule) return Promise.resolve(dragDropModule);
  if (!dragDropModulePromise) {
    dragDropModulePromise = import('./library-drag-drop.mjs').then(module => {
      dragDropModule = module;
      return module;
    }).finally(() => { dragDropModulePromise = null; });
  }
  return dragDropModulePromise;
}

function createLazyLibraryDragDropHandlers(app, deps = {}) {
  let handlers = null;
  const current = () => {
    if (!handlers && dragDropModule?.createLibraryDragDropHandlers) handlers = dragDropModule.createLibraryDragDropHandlers(app, deps);
    return handlers;
  };
  const warm = () => preloadLibraryDragDropRuntime().then(() => current()).catch(() => null);
  return {
    handleDragStart(ev) {
      const active = current();
      if (active) return active.handleDragStart(ev);
      ev?.preventDefault?.();
      warm();
    },
    handleDragOver(ev) { return current()?.handleDragOver?.(ev); },
    handleDragLeave(ev) { return current()?.handleDragLeave?.(ev); },
    handleDrop(ev) {
      const active = current();
      if (active) return active.handleDrop(ev);
      ev?.preventDefault?.();
      warm();
    },
    finishDrag() { return current()?.finishDrag?.(); }
  };
}

export function createLibraryEventDelegationBridge(baseDeps = {}) {
  function getLibraryActionTarget(app, target) {
    return getLibraryActionTargetRuntime(app, target, {
      getLibraryActionTargetFromElement,
      formatFolderPath: baseDeps.formatFolderPath
    });
  }

  function clearLongPress(app) {
    return clearLibraryLongPressRuntime(app);
  }

  function installLibraryEventDelegation(app, on) {
    return installLibraryEventDelegationRuntime(app, on, {
      createLibraryDragDropHandlers: createLazyLibraryDragDropHandlers,
      preloadLibraryDragDrop: preloadLibraryDragDropRuntime,
      getLibraryActionTarget,
      getLibraryActionTargetFromElement,
      getLibraryDragDropDeps: baseDeps.getLibraryDragDropDeps,
      getLibraryScrollAnchor: baseDeps.getLibraryScrollAnchor,
      formatFolderPath: baseDeps.formatFolderPath,
      ensureNovelEpisodesLoaded: baseDeps.ensureNovelEpisodesLoaded,
      loadMoreCatalog: baseDeps.loadMoreCatalog,
      openEpisodeFromElement: baseDeps.openEpisodeFromElement,
      openListActionSheet,
      openNovelFromElement: baseDeps.openNovelFromElement,
      persistLibraryUi: baseDeps.persistLibraryUi,
      renderLibrary: baseDeps.renderLibrary,
      toast: baseDeps.toast
    });
  }

  return { installLibraryEventDelegation, getLibraryActionTarget, clearLongPress };
}

export function getLibraryEventDelegationBridgeContract() {
  return {
    pass: LIBRARY_EVENT_DELEGATION_BRIDGE_PASS,
    runtime: 'library-event-delegation.mjs',
    ownsImports: ['createLibraryDragDropHandlers', 'getLibraryActionTargetFromElement', 'openListActionSheet']
  };
}
