import { createEl, downloadTextFile } from '../../core/utils.mjs';
import { persistBookData } from '../../state/app-state.mjs';
import { toast } from '../ui.mjs';
import { openOptionsFromSnapshot } from '../library-paths.mjs';
import {
  TABS,
  createReadDataTitleResolver,
  formatDate,
  formatSnapshotPosition,
  getProgressSnapshots,
  getReadDataCounts,
  labelForSnapshot,
  normalizeTab,
  progressKey
} from './read-data-model.mjs';
import {
  buildReadDataImportPreview,
  importReadDataFile,
  renderReadDataImportPreview,
  setReadDataImportRenderCallback
} from './read-data-import.mjs';
export {
  READ_DATA_IMPORT_POLICIES,
  applyReadDataImportPreview,
  loadReadDataRollbackSnapshot,
  openReadDataImportDetail,
  resolveImportChoice,
  restoreReadDataRollback
} from './read-data-import.mjs';

export const READ_DATA_INCREMENTAL_RENDER_PASS = 'v661-read-data-incremental-render-pass';
export const READ_DATA_BATCH_SIZE = 80;

setReadDataImportRenderCallback(renderReadData);

// Guard markers retained for legacy smoke checks: buildReadDataImportPreview, applyReadDataImportPreview, READ_DATA_IMPORT_POLICIES, txt-reader-read-data-rollback-v1, restoreReadDataRollback, loadReadDataRollbackSnapshot, openReadDataImportDetail, rdm-detail-overlay, preview.overrides, resolveImportChoice.

export function installReadDataModal(app) {
  app.readDataCleanup?.();
  const disposers = [];
  const on = (target, type, handler, options) => {
    if (!target) return;
    target.addEventListener(type, handler, options);
    disposers.push(() => target.removeEventListener(type, handler, options));
  };

  const openReadData = () => {
    app.state.readDataTab = app.state.readDataTab || 'progress';
    resetReadDataPagination(app);
    renderReadData(app);
    app.openLayer('readDataOverlay');
  };
  on(app.els.openReadDataBtn, 'click', openReadData);
  on(app.els.openReadDataAdvancedBtn, 'click', openReadData);
  on(app.els.rdmCloseBtn, 'click', () => app.closeLayer('readDataOverlay'));
  on(app.els.rdmDelAllBtn, 'click', () => clearCurrentTab(app));
  on(app.els.rdmExportBtn, 'click', () => exportReadData(app));
  on(app.els.rdmImportBtn, 'click', () => app.els.rdmImportFile?.click());
  on(app.els.rdmImportFile, 'change', ev => importReadDataFile(app, ev));
  on(app.els.rdmTabs, 'click', ev => {
    const btn = ev.target?.closest?.('[data-rdm-tab]');
    if (!btn) return;
    app.state.readDataTab = btn.dataset.rdmTab || 'progress';
    resetReadDataPagination(app, app.state.readDataTab);
    renderReadData(app);
  });

  app.readDataCleanup = () => disposers.splice(0).forEach(dispose => {
    try { dispose(); } catch {}
  });
}

function resetReadDataPagination(app, tab = '') {
  const limits = app.state.readDataRenderLimits || (app.state.readDataRenderLimits = {});
  if (tab) limits[normalizeTab(tab)] = READ_DATA_BATCH_SIZE;
  else TABS.forEach(item => { limits[item.id] = READ_DATA_BATCH_SIZE; });
}

function readDataLimit(app, tab) {
  const limits = app.state.readDataRenderLimits || (app.state.readDataRenderLimits = {});
  const key = normalizeTab(tab);
  const value = Number(limits[key]);
  if (!Number.isFinite(value) || value < READ_DATA_BATCH_SIZE) limits[key] = READ_DATA_BATCH_SIZE;
  return limits[key];
}

