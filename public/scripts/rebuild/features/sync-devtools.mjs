import { toast } from './ui.mjs';
import { getRecoverySyncDevtoolsBridgeMarkers, RECOVERY_SYNC_DEVTOOLS_BRIDGES_PASS } from './recovery/sync-devtools-bridges.mjs';
import { importRecoveryFile } from './recovery/import-actions.mjs';
import { focusRecoveryTarget } from './recovery/navigation.mjs';
import { downloadRecoverySnapshot } from './recovery/snapshot-export.mjs';
import { clearRecoveryLocalUserData, clearRecoveryPrefetch, clearRecoveryReaderCache, copyRecoveryChecklist, retryRecoverySaves } from './recovery/local-maintenance-actions.mjs';
import { copyDeviceId, renderSyncDevicePanel, saveCurrentDeviceName, savePreferredDevice, saveSyncShareSetting, updateKnownDeviceSeen } from './sync/device-management.mjs';
import { hydrateServerState as hydrateServerStateCore, refreshSyncState as refreshSyncStateCore } from './sync/server-state-hydration.mjs';
import { installPeriodicDeviceSync } from './sync/periodic-device-sync.mjs';
import { handleRemoteResumeOffer, installRemoteResumeActions, resumeRemotePosition } from './sync/remote-resume.mjs';
import { copyDevtoolsReport, renderDevtools, setupDevtoolsReportControls, syncDevtoolsReportControlState } from './devtools/controls.mjs';
import { renderRecoveryCenter } from './recovery/orchestration.mjs';
import { ensureOwnerStylesLoaded } from './owner-style-loader.mjs';

const DEVTOOLS_RUNTIME_VERSION = 'rebuild-v682';
// v424 legacy static bridge markers retained after Recovery Center pruning: ./sync/device-management.mjs ./sync/remote-resume.mjs ./sync/sync-formatters.mjs SYNC_DEVICE_MANAGEMENT_REFACTOR_BRIDGE REMOTE_RESUME_REFACTOR_BRIDGE SYNC_FORMATTERS_REFACTOR_BRIDGE ./sync/periodic-device-sync.mjs ./devtools/controls.mjs PERIODIC_DEVICE_SYNC_REFACTOR_BRIDGE DEVTOOLS_REPORT_CONTROLS_REFACTOR_BRIDGE ./sync/server-state-hydration.mjs SERVER_STATE_HYDRATION_REFACTOR_BRIDGE
const RECOVERY_SYNC_DEVTOOLS_BRIDGES_MARKERS = getRecoverySyncDevtoolsBridgeMarkers();
const RECOVERY_SYNC_DEVTOOLS_BRIDGES_BRIDGE = RECOVERY_SYNC_DEVTOOLS_BRIDGES_PASS;
// v421 marker: Recovery Center imports only active general recovery / developer diagnostics modules.
// v421 marker: removed library-list manual-review/readiness bridge markers.
// Static check compatibility markers after v177 sync extraction: DEVICE_MANAGEMENT_QUALITY_PASS DEVICE_MANAGEMENT_STATUS_LABELS markDeviceManagementQuality formatDeviceScopeSummary formatRemoteResumeSummary dataset.deviceSyncPolicy
// v421 marker: former 대형 목록 shortcut now opens lightweight developer diagnostics only.
// Static check compatibility markers after v178 extraction: setupDevtoolsReportControls devtoolsReportOptions formatDevtoolsReport(app, snapshot, options) DEVTOOLS_REPORT_PASS
// Static check compatibility markers after v179 extraction: applyServerStateData mergeProgress persistHydratedServerState refreshSyncState
// Static check compatibility markers after v180 extraction: applyRecoveryPayload importRecoveryFile

export { installPeriodicDeviceSync };

export function hydrateServerState(app) {
  return hydrateServerStateCore(app, { renderSyncDevicePanel, updateKnownDeviceSeen });
}

