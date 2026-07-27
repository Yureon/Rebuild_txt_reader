import { createEl, installImageFallback } from '../core/utils.mjs';
import { persistLibraryUi } from '../state/app-state.mjs';
import { applyLibraryCatalogState, normalizeLibraryCatalog, resetLibraryDerivedCaches } from './library-load-state.mjs';
import { getCategoryParts, getProgressRatioForState, isNovelFavoriteForState } from './library-model.mjs';
import { novelMatchesNavigationTarget } from './library-navigation-context.mjs';
import { installLibraryShelfFilterControls, libraryShelfFilterSignature, syncLibraryShelfFilterUi } from './library-shelf-filters.mjs';
import { applyLibraryHeaderCompactState, createLibraryHeaderScrollState } from './library-header-scroll-state.mjs';

export const LIBRARY_SHELF_RUNTIME_PASS = 'v567-library-shelf-runtime-pass';
export const LIBRARY_SHELF_APPEND_RENDER_PASS = 'v567-library-shelf-append-render-pass';
export const LIBRARY_EPISODE_LRU_PASS = 'v567-library-episode-lru-pass';
export const LIBRARY_SHELF_DOM_BUDGET_PASS = 'v569-library-shelf-dom-budget-pass';
export const LIBRARY_SHELF_PAGE_SIZE = 48;
export const LIBRARY_SHELF_DOM_LIMIT = 480;
export const LIBRARY_SHELF_MOBILE_DOM_LIMIT = 192;
export const LIBRARY_SHELF_ADAPTIVE_DOM_PASS = 'v598-library-shelf-adaptive-dom-pass';
export const LIBRARY_SHELF_AUTOLOAD_PASS = 'v581-library-shelf-autoload-pass';
export const LIBRARY_SHELF_AUTOLOAD_COOLDOWN_MS = 1200;
export const LIBRARY_TREE_LAZY_CATALOG_PASS = 'v575-library-tree-lazy-catalog-pass';
export const LIBRARY_TREE_PAGED_CATALOG_PASS = 'v677-library-tree-paged-catalog-pass';
export const LIBRARY_FOCUS_RESTORE_PASS = 'v575-library-focus-restore-pass';
export const LIBRARY_SHELF_REQUEST_STABILITY_PASS = 'v646-library-shelf-request-stability-pass';
export const LIBRARY_SHELF_REQUEST_MAX_RETRIES = 3;

export function resolveLibraryShelfDomLimit(state = {}) {
  const configured = Number(state.libraryShelfDomLimit) || LIBRARY_SHELF_DOM_LIMIT;
  const mobile = typeof window !== 'undefined' && (
    window.matchMedia?.('(max-width: 700px)')?.matches === true ||
    Number(window.innerWidth) <= 700 ||
    document.body?.dataset?.clientProfile === 'mobile'
  );
  const cap = mobile ? LIBRARY_SHELF_MOBILE_DOM_LIMIT : LIBRARY_SHELF_DOM_LIMIT;
  return Math.max(LIBRARY_SHELF_PAGE_SIZE * 2, Math.min(configured, cap));
}

function validDensity(value) {
  return ['compact','default','large'].includes(String(value || '')) ? String(value) : 'default';
}

function validScope(value) {
  return ['all', 'favorites', 'recent'].includes(String(value || '')) ? String(value) : 'all';
}

export function removeLibraryRecentNovelState(state = {}, novelId = '') {
  const id = String(novelId || '');
  const recents = Array.isArray(state?.recents) ? state.recents : [];
  if (!id || !recents.length) return { changed:false, novelId:id, removed:0 };
  const novel = state.novelById?.get?.(id) || state.libraryShelfItems?.find?.(item => String(item?.id || '') === id) || null;
  const aliases = new Set([id, ...(Array.isArray(novel?.progressAliases) ? novel.progressAliases : [])].map(String).filter(Boolean));
  const next = recents.filter(item => !aliases.has(String(item?.novelId || item?.id || '')));
  const removed = recents.length - next.length;
  if (!removed) return { changed:false, novelId:id, removed:0 };
  state.recents = next;
  return { changed:true, novelId:id, removed };
}

function validSort(value, scope = 'all') {
  const raw = String(value || '');
  if (raw === 'recent') return 'recent';
  return scope === 'recent' ? 'recent' : 'title';
}

function shelfKey(app) {
  return [validScope(app?.state?.libraryShelfScope), validSort(app?.state?.libraryShelfSort, app?.state?.libraryShelfScope), String(app?.state?.libraryFilter || '').trim(), libraryShelfFilterSignature(app?.state?.libraryShelfFilters)].join('::');
}

function upsertCatalogNovel(app, incoming) {
  const id = String(incoming?.id || '');
  if (!id) return null;
  const existing = app.state.novelById?.get?.(id) || null;
  const keepEpisodes = existing && Array.isArray(existing.episodes) && existing.episodes.length > 0;
  const merged = {
    ...(existing || {}),
    ...incoming,
    episodes: keepEpisodes ? existing.episodes : (Array.isArray(incoming.episodes) ? incoming.episodes : []),
    episodesLoaded: keepEpisodes || incoming.episodesLoaded === true || !incoming.isMultiFile
  };
  app.state.novelById.set(id, merged);
  return merged;
}

function replaceShelfItems(app, incomingItems, append = false) {
  const previous = append ? (Array.isArray(app.state.libraryShelfItems) ? app.state.libraryShelfItems : []) : [];
  const appendFrom = previous.length;
  const byId = new Map(previous.map(item => [String(item?.id || ''), item]).filter(([id]) => id));
  for (const item of incomingItems) {
    const merged = upsertCatalogNovel(app, item);
    if (merged) byId.set(merged.id, merged);
  }
  let nextItems = Array.from(byId.values());
  const limit = resolveLibraryShelfDomLimit(app.state);
  const prunedCount = append ? Math.max(0, nextItems.length - limit) : 0;
  const prunedItems = prunedCount ? nextItems.slice(0, prunedCount) : [];
  if (prunedCount) nextItems = nextItems.slice(prunedCount);
  app.state.libraryShelfItems = nextItems;
  if (prunedItems.length && app.state.novelById?.delete) {
    const retainedIds = new Set(nextItems.map(item => String(item?.id || '')).filter(Boolean));
    const protectedIds = new Set([
      String(app.state.current?.novel?.id || ''),
      String(app.state.progress?.lastRead?.novelId || ''),
      ...Array.from(app.state.favorites || []).map(String)
    ].filter(Boolean));
    let removed = 0;
    for (const item of prunedItems) {
      const id = String(item?.id || '');
      const catalogItem = id ? app.state.novelById.get(id) : null;
      if (!id || retainedIds.has(id) || protectedIds.has(id) || catalogItem?._episodesRequest) continue;
      if (app.state.novelById.delete(id)) removed += 1;
    }
    app.state.libraryShelfPrunedNovelMapCount = Math.max(0, Number(app.state.libraryShelfPrunedNovelMapCount) || 0) + removed;
  }
  app.state.libraryShelfLoadedCount = append
    ? Math.max(Number(app.state.libraryShelfLoadedCount) || previous.length, Number(app.state.libraryShelfDroppedCount) + previous.length) + incomingItems.length
    : incomingItems.length;
  app.state.libraryShelfDroppedCount = append ? Math.max(0, Number(app.state.libraryShelfDroppedCount) || 0) + prunedCount : 0;
  app.state.libraryShelfPrunedLastCount = prunedCount;
  app.state.libraryShelfAppendFrom = append ? Math.max(0, appendFrom - prunedCount) : -1;
  if (!app.state.libraryFullCatalogLoaded) app.state.novels = app.state.libraryShelfItems.slice();
  resetLibraryDerivedCaches(app.state);
}

