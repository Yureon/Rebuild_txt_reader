import { removeLocal } from '../../core/storage.mjs';
import { clearReaderCache } from '../reader/cache-store.mjs';
import { abortReaderPrefetch } from '../reader/prefetch-queue.mjs';
import { persistBookData, persistLibraryUi, persistPrefs, persistProgress } from '../../state/app-state.mjs';
import { toast } from '../ui.mjs';
import { copyRecoveryTextWithFallback } from './export-utils.mjs';
import { RECOVERY_CHECKLIST } from './policy-checklist-panel.mjs';

export const RECOVERY_LOCAL_MAINTENANCE_REFACTOR_PASS = 'v176-recovery-local-maintenance-actions-pass';

async function refreshRecoverySafely(app, options = {}) {
  const refreshRecovery = options.refreshRecovery;
  if (typeof refreshRecovery !== 'function') return null;
  try {
    return await refreshRecovery(app);
  } catch {
    return null;
  }
}

export async function retryRecoverySaves(app, options = {}) {
  try {
    persistBookData(app.state);
    persistProgress(app.state);
    persistPrefs(app.state);
    persistLibraryUi(app.state);
    const tasks = [];
    if (app.api?.putShared) {
      const shared = {
        ...(app.state.shared || {}),
        bookmarks: app.state.bookmarks || [],
        recents: app.state.recents || [],
        favorites: Array.from(app.state.favorites || []),
        progress: app.state.progress || {},
        viewerPrefs: app.state.prefs || {},
        updatedAt: Date.now()
      };
      tasks.push(app.api.putShared(shared).then(res => {
        if (res?.shared) app.state.shared = res.shared;
        if (res?.syncPolicySummary) app.state.syncPolicySummary = res.syncPolicySummary;
        if (Number(res?.sharedVersion)) app.state.sharedVersion = Number(res.sharedVersion);
      }));
    }
    if (app.deviceSync?.push) tasks.push(app.deviceSync.push());
    await Promise.all(tasks);
    if (typeof options.renderSyncDevicePanel === 'function') options.renderSyncDevicePanel(app);
    await refreshRecoverySafely(app, options);
    toast(app, 'success', '저장 재시도 완료', '로컬 상태와 서버 동기화 요청을 다시 처리했습니다.');
  } catch (error) {
    toast(app, 'error', '저장 재시도 실패', error.message || String(error));
  }
}

export async function clearRecoveryPrefetch(app, options = {}) {
  abortReaderPrefetch(app);
  await refreshRecoverySafely(app, options);
  toast(app, 'success', '프리패치 정리 완료', '대기 중인 백그라운드 본문 요청을 취소했습니다.');
}

export async function clearRecoveryReaderCache(app, options = {}) {
  if (!window.confirm('IndexedDB 리더 캐시를 모두 정리합니다. 서버 데이터와 읽기 위치는 삭제하지 않습니다.')) return;
  const ok = await clearReaderCache();
  await refreshRecoverySafely(app, options);
  toast(app, ok ? 'success' : 'error', ok ? '캐시 정리 완료' : '캐시 정리 실패', ok ? '리더 본문 캐시를 비웠습니다.' : 'IndexedDB 캐시를 정리하지 못했습니다.');
}

export function clearRecoveryLocalUserData(app) {
  const answer = window.prompt('로컬 사용자 데이터만 초기화합니다. 서버 데이터는 삭제하지 않습니다. 계속하려면 초기화 를 입력하세요.');
  if (String(answer || '').trim() !== '초기화') return;
  ['prefs','progress','bookmarks','favorites','recents','expandedEpisodeNovels','collapsedFolders'].forEach(removeLocal);
  toast(app, 'success', '로컬 데이터 초기화 완료', '새로고침하면 기본 로컬 상태로 다시 시작합니다.');
}

export async function copyRecoveryChecklist(app) {
  const text = RECOVERY_CHECKLIST.join('\n');
  try {
    await copyRecoveryTextWithFallback(app, text, { label:'debug-text', mime:'text/plain' });
    toast(app, 'success', '체크리스트 복사 완료', '회귀 확인 항목을 클립보드에 복사했습니다.');
  } catch (error) {
    toast(app, 'error', '복사 실패', error.message || String(error));
  }
}
