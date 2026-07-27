import { toggleLibraryFavoriteRuntime } from './library-favorites-runtime.mjs';

export const LIBRARY_FAVORITES_BRIDGE_PASS = 'v301-library-favorites-bridge-pass';

export function createLibraryFavoritesBridge(baseDeps = {}) {
  function toggleFavorite(app, novelId) {
    return toggleLibraryFavoriteRuntime(app, novelId, {
      getLibraryScrollAnchor: baseDeps.getLibraryScrollAnchor,
      persistBookData: baseDeps.persistBookData,
      renderLibrary: baseDeps.renderLibrary,
      toast: baseDeps.toast
    });
  }

  return { toggleFavorite };
}

export function getLibraryFavoritesBridgeContract() {
  return {
    pass: LIBRARY_FAVORITES_BRIDGE_PASS,
    runtime: 'library-favorites-runtime.mjs',
    operation: 'toggleFavorite'
  };
}
