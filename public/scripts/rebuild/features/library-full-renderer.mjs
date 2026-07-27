import { buildTree } from './library-model.mjs';
import { createRootDropZone } from './library-prototype-rows.mjs';
import { createEl } from '../core/utils.mjs';
import { buildLibraryBookmarkCountIndex, renderLibraryTree } from './library-tree-renderer.mjs';

export const LIBRARY_FULL_RENDERER_PASS = 'v293-library-full-renderer-pass';
export const LIBRARY_TREE_MODEL_CACHE_PASS = 'v575-library-tree-model-cache-pass';
export const LIBRARY_BOUNDED_FULL_FALLBACK_PASS = 'v674-library-bounded-full-fallback-pass';
export const LIBRARY_BOUNDED_FULL_FALLBACK_MAX_NOVELS = 500;
export const LIBRARY_BOUNDED_FULL_FALLBACK_MAX_EPISODES = 300;

export function selectLibraryBoundedFallbackNovels(novels = [], currentNovelId = '', limit = LIBRARY_BOUNDED_FULL_FALLBACK_MAX_NOVELS) {
  const source = Array.isArray(novels) ? novels : [];
  const cap = Math.max(1, Math.floor(Number(limit) || LIBRARY_BOUNDED_FULL_FALLBACK_MAX_NOVELS));
  if (source.length <= cap) return source;
  const selected = source.slice(0, cap);
  const activeId = String(currentNovelId || '');
  if (activeId && !selected.some(novel => String(novel?.id || '') === activeId)) {
    const active = source.find(novel => String(novel?.id || '') === activeId);
    if (active) selected[selected.length - 1] = active;
  }
  return selected;
}

export function buildLibraryFullRenderRecord({ reason = 'full-render', options = {}, rowHeightMeasurement = null, anchorRestored = false, activeFollowApplied = false } = {}) {
  return {
    mode: 'full',
    kind: 'informational-full-render',
    blocking: false,
    reason,
    rowCount: null,
    rowHeightEstimate: rowHeightMeasurement?.fixedEstimatePx || rowHeightMeasurement?.stats?.average || null,
    rowHeightMeasurement: options.summarizeRowHeightMeasurement?.(rowHeightMeasurement) || rowHeightMeasurement || null,
    source: options.source || 'render',
    fullRendererPass: LIBRARY_FULL_RENDERER_PASS,
    scrollPolicy: {
      resetScroll: !!options.resetScroll,
      anchorKey: options.scrollAnchor?.key || '',
      anchorRestored,
      followActive: !!options.followActive,
      activeFollowApplied
    },
    at: Date.now()
  };
}

export function renderLibraryFull(app, box, novels, reason = 'full-render', options = {}, deps = {}) {
  box.classList.remove('library-explorer-active', 'library-shelf-active');
  box.classList.remove('library-virtual-active');
  delete box.dataset.libraryVirtualActive;
  app.state.libraryVirtualWindowRenderCache = null;
  const boundedFallback = options.blockingVirtualFallback === true;
  const currentNovelId = app.state.current?.novel?.id || '';
  const renderNovels = boundedFallback
    ? selectLibraryBoundedFallbackNovels(novels, currentNovelId)
    : novels;
  if (boundedFallback) box.dataset.libraryBoundedFallback = '1';
  else delete box.dataset.libraryBoundedFallback;

  const cachedTree = app.state.libraryTreeModelCache;
  const tree = cachedTree?.sourceRef === renderNovels && cachedTree?.sourceLength === renderNovels.length
    ? cachedTree.tree
    : buildTree(renderNovels);
  if (!cachedTree || cachedTree.sourceRef !== renderNovels || cachedTree.sourceLength !== renderNovels.length) {
    app.state.libraryTreeModelCache = { sourceRef:renderNovels, sourceLength:renderNovels.length, tree, pass:LIBRARY_TREE_MODEL_CACHE_PASS };
  }
  const fragment = document.createDocumentFragment();
  fragment.append((deps.createRootDropZone || createRootDropZone)());
  if (boundedFallback) {
    fragment.append(createEl('div', {
      class:'library-shelf-prune-notice',
      role:'status',
      text:`가상 목록 안전 검사가 실패해 ${novels.length.toLocaleString()}개 중 ${renderNovels.length.toLocaleString()}개만 임시 안전 모드로 표시합니다. 검색을 좁히거나 복구 화면에서 가상 목록을 다시 시도하세요.`
    }));
  }
  renderLibraryTree(app, fragment, tree, [], {
    libraryDraggableAttrs:deps.libraryDraggableAttrs,
    bookmarkCountByNovel:buildLibraryBookmarkCountIndex(app.state.bookmarks),
    maxExpandedEpisodeRows:boundedFallback ? LIBRARY_BOUNDED_FULL_FALLBACK_MAX_EPISODES : Number.POSITIVE_INFINITY
  });
  box.replaceChildren(fragment);

  const anchorRestored = options.scrollAnchor ? !!deps.restoreLibraryScrollAnchor?.(app, options.scrollAnchor) : false;
  let activeFollowApplied = false;
  if (!anchorRestored && options.followActive) {
    const activeEl = box.querySelector('.novel-item.active,.ep-item.active');
    if (activeEl) {
      try {
        activeEl.scrollIntoView({ block: 'center' });
        activeFollowApplied = true;
      } catch {}
    }
  }
  if (options.resetScroll) box.scrollTop = 0;

  const rowHeightMeasurement = deps.getLibraryRowHeightMeasurementDiagnostics?.(app) || null;
  const record = buildLibraryFullRenderRecord({
    reason,
    options: { ...options, summarizeRowHeightMeasurement: deps.summarizeLibraryRowHeightMeasurement },
    rowHeightMeasurement,
    anchorRestored,
    activeFollowApplied
  });
  record.boundedFallback = boundedFallback;
  record.totalNovels = novels.length;
  record.renderedNovels = renderNovels.length;
  record.boundedFallbackPass = boundedFallback ? LIBRARY_BOUNDED_FULL_FALLBACK_PASS : '';
  deps.recordLibraryVirtualRender?.(app, record);
  return {
    rendered:true,
    reason,
    anchorRestored,
    activeFollowApplied,
    boundedFallback,
    totalNovels:novels.length,
    renderedNovels:renderNovels.length,
    record,
    pass:LIBRARY_FULL_RENDERER_PASS
  };
}