function touchEpisodeCache(app, novel) {
  if (!app?.state || !novel?.isMultiFile || app.state.libraryFullCatalogLoaded) return;
  const id = String(novel.id || '');
  if (!id) return;
  const lru = Array.isArray(app.state.libraryEpisodeCacheLru) ? app.state.libraryEpisodeCacheLru : [];
  const next = lru.filter(item => String(item) !== id);
  next.push(id);
  const limit = Math.max(2, Number(app.state.libraryEpisodeCacheLimit) || 12);
  const protectedIds = new Set([
    id,
    String(app.state.current?.novel?.id || ''),
    String(app.state.progress?.lastRead?.novelId || '')
  ].filter(Boolean));
  let guard = next.length + 2;
  while (next.length > limit && guard-- > 0) {
    const victimId = String(next.shift() || '');
    if (!victimId) continue;
    if (protectedIds.has(victimId)) {
      next.push(victimId);
      continue;
    }
    const victim = app.state.novelById?.get?.(victimId);
    if (!victim || victim._episodesRequest) continue;
    victim.episodes = [];
    victim.episodesLoaded = false;
  }
  app.state.libraryEpisodeCacheLru = next.slice(-limit);
}

function setShelfLoading(app, loading, error = '') {
  app.state.libraryShelfLoading = !!loading;
  app.state.libraryShelfError = String(error || '');
}


function captureShelfScrollView(box) {
  if (!box) return null;
  let boxTop = 0;
  try { boxTop = Number(box.getBoundingClientRect?.().top) || 0; } catch {}
  let anchorId = '';
  let anchorOffset = 0;
  for (const card of Array.from(box.querySelectorAll?.('.library-shelf-card[data-novel-id]') || [])) {
    let rect = null;
    try { rect = card.getBoundingClientRect?.(); } catch {}
    if (!rect || Number(rect.bottom) < boxTop + 1) continue;
    anchorId = String(card.dataset.novelId || '');
    anchorOffset = Math.round((Number(rect.top) || boxTop) - boxTop);
    break;
  }
  const maxTop = Math.max(0,(Number(box.scrollHeight)||0) - (Number(box.clientHeight)||0));
  const scrollTop = Math.max(0,Number(box.scrollTop)||0);
  return {
    anchorId,
    anchorOffset,
    scrollTop,
    bottomDistance:Math.max(0,Math.round(maxTop - Math.min(maxTop,scrollTop))),
    nearBottom:maxTop - scrollTop <= Math.max(96,Math.min(240,Math.round((Number(box.clientHeight)||0)*0.35)||160))
  };
}

function restoreShelfScrollView(box, snapshot) {
  if (!box || !snapshot) return false;
  if (snapshot.nearBottom) {
    const maxTop = Math.max(0,(Number(box.scrollHeight)||0) - (Number(box.clientHeight)||0));
    box.scrollTop = Math.max(0,maxTop - Math.max(0,Number(snapshot.bottomDistance)||0));
    return true;
  }
  const anchor = snapshot.anchorId
    ? Array.from(box.querySelectorAll?.('.library-shelf-card[data-novel-id]') || []).find(card => String(card.dataset.novelId || '') === snapshot.anchorId)
    : null;
  if (anchor) {
    let boxTop = 0;
    let anchorTop = 0;
    try {
      boxTop = Number(box.getBoundingClientRect?.().top) || 0;
      anchorTop = Number(anchor.getBoundingClientRect?.().top) || boxTop;
    } catch {}
    const delta = Math.round(anchorTop - boxTop - (Number(snapshot.anchorOffset)||0));
    if (Math.abs(delta) > 1) box.scrollTop = Math.max(0,(Number(box.scrollTop)||0) + delta);
    return true;
  }
  const maxTop = Math.max(0,(Number(box.scrollHeight)||0) - (Number(box.clientHeight)||0));
  box.scrollTop = Math.min(maxTop,Math.max(0,Number(snapshot.scrollTop)||0));
  return false;
}

