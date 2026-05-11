export const READER_ACTIVE_RENDER_WINDOW_PIN_PASS = 'v279-reader-active-render-window-pin-pass';

export function resolveStableVirtualRenderRange({
  force = false,
  active = false,
  naturalStart = 0,
  naturalEnd = 0,
  renderedStart = -1,
  renderedEnd = -1,
  rowCount = 0,
  maxRows = 300,
  scrollTop = 0,
  previousScrollTop = 0
} = {}) {
  const count = Math.max(0, Math.round(Number(rowCount) || 0));
  const nextStart = clampIndex(naturalStart, count);
  const nextEnd = clampEnd(naturalEnd, nextStart, count);
  const currentStart = Math.max(0, Math.round(Number(renderedStart) || 0));
  const currentEnd = Math.max(currentStart, Math.round(Number(renderedEnd) || 0));
  const currentValid = currentEnd > currentStart && currentStart < count;
  if (force || !active || !currentValid || !count) {
    return buildRange(nextStart, nextEnd, false, 'natural', { naturalStart: nextStart, naturalEnd: nextEnd });
  }
  const overlaps = nextStart <= currentEnd && nextEnd >= currentStart;
  if (!overlaps) {
    return buildRange(nextStart, nextEnd, false, 'non-overlap', { naturalStart: nextStart, naturalEnd: nextEnd });
  }
  const limit = Math.max(1, Math.round(Number(maxRows) || 300));
  let start = Math.min(currentStart, nextStart);
  let end = Math.max(currentEnd, nextEnd);
  let truncated = false;
  if (end - start > limit) {
    truncated = true;
    const direction = Number(scrollTop) >= Number(previousScrollTop) ? 'down' : 'up';
    if (direction === 'down') {
      end = Math.max(end, nextEnd);
      start = Math.max(0, end - limit);
      if (start > nextStart) start = nextStart;
      if (end - start > limit) start = Math.max(0, end - limit);
    } else {
      start = Math.min(start, nextStart);
      end = Math.min(count, start + limit);
      if (end < nextEnd) end = nextEnd;
      if (end - start > limit) end = Math.min(count, start + limit);
    }
  }
  start = clampIndex(start, count);
  end = clampEnd(end, start, count);
  return buildRange(start, end, true, truncated ? 'active-pinned-truncated' : 'active-pinned', {
    naturalStart: nextStart,
    naturalEnd: nextEnd,
    previousStart: currentStart,
    previousEnd: currentEnd,
    maxRows: limit,
    truncated
  });
}

function buildRange(start, end, pinned, reason, meta = {}) {
  return {
    pass: READER_ACTIVE_RENDER_WINDOW_PIN_PASS,
    start,
    end,
    pinned: !!pinned,
    reason,
    rows: Math.max(0, end - start),
    ...meta
  };
}

function clampIndex(value, rowCount) {
  const count = Math.max(0, Math.round(Number(rowCount) || 0));
  if (!count) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(Number(value) || 0)));
}

function clampEnd(value, start, rowCount) {
  const count = Math.max(0, Math.round(Number(rowCount) || 0));
  if (!count) return 0;
  return Math.max(Math.min(count, start + 1), Math.min(count, Math.round(Number(value) || 0)));
}
