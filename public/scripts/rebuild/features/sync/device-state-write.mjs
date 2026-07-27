export const DEVICE_STATE_SERIAL_WRITE_PASS = 'v602-device-state-serial-write-pass';

function plainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function mergeDevicePatch(current = {}, patch = {}) {
  const base = plainObject(current) ? current : {};
  const delta = plainObject(patch) ? patch : {};
  const next = { ...base, ...delta };
  if (Object.prototype.hasOwnProperty.call(delta, 'prefs')) {
    next.prefs = plainObject(delta.prefs)
      ? { ...(plainObject(base.prefs) ? base.prefs : {}), ...delta.prefs }
      : delta.prefs;
  }
  if (Object.prototype.hasOwnProperty.call(delta, 'theme')) {
    next.theme = plainObject(delta.theme)
      ? { ...(plainObject(base.theme) ? base.theme : {}), ...delta.theme }
      : delta.theme;
  }
  return next;
}

export function putDevicePatch(app, patch = {}) {
  if (!app?.api || typeof app.api.putDevice !== 'function') {
    return Promise.resolve({ success:false, synced:false, reason:'device-api-unavailable', pass:DEVICE_STATE_SERIAL_WRITE_PASS });
  }
  const delta = plainObject(patch) ? { ...patch } : {};
  const previous = app.state.deviceSyncRequest || Promise.resolve();
  const request = Promise.resolve(previous).catch(() => null).then(async () => {
    let lastError = null;
    let lastResponse = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const payload = {
        ...delta,
        deviceId:delta.deviceId || app.state.deviceId,
        deviceName:delta.deviceName || app.state.deviceName,
        updatedAt:Date.now(),
        syncVersion:Math.max(0, Number(app.state.deviceVersion) || 0) + 1
      };
      try {
        const response = await app.api.putDevice(payload);
        lastResponse = response || null;
        if (Number.isFinite(Number(response?.deviceVersion))) app.state.deviceVersion = Math.max(0, Number(response.deviceVersion) || 0);
        if (response?.syncPolicySummary) app.state.syncPolicySummary = response.syncPolicySummary;
        if (plainObject(response?.device)) app.state.device = response.device;
        if (!response?.skipped) return { ...response, synced:true, reason:'', attempts:attempt + 1, pass:DEVICE_STATE_SERIAL_WRITE_PASS };
      } catch (error) {
        lastError = error;
      }
    }
    return {
      ...(lastResponse || {}),
      success:false,
      synced:false,
      reason:lastResponse?.skipped ? (lastResponse.reason || 'device-write-skipped') : 'request-failed',
      error:lastError || undefined,
      attempts:3,
      pass:DEVICE_STATE_SERIAL_WRITE_PASS
    };
  }).finally(() => {
    if (app.state.deviceSyncRequest === request) app.state.deviceSyncRequest = null;
  });
  app.state.deviceSyncRequest = request;
  return request;
}
