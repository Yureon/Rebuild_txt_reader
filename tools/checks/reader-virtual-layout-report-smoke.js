const path = require('path');
const { pathToFileURL } = require('url');
const { readProjectSourceManifest, buildProjectSourceManifestSummary } = require('./source-loader-manifest.js');

const READER_VIRTUAL_LAYOUT_REPORT_SMOKE_PASS = 'v232-reader-virtual-layout-report-smoke-pass';
const READER_VIRTUAL_LAYOUT_UNAVAILABLE_REPORT_SMOKE_PASS = 'v233-reader-virtual-layout-unavailable-report-smoke-pass';
const READER_VIRTUAL_LAYOUT_BOUNDARY_REPORT_SMOKE_PASS = 'v235-reader-virtual-layout-boundary-report-smoke-pass';
const READER_VIRTUAL_LAYOUT_AVAILABLE_BOUNDARY_SMOKE_PASS = 'v236-reader-virtual-layout-available-boundary-smoke-pass';
const READER_VIRTUAL_LAYOUT_IN_PROCESS_IMPORT_PASS = 'v254-reader-virtual-layout-in-process-import-pass';

async function runReaderVirtualLayoutReportSmoke(projectRoot) {
  if (!projectRoot) throw new Error('runReaderVirtualLayoutReportSmoke requires projectRoot');
  const sources = readProjectSourceManifest(projectRoot, {
    labels: 'rebuild/features/reader/virtual-layout-report-labels.mjs',
    diagnostics: 'rebuild/features/reader/virtual-layout-diagnostics.mjs'
  });
  const sourceSummary = buildProjectSourceManifestSummary(sources);
  ['buildVirtualLayoutExportShapeReport', 'buildVirtualLayoutExportSummary', 'isVirtualLayoutExportSummaryShape', 'isVirtualLayoutReportSurfaceShape'].forEach(marker => {
    if (!sources.labels.includes(marker)) throw new Error('virtual layout label source marker missing: ' + marker);
  });
  ['buildVirtualLayoutDiagnosticsBoundary', 'createVirtualLayoutUnavailableDiagnostics'].forEach(marker => {
    if (!sources.diagnostics.includes(marker)) throw new Error('virtual layout diagnostics source marker missing: ' + marker);
  });
  const labels = await import(pathToFileURL(path.join(projectRoot, 'public/scripts/rebuild/features/reader/virtual-layout-report-labels.mjs')).href + '?smoke=v254');
  const diagnosticsMod = await import(pathToFileURL(path.join(projectRoot, 'public/scripts/rebuild/features/reader/virtual-layout-diagnostics.mjs')).href + '?smoke=v254');
  const {
    buildVirtualLayoutExportShapeReport,
    buildVirtualLayoutExportSummary,
    isVirtualLayoutExportSummaryShape,
    isVirtualLayoutReportSurfaceShape
  } = labels;
  const { buildVirtualLayoutDiagnosticsBoundary, createVirtualLayoutUnavailableDiagnostics } = diagnosticsMod;
  const diagnostics = { available:true, renderedRows:7, mountedRows:5, staleMeasureCacheSize:2 };
  const summary = buildVirtualLayoutExportSummary(diagnostics);
  if (!isVirtualLayoutExportSummaryShape(summary)) throw new Error('export summary shape guard rejected a valid summary');
  const report = buildVirtualLayoutExportShapeReport(diagnostics);
  if (!report.valid) throw new Error('export shape report did not mark the valid summary');
  if (report.pass !== 'v232-reader-virtual-layout-export-payload-shape-report-pass') throw new Error('stale export shape report pass marker');
  if (!String(report.summary.copyLabel || '').includes('stale measure 2')) throw new Error('copy label summary lost stale measure count');
  const unavailable = buildVirtualLayoutExportShapeReport({ available:false, reason:'virtual state not initialized', mountedRows:0 });
  if (!unavailable.valid) throw new Error('unavailable diagnostics summary must keep valid export shape');
  if (unavailable.summary.availability !== 'unavailable') throw new Error('unavailable diagnostics lost availability label');
  if (!String(unavailable.summary.copyLabel || '').includes('virtual state not initialized')) throw new Error('unavailable diagnostics copy label lost reason');
  const content = { querySelectorAll(selector){ return selector.includes('reader-vrow-body') ? [{}, {}] : [{}, {}, {}]; } };
  const boundaryUnavailable = buildVirtualLayoutDiagnosticsBoundary({ content });
  if (boundaryUnavailable.available !== false) throw new Error('missing virtual state must create unavailable diagnostics');
  if (!isVirtualLayoutReportSurfaceShape(boundaryUnavailable.reportSurface)) throw new Error('unavailable boundary report surface shape failed');
  const customUnavailable = createVirtualLayoutUnavailableDiagnostics(content, 'cache unavailable');
  if (customUnavailable.reason !== 'cache unavailable' || customUnavailable.mountedRows !== 3) throw new Error('custom unavailable diagnostics lost reason or mounted row count');
  const availableBoundary = buildVirtualLayoutDiagnosticsBoundary({
    app:{ state:{ loadedChunks:new Set([1, 2]) } },
    v:{
      rows:[{ id:'1:h', type:'header' }, { id:'1:b:0', type:'body' }, { id:'2:b:0', type:'body' }],
      renderedStart:0,
      renderedEnd:3,
      rowIndexesByChunk:new Map([[1, [0, 1]], [2, [2]]]),
      measureCache:new Map([['1:h', 76], ['stale-row', 100]]),
      rowElementPool:new Map([['1:h', {}]]),
      heights:[76, 88, 88],
      prefix:[0, 76, 164, 252],
      totalHeight:252,
      layoutRevision:4
    },
    content,
    reader:{ scrollTop:32, clientHeight:640 },
    constants:{ maxRenderedRows:180, rowElementPoolMax:300 }
  });
  if (availableBoundary.available !== true) throw new Error('available boundary diagnostics must stay available');
  if (!isVirtualLayoutReportSurfaceShape(availableBoundary.reportSurface)) throw new Error('available boundary report surface shape failed');
  if (availableBoundary.staleMeasureCacheSize !== 1) throw new Error('available boundary stale measure count failed');
  return {
    pass: READER_VIRTUAL_LAYOUT_REPORT_SMOKE_PASS,
    unavailablePass: READER_VIRTUAL_LAYOUT_UNAVAILABLE_REPORT_SMOKE_PASS,
    boundaryPass: READER_VIRTUAL_LAYOUT_BOUNDARY_REPORT_SMOKE_PASS,
    availableBoundaryPass: READER_VIRTUAL_LAYOUT_AVAILABLE_BOUNDARY_SMOKE_PASS,
    inProcessImportPass: READER_VIRTUAL_LAYOUT_IN_PROCESS_IMPORT_PASS,
    sourceManifestPass: sourceSummary.pass
  };
}

module.exports = {
  READER_VIRTUAL_LAYOUT_REPORT_SMOKE_PASS,
  READER_VIRTUAL_LAYOUT_UNAVAILABLE_REPORT_SMOKE_PASS,
  READER_VIRTUAL_LAYOUT_BOUNDARY_REPORT_SMOKE_PASS,
  READER_VIRTUAL_LAYOUT_AVAILABLE_BOUNDARY_SMOKE_PASS,
  READER_VIRTUAL_LAYOUT_IN_PROCESS_IMPORT_PASS,
  runReaderVirtualLayoutReportSmoke
};
