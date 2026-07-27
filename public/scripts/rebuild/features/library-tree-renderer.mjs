import { createEl } from '../core/utils.mjs';
import { getProgressRatioForState } from './library-model.mjs';

export const LIBRARY_TREE_RENDERER_PASS = 'v292-library-tree-renderer-pass';
export const LIBRARY_LEFT_DISCLOSURE_PASS = 'v371-library-left-disclosure-pass';
export const LIBRARY_TITLE_MARQUEE_PASS = 'v371-library-title-overflow-gate-pass';
export const LIBRARY_BOOKMARK_COUNT_INDEX_PASS = 'v674-library-bookmark-count-index-pass';
export const LIBRARY_COLLAPSED_EPISODE_LAZY_PASS = 'v674-library-collapsed-episode-lazy-pass';

export function buildLibraryBookmarkCountIndex(bookmarks = []) {
  const counts = new Map();
  for (const bookmark of Array.isArray(bookmarks) ? bookmarks : []) {
    const novelId = String(bookmark?.novelId || '');
    if (novelId) counts.set(novelId, (counts.get(novelId) || 0) + 1);
  }
  return counts;
}

function getLibraryDraggableAttrs(app, type, payload, deps = {}) {
  const attrs = deps.libraryDraggableAttrs?.(app, type, payload);
  return attrs && typeof attrs === 'object' ? attrs : {};
}

function titleTrack(text) {
  const label = String(text || '');
  return createEl('span', { class:'library-title-track', title: label }, [
    createEl('span', { class:'library-title-text', text: label }),
    createEl('span', { class:'library-title-ghost', text: label, 'aria-hidden':'true' })
  ]);
}

function createTitleEl(tag, className, text) {
  return createEl(tag, { class:`${className} library-title-marquee` }, titleTrack(text));
}

function createFolderToggleButton(folderKey, collapsed) {
  return createEl('button', {
    class:'library-disclosure-btn folder-toggle-btn',
    type:'button',
    title: collapsed ? '폴더 펼치기' : '폴더 접기',
    'aria-label': collapsed ? '폴더 펼치기' : '폴더 접기',
    'aria-expanded': collapsed ? 'false' : 'true',
    dataset:{ folderKey },
    safeHtml:'<span class="cat-arrow" aria-hidden="true">▾</span>'
  });
}

function createEpisodeToggleButton(novel, expanded) {
  return createEl('button', {
    class:'library-disclosure-btn episode-toggle-btn',
    type:'button',
    title: expanded ? '화수 목록 접기' : '화수 목록 펼치기',
    'aria-label': expanded ? '화수 목록 접기' : '화수 목록 펼치기',
    'aria-expanded': expanded ? 'true' : 'false',
    dataset:{ novelId: novel.id },
    safeHtml:'<span class="episode-arrow" aria-hidden="true">▾</span>'
  });
}

export function formatNovelMeta(app, novel, ratio, active, deps = {}) {
  const progress = Math.round(Math.max(0, Math.min(1, Number(ratio) || 0)) * 100);
  const progressLabel = progress > 0 ? '독서율 ' + progress + '%' : '미독서';
  const typeLabel = novel?.isMultiFile ? String(Number(novel.episodeCount || (novel.episodes || []).length) || 0) + '화' : '단일 작품';
  const bookmarkCount = deps.bookmarkCountByNovel instanceof Map
    ? Number(deps.bookmarkCountByNovel.get(String(novel.id)) || 0)
    : (app.state.bookmarks || []).filter(bm => bm && bm.novelId === novel.id).length;
  const flags = [];
  if (active) flags.push('읽는 중');
  if (app.state.favorites?.has?.(novel.id)) flags.push('즐겨찾기');
  if (bookmarkCount) flags.push('북마크 ' + bookmarkCount);
  return [progressLabel, typeLabel, ...flags].join(' · ');
}

