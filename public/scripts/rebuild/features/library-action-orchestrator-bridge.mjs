import { persistLibraryUi } from '../state/app-state.mjs';
import { showLoading, status, toast } from './ui.mjs';
import { confirmLibraryDelete, confirmLibraryMove, promptLibraryRename } from './library-action-prompts.mjs';
import { moveDraggedLibraryItemRuntime, runLibraryListActionRuntime } from './library-action-orchestrator.mjs';
import { chooseLibraryMoveTarget } from './library-move-picker.mjs';
import { closeListActionSheet, targetTypeLabel } from './library-list-actions.mjs';
import { describeLibraryMutationError } from './library-mutation-formatters.mjs';
import { isCurrentDeletedByTarget, runLibraryDeleteRequest, runLibraryMoveRequest, runLibraryRenameRequest } from './library-mutation-actions.mjs';
import { formatFolderPath, openOptionsFromSnapshot } from './library-paths.mjs';
import { validateLibraryMoveTarget } from './library-drag-drop.mjs';
import { createLibraryActionOrchestratorDeps } from './library-runtime-dependency-bags.mjs';

export const LIBRARY_ACTION_ORCHESTRATOR_BRIDGE_PASS = 'v301-library-action-orchestrator-bridge-pass';

export function createLibraryActionOrchestratorBridge(baseDeps = {}) {
  const getDeps = app => createLibraryActionOrchestratorDeps(app, {
    chooseLibraryMoveTarget,
    closeListActionSheet,
    closeSidebarAfterLibraryOpen: baseDeps.closeSidebarAfterLibraryOpen,
    confirmLibraryDelete,
    confirmLibraryMove,
    describeLibraryMutationError,
    formatFolderPath,
    getLibraryDragDropDeps: baseDeps.getLibraryDragDropDeps,
    getLibraryMoveDeps: baseDeps.getLibraryMoveDeps,
    getLibraryScrollAnchor: baseDeps.getLibraryScrollAnchor,
    isCurrentDeletedByTarget,
    loadLibrary: baseDeps.loadLibrary,
    openNovelFromElement: baseDeps.openNovelFromElement,
    openOptionsFromSnapshot,
    persistLibraryUi,
    promptLibraryRename,
    renderLibrary: baseDeps.renderLibrary,
    runLibraryDeleteRequest,
    runLibraryMoveRequest,
    runLibraryRenameRequest,
    showLoading,
    status,
    targetTypeLabel,
    toast,
    toggleFavorite: baseDeps.toggleFavorite,
    validateLibraryMoveTarget
  });

  async function runListAction(app, action) {
    return runLibraryListActionRuntime(app, action, getDeps(app));
  }

  async function moveDraggedLibraryItem(app, source, targetPath) {
    return moveDraggedLibraryItemRuntime(app, source, targetPath, getDeps(app));
  }

  return { runListAction, moveDraggedLibraryItem };
}

export function getLibraryActionOrchestratorBridgeContract() {
  return {
    pass: LIBRARY_ACTION_ORCHESTRATOR_BRIDGE_PASS,
    runtime: 'library-action-orchestrator.mjs',
    depsFactory: 'createLibraryActionOrchestratorDeps'
  };
}
