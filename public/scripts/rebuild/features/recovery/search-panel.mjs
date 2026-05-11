import { getNetworkProfile } from '../reader/offline-status.mjs';
import { prepareOffline, prepareOfflineChunks } from '../reader/dom-actions.mjs';
import { formatSearchContextReset, formatSearchCoverageSummary, formatSearchJumpRecoverySummary, formatSearchJumpRetryValidation, formatSearchJumpSessionCleanup, getCoverageMissingChunks } from './search-diagnostics.mjs';
import { clearRecoverySearchCache, copyRecoverySearchDiagnostics, openRecoverySearchPanel } from './search-panel-actions.mjs';
import { createRecoverySearchActionButton, createRecoverySearchPanelSection } from './search-panel-renderers.mjs';

export const RECOVERY_SEARCH_PANEL_REFACTOR_PASS = 'v172-recovery-search-panel-pass';

export function renderRecoverySearchPanel(app, info = {}, actions = {}) {
  const coverage = info.searchCoverage || null;
  const stats = app.state.search?.stats || null;
  const jumpStatus = app.state.search?.lastJumpStatus || null;
  const jumpFailure = app.state.search?.lastJumpFailure || null;
  const jumpLiveValidation = app.state.search?.lastJumpLiveFieldValidation || null;
  const jumpRetryValidation = app.state.search?.lastJumpRetryValidation || null;
  const jumpSessionCleanup = app.state.search?.lastJumpSessionCleanup || null;
  const searchContextReset = app.state.search?.lastSearchContextReset || null;
  const missing = Array.isArray(stats?.skippedOfflineChunkList) ? stats.skippedOfflineChunkList.length : 0;
  const failed = Array.isArray(stats?.failedChunkList) ? stats.failedChunkList.length : 0;
  const missingCoverageChunks = getCoverageMissingChunks(coverage);
  const missingCoverageLabel = missingCoverageChunks.length
    ? String(missingCoverageChunks.length) + '개' + (coverage?.truncated ? ' · 샘플 기준' : '')
    : '없음';
  const cacheOnlySkipped = Number(stats?.skippedCacheOnlyChunks) || 0;
  const rows = [
    ['검색 가능 범위', formatSearchCoverageSummary(coverage)],
    ['오프라인 저장 후보', missingCoverageLabel],
    ['현재 결과', String(app.state.search?.results?.length || 0) + '개 · 필터 ' + (app.state.search?.sourceFilter || 'all') + (app.state.search?.cacheOnly ? ' · 캐시 전용' : '')],
    ['마지막 검색 이동', formatSearchJumpRecoverySummary(jumpStatus, jumpFailure, jumpLiveValidation)],
    ['이동 재시도 검증', formatSearchJumpRetryValidation(jumpRetryValidation)],
    ['검색 이동 상태 정리', formatSearchJumpSessionCleanup(jumpSessionCleanup)],
    ['검색 컨텍스트 초기화', formatSearchContextReset(searchContextReset)],
    ['캐시 전용 제외', cacheOnlySkipped ? String(cacheOnlySkipped) + '개' : '없음'],
    ['재시도 대상', '오프라인 누락 ' + missing + '개 · 실패 ' + failed + '개']
  ];
  const buttons = [
    createRecoverySearchActionButton({ text:'검색창 열기', onClick: () => openRecoverySearchPanel(app, { cacheOnly:false }) }),
    createRecoverySearchActionButton({ text:'캐시된 범위만 검색', onClick: () => openRecoverySearchPanel(app, { cacheOnly:true }) }),
    createRecoverySearchActionButton({ text:'후보 목록', disabled: !app.state.current || !coverage || !!coverage.error, title:'검색 coverage 기준 chunk 상태와 저장/삭제 후보를 목록으로 확인합니다.', onClick: () => actions.openCoverageModal?.(app, coverage) }),
    createRecoverySearchActionButton({ text:'현재 주변 저장', disabled: !app.state.current, title:'Reader의 현재 오프라인 준비 범위를 저장합니다.', onClick: () => { app.closeLayer?.('recoveryCenterOverlay', 'recoveryCenterModal'); prepareOffline(app); } }),
    createRecoverySearchActionButton({ text:'검색 누락 저장', disabled: !missingCoverageChunks.length || getNetworkProfile().online === false, title: missingCoverageChunks.length ? '검색 coverage에서 아직 캐시되지 않은 chunk를 오프라인 캐시에 저장합니다.' : '저장할 검색 누락 chunk가 없습니다.', onClick: () => { app.closeLayer?.('recoveryCenterOverlay', 'recoveryCenterModal'); prepareOfflineChunks(app, missingCoverageChunks, { label:'검색 누락', confirmLarge:true }); } }),
    createRecoverySearchActionButton({ text:'오프라인 패널', onClick: () => { app.closeLayer?.('recoveryCenterOverlay', 'recoveryCenterModal'); app.offlineStatus?.showPanel?.(); } }),
    createRecoverySearchActionButton({ text:'현재 주변 삭제', danger:true, disabled: !app.state.current, title:'현재 주변 오프라인 준비 범위의 IndexedDB 캐시만 삭제합니다.', onClick: () => actions.deleteRangeCache?.(app) }),
    createRecoverySearchActionButton({ text:'현재 작품 캐시 삭제', danger:true, disabled: !app.state.current, title:'현재 작품/회차의 IndexedDB reader cache만 삭제합니다. 읽기 위치와 서버 데이터는 유지합니다.', onClick: () => actions.deleteCurrentCache?.(app) }),
    createRecoverySearchActionButton({ text:'캐시 전체 정리', danger:true, onClick: () => clearRecoverySearchCache(app, actions) }),
    createRecoverySearchActionButton({ text:'검색 진단 복사', onClick: () => copyRecoverySearchDiagnostics(app, { coverage, missingCoverageChunks, stats, jumpStatus, jumpFailure, jumpLiveValidation, jumpRetryValidation, jumpSessionCleanup, searchContextReset }) })
  ];
  return createRecoverySearchPanelSection(rows, buttons);
}
