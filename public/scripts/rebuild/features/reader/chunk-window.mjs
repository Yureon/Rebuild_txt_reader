import { limitMapSize } from '../../core/utils.mjs';
import { MAX_CHUNK_TEXT_CACHE, MAX_LOADED_CHUNKS } from './constants.mjs';
import { captureVirtualViewportAnchor, ensureVirtualState, extendScrollBufferAppendInertia, getChunkBounds, getVisibleChunk, rebuildVirtualRows, restoreVirtualViewportAnchor, resolveAppendPruneDeferral, shouldFreezeNativeSettledScroll } from './virtual-layout.mjs';
import { getReaderChunkWindowExtendBatchSize, getReaderChunkWindowExtendEdgePx, getReaderChunkWindowWarmRadius } from './chunk-window-diagnostics.mjs';
import { buildReaderChunkPrunePlan, sumRemovedChunkHeightBeforeVisible } from './chunk-window-prune.mjs';
import { pruneEstimatedCoordinateChunks } from './coordinates.mjs';
import { getScrollCoastPruneDelay, recordScrollCoastPrune, resolveScrollCoastChunkBatch } from './chunk-window-scroll-budget.mjs';

export const READER_CHUNK_WINDOW_BUFFER_PASS = 'v147-reader-chunk-window-buffer-pass';
const READER_VELOCITY_CHUNK_WINDOW_PASS = 'v149-reader-velocity-chunk-window-pass';
const MAX_EXTEND_BATCH = 3;
const READER_SCROLL_COAST_PRUNE_SOURCE = 'scroll-coast-prune';

export function chunkKey(c, chunk) {
  return `${c.novel.id}:${c.episode?.id || 'single'}:${chunk}`;
}

export async function maybeExtendChunks(app, loadChunk) {
  const reader = app.els.reader;
  const c = app.state.current;
  const v = ensureVirtualState(app);
  if (!reader || !c || v.extending || app.state.loadingChunks.size || typeof loadChunk !== 'function') return;
  const chunks = Array.from(app.state.loadedChunks.keys()).sort((a, b) => a - b);
  if (!chunks.length) return;
  const edgePx = getReaderChunkExtendEdgePx(app, reader);
  const remainingBottom = reader.scrollHeight - reader.scrollTop - reader.clientHeight;
  const nearBottom = remainingBottom < edgePx;
  const nearTop = reader.scrollTop < edgePx;
  const direction = getReaderScrollDirection(app, reader);
  const minChunk = chunks[0];
  const maxChunk = chunks[chunks.length - 1];
  if (!nearBottom && !nearTop) {
    warmAheadFromScroll(app, { direction, source: 'scroll-buffer-idle' });
    return;
  }
  try {
    v.extending = true;
    v.bufferPass = READER_CHUNK_WINDOW_BUFFER_PASS;
    v.velocityBufferPass = READER_VELOCITY_CHUNK_WINDOW_PASS;
    if (nearBottom && maxChunk < c.totalChunks && direction !== 'backward') {
      extendScrollBufferAppendInertia(app, { source: READER_CHUNK_WINDOW_BUFFER_PASS, direction: 'forward', targetChunk: maxChunk + 1, remainingBottom, edgePx });
      await extendChunkSide(app, loadChunk, 'append', maxChunk + 1, c.totalChunks, resolveExtendBatchSize(app, reader, 'append', remainingBottom));
      warmAheadFromScroll(app, { direction: 'forward', source: 'scroll-buffer-bottom' });
      schedulePruneChunkWindow(app, { source: 'scroll-buffer-bottom' });
    } else if (nearTop && minChunk > 1 && direction !== 'forward') {
      await extendChunkSide(app, loadChunk, 'prepend', minChunk - 1, 1, resolveExtendBatchSize(app, reader, 'prepend', reader.scrollTop));
      warmAheadFromScroll(app, { direction: 'backward', source: 'scroll-buffer-top' });
      schedulePruneChunkWindow(app, { source: 'scroll-buffer-top' });
    } else {
      warmAheadFromScroll(app, { direction, source: 'scroll-buffer-edge' });
    }
  } finally {
    v.extending = false;
  }
}

async function extendChunkSide(app, loadChunk, mode, firstChunk, boundaryChunk, batchSize = 1) {
  let target = Number(firstChunk);
  const step = mode === 'prepend' ? -1 : 1;
  const maxJobs = Math.max(1, Math.min(MAX_EXTEND_BATCH, Number(batchSize) || 1));
  for (let i = 0; i < maxJobs; i += 1) {
    if (mode === 'append' && target > boundaryChunk) break;
    if (mode === 'prepend' && target < boundaryChunk) break;
    if (app.state.loadedChunks?.has(target)) {
      target += step;
      continue;
    }
    await loadChunk(target, mode, { source: READER_CHUNK_WINDOW_BUFFER_PASS });
    target += step;
    if (app.state.loadingChunks?.size) break;
  }
}


function getReaderChunkExtendEdgePx(app, reader) {
  return getReaderChunkWindowExtendEdgePx({ viewport: reader?.clientHeight, velocity: getReaderScrollVelocity(app) });
}