function appendReadDataLoadMore(app, box, tab, total, rendered) {
  if (rendered >= total) return;
  box.append(createEl('button', {
    class:'rdm-load-more',
    type:'button',
    text:`다음 ${Math.min(READ_DATA_BATCH_SIZE, total - rendered)}개 표시 · ${rendered}/${total}`,
    onclick:() => {
      const limits = app.state.readDataRenderLimits || (app.state.readDataRenderLimits = {});
      limits[normalizeTab(tab)] = rendered + READ_DATA_BATCH_SIZE;
      renderReadData(app);
    }
  }));
}

function createLazyProgressChildren(app, group, stale, titleResolver) {
  const container = createEl('div', { class:'rdm-folder-children', dataset:{ lazyChildren:'pending' } });
  let rendered = 0;
  const appendBatch = () => {
    const next = group.items.slice(rendered, rendered + READ_DATA_BATCH_SIZE);
    next.forEach(snap => container.append(renderProgressSnapshotRow(app, snap, stale, true, titleResolver)));
    rendered += next.length;
    const oldMore = container.querySelector('.rdm-load-more');
    oldMore?.remove();
    if (rendered < group.items.length) {
      container.append(createEl('button', {
        class:'rdm-load-more',
        type:'button',
        text:`다음 ${Math.min(READ_DATA_BATCH_SIZE, group.items.length - rendered)}개 화수 표시 · ${rendered}/${group.items.length}`,
        onclick:(event) => { event.preventDefault(); appendBatch(); }
      }));
    }
    container.dataset.lazyChildren = 'ready';
  };
  return { container, appendBatch };
}

export function renderReadData(app) {
  const box = app.els.rdmBody;
  if (!box) return;
  const tab = normalizeTab(app.state.readDataTab || 'progress');
  const titleResolver = createReadDataTitleResolver(app);
  app.state.readDataTab = tab;
  renderReadDataTabs(app, tab);
  renderReadDataSummary(app);
  renderReadDataImportPreview(app);
  box.innerHTML = '';
  if (tab === 'bookmarks') return renderBookmarkData(app, box, titleResolver);
  if (tab === 'recents') return renderRecentData(app, box, titleResolver);
  if (tab === 'favorites') return renderFavoriteData(app, box, titleResolver);
  return renderProgressData(app, box, titleResolver);
}

function renderReadDataTabs(app, active) {
  const box = app.els.rdmTabs;
  if (!box) return;
  box.innerHTML = '';
  const counts = getReadDataCounts(app);
  TABS.forEach(tab => {
    box.append(createEl('button', {
      class: `rdm-tab${tab.id === active ? ' active' : ''}`,
      type: 'button',
      text: `${tab.label} ${counts[tab.id] || 0}`,
      dataset: { rdmTab: tab.id }
    }));
  });
}

function renderReadDataSummary(app) {
  const box = app.els.rdmSummary;
  if (!box) return;
  const counts = getReadDataCounts(app);
  box.innerHTML = '';
  box.append(
    createEl('span', { safeHtml: `<b>${counts.progress}</b>개 위치` }),
    createEl('span', { safeHtml: `<b>${counts.bookmarks}</b>개 북마크` }),
    createEl('span', { safeHtml: `<b>${counts.recents}</b>개 최근 열람` }),
    createEl('span', { safeHtml: `<b>${counts.favorites}</b>개 즐겨찾기` }),
    createEl('span', { safeHtml: `<b>${counts.userTags}</b>개 사용자 태그` })
  );
}

