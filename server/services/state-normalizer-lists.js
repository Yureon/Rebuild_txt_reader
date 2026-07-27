const {
  ensurePlainObject,
  isSafeRecordKey,
  firstDefined,
  sanitizeTextValue,
  clampNumber
} = require('./state-normalizer-core');

const STATE_NORMALIZER_LISTS_SPLIT_PASS = 'v202-server-state-normalizer-lists-split-pass';

function sanitizeBookmarkList(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  input.slice(0, 1000).forEach((item) => {
    if (!ensurePlainObject(item)) return;
    const novelId = sanitizeTextValue(item.novelId, 160, '');
    if (!novelId) return;

    const rawEpisodeId = item.episodeId == null || item.episodeId === '' || item.episodeId === 'single'
      ? null
      : sanitizeTextValue(item.episodeId, 160, '');
    const chunk = Math.max(1, Math.floor(clampNumber(firstDefined(item.chunk, item.chunkIndex), 1, 1000000, 1)));
    const totalChunks = Math.max(1, Math.floor(clampNumber(item.totalChunks, 1, 1000000, chunk)));
    const ratio = clampNumber(firstDefined(item.ratio, item.scrollRatio, item.documentRatio), 0, 1, 0);
    const ts = Math.max(0, Math.floor(clampNumber(firstDefined(item.ts, item.updatedAt, item.createdAt), 0, Date.now() + 86400000, Date.now())));
    const createdAt = Math.max(0, Math.floor(clampNumber(firstDefined(item.createdAt, ts), 0, Date.now() + 86400000, ts)));
    const updatedAt = Math.max(0, Math.floor(clampNumber(firstDefined(item.updatedAt, ts), 0, Date.now() + 86400000, ts)));
    const episodeIdx = Math.max(0, Math.floor(clampNumber(firstDefined(item.episodeIdx, item.epIdx), 0, 100000, 0)));

    const bookmark = {
      id: sanitizeTextValue(item.id, 160, 'bm_' + Date.now() + '_' + out.length),
      novelId,
      episodeId: rawEpisodeId || null,
      episodeIdx,
      epIdx: episodeIdx,
      title: sanitizeTextValue(item.title, 240, 'Untitled'),
      epTitle: sanitizeTextValue(item.epTitle, 200, ''),
      fileName: sanitizeTextValue(item.fileName, 240, ''),
      note: sanitizeTextValue(item.note, 500, ''),
      chunk,
      chunkIndex: chunk,
      totalChunks,
      ratio,
      scrollRatio: ratio,
      documentRatio: clampNumber(firstDefined(item.documentRatio, ratio), 0, 1, ratio),
      globalBlockIndex: Math.max(0, Math.floor(clampNumber(item.globalBlockIndex, 0, 100000000, 0))),
      blockIndex: Math.max(0, Math.floor(clampNumber(item.blockIndex, 0, 1000000, 0))),
      charIndex: Math.max(0, Math.floor(clampNumber(item.charIndex, 0, 100000000, 0))),
      ts,
      createdAt,
      updatedAt
    };

    if (!Number.isFinite(Number(item.globalBlockIndex))) delete bookmark.globalBlockIndex;
    if (!Number.isFinite(Number(item.blockIndex))) delete bookmark.blockIndex;
    if (!Number.isFinite(Number(item.charIndex))) delete bookmark.charIndex;
    if (!Number.isFinite(Number(item.documentRatio))) delete bookmark.documentRatio;

    out.push(bookmark);
  });
  return out;
}

function sanitizeRecentList(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  input.slice(0, 200).forEach((item) => {
    if (!ensurePlainObject(item)) return;
    const type = item.type === 'episode' || item.episodeId ? 'episode' : 'novel';
    const novelId = sanitizeTextValue(item.novelId, 160, '');
    if (!novelId) return;
    const episodeId = type === 'episode' ? sanitizeTextValue(item.episodeId, 160, '') : '';
    const label = sanitizeTextValue(firstDefined(item.label, item.title), 240, novelId);
    out.push({
      type,
      id: sanitizeTextValue(item.id, 200, type + ':' + novelId + (episodeId ? ':' + episodeId : '')),
      novelId,
      episodeId,
      episodeIdx: Math.max(0, Math.floor(clampNumber(item.episodeIdx, 0, 100000, 0))),
      title: sanitizeTextValue(firstDefined(item.title, item.label), 240, label),
      label,
      ts: Math.max(0, Math.floor(clampNumber(item.ts, 0, Date.now() + 86400000, Date.now())))
    });
  });
  return out;
}


function sanitizeUserTagName(value) {
  const compact = String(value == null ? '' : value).replace(/\s+/g, ' ').trim().replace(/^#+/, '').trim();
  return sanitizeTextValue(compact, 40, '');
}

function sanitizeUserTagList(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  const seen = new Set();
  for (const value of input) {
    const tag = sanitizeUserTagName(value);
    const key = tag.toLocaleLowerCase('ko-KR');
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= 100) break;
  }
  return out;
}

function sanitizeNovelUserTags(input, allowedTags = []) {
  if (!ensurePlainObject(input)) return {};
  const allowed = new Map(sanitizeUserTagList(allowedTags).map(tag => [tag.toLocaleLowerCase('ko-KR'), tag]));
  const out = {};
  let count = 0;
  for (const [rawNovelId, rawTags] of Object.entries(input)) {
    const novelId = sanitizeTextValue(rawNovelId, 200, '');
    if (!novelId || !isSafeRecordKey(novelId) || !Array.isArray(rawTags)) continue;
    const tags = [];
    const seen = new Set();
    for (const value of rawTags) {
      const normalized = sanitizeUserTagName(value);
      const key = normalized.toLocaleLowerCase('ko-KR');
      const tag = allowed.get(key);
      if (!tag || seen.has(key)) continue;
      seen.add(key);
      tags.push(tag);
      if (tags.length >= 20) break;
    }
    if (!tags.length) continue;
    out[novelId] = tags;
    count += 1;
    if (count >= 5000) break;
  }
  return out;
}

function sanitizeCollapsedFolders(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = [];
  input.slice(0, 500).forEach((item) => {
    const text = sanitizeTextValue(item, 240, '');
    if (!text || seen.has(text)) return;
    seen.add(text);
    out.push(text);
  });
  return out;
}

module.exports = {
  STATE_NORMALIZER_LISTS_SPLIT_PASS,
  sanitizeBookmarkList,
  sanitizeRecentList,
  sanitizeUserTagList,
  sanitizeNovelUserTags,
  sanitizeCollapsedFolders
};
