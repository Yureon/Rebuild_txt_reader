const { requireMarker, requireNoFunctionOwner } = require('./read-data-guard-utils.js');

const FRONTEND_CHECK_READ_DATA_IMPORT_BOUNDARY_GUARDS_PASS = 'v195-read-data-import-boundary-guards-pass';

function runReadDataImportBoundaryGuardChecks(ctx) {
  const {
    readDataImportSource,
    readDataImportConstantsSource,
    readDataImportMergeSource,
    readDataImportProgressMergeSource,
    readDataImportArrayMergeSource,
    readDataImportDetailBuildersSource,
    readDataImportDiffExportSource,
    readDataRollbackSource,
    readDataImportCombinedSource,
    stateSource
  } = ctx;

  ['READ_DATA_IMPORT_TYPES','READ_DATA_IMPORT_POLICIES','READ_DATA_IMPORT_FILTER_STATUSES','READ_DATA_ROLLBACK_HISTORY_LIMIT'].forEach((marker) => {
    requireMarker(readDataImportConstantsSource, marker, 'read-data import constants');
  });

  [
    'read-data-import-detail-builders.mjs',
    'read-data-import-progress-merge.mjs',
    'read-data-import-array-merge.mjs',
    'READ_DATA_IMPORT_MERGE_AGGREGATOR_SPLIT_PASS'
  ].forEach((marker) => requireMarker(readDataImportMergeSource, marker, 'read-data merge aggregator'));

  ['applyProgressImport','mergeProgressNewer','progressSnapshotMap','setProgressSnapshot','normalizeProgressMerge','READ_DATA_IMPORT_PROGRESS_MERGE_SPLIT_PASS'].forEach((marker) => {
    requireMarker(readDataImportProgressMergeSource, marker, 'read-data progress merge helper');
  });
  ['applyArrayImport','applyFavoriteImport','mergeByKeyPreferNewer','mergeByKey','arrayToKeyMap','resolveImportChoice','READ_DATA_IMPORT_ARRAY_MERGE_SPLIT_PASS'].forEach((marker) => {
    requireMarker(readDataImportArrayMergeSource, marker, 'read-data array/favorite merge helper');
  });
  ['normalizeReadDataPayload','createReadDataSnapshot','buildProgressImportDetail','buildArrayImportDetail','buildFavoriteImportDetail','detailToSummary','READ_DATA_IMPORT_DETAIL_BUILDERS_SPLIT_PASS'].forEach((marker) => {
    requireMarker(readDataImportDetailBuildersSource, marker, 'read-data detail/snapshot builder');
  });

  [
    'normalizeReadDataPayload',
    'createReadDataSnapshot',
    'applyProgressImport',
    'applyArrayImport',
    'applyFavoriteImport',
    'resolveImportChoice'
  ].forEach((marker) => requireMarker(readDataImportCombinedSource, marker, 'read-data merge/apply compatibility surface'));

  ['applyProgressImport','applyArrayImport','applyFavoriteImport','normalizeReadDataPayload','buildProgressImportDetail','buildArrayImportDetail','buildFavoriteImportDetail','mergeProgressNewer','mergeByKey'].forEach((name) => {
    requireNoFunctionOwner(readDataImportMergeSource, name, 'read-data-import-merge.mjs aggregator');
  });
  ['renderImportPreviewResultRow','loadReadDataRollbackHistory','applyArrayImport','exportReadDataImportDiff'].forEach((name) => {
    requireNoFunctionOwner(readDataImportSource, name, 'read-data-import.mjs aggregator');
  });

  ['exportReadDataImportDiff','txt-reader-read-data-import-diff-v1','renderReadDataImportCompactSummary','countImportOverrides'].forEach((marker) => {
    requireMarker(readDataImportDiffExportSource, marker, 'read-data diff/export helper');
  });
  ['loadReadDataRollbackSnapshot','saveReadDataRollbackSnapshot','restoreReadDataRollback','txt-reader-read-data-rollback-v1'].forEach((marker) => {
    requireMarker(readDataRollbackSource, marker, 'read-data rollback history');
  });
  ['buildReadDataImportPreview','applyReadDataImportPreview','setReadDataImportRenderCallback','setReadDataPreviewActions({ applyPreview: applyReadDataImportPreview })'].forEach((marker) => {
    requireMarker(readDataImportSource, marker, 'read-data-import.mjs aggregator');
  });
  ['buildReadDataImportPreview','applyReadDataImportPreview','READ_DATA_IMPORT_POLICIES','openReadDataImportDetail','resolveImportChoice'].forEach((marker) => {
    requireMarker(readDataImportCombinedSource, marker, 'combined read-data import surface');
  });
  ['readDataImportSplitPass','readDataImportMergeSplitPass'].forEach((marker) => {
    requireMarker(stateSource, marker, 'read-data import app-state marker');
  });
}

module.exports = {
  FRONTEND_CHECK_READ_DATA_IMPORT_BOUNDARY_GUARDS_PASS,
  runReadDataImportBoundaryGuardChecks
};
