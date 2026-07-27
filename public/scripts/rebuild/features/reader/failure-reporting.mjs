export const READER_FAILURE_REPORTING_PASS = 'v247-reader-failure-reporting-pass';

function serializeReaderError(error) {
  return {
    name: error?.name || 'Error',
    message: error?.message || String(error || 'unknown error'),
    abort: error?.name === 'AbortError'
  };
}

export function buildReaderChunkFailureReport(app = null, error = null, context = {}) {
  const current = app?.state?.current || null;
  return {
    pass: READER_FAILURE_REPORTING_PASS,
    type: 'chunk-load-failure',
    chunk: Number(context.targetChunk) || Number(current?.chunk) || null,
    mode: context.mode || 'replace',
    novelId: current?.novel?.id || null,
    episodeId: current?.episode?.id || null,
    online: typeof navigator === 'undefined' ? null : navigator.onLine !== false,
    error: serializeReaderError(error),
    at: Date.now()
  };
}

export function buildReaderManifestFailureReport(app = null, error = null, context = {}) {
  const current = app?.state?.current || null;
  return {
    pass: READER_FAILURE_REPORTING_PASS,
    type: 'manifest-load-failure',
    requestKey: context.key || '',
    novelId: current?.novel?.id || null,
    episodeId: current?.episode?.id || null,
    error: serializeReaderError(error),
    at: Date.now()
  };
}

export function rememberReaderFailureReport(app = null, report = null, limit = 8) {
  if (!app?.state || !report) return report;
  const list = Array.isArray(app.state.readerFailureReports) ? app.state.readerFailureReports.slice() : [];
  list.push(report);
  app.state.readerFailureReports = list.slice(-Math.max(1, Number(limit) || 8));
  app.state.readerLastFailureReport = report;
  return report;
}