export function loadLibraryShelfPageRuntime(app, options = {}, deps = {}) {
  const reset = options.reset !== false;
  const preserveScroll = reset && options.preserveScroll === true;
  const shelfScrollView = preserveScroll ? captureShelfScrollView(app?.els?.novelList) : null;
  const requestKey = shelfKey(app);
  if (!reset && !app.state.libraryShelfNextCursor) return Promise.resolve({ loaded:false, reason:'end' });
  if (!reset && app.state.libraryShelfLoading) return Promise.resolve({ loaded:false, reason:'busy' });
  if (reset && app.state.libraryShelfRequestPromise && app.state.libraryShelfRequestKey === requestKey) {
    return app.state.libraryShelfRequestPromise;
  }

  const run = (async () => {
    if (reset) {
      app.state.libraryShelfAbortController?.abort?.();
      clearTimeout(app.state.libraryShelfAutoLoadTimer || 0);
      app.state.libraryShelfAutoLoadTimer = 0;
      app.state.libraryShelfAutoLoadActivitySerial = 0;
      app.state.libraryShelfAutoLoadLastRequestActivitySerial = 0;
    }
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    app.state.libraryShelfAbortController = controller;
    const serial = (Number(app.state.libraryShelfRequestSerial) || 0) + 1;
    app.state.libraryShelfRequestSerial = serial;
    const hadVisibleItems = Array.isArray(app.state.libraryShelfItems) && app.state.libraryShelfItems.length > 0;
    setShelfLoading(app, true, '');
    deps.syncLibraryChrome?.(app);
    deps.renderLibrary?.(app, { source:reset ? 'shelf-load-start' : 'shelf-load-more-start', followActive:false, shelfScrollView });

    const requestPayload = async () => {
      let attempt = 0;
      while (true) {
        try {
          return await app.api.novelShelf({
            scope: validScope(app.state.libraryShelfScope),
            sort: validSort(app.state.libraryShelfSort, app.state.libraryShelfScope),
            query: String(app.state.libraryFilter || '').trim(),
            cursor: reset ? '' : String(app.state.libraryShelfNextCursor || ''),
            limit: LIBRARY_SHELF_PAGE_SIZE,
            focusNovelId: reset && app.state.libraryNavigationTarget?.shelfPending ? String(app.state.libraryNavigationTarget.novelId || '') : '',
            filters: app.state.libraryShelfFilters || {}
          }, controller ? { signal:controller.signal } : undefined);
        } catch (error) {
          if (controller?.signal?.aborted || error?.name === 'AbortError') throw error;
          const retryable = [429, 502, 503, 504].includes(Number(error?.status))
            || ['library_warming','library_shelf_busy'].includes(String(error?.code || ''))
            || error instanceof TypeError;
          const maxRetries = hadVisibleItems ? 1 : LIBRARY_SHELF_REQUEST_MAX_RETRIES;
          if (!retryable || attempt >= maxRetries) throw error;
          const retryAfterMs = Math.max(0, Number(error?.retryAfterSeconds) || Number(error?.data?.retryAfterSeconds) || 0) * 1000;
          const exponentialMs = Math.min(5000, 500 * (2 ** attempt));
          const jitterMs = Math.floor(Math.random() * 250);
          const waitMs = Math.max(retryAfterMs, exponentialMs + jitterMs);
          attempt += 1;
          app.state.libraryShelfRetryAttempt = attempt;
          app.state.libraryShelfRetryAt = Date.now() + waitMs;
          deps.syncLibraryChrome?.(app);
          await new Promise((resolve, reject) => {
            let settled = false;
            const finish = callback => {
              if (settled) return;
              settled = true;
              controller?.signal?.removeEventListener?.('abort', abort);
              callback();
            };
            const timer = setTimeout(() => finish(resolve), waitMs);
            const abort = () => {
              clearTimeout(timer);
              finish(() => reject(Object.assign(new Error('aborted'), { name:'AbortError' })));
            };
            if (controller?.signal?.aborted) return abort();
            controller?.signal?.addEventListener?.('abort', abort, { once:true });
          });
        }
      }
    };

    try {
      const payload = await requestPayload();
      if (serial !== app.state.libraryShelfRequestSerial) return { loaded:false, reason:'superseded' };
      const normalized = normalizeLibraryCatalog(payload?.items || []).map(item => ({
        ...item,
        episodesLoaded: item.episodesLoaded === true || !item.isMultiFile
      }));
      replaceShelfItems(app, normalized, !reset);
      app.state.libraryShelfNextCursor = String(payload?.nextCursor || '');
      app.state.libraryShelfTotal = Math.max(0, Number(payload?.total) || app.state.libraryShelfItems.length);
      app.state.libraryShelfCounts = payload?.counts && typeof payload.counts === 'object' ? payload.counts : {};
      app.state.libraryShelfFocus = payload?.focus && typeof payload.focus === 'object' ? payload.focus : null;
      app.state.libraryShelfLoadedKey = requestKey;
      app.state.libraryCatalogMode = 'shelf';
      app.state.libraryShelfRetryAttempt = 0;
      app.state.libraryShelfRetryAt = 0;
      setShelfLoading(app, false, '');
      deps.syncLibraryChrome?.(app);
      const focusRequested = reset && !!app.state.libraryNavigationTarget?.shelfPending;
      deps.renderLibrary?.(app, {
        source:reset ? 'shelf-load-complete' : 'shelf-load-more-complete',
        resetScroll:reset && !focusRequested && !preserveScroll,
        followActive:focusRequested,
        shelfScrollView
      });
      if (focusRequested) app.state.libraryNavigationTarget.shelfPending = false;
      return { loaded:true, count:normalized.length, total:app.state.libraryShelfTotal, nextCursor:app.state.libraryShelfNextCursor, focus:app.state.libraryShelfFocus, pass:LIBRARY_SHELF_REQUEST_STABILITY_PASS };
    } catch (error) {
      if (serial !== app.state.libraryShelfRequestSerial || error?.name === 'AbortError') return { loaded:false, reason:'superseded-error' };
      setShelfLoading(app, false, error?.message || String(error));
      deps.syncLibraryChrome?.(app);
      // A transient refresh failure must not erase a previously rendered shelf.
      if (!hadVisibleItems) deps.renderLibrary?.(app, { source:'shelf-load-error', followActive:false });
      else deps.renderLibrary?.(app, { source:'shelf-load-stale-preserved', followActive:false, shelfScrollView });
      deps.toast?.(app, 'error', hadVisibleItems ? '기존 서재 목록 유지' : '서재 불러오기 실패', error?.message || String(error));
      throw error;
    } finally {
      if (serial === app.state.libraryShelfRequestSerial && app.state.libraryShelfAbortController === controller) {
        app.state.libraryShelfAbortController = null;
      }
    }
  })();

  if (reset) {
    app.state.libraryShelfRequestKey = requestKey;
    const sharedPromise = run.finally(() => {
      if (app.state.libraryShelfRequestPromise === sharedPromise) {
        app.state.libraryShelfRequestPromise = null;
        app.state.libraryShelfRequestKey = '';
      }
    });
    app.state.libraryShelfRequestPromise = sharedPromise;
    return sharedPromise;
  }
  return run;
}

export async function prepareTreeNavigationTargetRuntime(app) {
  const target = app?.state?.libraryNavigationTarget || null;
  if (!target?.treePending || !target.novelId) return { prepared:false, reason:'no-target' };
  let novel = app.state.novelById?.get?.(String(target.novelId)) || null;
  if (!novel) {
    novel = (app.state.novels || []).find(item => novelMatchesNavigationTarget(item, target)) || null;
  }
  if (!novel) return { prepared:false, reason:'not-found' };
  const parts = getCategoryParts(novel);
  for (let index = 1; index <= parts.length; index += 1) app.state.collapsedFolders.delete(parts.slice(0, index).join('>'));
  let episode = null;
  if (target.episodeId && novel.isMultiFile) {
    await ensureNovelEpisodesLoadedRuntime(app, novel);
    episode = (novel.episodes || []).find(item => String(item?.id || '') === String(target.episodeId)) || null;
    app.state.expandedEpisodeNovels.add(novel.id);
  }
  app.state.current = { novel, episode, novelId:novel.id, episodeId:episode?.id || '', path:'' };
  target.treePending = false;
  return { prepared:true, novel, episode, pass:LIBRARY_FOCUS_RESTORE_PASS };
}

