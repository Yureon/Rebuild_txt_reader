import { closeSidebarAfterLibraryOpenRuntime, openEpisodeFromElementRuntime, openNovelFromElementRuntime } from './library-navigation-actions.mjs';
import { createLibraryNavigationDeps } from './library-runtime-dependency-bags.mjs';

export const LIBRARY_NAVIGATION_BRIDGE_PASS = 'v301-library-navigation-bridge-pass';

export function createLibraryNavigationBridge(baseDeps = {}) {
  const getDeps = () => createLibraryNavigationDeps({
    closeSidebarAfterLibraryOpen,
    findEpisodeForSnapshot: baseDeps.findEpisodeForSnapshot,
    openOptionsFromSnapshot: baseDeps.openOptionsFromSnapshot,
    persistLibraryUi: baseDeps.persistLibraryUi,
    renderLibrary: baseDeps.renderLibrary
  });

  function closeSidebarAfterLibraryOpen(app) {
    return closeSidebarAfterLibraryOpenRuntime(app);
  }

  function openNovelFromElement(app, item) {
    return openNovelFromElementRuntime(app, item, getDeps());
  }

  function openEpisodeFromElement(app, item) {
    return openEpisodeFromElementRuntime(app, item, getDeps());
  }

  return { closeSidebarAfterLibraryOpen, openNovelFromElement, openEpisodeFromElement };
}

export function getLibraryNavigationBridgeContract() {
  return {
    pass: LIBRARY_NAVIGATION_BRIDGE_PASS,
    runtime: 'library-navigation-actions.mjs',
    depsFactory: 'createLibraryNavigationDeps'
  };
}
