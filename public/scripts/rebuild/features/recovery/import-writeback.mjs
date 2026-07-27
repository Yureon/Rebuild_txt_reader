import { putSharedPatch } from '../sync/shared-state-write.mjs';
import { putDevicePatch } from '../sync/device-state-write.mjs';
export const RECOVERY_IMPORT_WRITEBACK_REFACTOR_PASS = 'v181-recovery-import-writeback-pass';

export async function applyImportedSharedState(app, shared) {
  if (!shared || typeof shared !== 'object') return null;
  if (app.api?.putShared) {
    const res = await putSharedPatch(app, shared);
    if (res?.synced === false) throw new Error(res.reason || 'shared 가져오기 저장 충돌');
    return { target: 'shared', response: res || null };
  }
  app.state.shared = { ...(app.state.shared || {}), ...shared, updatedAt:Date.now() };
  return { target: 'shared', response: null };
}

export async function applyImportedDeviceState(app, device) {
  if (!device || typeof device !== 'object') return null;
  const nextDevice = {
    ...device,
    deviceId:app.state.deviceId,
    deviceName:app.state.deviceName
  };
  if (app.api?.putDevice) {
    const res = await putDevicePatch(app, nextDevice);
    if (res?.synced === false) throw new Error(res.reason || 'device 가져오기 저장 충돌');
    return { target:'device', response:res || null };
  }
  app.state.device = nextDevice;
  return { target:'device', response:null };
}