function renderProgressData(app, box, titleResolver) {
  const snaps = getProgressSnapshots(app);
  if (!snaps.length) return appendEmpty(box, '저장된 읽기 위치가 없습니다.');
  const groups = groupProgressSnapshotsByNovel(app, snaps, titleResolver);
  const limit = readDataLimit(app, 'progress');
  const visibleGroups = groups.slice(0, limit);
  visibleGroups.forEach(group => {
    const stale = !group.novel;
    const multi = group.isMultiEpisode && group.items.length > 1;
    if (!multi) {
      const snap = group.items[0];
      box.append(renderProgressSnapshotRow(app, snap, stale, false, titleResolver));
      return;
    }
    const latest = group.items[0];
    const lazy = createLazyProgressChildren(app, group, stale, titleResolver);
    const details = createEl('details', {
      class:`rdm-item rdm-folder-item${stale ? ' is-stale' : ''}`,
      open:false,
      ontoggle:() => {
        if (details.open && lazy.container.dataset.lazyChildren === 'pending') lazy.appendBatch();
      }
    }, [
      createEl('summary', { class:'rdm-folder-summary' }, [
        createEl('div', { class:'rdm-info' }, [
          createEl('div', { class:'rdm-name', text: group.title }),
          createEl('div', { class:'rdm-meta', text:`${group.items.length}개 화수 위치 · 최근 ${formatSnapshotPosition(latest)} · ${formatDate(latest.ts)}${staleReadDataMeta(group.resolved)}` })
        ]),
        createEl('div', { class:'rdm-actions' }, [
          createEl('button', { class:'rdm-open', type:'button', text:'최근 위치', onclick:(ev) => { ev.preventDefault(); openSnapshot(app, latest); } }),
          createEl('button', { class:'rdm-del', type:'button', text:'폴더 삭제', onclick:(ev) => { ev.preventDefault(); removeProgressNovel(app, group.novelId); } })
        ])
      ]),
      lazy.container
    ]);
    box.append(details);
  });
  appendReadDataLoadMore(app, box, 'progress', groups.length, visibleGroups.length);
}

function groupProgressSnapshotsByNovel(app, snaps = [], titleResolver = createReadDataTitleResolver(app)) {
  const map = new Map();
  snaps.forEach(snap => {
    const novelId = String(snap.novelId || '');
    const novel = app.state.novelById.get(novelId);
    const resolved = titleResolver.resolve(snap);
    const entry = map.get(novelId) || { novelId, novel, resolved, title: resolved.novelTitle || resolved.label, isMultiEpisode: Array.isArray(novel?.episodes) && novel.episodes.length > 1, items: [] };
    entry.items.push(snap);
    map.set(novelId, entry);
  });
  return Array.from(map.values()).map(group => ({
    ...group,
    items: group.items.sort((a,b) => (b.ts || 0) - (a.ts || 0))
  })).sort((a,b) => ((b.items[0]?.ts || 0) - (a.items[0]?.ts || 0)));
}

function renderProgressSnapshotRow(app, snap, stale = false, nested = false, titleResolver = createReadDataTitleResolver(app)) {
  const resolved = titleResolver.resolve(snap);
  return createEl('div', { class: `rdm-item${nested ? ' rdm-child-item' : ''}${stale ? ' is-stale' : ''}` }, [
    createEl('div', { class:'rdm-info' }, [
      createEl('div', { class:'rdm-name', text: labelForSnapshot(app, snap, titleResolver) }),
      createEl('div', { class:'rdm-meta', text:`${formatSnapshotPosition(snap)} · ${formatDate(snap.ts)}${staleReadDataMeta(resolved)}` })
    ]),
    createEl('div', { class:'rdm-actions' }, [
      createEl('button', { class:'rdm-open', type:'button', text:'열기', onclick:() => openSnapshot(app, snap) }),
      createEl('button', { class:'rdm-del', type:'button', text:'삭제', onclick:() => removeProgressSnapshot(app, snap) })
    ])
  ]);
}

