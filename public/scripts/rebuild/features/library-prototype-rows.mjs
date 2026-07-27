import { createEl } from '../core/utils.mjs';
import { comparePrototypeLibraryRow, getActualLibraryRowDiagnostics, getLibraryInteractionSafety, inspectLibraryRowElement } from './library-virtual-row-inspection.mjs';
import { buildLibraryVirtualPrototypeWindowDiagnostics } from './library-virtual-prototype-window-diagnostics.mjs';
import { buildLibraryPrototypeDiagnosticsPayload } from './library-prototype-diagnostics.mjs';
import { computeLibraryWindow, getProgressRatioForState, summarizeLibraryWindowPlan } from './library-model.mjs';

export const LIBRARY_PROTOTYPE_ROWS_PASS = 'v283-library-prototype-rows-pass';
export const LIBRARY_PROTOTYPE_LEFT_DISCLOSURE_PASS = 'v371-library-prototype-left-disclosure-pass';


function titleTrack(text) {
  const label = String(text || '');
  return createEl('span', { class:'library-title-track', title: label }, [
    createEl('span', { class:'library-title-text', text: label }),
    createEl('span', { class:'library-title-ghost', text: label, 'aria-hidden':'true' })
  ]);
}

function createTitleEl(tag, className, text) {
  return createEl(tag, { class:`${className} library-title-marquee` }, titleTrack(text));
}

function createDisclosureButton(className, attrs = {}, expanded = false, arrowClass = 'cat-arrow') {
  return createEl('button', {
    class:`library-disclosure-btn ${className}`,
    type:'button',
    title: expanded ? '목록 접기' : '목록 펼치기',
    'aria-label': expanded ? '목록 접기' : '목록 펼치기',
    'aria-expanded': expanded ? 'true' : 'false',
    dataset: attrs,
    safeHtml:`<span class="${arrowClass}" aria-hidden="true">▾</span>`
  });
}

export function createRootDropZone() {
  return createEl('div', {
    class:'library-root-dropzone',
    dataset:{ dropType:'root', folderKey:'' },
    text:'여기로 놓으면 루트로 이동'
  });
}

export function createPrototypeLibraryRow(app, row, deps = {}) {
  const libraryDraggableAttrs = deps.libraryDraggableAttrs || (() => ({}));
  if (row?.type === 'folder') {
    return createEl('div', { class:`cat-header${row.collapsed ? ' collapsed' : ''}`, ...libraryDraggableAttrs(app, 'folder', { folderKey:row.folderKey || '' }) }, [
      createDisclosureButton('folder-toggle-btn', { folderKey: row.folderKey || '' }, !row.collapsed, 'cat-arrow'),
      createTitleEl('span', 'folder-title', row.title || row.name || 'Folder'),
      createEl('button', { class:'library-action-btn folder-action-btn', type:'button', title:'폴더 작업', 'aria-label':'폴더 작업', dataset:{ type:'folder', folderKey:row.folderKey || '' }, safeHtml:'<span aria-hidden="true">⚙</span>' })
    ]);
  }
  if (row?.type === 'episode') {
    return createEl('div', { class:`ep-item${row.active ? ' active' : ''}`, ...libraryDraggableAttrs(app, 'episode', { novelId:row.novelId || '', episodeId:row.episodeId || '' }) }, [
      createTitleEl('span', 'ep-title', row.title || row.fileName || 'Episode'),
      createEl('button', { class:'library-action-btn episode-action-btn', type:'button', title:'회차 작업', 'aria-label':'회차 작업', dataset:{ type:'episode', novelId:row.novelId || '', episodeId:row.episodeId || '' }, safeHtml:'<span aria-hidden="true">☷</span>' })
    ]);
  }
  const novel = app.state.novelById?.get?.(row?.novelId || '') || null;
  const ratio = novel ? getProgressRatioForState(app.state, novel) : 0;
  const meta = novel ? deps.formatNovelMeta?.(app, novel, ratio, !!row.active) : `${row?.isMultiFile ? row?.episodeCount || 0 : '단일'} · prototype`;
  return createEl('div', { class:`novel-item${row?.active ? ' active' : ''}${row?.isMultiFile ? ' multi-file' : ''}${row?.expanded ? ' episode-open' : ''}`, ...libraryDraggableAttrs(app, 'novel', { novelId:row?.novelId || '' }) }, [
    row?.isMultiFile ? createDisclosureButton('episode-toggle-btn', { novelId: row?.novelId || '' }, !!row?.expanded, 'episode-arrow') : null,
    createEl('button', { class:'library-action-btn novel-action-btn', type:'button', title:'작품 작업', 'aria-label':'작품 작업', dataset:{ type:'novel', novelId:row?.novelId || '' }, safeHtml:'<span aria-hidden="true">☷</span>' }),
    createTitleEl('div', 'novel-title', row?.title || row?.fileName || 'Untitled'),
    createEl('div', { class:'novel-meta', text: meta }),
    createEl('div', { class:'progress-bar' }, createEl('div', { class:'progress-fill', style:`width:${Math.round(ratio * 100)}%` }))
  ]);
}

