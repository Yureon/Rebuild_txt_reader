import { RECOVERY_SEARCH_DIAGNOSTICS_EXTRACTION_PASS } from './search-diagnostics.mjs';
import { RECOVERY_CACHE_DIAGNOSTICS_EXTRACTION_PASS } from './cache-diagnostics.mjs';
import { RECOVERY_EXPORT_UTILS_EXTRACTION_PASS } from './export-utils.mjs';
import { RECOVERY_BUTTON_WIRING_REFACTOR_PASS } from './button-wiring.mjs';
import { RECOVERY_RUNTIME_REFACTOR_PASS } from './runtime.mjs';
import { RECOVERY_SUMMARY_RENDERER_REFACTOR_PASS } from './summary-panel.mjs';
import { RECOVERY_POLICY_CHECKLIST_RENDERER_REFACTOR_PASS } from './policy-checklist-panel.mjs';
import { RECOVERY_IMPORT_ACTIONS_REFACTOR_PASS } from './import-actions.mjs';
import { RECOVERY_NAVIGATION_REFACTOR_PASS } from './navigation.mjs';
import { RECOVERY_ACTION_UI_REFACTOR_PASS } from './action-ui.mjs';
import { RECOVERY_DOM_SMOKE_PANEL_REFACTOR_PASS } from './dom-smoke-panel.mjs';
import { RECOVERY_DIAGNOSTICS_PANEL_REFACTOR_PASS } from './diagnostics-panel.mjs';
import { RECOVERY_CACHE_MANAGEMENT_PANEL_REFACTOR_PASS } from './cache-management-panel.mjs';
import { RECOVERY_SEARCH_PANEL_REFACTOR_PASS } from './search-panel.mjs';
import { RECOVERY_CACHE_ACTIONS_REFACTOR_PASS } from './cache-actions.mjs';
import { RECOVERY_SEARCH_ACTIONS_REFACTOR_PASS } from './search-actions.mjs';
import { RECOVERY_MODAL_LAYER_PASS } from './modal-layer.mjs';
import { RECOVERY_SNAPSHOT_EXPORT_REFACTOR_PASS } from './snapshot-export.mjs';
import { RECOVERY_LOCAL_MAINTENANCE_REFACTOR_PASS } from './local-maintenance-actions.mjs';
import { RECOVERY_CENTER_ORCHESTRATION_PASS } from './orchestration.mjs';
import { SYNC_DEVICE_MANAGEMENT_REFACTOR_PASS } from '../sync/device-management.mjs';
import { SERVER_STATE_HYDRATION_REFACTOR_PASS } from '../sync/server-state-hydration.mjs';
import { PERIODIC_DEVICE_SYNC_REFACTOR_PASS } from '../sync/periodic-device-sync.mjs';
import { REMOTE_RESUME_REFACTOR_PASS } from '../sync/remote-resume.mjs';
import { SYNC_FORMATTERS_REFACTOR_PASS } from '../sync/sync-formatters.mjs';
import { DEVTOOLS_REPORT_CONTROLS_REFACTOR_PASS } from '../devtools/controls.mjs';

export const RECOVERY_SYNC_DEVTOOLS_BRIDGES_PASS = 'v421-recovery-sync-devtools-bridges-light-pass';

export const RECOVERY_SYNC_DEVTOOLS_BRIDGES = Object.freeze({
  recoverySearchDiagnosticsExtractionBridge: RECOVERY_SEARCH_DIAGNOSTICS_EXTRACTION_PASS,
  recoveryCacheDiagnosticsExtractionBridge: RECOVERY_CACHE_DIAGNOSTICS_EXTRACTION_PASS,
  recoveryExportUtilsExtractionBridge: RECOVERY_EXPORT_UTILS_EXTRACTION_PASS,
  recoverySummaryRendererRefactorBridge: RECOVERY_SUMMARY_RENDERER_REFACTOR_PASS,
  recoveryPolicyChecklistRendererRefactorBridge: RECOVERY_POLICY_CHECKLIST_RENDERER_REFACTOR_PASS,
  recoveryImportActionsRefactorBridge: RECOVERY_IMPORT_ACTIONS_REFACTOR_PASS,
  recoveryNavigationRefactorBridge: RECOVERY_NAVIGATION_REFACTOR_PASS,
  recoveryActionUiRefactorBridge: RECOVERY_ACTION_UI_REFACTOR_PASS,
  recoveryDomSmokePanelRefactorBridge: RECOVERY_DOM_SMOKE_PANEL_REFACTOR_PASS,
  recoveryDiagnosticsPanelRefactorBridge: RECOVERY_DIAGNOSTICS_PANEL_REFACTOR_PASS,
  recoveryCacheManagementPanelRefactorBridge: RECOVERY_CACHE_MANAGEMENT_PANEL_REFACTOR_PASS,
  recoverySearchPanelRefactorBridge: RECOVERY_SEARCH_PANEL_REFACTOR_PASS,
  recoveryModalLayerBridge: RECOVERY_MODAL_LAYER_PASS,
  recoveryCacheActionsRefactorBridge: RECOVERY_CACHE_ACTIONS_REFACTOR_PASS,
  recoverySearchActionsRefactorBridge: RECOVERY_SEARCH_ACTIONS_REFACTOR_PASS,
  recoverySnapshotExportRefactorBridge: RECOVERY_SNAPSHOT_EXPORT_REFACTOR_PASS,
  recoveryLocalMaintenanceRefactorBridge: RECOVERY_LOCAL_MAINTENANCE_REFACTOR_PASS,
  recoveryButtonWiringRefactorBridge: RECOVERY_BUTTON_WIRING_REFACTOR_PASS,
  recoveryRuntimeRefactorBridge: RECOVERY_RUNTIME_REFACTOR_PASS,
  recoveryCenterOrchestrationBridge: RECOVERY_CENTER_ORCHESTRATION_PASS,
  syncDeviceManagementRefactorBridge: SYNC_DEVICE_MANAGEMENT_REFACTOR_PASS,
  remoteResumeRefactorBridge: REMOTE_RESUME_REFACTOR_PASS,
  syncFormattersRefactorBridge: SYNC_FORMATTERS_REFACTOR_PASS,
  periodicDeviceSyncRefactorBridge: PERIODIC_DEVICE_SYNC_REFACTOR_PASS,
  devtoolsReportControlsRefactorBridge: DEVTOOLS_REPORT_CONTROLS_REFACTOR_PASS,
  serverStateHydrationRefactorBridge: SERVER_STATE_HYDRATION_REFACTOR_PASS
});

export function getRecoverySyncDevtoolsBridgeMarkers() {
  return { pass: RECOVERY_SYNC_DEVTOOLS_BRIDGES_PASS, ...RECOVERY_SYNC_DEVTOOLS_BRIDGES };
}
