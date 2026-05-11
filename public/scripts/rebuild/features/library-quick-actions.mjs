import { persistLibraryUi } from '../state/app-state.mjs';
import { openOptionsFromSnapshot } from './library-paths.mjs';
import { findEpisodeForSnapshot, flattenLibraryTree, getCategoryParts } from './library-model.mjs';
import { getLibraryWindowDomMetrics } from './library-row-diagnostics.mjs';

export function openLibraryQuickItem(app, item, deps = {}) {
  const novelId = String(item?.dataset?.novelId || '');
  const episodeId = String(item?.dataset?.episodeId || '');
  const novel = app?.state?.novelById?.get?.(novelId) || null;
  if (!novel || !app?.reader?.openNovel) return false;
  if (episodeId) {
    const episode = (novel.episodes || []).find(ep => String(ep.id || '') === episodeId);
    if (!episode) return false;
    app.reader.openNovel(novel, openOptionsFromSnapshot({ episodeId }, app.state.progress.readMeta?.[`${novel.id}-${episodeId}`]));
  } else if (novel.isMultiFile) {
    const snap = app.state.progress.byNovel?.[novel.id] || app.state.progress.lastRead;
    const episode = findEpisodeForSnapshot(novel, snap) || (novel.episodes && novel.episodes[0]);
    app.reader.openNovel(novel, openOptionsFromSnapshot({ episodeId: episode?.id || null }, snap));
  } else {
    app.reader.openNovel(novel, openOptionsFromSnapshot({}, app.state.progress.byNovel?.[novel.id]));
  }
  if (typeof deps.closeSidebarAfterLibraryOpen === 'function') deps.closeSidebarAfterLibraryOpen(app);
  return true;
}

export function revealLibraryQuickItemInList(app, item, deps = {}) {
  const novelId = String(item?.dataset?.novelId || '');
  const episodeId = String(item?.dataset?.episodeId || '');
  const novel = app?.state?.novelById?.get?.(novelId) || null;
  const box = app?.els?.novelList || null;
  if (!novel || !box) return false;
  getCategoryParts(novel).reduce((parts, part) => {
    parts.push(part);
    app.state.collapsedFolders.delete(parts.join('>'));
    return parts;
  }, []);
  if (episodeId && novel.isMultiFile) app.state.expandedEpisodeNovels.add(novel.id);
  persistLibraryUi(app.state);
  const targetKey = episodeId ? `episode:${novelId}:${episodeId}` : `novel:${novelId}`;
  const getFiltered = typeof deps.getLibraryFilteredNovels === 'function' ? deps.getLibraryFilteredNovels : null;
  const filteredNovels = getFiltered ? getFiltered(app, { allowCache:false }) : [];
  const flattened = flattenLibraryTree(filteredNovels, {
    collapsedFolders: app.state.collapsedFolders,
    expandedEpisodeNovels: app.state.expandedEpisodeNovels,
    current: app.state.current,
    includeCollapsedChildren: false
  });
  const visibleRows = flattened.rows.filter(row => row?.visible !== false);
  const targetIndex = visibleRows.findIndex(row => row?.key === targetKey);
  if (targetIndex >= 0) {
    const metrics = getLibraryWindowDomMetrics(app, { lightweight:true });
    const rowHeight = Math.max(24, Math.min(160, Number(metrics.rowHeight) || 56));
    box.scrollTop = Math.max(0, Math.round(Math.max(0, targetIndex - 2) * rowHeight));
  }
  if (typeof deps.renderLibrary === 'function') deps.renderLibrary(app, { source:'quick-reveal', followActive:false });
  window.requestAnimationFrame(() => highlightLibraryQuickTarget(app, novelId, episodeId));
  if (typeof deps.toast === 'function') deps.toast(app, 'info', '목록 위치', targetIndex >= 0 ? '목록에서 위치를 표시했습니다.' : '폴더를 펼쳤습니다.');
  return true;
}

function highlightLibraryQuickTarget(app, novelId, episodeId = '') {
  const selector = episodeId
    ? `.ep-item[data-novel-id="${cssEscape(novelId)}"][data-episode-id="${cssEscape(episodeId)}"]`
    : `.novel-item[data-novel-id="${cssEscape(novelId)}"]`;
  const el = app?.els?.novelList?.querySelector?.(selector);
  if (!el) return;
  try { el.scrollIntoView({ block:'center' }); } catch {}
  el.classList.add('library-quick-target-flash');
  window.setTimeout(() => el.classList.remove('library-quick-target-flash'), 1400);
}

function cssEscape(value) {
  const raw = String(value || '');
  if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(raw);
  return raw.replace(/[^a-zA-Z0-9_-]/g, ch => "\\" + ch);
}