export function decorateVirtualLibraryRow(row, el) {
  if (!row || !el) return el;
  el.classList.add('library-virtual-row');
  el.dataset.libraryRowKey = row.key || '';
  el.dataset.libraryDepth = String(Math.max(0, Number(row.depth) || 0));
  el.style.setProperty('--library-depth', String(Math.max(0, Number(row.depth) || 0)));
  return el;
}

export function buildLibraryVirtualPrototypeWindowRows(app, options = {}, deps = {}) {
  const filteredNovels = options.filteredNovels || deps.getLibraryFilteredNovels?.(app) || [];
  const rowsInfo = options.rowsInfo || deps.getLibraryVirtualRows?.(app, filteredNovels);
  const flattened = rowsInfo.flattened;
  const visibleRows = rowsInfo.visibleRows;
  const metrics = options.metrics || deps.getLibraryWindowDomMetrics?.(app) || {};
  const plan = options.windowPlan || computeLibraryWindow(visibleRows, { ...metrics, rowsAlreadyVisible: true, activeIndex: rowsInfo.activeIndex, activeRow: rowsInfo.activeRow });
  const summary = summarizeLibraryWindowPlan(plan);
  const start = Math.max(0, Number(summary.renderStart) || 0);
  const end = Math.max(start, Number(summary.renderEnd) || start);
  const renderRows = visibleRows.slice(start, end);
  const fragment = document.createDocumentFragment();
  if (options.includeRootDropZone) fragment.append(createRootDropZone());
  renderRows.forEach(row => {
    const raw = createPrototypeLibraryRow(app, row, deps);
    fragment.append(options.decorateRows ? decorateVirtualLibraryRow(row, raw) : raw);
  });
  const elements = Array.from(fragment.querySelectorAll('.cat-header,.novel-item,.ep-item'));
  const inspectedRows = elements.map((el, index) => inspectLibraryRowElement(el, renderRows[index] || null));
  const maintenancePass = 'v141-library-render-path-optimization-pass';
  const diagnostics = buildLibraryVirtualPrototypeWindowDiagnostics({
    rowsInfo,
    visibleRows,
    plan,
    summary,
    start,
    end,
    renderRows,
    elements,
    inspectedRows,
    rowsCacheHit: !!rowsInfo.cacheHit,
    maintenancePass
  });
  return {
    filteredNovels,
    flattened,
    visibleRows,
    metrics,
    plan,
    summary,
    start,
    end,
    renderRows,
    fragment,
    elements,
    inspectedRows,
    rowsInfo,
    rowsCacheHit: !!rowsInfo.cacheHit,
    maintenancePass,
    diagnostics
  };
}

export function getLibraryPrototypeDiagnostics(app, deps = {}) {
  const startedAt = Date.now();
  const proto = buildLibraryVirtualPrototypeWindowRows(app, { includeRootDropZone:true }, deps);
  const prototypeRows = proto.inspectedRows;
  const interactionSafety = getLibraryInteractionSafety(prototypeRows);
  const actualRows = getActualLibraryRowDiagnostics(app);
  const actualByKey = new Map(actualRows.map(row => [row.key, row]));
  const comparisons = prototypeRows.map(protoRow => comparePrototypeLibraryRow(protoRow, actualByKey.get(protoRow.key) || null));
  return buildLibraryPrototypeDiagnosticsPayload({
    startedAt,
    proto,
    prototypeRows,
    actualRows,
    comparisons,
    missingActual: comparisons.filter(item => item.status === 'missing-actual'),
    datasetMismatch: comparisons.filter(item => item.datasetMissing.length || item.actionDatasetMissing.length || item.classMissing.length),
    actionMissing: comparisons.filter(item => item.actionMissing),
    requiredDatasetMissing: prototypeRows.filter(row => row.datasetMissing.length || row.actionDatasetMissing.length || row.classMissing.length),
    actualRowsInWindow: proto.renderRows.filter(row => actualByKey.has(row.key)).length,
    interactionSafety
  });
}
