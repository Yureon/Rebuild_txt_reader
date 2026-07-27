const { ensurePlainObject } = require('./state-normalizer-core');
const { MAX_DEVICE_PROFILES } = require('./state-device-profile-cap');

function normalizeSyncPolicyInput(input, options = {}) {
  const base = options.basePolicy || { preferredDeviceId: null, devices: [], share: {} };
  const deviceIdRe = options.deviceIdRe || /^[a-zA-Z0-9_-]{8,120}$/;
  const maxDevices = options.maxDevices === Infinity
    ? Infinity
    : (Number.isSafeInteger(options.maxDevices) && options.maxDevices >= 0 ? options.maxDevices : MAX_DEVICE_PROFILES);
  if (!ensurePlainObject(input)) return base;
  const out = {
    preferredDeviceId: typeof input.preferredDeviceId === 'string' && deviceIdRe.test(input.preferredDeviceId.trim())
      ? input.preferredDeviceId.trim()
      : null,
    devices: Array.isArray(input.devices)
      ? input.devices
          .filter((d) => ensurePlainObject(d) && typeof d.id === 'string' && deviceIdRe.test(d.id.trim()))
          .slice(0, maxDevices)
          .map((d) => ({
            id: d.id.trim(),
            name: String(d.name || '이름 없는 기기').trim().slice(0, 60) || '이름 없는 기기',
            lastSeenAt: Number.isFinite(Number(d.lastSeenAt)) ? Number(d.lastSeenAt) : 0
          }))
      : [],
    share: Object.assign({}, base.share)
  };
  if (ensurePlainObject(input.share)) {
    Object.keys(base.share).forEach((key) => {
      if (typeof input.share[key] === 'boolean') out.share[key] = input.share[key];
    });
  }
  return out;
}

module.exports = { normalizeSyncPolicyInput };
