import { getStorageScope } from './storage.mjs';
const PROGRESS_DB_NAME = 'txt-reader-progress-state';
const PROGRESS_DB_VERSION = 1;
const PROGRESS_STORE_NAME = 'progress';
const PROGRESS_STATE_KEY_PREFIX = 'current';
const LOCAL_FULL_PROGRESS_MAX_BYTES = 512 * 1024;

let openPromise = null;
let pendingProgress = null;
let pendingDeferred = null;
let pendingTimer = null;
let writeInFlight = false;
let localFallbackCache = null;
const PROGRESS_WRITE_DEBOUNCE_MS = 1500;

export const PROGRESS_INDEXED_DB_PASS = 'v612-progress-indexeddb-persistence-pass';
export const PROGRESS_LOCAL_FALLBACK_PASS = 'v612-progress-local-fallback-pass';
export const PROGRESS_INDEXED_DB_COALESCE_PASS = 'v612-progress-indexeddb-coalesce-pass';
export const PROGRESS_USER_SCOPE_PASS = 'v613-progress-user-scope-pass';
export const PROGRESS_BOUNDED_LOCAL_COMPACTION_PASS = 'v674-progress-bounded-local-compaction-pass';
export const PROGRESS_INCREMENTAL_LOCAL_FALLBACK_PASS = 'v674-progress-incremental-local-fallback-pass';

export function isProgressIndexedDbAvailable() {
  return typeof indexedDB !== 'undefined' && indexedDB && typeof indexedDB.open === 'function';
}

function safeProgress(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return {
    lastRead: source.lastRead && typeof source.lastRead === 'object' ? source.lastRead : null,
    byNovel: source.byNovel && typeof source.byNovel === 'object' && !Array.isArray(source.byNovel) ? source.byNovel : {},
    positions: source.positions && typeof source.positions === 'object' && !Array.isArray(source.positions) ? source.positions : {},
    readMeta: source.readMeta && typeof source.readMeta === 'object' && !Array.isArray(source.readMeta) ? source.readMeta : {}
  };
}

function selectBoundedEntries(record = {}, limit = 0, retainedKeys = null) {
  const capacity = Math.max(0, Math.floor(Number(limit) || 0));
  if (!capacity) return [];
  const source = record || {};
  const keys = Object.keys(source);
  const length = keys.length;
  if (!length) return [];
  const timestamps = new Float64Array(length);
  const retained = new Uint8Array(length);
  const indexes = new Int32Array(length);
  for (let index = 0; index < length; index += 1) {
    indexes[index] = index;
    timestamps[index] = Number(source[keys[index]]?.ts) || 0;
    retained[index] = retainedKeys?.has(keys[index]) ? 1 : 0;
  }
  const compareBestFirst = (left, right) => {
    if (retained[left] !== retained[right]) return retained[left] ? -1 : 1;
    if (timestamps[left] !== timestamps[right]) return timestamps[left] > timestamps[right] ? -1 : 1;
    return left - right;
  };
  const swap = (left, right) => {
    const value = indexes[left];
    indexes[left] = indexes[right];
    indexes[right] = value;
  };
  const medianPivot = (left, right) => {
    const middle = left + Math.floor((right - left) / 2);
    const trio = [indexes[left], indexes[middle], indexes[right]].sort(compareBestFirst);
    return trio[1];
  };
  const selectedLength = Math.min(capacity, length);
  if (selectedLength < length) {
    let left = 0;
    let right = length - 1;
    const target = selectedLength - 1;
    while (left < right) {
      const pivotValue = medianPivot(left, right);
      let pivotIndex = right;
      for (let index = left; index <= right; index += 1) {
        if (indexes[index] === pivotValue) { pivotIndex = index; break; }
      }
      swap(pivotIndex, right);
      let store = left;
      for (let index = left; index < right; index += 1) {
        if (compareBestFirst(indexes[index], pivotValue) < 0) {
          swap(index, store);
          store += 1;
        }
      }
      swap(store, right);
      if (store === target) break;
      if (store < target) left = store + 1;
      else right = store - 1;
    }
  }
  const selected = indexes.slice(0, selectedLength);
  selected.sort(compareBestFirst);
  return Array.from(selected, index => [keys[index], source[keys[index]]]);
}

