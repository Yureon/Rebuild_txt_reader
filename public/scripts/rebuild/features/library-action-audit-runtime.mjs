import { auditLibraryActionRows, buildLibraryActionAuditDiagnosticsPayload } from './library-action-audit-diagnostics.mjs';

export function getLibraryActionAuditDiagnostics(app, helpers = {}) {
  const startedAt = Date.now();
  const actualRows = getActualLibraryActionAuditRows(app);
  const prototypeRows = getPrototypeLibraryActionAuditRows(app, helpers.buildLibraryVirtualPrototypeWindowRows);
  const auditOptions = {
    supportsNativeLibraryDnd: helpers.supportsNativeLibraryDnd,
    formatFolderPath: helpers.formatFolderPath
  };
  const actual = auditLibraryActionRows(app, actualRows, { mode:'actual-dom', ...auditOptions });
  const prototype = auditLibraryActionRows(app, prototypeRows.rows, { mode:'detached-prototype', ...auditOptions });
  return buildLibraryActionAuditDiagnosticsPayload({
    startedAt,
    actual,
    prototype,
    prototypeRows,
    rendererFlagEnabled: typeof helpers.isLibraryVirtualRendererEnabled === 'function' ? helpers.isLibraryVirtualRendererEnabled(app) : false,
    currentRenderer: app?.els?.novelList?.dataset?.libraryVirtualActive === '1' ? 'windowed' : 'full',
    nativeDndSupported: typeof helpers.supportsNativeLibraryDnd === 'function' ? helpers.supportsNativeLibraryDnd(app) : false
  });
}

function getActualLibraryActionAuditRows(app) {
  const box = app?.els?.novelList;
  if (!box) return [];
  return Array.from(box.querySelectorAll('.cat-header,.novel-item,.ep-item')).map((el, index) => ({ el, row:null, index, source:'actual' }));
}

function getPrototypeLibraryActionAuditRows(app, buildLibraryVirtualPrototypeWindowRows) {
  if (typeof buildLibraryVirtualPrototypeWindowRows !== 'function') {
    return {
      rows: [],
      totalRows: 0,
      window: { start:0, end:0, renderCount:0, scrollTop:0 },
      maintenancePass: 'library-action-audit-runtime-no-prototype-builder'
    };
  }
  const proto = buildLibraryVirtualPrototypeWindowRows(app, { decorateRows:true });
  return {
    rows: proto.elements.map((el, index) => ({ el, row:proto.renderRows[index] || null, index:proto.start + index, source:'prototype' })),
    totalRows: proto.visibleRows.length,
    window: {
      ...proto.summary,
      renderCount: proto.elements.length,
      scrollTop: proto.summary.scrollTop || proto.metrics.scrollTop
    },
    maintenancePass: proto.maintenancePass
  };
}
