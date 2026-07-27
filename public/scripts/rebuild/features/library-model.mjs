import { CURRENT_BUILD_ID } from '../version.mjs';
export function buildTree(novels) {
  const root = { folders: new Map(), novels: [] };
  novels.forEach(novel => {
    const parts = getCategoryParts(novel);
    let node = root;
    parts.forEach(part => {
      if (!node.folders.has(part)) node.folders.set(part, { name: part, folders: new Map(), novels: [] });
      node = node.folders.get(part);
    });
    node.novels.push(novel);
  });
  return root;
}

export function getCategoryParts(novel) {
  if (Array.isArray(novel.category) && novel.category.length) return novel.category.map(String).filter(Boolean);
  return String(novel.categoryPath || '').split('>').map(x => x.trim()).filter(Boolean);
}

export const LIBRARY_FILENAME_TOGGLE_REMOVED_PASS = 'v343-library-filename-toggle-removed-pass';

export function filterLibraryNovels(novels = [], options = {}) {
  const q = String(options.query || '').trim().toLowerCase();
  if (!q) return Array.isArray(novels) ? novels : [];
  return (Array.isArray(novels) ? novels : []).filter(n => {
    const episodes = Array.isArray(n.episodes) ? n.episodes : [];
    const hay = [
      n.title,
      n.categoryPath,
      n.fileName,
      n.episodeSearchText,
      ...episodes.map(e => e.title),
      ...episodes.map(e => e.fileName)
    ].join(' ');
    return hay.toLowerCase().includes(q);
  });
}

function normalizeSet(value) {
  if (value instanceof Set) return value;
  if (Array.isArray(value)) return new Set(value.map(String));
  return new Set();
}

function currentIdentity(current) {
  if (!current) return { novelId:'', episodeId:'' };
  return {
    novelId: String(current.novel?.id || current.novelId || ''),
    episodeId: String(current.episode?.id || current.episodeId || '')
  };
}

function sortedFolders(node) {
  return Array.from(node?.folders?.values?.() || []).sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric:true }));
}

function sortedNovels(node) {
  return Array.from(node?.novels || []).sort((a, b) => String(a.title).localeCompare(String(b.title), 'ko', { numeric:true }));
}

function countDescendants(node) {
  let folders = 0;
  let novels = 0;
  let episodes = 0;
  sortedFolders(node).forEach(folder => {
    folders += 1;
    const sub = countDescendants(folder);
    folders += sub.folders;
    novels += sub.novels;
    episodes += sub.episodes;
  });
  sortedNovels(node).forEach(novel => {
    novels += 1;
    if (novel?.isMultiFile) episodes += Array.isArray(novel.episodes) ? novel.episodes.length : 0;
  });
  return { folders, novels, episodes, rows: folders + novels + episodes };
}