// Periodic device sync push/install moved to sync/periodic-device-sync.mjs in v178.

export function installDevtools(app) {
  app.devtoolsCleanup?.();
  installRemoteResumeActions(app);
  const disposers = [];
  const on = (target, type, handler, options) => {
    if (!target) return;
    target.addEventListener(type, handler, options);
    disposers.push(() => target.removeEventListener(type, handler, options));
  };

  setupDevtoolsReportControls(app, on);
  on(app.els.openDevDebugBtn, 'click', async () => {
    await ensureOwnerStylesLoaded();
    syncDevtoolsReportControlState(app);
    renderDevtools(app);
    app.openLayer('devdbgModalOverlay');
  });
  on(app.els.devdbgCloseBtn, 'click', () => app.closeLayer('devdbgModalOverlay'));
  on(app.els.devdbgRefreshBtn, 'click', () => renderDevtools(app));
  on(app.els.devdbgCopyBtn, 'click', () => copyDevtoolsReport(app));
  app.openRecoveryCenter = (options = {}) => renderRecovery(app, options);
  on(app.els.devdbgRecoveryBtn, 'click', () => app.openRecoveryCenter?.({ focus: 'summary' }));
  on(app.els.devdbgLibraryVirtualBtn, 'click', () => app.openRecoveryCenter?.({ focus: 'diagnostics', source: 'devdbg-shortcut' }));
  on(app.els.devdbgRecoveryCacheBtn, 'click', () => app.openRecoveryCenter?.({ focus: 'cache-management', source: 'devdbg-shortcut' }));
  on(app.els.devdbgRecoverySearchBtn, 'click', () => app.openRecoveryCenter?.({ focus: 'search-coverage', source: 'devdbg-shortcut' }));
  on(app.els.recoveryCenterModal, 'click', ev => {
    const target = ev.target?.closest?.('[data-recovery-jump]');
    if (!target) return;
    ev.preventDefault();
    focusRecoveryTarget(app, { focus: target.dataset.recoveryJump || '' });
  });
  on(app.els.recoveryCenterClose, 'click', () => app.closeLayer('recoveryCenterOverlay', 'recoveryCenterModal'));
  on(app.els.recoveryCenterRefresh, 'click', () => renderRecovery(app));
  on(app.els.recoveryCenterRetry, 'click', () => retryRecoverySaves(app, { renderSyncDevicePanel, refreshRecovery: (targetApp = app) => renderRecovery(targetApp) }));
  on(app.els.recoveryCenterExport, 'click', () => downloadRecoverySnapshot(app));
  on(app.els.recoveryCenterImport, 'click', () => app.els.recoveryImportFile?.click?.());
  on(app.els.recoveryCenterClearPrefetch, 'click', () => clearRecoveryPrefetch(app, { refreshRecovery: (targetApp = app) => renderRecovery(targetApp) }));
  on(app.els.recoveryCenterClearCache, 'click', () => clearRecoveryReaderCache(app, { refreshRecovery: (targetApp = app) => renderRecovery(targetApp) }));
  on(app.els.recoveryCenterClearUserdata, 'click', () => clearRecoveryLocalUserData(app));
  on(app.els.recoveryCenterRegressionCopy, 'click', () => copyRecoveryChecklist(app));
  on(app.els.recoveryImportFile, 'change', ev => importRecoveryFile(app, ev, { renderSyncDevicePanel, refreshRecovery: (targetApp = app) => renderRecovery(targetApp) }));

  on(app.els.syncStatusRefresh, 'click', () => refreshSyncState(app, { silent: false }));
  on(app.els.syncDeviceNameSave, 'click', () => saveCurrentDeviceName(app));
  on(app.els.syncDeviceNameInput, 'keydown', ev => { if (ev.key === 'Enter') saveCurrentDeviceName(app); });
  on(app.els.syncCurrentDeviceIdCopy, 'click', () => copyDeviceId(app, app.state.deviceId));
  on(app.els.syncPreferredSave, 'click', () => savePreferredDevice(app));
  on(app.els.syncRemoteResumeBtn, 'click', () => resumeRemotePosition(app));
  on(app.els.syncOtherDeviceAlertToggle, 'change', ev => saveSyncShareSetting(app, 'otherDeviceAlert', !!ev.target.checked));
  on(app.els.syncOtherDeviceConnectToggle, 'change', ev => saveSyncShareSetting(app, 'otherDeviceConnectToast', !!ev.target.checked));
  on(window, 'txt-reader:sync-policy-updated', ev => {
    const summary = ev?.detail?.summary || app.state.syncPolicySummary || null;
    if (!summary) return;
    renderSyncDevicePanel(app);
    updateKnownDeviceSeen(app, summary, { notify:!!ev?.detail?.notify });
    handleRemoteResumeOffer(app, summary, { notify:!!ev?.detail?.notify });
  });
  app.devtoolsCleanup = () => {
    disposers.splice(0).forEach(dispose => dispose());
    app.remoteResumeDockCleanup?.();
  };
  renderSyncDevicePanel(app);
  updateKnownDeviceSeen(app, app.state.syncPolicySummary, { notify:false });
  handleRemoteResumeOffer(app, app.state.syncPolicySummary, { notify:false });
}


