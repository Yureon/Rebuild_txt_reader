export const READER_REQUEST_GUARDS_PASS = 'v244-reader-request-guards-pass';

export function resetReaderRequestScope(app, helpers = {}) {
  app.state.chunkFetchAbort?.abort?.();
  helpers.abortReaderPrefetch?.(app);
  app.state.readerManifestRequest = null;
  app.state.chunkFetchAbort = new AbortController();
  app.state.readerSessionId = (Number(app.state.readerSessionId) || 0) + 1;
  app.state.loadingChunks.clear();
  return app.state.readerSessionId;
}

export function manifestRequestKey(app, current) {
  const preprocess = app.state.prefs?.preprocess || {};
  return [
    current?.novel?.id || '',
    current?.episode?.id || 'single',
    preprocess.removeNoise ? 1 : 0,
    preprocess.chapterSpacing ? 1 : 0,
    preprocess.collapseBreaks ? 1 : 0,
    preprocess.splitDense ? 1 : 0,
    preprocess.dialogueBreak ? 1 : 0,
    preprocess.paragraphOptimize ? 1 : 0,
    preprocess.aggressive ? 1 : 0
  ].join('::');
}

export function isReaderRequestCurrent(app, { signal = null, sessionId = null, current = null, data = true } = {}) {
  if (signal?.aborted) return false;
  if (sessionId != null && sessionId !== app.state.readerSessionId) return false;
  if (current && current !== app.state.current) return false;
  return !!data;
}