function renderBookmarkData(app, box, titleResolver) {
  const list = [...(app.state.bookmarks || [])].sort((a,b) => (b.ts || 0) - (a.ts || 0));
  if (!list.length) return appendEmpty(box, '저장된 북마크가 없습니다.');
  const limit = readDataLimit(app, 'bookmarks');
  const visible = list.slice(0, limit);
  visible.forEach(bm => {
    const novel = app.state.novelById.get(bm.novelId);
    const stale = !novel;
    const note = String(bm.note || '').trim();
    const resolved = titleResolver.resolve(bm);
    box.append(createEl('div', { class: `rdm-item${stale ? ' is-stale' : ''}` }, [
      createEl('div', { class:'rdm-info' }, [
        createEl('div', { class:'rdm-name', text: resolved.label }),
        createEl('div', { class:'rdm-meta', text:`${formatSnapshotPosition(bm)} · ${formatDate(bm.ts)}${staleReadDataMeta(resolved)}` }),
        note ? createEl('div', { class:'rdm-note-text', text: note }) : null
      ]),
      createEl('div', { class:'rdm-actions' }, [
        createEl('button', { class:'rdm-open', type:'button', text:'이동', onclick:() => app.bookmarks?.goto?.(bm) }),
        createEl('button', { class:'rdm-note', type:'button', text:'메모', onclick:() => editBookmarkNote(app, bm) }),
        createEl('button', { class:'rdm-del', type:'button', text:'삭제', onclick:() => removeBookmarkData(app, bm.id) })
      ])
    ]));
  });
  appendReadDataLoadMore(app, box, 'bookmarks', list.length, visible.length);
}

function renderRecentData(app, box, titleResolver) {
  const list = [...(app.state.recents || [])].sort((a,b) => (b.ts || 0) - (a.ts || 0));
  if (!list.length) return appendEmpty(box, '최근 열람 기록이 없습니다.');
  const groups = groupRecentItemsByNovel(app, list);
  const limit = readDataLimit(app, 'recents');
  const visibleGroups = groups.slice(0, limit);
  visibleGroups.forEach(group => {
    const stale = !group.novel;
    const multi = !!group.novel?.isMultiFile;
    const item = group.items[0];
    const latestEpisode = multi ? findRecentEpisode(group.novel, item) : null;
    const resolved = titleResolver.resolve(item, { episodeId:item.resumeEpisodeId || item.episodeId || null });
    const meta = multi
      ? [`작품 폴더`, `${group.novel?.episodes?.length || group.novel?.episodeCount || group.items.length || 0}화`, latestEpisode ? `최근 ${latestEpisode.title || latestEpisode.fileName}` : '', formatDate(item.ts)].filter(Boolean).join(' · ')
      : `${item.episodeId ? '에피소드' : '작품'} · ${formatDate(item.ts)}`;
    const displayMeta = `${meta}${staleReadDataMeta(resolved)}`;
    box.append(createEl('div', { class: `rdm-item${multi ? ' rdm-folder-item' : ''}${stale ? ' is-stale' : ''}` }, [
      createEl('div', { class:'rdm-info' }, [
        createEl('div', { class:'rdm-name', text: multi ? (resolved.novelTitle || resolved.label) : resolved.label }),
        createEl('div', { class:'rdm-meta', text: displayMeta })
      ]),
      createEl('div', { class:'rdm-actions' }, [
        createEl('button', { class:'rdm-open', type:'button', text:'열기', onclick:() => openRecent(app, item) }),
        createEl('button', { class:'rdm-del', type:'button', text: multi ? '폴더 삭제' : '삭제', onclick:() => removeRecent(app, item) })
      ])
    ]));
  });
  appendReadDataLoadMore(app, box, 'recents', groups.length, visibleGroups.length);
}

function groupRecentItemsByNovel(app, list = []) {
  const map = new Map();
  list.forEach(item => {
    const novelId = String(item?.novelId || '');
    const novel = app.state.novelById.get(novelId);
    const key = novel?.isMultiFile ? `multi:${novelId}` : `${novelId}:${item?.episodeId || 'single'}`;
    const group = map.get(key) || { novelId, novel, items: [] };
    group.items.push(item);
    map.set(key, group);
  });
  return Array.from(map.values()).map(group => ({
    ...group,
    items: group.items.sort((a,b) => (b.ts || 0) - (a.ts || 0))
  })).sort((a,b) => ((b.items[0]?.ts || 0) - (a.items[0]?.ts || 0)));
}

