import { normalizeNovelUserTags, normalizeUserTagList, persistBookData } from '../../state/app-state.mjs';

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
    novelTitle: String(c.novel?.title || c.novel?.fileName || '').trim(),
    episodeTitle: c.episode ? String(c.episode?.title || c.episode?.fileName || c.title || '').trim() : '',
    title: c.title,
    note: '',
    ts: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

export const SHARED_BOOK_DATA_SYNC_PASS = 'v585-shared-book-data-sync-pass';

export async function persistAndSync(app) {
  persistBookData(app.state);
  if (!app?.state?.shared || typeof app?.api?.putShared !== 'function') {
    return Promise.resolve({ synced:false, reason:'shared-not-ready', pass:SHARED_BOOK_DATA_SYNC_PASS });
  }
  const { mergeSharedPatch, putSharedPatch } = await import('../sync/shared-state-write.mjs');
  const buildPatch = () => ({
    bookmarks: app.state.bookmarks,
    recents: app.state.recents,
    favorites: Array.from(app.state.favorites),
    userTags: normalizeUserTagList(app.state.userTags),
    novelUserTags: normalizeNovelUserTags(app.state.novelUserTags, app.state.userTags)
  });
  app.state.shared = mergeSharedPatch(app.state.shared, { ...buildPatch(), updatedAt:Date.now() });
  const previous = app.state.sharedBookDataSyncRequest || Promise.resolve();
  const request = Promise.resolve(previous).catch(()=>null).then(async()=>{
    const latest = buildPatch();
    try {
      const result = await putSharedPatch(app, latest);
      return { synced:result?.synced !== false, reason:result?.reason || '', shared:app.state.shared, pass:SHARED_BOOK_DATA_SYNC_PASS };
    } catch (error) {
      return { synced:false, reason:'request-failed', error, pass:SHARED_BOOK_DATA_SYNC_PASS };
    }
  });
  app.state.sharedBookDataSyncRequest = request;
  return request.finally(()=>{
    if (app.state.sharedBookDataSyncRequest === request) app.state.sharedBookDataSyncRequest = null;
  });
}
