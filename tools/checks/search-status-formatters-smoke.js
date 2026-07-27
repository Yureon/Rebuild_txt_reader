const { runModuleSmokeScript } = require('./smoke-child-runner.js');

const SEARCH_STATUS_FORMATTERS_SMOKE_PASS = 'v241-search-status-formatters-smoke-pass';

async function runSearchStatusFormattersSmoke(projectRoot) {
  if (!projectRoot) throw new Error('runSearchStatusFormattersSmoke requires projectRoot');
  const script = String.raw`
    const { buildSearchRunSummary, buildSearchStatusSuffix, describeCoveragePreview } = await import('./public/scripts/rebuild/features/search/status-formatters.mjs');
    const { formatSearchCoverageSummary, formatSearchJumpRecoverySummary, formatSearchJumpRetryValidation, formatSearchJumpSessionCleanup, formatSearchContextReset } = await import('./public/scripts/rebuild/features/recovery/search-diagnostics.mjs');
    const app = { state:{ search:{ results:[1,2], cacheOnly:false } } };
    const run = buildSearchRunSummary(app, { mode:'all', done:true, totalChunks:10, processedChunks:5, resultCount:2 }, { totalChunks:10 });
    if (!run.includes('전체 본문 검색') || !run.includes('처리율 50%')) throw new Error('search run summary lost full-scan percent labels');
    if (!buildSearchStatusSuffix({ failedChunks:2 }).includes('실패 2개')) throw new Error('failed chunk suffix missing');
    const preview = describeCoveragePreview(app, { online:false, totalChunks:8, searchableChunks:3, loadedChunks:1, memoryChunks:1, cacheChunks:2, offlineMissingChunks:5 });
    if (!preview.includes('오프라인 검색 가능 3/8') || !preview.includes('누락 5개')) throw new Error('coverage preview label missing offline counts');
    const recoveryCoverage = formatSearchCoverageSummary({ online:false, totalChunks:8, searchableChunks:3, loadedChunks:1, memoryChunks:1, cacheChunks:2, offlineMissingChunks:5, truncated:true, sampledChunks:8 });
    if (!recoveryCoverage.includes('offline 3/8 searchable') || !recoveryCoverage.includes('sampled 8')) throw new Error('recovery coverage formatter missing sampled summary');
    if (!formatSearchJumpRecoverySummary({ stage:'done', chunk:2, totalChunks:5 }, null, { ok:false }).includes('현재 상태와 불일치')) throw new Error('jump recovery validation mismatch label missing');
    if (!formatSearchJumpRetryValidation({ ok:false, reason:'stale-result' }).includes('stale-result')) throw new Error('retry validation formatter missing reason');
    if (!formatSearchJumpSessionCleanup({ reason:'reader-change', pass:'v154', at:1 }).includes('reader-change')) throw new Error('session cleanup formatter missing reason');
    if (!formatSearchContextReset({ reason:'reader-change', triggerPass:'v154', previous:{ resultCount:2 }, at:1, previousReader:{ novelId:'a' }, nextReader:{ novelId:'b' } }).includes('reader a → b')) throw new Error('context reset formatter missing reader transition');
  `;
  await runModuleSmokeScript(projectRoot, script, { label: 'search status formatters smoke', timeoutMs: 8000 });
  return { pass: SEARCH_STATUS_FORMATTERS_SMOKE_PASS };
}

module.exports = {
  SEARCH_STATUS_FORMATTERS_SMOKE_PASS,
  runSearchStatusFormattersSmoke
};
