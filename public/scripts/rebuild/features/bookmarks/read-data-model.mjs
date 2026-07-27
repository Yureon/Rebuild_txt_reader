import { formatPercent } from '../../core/utils.mjs';

export const TABS = [
  { id: 'progress', label: '읽기 위치' },
  { id: 'bookmarks', label: '북마크' },
  { id: 'recents', label: '최근 열람' },
  { id: 'favorites', label: '즐겨찾기' }
];

export const READ_DATA_HUMAN_TITLE_RESOLUTION_PASS = 'v660-read-data-human-title-resolution-pass';

const OPAQUE_HEX_ID_RE = /^[a-f0-9]{24,128}$/i;
const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5a-f0-9][a-f0-9]{3}-[89ab0-9][a-f0-9]{3}-[a-f0-9]{12}$/i;

function compactText(value, limit = 240) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, limit);
}

export function isOpaqueReadDataIdentifier(value) {
  const text = compactText(value, 160);
  return !!text && (OPAQUE_HEX_ID_RE.test(text) || UUID_RE.test(text));
}

function filenameTitle(value) {
  const text = compactText(value, 600);
  if (!text) return '';
  const leaf = text.split(/[\\/]/).filter(Boolean).pop() || text;
  return leaf.replace(/\.(txt|text|md)$/i, '').trim().slice(0, 240);
}

function usableTitle(value, identifier = '') {
  const text = compactText(value);
  if (!text) return '';
  const id = compactText(identifier, 160);
  if ((id && text === id) || isOpaqueReadDataIdentifier(text)) return '';
  return text;
}

function addCandidate(map, key, value, identifier = '') {
  const id = compactText(key, 160);
  const title = usableTitle(value, identifier || id);
  if (!id || !title || map.has(id)) return;
  map.set(id, title);
}

function addRecordCandidates(novelTitles, episodeTitles, record = {}) {
  if (!record || typeof record !== 'object') return;
  const novelId = compactText(record.novelId || record.id, 160);
  if (!novelId) return;
  const episodeId = compactText(record.episodeId || record.resumeEpisodeId, 160);

  addCandidate(novelTitles, novelId, record.novelTitle, novelId);
  addCandidate(novelTitles, novelId, record.workTitle, novelId);
  addCandidate(novelTitles, novelId, filenameTitle(record.novelFileName || record.novelPath || record.relativePath), novelId);

  if (episodeId) {
    addCandidate(episodeTitles, `${novelId}::${episodeId}`, record.episodeTitle, episodeId);
    addCandidate(episodeTitles, `${novelId}::${episodeId}`, record.title, episodeId);
    addCandidate(episodeTitles, `${novelId}::${episodeId}`, record.label, episodeId);
    addCandidate(episodeTitles, `${novelId}::${episodeId}`, filenameTitle(record.fileName || record.path), episodeId);
  } else {
    addCandidate(novelTitles, novelId, record.title, novelId);
    addCandidate(novelTitles, novelId, record.label, novelId);
    addCandidate(novelTitles, novelId, filenameTitle(record.fileName || record.path), novelId);
  }
}

function addProgressCandidates(novelTitles, episodeTitles, progress = {}) {
  addRecordCandidates(novelTitles, episodeTitles, progress?.lastRead);
  Object.values(progress?.byNovel || {}).forEach(record => addRecordCandidates(novelTitles, episodeTitles, record));
  Object.values(progress?.readMeta || {}).forEach(record => addRecordCandidates(novelTitles, episodeTitles, record));
}

export function shortReadDataIdentifier(value) {
  const text = compactText(value, 160);
  if (!text) return '';
  if (text.length <= 14) return text;
  return `${text.slice(0, 8)}…${text.slice(-4)}`;
}

