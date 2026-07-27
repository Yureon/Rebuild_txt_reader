import { isSafeStateRecordKey, normalizeNovelUserTags, normalizeUserTagList } from '../../state/app-state.mjs';
import { resolveImportChoice } from './read-data-import-array-merge.mjs';

export const READ_DATA_IMPORT_USER_TAGS_PASS = 'v601-read-data-import-user-tags-pass';

function tagKey(value) {
  return String(value || '').trim().toLocaleLowerCase('ko-KR');
}

function normalizeNovelIds(input = []) {
  return Array.from(new Set((Array.isArray(input) ? input : [])
    .map(value => String(value || '').trim())
    .filter(isSafeStateRecordKey)))
    .slice(0, 5000);
}

export function createUserTagRecords(userTags = [], novelUserTags = {}) {
  const definitions = normalizeUserTagList(userTags);
  const assignments = normalizeNovelUserTags(novelUserTags, definitions);
  const byKey = new Map(definitions.map(tag => [tagKey(tag), { tag, novelIds: [] }]));
  for (const [novelId, tags] of Object.entries(assignments)) {
    for (const tag of tags) {
      const record = byKey.get(tagKey(tag));
      if (record) record.novelIds.push(String(novelId));
    }
  }
  return Array.from(byKey.values()).map(record => ({
    tag: record.tag,
    novelIds: normalizeNovelIds(record.novelIds)
  }));
}

export function normalizeUserTagRecords(data = {}) {
  if (Array.isArray(data.userTagRecords)) {
    const definitions = normalizeUserTagList(data.userTagRecords.map(item => item?.tag));
    const canonical = new Map(definitions.map(tag => [tagKey(tag), tag]));
    return definitions.map(tag => {
      const source = data.userTagRecords.find(item => tagKey(item?.tag) === tagKey(tag));
      return { tag: canonical.get(tagKey(tag)) || tag, novelIds: normalizeNovelIds(source?.novelIds) };
    });
  }
  return createUserTagRecords(data.userTags, data.novelUserTags);
}

export function userTagRecordKey(item = {}) {
  return tagKey(item.tag);
}

export function applyUserTagImport(current = [], incoming = [], policy = 'merge', overrides = {}) {
  const currentMap = new Map(normalizeUserTagRecords({ userTagRecords: current }).map(item => [userTagRecordKey(item), item]));
  const incomingMap = new Map(normalizeUserTagRecords({ userTagRecords: incoming }).map(item => [userTagRecordKey(item), item]));
  if (policy === 'skip') return Array.from(currentMap.values());

  const out = policy === 'replace' ? new Map() : new Map(currentMap);
  for (const [key, incomingItem] of incomingMap) {
    const currentItem = currentMap.get(key) || null;
    const override = overrides && Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : null;
    const choice = resolveImportChoice(policy, override, currentItem, incomingItem);
    if (choice === 'current') {
      if (currentItem) out.set(key, currentItem);
      continue;
    }
    if (policy === 'merge' && !override && currentItem) {
      out.set(key, {
        tag: currentItem.tag || incomingItem.tag,
        novelIds: normalizeNovelIds([...(currentItem.novelIds || []), ...(incomingItem.novelIds || [])])
      });
      continue;
    }
    out.set(key, { tag: incomingItem.tag, novelIds: normalizeNovelIds(incomingItem.novelIds) });
  }
  return Array.from(out.values()).slice(0, 100);
}

export function userTagRecordsToState(records = []) {
  const normalized = normalizeUserTagRecords({ userTagRecords: records });
  const userTags = normalizeUserTagList(normalized.map(item => item.tag));
  const canonical = new Map(userTags.map(tag => [tagKey(tag), tag]));
  const novelUserTags = {};
  for (const record of normalized) {
    const tag = canonical.get(tagKey(record.tag));
    if (!tag) continue;
    for (const novelId of normalizeNovelIds(record.novelIds)) {
      const tags = novelUserTags[novelId] || (novelUserTags[novelId] = []);
      if (tags.length < 20 && !tags.some(value => tagKey(value) === tagKey(tag))) tags.push(tag);
    }
  }
  return { userTags, novelUserTags: normalizeNovelUserTags(novelUserTags, userTags) };
}