export function createNovelItem(app, novel, deps = {}) {
  const active = app.state.current && app.state.current.novel.id === novel.id && !app.state.current.episode;
  const ratio = getProgressRatioForState(app.state, novel);
  const multi = !!novel.isMultiFile;
  const expanded = multi && app.state.expandedEpisodeNovels.has(novel.id);
  return createEl('div', { class:`novel-item${active ? ' active' : ''}${multi ? ' multi-file' : ''}${expanded ? ' episode-open' : ''}`, ...getLibraryDraggableAttrs(app, 'novel', { novelId:novel.id }, deps) }, [
    multi ? createEpisodeToggleButton(novel, expanded) : null,
    createEl('button', { class:'library-action-btn novel-action-btn', type:'button', title:'작품 작업', 'aria-label':'작품 작업', dataset:{ type:'novel', novelId:novel.id }, safeHtml:'<span aria-hidden="true">☷</span>' }),
    createTitleEl('div', 'novel-title', novel.title || novel.fileName || 'Untitled'),
    createEl('div', { class:'novel-meta', text: formatNovelMeta(app, novel, ratio, active, deps) }),
    createEl('div', { class:'progress-bar' }, createEl('div', { class:'progress-fill', style:`width:${Math.round(ratio * 100)}%` }))
  ]);
}

export function createEpisodeList(app, novel, deps = {}) {
  const list = createEl('div', { class:`ep-list${app.state.expandedEpisodeNovels.has(novel.id) ? ' open' : ''}` });
  const allEpisodes = Array.isArray(novel.episodes) ? novel.episodes : [];
  const maxRows = Math.max(1, Number(deps.maxExpandedEpisodeRows) || allEpisodes.length || 1);
  let episodes = allEpisodes.slice(0, maxRows);
  const currentEpisodeId = String(app.state.current?.novel?.id) === String(novel.id)
    ? String(app.state.current?.episode?.id || '')
    : '';
  if (currentEpisodeId && !episodes.some(episode => String(episode?.id || '') === currentEpisodeId)) {
    const currentEpisode = allEpisodes.find(episode => String(episode?.id || '') === currentEpisodeId);
    if (currentEpisode) episodes = episodes.slice(0, Math.max(0, maxRows - 1)).concat(currentEpisode);
  }
  episodes.forEach((ep, idx) => {
    const epActive = app.state.current?.novel.id === novel.id && app.state.current?.episode?.id === ep.id;
    const epItem = createEl('div', { class:`ep-item${epActive ? ' active' : ''}`, ...getLibraryDraggableAttrs(app, 'episode', { novelId:novel.id, episodeId:ep.id }, deps) }, [
      createTitleEl('span', 'ep-title', ep.title || ep.fileName || `Episode ${idx + 1}`),
      createEl('button', { class:'library-action-btn episode-action-btn', type:'button', title:'회차 작업', 'aria-label':'회차 작업', dataset:{ type:'episode', novelId:novel.id, episodeId:ep.id }, safeHtml:'<span aria-hidden="true">☷</span>' })
    ]);
    list.append(epItem);
  });
  if (episodes.length < allEpisodes.length) {
    list.append(createEl('div', {
      class:'library-shelf-prune-notice',
      role:'status',
      text:`${allEpisodes.length.toLocaleString()} episodes 중 ${episodes.length.toLocaleString()}개만 안전 모드에서 표시됩니다. 검색을 좁히거나 가상 목록을 다시 시도하세요.`
    }));
  }
  return list;
}

export function appendNovelItem(app, container, novel, deps = {}) {
  container.append(createNovelItem(app, novel, deps));
  if (novel.isMultiFile && app.state.expandedEpisodeNovels.has(novel.id)) {
    container.append(createEpisodeList(app, novel, deps));
  }
}

export function renderLibraryTree(app, container, node, path = [], deps = {}) {
  Array.from(node.folders.values()).sort((a,b) => a.name.localeCompare(b.name, 'ko', { numeric:true })).forEach(folder => {
    const key = [...path, folder.name].join('>');
    const collapsed = app.state.collapsedFolders.has(key);
    const header = createEl('div', { class:`cat-header${collapsed ? ' collapsed' : ''}`, ...getLibraryDraggableAttrs(app, 'folder', { folderKey:key }, deps) }, [
      createFolderToggleButton(key, collapsed),
      createTitleEl('span', 'folder-title', folder.name),
      createEl('button', { class:'library-action-btn folder-action-btn', type:'button', title:'폴더 작업', 'aria-label':'폴더 작업', dataset:{ type:'folder', folderKey:key }, safeHtml:'<span aria-hidden="true">⚙</span>' })
    ]);
    container.append(header);
    const body = createEl('div', { class:'cat-body' });
    body.style.display = collapsed ? 'none' : 'block';
    renderLibraryTree(app, body, folder, [...path, folder.name], deps);
    container.append(body);
  });

  node.novels.sort((a,b) => String(a.title).localeCompare(String(b.title), 'ko', { numeric:true })).forEach(novel => appendNovelItem(app, container, novel, deps));
}
