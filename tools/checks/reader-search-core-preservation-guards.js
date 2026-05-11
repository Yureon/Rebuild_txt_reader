const { readProjectSourceManifest, buildProjectSourceManifestSummary } = require('./source-loader-manifest.js');

const READER_SEARCH_CORE_PRESERVATION_GUARD_PASS = 'v253-reader-search-core-preservation-guard-pass';
const READER_SEARCH_DIAGNOSTICS_ONLY_BOUNDARY_PASS = 'v254-reader-search-diagnostics-only-boundary-pass';
const READER_SEARCH_RUNTIME_LOG_ONLY_PRESERVATION_PASS = 'v256-reader-search-runtime-log-only-preservation-pass';
const READER_SEARCH_RUNTIME_LOG_ONLY_BOUNDARY_PASS = 'v257-reader-search-runtime-log-only-boundary-pass';
const READER_SEARCH_FINAL_LOG_GATED_COMPLETION_PASS = 'v258-reader-search-final-log-gated-completion-pass';

function runReaderSearchCorePreservationGuards(projectRoot) {
  const sources = readProjectSourceManifest(projectRoot, {
    virtualLayout: 'rebuild/features/reader/virtual-layout.mjs',
    searchRuntime: 'rebuild/features/search.mjs',
    searchJumpStatus: 'rebuild/features/search/jump-status.mjs',
    searchLiveDomDiagnostics: 'rebuild/features/search/live-dom-diagnostics-snapshot.mjs',
    readerManualDiagnostics: 'rebuild/features/reader/manual-diagnostics-snapshot.mjs',
    smoothnessSmoke: { root:'checks', parts:['reader-virtual-scroll-smoothness-smoke.js'] },
    manualSnapshotSmoke: { root:'checks', parts:['reader-manual-diagnostics-snapshot-smoke.js'] }
  });
  const sourceSummary = buildProjectSourceManifestSummary(sources);
  [
    'export function ensureVirtualState',
    'export function rebuildVirtualRows',
    'export function renderVirtual',
    'export function scrollToVirtualTarget',
    'v241-reader-scroll-input-diagnostics-pass'
  ].forEach(marker => {
    if (!sources.virtualLayout.includes(marker)) throw new Error('reader virtual core preservation marker missing: ' + marker);
  });
  [
    'async function jumpToResult',
    'recordSearchJumpStatus(app, { ...jumpInfo, stage:\'loading\' })',
    'recordSearchJumpFailure(app, jumpInfo, error)',
    'validateSearchResultJump'
  ].forEach(marker => {
    if (!sources.searchRuntime.includes(marker)) throw new Error('search jump core preservation marker missing: ' + marker);
  });
  [
    'validateLastSearchJumpRetry',
    'buildSearchJumpMessage',
    'buildSearchJumpLiveFieldValidation'
  ].forEach(marker => {
    if (!sources.searchJumpStatus.includes(marker)) throw new Error('search jump status marker missing: ' + marker);
  });
  [
    'v251-search-live-dom-diagnostics-snapshot-pass',
    'v252-search-live-dom-retry-fixture-bridge-pass'
  ].forEach(marker => {
    if (!sources.searchLiveDomDiagnostics.includes(marker)) throw new Error('search diagnostics-only marker missing: ' + marker);
  });
  if (!sources.readerManualDiagnostics.includes('v253-reader-manual-diagnostics-recovery-summary-pass')) throw new Error('manual diagnostics recovery summary marker missing');
  ['v254-reader-virtual-scroll-smoothness-source-manifest-pass', 'readProjectSourceManifest'].forEach(marker => {
    if (!sources.smoothnessSmoke.includes(marker)) throw new Error('smoothness smoke source-manifest boundary missing: ' + marker);
  });
  ['v254-reader-manual-diagnostics-snapshot-source-manifest-pass', 'readProjectSourceManifest'].forEach(marker => {
    if (!sources.manualSnapshotSmoke.includes(marker)) throw new Error('manual diagnostics smoke source-manifest boundary missing: ' + marker);
  });
  const runtimeLogOnlyMarkers = [
    'recordSearchJumpFailure(app, jumpInfo, error)',
    'recordSearchJumpStatus(app, { ...jumpInfo',
    'buildSearchLiveDomRetryDiagnosticsSnapshot',
    'buildReaderManualDiagnosticsTrendBundle'
  ];
  if (!sources.searchRuntime.includes(runtimeLogOnlyMarkers[0]) || !sources.searchRuntime.includes(runtimeLogOnlyMarkers[1])) throw new Error('search runtime log-only preservation marker missing');
  if (!sources.searchLiveDomDiagnostics.includes(runtimeLogOnlyMarkers[2])) throw new Error('search live DOM diagnostics boundary missing');
  if (!sources.readerManualDiagnostics.includes(runtimeLogOnlyMarkers[3])) throw new Error('reader manual diagnostics trend boundary missing');
  return {
    pass: READER_SEARCH_CORE_PRESERVATION_GUARD_PASS,
    diagnosticsOnlyBoundaryPass: READER_SEARCH_DIAGNOSTICS_ONLY_BOUNDARY_PASS,
    runtimeLogOnlyPreservationPass: READER_SEARCH_RUNTIME_LOG_ONLY_PRESERVATION_PASS,
    runtimeLogOnlyBoundaryPass: READER_SEARCH_RUNTIME_LOG_ONLY_BOUNDARY_PASS,
    finalLogGatedCompletionPass: READER_SEARCH_FINAL_LOG_GATED_COMPLETION_PASS,
    sourceSummary,
    policy: 'core scroll/search jump execution is preserved; v258 close-out keeps diagnostics, fixtures, guard, smoke coverage, and report-only log boundaries only'
  };
}

module.exports = { READER_SEARCH_CORE_PRESERVATION_GUARD_PASS, READER_SEARCH_DIAGNOSTICS_ONLY_BOUNDARY_PASS, READER_SEARCH_RUNTIME_LOG_ONLY_PRESERVATION_PASS, READER_SEARCH_RUNTIME_LOG_ONLY_BOUNDARY_PASS, READER_SEARCH_FINAL_LOG_GATED_COMPLETION_PASS, runReaderSearchCorePreservationGuards };
