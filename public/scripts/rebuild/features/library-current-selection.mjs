import { filterLibraryNovels } from './library-model.mjs';

export const LIBRARY_CURRENT_SELECTION_PASS = 'v279-library-current-selection-split-pass';

export function getLibraryCurrentKey(app) {
  const current = app?.state?.current || null;
  if (!current) return '';
  return [String(current.novelId || ''), String(current.episodeId || ''), String(current.path || '')].join('::');
}

export function getLibraryFilteredNovels(app, options = {}) {
  const sourceRef = Array.isArray(app?.state?.novels) ? app.state.novels : [];
  const query = String(app?.state?.libraryFilter || '');
  const sourceLength = sourceRef.length;
  const cached = app?.state?.libraryFilteredNovelsCache || null;
  if (options.allowCache === true
      && cached
      && cached.sourceRef === sourceRef
      && cached.sourceLength === sourceLength
      && cached.query === query) {
    return cached.value;
  }
  const value = filterLibraryNovels(sourceRef, { query });
  if (app?.state) {
    app.state.libraryFilteredNovelsCache = {
      sourceRef,
      sourceLength,
      query,
      value,
      pass: LIBRARY_CURRENT_SELECTION_PASS,
      at: Date.now()
    };
  }
  return value;
}