function getExtendBatchSize(app, reader, edgeDistance) {
  return getReaderChunkWindowExtendBatchSize({ viewport: reader?.clientHeight, velocity: getReaderScrollVelocity(app), edgeDistance });
}

function resolveExtendBatchSize(app, reader, mode, edgeDistance) {
  const velocity = getReaderScrollVelocity(app);
  const requested = getReaderChunkWindowExtendBatchSize({ viewport: reader?.clientHeight, velocity, edgeDistance });
  return resolveScrollCoastChunkBatch(app, reader, requested, { mode, edgeDistance, velocityPxMs: velocity });
}

function getReaderScrollDirection(app, reader) {
  const v = ensureVirtualState(app);
  const top = Number(reader?.scrollTop) || 0;
  const now = Date.now();
  const prev = Number(v.lastScrollBufferTop);
  const prevAt = Number(v.lastScrollBufferAt) || 0;
  v.lastScrollBufferTop = top;
  v.lastScrollBufferAt = now;
  v.velocityBufferPass = READER_VELOCITY_CHUNK_WINDOW_PASS;
  if (!Number.isFinite(prev)) {
    v.lastScrollBufferVelocityPxMs = 0;
    v.lastScrollBufferDirection = v.lastScrollBufferDirection || 'forward';
    return v.lastScrollBufferDirection;
  }
  const dt = Math.max(1, now - prevAt);
  const delta = top - prev;
  v.lastScrollBufferVelocityPxMs = Math.abs(delta) / dt;
  if (delta < -12) {
    v.lastScrollBufferDirection = 'backward';
    return 'backward';
  }
  if (delta > 12) {
    v.lastScrollBufferDirection = 'forward';
    return 'forward';
  }
  return v.lastScrollBufferDirection || 'forward';
}

function getReaderScrollVelocity(app) {
  const v = ensureVirtualState(app);
  return Math.max(0, Number(v.lastScrollBufferVelocityPxMs) || 0);
}

function warmAheadFromScroll(app, { direction = 'forward', source = 'scroll-buffer' } = {}) {
  const current = app.state.current;
  if (!current || !app.readerPrefetch?.warm) return;
  const now = Date.now();
  const v = ensureVirtualState(app);
  const centerChunk = getVisibleChunk(app) || Number(current.chunk) || 1;
  const dir = direction === 'backward' ? 'backward' : 'forward';
  const signature = `${current.novel?.id || ''}:${current.episode?.id || 'single'}:${centerChunk}:${dir}`;
  if (v.lastScrollWarmSignature === signature && now - (Number(v.lastScrollWarmAt) || 0) < 500) return;
  v.lastScrollWarmSignature = signature;
  v.lastScrollWarmAt = now;
  v.lastScrollBufferDirection = dir;
  const velocity = getReaderScrollVelocity(app);
  const radius = getReaderChunkWindowWarmRadius(velocity);
  app.readerPrefetch.warm(centerChunk, { direction: dir, radius, source, pass: READER_CHUNK_WINDOW_BUFFER_PASS, velocityBufferPass: READER_VELOCITY_CHUNK_WINDOW_PASS });
}

export function schedulePruneChunkWindow(app, options = {}) {
  const chunks = Array.from(app.state.loadedChunks.keys()).sort((a,b) => a-b);
  if (chunks.length <= MAX_LOADED_CHUNKS) return;
  const v = ensureVirtualState(app);
  const delay = getScrollCoastPruneDelay(app);
  window.clearTimeout(v.scrollCoastPruneTimer || 0);
  const appendPruneGate = resolveAppendPruneDeferral(app, {
    force: options.force === true,
    phase: 'chunk-window-prune-schedule',
    loadedChunks: chunks.length,
    maxLoadedChunks: MAX_LOADED_CHUNKS
  });
  if (appendPruneGate?.defer) {
    recordScrollCoastPrune(app, { deferred: true, delayMs: appendPruneGate.delayMs, appendCorrectionGuardPass: appendPruneGate.pass, loadedChunks: chunks.length, maxLoadedChunks: MAX_LOADED_CHUNKS, source: options.source || READER_SCROLL_COAST_PRUNE_SOURCE, reason: appendPruneGate.reason });
    v.scrollCoastPruneTimer = window.setTimeout(() => {
      v.scrollCoastPruneTimer = 0;
      schedulePruneChunkWindow(app, { source: READER_SCROLL_COAST_PRUNE_SOURCE });
    }, appendPruneGate.delayMs);
    return;
  }
  if (delay > 0 && !options.force) {
    recordScrollCoastPrune(app, { deferred: true, delayMs: delay, loadedChunks: chunks.length, maxLoadedChunks: MAX_LOADED_CHUNKS, source: options.source || READER_SCROLL_COAST_PRUNE_SOURCE });
    v.scrollCoastPruneTimer = window.setTimeout(() => {
      v.scrollCoastPruneTimer = 0;
      schedulePruneChunkWindow(app, { source: READER_SCROLL_COAST_PRUNE_SOURCE });
    }, delay);
    return;
  }
  pruneChunkWindow(app, options);
}

