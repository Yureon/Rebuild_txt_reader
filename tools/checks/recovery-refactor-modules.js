const fs = require('fs');
const path = require('path');

function read(root, rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) throw new Error('Missing recovery refactor module: ' + rel);
  return fs.readFileSync(full, 'utf8');
}

function requireMarker(source, marker, label) {
  if (!source.includes(marker)) throw new Error('Missing ' + label + ' marker: ' + marker);
}

function runRecoveryRefactorModuleChecks({ root, devtoolsSource, stateSource }) {
  const cachePanelSource = read(root, path.join('features', 'recovery', 'cache-management-panel.mjs'));
  const searchPanelSource = read(root, path.join('features', 'recovery', 'search-panel.mjs'));
  const libraryDiagnosticsPanelSource = read(root, path.join('features', 'recovery', 'library-diagnostics-panel.mjs'));
  const libraryDiagnosticsVirtualPanelsSource = read(root, path.join('features', 'recovery', 'library-diagnostics-virtual-panels.mjs'));
  const cacheActionsSource = read(root, path.join('features', 'recovery', 'cache-actions.mjs'));
  const searchActionsSource = read(root, path.join('features', 'recovery', 'search-actions.mjs'));
  const modalLayerSource = read(root, path.join('features', 'recovery', 'modal-layer.mjs'));
  const snapshotExportSource = read(root, path.join('features', 'recovery', 'snapshot-export.mjs'));
  const localMaintenanceSource = read(root, path.join('features', 'recovery', 'local-maintenance-actions.mjs'));
  const syncFormattersSource = read(root, path.join('features', 'sync', 'sync-formatters.mjs'));
  const syncDeviceManagementSource = read(root, path.join('features', 'sync', 'device-management.mjs'));
  const remoteResumeSource = read(root, path.join('features', 'sync', 'remote-resume.mjs'));
  const periodicDeviceSyncSource = read(root, path.join('features', 'sync', 'periodic-device-sync.mjs'));
  const serverStateHydrationSource = read(root, path.join('features', 'sync', 'server-state-hydration.mjs'));
  const recoveryImportActionsSource = read(root, path.join('features', 'recovery', 'import-actions.mjs'));
  const recoveryImportWritebackSource = read(root, path.join('features', 'recovery', 'import-writeback.mjs'));
  const devtoolsControlsSource = read(root, path.join('features', 'devtools', 'controls.mjs'));

  [
    'RECOVERY_CACHE_MANAGEMENT_PANEL_REFACTOR_PASS',
    'v172-recovery-cache-management-panel-pass',
    'renderRecoveryCacheManagementPanel',
    'copyRecoveryPrunePlan'
  ].forEach((marker) => requireMarker(cachePanelSource, marker, 'v172 cache-management panel'));

  [
    'RECOVERY_SEARCH_PANEL_REFACTOR_PASS',
    'v172-recovery-search-panel-pass',
    'renderRecoverySearchPanel',
    'copyRecoverySearchDiagnostics'
  ].forEach((marker) => requireMarker(searchPanelSource, marker, 'v172 search panel'));


  [
    'RECOVERY_LIBRARY_DIAGNOSTICS_PANEL_REFACTOR_PASS',
    'v173-recovery-library-diagnostics-panel-pass',
    'renderRecoveryLibraryDiagnosticsPanel',
    'refreshRecovery'
  ].forEach((marker) => requireMarker(libraryDiagnosticsPanelSource, marker, 'v173 library diagnostics panel'));
  ['v245-recovery-library-diagnostics-virtual-panels-pass', 'createLibraryVirtualTrialScenarioPanel'].forEach((marker) => requireMarker(libraryDiagnosticsVirtualPanelsSource, marker, 'v245 library diagnostics virtual panel helper')); 

  [
    './recovery/cache-management-panel.mjs',
    './recovery/search-panel.mjs',
    './recovery/library-diagnostics-panel.mjs',
    './recovery/cache-actions.mjs',
    './recovery/search-actions.mjs',
    './recovery/modal-layer.mjs',
    './recovery/snapshot-export.mjs',
    './recovery/local-maintenance-actions.mjs',
    'RECOVERY_CACHE_MANAGEMENT_PANEL_REFACTOR_BRIDGE',
    'RECOVERY_SEARCH_PANEL_REFACTOR_BRIDGE',
    'RECOVERY_LIBRARY_DIAGNOSTICS_PANEL_REFACTOR_BRIDGE',
    'RECOVERY_CACHE_ACTIONS_REFACTOR_BRIDGE',
    'RECOVERY_SEARCH_ACTIONS_REFACTOR_BRIDGE',
    'RECOVERY_SNAPSHOT_EXPORT_REFACTOR_BRIDGE',
    'RECOVERY_LOCAL_MAINTENANCE_REFACTOR_BRIDGE'
  ].forEach((marker) => requireMarker(devtoolsSource, marker, 'v172-v175 sync-devtools bridge'));

  [
    'recoveryCacheManagementPanelRefactorPass',
    'v172-recovery-cache-management-panel-pass',
    'recoverySearchPanelRefactorPass',
    'v172-recovery-search-panel-pass',
    'recoveryLibraryDiagnosticsPanelRefactorPass',
    'v173-recovery-library-diagnostics-panel-pass',
    'recoveryCacheActionsRefactorPass',
    'v175-recovery-cache-actions-pass',
    'recoverySearchActionsRefactorPass',
    'v175-recovery-search-actions-pass',
    'recoverySnapshotExportRefactorPass',
    'v176-recovery-snapshot-export-pass',
    'recoveryLocalMaintenanceRefactorPass',
    'v176-recovery-local-maintenance-actions-pass'
  ].forEach((marker) => requireMarker(stateSource, marker, 'v172-v176 state marker'));

  if (devtoolsSource.includes('function renderRecoveryCacheManagementPanel(app, info = {})')) {
    throw new Error('sync-devtools.mjs still owns cache-management panel renderer after v172 extraction');
  }
  if (devtoolsSource.includes('function renderRecoverySearchPanel(app, info = {})')) {
    throw new Error('sync-devtools.mjs still owns search panel renderer after v172 extraction');
  }
  if (devtoolsSource.includes('function renderRecoveryLibraryDiagnosticsPanel(app, info = {})')) {
    throw new Error('sync-devtools.mjs still owns library diagnostics panel renderer after v173 extraction');
  }

  [
    'RECOVERY_CACHE_ACTIONS_REFACTOR_PASS',
    'v175-recovery-cache-actions-pass',
    'openRecoveryCachedNovelsModal',
    'runRecoveryCachePrune',
    'deleteRecoveryCacheChunks'
  ].forEach((marker) => requireMarker(cacheActionsSource, marker, 'v175 cache actions'));
  [
    'RECOVERY_SEARCH_ACTIONS_REFACTOR_PASS',
    'v175-recovery-search-actions-pass',
    'openRecoveryCoverageModal'
  ].forEach((marker) => requireMarker(searchActionsSource, marker, 'v175 search actions'));
  [
    'RECOVERY_MODAL_LAYER_PASS',
    'v175-recovery-modal-layer-helper-pass',
    'markRecoverySubModalLayer'
  ].forEach((marker) => requireMarker(modalLayerSource, marker, 'v175 modal layer'));
  if (devtoolsSource.includes('async function openRecoveryCachedNovelsModal(')) {
    throw new Error('sync-devtools.mjs still owns cached novels modal after v175 extraction');
  }
  if (devtoolsSource.includes('function openRecoveryCoverageModal(')) {
    throw new Error('sync-devtools.mjs still owns search coverage modal after v175 extraction');
  }
  if (devtoolsSource.includes('async function deleteRecoveryCacheChunks(')) {
    throw new Error('sync-devtools.mjs still owns cache chunk deletion action after v175 extraction');
  }

  [
    'RECOVERY_SNAPSHOT_EXPORT_REFACTOR_PASS',
    'v176-recovery-snapshot-export-pass',
    'buildRecoverySnapshot',
    'downloadRecoverySnapshot'
  ].forEach((marker) => requireMarker(snapshotExportSource, marker, 'v176 snapshot export'));
  [
    'RECOVERY_LOCAL_MAINTENANCE_REFACTOR_PASS',
    'v176-recovery-local-maintenance-actions-pass',
    'retryRecoverySaves',
    'clearRecoveryLocalUserData'
  ].forEach((marker) => requireMarker(localMaintenanceSource, marker, 'v176 local maintenance actions'));
  if (devtoolsSource.includes('function snapshot(app, options = {})')) {
    throw new Error('sync-devtools.mjs still owns snapshot builder after v176 extraction');
  }
  if (devtoolsSource.includes('async function retryRecoverySaves(app)')) {
    throw new Error('sync-devtools.mjs still owns retry save after v176 extraction');
  }
  if (devtoolsSource.includes('function clearRecoveryLocalUserData(app)')) {
    throw new Error('sync-devtools.mjs still owns local userdata reset after v176 extraction');
  }

  [
    'SYNC_DEVICE_MANAGEMENT_REFACTOR_PASS',
    'v177-sync-device-management-pass',
    'renderSyncDevicePanel',
    'saveSyncPolicy',
    'updateKnownDeviceSeen'
  ].forEach((marker) => requireMarker(syncDeviceManagementSource, marker, 'v177 sync device management'));
  [
    'REMOTE_RESUME_REFACTOR_PASS',
    'v177-remote-resume-pass',
    'installRemoteResumeActions',
    'handleRemoteResumeOffer',
    'resumeRemotePosition'
  ].forEach((marker) => requireMarker(remoteResumeSource, marker, 'v177 remote resume'));
  [
    'SYNC_FORMATTERS_REFACTOR_PASS',
    'v177-sync-formatters-pass',
    'formatDeviceName',
    'formatRelativeTime',
    'shortDeviceId'
  ].forEach((marker) => requireMarker(syncFormattersSource, marker, 'v177 sync formatters'));
  [
    './sync/device-management.mjs',
    './sync/remote-resume.mjs',
    './sync/sync-formatters.mjs',
    'SYNC_DEVICE_MANAGEMENT_REFACTOR_BRIDGE',
    'REMOTE_RESUME_REFACTOR_BRIDGE',
    'SYNC_FORMATTERS_REFACTOR_BRIDGE'
  ].forEach((marker) => requireMarker(devtoolsSource, marker, 'v177 sync bridge'));
  [
    'syncDeviceManagementRefactorPass',
    'v177-sync-device-management-pass',
    'remoteResumeRefactorPass',
    'v177-remote-resume-pass',
    'syncFormattersRefactorPass',
    'v177-sync-formatters-pass'
  ].forEach((marker) => requireMarker(stateSource, marker, 'v177 sync state marker'));
  if (devtoolsSource.includes('function getSyncShare(app)')) {
    throw new Error('sync-devtools.mjs still owns sync share helper after v177 extraction');
  }
  if (devtoolsSource.includes('function renderSyncDevicePanel(app)')) {
    throw new Error('sync-devtools.mjs still owns device panel renderer after v177 extraction');
  }
  if (devtoolsSource.includes('function handleRemoteResumeOffer(app')) {
    throw new Error('sync-devtools.mjs still owns remote resume offer after v177 extraction');
  }
  if (devtoolsSource.includes('async function resumeRemotePosition(app)')) {
    throw new Error('sync-devtools.mjs still owns remote resume navigation after v177 extraction');
  }


  [
    'PERIODIC_DEVICE_SYNC_REFACTOR_PASS',
    'v178-periodic-device-sync-pass',
    'installPeriodicDeviceSync',
    'state.intervalId',
    'state.initialTimer'
  ].forEach((marker) => requireMarker(periodicDeviceSyncSource, marker, 'v178 periodic device sync'));
  [
    'DEVTOOLS_REPORT_CONTROLS_REFACTOR_PASS',
    'v178-devtools-report-controls-pass',
    'setupDevtoolsReportControls',
    'renderDevtools',
    'copyDevtoolsReport',
    'devtoolsReportOptions'
  ].forEach((marker) => requireMarker(devtoolsControlsSource, marker, 'v178 devtools report controls'));
  [
    './sync/periodic-device-sync.mjs',
    './devtools/controls.mjs',
    'PERIODIC_DEVICE_SYNC_REFACTOR_BRIDGE',
    'DEVTOOLS_REPORT_CONTROLS_REFACTOR_BRIDGE'
  ].forEach((marker) => requireMarker(devtoolsSource, marker, 'v178 sync/devtools bridge'));
  [
    'periodicDeviceSyncRefactorPass',
    'v178-periodic-device-sync-pass',
    'devtoolsReportControlsRefactorPass',
    'v178-devtools-report-controls-pass'
  ].forEach((marker) => requireMarker(stateSource, marker, 'v178 state marker'));
  if (devtoolsSource.includes('export function installPeriodicDeviceSync(app)')) {
    throw new Error('sync-devtools.mjs still owns periodic device sync after v178 extraction');
  }
  if (devtoolsSource.includes('function setupDevtoolsReportControls(app, on)')) {
    throw new Error('sync-devtools.mjs still owns devtools report setup after v178 extraction');
  }
  if (devtoolsSource.includes('function renderDevtools(app)')) {
    throw new Error('sync-devtools.mjs still owns devtools renderer after v178 extraction');
  }

  [
    'SERVER_STATE_HYDRATION_REFACTOR_PASS',
    'v179-server-state-hydration-pass',
    'hydrateServerState',
    'refreshSyncState',
    'applyServerStateData',
    'persistHydratedServerState',
    'mergeProgress'
  ].forEach((marker) => requireMarker(serverStateHydrationSource, marker, 'v179 server state hydration'));
  [
    './sync/server-state-hydration.mjs',
    'SERVER_STATE_HYDRATION_REFACTOR_BRIDGE',
    'hydrateServerStateCore',
    'refreshSyncStateCore'
  ].forEach((marker) => requireMarker(devtoolsSource, marker, 'v179 server state hydration bridge'));
  [
    'serverStateHydrationRefactorPass',
    'v179-server-state-hydration-pass'
  ].forEach((marker) => requireMarker(stateSource, marker, 'v179 state marker'));
  if (devtoolsSource.includes('function applyServerStateData(app')) {
    throw new Error('sync-devtools.mjs still owns server state apply helper after v179 extraction');
  }
  if (devtoolsSource.includes('function mergeProgress(local')) {
    throw new Error('sync-devtools.mjs still owns mergeProgress after v179 extraction');
  }
  if (devtoolsSource.includes('async function refreshSyncState(app')) {
    throw new Error('sync-devtools.mjs still owns refreshSyncState async implementation after v179 extraction');
  }

  [
    'RECOVERY_IMPORT_ACTIONS_REFACTOR_PASS',
    'v180-recovery-import-actions-pass',
    'importRecoveryFile',
    'applyRecoveryPayload',
    'persistBookData'
  ].forEach((marker) => requireMarker(recoveryImportActionsSource, marker, 'v180 Recovery import actions'));
  [
    './recovery/import-actions.mjs',
    'RECOVERY_IMPORT_ACTIONS_REFACTOR_BRIDGE',
    'importRecoveryFile(app, ev, { renderSyncDevicePanel'
  ].forEach((marker) => requireMarker(devtoolsSource, marker, 'v180 Recovery import actions bridge'));
  [
    'recoveryImportActionsRefactorPass',
    'v180-recovery-import-actions-pass'
  ].forEach((marker) => requireMarker(stateSource, marker, 'v180 state marker'));
  if (devtoolsSource.includes('function importRecoveryFile(app')) {
    throw new Error('sync-devtools.mjs still owns Recovery import file handler after v180 extraction');
  }
  if (devtoolsSource.includes('async function applyRecoveryPayload(app')) {
    throw new Error('sync-devtools.mjs still owns Recovery import apply helper after v180 extraction');
  }

  [
    'RECOVERY_IMPORT_WRITEBACK_REFACTOR_PASS',
    'v181-recovery-import-writeback-pass',
    'applyImportedSharedState',
    'applyImportedDeviceState',
    'putShared',
    'putDevice'
  ].forEach((marker) => requireMarker(recoveryImportWritebackSource, marker, 'v181 Recovery import writeback'));
  [
    './import-writeback.mjs',
    'RECOVERY_IMPORT_WRITEBACK_REFACTOR_BRIDGE',
    'applyImportedSharedState(app, shared)',
    'applyImportedDeviceState(app, device)'
  ].forEach((marker) => requireMarker(recoveryImportActionsSource, marker, 'v181 Recovery import writeback bridge'));
  [
    'recoveryImportWritebackRefactorPass',
    'v181-recovery-import-writeback-pass'
  ].forEach((marker) => requireMarker(stateSource, marker, 'v181 state marker'));
  if (recoveryImportActionsSource.includes('app.api?.putShared')) {
    throw new Error('import-actions.mjs still owns shared server writeback after v181 extraction');
  }
  if (recoveryImportActionsSource.includes('app.api?.putDevice')) {
    throw new Error('import-actions.mjs still owns device server writeback after v181 extraction');
  }

}

module.exports = { runRecoveryRefactorModuleChecks };
