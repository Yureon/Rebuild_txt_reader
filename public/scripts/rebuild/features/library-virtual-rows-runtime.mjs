import { computeLibraryWindow, flattenLibraryTree, summarizeLibraryWindowPlan } from './library-model.mjs';
import { getLibraryCurrentKey, getLibraryFilteredNovels } from './library-current-selection.mjs';
import { getLibrarySetSignature } from './library-render-options.mjs';
import { getLibraryWindowDomMetrics } from './library-row-diagnostics.mjs';

export const LIBRARY_VIRTUAL_ROWS_RUNTIME_PASS = 'v292-library-virtual-rows-runtime-pass';
export const LIBRARY_VIRTUAL_ROWS_CACHE_PASS = 'v141-library-rows-cache-pass';

export function getLibraryVirtualRowsSignature(app, filteredNovels) {
  const list = Array.isArray(filteredNovels) ? filteredNovels : [];
  return {
    filteredRef: list,
    collapsed: getLibrarySetSignature(app?.state?.collapsedFolders),
    expanded: getLibrarySetSignature(app?.state?.expandedEpisodeNovels),
    currentKey: getLibraryCurrentKey(app)
  };
}

export function isLibraryVirtualRowsCacheMatch(cache, signature) {
  return !!cache
    && cache.filteredRef === signature.filteredRef
    && cache.collapsed === signature.collapsed
    && cache.expanded === signature.expanded
    && cache.currentKey === signature.currentKey;
}

export function getLibraryVirtualRows(app, filteredNovels) {
  const signature = getLibraryVirtualRowsSignature(app, filteredNovels);
  const cached = app?.state?.libraryVirtualRowsCache || null;
  if (isLibraryVirtualRowsCacheMatch(cached, signature)) {
    return { ...cached, cacheHit: true };
  }
  const flattened = flattenLibraryTree(filteredNovels, {
    collapsedFolders: app.state.collapsedFolders,
    expandedEpisodeNovels: app.state.expandedEpisodeNovels,
    current: app.state.current,
    includeCollapsedChildren: false
  });
  const visibleRows = flattened.rows.filter(row => row?.visible !== false);
  const activeIndex = visibleRows.findIndex(row => !!row.active);
  const activeRow = activeIndex >= 0 ? visibleRows[activeIndex] : null;
  const next = {
    ...signature,
    flattened,
    visibleRows,
    activeIndex,
    activeRow,
    activeKey: activeRow?.key || '',
    cacheHit: false,
    pass: LIBRARY_VIRTUAL_ROWS_CACHE_PASS,
    runtimePass: LIBRARY_VIRTUAL_ROWS_RUNTIME_PASS,
    computedAt: Date.now()
  };
  app.state.libraryVirtualRowsCache = next;
  return next;
}

export function getLibraryCurrentWindowRows(app) {
  const rowsInfo = getLibraryVirtualRows(app, getLibraryFilteredNovels(app));
  const visibleRows = rowsInfo.visibleRows;
  const metrics = getLibraryWindowDomMetrics(app, { lightweight: true });
  const plan = computeLibraryWindow(visibleRows, { ...metrics, rowsAlreadyVisible: true, activeIndex: rowsInfo.activeIndex, activeRow: rowsInfo.activeRow });
  const summary = summarizeLibraryWindowPlan(plan);
  const start = Math.max(0, Number(summary.renderStart) || 0);
  const end = Math.max(start, Number(summary.renderEnd) || start);
  return {
    available: true,
    query: String(app.state.libraryFilter || ''),
    filenameSearchToggleRemoved: true,
    totalRows: visibleRows.length,
    rowsRuntimePass: LIBRARY_VIRTUAL_ROWS_RUNTIME_PASS,
    rowsCachePass: LIBRARY_VIRTUAL_ROWS_CACHE_PASS,
    rowsCacheHit: !!rowsInfo.cacheHit,
    window: summary,
    rowHeightMeasurement: metrics.rowHeightMeasurement || null,
    rows: visibleRows.slice(start, end).map((row, index) => ({
      index: start + index,
      type: row.type,
      key: row.key,
      depth: row.depth,
      title: row.title || row.name || row.fileName || '',
      parentKey: row.parentKey || '',
      folderKey: row.folderKey || '',
      novelId: row.novelId || '',
      episodeId: row.episodeId || '',
      active: !!row.active,
      collapsed: !!row.collapsed,
      expanded: !!row.expanded
    })),
    computedAt: Date.now()
  };
}