function newestEntries(record = {}, limit = 0) {
  return selectBoundedEntries(record, limit);
}

function newestPositionEntries(record = {}, retainedKeys = new Set(), limit = 0) {
  return selectBoundedEntries(record, limit, retainedKeys);
}

function positionKeysForSnapshot(snapshot) {
  if (!snapshot?.novelId) return [];
  const episodeId = snapshot.episodeId || 'single';
  const keys = [`pos-${snapshot.novelId}-${episodeId}`];
  if (Number.isFinite(Number(snapshot.chunk))) keys.push(`pos-${snapshot.novelId}-${episodeId}-${Math.max(1, Math.floor(Number(snapshot.chunk)))}`);
  return keys;
}

export function compactProgressForLocalStorage(input = {}, limits = {}) {
  const source = safeProgress(input);
  const byNovelLimit = Math.max(20, Number(limits.byNovel) || 300);
  const readMetaLimit = Math.max(40, Number(limits.readMeta) || 800);
  const positionsLimit = Math.max(80, Number(limits.positions) || 1400);
  const byNovelEntries = newestEntries(source.byNovel, byNovelLimit);
  const readMetaEntries = newestEntries(source.readMeta, readMetaLimit);
  const retainedPositionKeys = new Set(positionKeysForSnapshot(source.lastRead));
  for (const [, snapshot] of byNovelEntries) positionKeysForSnapshot(snapshot).forEach(key => retainedPositionKeys.add(key));
  for (const [, snapshot] of readMetaEntries) positionKeysForSnapshot(snapshot).forEach(key => retainedPositionKeys.add(key));

  const positionEntries = newestPositionEntries(source.positions, retainedPositionKeys, positionsLimit);
  const positions = {};
  for (const [key, value] of positionEntries) {
    positions[key] = value;
  }

  return {
    lastRead: source.lastRead,
    byNovel: Object.fromEntries(byNovelEntries),
    readMeta: Object.fromEntries(readMetaEntries),
    positions,
    persistence: {
      pass: PROGRESS_LOCAL_FALLBACK_PASS,
      selectionPass: PROGRESS_BOUNDED_LOCAL_COMPACTION_PASS,
      selectionAlgorithm: 'bounded-quickselect',
      compacted: true,
      sourceCounts: {
        byNovel: Object.keys(source.byNovel).length,
        readMeta: Object.keys(source.readMeta).length,
        positions: Object.keys(source.positions).length
      }
    }
  };
}

function serializeProgressPayload(value) {
  try {
    const text = JSON.stringify(value);
    const bytes = typeof TextEncoder === 'function'
      ? new TextEncoder().encode(text).byteLength
      : new Blob([text]).size;
    return { serialized:text, bytes };
  } catch {
    return { serialized:'', bytes:Number.POSITIVE_INFINITY };
  }
}

function definitelyExceedsLocalProgressBudget(input = {}) {
  const source = safeProgress(input);
  // Each emitted object entry needs at least the UTF-8 key bytes plus two
  // quotes, a colon, a one-byte value, and (except for the final entry) a
  // comma. String length is a conservative lower bound for UTF-8 byte length.
  let minimumBytes = 32;
  for (const record of [source.byNovel, source.readMeta, source.positions]) {
    for (const key in record) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
      const value = record[key];
      if (value === undefined || typeof value === 'function' || typeof value === 'symbol') continue;
      minimumBytes += String(key).length + 5;
      if (minimumBytes > LOCAL_FULL_PROGRESS_MAX_BYTES) return true;
    }
  }
  return false;
}