export function flattenLibraryTree(novels = [], options = {}) {
  const tree = options.tree || buildTree(Array.isArray(novels) ? novels : []);
  const collapsedFolders = normalizeSet(options.collapsedFolders);
  const expandedEpisodeNovels = normalizeSet(options.expandedEpisodeNovels);
  const includeCollapsedChildren = !!options.includeCollapsedChildren;
  const identity = currentIdentity(options.current || null);
  const rows = [];
  const diagnostics = {
    totalRows: 0,
    visibleRows: 0,
    hiddenRows: 0,
    folderRows: 0,
    novelRows: 0,
    episodeRows: 0,
    collapsedFolderRows: 0,
    collapsedDescendantRows: 0,
    expandedEpisodeNovels: 0,
    maxDepth: 0
  };

  const pushRow = row => {
    rows.push(row);
    diagnostics.totalRows += 1;
    if (row.visible === false) diagnostics.hiddenRows += 1;
    else diagnostics.visibleRows += 1;
    if (row.type === 'folder') diagnostics.folderRows += 1;
    if (row.type === 'novel') diagnostics.novelRows += 1;
    if (row.type === 'episode') diagnostics.episodeRows += 1;
    diagnostics.maxDepth = Math.max(diagnostics.maxDepth, Number(row.depth) || 0);
  };

  const walk = (node, path, parentKey, visible) => {
    sortedFolders(node).forEach(folder => {
      const folderPath = [...path, folder.name];
      const folderKey = folderPath.join('>');
      const collapsed = collapsedFolders.has(folderKey);
      const descendants = countDescendants(folder);
      const rowVisible = visible !== false;
      if (collapsed) {
        diagnostics.collapsedFolderRows += 1;
        diagnostics.collapsedDescendantRows += descendants.rows;
      }
      const rowKey = `folder:${folderKey}`;
      pushRow({
        type:'folder',
        key: rowKey,
        folderKey,
        title: folder.name,
        name: folder.name,
        path: folderPath,
        parentKey: parentKey || '',
        depth: path.length,
        collapsed,
        visible: rowVisible,
        childFolderCount: folder.folders?.size || 0,
        childNovelCount: Array.isArray(folder.novels) ? folder.novels.length : 0,
        descendantFolderCount: descendants.folders,
        descendantNovelCount: descendants.novels,
        descendantEpisodeCount: descendants.episodes,
        descendantRowCount: descendants.rows
      });
      if (!collapsed || includeCollapsedChildren) {
        walk(folder, folderPath, rowKey, rowVisible && !collapsed);
      }
    });

    sortedNovels(node).forEach(novel => {
      const novelId = String(novel?.id || '');
      const isMultiFile = !!novel?.isMultiFile;
      const expanded = isMultiFile && expandedEpisodeNovels.has(novelId);
      const novelKey = `novel:${novelId}`;
      const rowVisible = visible !== false;
      pushRow({
        type:'novel',
        key: novelKey,
        novelId,
        title: novel?.title || novel?.fileName || 'Untitled',
        fileName: novel?.fileName || '',
        categoryPath: novel?.categoryPath || '',
        path,
        parentKey: parentKey || '',
        depth: path.length,
        visible: rowVisible,
        isMultiFile,
        episodeCount: Array.isArray(novel?.episodes) ? novel.episodes.length : (Number(novel?.episodeCount) || 0),
        expanded,
        active: identity.novelId === novelId && !identity.episodeId
      });
      if (expanded) diagnostics.expandedEpisodeNovels += 1;
      if (expanded && Array.isArray(novel?.episodes)) {
        novel.episodes.forEach((episode, index) => {
          const episodeId = String(episode?.id || '');
          pushRow({
            type:'episode',
            key: `episode:${novelId}:${episodeId}`,
            novelId,
            episodeId,
            title: episode?.title || episode?.fileName || `Episode ${index + 1}`,
            fileName: episode?.fileName || '',
            path,
            parentKey: novelKey,
            depth: path.length + 1,
            visible: rowVisible,
            index,
            active: identity.novelId === novelId && identity.episodeId === episodeId
          });
        });
      }
    });
  };

  walk(tree, [], '', true);
  return { rows, diagnostics };
}

export function getLibraryFlattenDiagnostics(novels = [], options = {}) {
  const sourceNovels = Array.isArray(novels) ? novels : [];
  const filteredNovels = filterLibraryNovels(sourceNovels, {
    query: options.query || ''
  });
  const visible = flattenLibraryTree(filteredNovels, {
    collapsedFolders: options.collapsedFolders,
    expandedEpisodeNovels: options.expandedEpisodeNovels,
    current: options.current,
    includeCollapsedChildren: false
  });
  const full = flattenLibraryTree(filteredNovels, {
    collapsedFolders: options.collapsedFolders,
    expandedEpisodeNovels: options.expandedEpisodeNovels,
    current: options.current,
    includeCollapsedChildren: true
  });
  const unfilteredVisible = flattenLibraryTree(sourceNovels, {
    collapsedFolders: options.collapsedFolders,
    expandedEpisodeNovels: options.expandedEpisodeNovels,
    current: options.current,
    includeCollapsedChildren: false
  });
  const novelIds = new Set();
  const duplicateNovelIds = new Set();
  const episodeIds = new Set();
  const duplicateEpisodeIds = new Set();
  let totalEpisodes = 0;
  sourceNovels.forEach(novel => {
    const novelId = String(novel?.id || '');
    if (novelId) {
      if (novelIds.has(novelId)) duplicateNovelIds.add(novelId);
      novelIds.add(novelId);
    }
    (Array.isArray(novel?.episodes) ? novel.episodes : []).forEach(ep => {
      totalEpisodes += 1;
      const epKey = `${novelId}:${String(ep?.id || '')}`;
      if (episodeIds.has(epKey)) duplicateEpisodeIds.add(epKey);
      episodeIds.add(epKey);
    });
  });
  const visibleRows = visible.rows.filter(row => row.visible !== false);
  const folderRows = visibleRows.filter(row => row.type === 'folder');
  const novelRows = visibleRows.filter(row => row.type === 'novel');
  const episodeRows = visibleRows.filter(row => row.type === 'episode');
  return {
    available: true,
    query: String(options.query || ''),
    filenameSearchToggleRemoved: true,
    totalNovels: sourceNovels.length,
    filteredNovels: filteredNovels.length,
    totalEpisodes,
    collapsedFolders: normalizeSet(options.collapsedFolders).size,
    expandedEpisodeNovels: normalizeSet(options.expandedEpisodeNovels).size,
    visible: visible.diagnostics,
    full: full.diagnostics,
    unfilteredVisible: unfilteredVisible.diagnostics,
    visibleRows: visibleRows.length,
    visibleFolderRows: folderRows.length,
    visibleNovelRows: novelRows.length,
    visibleEpisodeRows: episodeRows.length,
    hiddenRowsByCollapsedFolders: full.diagnostics.hiddenRows,
    maxDepth: full.diagnostics.maxDepth,
    duplicateNovelIds: Array.from(duplicateNovelIds).slice(0, 20),
    duplicateEpisodeIds: Array.from(duplicateEpisodeIds).slice(0, 20),
    activeRow: visibleRows.find(row => row.active) || null,
    sampleRows: visibleRows.slice(0, 30).map(row => ({
      type: row.type,
      key: row.key,
      depth: row.depth,
      title: row.title,
      parentKey: row.parentKey || '',
      collapsed: !!row.collapsed,
      expanded: !!row.expanded,
      active: !!row.active
    })),
    computedAt: Date.now()
  };
}


