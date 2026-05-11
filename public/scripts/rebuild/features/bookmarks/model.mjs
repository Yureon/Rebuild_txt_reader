import { persistBookData } from '../../state/app-state.mjs';

export function currentSnapshot(app) {
  const c = app.state.current;
  if (!c) return null;
  app.reader.updateProgress();
  const address = typeof app.reader.getViewportAddress === 'function' ? app.reader.getViewportAddress() : null;
  return {
    id: `${c.novel.id}:${c.episode?.id || 'single'}:${address?.globalBlockIndex ?? c.chunk}:${Date.now()}`,
    novelId: c.novel.id,
    episodeId: c.episode?.id || null,
    episodeIdx: c.episodeIdx || 0,
    chunk: c.chunk,
    totalChunks: c.totalChunks,
    ratio: c.ratio || 0,
    documentRatio: address?.documentRatio,
    globalBlockIndex: address?.globalBlockIndex,
    blockIndex: address?.blockIndex,
    charIndex: address?.charIndex,
    title: c.title,
    note: '',
    ts: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

export async function persistAndSync(app) {
  persistBookData(app.state);
  if (app.state.shared) {
    const shared = { ...app.state.shared, bookmarks: app.state.bookmarks, recents: app.state.recents, favorites: Array.from(app.state.favorites), updatedAt: Date.now() };
    try { await app.api.putShared(shared); app.state.shared = shared; } catch {}
  }
}
