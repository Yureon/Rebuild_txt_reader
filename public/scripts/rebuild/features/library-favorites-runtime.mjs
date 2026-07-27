export const LIBRARY_FAVORITES_RUNTIME_PASS = 'v296-library-favorites-runtime-pass';
export const LIBRARY_VARIANT_FAVORITES_PASS = 'v574-library-variant-favorites-pass';

export function toggleLibraryFavoriteRuntime(app, novelId, deps = {}, options = {}) {
  const id = String(novelId || '');
  if (!id || !app?.state?.favorites) return { changed:false, reason:'missing-novel-id', novelId:id };
  const novel = app.state.novelById?.get?.(id) || app.state.libraryShelfItems?.find?.(item => String(item?.id || '') === id) || null;
  const aliases = Array.from(new Set((Array.isArray(novel?.progressAliases) ? novel.progressAliases : [id]).map(String).filter(Boolean)));
  const wasFavorite = aliases.some(alias => app.state.favorites.has(alias));
  if (wasFavorite) aliases.forEach(alias => app.state.favorites.delete(alias));
  else app.state.favorites.add(id);
  const isFavorite = aliases.some(alias => app.state.favorites.has(alias));
  deps.persistBookData?.(app.state);
  deps.toast?.(app, 'info', '즐겨찾기', isFavorite ? '추가했습니다.' : '해제했습니다.');
  if (options.render !== false) deps.renderLibrary?.(app, { source:'favorite-toggle', scrollAnchor:deps.getLibraryScrollAnchor?.(app) || null, followActive:false });
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
