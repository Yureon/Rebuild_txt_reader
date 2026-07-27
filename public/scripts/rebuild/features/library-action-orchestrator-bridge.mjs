import { persistLibraryUi } from '../state/app-state.mjs';
import { showLoading, status, toast } from './ui.mjs';
import { confirmLibraryDelete, confirmLibraryMove, promptLibraryRename } from './library-action-prompts.mjs';
import { moveDraggedLibraryItemRuntime, runLibraryListActionRuntime } from './library-action-orchestrator.mjs';
import { chooseLibraryMoveTarget } from './library-move-picker.mjs';
import { closeListActionSheet, targetTypeLabel } from './library-list-actions.mjs';
import { describeLibraryMutationError } from './library-mutation-formatters.mjs';
import { isCurrentDeletedByTarget, runLibraryDeleteRequest, runLibraryMoveRequest, runLibraryRenameRequest } from './library-mutation-actions.mjs';
import { formatFolderPath, openOptionsFromSnapshot } from './library-paths.mjs';
import { validateLibraryMoveTarget } from './library-drag-drop-contract.mjs';
import { createLibraryActionOrchestratorDeps, createLibraryNavigationDeps } from './library-runtime-dependency-bags.mjs';
import { closeSidebarAfterLibraryOpenRuntime, openEpisodeFromElementRuntime, openNovelFromElementRuntime } from './library-navigation-actions.mjs';
import { toggleLibraryFavoriteRuntime } from './library-favorites-runtime.mjs';
import { applyLibraryNovelPatch } from './library-load-state.mjs';

export const LIBRARY_ACTION_ORCHESTRATOR_BRIDGE_PASS = 'v301-library-action-orchestrator-bridge-pass';

export function createLibraryVirtualDiagnosticsNotifier({ isLibraryVirtualRendererRequested } = {}) {
  return function notifyLibraryVirtualDiagnosticsRuntime(app) {
    try {
      document.dispatchEvent(new CustomEvent('txt-reader:library-virtual-diagnostics', {
        detail: {
          version: app?.state?.version || '',
          active: app?.els?.novelList?.dataset?.libraryVirtualActive === '1',
          requested: typeof isLibraryVirtualRendererRequested === 'function' ? isLibraryVirtualRendererRequested(app) : false,
          at: Date.now()
        }
      }));
    } catch {}
  };
}

export function createLibraryNavigationBridge(baseDeps = {}) {
  const getDeps = () => createLibraryNavigationDeps({
    closeSidebarAfterLibraryOpen,
    ensureNovelEpisodesLoaded: baseDeps.ensureNovelEpisodesLoaded,
    findEpisodeForSnapshot: baseDeps.findEpisodeForSnapshot,
    openOptionsFromSnapshot: baseDeps.openOptionsFromSnapshot,
    persistLibraryUi: baseDeps.persistLibraryUi,
    renderLibrary: baseDeps.renderLibrary,
    toast: baseDeps.toast
  });
  function closeSidebarAfterLibraryOpen(app) { return closeSidebarAfterLibraryOpenRuntime(app); }
  function openNovelFromElement(app, item) { return openNovelFromElementRuntime(app, item, getDeps()); }
  function openEpisodeFromElement(app, item) { return openEpisodeFromElementRuntime(app, item, getDeps()); }
  return { closeSidebarAfterLibraryOpen, openNovelFromElement, openEpisodeFromElement };
}

export function createLibraryFavoritesBridge(baseDeps = {}) {
  function toggleFavorite(app, novelId, options = {}) {
    return toggleLibraryFavoriteRuntime(app, novelId, {
      getLibraryScrollAnchor: baseDeps.getLibraryScrollAnchor,
      persistBookData: baseDeps.persistBookData,
      renderLibrary: baseDeps.renderLibrary,
      toast: baseDeps.toast
    }, options);
  }
  return { toggleFavorite };
}

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
    if (action === 'tags') {
      const target = app?.state?.libraryActionTarget;
      closeListActionSheet(app);
      if (!target || target.type !== 'novel') return null;
      const runtime = await import('./library-user-tags.mjs');
      return runtime.openUserTagDialog(app, target.novel);
    }
    if (action === 'metadata') {
      const target = app?.state?.libraryActionTarget;
      const snapshot = app?.state?.userAccessSnapshot;
      const allowed = !!(snapshot?.userId && (snapshot.metadataAccessAllowed === true || snapshot.appPermissions?.metadataAccess === true));
      closeListActionSheet(app);
      if (!allowed) {
        toast(app, 'warn', '메타데이터 권한', '메타데이터 화면 접근 권한이 없습니다.');
        return null;
      }
      if (!target || target.type !== 'novel') return null;
      const runtime = await import('./library-metadata-runtime.mjs');
      return runtime.openLibraryMetadataModal(app, target.novel, {
        returnFocus: () => {
          const novelId = String(target.novel?.id || '');
          const card = Array.from(app.els?.novelList?.querySelectorAll?.('[data-novel-id]') || []).find(item => String(item.dataset.novelId || '') === novelId);
          return card?.querySelector?.('.library-shelf-menu-btn,.library-action-btn,.library-shelf-open-btn') || card || null;
        },
        refreshLibraryNovel: async patch => {
          const scrollAnchor = baseDeps.getLibraryScrollAnchor?.(app) || null;
          const result = applyLibraryNovelPatch(app.state, patch);
          app.state.libraryShelfFacetsLoaded = false;
          app.state.libraryShelfFacetPatchPending = true;
          baseDeps.renderLibrary?.(app, { source:'metadata-item-patched', followActive:false, scrollAnchor });
          return result;
        },
        refreshLibrary: async () => {
          app.state.libraryShelfFacetsLoaded = false;
          if (app.state.libraryViewMode === 'shelf') {
            await app.library?.loadShelf?.({ reset:true, preserveScroll:true, source:'metadata-updated' });
            return;
          }
          const scrollAnchor = baseDeps.getLibraryScrollAnchor?.(app) || null;
          app.state.libraryFullCatalogLoaded = false;
          await app.library?.loadFullCatalog?.({ force:true, resetScroll:false, scrollAnchor, source:'metadata-updated' });
        }
      });
    }
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
