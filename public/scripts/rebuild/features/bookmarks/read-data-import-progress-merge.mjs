import { progressKey } from './read-data-model.mjs';
import { itemTimestamp, resolveImportChoice } from './read-data-import-array-merge.mjs';

const READ_DATA_IMPORT_PROGRESS_MERGE_SPLIT_PASS = 'v193-read-data-import-progress-merge-pass';

export function applyProgressImport(current, incoming, policy, overrides = {}) {
  if (!overrides || !Object.keys(overrides).length) {
    if (policy === 'replace') return normalizeProgressMerge({}, incoming);
    if (policy === 'newer') return mergeProgressNewer(current, incoming);
    return normalizeProgressMerge(current, incoming);
  }
  const out = policy === 'replace'
    ? { lastRead: null, byNovel: {}, positions: {}, readMeta: {} }
    : normalizeProgressMerge({}, current || {});
  const currentMap = progressSnapshotMap(current || {});
  progressSnapshotMap(incoming || {}).forEach((incomingSnap, key) => {
    const currentSnap = currentMap.get(key);
    const choice = resolveImportChoice(policy, overrides[key], currentSnap, incomingSnap);
    if (choice === 'current') {
      if (currentSnap) setProgressSnapshot(out, key, currentSnap);
      return;
    }
    if (choice === 'newer') {
      setProgressSnapshot(out, key, !currentSnap || itemTimestamp(incomingSnap) >= itemTimestamp(currentSnap) ? incomingSnap : currentSnap);
      return;
    }
    if (choice === 'incoming') setProgressSnapshot(out, key, incomingSnap);
  });
  if (policy === 'replace') {
    if (incoming?.positions && typeof incoming.positions === 'object') out.positions = { ...incoming.positions };
    if (incoming?.lastRead && typeof incoming.lastRead === 'object') out.lastRead = incoming.lastRead;
  } else {
    if (incoming?.positions && typeof incoming.positions === 'object') Object.assign(out.positions, incoming.positions);
    if (policy === 'newer') {
      if (incoming?.lastRead && (!out.lastRead || itemTimestamp(incoming.lastRead) >= itemTimestamp(out.lastRead))) out.lastRead = incoming.lastRead;
    } else if (incoming?.lastRead && typeof incoming.lastRead === 'object') out.lastRead = incoming.lastRead;
  }
  return out;
}

export function mergeProgressNewer(current = {}, incoming = {}) {
  const out = normalizeProgressMerge({}, current);
  const currentMap = progressSnapshotMap(out);
  progressSnapshotMap(incoming).forEach((snap, key) => {
    const existing = currentMap.get(key);
    if (!existing || itemTimestamp(snap) >= itemTimestamp(existing)) setProgressSnapshot(out, key, snap);
  });
  if (incoming.lastRead && (!out.lastRead || itemTimestamp(incoming.lastRead) >= itemTimestamp(out.lastRead))) out.lastRead = incoming.lastRead;
  if (incoming.positions && typeof incoming.positions === 'object') Object.assign(out.positions, incoming.positions);
  return out;
}

export function progressSnapshotMap(progress = {}) {
  const map = new Map();
  Object.values(progress.byNovel || {}).forEach(snap => {
    if (!snap || typeof snap !== 'object' || !snap.novelId) return;
    map.set(progressKey(snap), snap);
  });
  Object.values(progress.readMeta || {}).forEach(snap => {
    if (!snap || typeof snap !== 'object' || !snap.novelId) return;
    map.set(progressKey(snap), snap);
  });
  return map;
}

export function setProgressSnapshot(progress, key, snap) {
  const normalized = { ...snap };
  const novelId = normalized.novelId;
  const episodeId = normalized.episodeId || null;
  if (!novelId) return;
  progress.byNovel = progress.byNovel || {};
  progress.readMeta = progress.readMeta || {};
  progress.byNovel[novelId] = normalized;
  progress.readMeta[key.replace('::', '-')] = normalized;
  progress.readMeta[`${novelId}-${episodeId || 'single'}`] = normalized;
}

export function normalizeProgressMerge(current = {}, incoming = {}) {
  const out = {
    lastRead: current.lastRead || null,
    byNovel: { ...(current.byNovel || {}) },
    positions: { ...(current.positions || {}) },
    readMeta: { ...(current.readMeta || {}) }
  };
  if (incoming.byNovel && typeof incoming.byNovel === 'object') Object.assign(out.byNovel, incoming.byNovel);
  if (incoming.positions && typeof incoming.positions === 'object') Object.assign(out.positions, incoming.positions);
  if (incoming.readMeta && typeof incoming.readMeta === 'object') Object.assign(out.readMeta, incoming.readMeta);
  if (incoming.lastRead && typeof incoming.lastRead === 'object') out.lastRead = incoming.lastRead;
  return out;
}

export { READ_DATA_IMPORT_PROGRESS_MERGE_SPLIT_PASS };
