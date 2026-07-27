import { clearReaderCache } from '../reader/cache-store.mjs';
import { toast } from '../ui.mjs';
import { exportRecoveryJsonPayload } from './export-utils.mjs';
import { buildRecoverySearchDiagnosticsPayload } from './search-diagnostics-copy-payload.mjs';

export const RECOVERY_SEARCH_PANEL_ACTIONS_PASS = 'v242-recovery-search-panel-actions-pass';

export function openRecoverySearchPanel(app, options = {}) {
  app.closeLayer?.('recoveryCenterOverlay', 'recoveryCenterModal');
  app.search?.open?.();
  if (app.els.nsearchAllchunks) app.els.nsearchAllchunks.checked = !options.cacheOnly;
  window.setTimeout(() => app.els.nsearchCoverageRefresh?.click?.(), 80);
}

export async function clearRecoverySearchCache(app, actions = {}) {
  const ok = typeof window === 'undefined' || typeof window.confirm !== 'function' || window.confirm('IndexedDB reader cache를 모두 삭제할까요? 현재 화면의 본문 표시는 유지하지만, 오프라인 캐시는 비웁니다.');
  if (!ok) return;
  const cleared = await clearReaderCache();
  app.state.chunkTextCache?.clear?.();
  app.offlineStatus?.refreshCoverage?.();
  toast(app, cleared ? 'success' : 'error', '캐시 정리', cleared ? 'Reader 캐시를 정리했습니다.' : '캐시 정리에 실패했습니다.');
  actions.refreshRecovery?.(app);
}

export { buildRecoverySearchDiagnosticsPayload } from './search-diagnostics-copy-payload.mjs';

export async function copyRecoverySearchDiagnostics(app, payloadParts = {}) {
  try {
    await exportRecoveryJsonPayload(app, buildRecoverySearchDiagnosticsPayload(app, payloadParts));
    toast(app, 'success', '검색 진단 복사 완료', '캐시/검색 상태를 클립보드에 복사했습니다.');
  } catch (error) {
    toast(app, 'error', '검색 진단 복사 실패', error.message || String(error));
  }
}
