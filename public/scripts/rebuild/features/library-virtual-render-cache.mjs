export const LIBRARY_VIRTUAL_RENDER_CACHE_SPLIT_PASS = 'v205-library-virtual-render-cache-split-pass';
export const LIBRARY_VIRTUAL_SCROLL_WINDOW_HOLD_PASS = 'v509-library-virtual-scroll-window-hold-pass';
export const LIBRARY_VIRTUAL_SCROLL_BOTTOM_EDGE_HOLD_PASS = 'v511-library-virtual-scroll-bottom-edge-hold-pass';
export const LIBRARY_VIRTUAL_SCROLL_EARLY_EDGE_REFRESH_PASS = 'v518-library-virtual-scroll-early-edge-refresh-pass';

const DEFAULT_ROWS_CACHE_PASS = 'v141-library-rows-cache-pass';
const DEFAULT_RENDER_WINDOW_SKIP_PASS = 'v141-library-render-window-skip-pass';

export function getLibraryVirtualWindowRenderSignature(rowsInfo, windowPlan, options = {}) {
  const rowsPass = options.rowsCachePass || DEFAULT_ROWS_CACHE_PASS;
  const visibleRows = Array.isArray(rowsInfo?.visibleRows) ? rowsInfo.visibleRows : [];
  const start = Math.max(0, Number(windowPlan?.renderStart) || 0);
  const end = Math.max(start, Number(windowPlan?.renderEnd) || start);
  const first = visibleRows[start]?.key || '';
  const last = end > start ? (visibleRows[end - 1]?.key || '') : '';
  return [
    rowsInfo?.pass || rowsPass,
    visibleRows.length,
    start,
    end,
    Math.round(Number(windowPlan?.rowHeight) || 0),
    Math.round(Number(windowPlan?.topSpacerHeight) || 0),
    Math.round(Number(windowPlan?.bottomSpacerHeight) || 0),
    rowsInfo?.activeKey || '',
    first,
    last
  ].join('::');
}

export function shouldSkipLibraryVirtualDomRender(app, box, options, signature, windowPlan = {}, rowsInfo = {}) {
  if (options?.source !== 'virtual-scroll') return false;
  if (options?.resetScroll || options?.scrollAnchor || options?.followActive) return false;
  if (!box || box.dataset?.libraryVirtualActive !== '1') return false;
  const cached = app?.state?.libraryVirtualWindowRenderCache || null;
  if (!signature || !cached) return false;
  if (cached.signature === signature) return true;
  const hold = resolveVisibleRangeCachedWindowHold(cached, windowPlan, rowsInfo);
  if (hold.hold) {
    if (app?.state) {
      app.state.libraryVirtualLastScrollWindowHold = {
        pass: hold.pass,
        reason: hold.reason,
        visibleStart: Number(windowPlan.visibleStart) || 0,
        visibleEnd: Number(windowPlan.visibleEnd) || 0,
        renderStart: Number(cached.renderStart) || 0,
        renderEnd: Number(cached.renderEnd) || 0,
        at: Date.now()
      };
    }
    return true;
  }
  return false;
}

function resolveVisibleRangeCachedWindowHold(cached = {}, windowPlan = {}, rowsInfo = {}) {
  const totalRows = Number(rowsInfo?.visibleRows?.length) || Number(windowPlan.totalRows) || 0;
  if (!totalRows || Number(cached.totalRows) !== totalRows) return { hold:false, reason:'row-count-mismatch', pass: LIBRARY_VIRTUAL_SCROLL_WINDOW_HOLD_PASS };
  if (String(cached.activeKey || '') !== String(rowsInfo?.activeKey || '')) return { hold:false, reason:'active-key-mismatch', pass: LIBRARY_VIRTUAL_SCROLL_WINDOW_HOLD_PASS };
  const visibleStart = Math.max(0, Math.floor(Number(windowPlan.visibleStart) || 0));
  const visibleEnd = Math.max(visibleStart, Math.ceil(Number(windowPlan.visibleEnd) || visibleStart));
  const cachedStart = Math.max(0, Math.floor(Number(cached.renderStart) || 0));
  const cachedEnd = Math.max(cachedStart, Math.ceil(Number(cached.renderEnd) || cachedStart));
  const margin = Math.max(12, Math.min(32, Math.floor((cachedEnd - cachedStart) * 0.18)));
  if (visibleEnd >= totalRows && cachedEnd >= totalRows && visibleStart >= cachedStart + margin) {
    return { hold:true, reason:'bottom-edge-inside-cached-window', pass: LIBRARY_VIRTUAL_SCROLL_BOTTOM_EDGE_HOLD_PASS };
  }
  if (visibleStart >= cachedStart + margin && visibleEnd <= cachedEnd - margin) {
    return { hold:true, reason:'visible-range-inside-cached-window', pass: LIBRARY_VIRTUAL_SCROLL_WINDOW_HOLD_PASS };
  }
  return { hold:false, reason:'visible-range-near-cached-window-edge', pass: LIBRARY_VIRTUAL_SCROLL_EARLY_EDGE_REFRESH_PASS };
}

function isVisibleRangeInsideCachedWindow(cached = {}, windowPlan = {}, rowsInfo = {}) {
  return resolveVisibleRangeCachedWindowHold(cached, windowPlan, rowsInfo).hold;
}

export function rememberLibraryVirtualWindowRender(app, signature, windowPlan, rowsInfo, renderedRows, options = {}) {
  if (!app?.state) return null;
  const pass = options.renderWindowSkipPass || DEFAULT_RENDER_WINDOW_SKIP_PASS;
  const next = {
    signature,
    pass,
    totalRows: Number(rowsInfo?.visibleRows?.length) || 0,
    renderedRows: Number(renderedRows) || 0,
    renderStart: Number(windowPlan?.renderStart) || 0,
    renderEnd: Number(windowPlan?.renderEnd) || 0,
    visibleStart: Number(windowPlan?.visibleStart) || 0,
    visibleEnd: Number(windowPlan?.visibleEnd) || 0,
    rowHeight: Number(windowPlan?.rowHeight) || 0,
    activeKey: rowsInfo?.activeKey || '',
    at: Date.now()
  };
  app.state.libraryVirtualWindowRenderCache = next;
  return next;
}
