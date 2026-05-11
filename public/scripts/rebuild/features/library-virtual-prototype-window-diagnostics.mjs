export const LIBRARY_VIRTUAL_PROTOTYPE_WINDOW_DIAGNOSTICS_PASS = 'v208-library-virtual-prototype-window-diagnostics-pass';

function countTypes(rows = []) {
  return (Array.isArray(rows) ? rows : []).reduce((acc, row) => {
    const key = String(row?.type || 'unknown');
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function countMissing(inspectedRows = [], key = '') {
  return (Array.isArray(inspectedRows) ? inspectedRows : []).reduce((total, row) => {
    const value = row?.[key];
    return total + (Array.isArray(value) ? value.length : 0);
  }, 0);
}

export function buildLibraryVirtualPrototypeWindowDiagnostics({ rowsInfo = {}, visibleRows = [], plan = {}, summary = {}, start = 0, end = 0, renderRows = [], elements = [], inspectedRows = [], rowsCacheHit = false, maintenancePass = '' } = {}) {
  const rows = Array.isArray(visibleRows) ? visibleRows : [];
  const rendered = Array.isArray(renderRows) ? renderRows : [];
  const inspected = Array.isArray(inspectedRows) ? inspectedRows : [];
  const renderStart = Math.max(0, Number(start) || 0);
  const renderEnd = Math.max(renderStart, Number(end) || renderStart);
  return {
    pass: LIBRARY_VIRTUAL_PROTOTYPE_WINDOW_DIAGNOSTICS_PASS,
    available: true,
    rendererUnchanged: true,
    totalRows: rows.length,
    flattenedRows: Array.isArray(rowsInfo?.flattened) ? rowsInfo.flattened.length : null,
    renderRange: { start: renderStart, end: renderEnd, count: rendered.length },
    visibleRange: {
      start: Number.isFinite(Number(summary.visibleStart)) ? Number(summary.visibleStart) : Number(plan.visibleStart) || 0,
      end: Number.isFinite(Number(summary.visibleEnd)) ? Number(summary.visibleEnd) : Number(plan.visibleEnd) || 0
    },
    active: {
      key: rowsInfo?.activeKey || '',
      index: Number.isFinite(Number(rowsInfo?.activeIndex)) ? Number(rowsInfo.activeIndex) : null,
      inWindow: !!summary.activeInWindow || !!plan.activeInWindow
    },
    rowHeight: Number(summary.rowHeight || plan.rowHeight || 0) || 0,
    spacer: {
      top: Number(summary.topSpacerHeight || plan.topSpacerHeight || 0) || 0,
      bottom: Number(summary.bottomSpacerHeight || plan.bottomSpacerHeight || 0) || 0
    },
    elements: {
      renderedDomRows: Array.isArray(elements) ? elements.length : 0,
      inspectedRows: inspected.length,
      datasetMissing: countMissing(inspected, 'datasetMissing'),
      actionDatasetMissing: countMissing(inspected, 'actionDatasetMissing'),
      classMissing: countMissing(inspected, 'classMissing'),
      actionMissingRows: inspected.filter(row => row?.actionMissing).length
    },
    typeCounts: countTypes(rows),
    renderedTypeCounts: countTypes(rendered),
    inspectedTypeCounts: countTypes(inspected),
    rowsCacheHit: !!rowsCacheHit,
    maintenancePass
  };
}
