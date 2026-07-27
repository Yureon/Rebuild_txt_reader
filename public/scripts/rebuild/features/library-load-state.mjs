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
        isVirtualEpisodeGroup: !!item.isVirtualEpisodeGroup,
        episodeGroupingKind: String(item.episodeGroupingKind || ''),
        episodeGroupingPass: String(item.episodeGroupingPass || ''),
        episodeSearchText: String(item.episodeSearchText || ''),
        variantGroupId:String(item.variantGroupId || ''),
        variantCount:Math.max(1, Number(item.variantCount) || 1),
        hiddenVariantCount:Math.max(0, Number(item.hiddenVariantCount) || 0),
        isVariantGroup:!!item.isVariantGroup,
        progressAliases:(Array.isArray(item.progressAliases) ? item.progressAliases : [id]).map(String).filter(Boolean),
        variantMemberIds:(Array.isArray(item.variantMemberIds) ? item.variantMemberIds : (Array.isArray(item.progressAliases) ? item.progressAliases : [id])).map(String).filter(Boolean),
        variants:Array.isArray(item.variants) ? item.variants.filter(value => value && typeof value === 'object') : [],
        episodes
      };
    })
    .filter(item => item.id);
}

export function indexLibraryCatalogById(novels = []) {
  return new Map((Array.isArray(novels) ? novels : []).map(novel => [novel.id, novel]));
}



const LIBRARY_METADATA_PATCH_FIELDS = Object.freeze([
  'title','author','description','synopsis','genres','tags','publicationStatus',
  'publicationYear','sourceLanguage','coverUrl','metadata'
]);

export function applyLibraryNovelPatch(state = {}, patch = {}) {
  if (!state || typeof state !== 'object' || !patch || typeof patch !== 'object') return { updated:0, ids:[] };
  const ids = new Set([
    patch.id,
    ...(Array.isArray(patch.progressAliases) ? patch.progressAliases : [])
  ].map(value => String(value || '')).filter(Boolean));
  if (!ids.size) return { updated:0, ids:[] };
  const matches = novel => {
    if (!novel || typeof novel !== 'object') return false;
    if (ids.has(String(novel.id || ''))) return true;
    return (Array.isArray(novel.progressAliases) ? novel.progressAliases : []).some(alias => ids.has(String(alias || '')));
  };
  const touched = new Set();
  const candidates = [
    ...(Array.isArray(state.libraryShelfItems) ? state.libraryShelfItems : []),
    ...(Array.isArray(state.novels) ? state.novels : []),
    ...Array.from(state.novelById instanceof Map ? state.novelById.values() : []),
    state.current && state.current.novel
  ];
  for (const novel of candidates) {
    if (!matches(novel) || touched.has(novel)) continue;
    touched.add(novel);
    for (const field of LIBRARY_METADATA_PATCH_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(patch, field)) continue;
      const value = patch[field];
      novel[field] = Array.isArray(value) ? value.slice() : value;
    }
    const aliases = Array.from(new Set([
      novel.id,
      ...(Array.isArray(novel.progressAliases) ? novel.progressAliases : []),
      ...(Array.isArray(patch.progressAliases) ? patch.progressAliases : [])
    ].map(value => String(value || '')).filter(Boolean)));
    novel.progressAliases = aliases;
    if (Array.isArray(novel.variantMemberIds)) novel.variantMemberIds = Array.from(new Set([...novel.variantMemberIds.map(String), ...aliases]));
  }
  if (state.novelById instanceof Map) {
    for (const [key, novel] of state.novelById.entries()) {
      if (matches(novel) && touched.has(novel)) state.novelById.set(key, novel);
    }
  }
  resetLibraryDerivedCaches(state);
  state.libraryMetadataPatchSerial = Math.max(0, Number(state.libraryMetadataPatchSerial) || 0) + 1;
  return { updated:touched.size, ids:Array.from(ids), pass:'v648-library-metadata-item-patch-pass' };
}

export function resetLibraryDerivedCaches(state = {}) {
  if (!state || typeof state !== 'object') return;
  state.libraryFilteredNovelsCache = null;
  state.libraryVirtualRowsCache = null;
  state.libraryVirtualWindowRenderCache = null;
  state.libraryVirtualGateCache = null;
  state.libraryVirtualLastRenderSkip = null;
  state.libraryTreeModelCache = null;
}

export function applyLibraryCatalogState(state = {}, payload = []) {
  const novels = normalizeLibraryCatalog(payload);
  state.novels = novels;
  state.novelById = indexLibraryCatalogById(novels);
  resetLibraryDerivedCaches(state);
  return { novels, novelById: state.novelById, pass: LIBRARY_LOAD_STATE_HELPER_PASS };
}
