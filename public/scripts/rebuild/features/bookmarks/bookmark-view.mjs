import { createEl, formatPercent } from '../../core/utils.mjs';

export function renderBookmarks(app, { gotoBookmark, removeBookmark } = {}) {
  const box = app.els.bookmarkList;
  if (!box) return;
  box.innerHTML = '';
  const list = app.state.bookmarks || [];
  if (!list.length) {
    box.append(createEl('div', { class:'bm-empty', text:'저장된 북마크가 없습니다.' }));
    return;
  }
  list.forEach(bm => {
    const position = formatBookmarkPosition(bm);
    const row = createEl('div', { class:'bm-item' }, [
      createEl('div', { class:'bm-info' }, [
        createEl('div', { class:'bm-title', text:bm.title || bm.novelId }),
        createEl('div', { class:'bm-sub', text:`${position} · ${new Date(bm.ts || Date.now()).toLocaleString()}` }),
        bm.note ? createEl('div', { class:'bm-note', text: bm.note }) : null
      ]),
      createEl('div', { class:'bm-actions' }, [
        createEl('button', { class:'bm-btn', type:'button', text:'이동', onclick:() => gotoBookmark?.(bm) }),
        createEl('button', { class:'bm-btn danger', type:'button', text:'삭제', onclick:() => removeBookmark?.(bm.id) })
      ])
    ]);
    box.append(row);
  });
}

function formatBookmarkPosition(bm) {
  if (Number.isFinite(Number(bm.globalBlockIndex)) && Number(bm.globalBlockIndex) >= 0) return `블럭 ${Number(bm.globalBlockIndex) + 1}`;
  if (Number.isFinite(Number(bm.documentRatio))) return `위치 ${formatPercent(bm.documentRatio, 1)}`;
  if (Number.isFinite(Number(bm.chunk))) return `위치 ${formatPercent(((Number(bm.chunk) || 1) - 1 + (Number(bm.ratio) || 0)) / Math.max(1, Number(bm.totalChunks) || Number(bm.chunk) || 1), 1)}`;
  return '위치 정보 없음';
}