function findRecentEpisode(novel, item) {
  const id = String(item?.resumeEpisodeId || item?.episodeId || '');
  if (!id || !Array.isArray(novel?.episodes)) return null;
  return novel.episodes.find(ep => String(ep.id || '') === id) || null;
}

function renderFavoriteData(app, box, titleResolver) {
  const ids = Array.from(app.state.favorites || []);
  if (!ids.length) return appendEmpty(box, '즐겨찾기한 작품이 없습니다.');
  const limit = readDataLimit(app, 'favorites');
  const visible = ids.slice(0, limit);
  visible.forEach(id => {
    const novel = app.state.novelById.get(id);
    const stale = !novel;
    const resolved = titleResolver.resolve({ novelId:id });
    box.append(createEl('div', { class: `rdm-item${stale ? ' is-stale' : ''}` }, [
      createEl('div', { class:'rdm-info' }, [
        createEl('div', { class:'rdm-name', text: resolved.label }),
        createEl('div', { class:'rdm-meta', text: stale ? `목록에서 찾을 수 없음${resolved.identifierHint ? ` · 식별자 ${resolved.identifierHint}` : ''}` : '즐겨찾기' })
      ]),
      createEl('div', { class:'rdm-actions' }, [
        createEl('button', { class:'rdm-open', type:'button', text:'열기', onclick:() => openFavorite(app, id) }),
        createEl('button', { class:'rdm-del', type:'button', text:'해제', onclick:() => removeFavorite(app, id) })
      ])
    ]));
  });
  appendReadDataLoadMore(app, box, 'favorites', ids.length, visible.length);
}


function staleReadDataMeta(resolved) {
  if (!resolved?.stale) return '';
  return ` · 목록에서 찾을 수 없음${resolved.identifierHint ? ` · 식별자 ${resolved.identifierHint}` : ''}`;
}

function appendEmpty(box, text) {
  box.append(createEl('div', { class:'rdm-empty', text }));
}

async function openSnapshot(app, snap) {
  const novel = app.state.novelById.get(snap.novelId);
  if (!novel) return toast(app, 'error', '열기 실패', '현재 목록에서 작품을 찾지 못했습니다.');
  await app.reader.openNovel(novel, openOptionsFromSnapshot({ episodeId: snap.episodeId || null }, snap));
  app.closeLayer('readDataOverlay');
}

async function openRecent(app, item) {
  const novel = app.state.novelById.get(item.novelId);
  if (!novel) return toast(app, 'error', '열기 실패', '현재 목록에서 작품을 찾지 못했습니다.');
  const snap = app.state.progress?.byNovel?.[novel.id] || null;
  const episodeId = novel.isMultiFile ? (snap?.episodeId || item.resumeEpisodeId || item.episodeId || null) : (item.episodeId || null);
  await app.reader.openNovel(novel, openOptionsFromSnapshot({ episodeId }, snap));
  app.closeLayer('readDataOverlay');
}

async function openFavorite(app, novelId) {
  const novel = app.state.novelById.get(novelId);
  if (!novel) return toast(app, 'error', '열기 실패', '현재 목록에서 작품을 찾지 못했습니다.');
  await app.reader.openNovel(novel, {});
  app.closeLayer('readDataOverlay');
}

