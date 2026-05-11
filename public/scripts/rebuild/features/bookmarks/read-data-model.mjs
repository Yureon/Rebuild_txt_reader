import { formatPercent } from '../../core/utils.mjs';

export const TABS = [
  { id: 'progress', label: '읽기 위치' },
  { id: 'bookmarks', label: '북마크' },
  { id: 'recents', label: '최근 열람' },
  { id: 'favorites', label: '즐겨찾기' }
];

export function getReadDataCounts(app) {
  return {
    progress: getProgressSnapshots(app).length,
    bookmarks: (app.state.bookmarks || []).length,
    recents: countRecentGroups(app),
    favorites: (app.state.favorites || new Set()).size || 0
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

export function labelForSnapshot(app, snap) {
  const novel = app.state.novelById.get(snap.novelId);
  if (!novel) return snap.title || snap.novelId;
  if (!snap.episodeId) return novel.title || snap.novelId;
  const episode = (novel.episodes || []).find(ep => ep.id === snap.episodeId);
  return episode?.title ? `${novel.title} · ${episode.title}` : `${novel.title} · ${snap.episodeId}`;
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
