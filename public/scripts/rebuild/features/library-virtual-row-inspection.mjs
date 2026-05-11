import { createEl } from '../core/utils.mjs';

export const LIBRARY_VIRTUAL_ROW_INSPECTION_SPLIT_PASS = 'v198-library-virtual-row-inspection-split-pass';

export function createLibraryVirtualSpacer(kind, height, rowCount) {
  const safeHeight = Math.max(0, Math.round(Number(height) || 0));
  return createEl('div', {
    class:`library-virtual-spacer library-virtual-spacer-${kind}`,
    dataset:{ spacer:kind, rows:String(Math.max(0, Number(rowCount) || 0)) },
    style:`height:${safeHeight}px`
  });
}

export function getLibraryVirtualGateSignature(rows = [], options = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const total = list.length;
  const first = list[0]?.key || '';
  const middle = total ? list[Math.floor(total / 2)]?.key || '' : '';
  const last = total ? list[total - 1]?.key || '' : '';
  const active = String(options.activeKey || '') || (list.find(row => !!row?.active)?.key || '');
  const sampleStep = total > 48 ? Math.max(1, Math.floor(total / 16)) : 1;
  let sampled = '';
  for (let i = 0; i < total; i += sampleStep) {
    sampled += '|' + String(list[i]?.key || '');
    if (sampled.length > 1200) break;
  }
  return [total, first, middle, last, active, sampled].join('::');
}

export function getActualLibraryRowDiagnostics(app) {
  const box = app.els.novelList;
  if (!box) return [];
  return Array.from(box.querySelectorAll('.cat-header,.novel-item,.ep-item')).map(el => inspectLibraryRowElement(el, null));
}

export function inspectLibraryRowElement(el, sourceRow = null) {
  const type = el.classList.contains('cat-header') ? 'folder' : el.classList.contains('ep-item') ? 'episode' : 'novel';
  const action = el.querySelector?.('.library-action-btn') || null;
  const key = type === 'folder'
    ? `folder:${el.dataset.folderKey || sourceRow?.folderKey || ''}`
    : type === 'episode'
      ? `episode:${el.dataset.novelId || sourceRow?.novelId || ''}:${el.dataset.episodeId || sourceRow?.episodeId || ''}`
      : `novel:${el.dataset.novelId || sourceRow?.novelId || ''}`;
  const requiredDatasets = type === 'folder'
    ? ['folderKey', 'libraryDraggable', 'dndType', 'nativeDnd']
    : type === 'episode'
      ? ['novelId', 'episodeId', 'libraryDraggable', 'dndType', 'nativeDnd']
      : ['novelId', 'libraryDraggable', 'dndType', 'nativeDnd'];
  const requiredActionDatasets = type === 'folder'
    ? ['type', 'folderKey']
    : type === 'episode'
      ? ['type', 'novelId', 'episodeId']
      : ['type', 'novelId'];
  const expectedClass = type === 'folder' ? 'cat-header' : type === 'episode' ? 'ep-item' : 'novel-item';
  return {
    type,
    key,
    title: sourceRow?.title || el.querySelector?.('.folder-title,.novel-title,.ep-title')?.textContent || '',
    className: el.className || '',
    dataset: { ...el.dataset },
    actionDataset: action ? { ...action.dataset } : null,
    actionMissing: !action,
    datasetMissing: requiredDatasets.filter(name => !(name in el.dataset) || String(el.dataset[name] || '') === ''),
    actionDatasetMissing: action ? requiredActionDatasets.filter(name => !(name in action.dataset) || String(action.dataset[name] || '') === '') : requiredActionDatasets,
    classMissing: el.classList.contains(expectedClass) ? [] : [expectedClass],
    sourceDepth: Number.isFinite(Number(sourceRow?.depth)) ? Number(sourceRow.depth) : null,
    sourceParentKey: sourceRow?.parentKey || ''
  };
}

