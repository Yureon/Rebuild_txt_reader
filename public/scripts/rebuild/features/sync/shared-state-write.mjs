export const SHARED_STATE_PARTIAL_WRITE_PASS = 'v602-shared-state-partial-write-pass';
export const SHARED_STATE_SERIAL_WRITE_PASS = 'v602-shared-state-serial-write-pass';

function plainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function mergeSharedPatch(current = {}, patch = {}) {
  const base = plainObject(current) ? current : {};
  const delta = plainObject(patch) ? patch : {};
  const next = { ...base, ...delta };
  if (Object.prototype.hasOwnProperty.call(delta, 'viewerPrefs')) {
    next.viewerPrefs = plainObject(delta.viewerPrefs)
      ? { ...(plainObject(base.viewerPrefs) ? base.viewerPrefs : {}), ...delta.viewerPrefs }
      : delta.viewerPrefs;
  }
  if (Object.prototype.hasOwnProperty.call(delta, 'syncPolicy')) {
    next.syncPolicy = plainObject(delta.syncPolicy)
      ? { ...(plainObject(base.syncPolicy) ? base.syncPolicy : {}), ...delta.syncPolicy }
      : delta.syncPolicy;
  }
  return next;
}

function rebuildOptimisticShared(app) {
  let next = plainObject(app.state.sharedConfirmed) ? app.state.sharedConfirmed : {};
  for (const entry of (Array.isArray(app.state.sharedPendingPatches) ? app.state.sharedPendingPatches : [])) {
    next = mergeSharedPatch(next, entry.patch);
  }
  app.state.shared = next;
  return next;
}

export function putSharedPatch(app, patch = {}) {
  if (!app?.api || typeof app.api.putShared !== 'function') {
    return Promise.resolve({ success:false, synced:false, reason:'shared-api-unavailable', pass:SHARED_STATE_PARTIAL_WRITE_PASS });
  }
  const delta = plainObject(patch) ? { ...patch } : {};
  if (!Array.isArray(app.state.sharedPendingPatches)) app.state.sharedPendingPatches = [];
  if (!app.state.sharedPendingPatches.length) app.state.sharedConfirmed = plainObject(app.state.shared) ? app.state.shared : {};
  const entry = { patch:delta, token:Symbol('shared-patch') };
  app.state.sharedPendingPatches.push(entry);
  app.state.shared = mergeSharedPatch(app.state.shared, delta);

  const previous = app.state.sharedSyncRequest || Promise.resolve();
  const request = Promise.resolve(previous).catch(() => null).then(async () => {
    let lastError = null;
    let lastResponse = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const payload = { ...delta, updatedAt:Date.now(), syncVersion:Math.max(0, Number(app.state.sharedVersion) || 0) };
      try {
        const response = await app.api.putShared(payload);
        lastResponse = response || null;
        if (response?.syncPolicySummary) app.state.syncPolicySummary = response.syncPolicySummary;
        if (Number.isFinite(Number(response?.sharedVersion))) app.state.sharedVersion = Math.max(0, Number(response.sharedVersion) || 0);
        if (plainObject(response?.shared)) app.state.sharedConfirmed = response.shared;
        if (!response?.skipped) {
          return { ...response, synced:true, reason:'', attempts:attempt + 1, pass:SHARED_STATE_PARTIAL_WRITE_PASS, serialPass:SHARED_STATE_SERIAL_WRITE_PASS };
        }
      } catch (error) {
        lastError = error;
      }
    }
    return {
      ...(lastResponse || {}),
      success:false,
      synced:false,
      reason:lastResponse?.skipped ? (lastResponse.reason || 'shared-write-skipped') : 'request-failed',
      error:lastError || undefined,
      attempts:3,
      pass:SHARED_STATE_PARTIAL_WRITE_PASS,
      serialPass:SHARED_STATE_SERIAL_WRITE_PASS
    };
  }).finally(() => {
    app.state.sharedPendingPatches = (Array.isArray(app.state.sharedPendingPatches) ? app.state.sharedPendingPatches : []).filter(item => item !== entry);
    rebuildOptimisticShared(app);
    if (app.state.sharedSyncRequest === request) app.state.sharedSyncRequest = null;
  });
  app.state.sharedSyncRequest = request;
  return request;
}
