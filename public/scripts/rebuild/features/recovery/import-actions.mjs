import { persistBookData, persistLibraryUi, persistPrefs, persistProgress } from '../../state/app-state.mjs';
import { toast } from '../ui.mjs';
import { RECOVERY_IMPORT_LABELS, describeRecoveryPayload, getRecoveryImportScopes } from './import-scope-panel.mjs';
import { applyImportedDeviceState, applyImportedSharedState, RECOVERY_IMPORT_WRITEBACK_REFACTOR_PASS } from './import-writeback.mjs';

export const RECOVERY_IMPORT_ACTIONS_REFACTOR_PASS = 'v180-recovery-import-actions-pass';
export const RECOVERY_IMPORT_WRITEBACK_REFACTOR_BRIDGE = RECOVERY_IMPORT_WRITEBACK_REFACTOR_PASS;

export function importRecoveryFile(app, ev, hooks = {}) {
  const file = ev?.target?.files && ev.target.files[0];
  if (!file) return;
  const refreshRecovery = typeof hooks.refreshRecovery === 'function' ? hooks.refreshRecovery : null;
  const renderSyncDevicePanel = typeof hooks.renderSyncDevicePanel === 'function' ? hooks.renderSyncDevicePanel : null;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const payload = JSON.parse(reader.result || '{}');
      const scopes = getRecoveryImportScopes(app);
      const preview = describeRecoveryPayload(payload, scopes);
      const allowed = window.confirm([
        '복구 JSON을 적용합니다.',
        '',
        preview,
        '',
        '선택한 범위만 적용합니다. 서버 shared/device 원본은 체크되어 있을 때만 서버로 다시 저장됩니다.'
      ].join('\n'));
      if (!allowed) {
        toast(app, 'info', '복구 가져오기 취소', file.name);
        return;
      }
      const result = await applyRecoveryPayload(app, payload, scopes);
      persistBookData(app.state);
      persistProgress(app.state);
      persistPrefs(app.state);
      persistLibraryUi(app.state);
      renderSyncDevicePanel?.(app);
      if (refreshRecovery) await refreshRecovery(app);
      toast(app, 'success', '복구 가져오기 완료', result.applied.length ? result.applied.join(' · ') : file.name);
    } catch (error) {
      toast(app, 'error', '복구 가져오기 실패', error && error.message || String(error));
    }
  };
  reader.readAsText(file);
  if (ev && ev.target) ev.target.value = '';
}

export async function applyRecoveryPayload(app, payload, scopes = null) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const selected = scopes || getRecoveryImportScopes(app);
  const applied = [];
  const shared = source.shared && typeof source.shared === 'object' ? source.shared : null;
  const device = source.device && typeof source.device === 'object' ? source.device : null;

  if (selected.prefs) {
    const fromPrefs = source.prefs && typeof source.prefs === 'object' ? source.prefs : null;
    const fromShared = shared?.viewerPrefs && typeof shared.viewerPrefs === 'object' ? shared.viewerPrefs : null;
    const fromDevice = device?.prefs && typeof device.prefs === 'object' ? device.prefs : null;
    if (fromPrefs || fromShared || fromDevice) {
      const next = { ...app.state.prefs, ...(fromShared || {}), ...(fromPrefs || {}), ...(fromDevice || {}) };
      next.preprocess = { ...app.state.prefs.preprocess, ...(fromShared?.preprocess || {}), ...(fromPrefs?.preprocess || {}), ...(fromDevice?.preprocess || {}) };
      app.state.prefs = next;
      applied.push(RECOVERY_IMPORT_LABELS.prefs);
    }
  }

  if (selected.library) {
    if (Array.isArray(source.bookmarks)) app.state.bookmarks = source.bookmarks;
    else if (Array.isArray(shared?.bookmarks)) app.state.bookmarks = shared.bookmarks;
    if (Array.isArray(source.recents)) app.state.recents = source.recents;
    else if (Array.isArray(shared?.recents)) app.state.recents = shared.recents;
    if (Array.isArray(source.favorites)) app.state.favorites = new Set(source.favorites);
    else if (Array.isArray(shared?.favorites)) app.state.favorites = new Set(shared.favorites);
    if (Array.isArray(source.collapsedFolders)) app.state.collapsedFolders = new Set(source.collapsedFolders);
    else if (Array.isArray(device?.collapsedFolders)) app.state.collapsedFolders = new Set(device.collapsedFolders);
    applied.push(RECOVERY_IMPORT_LABELS.library);
  }

  if (selected.progress) {
    const progress = source.progress && typeof source.progress === 'object' ? source.progress : shared?.progress;
    if (progress && typeof progress === 'object') {
      app.state.progress = progress;
      applied.push(RECOVERY_IMPORT_LABELS.progress);
    }
  }

  if (selected.syncPolicy) {
    if (source.syncPolicySummary && typeof source.syncPolicySummary === 'object') app.state.syncPolicySummary = source.syncPolicySummary;
    if (shared?.syncPolicy) {
      app.state.shared = { ...(app.state.shared || {}), syncPolicy: shared.syncPolicy, updatedAt: Date.now() };
    }
    applied.push(RECOVERY_IMPORT_LABELS.syncPolicy);
  }

  if (selected.sharedState && shared) {
    await applyImportedSharedState(app, shared);
    applied.push(RECOVERY_IMPORT_LABELS.sharedState);
  }

  if (selected.deviceState && device) {
    await applyImportedDeviceState(app, device);
    applied.push(RECOVERY_IMPORT_LABELS.deviceState);
  }

  return { applied };
}
