const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const normalizer = require('../../server/services/state-normalizer');
const { createStateWriteService } = require('../../server/services/state-write-service');
const { createSyncStateService } = require('../../server/services/sync-state-service');

const PASS = 'v674-server-device-profile-cap-smoke-pass';
const CURRENT_DEVICE_ID = 'device-001';
const PREFERRED_DEVICE_ID = 'device-000';

function deviceId(index) {
  return `device-${String(index).padStart(3, '0')}`;
}

function buildRawState(reverse = false) {
  const indexes = Array.from({ length:100 }, (_, index) => index);
  if (reverse) indexes.reverse();
  const deviceProfiles = {};
  const deviceUpdatedAt = {};
  const deviceVersions = {};
  const devices = [];
  indexes.forEach((index) => {
    const id = deviceId(index);
    const recency = index * 100;
    deviceProfiles[id] = {
      collapsedFolders:[`folder-${index}`],
      prefs:{ searchByFilename:index % 2 === 0 },
      updatedAt:recency
    };
    deviceUpdatedAt[id] = recency;
    deviceVersions[id] = index;
    devices.push({ id, name:`Device ${index}`, lastSeenAt:recency });
  });
  return {
    version:1,
    updatedAt:10000,
    syncMeta:{ sharedUpdatedAt:1, sharedVersion:1, deviceUpdatedAt, deviceVersions },
    shared:{
      syncPolicy:{
        preferredDeviceId:PREFERRED_DEVICE_ID,
        devices,
        share:{ progress:true }
      }
    },
    deviceProfiles
  };
}

function collectionIds(state) {
  return {
    profiles:Object.keys(state.deviceProfiles).sort(),
    updatedAt:Object.keys(state.syncMeta.deviceUpdatedAt).sort(),
    versions:Object.keys(state.syncMeta.deviceVersions).sort(),
    policy:state.shared.syncPolicy.devices.map((device) => device.id).sort()
  };
}

function assertBoundedAndAligned(state, currentDeviceId) {
  const ids = collectionIds(state);
  assert.strictEqual(ids.profiles.length, normalizer.MAX_DEVICE_PROFILES);
  assert.deepStrictEqual(ids.updatedAt, ids.profiles);
  assert.deepStrictEqual(ids.versions, ids.profiles);
  assert.deepStrictEqual(ids.policy, ids.profiles);
  assert(ids.profiles.includes(PREFERRED_DEVICE_ID), 'preferred device was evicted');
  assert(ids.profiles.includes(currentDeviceId), 'current device was evicted');
  return ids.profiles;
}

async function main() {
  assert.strictEqual(normalizer.V674_SERVER_DEVICE_PROFILE_CAP_PASS, 'v674-server-device-profile-cap-pass');
  assert.strictEqual(normalizer.MAX_DEVICE_PROFILES, 20);

  const normalized = normalizer.normalizeUserState(buildRawState(), { currentDeviceId:CURRENT_DEVICE_ID });
  const retainedIds = assertBoundedAndAligned(normalized, CURRENT_DEVICE_ID);
  const expectedRecent = Array.from({ length:18 }, (_, offset) => deviceId(99 - offset));
  assert.deepStrictEqual(
    retainedIds,
    [PREFERRED_DEVICE_ID, CURRENT_DEVICE_ID, ...expectedRecent].sort(),
    'recent/LRU selection changed'
  );

  const reverseNormalized = normalizer.normalizeUserState(buildRawState(true), { currentDeviceId:CURRENT_DEVICE_ID });
  assert.deepStrictEqual(reverseNormalized, normalized, 'selection depended on object or policy insertion order');

  let inMemory = buildRawState();
  let saveSoonCalls = 0;
  const syncStateService = {
    get:() => inMemory,
    set:(next) => {
      inMemory = normalizer.normalizeUserState(next);
      return inMemory;
    },
    saveSoon:() => {
      saveSoonCalls += 1;
      return true;
    }
  };
  const writeService = createStateWriteService({ syncStateService, normalizer });
  const staleReq = { get:(name) => name === 'x-device-id' ? CURRENT_DEVICE_ID : '' };
  const staleResult = writeService.saveDeviceState(staleReq, {
    deviceId:CURRENT_DEVICE_ID,
    collapsedFolders:['must-not-overwrite'],
    syncVersion:1
  });
  assert.strictEqual(staleResult.skipped, true);
  assert.strictEqual(staleResult.reason, 'stale_device_version');
  assert.strictEqual(saveSoonCalls, 0);
  assertBoundedAndAligned(inMemory, CURRENT_DEVICE_ID);

  const newCurrentDeviceId = 'device-100';
  const req = { get:(name) => name === 'x-device-id' ? newCurrentDeviceId : '' };
  const writeResult = writeService.saveDeviceState(req, {
    deviceId:newCurrentDeviceId,
    deviceName:'Current device',
    collapsedFolders:['current-folder'],
    prefs:{ searchByFilename:true }
  });
  assert.strictEqual(writeResult.deviceId, newCurrentDeviceId);
  assert.strictEqual(saveSoonCalls, 1);
  assertBoundedAndAligned(inMemory, newCurrentDeviceId);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v674-device-cap-'));
  const syncPath = path.join(tempDir, 'state.json');
  const snapshotDir = path.join(tempDir, 'snapshots');
  fs.mkdirSync(snapshotDir, { recursive:true });
  fs.writeFileSync(syncPath, JSON.stringify(inMemory, null, 2));
  let reloadedService = null;
  try {
    reloadedService = createSyncStateService({
      syncPath,
      snapshotDir,
      createEmptyState:normalizer.createEmptyUserState,
      normalizeState:normalizer.normalizeUserState,
      logger:{ error(){} }
    });
    const reloaded = reloadedService.get();
    assert.deepStrictEqual(collectionIds(reloaded), collectionIds(inMemory), 'restart changed the retained device set');
    assert.deepStrictEqual(reloaded, normalizer.normalizeUserState(JSON.parse(JSON.stringify(reloaded))), 'restart normalization was not idempotent');
    assertBoundedAndAligned(reloaded, newCurrentDeviceId);
  } finally {
    if (reloadedService) await reloadedService.close();
    fs.rmSync(tempDir, { recursive:true, force:true });
  }

  console.log(JSON.stringify({
    pass:PASS,
    marker:normalizer.V674_SERVER_DEVICE_PROFILE_CAP_PASS,
    inputDevices:100,
    maxDeviceProfiles:normalizer.MAX_DEVICE_PROFILES,
    retainedDevices:normalizer.MAX_DEVICE_PROFILES,
    alignedCollections:['deviceProfiles', 'syncMeta.deviceUpdatedAt', 'syncMeta.deviceVersions', 'syncPolicy.devices'],
    preferredRetained:true,
    currentRetained:true,
    staleGuardRetained:true,
    deterministicSelection:true,
    restartConsistent:true
  }));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