function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeWindowIndex(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
}

export function summarizeLibraryWindowPlan(plan = {}) {
  const totalRows = normalizeWindowIndex(plan.totalRows, 0);
  const renderStart = Math.min(totalRows, normalizeWindowIndex(plan.renderStart ?? plan.start, 0));
  const renderEnd = Math.min(totalRows, Math.max(renderStart, normalizeWindowIndex(plan.renderEnd ?? plan.end, renderStart)));
  const visibleStart = Math.min(totalRows, normalizeWindowIndex(plan.visibleStart, 0));
  const visibleEnd = Math.min(totalRows, Math.max(visibleStart, normalizeWindowIndex(plan.visibleEnd, visibleStart)));
  const activeIndexNumber = Number(plan.activeIndex);
  const activeIndex = Number.isFinite(activeIndexNumber) && activeIndexNumber >= 0 ? Math.round(activeIndexNumber) : -1;
  return {
    totalRows,
    rowHeight: normalizeWindowIndex(plan.rowHeight, 56),
    viewportHeight: normalizeWindowIndex(plan.viewportHeight, 640),
    scrollTop: normalizeWindowIndex(plan.scrollTop, 0),
    overscan: normalizeWindowIndex(plan.overscan, 0),
    maxWindowRows: normalizeWindowIndex(plan.maxWindowRows, 0),
    start: renderStart,
    end: renderEnd,
    count: Math.max(0, renderEnd - renderStart),
    renderStart,
    renderEnd,
    renderCount: Math.max(0, renderEnd - renderStart),
    visibleStart,
    visibleEnd,
    visibleCount: Math.max(0, visibleEnd - visibleStart),
    totalHeight: normalizeWindowIndex(plan.totalHeight, 0),
    topSpacerHeight: normalizeWindowIndex(plan.topSpacerHeight, 0),
    bottomSpacerHeight: normalizeWindowIndex(plan.bottomSpacerHeight, 0),
    activeIndex,
    activeInWindow: activeIndex >= renderStart && activeIndex < renderEnd,
    activeRow: plan.activeRow || null,
    sampleRows: Array.isArray(plan.sampleRows) ? plan.sampleRows.slice(0, 20) : []
  };
}

