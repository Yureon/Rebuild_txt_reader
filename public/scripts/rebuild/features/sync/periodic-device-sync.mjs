import { renderSyncDevicePanel, updateKnownDeviceSeen } from './device-management.mjs';
import { handleRemoteResumeOffer } from './remote-resume.mjs';

export const PERIODIC_DEVICE_SYNC_REFACTOR_PASS = 'v178-periodic-device-sync-pass';
export const PERIODIC_DEVICE_SYNC_DIRTY_CHECK_PASS = 'v457-periodic-device-sync-dirty-check-smoke-pass';

export function installPeriodicDeviceSync(app) {
  if (app.deviceSync?.installed) return app.deviceSync;
  const state = {
    installed: true,
    inFlight: false,
    intervalId: 0,
    initialTimer: 0,
    beforeUnloadHandler: null,
    lastSuccessfulPayloadHash: '',
    skippedUnchangedPushes: 0,
    dirtyCheckPass: PERIODIC_DEVICE_SYNC_DIRTY_CHECK_PASS
  };
  const push = async (options = {}) => {
    if (state.inFlight) return null;
    const force = options === true || options?.force === true;
    const basePayload = buildDeviceSyncPayload(app);
    const payloadHash = hashStablePayload(basePayload);
    if (!force && state.lastSuccessfulPayloadHash && payloadHash === state.lastSuccessfulPayloadHash) {
      state.skippedUnchangedPushes += 1;
      state.lastSkip = { pass: PERIODIC_DEVICE_SYNC_DIRTY_CHECK_PASS, reason: 'unchanged payload', skippedAt: Date.now() };
      return { ok: true, skipped: true, pass: PERIODIC_DEVICE_SYNC_DIRTY_CHECK_PASS };
    }
    state.inFlight = true;
    try {
      app.state.deviceVersion += 1;
      const res = await app.api.putDevice({
        ...basePayload,
        updatedAt: Date.now(),
        syncVersion: app.state.deviceVersion
      });
      state.lastSuccessfulPayloadHash = payloadHash;
      if (res && res.syncPolicySummary) {
        app.state.syncPolicySummary = res.syncPolicySummary;
        if (res.device) app.state.device = res.device;
        if (Number(res.deviceVersion)) app.state.deviceVersion = Number(res.deviceVersion);
        renderSyncDevicePanel(app);
        updateKnownDeviceSeen(app, res.syncPolicySummary, { notify: true });
        handleRemoteResumeOffer(app, res.syncPolicySummary, { notify: true });
      }
      return res || null;
    } catch {
      return null;
    } finally {
      state.inFlight = false;
    }
  };
  state.beforeUnloadHandler = () => { try { navigator.sendBeacon?.('/api/time'); } catch {} };
  window.addEventListener('beforeunload', state.beforeUnloadHandler);
  state.intervalId = window.setInterval(push, 30_000);
  state.initialTimer = window.setTimeout(() => push({ force: true }), 1200);
  app.deviceSync = {
    installed: true,
    push,
    stop: () => {
      window.clearInterval(state.intervalId);
      window.clearTimeout(state.initialTimer);
      if (state.beforeUnloadHandler) window.removeEventListener('beforeunload', state.beforeUnloadHandler);
      state.installed = false;
      if (app.deviceSync?.state === state) app.deviceSync = null;
    },
    state
  };
  return app.deviceSync;
}

function buildDeviceSyncPayload(app) {
  return {
    deviceId: app.state.deviceId,
    deviceName: app.state.deviceName,
    collapsedFolders: Array.from(app.state.collapsedFolders || []),
    prefs: app.state.prefs || {}
  };
}

function stableStringify(value) {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
}

function hashStablePayload(value) {
  const input = stableStringify(value);
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
