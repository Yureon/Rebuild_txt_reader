export const READER_CHUNK_WINDOW_PRUNE_HELPER_PASS = 'v219-reader-chunk-window-prune-helper-pass';

export function buildReaderChunkPrunePlan(chunks = [], visibleChunk = 1, maxLoadedChunks = 0) {
  const kept = Array.from(chunks || []).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const removed = [];
  const visible = Number(visibleChunk) || kept[0] || 1;
  const limit = Math.max(0, Number(maxLoadedChunks) || 0);
  while (kept.length > limit) {
    const first = kept[0];
    const last = kept[kept.length - 1];
    const remove = Math.abs(first - visible) > Math.abs(last - visible) ? first : last;
    removed.push(remove);
    kept.splice(kept.indexOf(remove), 1);
  }
  return { kept, removed };
}

export function sumRemovedChunkHeightBeforeVisible({ removed = [], visibleChunk = 1, getChunkHeight = null } = {}) {
  const visible = Number(visibleChunk) || 1;
  const readHeight = typeof getChunkHeight === 'function' ? getChunkHeight : () => 0;
  return removed
    .filter(chunk => Number(chunk) < visible)
    .reduce((sum, chunk) => sum + (Number(readHeight(chunk)) || 0), 0);
}
