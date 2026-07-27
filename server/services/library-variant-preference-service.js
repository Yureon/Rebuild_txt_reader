'use strict';

const { loadJsonWithBackup, atomicWriteJsonAsync } = require('../repositories/json-file-store');

const LIBRARY_VARIANT_PREFERENCE_PASS = 'v642-library-variant-preference-pass';
const SCHEMA_VERSION = 1;

function cleanKey(value, limit = 512) {
  return String(value || '').normalize('NFKC').trim().slice(0, limit);
}

function pairKey(left, right) {
  const ids = [cleanKey(left, 200), cleanKey(right, 200)].filter(Boolean).sort();
  return ids.length === 2 && ids[0] !== ids[1] ? `${ids[0]}\0${ids[1]}` : '';
}

function normalizeState(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const representatives = {};
  const exclusions = {};
  for (const [groupKey, novelId] of Object.entries(input.representatives || {})) {
    const key = cleanKey(groupKey);
    const id = cleanKey(novelId, 200);
    if (key && id) representatives[key] = id;
  }
  for (const [key, enabled] of Object.entries(input.exclusions || {})) {
    const normalized = cleanKey(key);
    if (normalized && enabled === true) exclusions[normalized] = true;
  }
  return {
    schemaVersion:SCHEMA_VERSION,
    updatedAt:Math.max(0, Number(input.updatedAt) || 0),
    representatives,
    exclusions
  };
}

function createLibraryVariantPreferenceService(options = {}) {
  const storePath = String(options.storePath || '').trim();
  const logger = options.logger || console;
  if (!storePath) throw new Error('library variant preference storePath is required');
  const loaded = loadJsonWithBackup(storePath, null);
  let state = normalizeState(loaded.data);
  let revision = 1;
  let dirty = false;
  let flushPromise = Promise.resolve();

  function snapshot() {
    return JSON.parse(JSON.stringify(state));
  }

  function getRevision() { return revision; }
  function getRepresentative(groupKey) {
    return state.representatives[cleanKey(groupKey)] || '';
  }
  function isExcluded(leftId, rightId) {
    const key = pairKey(leftId, rightId);
    return !!(key && state.exclusions[key]);
  }
  function list() {
    return { pass:LIBRARY_VARIANT_PREFERENCE_PASS, revision, ...snapshot() };
  }

  function mutate(fn) {
    const changed = fn(state) === true;
    if (!changed) return false;
    state.updatedAt = Date.now();
    dirty = true;
    revision += 1;
    return true;
  }

  async function flush() {
    if (!dirty) return true;
    const value = snapshot();
    dirty = false;
    flushPromise = flushPromise.then(() => atomicWriteJsonAsync(storePath, value)).catch(error => {
      dirty = true;
      logger.warn?.('library variant preference flush failed:', error && error.message || error);
      throw error;
    });
    await flushPromise;
    return true;
  }

  async function setRepresentative(groupKey, novelId) {
    const key = cleanKey(groupKey);
    const id = cleanKey(novelId, 200);
    if (!key || !id) throw Object.assign(new Error('groupKey and novelId are required'), { code:'LIBRARY_VARIANT_PREFERENCE_INVALID' });
    mutate(current => {
      if (current.representatives[key] === id) return false;
      current.representatives[key] = id;
      return true;
    });
    await flush();
    return list();
  }

  async function clearRepresentative(groupKey) {
    const key = cleanKey(groupKey);
    if (!key) return list();
    mutate(current => {
      if (!Object.prototype.hasOwnProperty.call(current.representatives, key)) return false;
      delete current.representatives[key];
      return true;
    });
    await flush();
    return list();
  }

  async function setExcluded(leftId, rightId, excluded = true) {
    const key = pairKey(leftId, rightId);
    if (!key) throw Object.assign(new Error('two distinct novel ids are required'), { code:'LIBRARY_VARIANT_PREFERENCE_INVALID' });
    mutate(current => {
      if (excluded) {
        if (current.exclusions[key] === true) return false;
        current.exclusions[key] = true;
        return true;
      }
      if (!Object.prototype.hasOwnProperty.call(current.exclusions, key)) return false;
      delete current.exclusions[key];
      return true;
    });
    await flush();
    return list();
  }

  async function stop() {
    try { await flush(); return { ok:true, pass:LIBRARY_VARIANT_PREFERENCE_PASS }; }
    catch (error) { return { ok:false, pass:LIBRARY_VARIANT_PREFERENCE_PASS, error:String(error && error.message || error) }; }
  }

  return {
    pass:LIBRARY_VARIANT_PREFERENCE_PASS,
    getRevision,
    getRepresentative,
    isExcluded,
    list,
    setRepresentative,
    clearRepresentative,
    setExcluded,
    flush,
    stop,
    pairKey
  };
}

module.exports = {
  LIBRARY_VARIANT_PREFERENCE_PASS,
  createLibraryVariantPreferenceService,
  pairKey
};
