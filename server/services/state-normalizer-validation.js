const { jsonSizeOf, ensurePlainObject } = require('./state-normalizer-core');

const STATE_NORMALIZER_VALIDATION_SPLIT_PASS = 'v203-server-state-normalizer-validation-split-pass';

function validateSharedState(input) {
  if (!ensurePlainObject(input)) {
    return { ok: false, error: 'shared state must be an object' };
  }

  if (jsonSizeOf(input) > 1024 * 1024) {
    return { ok: false, error: 'shared state too large' };
  }

  if (input.favorites && (!Array.isArray(input.favorites) || input.favorites.length > 2000)) {
    return { ok: false, error: 'favorites invalid' };
  }

  if (input.bookmarks && (!Array.isArray(input.bookmarks) || input.bookmarks.length > 1000)) {
    return { ok: false, error: 'bookmarks invalid' };
  }

  if (input.recents && (!Array.isArray(input.recents) || input.recents.length > 200)) {
    return { ok: false, error: 'recents invalid' };
  }

  if (input.searchHistory && (!Array.isArray(input.searchHistory) || input.searchHistory.length > 100)) {
    return { ok: false, error: 'searchHistory invalid' };
  }

  if (input.progress && !ensurePlainObject(input.progress)) {
    return { ok: false, error: 'progress invalid' };
  }

  if (input.theme && !ensurePlainObject(input.theme)) {
    return { ok: false, error: 'theme invalid' };
  }

  if (input.viewerPrefs && !ensurePlainObject(input.viewerPrefs)) {
    return { ok: false, error: 'viewerPrefs invalid' };
  }

  if (input.viewerPrefs && Object.keys(input.viewerPrefs).length > 80) {
    return { ok: false, error: 'viewerPrefs too large' };
  }

  if (input.syncPolicy && !ensurePlainObject(input.syncPolicy)) {
    return { ok: false, error: 'syncPolicy invalid' };
  }

  if (input.syncPolicy && Array.isArray(input.syncPolicy.devices) && input.syncPolicy.devices.length > 20) {
    return { ok: false, error: 'syncPolicy devices invalid' };
  }

  return { ok: true };
}

function validateDeviceState(input) {
  if (!ensurePlainObject(input)) {
    return { ok: false, error: 'device state must be an object' };
  }

  if (jsonSizeOf(input) > 512 * 1024) {
    return { ok: false, error: 'device state too large' };
  }

  if (input.deviceId && !/^[a-zA-Z0-9_-]{8,120}$/.test(String(input.deviceId))) {
    return { ok: false, error: 'deviceId invalid' };
  }

  if (input.collapsedFolders && (!Array.isArray(input.collapsedFolders) || input.collapsedFolders.length > 5000)) {
    return { ok: false, error: 'collapsedFolders invalid' };
  }

  if (input.theme && !ensurePlainObject(input.theme)) {
    return { ok: false, error: 'theme invalid' };
  }

  if (input.theme && ensurePlainObject(input.theme.themes) && Object.keys(input.theme.themes).length > 20) {
    return { ok: false, error: 'theme too large' };
  }

  if (input.prefs && (!ensurePlainObject(input.prefs) || Object.keys(input.prefs).length > 80)) {
    return { ok: false, error: 'prefs invalid' };
  }

  return { ok: true };
}

module.exports = {
  STATE_NORMALIZER_VALIDATION_SPLIT_PASS,
  validateSharedState,
  validateDeviceState
};
