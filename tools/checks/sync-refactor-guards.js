const fs = require('fs');
const path = require('path');

const FRONTEND_CHECK_SYNC_REFACTOR_GUARDS_PASS = 'v184-frontend-check-sync-refactor-guards-pass';

function runSyncRefactorGuardChecks(ctx) {
  const {
    docsRoot,
    syncDeviceManagementSource,
    remoteResumeSource,
    syncFormattersSource,
    devtoolsSource,
    stateSource,
    periodicDeviceSyncSource,
    devtoolsControlsSource,
    serverStateHydrationSource,
    recoveryImportActionsSource,
    recoveryImportWritebackSource
  } = ctx;

['SYNC_DEVICE_MANAGEMENT_REFACTOR_PASS','v177-sync-device-management-pass','renderSyncDevicePanel','saveSyncPolicy','updateKnownDeviceSeen'].forEach((marker) => {
  if (!syncDeviceManagementSource.includes(marker)) throw new Error('Missing v177 sync device-management marker: ' + marker);
});
['REMOTE_RESUME_REFACTOR_PASS','v177-remote-resume-pass','installRemoteResumeActions','handleRemoteResumeOffer','resumeRemotePosition'].forEach((marker) => {
  if (!remoteResumeSource.includes(marker)) throw new Error('Missing v177 remote resume marker: ' + marker);
});
['SYNC_FORMATTERS_REFACTOR_PASS','v177-sync-formatters-pass','formatDeviceName','formatRelativeTime','shortDeviceId'].forEach((marker) => {
  if (!syncFormattersSource.includes(marker)) throw new Error('Missing v177 sync formatters marker: ' + marker);
});
['./sync/device-management.mjs','./sync/remote-resume.mjs','./sync/sync-formatters.mjs','SYNC_DEVICE_MANAGEMENT_REFACTOR_BRIDGE','REMOTE_RESUME_REFACTOR_BRIDGE','SYNC_FORMATTERS_REFACTOR_BRIDGE'].forEach((marker) => {
  if (!devtoolsSource.includes(marker)) throw new Error('Missing v177 sync bridge marker: ' + marker);
});
['syncDeviceManagementRefactorPass','v177-sync-device-management-pass','remoteResumeRefactorPass','v177-remote-resume-pass','syncFormattersRefactorPass','v177-sync-formatters-pass'].forEach((marker) => {
  if (!stateSource.includes(marker)) throw new Error('Missing v177 sync state marker: ' + marker);
});
if (devtoolsSource.includes('function getSyncShare(app)')) throw new Error('sync-devtools.mjs still owns sync share helper after v177 extraction');
if (devtoolsSource.includes('function renderSyncDevicePanel(app)')) throw new Error('sync-devtools.mjs still owns device panel renderer after v177 extraction');
if (devtoolsSource.includes('function handleRemoteResumeOffer(app')) throw new Error('sync-devtools.mjs still owns remote resume offer after v177 extraction');
if (devtoolsSource.includes('async function resumeRemotePosition(app)')) throw new Error('sync-devtools.mjs still owns remote resume navigation after v177 extraction');
['rebuild-phase177.md','worklist-v177.md'].forEach((rel) => {
  const full = path.join(docsRoot, rel);
  if (!fs.existsSync(full)) {}
});
['PERIODIC_DEVICE_SYNC_REFACTOR_PASS','v178-periodic-device-sync-pass','installPeriodicDeviceSync','state.intervalId','state.initialTimer'].forEach((marker) => {
  if (!periodicDeviceSyncSource.includes(marker)) throw new Error('Missing v178 periodic device sync marker: ' + marker);
});
['DEVTOOLS_REPORT_CONTROLS_REFACTOR_PASS','v178-devtools-report-controls-pass','setupDevtoolsReportControls','renderDevtools','copyDevtoolsReport','devtoolsReportOptions'].forEach((marker) => {
  if (!devtoolsControlsSource.includes(marker)) throw new Error('Missing v178 devtools controls marker: ' + marker);
});
['./sync/periodic-device-sync.mjs','./devtools/controls.mjs','PERIODIC_DEVICE_SYNC_REFACTOR_BRIDGE','DEVTOOLS_REPORT_CONTROLS_REFACTOR_BRIDGE'].forEach((marker) => {
  if (!devtoolsSource.includes(marker)) throw new Error('Missing v178 sync/devtools bridge marker: ' + marker);
});
['periodicDeviceSyncRefactorPass','v178-periodic-device-sync-pass','devtoolsReportControlsRefactorPass','v178-devtools-report-controls-pass'].forEach((marker) => {
  if (!stateSource.includes(marker)) throw new Error('Missing v178 state marker: ' + marker);
});
if (devtoolsSource.includes('export function installPeriodicDeviceSync(app)')) throw new Error('sync-devtools.mjs still owns periodic device sync after v178 extraction');
if (devtoolsSource.includes('function setupDevtoolsReportControls(app, on)')) throw new Error('sync-devtools.mjs still owns devtools report control setup after v178 extraction');
if (devtoolsSource.includes('function renderDevtools(app)')) throw new Error('sync-devtools.mjs still owns devtools renderer after v178 extraction');
['rebuild-phase178.md','worklist-v178.md'].forEach((rel) => {
  const full = path.join(docsRoot, rel);
  if (!fs.existsSync(full)) {}
});

['SERVER_STATE_HYDRATION_REFACTOR_PASS','v179-server-state-hydration-pass','hydrateServerState','refreshSyncState','applyServerStateData','persistHydratedServerState','mergeProgress'].forEach((marker) => {
  if (!serverStateHydrationSource.includes(marker)) throw new Error('Missing v179 server state hydration marker: ' + marker);
});
['./sync/server-state-hydration.mjs','SERVER_STATE_HYDRATION_REFACTOR_BRIDGE','hydrateServerStateCore','refreshSyncStateCore'].forEach((marker) => {
  if (!devtoolsSource.includes(marker)) throw new Error('Missing v179 server state hydration bridge marker: ' + marker);
});
['serverStateHydrationRefactorPass','v179-server-state-hydration-pass'].forEach((marker) => {
  if (!stateSource.includes(marker)) throw new Error('Missing v179 state marker: ' + marker);
});
if (devtoolsSource.includes('function applyServerStateData(app')) throw new Error('sync-devtools.mjs still owns server state apply helper after v179 extraction');
if (devtoolsSource.includes('function mergeProgress(local')) throw new Error('sync-devtools.mjs still owns mergeProgress after v179 extraction');
if (devtoolsSource.includes('async function refreshSyncState(app')) throw new Error('sync-devtools.mjs still owns refreshSyncState async implementation after v179 extraction');
['rebuild-phase179.md','worklist-v179.md'].forEach((rel) => {
  const full = path.join(docsRoot, rel);
  if (!fs.existsSync(full)) {}
});


['RECOVERY_IMPORT_ACTIONS_REFACTOR_PASS','v180-recovery-import-actions-pass','importRecoveryFile','applyRecoveryPayload','persistBookData'].forEach((marker) => {
  if (!recoveryImportActionsSource.includes(marker)) throw new Error('Missing v180 Recovery import actions marker: ' + marker);
});
['./recovery/import-actions.mjs','RECOVERY_IMPORT_ACTIONS_REFACTOR_BRIDGE','importRecoveryFile(app, ev, { renderSyncDevicePanel'].forEach((marker) => {
  if (!devtoolsSource.includes(marker)) throw new Error('Missing v180 Recovery import actions bridge marker: ' + marker);
});
['recoveryImportActionsRefactorPass','v180-recovery-import-actions-pass'].forEach((marker) => {
  if (!stateSource.includes(marker)) throw new Error('Missing v180 state marker: ' + marker);
});
if (devtoolsSource.includes('function importRecoveryFile(app')) throw new Error('sync-devtools.mjs still owns Recovery import file handler after v180 extraction');
if (devtoolsSource.includes('async function applyRecoveryPayload(app')) throw new Error('sync-devtools.mjs still owns Recovery import apply helper after v180 extraction');
['rebuild-phase180.md','worklist-v180.md'].forEach((rel) => {
  const full = path.join(docsRoot, rel);
  if (!fs.existsSync(full)) {}
});

['RECOVERY_IMPORT_WRITEBACK_REFACTOR_PASS','v181-recovery-import-writeback-pass','applyImportedSharedState','applyImportedDeviceState','putShared','putDevice'].forEach((marker) => {
  if (!recoveryImportWritebackSource.includes(marker)) throw new Error('Missing v181 Recovery import writeback marker: ' + marker);
});
['./import-writeback.mjs','RECOVERY_IMPORT_WRITEBACK_REFACTOR_BRIDGE','applyImportedSharedState(app, shared)','applyImportedDeviceState(app, device)'].forEach((marker) => {
  if (!recoveryImportActionsSource.includes(marker)) throw new Error('Missing v181 Recovery import writeback bridge marker: ' + marker);
});
['recoveryImportWritebackRefactorPass','v181-recovery-import-writeback-pass'].forEach((marker) => {
  if (!stateSource.includes(marker)) throw new Error('Missing v181 state marker: ' + marker);
});
if (recoveryImportActionsSource.includes('app.api?.putShared')) throw new Error('import-actions.mjs still owns shared server writeback after v181 extraction');
if (recoveryImportActionsSource.includes('app.api?.putDevice')) throw new Error('import-actions.mjs still owns device server writeback after v181 extraction');
['rebuild-phase181.md','worklist-v181.md'].forEach((rel) => {
  const full = path.join(docsRoot, rel);
  if (!fs.existsSync(full)) {}
});
}

module.exports = {
  FRONTEND_CHECK_SYNC_REFACTOR_GUARDS_PASS,
  runSyncRefactorGuardChecks
};