export function comparePrototypeLibraryRow(protoRow, actual) {
  if (!actual) {
    return {
      key: protoRow.key,
      type: protoRow.type,
      title: protoRow.title,
      status: 'missing-actual',
      datasetMissing: [],
      actionDatasetMissing: [],
      classMissing: [],
      actionMissing: false
    };
  }
  const datasetKeys = protoRow.type === 'folder'
    ? ['folderKey', 'libraryDraggable', 'dndType', 'nativeDnd']
    : protoRow.type === 'episode'
      ? ['novelId', 'episodeId', 'libraryDraggable', 'dndType', 'nativeDnd']
      : ['novelId', 'libraryDraggable', 'dndType', 'nativeDnd'];
  const actionKeys = protoRow.type === 'folder'
    ? ['type', 'folderKey']
    : protoRow.type === 'episode'
      ? ['type', 'novelId', 'episodeId']
      : ['type', 'novelId'];
  const datasetMismatch = datasetKeys.filter(key => String(protoRow.dataset?.[key] || '') !== String(actual.dataset?.[key] || ''));
  const actionDatasetMismatch = actionKeys.filter(key => String(protoRow.actionDataset?.[key] || '') !== String(actual.actionDataset?.[key] || ''));
  const className = protoRow.type === 'folder' ? 'cat-header' : protoRow.type === 'episode' ? 'ep-item' : 'novel-item';
  const classMissing = actual.className?.includes?.(className) ? [] : [className];
  const actionMissing = !!actual.actionMissing;
  const status = datasetMismatch.length || actionDatasetMismatch.length || classMissing.length || actionMissing ? 'mismatch' : 'ok';
  return {
    key: protoRow.key,
    type: protoRow.type,
    title: protoRow.title,
    status,
    datasetMissing: datasetMismatch,
    actionDatasetMissing: actionDatasetMismatch,
    classMissing,
    actionMissing
  };
}


export function getLibraryInteractionSafety(rows = []) {
  const inspected = Array.isArray(rows) ? rows : [];
  const actionTypes = inspected.reduce((acc, row) => {
    const type = row?.actionDataset?.type || row?.type || 'unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  const missingDraggable = inspected.filter(row => row.datasetMissing?.includes?.('libraryDraggable') || row.datasetMissing?.includes?.('dndType') || row.datasetMissing?.includes?.('nativeDnd'));
  const missingActions = inspected.filter(row => row.actionMissing || (Array.isArray(row.actionDatasetMissing) && row.actionDatasetMissing.length));
  const missingIdentity = inspected.filter(row => {
    const missing = Array.isArray(row.datasetMissing) ? row.datasetMissing : [];
    if (row.type === 'folder') return missing.includes('folderKey');
    if (row.type === 'episode') return missing.includes('novelId') || missing.includes('episodeId');
    return missing.includes('novelId');
  });
  const nativeRows = inspected.filter(row => String(row.dataset?.nativeDnd || '') === '1');
  const mobileRows = inspected.filter(row => String(row.dataset?.nativeDnd || '') === '0');
  const sample = [...missingIdentity, ...missingDraggable, ...missingActions].slice(0, 12).map(row => ({
    key: row.key,
    type: row.type,
    title: row.title,
    datasetMissing: row.datasetMissing || [],
    actionDatasetMissing: row.actionDatasetMissing || [],
    actionMissing: !!row.actionMissing
  }));
  return {
    rows: inspected.length,
    safe: missingIdentity.length === 0 && missingDraggable.length === 0 && missingActions.length === 0,
    draggableReadyRows: inspected.length - missingDraggable.length,
    actionReadyRows: inspected.length - missingActions.length,
    identityReadyRows: inspected.length - missingIdentity.length,
    nativeDndRows: nativeRows.length,
    mobileActionSheetRows: mobileRows.length,
    actionTypes,
    missingIdentityRows: missingIdentity.length,
    missingDraggableRows: missingDraggable.length,
    missingActionRows: missingActions.length,
    sample
  };
}

