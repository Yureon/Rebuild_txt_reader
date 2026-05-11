export const RECOVERY_IMPORT_WRITEBACK_REFACTOR_PASS = 'v181-recovery-import-writeback-pass';

export async function applyImportedSharedState(app, shared) {
  if (!shared || typeof shared !== 'object') return null;
  const nextShared = { ...shared, updatedAt: Date.now() };
  app.state.shared = nextShared;
  if (app.api?.putShared) {
    const res = await app.api.putShared(nextShared);
    if (res?.shared) app.state.shared = res.shared;
    if (res?.syncPolicySummary) app.state.syncPolicySummary = res.syncPolicySummary;
    if (Number(res?.sharedVersion)) app.state.sharedVersion = Number(res.sharedVersion);
    return { target: 'shared', response: res || null };
  }
  return { target: 'shared', response: null };
}

export async function applyImportedDeviceState(app, device) {
  if (!device || typeof device !== 'object') return null;
  const nextDevice = {
    ...device,
    deviceId: app.state.deviceId,
    deviceName: app.state.deviceName,
    updatedAt: Date.now(),
    syncVersion: Math.max(Number(app.state.deviceVersion) || 0, Number(device.syncVersion) || 0) + 1
  };
  app.state.device = nextDevice;
  if (app.api?.putDevice) {
    const res = await app.api.putDevice(nextDevice);
    if (res?.device) app.state.device = res.device;
    if (res?.syncPolicySummary) app.state.syncPolicySummary = res.syncPolicySummary;
    if (Number(res?.deviceVersion)) app.state.deviceVersion = Number(res.deviceVersion);
    return { target: 'device', response: res || null };
  }
  return { target: 'device', response: null };
}
