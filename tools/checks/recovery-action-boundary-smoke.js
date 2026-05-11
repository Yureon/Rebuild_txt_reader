const { requireAllMarkers } = require('./check-utils.js');

const RECOVERY_ACTION_BOUNDARY_SMOKE_PASS = 'v212-recovery-action-boundary-smoke-pass';

function requireConfirmNear(source, token, label) {
  const idx = source.indexOf(token);
  if (idx < 0) throw new Error('Missing recovery action token: ' + label + ' / ' + token);
  const window = source.slice(idx, idx + 1400);
  if (!window.includes('window.confirm')) throw new Error('Recovery mutation action must keep confirmation guard: ' + label);
}

function runRecoveryActionBoundarySmoke(sources) {
  if (!sources) throw new Error('runRecoveryActionBoundarySmoke requires sources');
  requireAllMarkers(sources.recoveryButtonWiringSource, [
    'RECOVERY_BUTTON_WIRING_REFACTOR_PASS',
    'createRecoveryJsonCopyButton',
    'exportRecoveryJsonPayload'
  ], 'v212 Recovery copy button wiring boundary');
  requireAllMarkers(sources.recoveryExportUtilsSource, [
    'navigator.clipboard.writeText',
    'stringifyRecoveryJsonPayload',
    'downloadRecoveryJsonFile'
  ], 'v212 Recovery export fallback boundary');

  requireAllMarkers(sources.recoveryImportActionsSource, [
    'importRecoveryFile',
    'applyRecoveryPayload',
    'window.confirm',
    'applyImportedSharedState',
    'applyImportedDeviceState'
  ], 'v212 Recovery import action boundary');

  requireAllMarkers(sources.recoveryImportWritebackSource, [
    'RECOVERY_IMPORT_WRITEBACK_REFACTOR_PASS',
    'applyImportedSharedState',
    'applyImportedDeviceState',
    'putShared',
    'putDevice'
  ], 'v212 Recovery writeback boundary');

  requireAllMarkers(sources.recoveryCacheActionsSource, [
    'RECOVERY_CACHE_ACTIONS_REFACTOR_PASS',
    'runRecoveryCachePrune',
    'deleteRecoveryNovelCache',
    'deleteRecoveryNovelCaches',
    'deleteRecoveryRangeCache',
    'deleteRecoveryCurrentCache',
    'deleteRecoveryCacheChunks'
  ], 'v212 Recovery cache mutation boundary');

  ['runRecoveryCachePrune', 'deleteRecoveryNovelCache', 'deleteRecoveryRangeCache', 'deleteRecoveryCurrentCache'].forEach((token) => {
    requireConfirmNear(sources.recoveryCacheActionsSource, token, token);
  });

  requireAllMarkers(sources.recoverySearchActionsSource, [
    'openRecoveryCoverageModal',
    'prepareOfflineChunks',
    'deleteRecoveryCacheChunks',
    '선택 캐시 삭제'
  ], 'v212 Recovery search action boundary');

  requireAllMarkers(sources.recoveryLocalMaintenanceSource, [
    'retryRecoverySaves',
    'clearRecoveryPrefetch',
    'clearRecoveryReaderCache',
    'clearRecoveryLocalUserData',
    'window.confirm'
  ], 'v212 Recovery local maintenance boundary');
  requireConfirmNear(sources.recoveryLocalMaintenanceSource, 'clearRecoveryReaderCache', 'clearRecoveryReaderCache');

  return { pass: RECOVERY_ACTION_BOUNDARY_SMOKE_PASS };
}

module.exports = {
  RECOVERY_ACTION_BOUNDARY_SMOKE_PASS,
  runRecoveryActionBoundarySmoke
};
