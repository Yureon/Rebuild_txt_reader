const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const RECOVERY_LIBRARY_DIAGNOSTICS_PANEL_SPLIT_V305_SMOKE_PASS = 'v305-recovery-library-diagnostics-panel-split-smoke-pass';

async function runRecoveryLibraryDiagnosticsPanelSplitV305Smoke(projectRoot = path.join(__dirname, '..', '..')) {
  const recoveryDir = path.join(projectRoot, 'public/scripts/rebuild/features/recovery');
  const panelPath = path.join(recoveryDir, 'library-diagnostics-panel.mjs');
  const contextPath = path.join(recoveryDir, 'library-diagnostics-panel-context.mjs');
  const copyButtonsPath = path.join(recoveryDir, 'library-diagnostics-panel-copy-buttons.mjs');
  const panel = fs.readFileSync(panelPath, 'utf8');
  const context = fs.readFileSync(contextPath, 'utf8');
  const copyButtons = fs.readFileSync(copyButtonsPath, 'utf8');

  const requiredMarkers = [
    [context, 'v305-recovery-library-diagnostics-panel-context-pass'],
    [copyButtons, 'v305-recovery-library-diagnostics-panel-copy-buttons-pass']
  ];
  for (const [source, marker] of requiredMarkers) {
    if (!source.includes(marker)) throw new Error('v305 recovery diagnostics panel split marker missing: ' + marker);
  }
  if (!panel.includes("from './library-diagnostics-panel-context.mjs'")) throw new Error('panel missing v305 diagnostics context import');
  if (!panel.includes("from './library-diagnostics-panel-copy-buttons.mjs'") && !panel.includes('v421-recovery-library-diagnostics-lightweight-pass')) throw new Error('panel missing v305 copy button set import or v420 lightweight replacement marker');

  const forbiddenPanelOwnership = [
    'resolveRecoveryLibraryPanelDiagnostics(app, info)',
    'createRecoveryJsonCopyButtonsFromSpecs(app',
    'createLibraryVirtualManualReviewCopyButtons(app',
    'buildLibraryVirtualManualReviewBundlePayload(app',
    'buildLibraryVirtualFallbackSamplePayload(app',
    'createLibraryDiagnosticsSnapshotCopyButton(app'
  ];
  for (const marker of forbiddenPanelOwnership) {
    if (panel.includes(marker)) throw new Error('panel still owns v305 split implementation marker: ' + marker);
  }
  const lineCount = panel.split(/\r?\n/).length;
  if (lineCount > 190) throw new Error('library-diagnostics-panel.mjs v305 split line count regression: ' + lineCount);

  const contextModule = await import(pathToFileURL(contextPath).href);
  await import(pathToFileURL(copyButtonsPath).href);
  if (typeof contextModule.resolveRecoveryLibraryDiagnosticsPanelContext !== 'function') throw new Error('context helper export missing');
  const app = { library: {
    getWindowDiagnostics: () => ({ window: { first: 1 }, actual: { rowHeightMeasurement: { measured: true } } }),
    getPrototypeDiagnostics: () => ({ comparison: { sample: [] } }),
    getRenderDiagnostics: () => ({ active: true, actionAudit: { summary: { ok: 1 } }, sessionOptIn: { active: true }, safeTrial: { active: false } }),
    getActionAuditDiagnostics: () => ({ summary: { ok: 2 } }),
    getFallbackDiagnostics: () => ({ fallingBack: false }),
    getRowHeightDiagnostics: () => ({ measured: true }),
    getVirtualSessionOptInDiagnostics: () => ({ active: true }),
    getVirtualTrialDiagnostics: () => ({ active: false }),
    getCurrentWindowRows: () => [{ id: 'row-1' }]
  } };
  const resolved = contextModule.resolveRecoveryLibraryDiagnosticsPanelContext(app, { libraryDiagnostics: { visibleRows: 1 }, libraryPrototypeDiagnostics: { marker: true } });
  if (resolved.pass !== 'v305-recovery-library-diagnostics-panel-context-pass') throw new Error('context helper pass mismatch');
  if (!resolved.sessionOptInActive) throw new Error('context helper session opt-in active not propagated');
  if (resolved.trialActive) throw new Error('context helper trial active should be false for fixture');
  if (!resolved.proto?.marker) throw new Error('context helper prototype diagnostics not propagated');
  return { pass: RECOVERY_LIBRARY_DIAGNOSTICS_PANEL_SPLIT_V305_SMOKE_PASS, lineCount };
}

module.exports = { RECOVERY_LIBRARY_DIAGNOSTICS_PANEL_SPLIT_V305_SMOKE_PASS, runRecoveryLibraryDiagnosticsPanelSplitV305Smoke };
if (require.main === module) {
  runRecoveryLibraryDiagnosticsPanelSplitV305Smoke().catch(error => { console.error(error && error.stack || error); process.exit(1); });
}
