const { requireMarker } = require('./read-data-guard-utils.js');
const { runReadDataImportBoundaryGuardChecks } = require('./read-data-import-boundary-guards.js');
const { runReadDataPreviewGuardChecks } = require('./read-data-preview-guards.js');
const { runSafeAreaControlsSplitGuardChecks } = require('./safe-area-controls-split-guards.js');

const FRONTEND_CHECK_READ_DATA_IMPORT_GUARDS_PASS = 'v195-read-data-import-guards-orchestrator-pass';

function runReadDataImportGuardChecks(ctx) {
  const {
    frontendCheckSourceLoaderSource,
    frontendCheckReadDataImportGuardsSource,
    frontendCheckReadDataImportBoundaryGuardsSource,
    frontendCheckReadDataPreviewGuardsSource,
    frontendCheckSafeAreaControlsSplitGuardsSource,
    frontendCheckReadDataGuardUtilsSource,
    stateSource
  } = ctx;

  [
    'read-data-import-constants.mjs',
    'read-data-import-merge.mjs',
    'read-data-import-progress-merge.mjs',
    'read-data-import-array-merge.mjs',
    'read-data-import-detail-builders.mjs',
    'read-data-import-diff-export.mjs',
    'read-data-preview.mjs',
    'read-data-preview-filter.mjs',
    'read-data-preview-entries.mjs',
    'read-data-preview-bulk-toolbar.mjs',
    'read-data-preview-results.mjs',
    'read-data-preview-detail-modal.mjs',
    'read-data-rollback.mjs',
    'safe-area-constants.mjs',
    'safe-area-profiles.mjs',
    'safe-area-profile-actions.mjs',
    'safe-area-template-factory.mjs',
    'safe-area-context.mjs',
    'safe-area-debug.mjs',
    'safe-area-debug-formatters.mjs',
    'safe-area-slot-layout.mjs'
  ].forEach((marker) => requireMarker(frontendCheckSourceLoaderSource, marker, 'v195 source-loader'));

  ['FRONTEND_CHECK_READ_DATA_GUARD_UTILS_PASS','requireNoFunctionOwner','requireMarker'].forEach((marker) => {
    requireMarker(frontendCheckReadDataGuardUtilsSource, marker, 'read-data guard utils');
  });
  ['FRONTEND_CHECK_READ_DATA_IMPORT_GUARDS_PASS','runReadDataImportGuardChecks','v195-read-data-import-guards-orchestrator-pass'].forEach((marker) => {
    requireMarker(frontendCheckReadDataImportGuardsSource, marker, 'read-data import static guard orchestrator');
  });
  ['FRONTEND_CHECK_READ_DATA_IMPORT_BOUNDARY_GUARDS_PASS','runReadDataImportBoundaryGuardChecks'].forEach((marker) => {
    requireMarker(frontendCheckReadDataImportBoundaryGuardsSource, marker, 'read-data import boundary guard');
  });
  ['FRONTEND_CHECK_READ_DATA_PREVIEW_GUARDS_PASS','runReadDataPreviewGuardChecks'].forEach((marker) => {
    requireMarker(frontendCheckReadDataPreviewGuardsSource, marker, 'read-data preview guard');
  });
  ['FRONTEND_CHECK_SAFE_AREA_CONTROLS_SPLIT_GUARDS_PASS','runSafeAreaControlsSplitGuardChecks'].forEach((marker) => {
    requireMarker(frontendCheckSafeAreaControlsSplitGuardsSource, marker, 'safe-area split guard');
  });

  runReadDataImportBoundaryGuardChecks(ctx);
  runReadDataPreviewGuardChecks(ctx);
  runSafeAreaControlsSplitGuardChecks(ctx);

  ['readDataImportSplitPass','safeAreaControlsSplitPass','readDataImportMergeSplitPass','readDataPreviewSafeProfileSplitPass','readDataPreviewFilterSplitPass','readDataGuardSplitPass','v195-read-data-guard-split-pass'].forEach((marker) => {
    requireMarker(stateSource, marker, 'v195 app-state marker');
  });
}

module.exports = {
  FRONTEND_CHECK_READ_DATA_IMPORT_GUARDS_PASS,
  runReadDataImportGuardChecks
};
