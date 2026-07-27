import { buildSearchRunSummary, describeCoveragePreview } from './status-formatters.mjs';
import { formatSearchJumpLiveStatus } from './status-detail-rows.mjs';

export const SEARCH_COVERAGE_SUMMARY_HELPER_PASS = 'v234-search-coverage-summary-helper-pass';
export const SEARCH_COMPACT_STATUS_PASS = 'v366-search-compact-status-pass';

export function buildSearchJumpFailureSummary(jumpFailure = null) {
  if (!jumpFailure) return '';
  return '검색 결과 이동 실패 · chunk ' + (jumpFailure.chunk || '-') + '/' + (jumpFailure.totalChunks || '-') + ' · ' + (jumpFailure.error || '원인 미상') + ' · 재시도 가능';
}

export function buildSearchCoverageSummaryText(app, { allChunks = false, stats = null, preview = null, previewBusy = false, jumpFailure = null, jumpStatus = null, jumpLiveValidation = null } = {}) {
  if (jumpFailure) return buildSearchJumpFailureSummary(jumpFailure);
  if (jumpStatus && !allChunks) return formatSearchJumpLiveStatus(jumpStatus, jumpLiveValidation);
  if (!allChunks && !stats?.done && !preview?.totalChunks) return '기본 검색: 표시중/메모리/IndexedDB 캐시만 스캔합니다. 전체검색을 켜야 서버에 요청합니다.';
  if (stats?.done && (stats.mode === 'all' || stats.mode === 'cache-only')) return buildSearchRunSummary(app, stats, preview);
  if (preview?.error) return `검색 가능 범위 확인 실패: ${preview.error}`;
  if (preview?.totalChunks) return describeCoveragePreview(app, preview);
  if (previewBusy) return '검색 가능 범위를 확인하는 중…';
  return allChunks ? '전체검색 중 상세 문제만 하단에 표시합니다.' : '캐시 검색 중 상세 문제만 하단에 표시합니다.';
}

export function buildSearchCoverageSummaryMarkers({ allChunks = false, stats = null, jumpFailure = null, jumpStatus = null } = {}) {
  return {
    jumpFailureRecovery: !!jumpFailure,
    liveFieldValidation: !!(jumpFailure || (jumpStatus && !allChunks)),
    fullScanUx: !!(stats?.done && (stats.mode === 'all' || stats.mode === 'cache-only')),
    compactStatus: true
  };
}

export function buildSearchCoverageSummaryPayload(app, info = {}) {
  return {
    pass: SEARCH_COVERAGE_SUMMARY_HELPER_PASS,
    text: buildSearchCoverageSummaryText(app, info),
    markers: buildSearchCoverageSummaryMarkers(info)
  };
}