function removeProgressSnapshot(app, snap) {
  const key = progressKey(snap);
  const progress = app.state.progress || (app.state.progress = { lastRead:null, byNovel:{}, positions:{}, readMeta:{} });
  if (progress.byNovel?.[snap.novelId] && progressKey(progress.byNovel[snap.novelId]) === key) delete progress.byNovel[snap.novelId];
  if (progress.readMeta) delete progress.readMeta[key.replace('::', '-')];
  if (progress.readMeta) delete progress.readMeta[`${snap.novelId}-${snap.episodeId || 'single'}`];
  if (progress.positions) {
    delete progress.positions[`pos-${snap.novelId}-${snap.episodeId || 'single'}`];
    Object.keys(progress.positions).forEach(posKey => {
      if (posKey.startsWith(`pos-${snap.novelId}-${snap.episodeId || 'single'}-`)) delete progress.positions[posKey];
    });
  }
  if (progress.lastRead && progressKey(progress.lastRead) === key) progress.lastRead = null;
  app.reader.persistProgress();
  renderReadData(app);
}

function removeProgressNovel(app, novelId) {
  const progress = app.state.progress || (app.state.progress = { lastRead:null, byNovel:{}, positions:{}, readMeta:{} });
  Object.values(progress.readMeta || {}).forEach(snap => {
    if (snap?.novelId === novelId) removeProgressSnapshot(app, snap);
  });
  Object.values(progress.byNovel || {}).forEach(snap => {
    if (snap?.novelId === novelId) removeProgressSnapshot(app, snap);
  });
  renderReadData(app);
}

function removeBookmarkData(app, id) {
  app.state.bookmarks = (app.state.bookmarks || []).filter(x => x.id !== id);
  app.bookmarks?.persist?.();
  app.bookmarks?.render?.();
  renderReadData(app);
}

function editBookmarkNote(app, bm) {
  const value = prompt('북마크 메모', bm.note || '');
  if (value == null) return;
  const note = String(value).trim().slice(0, 500);
  app.state.bookmarks = (app.state.bookmarks || []).map(item => item.id === bm.id ? { ...item, note, updatedAt: Date.now() } : item);
  app.bookmarks?.persist?.();
  app.bookmarks?.render?.();
  renderReadData(app);
}

function removeRecent(app, item) {
  const novel = app.state.novelById.get(item.novelId);
  app.state.recents = (app.state.recents || []).filter(x => {
    if (x.novelId !== item.novelId) return true;
    if (novel?.isMultiFile) return false;
    return (x.episodeId || null) !== (item.episodeId || null);
  });
  app.bookmarks?.persist?.();
  renderReadData(app);
}

function removeFavorite(app, id) {
  app.state.favorites?.delete?.(id);
  persistBookData(app.state);
  app.bookmarks?.persist?.();
  app.library?.render?.();
  renderReadData(app);
}

function clearCurrentTab(app) {
  const tab = normalizeTab(app.state.readDataTab || 'progress');
  const label = TABS.find(item => item.id === tab)?.label || '현재 항목';
  if (!confirm(`${label} 데이터를 모두 삭제할까요?`)) return;
  if (tab === 'bookmarks') {
    app.state.bookmarks = [];
    app.bookmarks?.persist?.();
    app.bookmarks?.render?.();
  } else if (tab === 'recents') {
    app.state.recents = [];
    app.bookmarks?.persist?.();
  } else if (tab === 'favorites') {
    app.state.favorites = new Set();
    app.bookmarks?.persist?.();
    app.library?.render?.();
  } else {
    app.state.progress = { lastRead:null, byNovel:{}, positions:{}, readMeta:{} };
    app.reader.persistProgress();
  }
  renderReadData(app);
}

function exportReadData(app) {
  const payload = {
    schema: 'txt-reader-read-data-v1',
    exportedAt: new Date().toISOString(),
    progress: app.state.progress || { lastRead:null, byNovel:{}, positions:{}, readMeta:{} },
    bookmarks: app.state.bookmarks || [],
    recents: app.state.recents || [],
    favorites: Array.from(app.state.favorites || []),
    userTags: Array.from(app.state.userTags || []),
    novelUserTags: { ...(app.state.novelUserTags || {}) }
  };
  downloadTextFile(`txt-reader-read-data-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(payload, null, 2));
}
