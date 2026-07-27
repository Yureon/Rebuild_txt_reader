const { readProjectSourceManifest, buildProjectSourceManifestSummary } = require('./source-loader-manifest.js');
const { runModuleSmokeScript } = require('./smoke-child-runner.js');

const READER_MANUAL_DIAGNOSTICS_STORAGE_SMOKE_PASS = 'v251-reader-manual-diagnostics-storage-smoke-pass';
const READER_MANUAL_DIAGNOSTICS_BROWSER_EXPORT_IMPORT_SMOKE_PASS = 'v258-reader-manual-diagnostics-browser-export-import-smoke-pass';

async function runReaderManualDiagnosticsStorageSmoke(projectRoot) {
  const sources = readProjectSourceManifest(projectRoot, {
    storage: 'rebuild/features/reader/manual-diagnostics-storage.mjs',
    reader: 'rebuild/features/reader.mjs',
    snapshot: 'rebuild/features/reader/manual-diagnostics-snapshot.mjs',
    summaryPanel: 'rebuild/features/recovery/summary-panel.mjs'
  });
  const sourceSummary = buildProjectSourceManifestSummary(sources);
  ['v251-reader-manual-diagnostics-storage-pass', 'loadReaderManualDiagnosticsHistory', 'appendAndSaveReaderManualDiagnosticsSnapshot', 'promptAndAppendReaderManualDiagnosticsSnapshot', 'clearReaderManualDiagnosticsHistory','READER_MANUAL_DIAGNOSTICS_IMPORT_EXPORT_PASS','buildReaderManualDiagnosticsHistoryPayload','exportReaderManualDiagnosticsHistory','importReaderManualDiagnosticsHistory','buildReaderManualDiagnosticsImportPreview','v258-reader-manual-diagnostics-browser-export-import-pass'].forEach(marker => {
    if (!sources.storage.includes(marker)) throw new Error('reader manual diagnostics storage marker missing: ' + marker);
  });
  ['recordManualDiagnostics', 'clearManualDiagnostics', 'exportManualDiagnostics', 'importManualDiagnostics', 'loadReaderManualDiagnosticsHistory'].forEach(marker => {
    if (!sources.reader.includes(marker)) throw new Error('manual diagnostics storage not wired: ' + marker);
  });
  ['v258-reader-manual-diagnostics-real-export-trend-pass','sourceCoverage','normalizeManualDiagnosticsEntry'].forEach(marker => {
    if (!sources.snapshot.includes(marker)) throw new Error('manual diagnostics snapshot import marker missing: ' + marker);
  });
  ['v258-recovery-summary-real-browser-export-trend-pass','sourceCoverage?.mobile','sourceCoverage?.imported'].forEach(marker => {
    if (!sources.summaryPanel.includes(marker)) throw new Error('recovery summary real browser trend marker missing: ' + marker);
  });
  const script = `
    const mod = await import('./public/scripts/rebuild/features/reader/manual-diagnostics-storage.mjs');
    const app = { state:{} };
    globalThis.localStorage = { data:new Map(), getItem(k){ return this.data.has(k) ? this.data.get(k) : null; }, setItem(k,v){ this.data.set(k, String(v)); }, removeItem(k){ this.data.delete(k); } };
    const payload = { browserChecks:[
      { source:'pc-export', pcDragSmooth:true, mobileScrollSmooth:null, searchJumpOk:true, liveRowAvailable:true, retryCount:1, notes:'pc ok' },
      { source:'mobile-export', pcDragSmooth:null, mobileScrollSmooth:true, searchJumpOk:true, highlightedMatch:true, retryCount:2, notes:'mobile ok' }
    ] };
    const preview = mod.buildReaderManualDiagnosticsImportPreview(payload);
    if (preview.pass !== 'v258-reader-manual-diagnostics-browser-export-import-pass' || preview.count !== 2) throw new Error('import preview failed');
    if (preview.trendBundle.sourceCoverage.pc !== 1 || preview.trendBundle.sourceCoverage.mobile !== 1 || preview.trendBundle.sourceCoverage.imported !== 2) throw new Error('import source coverage failed');
    const history = mod.importReaderManualDiagnosticsHistory(app, JSON.stringify(payload));
    if (history.length !== 2 || app.state.readerManualDiagnosticsRecoveryTrend.sourceCoverage.mobile !== 1) throw new Error('import history trend not applied');
    const exported = mod.buildReaderManualDiagnosticsHistoryPayload(app);
    if (exported.browserExportImportPass !== 'v258-reader-manual-diagnostics-browser-export-import-pass' || exported.realExportTrendPass !== 'v258-reader-manual-diagnostics-real-export-trend-pass') throw new Error('export payload marker missing');
  `;
  await runModuleSmokeScript(projectRoot, script, { label:'reader manual diagnostics browser export import smoke', timeoutMs:8000 });
  return { pass: READER_MANUAL_DIAGNOSTICS_STORAGE_SMOKE_PASS, browserExportImportSmokePass: READER_MANUAL_DIAGNOSTICS_BROWSER_EXPORT_IMPORT_SMOKE_PASS, sourceSummary };
}

module.exports = { READER_MANUAL_DIAGNOSTICS_STORAGE_SMOKE_PASS, READER_MANUAL_DIAGNOSTICS_BROWSER_EXPORT_IMPORT_SMOKE_PASS, runReaderManualDiagnosticsStorageSmoke };