function compactProgressToBudget(progress = {}) {
  let limits = { byNovel:300, readMeta:800, positions:1400 };
  let payload = compactProgressForLocalStorage(progress, limits);
  let serialized = serializeProgressPayload(payload);
  while (serialized.bytes > LOCAL_FULL_PROGRESS_MAX_BYTES && (limits.byNovel > 20 || limits.readMeta > 40 || limits.positions > 80)) {
    limits = {
      byNovel:Math.max(20, Math.floor(limits.byNovel * 0.72)),
      readMeta:Math.max(40, Math.floor(limits.readMeta * 0.72)),
      positions:Math.max(80, Math.floor(limits.positions * 0.72))
    };
    payload = compactProgressForLocalStorage(progress, limits);
    serialized = serializeProgressPayload(payload);
  }
  if (serialized.bytes > LOCAL_FULL_PROGRESS_MAX_BYTES) {
    const source = safeProgress(progress);
    payload = {
      lastRead:source.lastRead,
      byNovel:source.lastRead?.novelId ? { [source.lastRead.novelId]:source.lastRead } : {},
      readMeta:{},
      positions:{},
      persistence:{ pass:PROGRESS_LOCAL_FALLBACK_PASS, compacted:true, minimal:true }
    };
    serialized = serializeProgressPayload(payload);
  }
  return { payload, compacted:true, bytes:serialized.bytes, serialized:serialized.serialized };
}

function chooseFullLocalProgressPayload(progress = {}) {
  const fullBytes = definitelyExceedsLocalProgressBudget(progress)
    ? Number.POSITIVE_INFINITY
    : null;
  if (fullBytes !== Number.POSITIVE_INFINITY) {
    const full = serializeProgressPayload(progress);
    if (full.bytes <= LOCAL_FULL_PROGRESS_MAX_BYTES) {
      return { payload:progress, compacted:false, bytes:full.bytes, serialized:full.serialized };
    }
  }
  return compactProgressToBudget(progress);
}

function cacheSelectedLocalPayload(scope, selected) {
  if (!selected?.serialized) return null;
  try {
    localFallbackCache = {
      scope:String(scope || 'anonymous'),
      payload:JSON.parse(selected.serialized),
      compacted:selected.compacted === true,
      bytes:selected.bytes
    };
    return localFallbackCache;
  } catch {
    localFallbackCache = null;
    return null;
  }
}

export function primeLocalProgressFallback(progress = {}, scope = getStorageScope()) {
  const selected = chooseFullLocalProgressPayload(progress);
  if (progress?.persistence?.compacted === true) selected.compacted = true;
  cacheSelectedLocalPayload(scope, selected);
  return {
    ok:!!localFallbackCache,
    compacted:selected.compacted,
    bytes:selected.bytes,
    pass:PROGRESS_INCREMENTAL_LOCAL_FALLBACK_PASS
  };
}

function enforceIncrementalFallbackBounds(payload) {
  let byNovelEntries = Object.entries(payload.byNovel);
  if (byNovelEntries.length > 300) byNovelEntries = selectBoundedEntries(payload.byNovel, 300);
  let readMetaEntries = Object.entries(payload.readMeta);
  if (readMetaEntries.length > 800) readMetaEntries = selectBoundedEntries(payload.readMeta, 800);
  payload.byNovel = Object.fromEntries(byNovelEntries);
  payload.readMeta = Object.fromEntries(readMetaEntries);
  const retainedPositionKeys = new Set(positionKeysForSnapshot(payload.lastRead));
  for (const [, value] of byNovelEntries) positionKeysForSnapshot(value).forEach(key => retainedPositionKeys.add(key));
  for (const [, value] of readMetaEntries) positionKeysForSnapshot(value).forEach(key => retainedPositionKeys.add(key));
  if (Object.keys(payload.positions).length > 1400) {
    payload.positions = Object.fromEntries(selectBoundedEntries(payload.positions, 1400, retainedPositionKeys));
  }
  return payload;
}

