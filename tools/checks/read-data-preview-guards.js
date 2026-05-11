const { requireMarker, requireNoFunctionOwner } = require('./read-data-guard-utils.js');

const FRONTEND_CHECK_READ_DATA_PREVIEW_GUARDS_PASS = 'v195-read-data-preview-guards-pass';

function runReadDataPreviewGuardChecks(ctx) {
  const {
    readDataPreviewSource,
    readDataPreviewFilterSource,
    readDataPreviewEntriesSource,
    readDataPreviewBulkToolbarSource,
    readDataPreviewResultsSource,
    readDataPreviewDetailModalSource,
    stateSource
  } = ctx;

  ['renderReadDataImportPreview','setReadDataPreviewActions','READ_DATA_PREVIEW_ORCHESTRATOR_SPLIT_PASS','collectImportPreviewEntries','openReadDataImportDetailModal'].forEach((marker) => {
    requireMarker(readDataPreviewSource, marker, 'read-data preview orchestrator');
  });
  ['renderReadDataImportFilterPanel','createImportFilterSelect','renderImportPreviewPager','READ_DATA_PREVIEW_FILTER_SPLIT_PASS','READ_DATA_PREVIEW_FILTER_RENDERER_SPLIT_PASS'].forEach((marker) => {
    requireMarker(readDataPreviewFilterSource, marker, 'read-data preview filter/pager renderer');
  });
  ['collectImportPreviewEntries','normalizeImportPreviewEntry','importEntryMatchesFilter','normalizeReadDataImportFilter','importEntrySearchText','READ_DATA_PREVIEW_ENTRIES_SPLIT_PASS'].forEach((marker) => {
    requireMarker(readDataPreviewEntriesSource, marker, 'read-data preview entry collector');
  });
  ['renderImportPreviewBulkToolbar','setFilteredImportOverrides','clearFilteredImportOverrides','preview.overrides[entry.typeId][entry.key]','exportReadDataImportDiff(app, preview, \'filtered\', matched, filter)','READ_DATA_PREVIEW_BULK_TOOLBAR_SPLIT_PASS'].forEach((marker) => {
    requireMarker(readDataPreviewBulkToolbarSource, marker, 'read-data preview bulk toolbar');
  });
  ['renderImportPreviewResultRow','createImportOverrideSelect','buildImportEntryFacts','importEntryNote','READ_DATA_PREVIEW_RESULTS_SPLIT_PASS'].forEach((marker) => {
    requireMarker(readDataPreviewResultsSource, marker, 'read-data preview result renderer');
  });
  ['openReadDataImportDetailModal','renderConflictDetailList','renderImportDetailEntryRow','rdm-detail-overlay','READ_DATA_PREVIEW_DETAIL_MODAL_SPLIT_PASS'].forEach((marker) => {
    requireMarker(readDataPreviewDetailModalSource, marker, 'read-data preview detail modal');
  });

  ['renderReadDataImportFilterPanel','renderImportPreviewResultRow','openReadDataImportDetailModal'].forEach((name) => {
    requireNoFunctionOwner(readDataPreviewSource, name, 'read-data-preview.mjs orchestrator');
  });
  ['renderImportPreviewBulkToolbar','collectImportPreviewEntries','normalizeReadDataImportFilter','setFilteredImportOverrides','clearFilteredImportOverrides'].forEach((name) => {
    requireNoFunctionOwner(readDataPreviewFilterSource, name, 'read-data-preview-filter.mjs renderer');
  });
  ['preview.overrides[typeId][entry.key]','createImportOverrideSelect(preview, entry.typeId, entry'].forEach((marker) => {
    requireMarker(readDataPreviewResultsSource, marker, 'read-data row override storage shape');
  });
  ['exportReadDataImportDiff(app, preview, \'all\', collectImportPreviewEntries(app, preview))'].forEach((marker) => {
    requireMarker(readDataPreviewSource, marker, 'read-data all diff handoff');
  });
  ['readDataPreviewSafeProfileSplitPass','readDataPreviewFilterSplitPass'].forEach((marker) => {
    requireMarker(stateSource, marker, 'read-data preview app-state marker');
  });
}

module.exports = {
  FRONTEND_CHECK_READ_DATA_PREVIEW_GUARDS_PASS,
  runReadDataPreviewGuardChecks
};
