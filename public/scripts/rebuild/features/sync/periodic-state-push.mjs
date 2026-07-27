export const PERIODIC_PREF_SCOPE_SYNC_PASS = 'v622-periodic-pref-scope-sync-pass';
const DEVICE_PREF_KEYS = new Set(['settingsMainTab','viewerSubTab','funcSubTab','searchByFilename','customCssDevice','fontFamilyDevice']);

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

export function buildPeriodicSyncEnvelope(app) {
  const { sharedPrefs, devicePrefs } = splitPreferencesForSync(app.state.prefs);
  const device = {
    deviceId:app.state.deviceId,
    deviceName:app.state.deviceName,
    collapsedFolders:Array.from(app.state.collapsedFolders || []),
    prefs:devicePrefs
  };
  const shared = { viewerPrefs:sharedPrefs };
  return { device, shared, payloadHash:hashStablePayload({ device, shared }) };
}

export function splitPreferencesForSync(prefs = {}) {
  const sharedPrefs = {};
  const devicePrefs = {};
  for (const [key, value] of Object.entries(prefs || {})) {
    (DEVICE_PREF_KEYS.has(key) ? devicePrefs : sharedPrefs)[key] = value;
  }
  return { sharedPrefs, devicePrefs };
}

export async function pushPeriodicState(app, envelope) {
  const [{ putDevicePatch }, { putSharedPatch }] = await Promise.all([
    import('./device-state-write.mjs'),
    import('./shared-state-write.mjs')
  ]);
  const [deviceSettled, sharedSettled] = await Promise.allSettled([
    putDevicePatch(app, envelope.device),
    putSharedPatch(app, envelope.shared)
  ]);
  const deviceResult = deviceSettled.status === 'fulfilled' ? deviceSettled.value : null;
  const sharedResult = sharedSettled.status === 'fulfilled' ? sharedSettled.value : null;
  if (deviceSettled.status === 'rejected' || sharedSettled.status === 'rejected') {
    const error = new Error('주기적 동기화의 일부 또는 전체가 실패했습니다.');
    error.code = deviceSettled.status === 'rejected' && sharedSettled.status === 'rejected' ? 'PERIODIC_SYNC_FAILED' : 'PERIODIC_SYNC_PARTIAL_FAILURE';
    error.deviceError = deviceSettled.status === 'rejected' ? String(deviceSettled.reason?.message || deviceSettled.reason || '') : '';
    error.sharedError = sharedSettled.status === 'rejected' ? String(sharedSettled.reason?.message || sharedSettled.reason || '') : '';
    error.deviceResult = deviceResult;
    error.sharedResult = sharedResult;
    throw error;
  }
  return {
    ...deviceResult,
    synced:deviceResult?.synced === true && sharedResult?.synced === true,
    sharedSync:sharedResult || null,
    syncPolicySummary:sharedResult?.syncPolicySummary || deviceResult?.syncPolicySummary || null,
    pass:PERIODIC_PREF_SCOPE_SYNC_PASS
  };
}
