const { readProjectSourceManifest, buildProjectSourceManifestSummary } = require('./source-loader-manifest.js');

const SETTINGS_MANUAL_DIAGNOSTICS_CONTROLS_SMOKE_PASS = 'v251-settings-manual-diagnostics-controls-smoke-pass';
const SETTINGS_MANUAL_DIAGNOSTICS_PROJECT_SOURCE_PASS = 'v253-settings-manual-diagnostics-project-source-pass';

function runSettingsManualDiagnosticsControlsSmoke(projectRoot) {
  const sources = readProjectSourceManifest(projectRoot, {
    source: 'rebuild/features/settings/manual-diagnostics-controls.mjs',
    shell: 'public/fragments/deferred-ui.html',
    orchestration: 'rebuild/features/recovery/orchestration.mjs',
    elements: 'rebuild/features/ui/elements.mjs'
  });
  const sourceSummary = buildProjectSourceManifestSummary(sources);
  ['v251-settings-manual-diagnostics-controls-pass', 'v251-settings-manual-diagnostics-clear-pass', 'bindReaderManualDiagnosticsSettingsControls','readerManualDiagnosticsNotes','readerManualDiagnosticsMobileSmooth','readerManualDiagnosticsPcSmooth','readerManualDiagnosticsClearBtn','readReaderManualDiagnosticsInlineForm','SETTINGS_MANUAL_DIAGNOSTICS_INLINE_FORM_PASS', 'renderReaderManualDiagnosticsSettingsStatus','readerManualDiagnosticsLastAt','SETTINGS_MANUAL_DIAGNOSTICS_IMPORT_EXPORT_PASS','readerManualDiagnosticsExportBtn','readerManualDiagnosticsImportBtn','readerManualDiagnosticsImportFile','v253-settings-manual-diagnostics-recovery-summary-pass','v258-settings-manual-diagnostics-browser-export-import-pass','readerManualDiagnosticsImportedCount','v260-reader-manual-diagnostics-recovery-relocation-pass','recovery-center-inline-form'].forEach(marker => {
    if (!sources.source.includes(marker)) throw new Error('settings manual diagnostics control marker missing: ' + marker);
  });
  ['reader-manual-diagnostics-record-btn', 'reader-manual-diagnostics-export-btn', 'reader-manual-diagnostics-import-btn', 'reader-manual-diagnostics-import-file', 'reader-manual-diagnostics-clear-btn', 'reader-manual-diagnostics-status', 'data-reader-manual-diagnostics-pass="v260"', 'data-reader-manual-diagnostics-relocated-from-settings="v260"', 'data-recovery-section="reader-manual-diagnostics"','data-recovery-manual-diagnostics-owner="v273"'].forEach(marker => {
    if (!sources.shell.includes(marker)) throw new Error('reader manual diagnostics recovery shell marker missing: ' + marker);
  });
  const bodyIndex = sources.shell.indexOf('id="recovery-center-body"');
  const manualIndex = sources.shell.indexOf('class="recovery-section recovery-manual-diagnostics-panel"');
  const themeModalIndex = sources.shell.indexOf('id="theme-editor-overlay"');
  if (!(bodyIndex >= 0 && manualIndex > bodyIndex && (themeModalIndex < 0 || manualIndex < themeModalIndex))) {
    throw new Error('manual diagnostics panel must be nested under #recovery-center-body before following modal layers');
  }
  ['manualDiagnosticsPanel', 'readerManualDiagnosticsBodyOwner', "body.innerHTML = ''", 'manualDiagnosticsPanel,'].forEach(marker => {
    if (!sources.orchestration.includes(marker)) throw new Error('manual diagnostics body-preserve runtime marker missing: ' + marker);
  });
  if (!sources.elements.includes('reader-manual-diagnostics-record-btn') || !sources.elements.includes('reader-manual-diagnostics-export-btn') || !sources.elements.includes('reader-manual-diagnostics-import-file') || !sources.elements.includes('reader-manual-diagnostics-clear-btn')) throw new Error('settings manual diagnostics element id not collected');
  if (sources.shell.includes('data-reader-manual-diagnostics-pass="v251"')) throw new Error('manual diagnostics should no longer live in the Settings general tab v251 block');
  return { pass: SETTINGS_MANUAL_DIAGNOSTICS_CONTROLS_SMOKE_PASS, projectSourcePass: SETTINGS_MANUAL_DIAGNOSTICS_PROJECT_SOURCE_PASS, relocationPass:'v260-reader-manual-diagnostics-recovery-relocation-pass', sourceSummary };
}

module.exports = { SETTINGS_MANUAL_DIAGNOSTICS_CONTROLS_SMOKE_PASS, SETTINGS_MANUAL_DIAGNOSTICS_PROJECT_SOURCE_PASS, runSettingsManualDiagnosticsControlsSmoke };
