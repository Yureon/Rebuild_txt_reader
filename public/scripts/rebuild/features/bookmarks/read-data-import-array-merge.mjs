const READ_DATA_IMPORT_ARRAY_MERGE_SPLIT_PASS = 'v193-read-data-import-array-merge-pass';

export function resolveImportChoice(policy, override, currentItem, incomingItem) {
  if (override === 'current' || override === 'incoming' || override === 'newer') return override;
  if (policy === 'skip') return 'current';
  if (policy === 'newer') return 'newer';
  if (policy === 'replace' || policy === 'merge') return 'incoming';
  return incomingItem ? 'incoming' : currentItem ? 'current' : 'incoming';
}

export function applyArrayImport(current, incoming, keyFn, policy, max, overrides = {}) {
  if (!overrides || !Object.keys(overrides).length) {
    if (policy === 'replace') return mergeByKey([], incoming || [], keyFn, max);
    if (policy === 'newer') return mergeByKeyPreferNewer(current || [], incoming || [], keyFn, max);
    return mergeByKey(current || [], incoming || [], keyFn, max);
  }
  const currentMap = arrayToKeyMap(current || [], keyFn);
  const byKey = policy === 'replace' ? new Map() : new Map(currentMap);
  (incoming || []).forEach(item => {
    const key = String(keyFn(item) || '');
    if (!key) return;
    const existing = currentMap.get(key);
    const choice = resolveImportChoice(policy, overrides[key], existing, item);
    if (choice === 'current') {
      if (existing) byKey.set(key, existing);
      return;
    }
    if (choice === 'newer') {
      byKey.set(key, !existing || itemTimestamp(item) >= itemTimestamp(existing) ? { ...existing, ...item } : existing);
      return;
    }
    if (choice === 'incoming') byKey.set(key, { ...existing, ...item });
  });
  return Array.from(byKey.values()).sort((a,b) => itemTimestamp(b) - itemTimestamp(a)).slice(0, max);
}

export function applyFavoriteImport(current, incoming, policy, overrides = {}) {
  const currentIds = Array.from(current || []).map(String).filter(Boolean);
  const incomingIds = Array.from(incoming || []).map(String).filter(Boolean);
  if (!overrides || !Object.keys(overrides).length) {
    if (policy === 'replace') return new Set(incomingIds.slice(0, 2000));
    return new Set([...currentIds, ...incomingIds].slice(0, 2000));
  }
  const out = new Set(policy === 'replace' ? [] : currentIds);
  incomingIds.forEach(id => {
    const currentExists = currentIds.includes(id);
    const choice = resolveImportChoice(policy, overrides[id], currentExists ? { id } : null, { id });
    if (choice === 'current') {
      if (currentExists) out.add(id);
      return;
    }
    if (choice === 'incoming' || choice === 'newer') out.add(id);
  });
  return new Set(Array.from(out).slice(0, 2000));
}

export function mergeByKeyPreferNewer(current, incoming, keyFn, max) {
  const byKey = new Map();
  [...current, ...incoming].forEach(item => {
    if (!item || typeof item !== 'object') return;
    const key = String(keyFn(item) || '');
    if (!key) return;
    const existing = byKey.get(key);
    if (!existing || itemTimestamp(item) >= itemTimestamp(existing)) byKey.set(key, { ...existing, ...item });
  });
  return Array.from(byKey.values()).sort((a,b) => itemTimestamp(b) - itemTimestamp(a)).slice(0, max);
}

export function mergeByKey(current, incoming, keyFn, max) {
  const byKey = new Map();
  [...current, ...incoming].forEach(item => {
    if (!item || typeof item !== 'object') return;
    const key = String(keyFn(item) || '');
    if (!key) return;
    byKey.set(key, { ...byKey.get(key), ...item });
  });
  return Array.from(byKey.values()).sort((a,b) => (b.ts || b.updatedAt || 0) - (a.ts || a.updatedAt || 0)).slice(0, max);
}

export function arrayToKeyMap(list, keyFn) {
  const map = new Map();
  (list || []).forEach(item => {
    const key = String(keyFn(item) || '');
    if (key) map.set(key, item);
  });
  return map;
}

export function bookmarkImportKey(item = {}) {
  return String(item.id || `${item.novelId || ''}:${item.episodeId || 'single'}:${item.globalBlockIndex ?? item.blockIndex ?? item.chunk ?? 1}:${item.charIndex ?? 0}`);
}

export function recentImportKey(item = {}) {
  return `${item.novelId || ''}:${item.episodeId || 'single'}`;
}

export function itemTimestamp(item = {}) {
  return Math.max(0, Number(item.updatedAt) || Number(item.ts) || 0);
}

export function uniqueList(list) {
  return Array.from(new Set((Array.isArray(list) ? list : []).map(String).filter(Boolean)));
}

export { READ_DATA_IMPORT_ARRAY_MERGE_SPLIT_PASS };
