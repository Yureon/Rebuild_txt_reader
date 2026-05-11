import { createLibraryDragDropHandlers } from './library-drag-drop.mjs';
import { clearLibraryLongPressRuntime, getLibraryActionTargetRuntime, installLibraryEventDelegationRuntime } from './library-event-delegation.mjs';
import { getLibraryActionTargetFromElement, openListActionSheet } from './library-list-actions.mjs';

export const LIBRARY_EVENT_DELEGATION_BRIDGE_PASS = 'v301-library-event-delegation-bridge-pass';

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
      createLibraryDragDropHandlers,
      getLibraryActionTarget,
      getLibraryActionTargetFromElement,
      getLibraryDragDropDeps: baseDeps.getLibraryDragDropDeps,
      getLibraryScrollAnchor: baseDeps.getLibraryScrollAnchor,
      formatFolderPath: baseDeps.formatFolderPath,
      openEpisodeFromElement: baseDeps.openEpisodeFromElement,
      openListActionSheet,
      openNovelFromElement: baseDeps.openNovelFromElement,
      persistLibraryUi: baseDeps.persistLibraryUi,
      renderLibrary: baseDeps.renderLibrary
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
