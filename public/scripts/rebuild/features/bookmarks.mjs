import { downloadTextFile } from '../core/utils.mjs';
import { toast } from './ui.mjs';
import { openOptionsFromSnapshot } from './library-paths.mjs';
import { currentSnapshot, persistAndSync } from './bookmarks/model.mjs';
import { renderBookmarks as renderBookmarkList } from './bookmarks/bookmark-view.mjs';

export function installBookmarks(app) {
  app.bookmarksCleanup?.();
  const disposers = [];
  const on = (target, type, handler, options) => {
    if (!target) return;
    target.addEventListener(type, handler, options);
    disposers.push(() => target.removeEventListener(type, handler, options));
  };

  app.bookmarks = {
    addCurrent: () => addCurrentBookmark(app),
    render: () => renderBookmarks(app),
    persist: () => persistAndSync(app),
    goto: bookmark => gotoBookmark(app, bookmark)
  };

  on(app.els.bookmarkBtn, 'click', () => {
    renderBookmarks(app);
    app.openLayer('bookmarkOverlay');
  });
  on(app.els.bookmarkClose, 'click', () => app.closeLayer('bookmarkOverlay'));
  on(app.els.bookmarkAddCurrent, 'click', () => addCurrentBookmark(app));
  on(app.els.bookmarkPrevCurrent, 'click', () => stepBookmark(app, -1));
  on(app.els.bookmarkNextCurrent, 'click', () => stepBookmark(app, 1));
  on(app.els.bookmarkClearAll, 'click', () => {
    if (!confirm('북마크를 모두 삭제할까요?')) return;
    app.state.bookmarks = [];
    persistAndSync(app);
    renderBookmarks(app);
  });

  app.bookmarksCleanup = () => disposers.splice(0).forEach(dispose => {
    try { dispose(); } catch {}
  });
}

function addCurrentBookmark(app) {
  const bm = currentSnapshot(app);
  if (!bm) return toast(app, 'info', '북마크', '먼저 작품을 열어주세요.');
  app.state.bookmarks = [bm, ...app.state.bookmarks].slice(0, 1000);
  persistAndSync(app);
  renderBookmarks(app);
  toast(app, 'success', '북마크 저장', bm.title || '현재 위치');
}

function renderBookmarks(app) {
  renderBookmarkList(app, {
    gotoBookmark: bm => gotoBookmark(app, bm),
    removeBookmark: id => removeBookmark(app, id)
  });
}

function removeBookmark(app, id) {
  app.state.bookmarks = app.state.bookmarks.filter(x => x.id !== id);
  persistAndSync(app);
  renderBookmarks(app);
}

async function gotoBookmark(app, bm) {
  const novel = app.state.novelById.get(bm.novelId);
  if (!novel) return toast(app, 'error', '북마크 이동 실패', '목록에서 작품을 찾지 못했습니다.');
  await app.reader.openNovel(novel, openOptionsFromSnapshot({ episodeId: bm.episodeId || null }, bm));
  app.closeLayer('bookmarkOverlay');
}

async function stepBookmark(app, dir) {
  const c = app.state.current;
  if (!c) return;
  const list = app.state.bookmarks
    .filter(bm => bm.novelId === c.novel.id && (bm.episodeId || null) === (c.episode?.id || null))
    .sort((a,b) => bookmarkOrder(a) - bookmarkOrder(b));
  if (!list.length) return toast(app, 'info', '북마크', '현재 작품의 북마크가 없습니다.');
  const address = app.reader.getViewportAddress?.();
  const cur = Number.isFinite(Number(address?.globalBlockIndex)) ? Number(address.globalBlockIndex) : c.chunk + (c.ratio || 0);
  const target = dir > 0 ? list.find(b => bookmarkOrder(b) > cur) || list[0] : [...list].reverse().find(b => bookmarkOrder(b) < cur) || list[list.length - 1];
  await gotoBookmark(app, target);
}

export function exportBookmarks(app) {
  downloadTextFile('txt-reader-bookmarks.json', JSON.stringify(app.state.bookmarks || [], null, 2));
}

function bookmarkOrder(bm) {
  if (Number.isFinite(Number(bm.globalBlockIndex))) return Number(bm.globalBlockIndex);
  return (Number(bm.chunk) || 1) + (Number(bm.ratio) || 0);
}
