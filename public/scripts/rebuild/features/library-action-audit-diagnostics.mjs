import { compactLibraryActionAuditRow, countLibraryRowTypes, mergeCountObjects } from './library-action-audit-summary.mjs';
import { inspectLibraryRowElement } from './library-virtual-row-inspection.mjs';

export const LIBRARY_ACTION_AUDIT_DIAGNOSTICS_SPLIT_PASS = 'v199-library-action-audit-diagnostics-split-pass';


export const LIBRARY_ACTION_AUDIT_PAYLOAD_SPLIT_PASS = 'v202-library-action-audit-payload-split-pass';

export function buildLibraryActionAuditDiagnosticsPayload({
  startedAt = Date.now(),
  actual = null,
  prototype = null,
  prototypeRows = {},
  rendererFlagEnabled = false,
  currentRenderer = 'full',
  nativeDndSupported = false
} = {}) {
  const safeActual = actual || { rows:0, safe:true, readyRows:0, failures:[], actionTypes:{} };
  const safePrototype = prototype || { rows:0, safe:true, readyRows:0, failures:[], actionTypes:{} };
  const actionTypes = mergeCountObjects(safeActual.actionTypes, safePrototype.actionTypes);
  const failures = [
    ...(safeActual.failures || []).slice(0, 12).map(row => ({ ...row, source:'actual' })),
    ...(safePrototype.failures || []).slice(0, 12).map(row => ({ ...row, source:'prototype' }))
  ].slice(0, 20);
  const totalRows = (Number(safeActual.rows) || 0) + (Number(safePrototype.rows) || 0);
  const readyRows = (Number(safeActual.readyRows) || 0) + (Number(safePrototype.readyRows) || 0);
  return {
    available: true,
    mode: 'diagnostic-only',
    rendererFlagEnabled: !!rendererFlagEnabled,
    currentRenderer,
    nativeDndSupported: !!nativeDndSupported,
    safe: !!safeActual.safe && !!safePrototype.safe,
    rows: totalRows,
    readyRows,
    failedRows: totalRows - readyRows,
    actionTypes,
    actual: safeActual,
    prototype: {
      ...safePrototype,
      window: prototypeRows.window,
      totalRows: prototypeRows.totalRows
    },
    summary: {
      folderToggleReady: (safeActual.folderToggleReady || 0) + (safePrototype.folderToggleReady || 0),
      novelOpenReady: (safeActual.novelOpenReady || 0) + (safePrototype.novelOpenReady || 0),
      episodeOpenReady: (safeActual.episodeOpenReady || 0) + (safePrototype.episodeOpenReady || 0),
      actionSheetReady: (safeActual.actionSheetReady || 0) + (safePrototype.actionSheetReady || 0),
      desktopDndReady: (safeActual.desktopDndReady || 0) + (safePrototype.desktopDndReady || 0),
      longPressReady: (safeActual.longPressReady || 0) + (safePrototype.longPressReady || 0),
      renameReady: (safeActual.renameReady || 0) + (safePrototype.renameReady || 0),
      moveReady: (safeActual.moveReady || 0) + (safePrototype.moveReady || 0),
      deleteReady: (safeActual.deleteReady || 0) + (safePrototype.deleteReady || 0),
      favoriteReady: (safeActual.favoriteReady || 0) + (safePrototype.favoriteReady || 0)
    },
    sampleFailures: failures,
    computedAt: startedAt
  };
}

