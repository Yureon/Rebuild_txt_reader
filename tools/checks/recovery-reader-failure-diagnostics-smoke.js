const { readProjectSourceManifest, buildProjectSourceManifestSummary } = require('./source-loader-manifest.js');

const RECOVERY_READER_FAILURE_DIAGNOSTICS_SMOKE_PASS = 'v251-recovery-reader-failure-diagnostics-smoke-pass';
const RECOVERY_READER_FAILURE_DIAGNOSTICS_PROJECT_SOURCE_PASS = 'v253-recovery-reader-failure-diagnostics-project-source-pass';

function runRecoveryReaderFailureDiagnosticsSmoke(projectRoot) {
  const sources = readProjectSourceManifest(projectRoot, {
    source: 'rebuild/features/recovery/reader-failure-diagnostics-panel.mjs',
    panelSource: 'rebuild/features/recovery/library-diagnostics-panel.mjs',
    sectionSource: 'rebuild/features/recovery/library-diagnostics-section-groups.mjs',
    summaryCardSource: 'rebuild/features/recovery/reader-failure-summary-card.mjs'
  });
  const sourceSummary = buildProjectSourceManifestSummary(sources);
  ['v251-recovery-reader-failure-diagnostics-panel-pass', 'buildReaderFailureDiagnosticsSummary', 'createReaderFailureDiagnosticsPanel', 'manualDiagnosticsSummary'].forEach(marker => {
    if (!sources.source.includes(marker)) throw new Error('reader failure diagnostics panel marker missing: ' + marker);
  });
  if (!sources.panelSource.includes('createReaderFailureDiagnosticsPanel')) throw new Error('reader failure diagnostics panel not wired into recovery diagnostics');
  if (!sources.sectionSource.includes('Reader failure diagnostics')) throw new Error('reader failure diagnostics section missing');
  ['v253-recovery-reader-failure-manual-summary-card-pass', 'v254-recovery-reader-failure-manual-detail-rows-pass'].forEach(marker => {
    if (!sources.summaryCardSource.includes(marker)) throw new Error('reader failure manual summary card marker missing: ' + marker);
  });
  return { pass: RECOVERY_READER_FAILURE_DIAGNOSTICS_SMOKE_PASS, projectSourcePass: RECOVERY_READER_FAILURE_DIAGNOSTICS_PROJECT_SOURCE_PASS, sourceSummary };
}

module.exports = { RECOVERY_READER_FAILURE_DIAGNOSTICS_SMOKE_PASS, RECOVERY_READER_FAILURE_DIAGNOSTICS_PROJECT_SOURCE_PASS, runRecoveryReaderFailureDiagnosticsSmoke };