export function buildLibraryWindowMaintenanceDiagnostics(input = {}) {
  const plan = summarizeLibraryWindowPlan(input.windowPlan || {});
  const visibleRows = Array.isArray(input.visibleRows) ? input.visibleRows : [];
  const rowHeightMeasurement = input.rowHeightMeasurement && typeof input.rowHeightMeasurement === 'object' ? input.rowHeightMeasurement : null;
  const actualDomRows = Number.isFinite(Number(input.actualDomRows)) ? Number(input.actualDomRows) : null;
  const actualChildElements = Number.isFinite(Number(input.actualChildElements)) ? Number(input.actualChildElements) : null;
  const checks = [
    {
      id: 'row-count-match',
      ok: visibleRows.length === plan.totalRows,
      expected: visibleRows.length,
      actual: plan.totalRows,
      note: 'flattened visible rows must match the window plan total'
    },
    {
      id: 'render-range-ordered',
      ok: plan.renderStart <= plan.renderEnd && plan.renderEnd <= plan.totalRows,
      expected: '0 <= renderStart <= renderEnd <= totalRows',
      actual: `${plan.renderStart}-${plan.renderEnd}/${plan.totalRows}`,
      note: 'window render range must stay inside the visible row list'
    },
    {
      id: 'visible-range-ordered',
      ok: plan.visibleStart <= plan.visibleEnd && plan.visibleEnd <= plan.totalRows,
      expected: '0 <= visibleStart <= visibleEnd <= totalRows',
      actual: `${plan.visibleStart}-${plan.visibleEnd}/${plan.totalRows}`,
      note: 'viewport range must stay inside the visible row list'
    },
    {
      id: 'spacer-total-height',
      ok: Math.abs((plan.topSpacerHeight + (plan.renderCount * plan.rowHeight) + plan.bottomSpacerHeight) - plan.totalHeight) <= Math.max(1, plan.rowHeight),
      expected: plan.totalHeight,
      actual: plan.topSpacerHeight + (plan.renderCount * plan.rowHeight) + plan.bottomSpacerHeight,
      note: 'spacers plus rendered rows should approximate the total fixed-height estimate'
    },
    {
      id: 'active-index-consistency',
      ok: plan.activeIndex < 0 || plan.activeInWindow === (plan.activeIndex >= plan.renderStart && plan.activeIndex < plan.renderEnd),
      expected: 'activeInWindow mirrors activeIndex within render range',
      actual: `active ${plan.activeIndex} · ${plan.activeInWindow ? 'inside' : 'outside'}`,
      note: 'active row bookkeeping should be internally consistent'
    }
  ];
  const failed = checks.filter(item => !item.ok);
  return {
    available: true,
    version: CURRENT_BUILD_ID,
    mode: 'diagnostic-only',
    maintenancePass: 'v141-library-render-path-optimization-pass',
    rendererUnchanged: true,
    invariantsPassed: failed.length === 0,
    status: failed.length ? 'review' : 'ok',
    statusLabel: failed.length ? `${failed.length} window invariant(s) need review` : 'window invariants ok',
    checks,
    failedChecks: failed,
    actualDomRows,
    actualChildElements,
    actualDomRowsRepresentFullRenderer: actualDomRows == null ? null : actualDomRows === plan.totalRows,
    rowHeightRisk: rowHeightMeasurement?.risk?.level || null,
    note: 'v140 code maintenance only; this diagnostic does not enable the library virtual renderer automatically'
  };
}

