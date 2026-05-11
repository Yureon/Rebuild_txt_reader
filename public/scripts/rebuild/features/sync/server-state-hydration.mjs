import { persistBookData, persistLibraryUi, persistPrefs, persistProgress } from '../../state/app-state.mjs';
import { toast } from '../ui.mjs';

export const SERVER_STATE_HYDRATION_REFACTOR_PASS = 'v179-server-state-hydration-pass';

const noop = () => {};

function normalizeServerStateData(data = {}) {
  const source = data && typeof data === 'object' ? data : {};
  return {
    shared: source.shared && typeof source.shared === 'object' ? source.shared : null,
    device: source.device && typeof source.device === 'object' ? source.device : null,
    sharedVersion: Number(source.sharedVersion) || 0,
    deviceVersion: Number(source.deviceVersion) || 0,
    syncPolicySummary: source.syncPolicySummary && typeof source.syncPolicySummary === 'object' ? source.syncPolicySummary : null
  };
}

export async function hydrateServerState(app, hooks = {}) {
  const renderSyncDevicePanel = hooks.renderSyncDevicePanel || noop;
  const updateKnownDeviceSeen = hooks.updateKnownDeviceSeen || noop;
  try {
    const data = await app.api.userState();
    applyServerStateData(app, data, { mergeContent: true });
    persistHydratedServerState(app);
    renderSyncDevicePanel(app);
    updateKnownDeviceSeen(app, app.state.syncPolicySummary, { notify: false });
  } catch (e) {
    toast(app, 'info', '동기화 보류', '서버 상태를 가져오지 못해 로컬 상태로 시작합니다.');
    renderSyncDevicePanel(app);
  }
}

export async function refreshSyncState(app, options = {}, hooks = {}) {
  const renderSyncDevicePanel = hooks.renderSyncDevicePanel || noop;
  const updateKnownDeviceSeen = hooks.updateKnownDeviceSeen || noop;
  const handleRemoteResumeOffer = hooks.handleRemoteResumeOffer || noop;
  const notify = hooks.notify || noop;
  try {
    const data = await app.api.userState();
    applyServerStateData(app, data, { mergeContent: false });
    renderSyncDevicePanel(app);
    updateKnownDeviceSeen(app, app.state.syncPolicySummary, { notify: !options.silent });
    handleRemoteResumeOffer(app, app.state.syncPolicySummary, { notify: !options.silent });
    if (!options.silent) notify(app, 'success', '동기화 상태 갱신', '기기 상태를 다시 불러왔습니다.');
  } catch (e) {
    if (!options.silent) notify(app, 'error', '동기화 상태 갱신 실패', e.message || String(e));
  }
}

export function applyServerStateData(app, data, options = {}) {
  const normalized = normalizeServerStateData(data);
  app.state.shared = normalized.shared;
  app.state.device = normalized.device;
  app.state.sharedVersion = normalized.sharedVersion || app.state.sharedVersion || 0;
  app.state.deviceVersion = normalized.deviceVersion || app.state.deviceVersion || 0;
  app.state.syncPolicySummary = normalized.syncPolicySummary || app.state.syncPolicySummary || null;

  if (!options.mergeContent) return;

  if (normalized.shared) {
    if (Array.isArray(normalized.shared.bookmarks) && normalized.shared.bookmarks.length) app.state.bookmarks = normalized.shared.bookmarks;
    if (Array.isArray(normalized.shared.recents) && normalized.shared.recents.length) app.state.recents = normalized.shared.recents;
    if (Array.isArray(normalized.shared.favorites)) app.state.favorites = new Set(normalized.shared.favorites);
    if (normalized.shared.progress) app.state.progress = mergeProgress(app.state.progress, normalized.shared.progress);
    if (normalized.shared.viewerPrefs && Object.keys(normalized.shared.viewerPrefs).length) {
      app.state.prefs = {
        ...app.state.prefs,
        ...normalized.shared.viewerPrefs,
        preprocess: { ...app.state.prefs.preprocess, ...(normalized.shared.viewerPrefs.preprocess || {}) }
      };
    }
  }
  if (normalized.device) {
    if (Array.isArray(normalized.device.collapsedFolders)) app.state.collapsedFolders = new Set(normalized.device.collapsedFolders);
    if (normalized.device.prefs && Object.keys(normalized.device.prefs).length) {
      app.state.prefs = {
        ...app.state.prefs,
        ...normalized.device.prefs,
        preprocess: { ...app.state.prefs.preprocess, ...(normalized.device.prefs.preprocess || {}) }
      };
    }
  }
}

export function persistHydratedServerState(app) {
  persistBookData(app.state);
  persistProgress(app.state);
  persistPrefs(app.state);
  persistLibraryUi(app.state);
}

export function mergeProgress(local, remote) {
  const out = { lastRead: null, byNovel: {}, positions: {}, readMeta: {}, ...(local || {}) };
  const newer = (a, b) => (Number(a?.ts) || 0) >= (Number(b?.ts) || 0) ? a : b;
  if (remote.lastRead) out.lastRead = newer(remote.lastRead, out.lastRead);
  Object.entries(remote.byNovel || {}).forEach(([k, v]) => { out.byNovel[k] = newer(v, out.byNovel[k]); });
  Object.entries(remote.readMeta || {}).forEach(([k, v]) => { out.readMeta[k] = newer(v, out.readMeta[k]); });
  out.positions = { ...(remote.positions || {}), ...(out.positions || {}) };
  return out;
}
