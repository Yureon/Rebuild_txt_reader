const { runModuleSmokeScript } = require('./smoke-child-runner.js');

const SEARCH_COVERAGE_SUMMARY_SMOKE_PASS = 'v234-search-coverage-summary-smoke-pass';

async function runSearchCoverageSummarySmoke(projectRoot) {
  if (!projectRoot) throw new Error('runSearchCoverageSummarySmoke requires projectRoot');
  const script = String.raw`
    const { buildSearchCoverageSummaryPayload, buildSearchJumpFailureSummary } = await import('./public/scripts/rebuild/features/search/coverage-summary.mjs');
    const app = { state:{ search:{ results:[1, 2, 3], cacheOnly:false } } };
    const failure = buildSearchCoverageSummaryPayload(app, { allChunks:false, jumpFailure:{ chunk:2, totalChunks:5, error:'missing row' } });
    if (!failure.text.includes('이동 실패') || !failure.markers.jumpFailureRecovery || !failure.markers.liveFieldValidation) throw new Error('jump failure coverage summary payload is invalid');
    if (!buildSearchJumpFailureSummary({ chunk:1, totalChunks:3 }).includes('재시도 가능')) throw new Error('jump failure summary must mention retry path');
    const live = buildSearchCoverageSummaryPayload(app, { allChunks:false, jumpStatus:{ stage:'done', chunk:3, totalChunks:7 }, jumpLiveValidation:{ ok:false } });
    if (!live.text.includes('현재 검색과 불일치') || !live.markers.liveFieldValidation) throw new Error('live jump coverage summary payload is invalid');
    const done = buildSearchCoverageSummaryPayload(app, { allChunks:true, stats:{ done:true, mode:'all', totalChunks:4, processedChunks:4, resultCount:3 }, preview:{ totalChunks:4 } });
    if (!done.markers.fullScanUx || !done.text.includes('전체 본문 검색')) throw new Error('full scan summary payload is invalid');
    const preview = buildSearchCoverageSummaryPayload(app, { allChunks:true, preview:{ totalChunks:10, searchableChunks:4, cacheChunks:2, loadedChunks:1, memoryChunks:1, cachedOrLoaded:3, online:false, offlineMissingChunks:6 } });
    if (!preview.text.includes('오프라인 검색 가능 4/10')) throw new Error('coverage preview summary payload is invalid');
  `;
  await runModuleSmokeScript(projectRoot, script, { label: 'search coverage summary smoke', timeoutMs: 8000 })
  return { pass: SEARCH_COVERAGE_SUMMARY_SMOKE_PASS };
}

module.exports = {
  SEARCH_COVERAGE_SUMMARY_SMOKE_PASS,
  runSearchCoverageSummarySmoke
};
