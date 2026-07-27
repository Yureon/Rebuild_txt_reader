import { createEl } from '../core/utils.mjs';
import { persistBookData } from '../state/app-state.mjs';
import { toast } from './ui.mjs';
import { getProgressRatioForState } from './library-model.mjs';

const LIBRARY_QUICK_UI_STORAGE_KEY = 'libraryQuickUiV2';
const LIBRARY_QUICK_UI_VERSION = 2;
const LIBRARY_QUICK_COLLAPSED_LIMIT = 5;
const LIBRARY_QUICK_EXPANDED_LIMIT = 12;

function emptyLibraryQuickSummary() {
  return { items: [], total: 0, stale: 0 };
}

export function installLibraryQuickListDelegation(app, on, handlers = {}) {
  const box = app?.els?.libraryQuickList;
  if (!box || box.dataset.delegatedLibraryQuickEvents === '1') return;
  box.dataset.delegatedLibraryQuickEvents = '1';
  on(box, 'click', ev => {
    const target = ev.target instanceof Element ? ev.target : null;
    const actionEl = target?.closest?.('[data-library-quick-action]');
    if (!actionEl || !box.contains(actionEl)) return;
    ev.preventDefault();
    ev.stopPropagation();
    const action = String(actionEl.dataset.libraryQuickAction || '');
    if (action === 'open') return handlers.open?.(actionEl);
    if (action === 'reveal') return handlers.reveal?.(actionEl);
    if (action === 'favorite-toggle') return handlers.favoriteToggle?.(actionEl);
    if (action === 'remove-recent') return handlers.removeRecent?.(actionEl);
    if (action === 'cleanup-stale') return cleanupLibraryQuickStaleItems(app, actionEl.dataset.libraryQuickSection || '');
    if (action === 'section-select') return activateOrToggleLibraryQuickSection(app, actionEl.dataset.libraryQuickSection || '');
    if (action === 'section-toggle') return toggleLibraryQuickSection(app, actionEl.dataset.libraryQuickSection || '');
    if (action === 'section-more') return toggleLibraryQuickSectionExpanded(app, actionEl.dataset.libraryQuickSection || '');
  });
  on(box, 'keydown', ev => {
    const tab = ev.target instanceof Element ? ev.target.closest('.library-quick-switcher-tab') : null;
    if (!tab || !box.contains(tab) || !['ArrowLeft','ArrowRight','Home','End'].includes(ev.key)) return;
    ev.preventDefault();
    const tabs = Array.from(box.querySelectorAll('.library-quick-switcher-tab'));
    const current = Math.max(0, tabs.indexOf(tab));
    const nextIndex = ev.key === 'Home' ? 0 : ev.key === 'End' ? tabs.length - 1 : (current + (ev.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    const next = tabs[nextIndex];
    selectLibraryQuickSection(app, next?.dataset?.libraryQuickSection || '');
    queueMicrotask(() => box.querySelector(`.library-quick-switcher-tab[data-library-quick-section="${next?.dataset?.libraryQuickSection || ''}"]`)?.focus?.());
  });
}

export function renderLibraryQuickList(app) {
  const box = app?.els?.libraryQuickList;
  if (!box) return;
  const filterActive = !!String(app.state.libraryFilter || '').trim();
  const summaries = {
    recents: filterActive ? emptyLibraryQuickSummary() : getLibraryQuickRecentItems(app, LIBRARY_QUICK_EXPANDED_LIMIT),
    favorites: filterActive ? emptyLibraryQuickSummary() : getLibraryQuickFavoriteItems(app, LIBRARY_QUICK_EXPANDED_LIMIT)
  };
  if (filterActive || (!summaries.recents.total && !summaries.favorites.total && !summaries.recents.stale && !summaries.favorites.stale)) {
    box.replaceChildren();
    box.hidden = true;
    return;
  }
  const ui = getLibraryQuickUiState(app);
  let active = normalizeLibraryQuickSectionId(ui.active) || 'recents';
  const activeSummary = summaries[active];
  const other = active === 'recents' ? 'favorites' : 'recents';
  if (!activeSummary.total && !activeSummary.stale && (summaries[other].total || summaries[other].stale)) active = other;
  ui.active = active;
  box.replaceChildren(createLibraryQuickSwitcher(active, summaries, ui));
  box.hidden = false;
}

export function removeLibraryQuickRecentItem(app, item) {
  const novelId = String(item?.dataset?.novelId || '');
  const episodeId = String(item?.dataset?.episodeId || '');
  if (!novelId || !Array.isArray(app?.state?.recents)) return;
  const novel = app?.state?.novelById?.get?.(novelId) || null;
  const removeWholeNovel = !!novel?.isMultiFile && !episodeId;
  const before = app.state.recents.length;
  app.state.recents = app.state.recents.filter(x => {
    if (String(x?.novelId || '') !== novelId) return true;
    if (removeWholeNovel) return false;
    return String(x?.episodeId || '') !== episodeId;
  });
  if (app.state.recents.length === before) return;
  persistBookData(app.state);
  renderLibraryQuickList(app);
  toast(app, 'info', '최근 항목', '목록에서 제거했습니다.');
}

export function cleanupLibraryQuickStaleItems(app, sectionId = '') {
  const key = normalizeLibraryQuickSectionId(sectionId);
  if (!key) return { removed: 0 };
  let removed = 0;
  if (key === 'recents') {
    const recents = Array.isArray(app?.state?.recents) ? app.state.recents : [];
    const next = recents.filter(item => !isStaleLibraryQuickRecent(app, item));
    removed = recents.length - next.length;
    app.state.recents = next;
  } else if (key === 'favorites') {
    const favorites = app?.state?.favorites instanceof Set ? app.state.favorites : new Set(app?.state?.favorites || []);
    const next = new Set();
    favorites.forEach(id => {
      const novelId = String(id || '');
      if (novelId && app?.state?.novelById?.has?.(novelId)) next.add(novelId);
      else removed += 1;
    });
    app.state.favorites = next;
  }
  if (!removed) {
    toast(app, 'info', '빠른 목록', '정리할 삭제/누락 항목이 없습니다.');
    return { removed: 0 };
  }
  persistBookData(app.state);
  renderLibraryQuickList(app);
  toast(app, 'success', '빠른 목록 정리', `삭제/누락 항목 ${removed}개를 정리했습니다.`);
  return { removed };
}

function getLibraryQuickUiState(app) {
  if (app?.state?.libraryQuickUi && typeof app.state.libraryQuickUi === 'object') return app.state.libraryQuickUi;
  const fallback = { version:LIBRARY_QUICK_UI_VERSION, active:'recents', collapsed:{ recents:true, favorites:true }, expanded:{ recents:false, favorites:false } };
  try {
    const raw = window.localStorage?.getItem?.(LIBRARY_QUICK_UI_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const compatible = Number(parsed?.version) === LIBRARY_QUICK_UI_VERSION;
      app.state.libraryQuickUi = compatible ? {
        version:LIBRARY_QUICK_UI_VERSION,
        active: normalizeLibraryQuickSectionId(parsed?.active) || fallback.active,
        collapsed: { ...fallback.collapsed, ...(parsed?.collapsed || {}) },
        expanded: { ...fallback.expanded, ...(parsed?.expanded || {}) }
      } : fallback;
      return app.state.libraryQuickUi;
    }
  } catch {}
  app.state.libraryQuickUi = fallback;
  return app.state.libraryQuickUi;
}

function saveLibraryQuickUiState(app) {
  try { window.localStorage?.setItem?.(LIBRARY_QUICK_UI_STORAGE_KEY, JSON.stringify(getLibraryQuickUiState(app))); } catch {}
}


function activateOrToggleLibraryQuickSection(app, sectionId) {
  const key = normalizeLibraryQuickSectionId(sectionId);
  if (!key) return;
  const ui = getLibraryQuickUiState(app);
  if (ui.active === key) ui.collapsed[key] = !ui.collapsed[key];
  else { ui.active = key; ui.collapsed[key] = false; }
  saveLibraryQuickUiState(app);
  renderLibraryQuickList(app);
}

function selectLibraryQuickSection(app, sectionId) {
  const key = normalizeLibraryQuickSectionId(sectionId);
  if (!key) return;
  const ui = getLibraryQuickUiState(app);
  ui.active = key;
  saveLibraryQuickUiState(app);
  renderLibraryQuickList(app);
}

function toggleLibraryQuickSection(app, sectionId) {
  const key = normalizeLibraryQuickSectionId(sectionId);
  if (!key) return;
  const ui = getLibraryQuickUiState(app);
  ui.collapsed[key] = !ui.collapsed[key];
  saveLibraryQuickUiState(app);
  renderLibraryQuickList(app);
}

function toggleLibraryQuickSectionExpanded(app, sectionId) {
  const key = normalizeLibraryQuickSectionId(sectionId);
  if (!key) return;
  const ui = getLibraryQuickUiState(app);
  ui.expanded[key] = !ui.expanded[key];
  saveLibraryQuickUiState(app);
  renderLibraryQuickList(app);
}

function normalizeLibraryQuickSectionId(value) {
  const id = String(value || '').trim();
  return id === 'recents' || id === 'favorites' ? id : '';
}

function getLibraryQuickFavoriteItems(app, limit = LIBRARY_QUICK_EXPANDED_LIMIT) {
  const ids = Array.from(app?.state?.favorites || []).map(String).filter(Boolean);
  const items = [];
  let total = 0;
  let stale = 0;
  for (const id of ids) {
    const novel = app.state.novelById?.get?.(id) || null;
    if (!novel) {
      stale += 1;
      continue;
    }
    total += 1;
    if (items.length >= limit) continue;
    const progress = getLibraryQuickProgress(app, novel, '');
    items.push({
      sectionId: 'favorites',
      novelId: novel.id,
      episodeId: '',
      icon: '★',
      kind: novel.isMultiFile ? 'multi' : 'single',
      kindLabel: novel.isMultiFile ? `${novel.episodeCount || (novel.episodes || []).length || 0}화` : '단일',
      progressRatio: progress.ratio,
      progressLabel: progress.label,
      title: novel.title || novel.fileName || 'Untitled',
      meta: [novel.categoryPath || '루트', progress.label].filter(Boolean).join(' · ')
    });
  }
  return { items, total, stale };
}

function getLibraryQuickRecentItems(app, limit = LIBRARY_QUICK_EXPANDED_LIMIT) {
  const recents = Array.isArray(app?.state?.recents) ? [...app.state.recents] : [];
  const items = [];
  const seen = new Set();
  let total = 0;
  let stale = 0;
  recents.sort((a, b) => (Number(b?.ts) || 0) - (Number(a?.ts) || 0));
  for (const item of recents) {
    const novelId = String(item?.novelId || '');
    if (!novelId) continue;
    const novel = app.state.novelById?.get?.(novelId) || null;
    if (!novel) {
      stale += 1;
      continue;
    }
    const rawEpisodeId = String(item?.resumeEpisodeId || item?.episodeId || '');
    const multiRecent = !!novel.isMultiFile;
    const episodeId = multiRecent ? '' : String(item?.episodeId || '');
    const key = multiRecent ? `multi:${novelId}` : `${novelId}:${episodeId || 'single'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const episode = rawEpisodeId ? (novel.episodes || []).find(ep => String(ep.id || '') === rawEpisodeId) : null;
    if (!multiRecent && episodeId && !episode) {
      stale += 1;
      continue;
    }
    total += 1;
    if (items.length >= limit) continue;
    const title = multiRecent ? (novel.title || novel.fileName || item.title || 'Untitled') : (episode ? `${novel.title || novel.fileName || 'Untitled'} · ${episode.title || episode.fileName || 'Episode'}` : (item.title || novel.title || novel.fileName || 'Untitled'));
    const when = formatLibraryQuickTime(item.ts);
    const progress = getLibraryQuickProgress(app, novel, episodeId);
    const episodeNote = multiRecent && episode ? `최근 ${episode.title || episode.fileName || '회차'}` : '';
    items.push({
      sectionId: 'recents',
      novelId,
      episodeId,
      icon: '↺',
      kind: multiRecent ? 'multi' : (episode ? 'episode' : 'single'),
      kindLabel: multiRecent ? `${novel.episodeCount || (novel.episodes || []).length || 0}화` : (episode ? '회차' : '단일'),
      progressRatio: progress.ratio,
      progressLabel: progress.label,
      title,
      meta: [when ? `최근 ${when}` : '최근 열람', episodeNote, progress.label].filter(Boolean).join(' · ')
    });
  }
  return { items, total, stale };
}

function isStaleLibraryQuickRecent(app, item) {
  const novelId = String(item?.novelId || '');
  const episodeId = String(item?.episodeId || '');
  if (!novelId) return true;
  const novel = app?.state?.novelById?.get?.(novelId) || null;
  if (!novel) return true;
  if (!episodeId) return false;
  return !(novel.episodes || []).some(ep => String(ep.id || '') === episodeId);
}

function getLibraryQuickProgress(app, novel, episodeId = '') {
  const epId = String(episodeId || '');
  const snap = epId ? app.state.progress?.readMeta?.[`${novel.id}-${epId}`] : app.state.progress?.byNovel?.[novel.id];
  const raw = epId ? (snap?.episodeDocumentRatio ?? snap?.documentRatio ?? snap?.ratio) : getProgressRatioForState(app.state, novel);
  const ratio = Math.max(0, Math.min(1, Number(raw) || 0));
  return { ratio, label: ratio > 0 ? `진행 ${Math.round(ratio * 100)}%` : '미독서' };
}

function createLibraryQuickSwitcher(active, summaries, ui) {
  const labels = { recents:'최근 항목', favorites:'즐겨찾기' };
  const tabs = createEl('div', { class:'library-quick-switcher-tabs', role:'tablist', 'aria-label':'빠른 목록' }, ['recents','favorites'].map(key => {
    const selected = key === active;
    const summary = summaries[key] || emptyLibraryQuickSummary();
    return createEl('button', {
      id:`library-quick-tab-${key}`,
      class:`library-quick-switcher-tab${selected ? ' active' : ''}`,
      type:'button',
      role:'tab',
      'aria-selected':selected ? 'true' : 'false',
      'aria-controls':`library-quick-panel-${key}`,
      'aria-expanded':selected && !ui?.collapsed?.[key] ? 'true' : 'false',
      tabindex:selected ? '0' : '-1',
      dataset:{ libraryQuickAction:'section-select', libraryQuickSection:key }
    }, [
      createEl('span', { class:'library-quick-switcher-icon', text:key === 'favorites' ? '★' : '↺', 'aria-hidden':'true' }),
      createEl('span', { text:labels[key] }),
      createEl('span', { class:'library-quick-count', text:String(Math.max(0, Number(summary.total) || 0)) })
    ]);
  }));
  const summary = summaries[active] || emptyLibraryQuickSummary();
  return createEl('section', { class:'library-quick-switcher', dataset:{ libraryQuickActive:active } }, [
    tabs,
    createLibraryQuickSection(active, labels[active], summary.items, summary.total, ui, { staleCount:summary.stale, compact:true })
  ]);
}

function createLibraryQuickSection(sectionId, label, items, totalCount, ui, options = {}) {
  const key = normalizeLibraryQuickSectionId(sectionId);
  const collapsed = !!ui?.collapsed?.[key];
  const expanded = !!ui?.expanded?.[key];
  const limit = expanded ? LIBRARY_QUICK_EXPANDED_LIMIT : LIBRARY_QUICK_COLLAPSED_LIMIT;
  const list = Array.isArray(items) ? items.slice(0, limit) : [];
  const total = Math.max(0, Number(totalCount) || 0);
  const staleCount = Math.max(0, Number(options.staleCount) || 0);
  const hiddenCount = Math.max(0, total - list.length);
  const descriptor = key === 'favorites' ? '고정해 둔 작품' : '마지막으로 읽은 작품';
  const visibleSummary = total
    ? `${collapsed ? '전체' : `${list.length}개 표시 · 전체`} ${total}개${staleCount ? ` · 누락 ${staleCount}개 제외` : ''}`
    : `${descriptor} 없음${staleCount ? ` · 누락 ${staleCount}개 제외` : ''}`;
  const compact = options.compact === true;
  const section = createEl('section', {
    id:`library-quick-panel-${key}`,
    role:'tabpanel',
    'aria-labelledby':`library-quick-tab-${key}`,
    class:`library-quick-section library-quick-section-${key}${collapsed ? ' is-collapsed' : ''}${compact ? ' is-compact' : ''}`,
    hidden: collapsed ? true : false,
    dataset:{ libraryQuickSection:key, libraryQuickStaleCount:String(staleCount) }
  }, compact ? [] : [
    createEl('div', { class:'library-quick-head' }, [
      createEl('button', {
        class:'library-quick-head-main',
        type:'button',
        dataset:{ libraryQuickAction:'section-toggle', libraryQuickSection:key },
        'aria-expanded': collapsed ? 'false' : 'true',
        'aria-label': `${label} ${total}개, ${collapsed ? '펼치기' : '접기'}`,
        title: `${label} ${collapsed ? '펼치기' : '접기'}`
      }, [
        createEl('span', { class:'library-quick-head-icon', text:key === 'favorites' ? '★' : '↺', 'aria-hidden':'true' }),
        createEl('span', { class:'library-quick-head-copy' }, [
          createEl('strong', { class:'library-quick-head-label', text:label }),
          createEl('small', { class:'library-quick-head-summary', text:visibleSummary })
        ]),
        createEl('span', { class:'library-quick-count', text:String(total), title:`전체 ${total}개` }),
        createEl('span', { class:'library-quick-chevron', text:collapsed ? '⌄' : '⌃', 'aria-hidden':'true' })
      ])
    ])
  ]);
  if (collapsed) return section;
  if (!list.length) {
    section.append(createEl('div', { class:'library-quick-empty', text:key === 'favorites' ? '즐겨찾기가 아직 없습니다.' : '최근 항목이 아직 없습니다.' }));
  } else {
    section.append(createEl('div', { class:'library-quick-items' }, list.map(item => createLibraryQuickItem(item))));
  }
  if (staleCount) section.append(createLibraryQuickStaleNote(key, staleCount));
  if (hiddenCount > 0 || (expanded && total > LIBRARY_QUICK_COLLAPSED_LIMIT)) {
    section.append(createEl('button', {
      class:'library-quick-more',
      type:'button',
      dataset:{ libraryQuickAction:'section-more', libraryQuickSection:key },
      text:expanded ? '간단히 보기' : `나머지 ${hiddenCount}개 더보기`
    }));
  }
  return section;
}

function createLibraryQuickStaleNote(sectionId, staleCount) {
  return createEl('div', { class:'library-quick-stale-note' }, [
    createEl('span', { text:`삭제되었거나 찾을 수 없는 항목 ${staleCount}개는 표시하지 않습니다.` }),
    createEl('button', {
      class:'library-quick-stale-cleanup',
      type:'button',
      dataset:{ libraryQuickAction:'cleanup-stale', libraryQuickSection:sectionId },
      text:'정리'
    })
  ]);
}

function createLibraryQuickItem(item) {
  const ratioPct = Math.round(Math.max(0, Math.min(1, Number(item.progressRatio) || 0)) * 100);
  const common = { novelId:item.novelId || '', episodeId:item.episodeId || '', libraryQuickSection:item.sectionId || '' };
  return createEl('article', { class:`library-quick-item library-quick-item-${item.sectionId || 'item'}`, dataset:common }, [
    createEl('button', {
      class:'library-quick-main',
      type:'button',
      dataset:{ ...common, libraryQuickAction:'open' },
      title:item.title || '',
      'aria-label': `${item.title || 'Untitled'} 열기`
    }, [
      createEl('span', { class:'library-quick-icon', text:item.icon || '•' }),
      createEl('span', { class:'library-quick-text' }, [
        createEl('span', { class:'library-quick-title', text:item.title || 'Untitled' }),
        createEl('span', { class:'library-quick-meta', text:item.meta || '' }),
        createEl('span', { class:'library-quick-progress', 'aria-hidden':'true' }, createEl('span', { style:`width:${ratioPct}%` }))
      ])
    ]),
    createEl('div', { class:'library-quick-actions' }, [
      createEl('button', { class:'library-quick-action', type:'button', dataset:{ ...common, libraryQuickAction:'reveal' }, title:'목록에서 위치 표시', 'aria-label':'목록에서 위치 표시', text:'목록' }),
      item.sectionId === 'favorites'
        ? createEl('button', { class:'library-quick-action is-danger-soft', type:'button', dataset:{ ...common, libraryQuickAction:'favorite-toggle' }, title:'즐겨찾기 해제', 'aria-label':'즐겨찾기 해제', text:'해제' })
        : createEl('button', { class:'library-quick-action is-danger-soft', type:'button', dataset:{ ...common, libraryQuickAction:'remove-recent' }, title:'최근 항목에서 제거', 'aria-label':'최근 항목에서 제거', text:'삭제' })
    ])
  ]);
}

function formatLibraryQuickTime(value) {
  const ts = Number(value) || 0;
  if (!ts) return '';
  const delta = Date.now() - ts;
  if (delta >= 0 && delta < 60_000) return '방금';
  if (delta >= 0 && delta < 3_600_000) return `${Math.max(1, Math.round(delta / 60_000))}분 전`;
  if (delta >= 0 && delta < 86_400_000) return `${Math.max(1, Math.round(delta / 3_600_000))}시간 전`;
  try {
    return new Date(ts).toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  } catch {
    return '';
  }
}
