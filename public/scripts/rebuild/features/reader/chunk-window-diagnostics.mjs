export const READER_CHUNK_WINDOW_DIAGNOSTICS_PASS = 'v218-reader-chunk-window-diagnostics-pass';
export const READER_CHUNK_WINDOW_EARLY_APPEND_PASS = 'v285-reader-chunk-window-early-append-pass';
export const READER_CHUNK_WINDOW_PC_ANCHOR_TUNING_PASS = 'v367-reader-chunk-window-pc-anchor-tuning-pass';

export const READER_CHUNK_WINDOW_EDGE_LIMITS = Object.freeze({
  minPx: 1600,
  viewportMultiplier: 2.35,
  maxPx: 5200,
  velocityBoostMaxPx: 2600,
  fastEdgeViewportMultiplier: 1.15,
  fastScrollSpeedPxPerMs: 1.35,
  veryFastScrollSpeedPxPerMs: 2.4,
  maxExtendBatch: 3
});

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

export function getReaderChunkWindowExtendEdgePx({ viewport = 0, velocity = 0 } = {}) {
  const v = Math.max(1, Number(viewport) || 0);
  const speed = Math.max(0, Number(velocity) || 0);
  const boost = clampNumber(Math.round(speed * 1500), 0, READER_CHUNK_WINDOW_EDGE_LIMITS.velocityBoostMaxPx);
  const base = Math.round(v * READER_CHUNK_WINDOW_EDGE_LIMITS.viewportMultiplier);
  return clampNumber(base + boost, READER_CHUNK_WINDOW_EDGE_LIMITS.minPx, READER_CHUNK_WINDOW_EDGE_LIMITS.maxPx + READER_CHUNK_WINDOW_EDGE_LIMITS.velocityBoostMaxPx);
}

export function getReaderChunkWindowExtendBatchSize({ viewport = 0, velocity = 0, edgeDistance = 0 } = {}) {
  const v = Math.max(1, Number(viewport) || 0);
  const speed = Math.max(0, Number(velocity) || 0);
  if (speed >= READER_CHUNK_WINDOW_EDGE_LIMITS.veryFastScrollSpeedPxPerMs) return 3;
  if (speed >= READER_CHUNK_WINDOW_EDGE_LIMITS.fastScrollSpeedPxPerMs) return 2;
  return Number(edgeDistance) < v * READER_CHUNK_WINDOW_EDGE_LIMITS.fastEdgeViewportMultiplier ? 2 : 1;
}

export function getReaderChunkWindowWarmRadius(velocity = 0) {
  const speed = Math.max(0, Number(velocity) || 0);
  if (speed >= READER_CHUNK_WINDOW_EDGE_LIMITS.veryFastScrollSpeedPxPerMs) return 7;
  if (speed >= READER_CHUNK_WINDOW_EDGE_LIMITS.fastScrollSpeedPxPerMs) return 6;
  return 4;
}

export function buildReaderChunkWindowPruneSummary({ chunks = [], visible = 1, maxLoadedChunks = 0, removed = [] } = {}) {
  return {
    total: Array.isArray(chunks) ? chunks.length : 0,
    visible: Number(visible) || 1,
    maxLoadedChunks: Number(maxLoadedChunks) || 0,
    removed: Array.isArray(removed) ? [...removed] : []
  };
}
