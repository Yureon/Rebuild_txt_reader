import { clamp } from '../../core/utils.mjs';

export const READER_OPEN_STATE_BOUNDARY_PASS = 'v246-reader-open-state-boundary-pass';

export function clearReaderOpenDeferredTimers(app) {
  globalThis.clearTimeout?.(app.state.readerSliderCoastThumbSettleTimer || 0);
  globalThis.clearTimeout?.(app.state.readerSliderMeasureRefreshTimer || 0);
  app.state.readerSliderCoastThumbSettleTimer = 0;
  app.state.readerSliderMeasureRefreshTimer = 0;
  const virtual = app.state.readerVirtual;
  for (const timer of virtual?.viewportTransitionTimers || []) globalThis.clearTimeout?.(timer);
  if (virtual) {
    virtual.viewportTransitionTimers = [];
    virtual.pendingViewportTransitionAnchor = null;
  }
}

export function findReaderEpisode(novel, episodeId) {
  if (!episodeId || !Array.isArray(novel?.episodes)) return null;
  return novel.episodes.find(e => e.id === episodeId) || null;
}

export function buildReaderOpenCurrentState(novel, opts = {}) {
  const episode = novel?.isMultiFile ? findReaderEpisode(novel, opts.episodeId) || novel.episodes?.[0] || null : null;
  const episodeIdx = episode ? Math.max(0, (novel.episodes || []).findIndex(e => e.id === episode.id)) : 0;
  const current = {
    novel,
    episode,
    episodeIdx,
    chunk: Number(opts.chunk) === -1 ? -1 : Math.max(1, Number(opts.chunk) || 1),
    totalChunks: Math.max(1, Number(opts.totalChunks) || 1),
    title: episode ? `${novel.title} · ${episode.title}` : novel.title,
    ratio: clamp(opts.ratio || 0, 0, 1)
  };
  return {
    pass: READER_OPEN_STATE_BOUNDARY_PASS,
    episode,
    episodeIdx,
    current
  };
}

export function resetReaderOpenRuntimeState(app, hooks = {}) {
  clearReaderOpenDeferredTimers(app);
  app.state.loadedChunks.clear();
  app.state.chunkTextCache.clear();
  hooks.resetCoordinateState?.(app, { clearKnown: true, ...(hooks.resetCoordinateOptions || {}) });
  app.state.search.highlights = null;
  hooks.resetVirtualDocument?.(app, { clearMeasures: true });
  hooks.setToolbarTitle?.(app, app.state.current?.title || '');
  hooks.showReader?.(app, 'reader');
  app.closeSidebar?.();
}
