export const SEARCH_LIVE_DOM_DIAGNOSTICS_SNAPSHOT_PASS = 'v251-search-live-dom-diagnostics-snapshot-pass';
export const SEARCH_LIVE_DOM_RETRY_FIXTURE_BRIDGE_PASS = 'v252-search-live-dom-retry-fixture-bridge-pass';

function findLiveSearchRow(failure = {}, doc = typeof document !== 'undefined' ? document : null) {
  if (!doc?.querySelector) return null;
  const chunk = Number(failure.chunk);
  const index = Number(failure.index);
  const selectors = [];
  if (Number.isFinite(chunk)) selectors.push(`[data-chunk="${chunk}"]`, `[data-reader-chunk="${chunk}"]`);
  if (Number.isFinite(index)) selectors.push(`[data-search-index="${index}"]`, `[data-result-index="${index}"]`);
  for (const selector of selectors) {
    const row = doc.querySelector(selector);
    if (row) return row;
  }
  return null;
}

function countLiveSearchRows(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc?.querySelectorAll) return 0;
  try {
    return doc.querySelectorAll('[data-search-index], [data-result-index], .search-result-card').length || 0;
  } catch (_error) {
    return 0;
  }
}

function hasHighlightedMatch(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc?.querySelector) return false;
  return !!doc.querySelector('mark.search-hit, mark.reader-search-hit, .reader-search-hit, [data-search-highlight="active"], .search-result-card.active');
}

export function buildSearchLiveDomRetryDiagnosticsSnapshot(app = null, failure = {}, options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  const row = findLiveSearchRow(failure, doc);
  const highlighted = hasHighlightedMatch(doc);
  return {
    pass: SEARCH_LIVE_DOM_DIAGNOSTICS_SNAPSHOT_PASS,
    query: String(app?.state?.search?.query || failure.query || '').trim(),
    runId: Number(app?.state?.search?.runId || failure.runId || 0),
    index: Math.max(0, Number(failure.index) || 0),
    chunk: Math.max(1, Number(failure.chunk) || 1),
    retryMode: failure.retryMode || '',
    liveRowAvailable: !!row || !!failure.liveRowAvailable,
    highlightedMatch: highlighted || !!failure.highlightedMatch,
    liveRowDataset: row?.dataset ? { ...row.dataset } : null,
    liveRowCount: countLiveSearchRows(doc),
    retryCount: Math.max(0, Number(failure.retryCount || failure.retryAttempt || 0) || 0),
    finalReason: failure.reason || failure.expectedReason || '',
    fixtureBridgePass: SEARCH_LIVE_DOM_RETRY_FIXTURE_BRIDGE_PASS,
    at: Date.now()
  };
}

export function attachSearchLiveDomSnapshotToFailure(failure = {}, snapshot = {}) {
  return {
    ...failure,
    liveRowAvailable: !!snapshot.liveRowAvailable || !!failure.liveRowAvailable,
    highlightedMatch: !!snapshot.highlightedMatch || !!failure.highlightedMatch,
    liveDomDiagnosticsPass: snapshot.pass || SEARCH_LIVE_DOM_DIAGNOSTICS_SNAPSHOT_PASS,
    liveDomFixtureBridgePass: snapshot.fixtureBridgePass || SEARCH_LIVE_DOM_RETRY_FIXTURE_BRIDGE_PASS,
    liveRowCount: Number(snapshot.liveRowCount) || Number(failure.liveRowCount) || 0,
    retryCount: Number(snapshot.retryCount) || Number(failure.retryCount) || 0,
    finalReason: snapshot.finalReason || failure.finalReason || failure.reason || ''
  };
}

export function buildSearchJumpFailureFixtureBridge(failure = {}, snapshot = {}) {
  return {
    pass: SEARCH_LIVE_DOM_RETRY_FIXTURE_BRIDGE_PASS,
    index: Math.max(0, Number(failure.index) || 0),
    chunk: Math.max(1, Number(failure.chunk) || 1),
    retryMode: failure.retryMode || snapshot.retryMode || '',
    liveRowAvailable: !!failure.liveRowAvailable || !!snapshot.liveRowAvailable,
    highlightedMatch: !!failure.highlightedMatch || !!snapshot.highlightedMatch,
    liveRowCount: Number(snapshot.liveRowCount) || Number(failure.liveRowCount) || 0,
    retryCount: Number(snapshot.retryCount) || Number(failure.retryCount) || 0,
    finalReason: snapshot.finalReason || failure.reason || failure.finalReason || ''
  };
}
