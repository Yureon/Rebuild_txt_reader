import { normalizeLibraryTagFacetMinCount, persistLibraryUi } from '../state/app-state.mjs';

export const LIBRARY_TAG_FILTER_CONTROLS_PASS = 'v603-library-tag-filter-controls-pass';
const TAG_RENDER_LIMIT = 180;

function tagKey(value) { return String(value || '').trim().toLocaleLowerCase('ko-KR'); }
function mergeFacetItems(...groups) {
  const out = [];
  const seen = new Set();
  for (const group of groups) for (const item of (Array.isArray(group) ? group : [])) {
    const key = tagKey(item?.value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function installLibraryTagFilterControlsRuntime(app, on, deps = {}) {
  const sync = typeof deps.syncLibraryShelfFilterUi === 'function' ? deps.syncLibraryShelfFilterUi : () => {};
  const effectiveMinCount = typeof deps.effectiveLibraryTagFacetMinCount === 'function' ? deps.effectiveLibraryTagFacetMinCount : () => 1;
  const loadFacets = typeof deps.loadLibraryShelfFacets === 'function' ? deps.loadLibraryShelfFacets : async () => {};
  if (app.state.libraryTagSearchTimer) clearTimeout(app.state.libraryTagSearchTimer);
  app.state.libraryTagSearchController?.abort?.();
  app.state.libraryTagLoadMoreController?.abort?.();
  let tagSearchTimer = 0;
  let tagSearchController = null;
  const mergeTagItems = additions => {
    const current = Array.isArray(app.state.libraryShelfFacets?.tags) ? app.state.libraryShelfFacets.tags : [];
    const known = new Set(current.map(item => tagKey(item?.value)).filter(Boolean));
    const next = current.slice();
    for (const item of (Array.isArray(additions) ? additions : [])) {
      const key = tagKey(item?.value);
      if (!key || known.has(key)) continue;
      known.add(key);
      next.push(item);
    }
    app.state.libraryShelfFacets = { ...app.state.libraryShelfFacets, tags:next };
  };

  on(app.els.libraryTagMinCount, 'change', () => {
    app.state.libraryTagFacetMinCount = normalizeLibraryTagFacetMinCount(app.els.libraryTagMinCount?.value);
    app.state.libraryTagFilterQuery = '';
    app.state.libraryTagRenderOffset = 0;
    persistLibraryUi(app.state);
    loadFacets(app, { force:true }).catch(() => {});
  });
  on(app.els.libraryTagFilterSearch, 'input', () => {
    const query = String(app.els.libraryTagFilterSearch?.value || '').trim().slice(0,80);
    app.state.libraryTagFilterQuery = query;
    app.state.libraryTagRenderOffset = 0;
    if (tagSearchTimer) clearTimeout(tagSearchTimer);
    if (tagSearchController) tagSearchController.abort();
    app.state.libraryTagSearchTimer = 0;
    app.state.libraryTagSearchController = null;
    if (!query) {
      app.state.libraryShelfTagSearch = { query:'', items:[], total:0, nextCursor:'', hasMore:false, minCount:1, loading:false, error:'' };
      sync(app);
      return;
    }
    app.state.libraryShelfTagSearch = { query, items:[], total:0, nextCursor:'', hasMore:false, minCount:effectiveMinCount(app.state), loading:true, error:'' };
    sync(app);
    tagSearchTimer = setTimeout(async () => {
      app.state.libraryTagSearchTimer = 0;
      tagSearchController = new AbortController();
      app.state.libraryTagSearchController = tagSearchController;
      try {
        const { searchTagFacets } = await import('./library-tag-browser.mjs');
        const result = await searchTagFacets(app, query, effectiveMinCount(app.state), tagSearchController.signal);
        if (String(app.state.libraryTagFilterQuery || '').trim() !== query) return;
        app.state.libraryShelfTagSearch = { ...result, loading:false, error:'' };
      } catch (error) {
        if (error?.name !== 'AbortError' && String(app.state.libraryTagFilterQuery || '').trim() === query) {
          app.state.libraryShelfTagSearch = { query, items:[], total:0, nextCursor:'', hasMore:false, minCount:effectiveMinCount(app.state), loading:false, error:error?.message || String(error) };
        }
      } finally {
        if (app.state.libraryTagSearchController === tagSearchController) app.state.libraryTagSearchController = null;
        sync(app);
      }
    }, 160);
    app.state.libraryTagSearchTimer = tagSearchTimer;
    if (tagSearchTimer && typeof tagSearchTimer.unref === 'function') tagSearchTimer.unref();
  });
  on(app.els.libraryTagPrevious, 'click', () => {
    app.state.libraryTagRenderOffset = Math.max(0, Math.floor(Number(app.state.libraryTagRenderOffset) || 0) - TAG_RENDER_LIMIT);
    sync(app);
  });
  on(app.els.libraryTagLoadMore, 'click', async () => {
    const query = String(app.state.libraryTagFilterQuery || '').trim();
    const pageState = query ? (app.state.libraryShelfTagSearch || {}) : (app.state.libraryShelfTagPage || {});
    if (pageState.loading) return;
    const loadedCount = query ? Math.max(0, Number(pageState.items?.length) || 0) : Math.max(0, Number(app.state.libraryShelfFacets?.tags?.length) || 0);
    const nextOffset = Math.max(0, Math.floor(Number(app.state.libraryTagRenderOffset) || 0) + TAG_RENDER_LIMIT);
    if (nextOffset < loadedCount) {
      app.state.libraryTagRenderOffset = nextOffset;
      sync(app);
      return;
    }
    if (!pageState.hasMore) return;
    app.state.libraryTagLoadMoreController?.abort?.();
    const controller = new AbortController();
    app.state.libraryTagLoadMoreController = controller;
    if (query) app.state.libraryShelfTagSearch = { ...pageState, loading:true };
    else app.state.libraryShelfTagPage = { ...pageState, loading:true };
    sync(app);
    try {
      if (query) {
        const { loadMoreTagSearchFacets } = await import('./library-tag-browser.mjs');
        const result = await loadMoreTagSearchFacets(app, pageState, controller.signal);
        if (String(app.state.libraryTagFilterQuery || '').trim() !== query) return;
        const items = mergeFacetItems(pageState.items, result.items);
        app.state.libraryShelfTagSearch = { ...result, items, loading:false, error:'' };
        app.state.libraryTagRenderOffset = Math.min(nextOffset, Math.max(0, items.length-1));
      } else {
        const { loadMoreTagFacets } = await import('./library-tag-browser.mjs');
        const result = await loadMoreTagFacets(app, pageState, controller.signal);
        mergeTagItems(result.items);
        app.state.libraryShelfTagPage = { nextCursor:result.nextCursor, hasMore:result.hasMore, total:result.total, minCount:result.minCount, loading:false };
        app.state.libraryTagRenderOffset = Math.min(nextOffset, Math.max(0, Number(app.state.libraryShelfFacets?.tags?.length) || 0));
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        if (query) app.state.libraryShelfTagSearch = { ...pageState, loading:false, error:error?.message || String(error) };
        else app.state.libraryShelfTagPage = { ...pageState, loading:false };
        app.state.libraryShelfFacetsError = error?.message || String(error);
      }
    } finally {
      if (app.state.libraryTagLoadMoreController === controller) app.state.libraryTagLoadMoreController = null;
    }
    sync(app);
  });
}
