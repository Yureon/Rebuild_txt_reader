import { normalizeLibraryTagFacetMinCount } from '../state/app-state.mjs';

export const LIBRARY_SHELF_FACETS_RUNTIME_PASS = 'v603-library-shelf-facets-runtime-pass';

function tagKey(value) {
  return String(value || '').trim().toLocaleLowerCase('ko-KR');
}

export async function loadLibraryShelfFacetsRuntime(app, options = {}, deps = {}) {
  const sync = typeof deps.syncLibraryShelfFilterUi === 'function' ? deps.syncLibraryShelfFilterUi : () => {};
  if (app.state.libraryShelfFacetsLoaded && !options.force) return app.state.libraryShelfFacets;
  if (app.state.libraryShelfFacetsRequest && !options.force) return app.state.libraryShelfFacetsRequest;

  const serial = Math.max(0, Number(app.state.libraryShelfFacetsRequestSerial) || 0) + 1;
  app.state.libraryShelfFacetsRequestSerial = serial;
  if (options.force && app.state.libraryShelfFacetsAbortController) app.state.libraryShelfFacetsAbortController.abort();
  const controller = new AbortController();
  app.state.libraryShelfFacetsAbortController = controller;
  app.state.libraryShelfFacetsLoading = true;
  app.state.libraryShelfFacetsError = '';
  sync(app);

  const request = (async () => {
    const payload = await app.api.novelShelfFilters({ signal:controller.signal });
    const facets = payload?.facets && typeof payload.facets === 'object' ? payload.facets : {};
    const userTags = Array.isArray(payload?.userTags) ? payload.userTags.map(value => String(value || '').trim()).filter(Boolean) : [];
    let tagItems = Array.isArray(facets.tags) ? facets.tags.slice() : [];
    const tagSetting = normalizeLibraryTagFacetMinCount(app?.state?.libraryTagFacetMinCount);
    let tagPageState = {
      nextCursor:String(payload?.tagPage?.nextCursor || ''),
      hasMore:!!payload?.tagPage?.hasMore,
      total:Math.max(tagItems.length, Number(payload?.tagPage?.total) || 0),
      minCount:1,
      loading:false
    };
    if (tagSetting !== 'auto' && typeof app?.api?.novelShelfFilterTags === 'function') {
      const { loadInitialExpandedTagFacets } = await import('./library-tag-browser.mjs');
      const expanded = await loadInitialExpandedTagFacets(app, payload, tagItems, controller.signal, Math.max(1, Number(tagSetting) || 1));
      tagItems = expanded.items;
      tagPageState = { nextCursor:expanded.nextCursor, hasMore:expanded.hasMore, total:expanded.total, minCount:expanded.minCount, loading:false };
    }
    if (serial !== app.state.libraryShelfFacetsRequestSerial) return app.state.libraryShelfFacets;

    const knownTagKeys = new Set(tagItems.map(item => tagKey(item?.value)).filter(Boolean));
    userTags.forEach(value => {
      const key = tagKey(value);
      if (!key || knownTagKeys.has(key)) return;
      knownTagKeys.add(key);
      tagItems.push({ value, count:0 });
    });
    app.state.libraryShelfFacets = {
      authors:Array.isArray(facets.authors) ? facets.authors : [],
      categories:Array.isArray(facets.categories) ? facets.categories : [],
      tags:tagItems,
      publicationStatuses:Array.isArray(facets.publicationStatuses) ? facets.publicationStatuses : [],
      groupKinds:Array.isArray(facets.groupKinds) ? facets.groupKinds : []
    };
    app.state.libraryShelfTagPage = tagPageState;
    app.state.libraryTagRenderOffset = 0;
    app.state.libraryShelfTagSearch = { query:'', items:[], total:0, nextCursor:'', hasMore:false, minCount:1, loading:false, error:'' };
    app.state.libraryShelfFacetNovelTotal = Math.max(0, Number(payload?.total) || 0);
    app.state.libraryShelfFacetUserTags = userTags;
    app.state.libraryShelfTagDistribution = payload?.tagDistribution && typeof payload.tagDistribution === 'object' ? payload.tagDistribution : null;
    app.state.libraryShelfFacetsLoaded = true;
    app.state.libraryShelfFacetsError = '';
    return app.state.libraryShelfFacets;
  })().catch(error => {
    if (serial !== app.state.libraryShelfFacetsRequestSerial || error?.name === 'AbortError') return app.state.libraryShelfFacets;
    app.state.libraryShelfFacetsError = error?.message || String(error);
    throw error;
  }).finally(() => {
    if (serial !== app.state.libraryShelfFacetsRequestSerial) return;
    app.state.libraryShelfFacetsLoading = false;
    app.state.libraryShelfFacetsRequest = null;
    app.state.libraryShelfFacetsAbortController = null;
    sync(app);
  });
  app.state.libraryShelfFacetsRequest = request;
  return request;
}
