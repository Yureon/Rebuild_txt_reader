import { compactLibraryVirtualHistoryRecord } from './library-virtual-history-record.mjs';
import { normalizeLibraryVirtualFallbackRecord } from './library-virtual-fallback-policy.mjs';

export const LIBRARY_VIRTUAL_RECORDING_RUNTIME_PASS = 'v293-library-virtual-recording-runtime-pass';
export const LIBRARY_VIRTUAL_LARGE_FALLBACK_RETRY_PASS = 'v674-library-virtual-large-fallback-retry-pass';
const DEFAULT_AUTO_FALLBACK_PERSIST_MAX_ROWS = 750;

function pushCappedHistory(state, key, record, limit) {
  if (!Array.isArray(state[key])) state[key] = [];
  state[key].push(record);
  const max = Math.max(1, Number(limit) || 20);
  if (state[key].length > max) state[key].splice(0, state[key].length - max);
  return state[key];
}

export function recordLibraryVirtualRenderRuntime(app, record, deps = {}) {
  const safe = { ...(record || {}), at: record?.at || Date.now(), recordingRuntimePass: LIBRARY_VIRTUAL_RECORDING_RUNTIME_PASS };
  app.state.libraryVirtualLastRender = safe;
  deps.recordLibraryVirtualTrialRender?.(app, safe);
  deps.recordLibraryVirtualSessionOptInRender?.(app, safe);
  pushCappedHistory(app.state, 'libraryVirtualRenderHistory', compactLibraryVirtualHistoryRecord(safe), deps.historyLimit);
  deps.notifyLibraryVirtualDiagnostics?.(app);
  return safe;
}

export function recordLibraryVirtualFallbackRuntime(app, record, deps = {}) {
  const safe = {
    ...normalizeLibraryVirtualFallbackRecord(record || {}),
    recordingRuntimePass: LIBRARY_VIRTUAL_RECORDING_RUNTIME_PASS
  };
  if (!safe.blocking) {
    deps.notifyLibraryVirtualDiagnostics?.(app);
    return safe;
  }
  app.state.libraryVirtualLastFallback = safe;
  const persistMaxRows = Math.max(1, Number(deps.autoFallbackPersistMaxRows) || DEFAULT_AUTO_FALLBACK_PERSIST_MAX_ROWS);
  const largeCollection = Number(safe.rowCount) > persistMaxRows;
  if (!largeCollection) {
    deps.persistLibraryVirtualAutoFallback?.(app, safe, {
      storageKey: deps.storageKey,
      defaultRolloutPass: deps.defaultRolloutPass
    });
  }
  safe.autoFallbackPersisted = !largeCollection;
  safe.largeFallbackRetryPass = largeCollection ? LIBRARY_VIRTUAL_LARGE_FALLBACK_RETRY_PASS : '';
  deps.recordLibraryVirtualTrialFallback?.(app, safe);
  deps.recordLibraryVirtualSessionOptInFallback?.(app, safe);
  pushCappedHistory(app.state, 'libraryVirtualFallbackHistory', compactLibraryVirtualHistoryRecord(safe), deps.historyLimit);
  deps.notifyLibraryVirtualDiagnostics?.(app);
  return safe;
}

export function getLibraryVirtualRecordingRuntimeContract() {
  return {
    pass: LIBRARY_VIRTUAL_RECORDING_RUNTIME_PASS,
    renderHistoryKey: 'libraryVirtualRenderHistory',
    fallbackHistoryKey: 'libraryVirtualFallbackHistory',
    lastRenderKey: 'libraryVirtualLastRender',
    lastFallbackKey: 'libraryVirtualLastFallback',
    sideEffects: ['state-history', 'diagnostics-dispatch', 'trial-record', 'session-record', 'auto-fallback-persist']
  };
}