export function computeLibraryWindow(rows = [], options = {}) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const visibleRows = options.rowsAlreadyVisible === true ? sourceRows : sourceRows.filter(row => row?.visible !== false);
  const rowHeight = clampNumber(options.rowHeight, 24, 160, 56);
  const viewportHeight = clampNumber(options.viewportHeight, 120, 4000, 640);
  const scrollTop = clampNumber(options.scrollTop, 0, 10000000, 0);
  const overscan = Math.round(clampNumber(options.overscan, 0, 80, 8));
  const maxWindowRows = Math.round(clampNumber(options.maxWindowRows, 20, 600, 180));
  const totalRows = visibleRows.length;
  const totalHeight = Math.max(0, Math.round(totalRows * rowHeight));

  if (!totalRows) {
    return {
      available: true,
      reason: 'empty',
      totalRows: 0,
      rowHeight,
      viewportHeight,
      scrollTop: 0,
      overscan,
      maxWindowRows,
      start: 0,
      end: 0,
      count: 0,
      renderStart: 0,
      renderEnd: 0,
      renderCount: 0,
      visibleStart: 0,
      visibleEnd: 0,
      visibleCount: 0,
      totalHeight: 0,
      topSpacerHeight: 0,
      bottomSpacerHeight: 0,
      activeIndex: -1,
      activeInWindow: false,
      activeRow: null,
      sampleRows: []
    };
  }

  const rawVisibleStart = Math.floor(scrollTop / rowHeight);
  const rawVisibleEnd = Math.ceil((scrollTop + viewportHeight) / rowHeight);
  const visibleStart = Math.min(totalRows, Math.max(0, rawVisibleStart));
  const visibleEnd = Math.min(totalRows, Math.max(visibleStart, rawVisibleEnd));
  const visibleCount = Math.max(0, visibleEnd - visibleStart);
  let start = Math.max(0, visibleStart - overscan);
  let end = Math.min(totalRows, visibleEnd + overscan);

  if ((end - start) > maxWindowRows) {
    const anchor = Math.min(totalRows - 1, Math.max(0, visibleStart));
    const before = Math.floor(maxWindowRows * 0.4);
    start = Math.max(0, anchor - before);
    end = Math.min(totalRows, start + maxWindowRows);
    start = Math.max(0, end - maxWindowRows);
  }

  const explicitActiveIndex = Number(options.activeIndex);
  const explicitActiveRow = options.activeRow && typeof options.activeRow === 'object' ? options.activeRow : null;
  const activeIndex = Number.isFinite(explicitActiveIndex) && explicitActiveIndex >= 0 && explicitActiveIndex < totalRows
    ? Math.round(explicitActiveIndex)
    : visibleRows.findIndex(row => !!row.active);
  const activeRow = activeIndex >= 0 ? (explicitActiveRow || visibleRows[activeIndex]) : null;
  const topSpacerHeight = Math.round(start * rowHeight);
  const bottomSpacerHeight = Math.max(0, Math.round((totalRows - end) * rowHeight));
  const sampleRows = visibleRows.slice(start, Math.min(end, start + 20)).map(row => ({
    type: row.type,
    key: row.key,
    depth: row.depth,
    title: row.title,
    parentKey: row.parentKey || '',
    active: !!row.active,
    collapsed: !!row.collapsed,
    expanded: !!row.expanded
  }));

  return {
    available: true,
    totalRows,
    rowHeight,
    viewportHeight,
    scrollTop,
    overscan,
    maxWindowRows,
    start,
    end,
    count: Math.max(0, end - start),
    renderStart: start,
    renderEnd: end,
    renderCount: Math.max(0, end - start),
    visibleStart,
    visibleEnd,
    visibleCount,
    totalHeight,
    topSpacerHeight,
    bottomSpacerHeight,
    activeIndex,
    activeInWindow: activeIndex >= start && activeIndex < end,
    activeRow,
    sampleRows
  };
}

export function getLibraryWindowDiagnostics(novels = [], options = {}) {
  const sourceNovels = Array.isArray(novels) ? novels : [];
  const filteredNovels = filterLibraryNovels(sourceNovels, {
    query: options.query || ''
  });
  const flattened = flattenLibraryTree(filteredNovels, {
    collapsedFolders: options.collapsedFolders,
    expandedEpisodeNovels: options.expandedEpisodeNovels,
    current: options.current,
    includeCollapsedChildren: false
  });
  const windowPlan = computeLibraryWindow(flattened.rows, options);
  const visibleRows = flattened.rows.filter(row => row?.visible !== false);
  const actualDomRows = Number.isFinite(Number(options.actualDomRows)) ? Number(options.actualDomRows) : null;
  const actualChildElements = Number.isFinite(Number(options.actualChildElements)) ? Number(options.actualChildElements) : null;
  const actualScrollHeight = Number.isFinite(Number(options.actualScrollHeight)) ? Number(options.actualScrollHeight) : null;
  const rowHeightMeasurement = options.rowHeightMeasurement && typeof options.rowHeightMeasurement === 'object' ? options.rowHeightMeasurement : null;
  const estimatedDomReductionRatio = windowPlan.totalRows > 0
    ? Math.max(0, 1 - (windowPlan.renderCount / windowPlan.totalRows))
    : 0;
  const maintenance = buildLibraryWindowMaintenanceDiagnostics({ windowPlan, visibleRows, actualDomRows, actualChildElements, rowHeightMeasurement });
  return {
    available: true,
    enabled: false,
    mode: 'diagnostic-only',
    query: String(options.query || ''),
    filenameSearchToggleRemoved: true,
    totalNovels: sourceNovels.length,
    filteredNovels: filteredNovels.length,
    flattened: flattened.diagnostics,
    window: windowPlan,
    actual: {
      domRows: actualDomRows,
      childElements: actualChildElements,
      scrollTop: Number.isFinite(Number(options.actualScrollTop)) ? Number(options.actualScrollTop) : null,
      clientHeight: Number.isFinite(Number(options.actualClientHeight)) ? Number(options.actualClientHeight) : null,
      scrollHeight: actualScrollHeight,
      measuredRowHeight: Number.isFinite(Number(options.measuredRowHeight)) ? Number(options.measuredRowHeight) : null,
      rowHeightMeasurement
    },
    maintenance,
    comparison: {
      actualDomRows,
      plannedRenderRows: windowPlan.renderCount,
      virtualTotalRows: windowPlan.totalRows,
      domRowsMatchFlattenRows: actualDomRows == null ? null : actualDomRows === windowPlan.totalRows,
      plannedDomReductionRatio: estimatedDomReductionRatio,
      estimatedTotalHeight: windowPlan.totalHeight,
      actualScrollHeight,
      estimatedVsActualScrollHeightDelta: actualScrollHeight == null ? null : Math.round(windowPlan.totalHeight - actualScrollHeight),
      variableHeightRisk: rowHeightMeasurement?.risk?.level || null,
      variableHeightLikely: !!rowHeightMeasurement?.risk?.variableHeightLikely,
      measuredHeightRangePx: Number.isFinite(Number(rowHeightMeasurement?.stats?.range)) ? Number(rowHeightMeasurement.stats.range) : null,
      measuredMaxAbsDeltaPx: Number.isFinite(Number(rowHeightMeasurement?.stats?.maxAbsDeltaFromEstimate)) ? Number(rowHeightMeasurement.stats.maxAbsDeltaFromEstimate) : null,
      activeNeedsFollow: windowPlan.activeIndex >= 0 && !windowPlan.activeInWindow
    },
    computedAt: Date.now()
  };
}