export function createReadDataTitleResolver(app) {
  const novelTitles = new Map();
  const episodeTitles = new Map();
  addProgressCandidates(novelTitles, episodeTitles, app?.state?.progress || {});
  (app?.state?.recents || []).forEach(record => addRecordCandidates(novelTitles, episodeTitles, record));
  (app?.state?.bookmarks || []).forEach(record => addRecordCandidates(novelTitles, episodeTitles, record));

  function liveNovel(novelId) {
    return app?.state?.novelById?.get?.(novelId) || null;
  }

  function resolve(record = {}, options = {}) {
    const novelId = compactText(record?.novelId || options.novelId, 160);
    const episodeId = compactText(record?.episodeId || options.episodeId, 160);
    const novel = liveNovel(novelId);
    const episode = episodeId && Array.isArray(novel?.episodes)
      ? novel.episodes.find(item => String(item?.id || '') === episodeId) || null
      : null;

    const novelTitle = usableTitle(novel?.title || novel?.fileName, novelId)
      || usableTitle(record?.novelTitle || record?.workTitle, novelId)
      || novelTitles.get(novelId)
      || (!episodeId ? usableTitle(record?.title || record?.label, novelId) : '')
      || (!episodeId ? filenameTitle(record?.fileName || record?.path) : '');

    const episodeTitle = usableTitle(episode?.title || episode?.fileName, episodeId)
      || usableTitle(record?.episodeTitle, episodeId)
      || episodeTitles.get(`${novelId}::${episodeId}`)
      || (episodeId ? usableTitle(record?.title || record?.label, episodeId) : '');

    const fallbackRecordTitle = usableTitle(record?.title || record?.label, novelId || episodeId);
    let label = novelTitle || fallbackRecordTitle || '목록에서 찾을 수 없는 작품';
    if (novelTitle && episodeTitle && episodeTitle !== novelTitle && !novelTitle.includes(episodeTitle)) label = `${novelTitle} · ${episodeTitle}`;
    else if (!novelTitle && episodeTitle) label = episodeTitle;

    const stale = !novel;
    const opaqueIdentifier = isOpaqueReadDataIdentifier(novelId);
    return {
      label,
      novelTitle:novelTitle || '',
      episodeTitle:episodeTitle || '',
      novel,
      episode,
      stale,
      identifierHint:stale && novelId ? shortReadDataIdentifier(novelId) : '',
      opaqueIdentifier,
      pass:READ_DATA_HUMAN_TITLE_RESOLUTION_PASS
    };
  }

  return { resolve, novelTitles, episodeTitles, pass:READ_DATA_HUMAN_TITLE_RESOLUTION_PASS };
}

export function getReadDataCounts(app) {
  return {
    progress: getProgressSnapshots(app).length,
    bookmarks: (app.state.bookmarks || []).length,
    recents: countRecentGroups(app),
    favorites: (app.state.favorites || new Set()).size || 0,
    userTags: Array.isArray(app.state.userTags) ? app.state.userTags.length : 0
  };
}

function countRecentGroups(app) {
  const seen = new Set();
  (app.state.recents || []).forEach(item => {
    const novelId = String(item?.novelId || '');
    if (!novelId) return;
    const novel = app.state.novelById?.get?.(novelId);
    const key = novel?.isMultiFile ? `multi:${novelId}` : `${novelId}:${item?.episodeId || 'single'}`;
    seen.add(key);
  });
  return seen.size;
}

export function getProgressSnapshots(app) {
  const map = app.state.progress?.readMeta && typeof app.state.progress.readMeta === 'object'
    ? app.state.progress.readMeta
    : app.state.progress?.byNovel || {};
  const seen = new Set();
  const list = [];
  Object.values(map || {}).forEach(snap => {
    if (!snap || typeof snap !== 'object' || !snap.novelId) return;
    const key = progressKey(snap);
    if (seen.has(key)) return;
    seen.add(key);
    list.push(snap);
  });
  Object.values(app.state.progress?.byNovel || {}).forEach(snap => {
    if (!snap || typeof snap !== 'object' || !snap.novelId) return;
    const key = progressKey(snap);
    if (seen.has(key)) return;
    seen.add(key);
    list.push(snap);
  });
  return list.sort((a,b) => (b.ts || 0) - (a.ts || 0));
}

export function progressKey(snap) {
  return `${snap.novelId || ''}::${snap.episodeId || 'single'}`;
}

export function labelForSnapshot(app, snap, resolver = null) {
  const titleResolver = resolver || createReadDataTitleResolver(app);
  return titleResolver.resolve(snap).label;
}

export function normalizeTab(tab) {
  return TABS.some(item => item.id === tab) ? tab : 'progress';
}

export function formatSnapshotPosition(snap) {
  if (Number.isFinite(Number(snap.globalBlockIndex)) && Number(snap.globalBlockIndex) >= 0) return `블럭 ${Number(snap.globalBlockIndex) + 1}`;
  if (Number.isFinite(Number(snap.documentRatio))) return `위치 ${formatPercent(snap.documentRatio, 1)}`;
  return `위치 ${formatPercent(((Number(snap.chunk) || 1) - 1 + (Number(snap.ratio) || 0)) / Math.max(1, Number(snap.totalChunks) || Number(snap.chunk) || 1), 1)}`;
}

export function formatDate(ts) {
  const n = Number(ts);
  return new Date(Number.isFinite(n) && n > 0 ? n : Date.now()).toLocaleString();
}
