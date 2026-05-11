import { ensureVirtualState } from './virtual-layout.mjs';

export const READER_SCROLL_COAST_CHUNK_WINDOW_PASS = 'v281-reader-scroll-coast-chunk-window-pass';
const SCROLL_COAST_PRUNE_IDLE_GRACE_MS = 220;

function isScrollCoasting(v, now = Date.now()) {
  return now < (Number(v?.userScrollActiveUntil) || 0);
}

export function resolveScrollCoastChunkBatch(app, reader, requestedBatch = 1, meta = {}) {
  const v = ensureVirtualState(app);
  const now = Date.now();
  const requested = Math.max(1, Math.round(Number(requestedBatch) || 1));
  const active = isScrollCoasting(v, now);
  const resolved = active ? 1 : requested;
  v.scrollCoastChunkWindowPass = READER_SCROLL_COAST_CHUNK_WINDOW_PASS;
  v.lastScrollCoastChunkWindow = {
    pass: READER_SCROLL_COAST_CHUNK_WINDOW_PASS,
    active,
    requestedBatch: requested,
    resolvedBatch: resolved,
    mode: meta.mode || '',
    edgeDistance: Math.round(Number(meta.edgeDistance) || 0),
    velocityPxMs: Math.round((Number(meta.velocityPxMs) || 0) * 1000) / 1000,
    scrollTop: Math.round(Number(reader?.scrollTop) || 0),
    viewport: Math.round(Number(reader?.clientHeight) || 0),
    activeUntil: Number(v.userScrollActiveUntil) || 0,
    remainingActiveMs: active ? Math.max(0, Math.round((Number(v.userScrollActiveUntil) || 0) - now)) : 0,
    at: now
  };
  return resolved;
}

export function getScrollCoastPruneDelay(app) {
  const v = ensureVirtualState(app);
  const now = Date.now();
  if (!isScrollCoasting(v, now)) return 0;
  return Math.max(SCROLL_COAST_PRUNE_IDLE_GRACE_MS, Math.round((Number(v.userScrollActiveUntil) || 0) - now + SCROLL_COAST_PRUNE_IDLE_GRACE_MS));
}

export function recordScrollCoastPrune(app, payload = {}) {
  const v = ensureVirtualState(app);
  v.scrollCoastChunkWindowPass = READER_SCROLL_COAST_CHUNK_WINDOW_PASS;
  v.lastScrollCoastPrune = {
    pass: READER_SCROLL_COAST_CHUNK_WINDOW_PASS,
    ...payload,
    activeUntil: Number(v.userScrollActiveUntil) || 0,
    at: Date.now()
  };
  return v.lastScrollCoastPrune;
}
