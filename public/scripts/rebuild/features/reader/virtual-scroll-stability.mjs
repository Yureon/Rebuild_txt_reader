export const READER_VIRTUAL_SCROLL_STABILITY_PASS = 'v239-reader-virtual-scroll-stability-pass';
export const READER_MULTI_FILE_BODY_ANCHOR_PASS = 'v443-reader-multi-file-body-anchor-pass';

const DEFAULT_ANCHOR_OFFSET_PX = 36;
const MIN_SCROLL_ADJUST_PX = 1;
const BODY_ANCHOR_SEARCH_ROWS = 8;
const BODY_ANCHOR_SEARCH_MAX_PX = 1200;

export function captureVirtualScrollAnchor({ reader = null, rows = [], prefix = [], anchorOffsetPx = DEFAULT_ANCHOR_OFFSET_PX, preferBodyRows = true } = {}) {
  if (!reader || !Array.isArray(rows) || !rows.length || !Array.isArray(prefix) || prefix.length < 2) return null;
  const scrollTop = Math.max(0, Number(reader.scrollTop) || 0);
  const offset = Math.max(0, Number(anchorOffsetPx) || DEFAULT_ANCHOR_OFFSET_PX);
  const target = scrollTop + offset;
  const capturedRowIndex = findVirtualAnchorIndex(prefix, rows.length, target);
  const capturedRow = rows[capturedRowIndex] || null;
  if (!capturedRow) return null;
  const anchorCandidate = preferBodyRows
    ? resolveStableBodyAnchorCandidate({ rows, prefix, capturedRowIndex, target })
    : { row: capturedRow, rowIndex: capturedRowIndex, adjusted: false };
  const rowIndex = anchorCandidate.rowIndex;
  const row = anchorCandidate.row || capturedRow;
  return {
    pass: READER_VIRTUAL_SCROLL_STABILITY_PASS,
    bodyAnchorPass: READER_MULTI_FILE_BODY_ANCHOR_PASS,
    rowId: row.id || '',
    rowIndex,
    offsetPx: target - (Number(prefix[rowIndex]) || 0),
    anchorOffsetPx: offset,
    scrollTop,
    bodyAnchorAdjusted: !!anchorCandidate.adjusted,
    capturedRowId: capturedRow.id || '',
    capturedRowIndex
  };
}

export function applyVirtualScrollAnchor({ reader = null, rows = [], prefix = [], anchor = null } = {}) {
  if (!reader || !anchor || !Array.isArray(rows) || !rows.length || !Array.isArray(prefix) || prefix.length < 2) {
    return createScrollStabilityResult({ applied: false, reason: 'unavailable' });
  }
  const rowIndex = resolveAnchorRowIndex(rows, anchor);
  if (rowIndex < 0) return createScrollStabilityResult({ applied: false, reason: 'anchor row missing', anchor });
  const rowTop = Number(prefix[rowIndex]) || 0;
  const offsetPx = readAnchorOffsetPx(anchor);
  const anchorOffsetPx = Math.max(0, Number(anchor.anchorOffsetPx) || DEFAULT_ANCHOR_OFFSET_PX);
  const targetScrollTop = Math.max(0, Math.round(rowTop + offsetPx - anchorOffsetPx));
  const currentScrollTop = Math.max(0, Number(reader.scrollTop) || 0);
  const deltaPx = targetScrollTop - currentScrollTop;
  if (!Number.isFinite(deltaPx) || Math.abs(deltaPx) < MIN_SCROLL_ADJUST_PX) {
    return createScrollStabilityResult({ applied: false, reason: 'below threshold', anchor, rowIndex, deltaPx: 0 });
  }
  reader.scrollTop = targetScrollTop;
  return createScrollStabilityResult({ applied: true, reason: 'adjusted', anchor, rowIndex, deltaPx });
}

function resolveStableBodyAnchorCandidate({ rows = [], prefix = [], capturedRowIndex = -1, target = 0 } = {}) {
  const capturedRow = rows[capturedRowIndex] || null;
  if (!capturedRow || capturedRow.type === 'body') return { row: capturedRow, rowIndex: capturedRowIndex, adjusted: false };
  const forward = findNearestBodyAnchor(rows, prefix, capturedRowIndex, target, 1);
  const backward = findNearestBodyAnchor(rows, prefix, capturedRowIndex, target, -1);
  const chosen = chooseBodyAnchorCandidate(forward, backward);
  if (!chosen) return { row: capturedRow, rowIndex: capturedRowIndex, adjusted: false };
  return { row: chosen.row, rowIndex: chosen.rowIndex, adjusted: chosen.rowIndex !== capturedRowIndex };
}

function findNearestBodyAnchor(rows, prefix, startIndex, target, direction) {
  const step = direction < 0 ? -1 : 1;
  const startTop = Number(prefix[startIndex]) || 0;
  for (let distanceRows = 1; distanceRows <= BODY_ANCHOR_SEARCH_ROWS; distanceRows += 1) {
    const rowIndex = startIndex + (distanceRows * step);
    if (rowIndex < 0 || rowIndex >= rows.length) break;
    const row = rows[rowIndex] || null;
    const rowTop = Number(prefix[rowIndex]) || 0;
    if (Math.abs(rowTop - startTop) > BODY_ANCHOR_SEARCH_MAX_PX) break;
    if (row?.type !== 'body') continue;
    const distancePx = Math.abs(rowTop - target);
    const directionPenalty = step < 0 ? DEFAULT_ANCHOR_OFFSET_PX * 4 : 0;
    return { row, rowIndex, score: distancePx + directionPenalty };
  }
  return null;
}

function chooseBodyAnchorCandidate(forward = null, backward = null) {
  if (forward && backward) return forward.score <= backward.score ? forward : backward;
  return forward || backward || null;
}

function readAnchorOffsetPx(anchor) {
  const raw = Number(anchor?.offsetPx);
  if (!Number.isFinite(raw)) return 0;
  return anchor?.bodyAnchorAdjusted === true ? raw : Math.max(0, raw);
}

function resolveAnchorRowIndex(rows, anchor) {
  const rowId = String(anchor?.rowId || '');
  if (rowId) {
    const byId = rows.findIndex(row => row?.id === rowId);
    return byId >= 0 ? byId : -1;
  }
  const fallback = Math.round(Number(anchor?.rowIndex) || 0);
  return Math.max(-1, Math.min(rows.length - 1, fallback));
}

function findVirtualAnchorIndex(prefix, rowCount, target) {
  let lo = 0;
  let hi = Math.max(0, Math.min(rowCount, prefix.length - 1));
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((Number(prefix[mid + 1]) || 0) <= target) lo = mid + 1;
    else hi = mid;
  }
  return Math.max(0, Math.min(rowCount - 1, lo));
}

function createScrollStabilityResult({ applied = false, reason = '', anchor = null, rowIndex = -1, deltaPx = 0 } = {}) {
  return {
    pass: READER_VIRTUAL_SCROLL_STABILITY_PASS,
    bodyAnchorPass: anchor?.bodyAnchorPass || READER_MULTI_FILE_BODY_ANCHOR_PASS,
    applied: !!applied,
    reason,
    rowId: anchor?.rowId || '',
    rowIndex: Number.isFinite(Number(rowIndex)) ? Number(rowIndex) : -1,
    deltaPx: Math.round(Number(deltaPx) || 0),
    bodyAnchorAdjusted: anchor?.bodyAnchorAdjusted === true,
    capturedRowId: anchor?.capturedRowId || '',
    capturedRowIndex: Number.isFinite(Number(anchor?.capturedRowIndex)) ? Number(anchor.capturedRowIndex) : -1
  };
}
