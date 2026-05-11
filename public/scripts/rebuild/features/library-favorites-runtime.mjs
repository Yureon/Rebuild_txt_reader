export const LIBRARY_FAVORITES_RUNTIME_PASS = 'v296-library-favorites-runtime-pass';

export function toggleLibraryFavoriteRuntime(app, novelId, deps = {}) {
  const id = String(novelId || '');
  if (!id || !app?.state?.favorites) return { changed:false, reason:'missing-novel-id', novelId:id };
  const wasFavorite = app.state.favorites.has(id);
  if (wasFavorite) app.state.favorites.delete(id);
  else app.state.favorites.add(id);
  const isFavorite = app.state.favorites.has(id);
  deps.persistBookData?.(app.state);
  deps.toast?.(app, 'info', '즐겨찾기', isFavorite ? '추가했습니다.' : '해제했습니다.');
  deps.renderLibrary?.(app, { source:'favorite-toggle', scrollAnchor:deps.getLibraryScrollAnchor?.(app) || null, followActive:false });
  return { changed:true, novelId:id, wasFavorite, isFavorite };
}

export function getLibraryFavoritesRuntimeContract() {
  return {
    pass: LIBRARY_FAVORITES_RUNTIME_PASS,
    owns: ['favorite-set-toggle', 'favorite-persistence', 'favorite-toast', 'favorite-render-refresh'],
    injectedBoundaries: ['book-data-persistence', 'toast', 'render-library', 'scroll-anchor'],
    nonGoals: ['row-dom-rendering', 'action-sheet-routing', 'reader-navigation']
  };
}
