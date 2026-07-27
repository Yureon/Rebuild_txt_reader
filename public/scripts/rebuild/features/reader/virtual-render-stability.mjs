import { applyVirtualScrollAnchor, captureVirtualScrollAnchor } from './virtual-scroll-stability.mjs';

export const READER_RENDER_WINDOW_ANCHOR_PASS = 'v278-reader-render-window-anchor-pass';

export function captureVirtualRenderWindowAnchor({ reader = null, rows = [], prefix = [], pendingScrollTarget = null, active = false, anchorOffsetPx = 36, preferBodyRows = true } = {}) {
  if (!reader || pendingScrollTarget || !active) return null;
  const anchor = captureVirtualScrollAnchor({ reader, rows, prefix, anchorOffsetPx, preferBodyRows });
  if (!anchor) return null;
  return {
    ...anchor,
    renderWindowAnchorPass: READER_RENDER_WINDOW_ANCHOR_PASS,
    capturedScrollTop: Math.round(Number(reader.scrollTop) || 0),
    capturedScrollHeight: Math.round(Number(reader.scrollHeight) || 0),
    capturedClientHeight: Math.round(Number(reader.clientHeight) || 0)
  };
}

export function restoreVirtualRenderWindowAnchor({ reader = null, rows = [], prefix = [], anchor = null, phase = 'post-render' } = {}) {
  if (!reader || !anchor) return null;
  const result = applyVirtualScrollAnchor({ reader, rows, prefix, anchor });
  return {
    ...(result || { applied: false, reason: 'unavailable' }),
    phase,
    renderWindowAnchorPass: anchor.renderWindowAnchorPass || READER_RENDER_WINDOW_ANCHOR_PASS,
    capturedScrollTop: Number.isFinite(Number(anchor.capturedScrollTop)) ? Number(anchor.capturedScrollTop) : null,
    currentScrollTop: Math.round(Number(reader.scrollTop) || 0)
  };
}

export function syncVirtualSpacerHeights(content = null, { topHeight = 0, bottomHeight = 0 } = {}) {
  if (!content) return { changed: false, topChanged: false, bottomChanged: false };
  const top = content.querySelector?.('.reader-virtual-top') || null;
  const bottom = content.querySelector?.('.reader-virtual-bottom') || null;
  const nextTop = `${Math.max(0, Math.round(Number(topHeight) || 0))}px`;
  const nextBottom = `${Math.max(0, Math.round(Number(bottomHeight) || 0))}px`;
  let topChanged = false;
  let bottomChanged = false;
  if (top && top.style.height !== nextTop) {
    top.style.height = nextTop;
    topChanged = true;
  }
  if (bottom && bottom.style.height !== nextBottom) {
    bottom.style.height = nextBottom;
    bottomChanged = true;
  }
  return { changed: topChanged || bottomChanged, topChanged, bottomChanged };
}