export function findEpisodeForSnapshot(novel, snap) {
  if (!novel || !snap || !Array.isArray(novel.episodes)) return null;
  if (snap.episodeId) return novel.episodes.find(e => e.id === snap.episodeId) || null;
  if (Number.isFinite(Number(snap.episodeIdx))) return novel.episodes[Number(snap.episodeIdx)] || null;
  return null;
}

export function getProgressAliasesForNovel(novel) {
  const aliases = Array.isArray(novel?.progressAliases) ? novel.progressAliases : [novel?.id];
  return Array.from(new Set(aliases.map(value => String(value || '')).filter(Boolean)));
}

function progressSnapshotTimestamp(snap) {
  return Math.max(0, Number(snap?.updatedAt || snap?.savedAt || snap?.ts || snap?.timestamp) || 0);
}

export function findProgressSnapshotForNovel(state, novel) {
  const byNovel = state?.progress?.byNovel || {};
  const representativeId = String(novel?.id || '');
  return getProgressAliasesForNovel(novel)
    .map(id => ({ id, snap:byNovel[id] }))
    .filter(item => item.snap)
    .sort((left, right) =>
      progressSnapshotTimestamp(right.snap) - progressSnapshotTimestamp(left.snap)
        || Number(right.id === representativeId) - Number(left.id === representativeId)
    )[0]?.snap || null;
}

export function isNovelFavoriteForState(state, novel) {
  const favorites = state?.favorites;
  if (!favorites || typeof favorites.has !== 'function') return false;
  return getProgressAliasesForNovel(novel).some(id => favorites.has(id));
}

export function getProgressRatioForState(state, novel) {
  const snap = findProgressSnapshotForNovel(state, novel);
  if (!snap) return 0;
  if (Number.isFinite(Number(snap.documentRatio))) return Math.min(1, Math.max(0, Number(snap.documentRatio)));
  const total = Math.max(1, Number(snap.totalChunks) || 1);
  const chunk = Math.max(1, Number(snap.chunk) || 1);
  const ratio = Math.min(1, Math.max(0, Number(snap.ratio) || 0));
  const localRatio = Math.min(1, ((chunk - 1) + ratio) / total);
  if (novel?.isMultiFile && Array.isArray(novel.episodes) && novel.episodes.length > 1) {
    const episodeCount = Math.max(1, novel.episodes.length);
    const episodeIdx = Math.max(0, Math.min(episodeCount - 1, Number(snap.episodeIdx) || 0));
    return Math.min(1, Math.max(0, (episodeIdx + localRatio) / episodeCount));
  }
  return localRatio;
}

export function collectFolderKeys(novels) {
  const keys = new Set();
  novels.forEach(n => {
    const parts = getCategoryParts(n);
    for (let i = 1; i <= parts.length; i += 1) keys.add(parts.slice(0, i).join('>'));
  });
  return keys;
}

export function itemKey(current) {
  if (!current) return '';
  return current.episode ? `${current.novel.id}:${current.episode.id}` : current.novel.id;
}