function mergeLibraryTreePage(app, payload = {}, options = {}, deps = {}) {
  const normalized = normalizeLibraryCatalog(payload?.items || []);
  if (options.reset !== false) {
    deps.applyLibraryCatalogState?.(app.state, normalized);
  } else {
    const existingIds = new Set((Array.isArray(app.state.novels) ? app.state.novels : []).map(item => String(item?.id || '')).filter(Boolean));
    if (!(app.state.novelById instanceof Map)) app.state.novelById = new Map();
    for (const item of normalized) {
      const merged = upsertCatalogNovel(app, item);
      if (merged && !existingIds.has(merged.id)) {
        app.state.novels.push(merged);
        existingIds.add(merged.id);
      }
    }
    resetLibraryDerivedCaches(app.state);
  }
  app.state.novels.forEach(novel => { novel.episodesLoaded = novel.episodesLoaded === true || !novel.isMultiFile; });
  app.state.libraryTreeNextCursor = String(payload?.nextCursor || '');
  app.state.libraryTreeTotal = Math.max(app.state.novels.length, Number(payload?.total) || 0);
  app.state.libraryTreeLoadedCount = app.state.novels.length;
  app.state.libraryFullCatalogLoaded = !app.state.libraryTreeNextCursor;
  app.state.libraryCatalogMode = 'tree';
  return normalized;
}

export async function loadFullLibraryCatalogRuntime(app, options = {}, deps = {}) {
  if (app.state.libraryCatalogMode === 'tree' && Array.isArray(app.state.novels) && app.state.novels.length && !options.force) {
    await prepareTreeNavigationTargetRuntime(app);
    deps.syncLibraryChrome?.(app);
    deps.renderLibrary?.(app, { source:'tree-page-cache', resetScroll:!!options.resetScroll && !app.state.current, followActive:!!app.state.current, scrollAnchor:options.scrollAnchor || null });
    return app.state.novels;
  }
  if (app.state.libraryFullCatalogRequest && !options.force) return app.state.libraryFullCatalogRequest;
  setShelfLoading(app, true, '');
  deps.syncLibraryChrome?.(app);
  deps.showLoading?.(app, true);
  deps.status?.(app, 'sync', '파일 탐색 첫 목록 불러오는 중…');
  const request = (async () => {
    try {
      const focusNovelId = String(app.state.libraryNavigationTarget?.novelId || app.state.current?.novel?.id || '');
      const payload = await app.api.novelTree({ limit:Math.max(100, Number(app.state.libraryTreePageSize) || 1000), focusNovelId });
      mergeLibraryTreePage(app, payload, { reset:true }, deps);
      await prepareTreeNavigationTargetRuntime(app);
      setShelfLoading(app, false, '');
      deps.syncLibraryChrome?.(app);
      deps.renderLibrary?.(app, { source:'tree-page-loaded', resetScroll:options.resetScroll !== false && !app.state.current, followActive:!!app.state.current, scrollAnchor:options.scrollAnchor || null });
      deps.status?.(app, 'sync', app.state.libraryTreeNextCursor
        ? `파일 탐색 ${app.state.libraryTreeLoadedCount.toLocaleString()} / ${app.state.libraryTreeTotal.toLocaleString()}개 로드`
        : '파일 탐색 목록 동기화 완료');
      return app.state.novels;
    } catch (error) {
      setShelfLoading(app, false, error?.message || String(error));
      deps.syncLibraryChrome?.(app);
      deps.status?.(app, 'sync', '파일 탐색 목록 불러오기 실패');
      deps.toast?.(app, 'error', '파일 탐색 목록 실패', error?.message || String(error));
      throw error;
    } finally {
      deps.showLoading?.(app, false);
      app.state.libraryFullCatalogRequest = null;
    }
  })();
  app.state.libraryFullCatalogRequest = request;
  return request;
}

export async function loadMoreLibraryTreeRuntime(app, options = {}, deps = {}) {
  const cursor = String(app?.state?.libraryTreeNextCursor || '');
  if (!cursor || app.state.libraryTreeLoadingMore) return { loaded:0, hasMore:!!cursor };
  app.state.libraryTreeLoadingMore = true;
  deps.syncLibraryChrome?.(app);
  try {
    const payload = await app.api.novelTree({ cursor, limit:Math.max(100, Number(app.state.libraryTreePageSize) || 1000) });
    const before = app.state.novels.length;
    mergeLibraryTreePage(app, payload, { reset:false }, deps);
    const loaded = Math.max(0, app.state.novels.length - before);
    deps.renderLibrary?.(app, { source:'tree-page-appended', resetScroll:false, followActive:false, scrollAnchor:options.scrollAnchor || null });
    deps.status?.(app, 'sync', app.state.libraryTreeNextCursor
      ? `파일 탐색 ${app.state.libraryTreeLoadedCount.toLocaleString()} / ${app.state.libraryTreeTotal.toLocaleString()}개 로드`
      : '파일 탐색 전체 목록 동기화 완료');
    return { loaded, hasMore:!!app.state.libraryTreeNextCursor, pass:LIBRARY_TREE_PAGED_CATALOG_PASS };
  } catch (error) {
    deps.toast?.(app, 'error', '다음 탐색 목록 실패', error?.message || String(error));
    throw error;
  } finally {
    app.state.libraryTreeLoadingMore = false;
    deps.syncLibraryChrome?.(app);
  }
}

export async function ensureShelfNovelLoadedRuntime(app, novelId) {
  const id = String(novelId || '');
  if (!id) return null;
  const existing = app.state.novelById?.get?.(id) || null;
  if (existing) return existing;
  const payload = await app.api.novelMeta(id);
  const normalized = normalizeLibraryCatalog(payload?.novel ? [payload.novel] : [])[0] || null;
  if (!normalized) return null;
  normalized.episodesLoaded = normalized.episodesLoaded === true || !normalized.isMultiFile;
  const merged = upsertCatalogNovel(app, normalized);
  if (merged && !app.state.libraryFullCatalogLoaded && !app.state.novels.some(item => item.id === merged.id)) app.state.novels.push(merged);
  return merged;
}

export async function ensureNovelEpisodesLoadedRuntime(app, novelOrId) {
  const id = typeof novelOrId === 'string' ? novelOrId : String(novelOrId?.id || '');
  let novel = typeof novelOrId === 'object' && novelOrId ? novelOrId : app.state.novelById?.get?.(id) || null;
  if (!novel) novel = await ensureShelfNovelLoadedRuntime(app, id);
  if (!novel || !novel.isMultiFile) return novel;
  if (novel.episodesLoaded === true && Array.isArray(novel.episodes) && novel.episodes.length) {
    touchEpisodeCache(app, novel);
    return novel;
  }
  if (novel._episodesRequest) return novel._episodesRequest;
  novel._episodesRequest = (async () => {
    const payload = await app.api.novelEpisodes(novel.id);
    const normalized = normalizeLibraryCatalog([{ ...novel, episodes:payload?.episodes || [], episodesLoaded:true }])[0];
    novel.episodes = normalized?.episodes || [];
    novel.episodeCount = Number(normalized?.episodeCount || novel.episodeCount || novel.episodes.length) || novel.episodes.length;
    novel.episodesLoaded = true;
    delete novel._episodesRequest;
    resetLibraryDerivedCaches(app.state);
    touchEpisodeCache(app, novel);
    return novel;
  })().catch(error => {
    delete novel._episodesRequest;
    throw error;
  });
  return novel._episodesRequest;
}

