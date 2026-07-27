const { readProjectSourceManifest } = require('./source-loader-manifest.js');

const RECOVERY_READER_FAILURE_ACTIONS_SMOKE_PASS = 'v251-recovery-reader-failure-actions-smoke-pass';

function runRecoveryReaderFailureActionsSmoke(projectRoot) {
  const { actions, panel, payload, layout } = readProjectSourceManifest(projectRoot, {
    actions: { root:'rebuild', path:'features/recovery/reader-failure-diagnostics-actions.mjs' },
    panel: { root:'rebuild', path:'features/recovery/reader-failure-diagnostics-panel.mjs' },
    payload: { root:'rebuild', path:'features/recovery/reader-failure-diagnostics-payload.mjs' },
    layout: { root:'rebuild', path:'features/recovery/action-button-layout.mjs' }
  });
  ['v251-recovery-reader-failure-diagnostics-actions-pass','createReaderFailureDiagnosticsCopyButton','createReaderFailureDiagnosticsDownloadButton','buildReaderFailureDiagnosticsPayload','createRecoveryCopyDownloadActionRow'].forEach(marker => {
    if (!actions.includes(marker)) throw new Error('reader failure actions missing marker: ' + marker);
  });
  ['v251-recovery-reader-failure-diagnostics-payload-pass','buildReaderFailureDiagnosticsSummary','buildReaderFailureDiagnosticsPayload','buildReaderFailureTrendSummary'].forEach(marker => {
    if (!payload.includes(marker)) throw new Error('reader failure payload missing marker: ' + marker);
  });
  ['v251-recovery-action-button-layout-pass','v251-recovery-action-button-low-level-layout-pass','v252-recovery-action-button-copy-download-row-pass','summarizeRecoveryActionButtonLayout','createRecoveryLowLevelActionRow'].forEach(marker => {
    if (!layout.includes(marker)) throw new Error('reader failure action layout missing marker: ' + marker);
  });
  if (!panel.includes('createReaderFailureDiagnosticsActionRow') || !panel.includes('createReaderFailureTrendSummaryCard')) throw new Error('reader failure panel must render action row and trend summary');
  return { pass: RECOVERY_READER_FAILURE_ACTIONS_SMOKE_PASS };
}

module.exports = { RECOVERY_READER_FAILURE_ACTIONS_SMOKE_PASS, runRecoveryReaderFailureActionsSmoke };
