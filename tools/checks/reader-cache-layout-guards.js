const FRONTEND_CHECK_READER_CACHE_LAYOUT_GUARDS_PASS = 'v197-reader-cache-layout-guard-pass';

function runReaderCacheLayoutGuardChecks(ctx) {
  const {
    readerSource,
    readerCacheStoreSource,
    readerCacheDiagnosticsSource,
    readerCacheDiagnosticsUnavailableSource,
    readerCacheRecordFormattersSource,
    readerCacheNovelStatsSource,
    readerCachePrunePlanSource,
    readerCachePruneDiagnosticsSource,
    readerCacheDeleteFormattersSource,
    recoveryCacheActionsSource,
    readerVirtualLayoutSource,
    stateSource
  } = ctx;

  [
    'CACHE_SCHEMA = \'reader-chunk-v2\'',
    'getPreprocessSignature',
    'getContentIdentity',
    'makeChunkCacheKey',
    'getReaderCacheDiagnostics',
    'getReaderCachePruneDiagnostics',
    'readerCacheLastPrune'
  ].forEach((marker) => {
    if (!readerCacheStoreSource.includes(marker)) throw new Error('Missing v197 reader cache stability marker: ' + marker);
  });

  [
    'READER_ROW_DOM_POOL_PASS',
    'VIRTUAL_OVERSCAN_MIN_PX',
    'VIRTUAL_OVERSCAN_VIEWPORT_MULTIPLIER',
    'MAX_RENDERED_ROWS = 180',
    'rowElementPoolStats',
    'getVirtualLayoutDiagnostics',
    'pruneVirtualRowElementPool'
  ].forEach((marker) => {
    if (!readerVirtualLayoutSource.includes(marker)) throw new Error('Missing v197 reader virtual layout stability marker: ' + marker);
  });

  [
    'readerCacheLayoutGuardPass',
    'v197-reader-cache-layout-guard-pass'
  ].forEach((marker) => {
    if (!stateSource.includes(marker)) throw new Error('Missing v197 reader cache/layout guard state marker: ' + marker);
  });

  if (/export\s+function\s+computeVirtualLayout\s*\(/.test(readerSource)) {
    throw new Error('reader.mjs must not re-own virtual layout calculation after v197 guard');
  }
  if (/CACHE_SCHEMA\s*=\s*['\"]reader-chunk-v2['\"]/.test(readerSource)) {
    throw new Error('reader.mjs must not re-own reader cache schema after v197 guard');
  }


  [
    'READER_CACHE_DIAGNOSTICS_SPLIT_PASS',
    'v198-reader-cache-diagnostics-split-pass',
    'buildReaderCacheDiagnosticsSnapshot',
    'buildReaderCacheNovelStatsSnapshot',
    'readerCacheDiagnosticsSplitPass'
  ].forEach((marker) => {
    if (!readerCacheDiagnosticsSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v198 reader cache diagnostics split marker: ' + marker);
  });
  if (/function groupCacheRecordsByNovel/m.test(readerCacheStoreSource)) throw new Error('cache-store.mjs still owns cache record grouping after v198 split');

  [
    'READER_CACHE_PRUNE_PLAN_SPLIT_PASS',
    'v199-reader-cache-prune-plan-split-pass',
    'buildReaderCachePrunePlan',
    'normalizeReaderCacheChunkDeleteSet',
    'readerCachePrunePlanSplitPass'
  ].forEach((marker) => {
    if (!readerCachePrunePlanSource.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v199 reader cache prune plan split marker: ' + marker);
  });
  if (/function buildPrunePlan/m.test(readerCacheStoreSource)) throw new Error('cache-store.mjs still owns prune plan builder after v199 split');
  if (/function normalizeChunkDeleteSet/m.test(readerCacheStoreSource)) throw new Error('cache-store.mjs still owns chunk delete set normalizer after v199 split');


  [
    'READER_CACHE_RECORD_FORMATTERS_PASS',
    'v211-reader-cache-record-formatters-pass',
    'resolveReaderCacheNovelTitle',
    'summarizeReaderCacheRecordForPrune',
    'buildReaderCacheRecordIdentity'
  ].forEach((marker) => {
    if (!readerCacheRecordFormattersSource?.includes(marker)) throw new Error('Missing v211 reader cache record formatter marker: ' + marker);
  });
  if (/export\s+function\s+summarizeReaderCacheRecordForPrune/m.test(readerCacheDiagnosticsSource)) throw new Error('cache-diagnostics.mjs still owns prune record summarizer after v211 split');
  if (!readerCachePrunePlanSource.includes("./cache-record-formatters.mjs")) throw new Error('cache-prune-plan.mjs must import prune summarizer from v211 formatter helper');

  [
    'READER_CACHE_UNAVAILABLE_HELPER_PASS',
    'v212-reader-cache-unavailable-helper-pass',
    'buildReaderCacheUnavailableDiagnostics',
    'buildReaderCacheUnavailableNovelStats'
  ].forEach((marker) => {
    if (!readerCacheDiagnosticsUnavailableSource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v212 reader cache unavailable helper marker: ' + marker);
  });
  if (/export\s+function\s+buildReaderCacheUnavailableDiagnostics/m.test(readerCacheDiagnosticsSource)) throw new Error('cache-diagnostics.mjs still owns unavailable diagnostics after v212 split');
  if (!readerCacheDiagnosticsSource.includes("./cache-diagnostics-unavailable.mjs")) throw new Error('cache-diagnostics.mjs must re-export unavailable helpers from v212 helper');


  [
    'READER_CACHE_NOVEL_STATS_HELPER_PASS',
    'v213-reader-cache-novel-stats-helper-pass',
    'buildReaderCacheNovelStatsSnapshot',
    'groupCacheRecordsByNovel'
  ].forEach((marker) => {
    if (!readerCacheNovelStatsSource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v213 reader cache novel stats helper marker: ' + marker);
  });
  if (/export\s+function\s+groupCacheRecordsByNovel/m.test(readerCacheDiagnosticsSource)) throw new Error('cache-diagnostics.mjs still owns cache novel grouping after v213 split');
  if (!readerCacheDiagnosticsSource.includes("./cache-novel-stats.mjs")) throw new Error('cache-diagnostics.mjs must re-export novel stats helpers from v213 helper');


  [
    'READER_CACHE_PRUNE_DIAGNOSTICS_PASS',
    'v216-reader-cache-prune-diagnostics-pass',
    'buildReaderCachePruneDiagnosticsView'
  ].forEach((marker) => {
    if (!readerCachePruneDiagnosticsSource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v216 reader cache prune diagnostics marker: ' + marker);
  });
  if (!readerCacheStoreSource.includes('./cache-prune-diagnostics.mjs')) throw new Error('cache-store.mjs must import v216 prune diagnostics helper');
  if (/scheduled:\s*!!scheduledPruneHandle[\s\S]*scheduled:\s*!!scheduledPruneHandle/m.test(readerCacheStoreSource)) throw new Error('cache-store.mjs has duplicate scheduled field in prune diagnostics after v216 split');

  ['READER_CACHE_DELETE_FORMATTERS_PASS','v217-reader-cache-delete-formatters-pass','formatReaderCacheDeleteResult','formatReaderCacheDeleteBatchResult','formatReaderCacheRuleDeleteResult','getReaderCacheDeleteToastTone'].forEach((marker) => {
    if (!readerCacheDeleteFormattersSource?.includes(marker) && !stateSource.includes(marker)) throw new Error('Missing v217 reader cache delete formatter marker: ' + marker);
  });
  if (!recoveryCacheActionsSource.includes('../reader/cache-delete-formatters.mjs')) throw new Error('recovery cache actions must import v217 reader cache delete formatter helper');
  if (/삭제 \${result\.removed}개 · \${formatBytes\(result\.bytes \|\| 0\)}/m.test(recoveryCacheActionsSource)) throw new Error('recovery cache actions still owns repeated reader cache delete result template after v217 split');


}

module.exports = {
  FRONTEND_CHECK_READER_CACHE_LAYOUT_GUARDS_PASS,
  runReaderCacheLayoutGuardChecks
};
