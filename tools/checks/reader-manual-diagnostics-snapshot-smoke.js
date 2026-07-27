const { readProjectSourceManifest, buildProjectSourceManifestSummary } = require('./source-loader-manifest.js');

const READER_MANUAL_DIAGNOSTICS_SNAPSHOT_SMOKE_PASS = 'v246-reader-manual-diagnostics-snapshot-smoke-pass';
const READER_MANUAL_DIAGNOSTICS_SNAPSHOT_SOURCE_MANIFEST_PASS = 'v254-reader-manual-diagnostics-snapshot-source-manifest-pass';

function runReaderManualDiagnosticsSnapshotSmoke(projectRoot) {
  const sources = readProjectSourceManifest(projectRoot, {
    snapshotSource: 'rebuild/features/reader/manual-diagnostics-snapshot.mjs',
    diagnosticsSource: 'rebuild/features/reader/virtual-layout-diagnostics.mjs',
    labelSource: 'rebuild/features/reader/virtual-layout-report-labels.mjs'
  });
  const sourceSummary = buildProjectSourceManifestSummary(sources);
  ['v245-reader-manual-diagnostics-snapshot-pass', 'v246-reader-manual-diagnostics-history-pass', 'buildReaderManualDiagnosticsSnapshot', 'appendReaderManualDiagnosticsSnapshot', 'pcDragSmooth', 'mobileScrollSmooth'].forEach(marker => {
    if (!sources.snapshotSource.includes(marker)) throw new Error('manual diagnostics snapshot marker missing: ' + marker);
  });
  ['manualDiagnosticsSnapshot', 'buildReaderManualDiagnosticsSnapshot'].forEach(marker => {
    if (!sources.diagnosticsSource.includes(marker)) throw new Error('virtual diagnostics manual snapshot bridge missing: ' + marker);
  });
  ['manualDiagnosticsLabel', 'manualDiagnosticsHistoryCount'].forEach(marker => {
    if (!sources.labelSource.includes(marker)) throw new Error('virtual report manual diagnostics UI marker missing: ' + marker);
  });
  return {
    pass: READER_MANUAL_DIAGNOSTICS_SNAPSHOT_SMOKE_PASS,
    sourceManifestPass: READER_MANUAL_DIAGNOSTICS_SNAPSHOT_SOURCE_MANIFEST_PASS,
    projectSourceManifestPass: sourceSummary.pass,
    files: sourceSummary.files
  };
}

module.exports = { READER_MANUAL_DIAGNOSTICS_SNAPSHOT_SMOKE_PASS, READER_MANUAL_DIAGNOSTICS_SNAPSHOT_SOURCE_MANIFEST_PASS, runReaderManualDiagnosticsSnapshotSmoke };