function updateIncrementalLocalFallback(snapshot, scope = getStorageScope()) {
  const normalizedScope = String(scope || 'anonymous');
  if (!snapshot?.novelId) return null;
  if (!localFallbackCache || localFallbackCache.scope !== normalizedScope) {
    localFallbackCache = {
      scope:normalizedScope,
      payload:{ lastRead:null, byNovel:{}, readMeta:{}, positions:{} },
      compacted:true,
      bytes:0
    };
  }
  const payload = safeProgress(localFallbackCache.payload);
  const copy = { ...snapshot };
  const novelId = String(copy.novelId);
  const episodeId = copy.episodeId || 'single';
  const progressKey = `${novelId}-${episodeId}`;
  payload.lastRead = copy;
  payload.byNovel[novelId] = copy;
  payload.readMeta[progressKey] = {
    ...copy,
    documentRatio:copy.episodeDocumentRatio ?? copy.documentRatio
  };
  payload.positions[`pos-${novelId}-${episodeId}`] = {
    globalBlockIndex:copy.globalBlockIndex,
    documentRatio:copy.episodeDocumentRatio ?? copy.documentRatio,
    fallbackChunk:copy.chunk,
    fallbackRatio:copy.ratio,
    ts:copy.ts
  };
  if (Number.isFinite(Number(copy.chunk))) {
    payload.positions[`pos-${novelId}-${episodeId}-${copy.chunk}`] = Number(copy.ratio).toFixed(4);
  }
  payload.persistence = {
    pass:PROGRESS_LOCAL_FALLBACK_PASS,
    selectionPass:PROGRESS_INCREMENTAL_LOCAL_FALLBACK_PASS,
    selectionAlgorithm:'incremental-bounded-snapshot',
    compacted:localFallbackCache.compacted === true
  };
  if (localFallbackCache.compacted === true) enforceIncrementalFallbackBounds(payload);

  let selected = { payload, compacted:localFallbackCache.compacted === true, ...serializeProgressPayload(payload) };
  if (selected.bytes > LOCAL_FULL_PROGRESS_MAX_BYTES) selected = compactProgressToBudget(payload);
  cacheSelectedLocalPayload(normalizedScope, selected);
  if (!localFallbackCache) return selected;
  return {
    payload:localFallbackCache.payload,
    compacted:localFallbackCache.compacted,
    bytes:localFallbackCache.bytes,
    serialized:selected.serialized,
    incremental:true,
    pass:PROGRESS_INCREMENTAL_LOCAL_FALLBACK_PASS
  };
}

export function chooseLocalProgressPayload(progress = {}, options = {}) {
  if (options.recentSnapshot) {
    const incremental = updateIncrementalLocalFallback(options.recentSnapshot, options.scope || getStorageScope());
    if (incremental) return incremental;
  }
  const selected = chooseFullLocalProgressPayload(progress);
  cacheSelectedLocalPayload(options.scope || getStorageScope(), selected);
  return selected;
}

function progressStateKey(scope = getStorageScope()) {
  return `${PROGRESS_STATE_KEY_PREFIX}::${String(scope || 'anonymous')}`;
}

function openProgressDb() {
  if (!isProgressIndexedDbAvailable()) return Promise.resolve(null);
  if (openPromise) return openPromise;
  openPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(PROGRESS_DB_NAME, PROGRESS_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROGRESS_STORE_NAME)) db.createObjectStore(PROGRESS_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('progress IndexedDB open failed'));
    request.onblocked = () => reject(new Error('progress IndexedDB open blocked'));
  }).catch(error => {
    openPromise = null;
    throw error;
  });
  return openPromise;
}