export async function switchLibraryViewRuntime(app, mode, deps = {}) {
  const next = ['files','explorer'].includes(mode) ? mode : 'shelf';
  if (app.state.libraryViewMode === next && !(next === 'shelf' && !app.state.libraryShelfItems.length)) {
    deps.syncLibraryChrome?.(app);
    if (next === 'files') await prepareTreeNavigationTargetRuntime(app);
    deps.renderLibrary?.(app, { source:'library-view-same', followActive:next === 'files' && !!app.state.current });
    return next;
  }
  if (next !== 'shelf') {
    app.state.libraryShelfAbortController?.abort?.();
    app.state.libraryShelfAbortController = null;
    setShelfLoading(app, false, '');
  }
  app.state.libraryViewMode = next;
  persistLibraryUi(app.state);
  deps.syncLibraryChrome?.(app);
  if (next !== 'shelf') await deps.loadFullCatalog?.(app, { resetScroll:next === 'explorer' || !app.state.libraryNavigationTarget?.treePending });
  else {
    if (app.state.libraryNavigationTarget?.novelId) app.state.libraryNavigationTarget.shelfPending = true;
    await deps.loadShelfPage?.(app, { reset:true });
  }
  return next;
}

export async function setLibraryShelfScopeRuntime(app, scope, deps = {}) {
  const next = validScope(scope);
  if (app.state.libraryShelfScope === next && app.state.libraryShelfItems.length) return next;
  app.state.libraryNavigationPersistedUi = null;
  app.state.libraryShelfScope = next;
  app.state.libraryShelfSort = next === 'recent' ? 'recent' : 'title';
  persistLibraryUi(app.state);
  deps.syncLibraryChrome?.(app);
  await deps.loadShelfPage?.(app, { reset:true });
  return next;
}

export function syncLibraryShelfChromeRuntime(app) {
  const mode = ['files','explorer'].includes(app?.state?.libraryViewMode) ? app.state.libraryViewMode : 'shelf';
  const shelfMode = mode === 'shelf';
  const scope = validScope(app?.state?.libraryShelfScope);
  document.body?.classList.toggle('library-shelf-mode', shelfMode);
  document.body?.classList.toggle('library-tree-mode', mode === 'files');
  document.body?.classList.toggle('library-explorer-mode', mode === 'explorer');
  if (document.body) document.body.dataset.libraryDensity = validDensity(app?.state?.libraryShelfDensity);
  app.els.sidebar?.classList.toggle('library-shelf-sidebar', shelfMode);
  if (app.els.libraryPanelTitle) app.els.libraryPanelTitle.textContent = '서재';
  if (app.els.search) app.els.search.placeholder = shelfMode ? '작품명 또는 폴더 검색' : (mode === 'explorer' ? '현재 서재에서 작품·폴더 검색' : '작품·회차·파일 검색');
  [app.els.libraryViewShelf, app.els.libraryViewFiles, app.els.libraryViewExplorer].forEach(button => {
    if (!button) return;
    const active = button.dataset.libraryView === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
    button.tabIndex = active ? 0 : -1;
  });
  if (app.els.libraryScopeTabs) app.els.libraryScopeTabs.hidden = !shelfMode;
  if (app.els.libraryUserTagsBtn) app.els.libraryUserTagsBtn.hidden = !shelfMode;
  if (app.els.libraryShelfSummary) app.els.libraryShelfSummary.hidden = !shelfMode;
  if (app.els.libraryFilterPopover) app.els.libraryFilterPopover.hidden = !shelfMode;
  if (app.els.libraryActiveFilters) app.els.libraryActiveFilters.hidden = !shelfMode || !app.els.libraryActiveFilters.children.length;
  if (shelfMode) syncLibraryShelfFilterUi(app);
  if (app.els.libraryQuickList) app.els.libraryQuickList.hidden = shelfMode || !app.els.libraryQuickList.children.length;
  const bulk = app.els.expandAllBtn?.closest?.('.folder-bulk-actions');
  if (bulk) bulk.hidden = shelfMode;
  [app.els.libraryScopeAll, app.els.libraryScopeFavorites, app.els.libraryScopeRecent].forEach(button => {
    if (!button) return;
    const active = button.dataset.libraryScope === scope;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
    button.tabIndex = active ? 0 : -1;
  });
  const counts = app.state.libraryShelfCounts || {};
  const hasCount = key => Object.prototype.hasOwnProperty.call(counts, key);
  if (app.els.libraryScopeAllCount) app.els.libraryScopeAllCount.textContent = String(Math.max(0, hasCount('all') ? Number(counts.all) || 0 : (scope === 'all' ? app.state.libraryShelfTotal : 0)));
  if (app.els.libraryScopeFavoritesCount) app.els.libraryScopeFavoritesCount.textContent = String(Math.max(0, hasCount('favorites') ? Number(counts.favorites) || 0 : app.state.favorites?.size || 0));
  if (app.els.libraryScopeRecentCount) {
    const recentIds = new Set((app.state.recents || []).map(item => String(item?.novelId || '')).filter(Boolean));
    app.els.libraryScopeRecentCount.textContent = String(Math.max(0, hasCount('recent') ? Number(counts.recent) || 0 : recentIds.size));
  }
  if (app.els.libraryShelfSummary && shelfMode) {
    if (app.state.libraryShelfLoading && !app.state.libraryShelfItems.length) app.els.libraryShelfSummary.textContent = '서재를 불러오는 중…';
    else if (app.state.libraryShelfError) app.els.libraryShelfSummary.textContent = `불러오기 실패 · ${app.state.libraryShelfError}`;
    else app.els.libraryShelfSummary.textContent = `${Math.max(app.state.libraryShelfLoadedCount, app.state.libraryShelfItems.length).toLocaleString('ko-KR')} / ${Math.max(app.state.libraryShelfTotal, app.state.libraryShelfLoadedCount, app.state.libraryShelfItems.length).toLocaleString('ko-KR')} 작품`;
  }
}

function coverHue(title) {
  let hash = 0;
  for (const ch of String(title || '')) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return Math.abs(hash) % 360;
}

