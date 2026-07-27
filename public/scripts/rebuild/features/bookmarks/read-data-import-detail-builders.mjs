import { createReadDataTitleResolver, formatDate, isOpaqueReadDataIdentifier, labelForSnapshot, shortReadDataIdentifier } from './read-data-model.mjs';
import { arrayToKeyMap, itemTimestamp, uniqueList } from './read-data-import-array-merge.mjs';
import { normalizeProgressMerge, progressSnapshotMap } from './read-data-import-progress-merge.mjs';
import { createUserTagRecords, normalizeUserTagRecords, userTagRecordKey } from './read-data-import-user-tags.mjs';

const READ_DATA_IMPORT_DETAIL_BUILDERS_SPLIT_PASS = 'v193-read-data-import-detail-builders-pass';

export function normalizeReadDataPayload(data = {}) {
  return {
    progress: data.progress && typeof data.progress === 'object' ? normalizeProgressMerge({}, data.progress) : { lastRead: null, byNovel: {}, positions: {}, readMeta: {} },
    bookmarks: Array.isArray(data.bookmarks) ? data.bookmarks.filter(item => item && typeof item === 'object') : [],
    recents: Array.isArray(data.recents) ? data.recents.filter(item => item && typeof item === 'object') : [],
    favorites: Array.isArray(data.favorites) ? data.favorites.map(String).filter(Boolean) : [],
    userTagRecords: normalizeUserTagRecords(data)
  };
}

export function createReadDataSnapshot(app) {
  return {
    progress: normalizeProgressMerge({}, app.state.progress || {}),
    bookmarks: [...(app.state.bookmarks || [])],
    recents: [...(app.state.recents || [])],
    favorites: Array.from(app.state.favorites || []),
    userTags: Array.from(app.state.userTags || []),
    novelUserTags: { ...(app.state.novelUserTags || {}) },
    userTagRecords: createUserTagRecords(app.state.userTags || [], app.state.novelUserTags || {})
  };
}

export function buildProgressImportDetail(app, currentProgress, incomingProgress) {
  const resolver = createReadDataTitleResolver(app);
  return buildMapImportDetail(app, progressSnapshotMap(currentProgress), progressSnapshotMap(incomingProgress), item => labelForSnapshot(app, item, resolver));
}

export function buildArrayImportDetail(app, currentList, incomingList, keyFn) {
  const resolver = createReadDataTitleResolver(app);
  return buildMapImportDetail(app, arrayToKeyMap(currentList || [], keyFn), arrayToKeyMap(incomingList || [], keyFn), item => resolver.resolve(item).label);
}


export function buildUserTagImportDetail(app, currentRecords, incomingRecords) {
  const current = new Map(normalizeUserTagRecords({ userTagRecords:currentRecords }).map(item => [userTagRecordKey(item), item]));
  const incoming = new Map(normalizeUserTagRecords({ userTagRecords:incomingRecords }).map(item => [userTagRecordKey(item), item]));
  const added = [];
  const conflicts = [];
  const stale = [];
  incoming.forEach((incomingItem, key) => {
    const currentItem = current.get(key) || null;
    const staleNovelIds = (incomingItem.novelIds || []).filter(novelId => !app.state.novelById?.has?.(novelId));
    const entry = {
      key:String(key),
      label:`#${incomingItem.tag} · ${(incomingItem.novelIds || []).length}개 작품`,
      current:currentItem,
      incoming:incomingItem,
      staleNovelIds
    };
    if (currentItem) conflicts.push(entry);
    else added.push(entry);
    if (staleNovelIds.length) stale.push(entry);
  });
  return { current:current.size, incoming:incoming.size, added, conflicts, stale };
}
export function buildFavoriteImportDetail(app, currentFavorites, incomingFavorites) {
  const current = new Map((currentFavorites || []).map(id => [String(id), { novelId: String(id), id: String(id) }]));
  const incoming = new Map((incomingFavorites || []).map(id => [String(id), { novelId: String(id), id: String(id) }]));
  const resolver = createReadDataTitleResolver(app);
  return buildMapImportDetail(app, current, incoming, item => resolver.resolve(item).label);
}