export function auditLibraryActionRows(app, descriptors = [], options = {}) {
  const rows = (Array.isArray(descriptors) ? descriptors : []).map(desc => auditLibraryActionRow(app, desc, options));
  const failures = rows.filter(row => !row.ready);
  const typeCounts = countLibraryRowTypes(rows);
  const actionTypes = rows.reduce((acc, row) => {
    const type = row.actionType || row.type || 'unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  return {
    mode: options.mode || 'unknown',
    rows: rows.length,
    safe: failures.length === 0,
    readyRows: rows.length - failures.length,
    failedRows: failures.length,
    typeCounts,
    actionTypes,
    folderToggleReady: rows.filter(row => row.type === 'folder' && row.folderToggleReady).length,
    novelOpenReady: rows.filter(row => row.type === 'novel' && row.openReady).length,
    episodeOpenReady: rows.filter(row => row.type === 'episode' && row.openReady).length,
    actionSheetReady: rows.filter(row => row.actionSheetReady).length,
    desktopDndReady: rows.filter(row => row.desktopDndReady).length,
    longPressReady: rows.filter(row => row.longPressReady).length,
    favoriteReady: rows.filter(row => row.favoriteReady).length,
    renameReady: rows.filter(row => row.renameReady).length,
    moveReady: rows.filter(row => row.moveReady).length,
    deleteReady: rows.filter(row => row.deleteReady).length,
    failures: failures.slice(0, 24).map(compactLibraryActionAuditRow),
    sampleRows: rows.slice(0, 20).map(compactLibraryActionAuditRow)
  };
}

export function auditLibraryActionRow(app, desc = {}, options = {}) {
  const el = desc.el || null;
  const sourceRow = desc.row || null;
  const inspected = el ? inspectLibraryRowElement(el, sourceRow) : { type:sourceRow?.type || 'unknown', key:sourceRow?.key || '', datasetMissing:['element'], actionDatasetMissing:['element'], classMissing:['element'], actionMissing:true, dataset:{}, actionDataset:null };
  const identity = resolveLibraryIdentityForElement(app, el, sourceRow, inspected, options);
  const action = resolveLibraryActionForElement(app, el, sourceRow, inspected, options);
  const dndTypeOk = String(inspected.dataset?.dndType || '') === inspected.type;
  const draggableReady = !inspected.datasetMissing?.includes?.('libraryDraggable') && !inspected.datasetMissing?.includes?.('dndType') && dndTypeOk;
  const nativeValue = String(inspected.dataset?.nativeDnd || '');
  const nativeDndSupported = !!options.supportsNativeLibraryDnd?.(app);
  const desktopDndReady = identity.valid && draggableReady && (!nativeDndSupported || nativeValue === '1');
  const longPressReady = identity.valid && action.valid && !inspected.actionMissing;
  const openReady = inspected.type === 'folder'
    ? identity.valid
    : inspected.type === 'episode'
      ? identity.valid && !!identity.episode
      : identity.valid && !!identity.novel;
  const folderToggleReady = inspected.type === 'folder' && identity.valid;
  const favoriteReady = inspected.type === 'novel' ? identity.valid && action.valid : true;
  const renameReady = identity.valid && action.valid;
  const moveReady = identity.valid && action.valid;
  const deleteReady = identity.valid && action.valid;
  const failures = [];
  if (!identity.valid) failures.push(...identity.reasons.map(reason => `identity:${reason}`));
  if (!action.valid) failures.push(...action.reasons.map(reason => `action:${reason}`));
  if (!openReady) failures.push('open-target-unresolved');
  if (!folderToggleReady && inspected.type === 'folder') failures.push('folder-toggle-unresolved');
  if (!draggableReady) failures.push('dnd-dataset-missing');
  if (nativeDndSupported && nativeValue !== '1') failures.push('desktop-native-dnd-disabled');
  if (!longPressReady) failures.push('long-press-action-target-unresolved');
  if (!favoriteReady) failures.push('favorite-target-unresolved');
  if (!renameReady) failures.push('rename-target-unresolved');
  if (!moveReady) failures.push('move-target-unresolved');
  if (!deleteReady) failures.push('delete-target-unresolved');
  return {
    source: options.mode || desc.source || 'unknown',
    index: desc.index ?? null,
    type: inspected.type,
    key: inspected.key || sourceRow?.key || '',
    title: inspected.title || sourceRow?.title || '',
    actionType: action.type || inspected.type,
    identity,
    action,
    datasetMissing: inspected.datasetMissing || [],
    actionDatasetMissing: inspected.actionDatasetMissing || [],
    actionMissing: !!inspected.actionMissing,
    classMissing: inspected.classMissing || [],
    openReady,
    folderToggleReady,
    actionSheetReady: identity.valid && action.valid && !inspected.actionMissing,
    desktopDndReady,
    longPressReady,
    favoriteReady,
    renameReady,
    moveReady,
    deleteReady,
    failures,
    ready: failures.length === 0
  };
}

export function resolveLibraryIdentityForElement(app, el, sourceRow = null, inspected = null, options = {}) {
  const type = inspected?.type || sourceRow?.type || (el?.classList?.contains?.('cat-header') ? 'folder' : el?.classList?.contains?.('ep-item') ? 'episode' : 'novel');
  const ds = el?.dataset || {};
  const novelId = String(ds.novelId || sourceRow?.novelId || '');
  const episodeId = String(ds.episodeId || sourceRow?.episodeId || '');
  const folderKey = String(ds.folderKey || sourceRow?.folderKey || '');
  const reasons = [];
  let novel = null;
  let episode = null;
  if (type === 'folder') {
    if (!folderKey) reasons.push('folder-key-missing');
  } else {
    if (!novelId) reasons.push('novel-id-missing');
    novel = novelId ? app.state.novelById?.get?.(novelId) || null : null;
    if (novelId && !novel) reasons.push('novel-not-found');
    if (type === 'episode') {
      if (!episodeId) reasons.push('episode-id-missing');
      episode = novel ? (novel.episodes || []).find(ep => String(ep.id || '') === episodeId) || null : null;
      if (episodeId && !episode) reasons.push('episode-not-found');
    }
  }
  const formatFolderPath = options.formatFolderPath || (value => String(value || ''));
  return {
    valid: reasons.length === 0,
    type,
    novelId,
    episodeId,
    folderKey,
    novelTitle: novel?.title || novel?.fileName || '',
    episodeTitle: episode?.title || episode?.fileName || '',
    folderPath: folderKey ? formatFolderPath(folderKey) : '',
    novel: !!novel,
    episode: !!episode,
    reasons
  };
}

export function resolveLibraryActionForElement(app, el, sourceRow = null, inspected = null, options = {}) {
  const action = el?.querySelector?.('.library-action-btn') || null;
  const ds = action?.dataset || {};
  const type = String(ds.type || inspected?.type || sourceRow?.type || '');
  const reasons = [];
  if (!action) reasons.push('action-button-missing');
  if (!type) reasons.push('action-type-missing');
  if (inspected?.type && type && type !== inspected.type) reasons.push('action-type-mismatch');
  const identity = resolveLibraryActionDatasetIdentity(app, ds, sourceRow, type || inspected?.type || 'unknown', options);
  if (!identity.valid) reasons.push(...identity.reasons);
  return {
    valid: reasons.length === 0,
    type,
    dataset: { ...ds },
    identity,
    reasons
  };
}

export function resolveLibraryActionDatasetIdentity(app, dataset = {}, sourceRow = null, type = '', options = {}) {
  const fake = { dataset };
  const inspected = { type: type || sourceRow?.type || 'unknown' };
  return resolveLibraryIdentityForElement(app, fake, sourceRow, inspected, options);
}
