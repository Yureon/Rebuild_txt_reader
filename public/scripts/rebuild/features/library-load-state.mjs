export const LIBRARY_LOAD_STATE_HELPER_PASS = 'v227-library-load-state-helper-pass';

function normalizeEpisodeRecord(episode = {}) {
  const id = String(episode?.id || '').trim();
  return {
    ...episode,
    id,
    title: String(episode?.title || episode?.fileName || id || 'Untitled'),
    fileName: String(episode?.fileName || episode?.title || id || '')
  };
}

export function normalizeLibraryCatalog(payload = []) {
  const source = Array.isArray(payload) ? payload : Array.isArray(payload?.novels) ? payload.novels : [];
  return source
    .filter(item => item && typeof item === 'object')
    .map((item) => {
      const id = String(item.id || '').trim();
      const episodes = Array.isArray(item.episodes) ? item.episodes.map(normalizeEpisodeRecord).filter(ep => ep.id) : [];
      return {
        ...item,
        id,
        title: String(item.title || item.fileName || id || 'Untitled'),
        fileName: String(item.fileName || item.title || id || ''),
        categoryPath: String(item.categoryPath || ''),
        category: Array.isArray(item.category) ? item.category : [],
        isMultiFile: !!item.isMultiFile,
        episodeCount: Number(item.episodeCount || episodes.length || (item.isMultiFile ? 0 : 1)) || 0,
        episodes
      };
    })
    .filter(item => item.id);
}

export function indexLibraryCatalogById(novels = []) {
  return new Map((Array.isArray(novels) ? novels : []).map(novel => [novel.id, novel]));
}

export function resetLibraryDerivedCaches(state = {}) {
  if (!state || typeof state !== 'object') return;
  state.libraryFilteredNovelsCache = null;
  state.libraryVirtualRowsCache = null;
  state.libraryVirtualWindowRenderCache = null;
  state.libraryVirtualGateCache = null;
  state.libraryVirtualLastRenderSkip = null;
}

export function applyLibraryCatalogState(state = {}, payload = []) {
  const novels = normalizeLibraryCatalog(payload);
  state.novels = novels;
  state.novelById = indexLibraryCatalogById(novels);
  resetLibraryDerivedCaches(state);
  return { novels, novelById: state.novelById, pass: LIBRARY_LOAD_STATE_HELPER_PASS };
}