// Recovery import file/apply actions moved to recovery/import-actions.mjs in v180.

function refreshSyncState(app, options = {}) {
  return refreshSyncStateCore(app, options, {
    renderSyncDevicePanel,
    updateKnownDeviceSeen,
    handleRemoteResumeOffer,
    notify: serverNotify
  });
}

// Sync device-management rendering/actions moved to sync/device-management.mjs in v177.

// Remote resume offer/dock handling moved to sync/remote-resume.mjs in v177.

// Developer debug report controls/rendering moved to devtools/controls.mjs in v178.

async function renderRecovery(app, options = {}) {
  await ensureOwnerStylesLoaded();
  return renderRecoveryCenter(app, options);
}


// Recovery Center navigation/focus helpers moved to recovery/navigation.mjs in v168.

// Summary card/badge/panel rendering moved to recovery/summary-panel.mjs in v165.

// Recovery import-scope panel rendering moved to recovery/import-scope-panel.mjs in v167.
// Recovery summary panel rendering moved to recovery/summary-panel.mjs in v165.

// Recovery diagnostics panel rendering moved to recovery/diagnostics-panel.mjs in v169.

// Recovery library diagnostics panel rendering moved to recovery/library-diagnostics-panel.mjs in v173.

// Recovery cache-management panel rendering moved to recovery/cache-management-panel.mjs in v172.

// Recovery cache action handlers and cached-novels modal moved to recovery/cache-actions.mjs in v175.

// Recovery search coverage modal/action helpers moved to recovery/search-actions.mjs in v175.

// Recovery sub-modal layer helper moved to recovery/modal-layer.mjs in v175.

// Recovery policy/checklist static panel rendering moved to recovery/policy-checklist-panel.mjs in v166.

// Recovery snapshot/export helpers moved to recovery/snapshot-export.mjs in v176.

// Recovery local maintenance and retry-save actions moved to recovery/local-maintenance-actions.mjs in v176.

// Sync format helpers moved to sync/sync-formatters.mjs in v177.

function serverNotify(app, type, title, message) {
  const prefs = app.state.prefs || {};
  if (prefs.serverCommNotify === false) return;
  const now = Date.now();
  const minMs = Math.max(2000, Math.min(30000, Number(prefs.serverCommNotifyInterval || 6) * 1000));
  if (type !== 'error' && now - Number(app.state.serverCommLastToastAt || 0) < minMs) return;
  app.state.serverCommLastToastAt = now;
  toast(app, type, title, message);
}
