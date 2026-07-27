import { countLibraryRowTypes } from './library-action-audit-summary.mjs';

export const LIBRARY_PROTOTYPE_DIAGNOSTICS_SPLIT_PASS = 'v202-library-prototype-diagnostics-split-pass';

export function buildLibraryPrototypeDiagnosticsPayload({
  startedAt = Date.now(),
  proto = {},
  prototypeRows = [],
  actualRows = [],
  comparisons = [],
  missingActual = [],
  datasetMismatch = [],
  actionMissing = [],
  requiredDatasetMissing = [],
  actualRowsInWindow = 0,
  interactionSafety = null
} = {}) {
  const visibleRows = Array.isArray(proto.visibleRows) ? proto.visibleRows : [];
  const fragment = proto.fragment || null;
  return {
    available: true,
    mode: 'detached-prototype-only',
    rendererUnchanged: true,
    totalFlattenRows: visibleRows.length,
    window: proto.summary || {},
    maintenancePass: proto.maintenancePass || '',
    prototype: {
      rows: prototypeRows.length,
      fragmentChildNodes: fragment?.childNodes ? fragment.childNodes.length : 0,
      rootDropzone: !!fragment?.querySelector?.('.library-root-dropzone'),
      datasetReadyRows: prototypeRows.filter(row => row.datasetMissing.length === 0 && row.actionDatasetMissing.length === 0 && row.classMissing.length === 0).length,
      missingRequiredRows: requiredDatasetMissing.length,
      typeCounts: countLibraryRowTypes(prototypeRows),
      sampleRows: prototypeRows.slice(0, 20),
      interactionSafety
    },
    actual: {
      rows: actualRows.length,
      rowsInWindow: actualRowsInWindow,
      typeCounts: countLibraryRowTypes(actualRows),
      sampleRows: actualRows.slice(0, 20)
    },
    comparison: {
      checkedRows: comparisons.length,
      missingActual: missingActual.length,
      datasetMismatch: datasetMismatch.length,
      actionMissing: actionMissing.length,
      okRows: comparisons.filter(item => item.status === 'ok').length,
      unsafeForWindowing: !!(missingActual.length || datasetMismatch.length || actionMissing.length || requiredDatasetMissing.length),
      sample: comparisons.filter(item => item.status !== 'ok').slice(0, 20)
    },
    requiredIdentity: {
      folder: ['.cat-header', 'data-folder-key', 'data-library-draggable', 'data-dnd-type', '.library-action-btn[data-type="folder"]'],
      novel: ['.novel-item', 'data-novel-id', 'data-library-draggable', 'data-dnd-type', '.library-action-btn[data-type="novel"]'],
      episode: ['.ep-item', 'data-novel-id', 'data-episode-id', 'data-library-draggable', 'data-dnd-type', '.library-action-btn[data-type="episode"]']
    },
    computedAt: startedAt
  };
}
