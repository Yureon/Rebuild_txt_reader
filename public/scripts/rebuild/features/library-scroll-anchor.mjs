import { getLibraryRowKeyFromElement } from './library-row-diagnostics.mjs';

export const LIBRARY_SCROLL_ANCHOR_BOTTOM_CLAMP_PASS = 'v511-library-scroll-anchor-bottom-clamp-pass';
export const LIBRARY_SCROLL_ANCHOR_VIRTUAL_BOTTOM_RETAIN_PASS = 'v517-library-scroll-anchor-virtual-bottom-retain-pass';

function getLibraryMaxScrollTop(box) {
  const scrollHeight = Math.max(0, Number(box?.scrollHeight) || 0);
  const clientHeight = Math.max(0, Number(box?.clientHeight) || 0);
  return Math.max(0, scrollHeight - clientHeight);
}

function getLibraryBottomDistance(box) {
  const max = getLibraryMaxScrollTop(box);
  const scrollTop = Math.max(0, Number(box?.scrollTop) || 0);
  return Math.max(0, Math.round(max - Math.min(max, scrollTop)));
}

function getLibraryBottomRetainThreshold(box) {
  const clientHeight = Math.max(0, Number(box?.clientHeight) || 0);
  return Math.max(96, Math.min(240, Math.round(clientHeight * 0.35) || 160));
}

function clampLibraryScrollTop(box, value) {
  const next = Math.max(0, Number(value) || 0);
  return Math.min(getLibraryMaxScrollTop(box), next);
}

function setLibraryScrollTopIfNeeded(box, value, thresholdPx = 1) {
  const next = clampLibraryScrollTop(box, value);
  const current = Math.max(0, Number(box?.scrollTop) || 0);
  if (Math.abs(current - next) <= thresholdPx) return false;
  box.scrollTop = next;
  return true;
}

export function findLibraryRowElementByKey(box, key) {
  if (!box || !key) return null;
  const rows = Array.from(box.querySelectorAll('.cat-header,.novel-item,.ep-item'));
  return rows.find(el => getLibraryRowKeyFromElement(el) === key) || null;
}

export function getLibraryScrollAnchor(app) {
  const box = app?.els?.novelList || null;
  if (!box) return null;
  const rows = Array.from(box.querySelectorAll('.cat-header,.novel-item,.ep-item'));
  if (!rows.length) return {
    key: '',
    offset: 0,
    scrollTop: Math.max(0, Number(box.scrollTop) || 0),
    rowCount: 0,
    capturedAt: Date.now()
  };
  let boxTop = 0;
  try { boxTop = box.getBoundingClientRect?.().top || 0; } catch {}
  let candidate = null;
  for (const el of rows) {
    let rect = null;
    try { rect = el.getBoundingClientRect?.(); } catch {}
    if (!rect) continue;
    if (rect.bottom >= boxTop + 1) {
      candidate = { el, rect };
      break;
    }
  }
  if (!candidate) {
    const last = rows[rows.length - 1];
    candidate = { el: last, rect: last.getBoundingClientRect?.() || { top: boxTop } };
  }
  const scrollTop = Math.max(0, Number(box.scrollTop) || 0);
  const bottomDistance = getLibraryBottomDistance(box);
  const bottomRetainThreshold = getLibraryBottomRetainThreshold(box);
  return {
    key: getLibraryRowKeyFromElement(candidate.el),
    offset: Math.round((candidate.rect?.top || boxTop) - boxTop),
    scrollTop,
    rowCount: rows.length,
    virtual: box.dataset?.libraryVirtualActive === '1',
    bottomDistance,
    bottomRetainThreshold,
    nearBottom: bottomDistance <= bottomRetainThreshold,
    capturedAt: Date.now()
  };
}

export function restoreLibraryScrollAnchor(app, anchor, options = {}) {
  const box = app?.els?.novelList || null;
  if (!box || !anchor) return false;
  const thresholdPx = Math.max(1, Math.round(Number(options.anchorThresholdPx) || 1));
  if (options.preferBottomEdge && anchor.nearBottom) {
    const bottomDistance = Math.max(0, Number(anchor.bottomDistance) || 0);
    const target = getLibraryMaxScrollTop(box) - bottomDistance;
    const applied = setLibraryScrollTopIfNeeded(box, target, Math.max(2, thresholdPx));
    if (app?.state) {
      app.state.libraryScrollAnchorLastRestore = {
        pass: LIBRARY_SCROLL_ANCHOR_VIRTUAL_BOTTOM_RETAIN_PASS,
        mode: 'bottom-edge-retain',
        applied,
        bottomDistance: Math.round(bottomDistance),
        thresholdPx,
        scrollTopAfter: Math.round(Number(box.scrollTop) || 0),
        at: Date.now()
      };
    }
    return true;
  }
  if (!anchor.key) {
    if (options.skipMissingAnchorFallback) return false;
    const applied = setLibraryScrollTopIfNeeded(box, anchor.scrollTop, thresholdPx);
    if (app?.state) {
      app.state.libraryScrollAnchorLastRestore = { mode: 'fallback-scrollTop', applied, thresholdPx, at: Date.now() };
    }
    return true;
  }
  const row = findLibraryRowElementByKey(box, anchor.key);
  if (!row) {
    if (options.skipMissingAnchorFallback) return false;
    const applied = setLibraryScrollTopIfNeeded(box, anchor.scrollTop, Math.max(2, thresholdPx));
    if (app?.state) {
      app.state.libraryScrollAnchorLastRestore = { mode: 'missing-row-fallback-scrollTop', applied, thresholdPx, at: Date.now() };
    }
    return false;
  }
  let boxTop = 0;
  let rowTop = 0;
  try {
    boxTop = box.getBoundingClientRect?.().top || 0;
    rowTop = row.getBoundingClientRect?.().top || boxTop;
  } catch {}
  const delta = Math.round(rowTop - boxTop - (Number(anchor.offset) || 0));
  let applied = false;
  if (Math.abs(delta) > thresholdPx) {
    applied = setLibraryScrollTopIfNeeded(box, (Number(box.scrollTop) || 0) + delta, thresholdPx);
  }
  if (app?.state) {
    app.state.libraryScrollAnchorLastRestore = {
      mode: 'row-anchor',
      applied,
      delta,
      thresholdPx,
      key: anchor.key || '',
      scrollTopAfter: Math.round(Number(box.scrollTop) || 0),
      at: Date.now()
    };
  }
  return true;
}