export function pruneChunkWindow(app, options = {}) {
  const chunks = Array.from(app.state.loadedChunks.keys()).sort((a,b) => a-b);
  if (chunks.length <= MAX_LOADED_CHUNKS) return;
  const v = ensureVirtualState(app);
  const reader = app.els.reader;
  const anchor = captureVirtualViewportAnchor(app);
  const anchorChunk = getVirtualAnchorChunk(anchor);
  const visible = anchorChunk || getVisibleChunk(app) || app.state.current?.chunk || chunks[0];
  const plan = buildReaderChunkPrunePlan(chunks, visible, MAX_LOADED_CHUNKS);
  const removedBeforeHeight = sumRemovedChunkHeightBeforeVisible({
    removed: plan.removed,
    visibleChunk: visible,
    getChunkHeight: chunk => getChunkBounds(app, chunk)?.height || 0
  });
  const appendPruneGate = resolveAppendPruneDeferral(app, {
    force: options.force === true,
    phase: 'chunk-window-prune-apply',
    loadedChunks: chunks.length,
    maxLoadedChunks: MAX_LOADED_CHUNKS,
    removedBeforeHeight
  });
  if (appendPruneGate?.defer) {
    recordScrollCoastPrune(app, {
      deferred: true,
      skipped: true,
      reason: appendPruneGate.reason,
      appendCorrectionGuardPass: appendPruneGate.pass,
      delayMs: appendPruneGate.delayMs,
      removed: plan.removed.slice(),
      removedBeforeHeight: Math.round(removedBeforeHeight),
      loadedChunks: chunks.length,
      maxLoadedChunks: MAX_LOADED_CHUNKS,
      source: options.source || READER_SCROLL_COAST_PRUNE_SOURCE
    });
    window.clearTimeout(v.scrollCoastPruneTimer || 0);
    v.scrollCoastPruneTimer = window.setTimeout(() => {
      v.scrollCoastPruneTimer = 0;
      schedulePruneChunkWindow(app, { source: READER_SCROLL_COAST_PRUNE_SOURCE });
    }, appendPruneGate.delayMs);
    return;
  }
  if (removedBeforeHeight > 0 && shouldFreezeNativeSettledScroll(app, { reason: 'chunk-window-prune-before-visible', anchorType: 'prune' })) {
    recordScrollCoastPrune(app, {
      deferred: true,
      skipped: true,
      reason: 'native scroll settle keeps scrollTop; before-visible prune postponed',
      removed: plan.removed.slice(),
      removedBeforeHeight: Math.round(removedBeforeHeight),
      loadedChunks: chunks.length,
      maxLoadedChunks: MAX_LOADED_CHUNKS,
      source: options.source || READER_SCROLL_COAST_PRUNE_SOURCE
    });
    return;
  }
  recordScrollCoastPrune(app, { deferred: false, removed: plan.removed.slice(), loadedChunks: chunks.length, maxLoadedChunks: MAX_LOADED_CHUNKS, source: options.source || READER_SCROLL_COAST_PRUNE_SOURCE, anchorChunk: anchorChunk || null });
  plan.removed.forEach(chunk => app.state.loadedChunks.delete(chunk));
  const coordinateEviction = pruneEstimatedCoordinateChunks(app, plan.removed);
  rebuildVirtualRows(app, 'prune', visible, { preserveAnchor: false, source: options.source || 'chunk-window-prune', prunedChunks: plan.removed.slice(), removedBeforeHeight, coordinateEviction });
  if (reader && (anchor || removedBeforeHeight > 0)) {
    restoreVirtualViewportAnchor(app, anchor, { fallbackDeltaPx: removedBeforeHeight, source: options.source || 'chunk-window-prune' });
  }
}


function getVirtualAnchorChunk(anchor = null) {
  const rowId = String(anchor?.rowId || '');
  const match = rowId.match(/^(\d+):/);
  const chunk = match ? Number(match[1]) : 0;
  return Number.isFinite(chunk) && chunk > 0 ? chunk : 0;
}

export function limitChunkTextCache(app) {
  const keep = Array.from(app.state.loadedChunks.keys());
  const current = app.state.current?.chunk;
  if (current) keep.push(current);
  limitMapSize(app.state.chunkTextCache, MAX_CHUNK_TEXT_CACHE, keep);
}

export async function warmAdjacentChunks(app, loadChunk, options = {}) {
  const c = app.state.current;
  if (!c) return;
  const base = Number(options.centerChunk) || Number(c.chunk) || 1;
  const direction = options.direction || 'forward';
  if (app.readerPrefetch?.warm) {
    app.readerPrefetch.warm(base, { direction, radius: options.radius });
    return;
  }
  if (app.state.loadingChunks.size || typeof loadChunk !== 'function') return;
  const jobs = [];
  if (base < c.totalChunks) jobs.push(loadChunk(base + 1, 'append'));
  if (base > 1) jobs.push(loadChunk(base - 1, 'prepend'));
  if (!jobs.length) return;
  try { await Promise.allSettled(jobs); schedulePruneChunkWindow(app, { source: 'warm-adjacent' }); } catch {}
}