function buildMapImportDetail(app, current, incoming, labelFn) {
  const added = [];
  const conflicts = [];
  const stale = [];
  incoming.forEach((incomingItem, key) => {
    const currentItem = current.get(key) || null;
    const entry = {
      key: String(key),
      label: formatImportEntryLabel(app, incomingItem, key, labelFn),
      current: currentItem,
      incoming: incomingItem
    };
    if (currentItem) conflicts.push(entry);
    else added.push(entry);
    const novelId = incomingItem?.novelId || String(key).split(':')[0] || '';
    if (novelId && !app.state.novelById?.has?.(novelId)) stale.push(entry);
  });
  return { current: current.size, incoming: incoming.size, added, conflicts, stale };
}

export function detailToSummary(detail) {
  return {
    current: detail.current || 0,
    incoming: detail.incoming || 0,
    added: detail.added?.length || 0,
    conflict: detail.conflicts?.length || 0,
    stale: detail.stale?.length || 0,
    staleList: uniqueList((detail.stale || []).flatMap(entry => entry.staleNovelIds?.length ? entry.staleNovelIds : [entry.incoming?.novelId || entry.key.split(':')[0] || entry.key]))
  };
}

export function emptyImportDetail() {
  return { current: 0, incoming: 0, added: [], conflicts: [], stale: [] };
}

function formatImportEntryLabel(app, item, key, labelFn) {
  try {
    const label = labelFn?.(item);
    if (label) return String(label);
  } catch {}
  const novel = item?.novelId ? app.state.novelById?.get?.(item.novelId) : null;
  const direct = item?.title || item?.label || novel?.title || '';
  if (direct && !isOpaqueReadDataIdentifier(direct)) return String(direct);
  const raw = String(item?.novelId || key || '');
  return raw ? `목록에서 찾을 수 없는 작품${shortReadDataIdentifier(raw) ? ` · ${shortReadDataIdentifier(raw)}` : ''}` : '항목';
}

export function formatDetailTimestamp(item) {
  if (!item) return '없음';
  const ts = itemTimestamp(item);
  return ts ? formatDate(ts) : '시간 없음';
}

export function summarizeProgressImport(app, currentProgress, incomingProgress) {
  const current = progressSnapshotMap(currentProgress);
  const incoming = progressSnapshotMap(incomingProgress);
  return summarizeMapImport(app, current, incoming);
}

export function summarizeArrayImport(app, currentList, incomingList, keyFn) {
  return summarizeMapImport(app, arrayToKeyMap(currentList || [], keyFn), arrayToKeyMap(incomingList || [], keyFn));
}

export function summarizeFavoriteImport(app, currentFavorites, incomingFavorites) {
  const current = new Map((currentFavorites || []).map(id => [String(id), { novelId: String(id) }]));
  const incoming = new Map((incomingFavorites || []).map(id => [String(id), { novelId: String(id) }]));
  return summarizeMapImport(app, current, incoming);
}

function summarizeMapImport(app, current, incoming) {
  const staleList = [];
  let conflict = 0;
  let added = 0;
  incoming.forEach((item, key) => {
    if (current.has(key)) conflict += 1;
    else added += 1;
    const novelId = item?.novelId || String(key).split(':')[0] || '';
    if (novelId && !app.state.novelById?.has?.(novelId)) staleList.push(novelId);
  });
  const uniqueStale = uniqueList(staleList);
  return { current: current.size, incoming: incoming.size, added, conflict, stale: uniqueStale.length, staleList: uniqueStale };
}

export function emptyImportSummary() {
  return { current: 0, incoming: 0, added: 0, conflict: 0, stale: 0, staleList: [] };
}

export function formatImportSummary(item) {
  return `현재 ${item.current} · 가져올 항목 ${item.incoming} · 신규 ${item.added} · 충돌 ${item.conflict} · 목록 없음 ${item.stale}`;
}

export function formatLimitedList(list, max = 8) {
  const unique = uniqueList(list);
  const values = unique.slice(0, max).map(value => isOpaqueReadDataIdentifier(value) ? shortReadDataIdentifier(value) : value);
  const suffix = unique.length > max ? ` 외 ${unique.length - max}개` : '';
  return values.join(', ') + suffix;
}

export { READ_DATA_IMPORT_DETAIL_BUILDERS_SPLIT_PASS };
