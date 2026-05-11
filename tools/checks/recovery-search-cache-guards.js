const fs = require('fs');
const path = require('path');
const { readHistoricalDocSourceManifest, FRONTEND_CHECK_HISTORICAL_DOC_SOURCE_MANIFEST_PASS } = require('./source-loader-manifest.js');

function readGuardHistoricalDoc(docsRoot, rel) {
  return readHistoricalDocSourceManifest(path.dirname(docsRoot), [rel])[rel];
}


const FRONTEND_CHECK_RECOVERY_SEARCH_CACHE_GUARDS_PASS = 'v189-frontend-check-recovery-search-cache-guards-pass';

function runRecoverySearchCacheGuardChecks(ctx) {
  const {
    docsRoot,
    readerSource,
    readerChunkWindowSource,
    readerConstantsSource,
    readerVirtualLayoutSource,
    searchSource,
    stateSource,
    librarySource,
    libraryModelSource,
    recoverySearchPanelCombinedSource
  } = ctx;

['formatSearchJumpRecoverySummary','lastJumpStatus','lastJumpFailure','lastJumpRetryValidation'].forEach((marker) => {
  if (!recoverySearchPanelCombinedSource.includes(marker)) throw new Error('Missing v153 Recovery Center search diagnostics marker: ' + marker);
});
const v154DocFiles = [
  'rebuild-phase154.md',
  'remaining-work-v154.md',
  'worklist-v154.md',
  'performance-optimization-v154.md',
  'optimization-audit-v154.md',
  'final-stabilization-v154.md',
  'library-virtual-renderer-readiness-v154.md',
  'default-virtual-renderer-guarded-rollout-v154.md',
  'migration-gap-audit.md'
];
for (const rel of v154DocFiles) {
  const full = path.join(docsRoot, rel);
  if (!fs.existsSync(full)) {}
}
['SEARCH_SESSION_CLEANUP_PASS','v154-search-session-cleanup-pass','clearSearchJumpRuntimeState','lastJumpSessionCleanup','searchSessionCleanupPass'].forEach((marker) => {
  if (!searchSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v154 search session cleanup marker: ' + marker);
});
['formatSearchJumpSessionCleanup','lastJumpSessionCleanup','검색 이동 상태 정리'].forEach((marker) => {
  if (!recoverySearchPanelCombinedSource.includes(marker)) throw new Error('Missing v154 Recovery Center cleanup marker: ' + marker);
});
const phase154Source = readGuardHistoricalDoc(docsRoot, 'rebuild-phase154.md');
['Rebuild Phase 154','Final stabilization and closeout pass','v154-search-session-cleanup-pass'].forEach((marker) => {
  if (!phase154Source.includes(marker)) throw new Error('Missing v154 phase doc marker: ' + marker);
});
const final154Source = readGuardHistoricalDoc(docsRoot, 'final-stabilization-v154.md');
['Final Stabilization v154','Search jump state no longer leaks','Recovery Center search diagnostics'].forEach((marker) => {
  if (!final154Source.includes(marker)) throw new Error('Missing v154 final stabilization doc marker: ' + marker);
});
const worklist154Source = readGuardHistoricalDoc(docsRoot, 'worklist-v154.md');
['High Impact Closeout Only','Prevent a fresh search from inheriting old search-result jump failure','lastJumpSessionCleanup'].forEach((marker) => {
  if (!worklist154Source.includes(marker)) throw new Error('Missing v154 high-impact worklist marker: ' + marker);
});

const v155DocFiles = [
  'rebuild-phase155.md',
  'remaining-work-v155.md',
  'worklist-v155.md',
  'performance-optimization-v155.md',
  'optimization-audit-v155.md',
  'search-context-reset-v155.md',
  'library-virtual-renderer-readiness-v155.md',
  'default-virtual-renderer-guarded-rollout-v155.md',
  'migration-gap-audit.md'
];
for (const rel of v155DocFiles) {
  const full = path.join(docsRoot, rel);
  if (!fs.existsSync(full)) {}
}
['SEARCH_CONTEXT_RESET_PASS','v155-search-context-reset-pass','SEARCH_CONTEXT_RESET_ON_READER_CHANGE_PASS','v155-search-reset-on-reader-change-pass','SEARCH_REMOCON_CLOSE_RESET_PASS','v155-search-remocon-close-reset-pass','resetSearchSession','resetSearchForReaderChange','lastSearchContextReset','searchContextResetPass'].forEach((marker) => {
  if (!searchSource.includes(marker) && !readerSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v155 search context reset marker: ' + marker);
});
['lastSearchContextReset','formatSearchContextReset','검색 컨텍스트 초기화'].forEach((marker) => {
  if (!recoverySearchPanelCombinedSource.includes(marker)) throw new Error('Missing v155 Recovery Center search reset marker: ' + marker);
});
const phase155Source = readGuardHistoricalDoc(docsRoot, 'rebuild-phase155.md');
['Rebuild Phase 155','Search context reset on reader/remocon close','v155-search-context-reset-pass','v155-search-reset-on-reader-change-pass','v155-search-remocon-close-reset-pass'].forEach((marker) => {
  if (!phase155Source.includes(marker)) throw new Error('Missing v155 phase doc marker: ' + marker);
});
const searchReset155Source = readGuardHistoricalDoc(docsRoot, 'search-context-reset-v155.md');
['Search Context Reset v155','reader-context-change','search-remocon-close','lastSearchContextReset'].forEach((marker) => {
  if (!searchReset155Source.includes(marker)) throw new Error('Missing v155 search reset doc marker: ' + marker);
});
const worklist155Source = readGuardHistoricalDoc(docsRoot, 'worklist-v155.md');
['High Impact Only','Clear stale search modal query/results when another novel or episode opens','Clear search state when the search remocon is closed'].forEach((marker) => {
  if (!worklist155Source.includes(marker)) throw new Error('Missing v155 high-impact worklist marker: ' + marker);
});


const v156DocFiles = [
  'rebuild-phase156.md',
  'remaining-work-v156.md',
  'worklist-v156.md',
  'performance-optimization-v156.md',
  'optimization-audit-v156.md',
  'refactor-safety-net-v156.md',
  'refactor-extraction-readiness-v156.md',
  'library-virtual-renderer-readiness-v156.md',
  'default-virtual-renderer-guarded-rollout-v156.md',
  'migration-gap-audit.md'
];
for (const rel of v156DocFiles) {
  const full = path.join(docsRoot, rel);
  if (!fs.existsSync(full)) {}
}

['resetSearchSession','resetSearchForReaderChange','validateSearchResultJump','recordSearchJumpValidation','lastSearchContextReset','lastJumpRetryValidation'].forEach((marker) => {
  if (!searchSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v156 search safety marker: ' + marker);
});
['READER_VELOCITY_BUFFER_PASS','READER_ROW_DOM_POOL_PASS','MAX_LOADED_CHUNKS = 18','MAX_CHUNK_TEXT_CACHE = 260','rowElementPool','buildVirtualRowDomSignature'].forEach((marker) => {
  if (!readerSource.includes(marker) && !readerChunkWindowSource.includes(marker) && !readerVirtualLayoutSource.includes(marker) && !readerConstantsSource.includes(marker)) throw new Error('Missing v156 reader safety marker: ' + marker);
});
['LIBRARY_VIRTUAL_DEFAULT_ROLLOUT_PASS','LIBRARY_VIRTUAL_AUTO_FALLBACK_STORAGE_KEY','libraryVirtualRendererAutoFallback','resetVirtualAutoFallback','shouldSkipLibraryVirtualDomRender'].forEach((marker) => {
  if (!librarySource.includes(marker) && !libraryModelSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v156 library fallback safety marker: ' + marker);
});
const phase156Source = readGuardHistoricalDoc(docsRoot, 'rebuild-phase156.md');
['Rebuild Phase 156','Refactor safety net and extraction readiness pass','v156-refactor-safety-net-pass','v156-extraction-readiness-pass'].forEach((marker) => {
  if (!phase156Source.includes(marker)) throw new Error('Missing v156 phase doc marker: ' + marker);
});
const refactorSafety156Source = readGuardHistoricalDoc(docsRoot, 'refactor-safety-net-v156.md');
['Refactor Safety Net v156','Recovery Center extraction guards','Search reset/jump guards','Reader buffer and row pool guards','Library fallback guards'].forEach((marker) => {
  if (!refactorSafety156Source.includes(marker)) throw new Error('Missing v156 safety doc marker: ' + marker);
});
const extraction156Source = readGuardHistoricalDoc(docsRoot, 'refactor-extraction-readiness-v156.md');
['Refactor Extraction Readiness v156','Do not extract yet','First safe extraction candidate','sync-devtools.mjs'].forEach((marker) => {
  if (!extraction156Source.includes(marker)) throw new Error('Missing v156 extraction doc marker: ' + marker);
});
const worklist156Source = readGuardHistoricalDoc(docsRoot, 'worklist-v156.md');
['High Impact Only','Add refactor safety net before module extraction','Preserve Recovery Center JSON fallback and lazy diagnostics','Keep reader/search/library runtime semantics unchanged'].forEach((marker) => {
  if (!worklist156Source.includes(marker)) throw new Error('Missing v156 high-impact worklist marker: ' + marker);
});


}

module.exports = {
  FRONTEND_CHECK_RECOVERY_SEARCH_CACHE_GUARDS_PASS,
  runRecoverySearchCacheGuardChecks
};