function createShelfCard(app, novel) {
  const title = String(novel?.title || novel?.fileName || 'Untitled');
  const active = String(app.state.current?.novel?.id || '') === String(novel.id || '') || novelMatchesNavigationTarget(novel, app.state.libraryNavigationTarget);
  const ratio = getProgressRatioForState(app.state, novel);
  const percent = Math.round(Math.max(0, Math.min(1, Number(ratio) || 0)) * 100);
  const favorite = isNovelFavoriteForState(app.state, novel);
  const countLabel = novel.isMultiFile ? `${Math.max(0, Number(novel.episodeCount) || 0)}화` : '단일 작품';
  const category = String(novel.categoryPath || '').split(/\s*>\s*|\//).filter(Boolean).slice(-1)[0] || '서재';
  const coverLetter = () => createEl('span', { class:'library-shelf-cover-letter', text:title.trim().slice(0, 1) || 'T', dataset:{ assetFallback:'cover' } });
  const cover = novel.coverUrl
    ? installImageFallback(
      createEl('img', { class:'library-shelf-cover-image', src:novel.coverUrl, alt:'', loading:'lazy', decoding:'async' }),
      coverLetter,
      { label:'library-cover', url:novel.coverUrl }
    )
    : coverLetter();
  const openButton = createEl('button', {
    class:'library-shelf-open-btn',
    type:'button',
    'aria-label':`${title} 이어 읽기`
  }, [
    createEl('span', { class:'library-shelf-cover' }, [
      cover,
      createEl('span', { class:'library-shelf-cover-kind', text:countLabel }),
      createEl('span', { class:'library-shelf-cover-progress', 'aria-hidden':'true' }, createEl('span', { style:`width:${percent}%` }))
    ]),
    createEl('span', { class:'library-shelf-card-copy' }, [
      createEl('span', { class:'library-shelf-card-title', text:title, title }),
      createEl('span', { class:'library-shelf-card-meta', text:[novel.author || '', category, percent > 0 ? `진행 ${percent}%` : '미독서'].filter(Boolean).join(' · ') }),
      novel.description ? createEl('span', { class:'library-shelf-card-description', text:novel.description, title:novel.description }) : null,
      Array.isArray(novel.tags) && novel.tags.length ? createEl('span', { class:'library-shelf-card-tags' }, novel.tags.slice(0, 4).map(tag => createEl('span', { class:'library-shelf-card-tag', text:`#${tag}` }))) : null,
      novel.metadata ? createEl('span', { class:'library-shelf-metadata-source', text:'웹 메타데이터 적용됨' }) : null,
      Number(novel.hiddenVariantCount) > 0
        ? createEl('span', { class:'library-shelf-variant-hint', text:`중복·이전 판본 ${Number(novel.hiddenVariantCount).toLocaleString('ko-KR')}개 묶음` })
        : null
    ])
  ]);
  const activeScope = validScope(app.state.libraryShelfScope);
  return createEl('article', {
    class:`library-shelf-card novel-item${active ? ' active' : ''}${activeScope !== 'all' ? ' has-scope-remove' : ''}`,
    role:'listitem',
    dataset:{ novelId:novel.id, libraryShelfCard:'1' },
    style:`--library-cover-hue:${coverHue(title)}`
  }, [
    openButton,
    createEl('button', {
      class:`library-shelf-favorite-btn${favorite ? ' active' : ''}`,
      type:'button',
      title:favorite ? '즐겨찾기 해제' : '즐겨찾기 추가',
      'aria-label':favorite ? `${title} 즐겨찾기 해제` : `${title} 즐겨찾기 추가`,
      'aria-pressed':favorite ? 'true' : 'false',
      dataset:{ libraryShelfAction:'favorite', novelId:novel.id },
      text:favorite ? '★' : '☆'
    }),
    activeScope === 'all' ? null : createEl('button', {
      class:'library-shelf-scope-remove-btn',
      type:'button',
      title:activeScope === 'favorites' ? '즐겨찾기에서 제거' : '최근 항목에서 제거',
      'aria-label':activeScope === 'favorites' ? `${title} 즐겨찾기에서 제거` : `${title} 최근 항목에서 제거`,
      dataset:{ libraryShelfAction:'scope-remove', libraryShelfScope:activeScope, novelId:novel.id },
      text:activeScope === 'favorites' ? '즐겨찾기 해제' : '최근에서 제거'
    }),
    createEl('button', {
      class:'library-action-btn library-shelf-menu-btn',
      type:'button',
      title:'작품 정보와 관리',
      'aria-label':`${title} 작품 정보와 관리`,
      dataset:{ type:'novel', novelId:novel.id },
      text:'⋯'
    })
  ]);
}

function createShelfPruneNotice(app) {
  const dropped = Math.max(0, Number(app.state.libraryShelfDroppedCount) || 0);
  if (!dropped) return null;
  return createEl('div', { class:'library-shelf-prune-notice', dataset:{ libraryShelfDomBudgetPass:LIBRARY_SHELF_DOM_BUDGET_PASS } }, [
    createEl('span', { text:`메모리 절약을 위해 앞의 ${dropped.toLocaleString('ko-KR')}개 작품을 목록에서 정리했습니다.` }),
    createEl('button', { type:'button', dataset:{ libraryShelfAction:'restart' }, text:'처음부터 보기' })
  ]);
}

function createShelfFooter(app, items) {
  const loadedCount = Math.max(Number(app.state.libraryShelfLoadedCount) || 0, Number(app.state.libraryShelfDroppedCount) + items.length);
  if (app.state.libraryShelfNextCursor) {
    return createEl('div', {
      class:'library-shelf-auto-loader',
      role:'status',
      'aria-live':'polite',
      dataset:{ libraryShelfAutoload:LIBRARY_SHELF_AUTOLOAD_PASS }
    }, [
      createEl('span', { class:'library-shelf-auto-loader-spinner', 'aria-hidden':'true' }),
      createEl('span', { text:app.state.libraryShelfLoading ? '다음 작품을 불러오는 중…' : `스크롤하면 자동으로 이어집니다 · ${Math.max(0, app.state.libraryShelfTotal - loadedCount).toLocaleString('ko-KR')}개 남음` })
    ]);
  }
  return createEl('div', { class:'library-shelf-end', text:`${loadedCount.toLocaleString('ko-KR')}개 작품을 모두 불러왔습니다.` });
}

function renderShelfAppendPage(app, box, items, options = {}) {
  const appendFrom = Math.max(0, Number(app.state.libraryShelfAppendFrom) || 0);
  const grid = box.querySelector?.('.library-shelf-grid');
  if (!grid || options.source !== 'shelf-load-more-complete' || appendFrom > items.length) return false;
  const prunedCount = Math.max(0, Number(app.state.libraryShelfPrunedLastCount) || 0);
  const existingCards = Array.from(grid.querySelectorAll?.('.library-shelf-card') || []);
  const anchor = existingCards[Math.min(prunedCount, Math.max(0, existingCards.length - 1))] || null;
  const anchorTop = anchor?.getBoundingClientRect?.().top ?? null;
  existingCards.slice(0, prunedCount).forEach(node => node.remove());
  items.slice(appendFrom).forEach(novel => grid.append(createShelfCard(app, novel)));
  if (anchor && anchorTop != null && anchor.isConnected) {
    const delta = (anchor.getBoundingClientRect?.().top ?? anchorTop) - anchorTop;
    if (Number.isFinite(delta) && Math.abs(delta) > 0.5) box.scrollTop += delta;
  }
  box.querySelectorAll?.('.library-shelf-load-more,.library-shelf-auto-loader,.library-shelf-end,.library-shelf-prune-notice').forEach(node => node.remove());
  const notice = createShelfPruneNotice(app);
  if (notice) box.insertBefore(notice, grid);
  box.append(createShelfFooter(app, items));
  app.state.libraryShelfAppendFrom = -1;
  app.state.libraryShelfPrunedLastCount = 0;
  box.dataset.libraryShelfDomBudgetPass = LIBRARY_SHELF_DOM_BUDGET_PASS;
  box.classList.remove('novel-list-rendering');
  box.dispatchEvent?.(new CustomEvent('library-shelf-rendered', { detail:{ pass:LIBRARY_SHELF_AUTOLOAD_PASS, source:options.source || '' } }));
  return true;
}

export function renderLibraryShelfRuntime(app, box, options = {}) {
  syncLibraryShelfChromeRuntime(app);
  box.classList.remove('library-explorer-active');
  box.classList.remove('library-virtual-active');
  delete box.dataset.libraryVirtualActive;
  box.classList.add('library-shelf-active');
  const items = Array.isArray(app.state.libraryShelfItems) ? app.state.libraryShelfItems : [];
  if (options.source === 'shelf-load-more-start') {
    const autoLoader = box.querySelector?.('.library-shelf-auto-loader');
    if (autoLoader) {
      const label = autoLoader.querySelector?.('span:last-child');
      if (label) label.textContent = '다음 작품을 불러오는 중…';
      box.classList.remove('novel-list-rendering');
      return { rendered:true, mode:'shelf', count:items.length, appendPending:true, pass:LIBRARY_SHELF_APPEND_RENDER_PASS };
    }
  }
  if (renderShelfAppendPage(app, box, items, options)) {
    return { rendered:true, mode:'shelf', count:items.length, appended:true, pass:LIBRARY_SHELF_APPEND_RENDER_PASS };
  }
  const fragment = document.createDocumentFragment();
  if (app.state.libraryShelfLoading && !items.length) {
    const skeleton = createEl('div', { class:'library-shelf-grid library-shelf-skeleton', 'aria-hidden':'true' });
    for (let i = 0; i < 8; i += 1) skeleton.append(createEl('div', { class:'library-shelf-card skeleton-card' }));
    fragment.append(skeleton);
  } else if (!items.length) {
    fragment.append(createEl('div', { class:'library-shelf-empty' }, [
      createEl('div', { class:'library-shelf-empty-icon', text:app.state.libraryShelfError ? '!' : '⌕' }),
      createEl('strong', { text:app.state.libraryShelfError ? '서재를 불러오지 못했습니다.' : '표시할 작품이 없습니다.' }),
      createEl('span', { text:app.state.libraryShelfError || (app.state.libraryFilter ? '검색어나 범위를 바꿔 보세요.' : '다른 범위를 선택해 보세요.') }),
      app.state.libraryShelfError ? createEl('button', { class:'library-shelf-retry-btn', type:'button', dataset:{ libraryShelfAction:'retry' }, text:'다시 시도' }) : null
    ]));
  } else {
    const grid = createEl('div', { class:'library-shelf-grid', role:'list', 'aria-label':'서재 작품 목록' });
    items.forEach(novel => grid.append(createShelfCard(app, novel)));
    const notice = createShelfPruneNotice(app);
    if (notice) fragment.append(notice);
    fragment.append(grid);
    fragment.append(createShelfFooter(app, items));
  }
  box.replaceChildren(fragment);
  const shelfScrollRestored = options.shelfScrollView ? restoreShelfScrollView(box, options.shelfScrollView) : false;
  app.state.libraryShelfAppendFrom = -1;
  app.state.libraryShelfPrunedLastCount = 0;
  box.dataset.libraryShelfDomBudgetPass = LIBRARY_SHELF_DOM_BUDGET_PASS;
  if (!shelfScrollRestored && options.followActive) {
    const activeCard = box.querySelector?.('.library-shelf-card.active');
    if (activeCard) {
      try { activeCard.scrollIntoView({ block:'center', inline:'nearest' }); } catch {}
    }
  } else if (!shelfScrollRestored && options.resetScroll) box.scrollTop = 0;
  box.classList.remove('novel-list-rendering');
  box.dispatchEvent?.(new CustomEvent('library-shelf-rendered', { detail:{ pass:LIBRARY_SHELF_AUTOLOAD_PASS, source:options.source || '' } }));
  return { rendered:true, mode:'shelf', count:items.length, pass:LIBRARY_SHELF_RUNTIME_PASS };
}

export function installLibraryShelfControlsRuntime(app, on, deps = {}) {
  const switchView = mode => deps.switchView?.(app, mode);
  const viewTabs = [app.els.libraryViewShelf, app.els.libraryViewFiles, app.els.libraryViewExplorer].filter(Boolean);
  const scopeTabs = [app.els.libraryScopeAll, app.els.libraryScopeFavorites, app.els.libraryScopeRecent].filter(Boolean);
  installLibraryShelfFilterControls(app, on, { loadShelfPage:deps.loadShelfPage });
  const densitySelect = document.getElementById('library-density-select');
  if (densitySelect) {
    densitySelect.value = validDensity(app.state.libraryShelfDensity);
    on(densitySelect, 'change', () => {
      app.state.libraryShelfDensity = validDensity(densitySelect.value);
      persistLibraryUi(app.state);
      syncLibraryShelfChromeRuntime(app);
    });
  }

  const installTabKeys = (tabs, activate) => {
    tabs.forEach((button, index) => on(button, 'keydown', event => {
      let nextIndex = -1;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = tabs.length - 1;
      if (nextIndex < 0) return;
      event.preventDefault();
      const next = tabs[nextIndex];
      next?.focus?.();
      return activate(next);
    }));
  };
  on(app.els.libraryViewShelf, 'click', () => switchView('shelf'));
  on(app.els.libraryViewFiles, 'click', () => switchView('files'));
  on(app.els.libraryViewExplorer, 'click', () => switchView('explorer'));
  scopeTabs.forEach(button => {
    on(button, 'click', () => deps.setScope?.(app, button?.dataset?.libraryScope || 'all'));
  });
  installTabKeys(viewTabs, button => switchView(button?.dataset?.libraryView || 'shelf'));
  installTabKeys(scopeTabs, button => deps.setScope?.(app, button?.dataset?.libraryScope || 'all'));
  on(app.els.novelList, 'click', ev => {
    const target = ev.target instanceof Element ? ev.target : null;
    const action = target?.closest?.('[data-library-shelf-action]');
    if (!action || !app.els.novelList.contains(action)) return;
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation?.();
    const kind = String(action.dataset.libraryShelfAction || '');
    if (kind === 'load-more') return deps.loadShelfPage?.(app, { reset:false });
    if (kind === 'retry' || kind === 'restart') return deps.loadShelfPage?.(app, { reset:true });
    if (kind === 'scope-remove') {
      const scope = validScope(action.dataset.libraryShelfScope || app.state.libraryShelfScope);
      const novelId = String(action.dataset.novelId || '');
      const result = scope === 'favorites' ? deps.toggleFavorite?.(app, novelId, { render:false }) : deps.removeRecent?.(app, novelId);
      if (result?.changed) {
        app.state.libraryShelfItems = (app.state.libraryShelfItems || []).filter(item => String(item?.id || '') !== novelId);
        app.state.libraryShelfTotal = Math.max(0, Number(app.state.libraryShelfTotal) - 1);
        const countKey = scope === 'favorites' ? 'favorites' : 'recent';
        app.state.libraryShelfCounts = { ...(app.state.libraryShelfCounts || {}), [countKey]:Math.max(0, Number(app.state.libraryShelfCounts?.[countKey]) - 1) };
        deps.syncLibraryChrome?.(app);
        deps.renderLibrary?.(app, { source:`${scope}-scope-remove`, followActive:false });
      }
      return result;
    }
    if (kind === 'favorite') {
      const result = deps.toggleFavorite?.(app, action.dataset.novelId || '');
      if (app.state.libraryShelfScope === 'favorites' && result?.changed && !result.isFavorite) {
        app.state.libraryShelfItems = (app.state.libraryShelfItems || []).filter(item => String(item?.id || '') !== String(result.novelId || ''));
        app.state.libraryShelfTotal = Math.max(0, Number(app.state.libraryShelfTotal) - 1);
        app.state.libraryShelfCounts = { ...(app.state.libraryShelfCounts || {}), favorites:Math.max(0, Number(app.state.libraryShelfCounts?.favorites) - 1) };
        deps.syncLibraryChrome?.(app);
        deps.renderLibrary?.(app, { source:'favorite-scope-remove', followActive:false });
      }
    }
  }, { capture:true });
  on(app.els.novelList, 'keydown', ev => {
    const target = ev.target instanceof Element ? ev.target : null;
    const card = target?.closest?.('.library-shelf-card');
    if (!card || !app.els.novelList.contains(card) || target.closest('button,a,input,select,textarea')) return;
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      return deps.openNovelFromElement?.(app, card);
    }
  });
  const headerScrollState = createLibraryHeaderScrollState({
    initialTop:Number(app.els.novelList?.scrollTop) || 0,
    initialCompact:document.body?.classList.contains('library-header-compact') === true
  });
  const updateCompactHeader = () => {
    const result = headerScrollState.update(Number(app.els.novelList?.scrollTop) || 0);
    applyLibraryHeaderCompactState(document.body, result);
  };
  on(app.els.novelList, 'library-shelf-rendered', () => {
    const top = Number(app.els.novelList?.scrollTop) || 0;
    if (top <= 28) applyLibraryHeaderCompactState(document.body, headerScrollState.reset(top, false));
  });
  const markAutoLoadUserActivity = () => {
    app.state.libraryShelfAutoLoadActivitySerial = Math.max(0, Number(app.state.libraryShelfAutoLoadActivitySerial) || 0) + 1;
  };
  const maybeAutoLoad = (source = 'scroll') => {
    if (app.state.libraryViewMode !== 'shelf' || !app.state.libraryShelfNextCursor || app.state.libraryShelfLoading) return false;
    const activitySerial = Math.max(0, Number(app.state.libraryShelfAutoLoadActivitySerial) || 0);
    const lastRequestActivitySerial = Math.max(0, Number(app.state.libraryShelfAutoLoadLastRequestActivitySerial) || 0);
    if (activitySerial <= lastRequestActivitySerial) return false;
    const box = app.els.novelList;
    if (!box) return false;
    const remaining = Math.max(0, box.scrollHeight - box.scrollTop - box.clientHeight);
    const threshold = Math.max(420, Math.round(box.clientHeight * 0.72));
    if (remaining > threshold) return false;
    const now = Date.now();
    const notBefore = Math.max(0, Number(app.state.libraryShelfAutoLoadNotBefore) || 0);
    if (now < notBefore) {
      clearTimeout(app.state.libraryShelfAutoLoadTimer || 0);
      app.state.libraryShelfAutoLoadTimer = window.setTimeout(() => maybeAutoLoad(`${source}-cooldown`), Math.max(40, notBefore - now));
      return false;
    }
    app.state.libraryShelfAutoLoadLastRequestActivitySerial = activitySerial;
    app.state.libraryShelfAutoLoadNotBefore = now + LIBRARY_SHELF_AUTOLOAD_COOLDOWN_MS;
    Promise.resolve(deps.loadShelfPage?.(app, { reset:false, source:`auto-${source}` })).catch(() => {});
    return true;
  };
  let libraryHeaderTouchY = null;
  const revealCompactHeader = () => {
    applyLibraryHeaderCompactState(document.body, headerScrollState.reveal(Number(app.els.novelList?.scrollTop) || 0));
  };
  on(app.els.novelList, 'wheel', event => {
    markAutoLoadUserActivity();
    if (Number(event.deltaY) < -2) revealCompactHeader();
  }, { passive:true });
  on(app.els.novelList, 'touchstart', event => {
    libraryHeaderTouchY = Number(event.touches?.[0]?.clientY);
  }, { passive:true });
  on(app.els.novelList, 'touchmove', event => {
    markAutoLoadUserActivity();
    const nextY = Number(event.touches?.[0]?.clientY);
    if (Number.isFinite(nextY) && Number.isFinite(libraryHeaderTouchY) && nextY - libraryHeaderTouchY > 5) revealCompactHeader();
    if (Number.isFinite(nextY)) libraryHeaderTouchY = nextY;
  }, { passive:true });
  on(app.els.novelList, 'touchend', () => { libraryHeaderTouchY = null; }, { passive:true });
  on(app.els.novelList, 'pointerdown', event => {
    if (event.target === app.els.novelList) markAutoLoadUserActivity();
  }, { passive:true });
  on(app.els.novelList, 'keydown', event => {
    if (['ArrowDown','PageDown','End',' '].includes(event.key)) markAutoLoadUserActivity();
    if (['ArrowUp','PageUp','Home'].includes(event.key)) revealCompactHeader();
  });
  on(app.els.novelList, 'scroll', () => {
    updateCompactHeader();
    maybeAutoLoad('scroll');
  }, { passive:true });
  on(app.els.novelList, 'library-shelf-rendered', updateCompactHeader);
  updateCompactHeader();
  syncLibraryShelfChromeRuntime(app);
}

export function applyFullCatalogStateRuntime(state, payload) {
  return applyLibraryCatalogState(state, payload);
}