async function writeProgressState(progress, scope = getStorageScope()) {
  const db = await openProgressDb();
  if (!db) return { ok:false, unavailable:true, pass:PROGRESS_INDEXED_DB_PASS };
  // IDB clones the value at put(); avoid a redundant full structuredClone on
  // the UI thread before handing the snapshot to the database.
  const payload = { progress:safeProgress(progress), updatedAt:Date.now(), pass:PROGRESS_INDEXED_DB_PASS };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROGRESS_STORE_NAME, 'readwrite');
    payload.userScope = String(scope || 'anonymous');
    tx.objectStore(PROGRESS_STORE_NAME).put(payload, progressStateKey(scope));
    tx.oncomplete = () => resolve({ ok:true, pass:PROGRESS_INDEXED_DB_PASS, updatedAt:payload.updatedAt });
    tx.onerror = () => reject(tx.error || new Error('progress IndexedDB write failed'));
    tx.onabort = () => reject(tx.error || new Error('progress IndexedDB write aborted'));
  });
}

function schedulePendingProgressWrite(delay = PROGRESS_WRITE_DEBOUNCE_MS) {
  if (pendingTimer || writeInFlight || !pendingProgress) return;
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    flushPendingProgressWrite();
  }, Math.max(0, delay));
}

async function flushPendingProgressWrite() {
  if (writeInFlight || !pendingProgress) return;
  writeInFlight = true;
  const pending = pendingProgress;
  const progress = pending.progress;
  const scope = pending.scope;
  const deferred = pendingDeferred;
  pendingProgress = null;
  pendingDeferred = null;
  try {
    const result = await writeProgressState(progress, scope);
    deferred?.resolve(result);
  } catch (error) {
    deferred?.reject(error);
  } finally {
    writeInFlight = false;
    if (pendingProgress) schedulePendingProgressWrite(0);
  }
}

export function queueProgressStateSave(progress, options = {}) {
  if (!isProgressIndexedDbAvailable()) return Promise.resolve({ ok:false, unavailable:true, pass:PROGRESS_INDEXED_DB_PASS });
  const scope = getStorageScope();
  if (pendingProgress && pendingProgress.scope !== scope) void flushPendingProgressWrite();
  pendingProgress = { progress, scope };
  if (!pendingDeferred) {
    pendingDeferred = {};
    pendingDeferred.promise = new Promise((resolve, reject) => {
      pendingDeferred.resolve = resolve;
      pendingDeferred.reject = reject;
    });
  }
  const operation = pendingDeferred.promise;
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = null;
  if (options.immediate === true && !writeInFlight) void flushPendingProgressWrite();
  else schedulePendingProgressWrite();
  return operation;
}

export async function loadProgressStateFromIndexedDb() {
  const db = await openProgressDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROGRESS_STORE_NAME, 'readonly');
    const request = tx.objectStore(PROGRESS_STORE_NAME).get(progressStateKey());
    request.onsuccess = () => resolve(request.result?.progress ? safeProgress(request.result.progress) : null);
    request.onerror = () => reject(request.error || new Error('progress IndexedDB read failed'));
  });
}

export function resetProgressStorageRuntime() {
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = null;
  pendingProgress = null;
  pendingDeferred?.resolve({ ok:false, reset:true, pass:PROGRESS_USER_SCOPE_PASS });
  pendingDeferred = null;
  localFallbackCache = null;
  writeInFlight = false;
  if (openPromise) {
    Promise.resolve(openPromise).then(db => { try { db?.close?.(); } catch {} }).catch(() => {});
  }
  openPromise = null;
}

export async function deleteLegacyUnscopedProgressState() {
  const db = await openProgressDb();
  if (!db) return false;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROGRESS_STORE_NAME, 'readwrite');
    tx.objectStore(PROGRESS_STORE_NAME).delete(PROGRESS_STATE_KEY_PREFIX);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error('legacy progress cleanup failed'));
    tx.onabort = () => reject(tx.error || new Error('legacy progress cleanup aborted'));
  });
}
