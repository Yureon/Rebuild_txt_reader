import { readChunkPayloadFromCache, writeChunkPayloadToCache } from './cache-store.mjs';
import { splitContentBlocks } from './text-blocks.mjs';
import { buildReaderPrefetchSnapshot } from './prefetch-snapshot.mjs';
import { buildReaderPrefetchCandidates, buildReaderPrefetchScheduleSignature, getReaderPrefetchRadiusFromNetwork } from './prefetch-schedule.mjs';

const MAX_QUEUE = 12;
const IDLE_DELAY_MS = 140;
const PREFETCH_SCHEDULE_COALESCE_MS = 220;
const READER_PREFETCH_WARMUP_PASS = 'v144-reader-cache-warmup-pass';
const READER_SCROLL_BUFFER_PREFETCH_PASS = 'v147-reader-scroll-buffer-pass';
const READER_VELOCITY_PREFETCH_PASS = 'v149-reader-velocity-prefetch-pass';

export function installPrefetchQueue(app) {
  if (app.readerPrefetch) return app.readerPrefetch;
  const state = {
    queue: [],
    queuedKeys: new Set(),
    running: false,
    timer: 0,
    idleId: 0,
    controller: null,
    sessionId: 0,
    stats: {
      enqueued: 0,
      fetched: 0,
      cached: 0,
      failed: 0,
      aborted: 0,
      skippedLoaded: 0,
      skippedDuplicate: 0,
      skippedCoalesced: 0,
      dropped: 0,
      lastRadius: 0,
      lastDirection: 'forward',
      lastVelocityPxMs: 0,
      velocityPrefetchPass: READER_VELOCITY_PREFETCH_PASS,
      lastError: '',
      lastScheduleSignature: '',
      lastScheduleAt: 0,
      pass: READER_PREFETCH_WARMUP_PASS,
      lastRunAt: 0,
      lastCompletedAt: 0
    }
  };

  app.readerPrefetch = {
    warm: (centerChunk, options = {}) => scheduleReaderPrefetch(app, centerChunk, options),
    abort: () => abortReaderPrefetch(app),
    state
  };
  return app.readerPrefetch;
}

export function abortReaderPrefetch(app) {
  const p = app.readerPrefetch?.state;
  if (!p) return;
  p.controller?.abort?.();
  p.controller = null;
  p.queue = [];
  p.queuedKeys.clear();
  p.running = false;
  window.clearTimeout(p.timer);
  p.timer = 0;
  if (p.idleId && typeof cancelIdleCallback === 'function') cancelIdleCallback(p.idleId);
  p.idleId = 0;
  p.sessionId += 1;
  if (p.stats) {
    p.stats.aborted += 1;
    p.stats.lastCompletedAt = Date.now();
  }
  notifyPrefetchState(app);
}

export function scheduleReaderPrefetch(app, centerChunk, options = {}) {
  const p = app.readerPrefetch?.state || installPrefetchQueue(app).state;
  const current = app.state.current;
  if (!current || app.state.prefs.readerCache === false) return;
  const base = Math.max(1, Number(centerChunk) || Number(current.chunk) || 1);
  const total = Math.max(1, Number(current.totalChunks) || 1);
  const radius = getAdaptivePrefetchRadius(app, options);
  const direction = options.direction || 'forward';
  const velocity = Math.max(0, Number(app.state.readerVirtual?.lastScrollBufferVelocityPxMs) || 0);
  const candidates = buildReaderPrefetchCandidates(base, total, radius, direction);
  const now = Date.now();
  const scheduleSignature = buildReaderPrefetchScheduleSignature({
    warmupPass: READER_PREFETCH_WARMUP_PASS,
    readerSessionId: app?.state?.readerSessionId || 0,
    current,
    base,
    total,
    radius,
    direction,
    candidates,
    preprocess: app?.state?.prefs?.preprocess || {}
  });
  if (p.stats) {
    p.stats.lastRadius = radius;
    p.stats.lastDirection = direction;
    p.stats.lastVelocityPxMs = Math.round(velocity * 1000) / 1000;
    p.stats.velocityPrefetchPass = READER_VELOCITY_PREFETCH_PASS;
    p.stats.lastScheduleSignature = scheduleSignature;
  }
  if (scheduleSignature && p.lastScheduleSignature === scheduleSignature && now - (p.lastScheduleAt || 0) < PREFETCH_SCHEDULE_COALESCE_MS) {
    if (p.stats) {
      p.stats.skippedCoalesced += 1;
      p.stats.lastScheduleAt = now;
    }
    notifyPrefetchState(app);
    return;
  }
  p.lastScheduleSignature = scheduleSignature;
  p.lastScheduleAt = now;
  if (p.stats) p.stats.lastScheduleAt = now;
  let added = 0;
  candidates.forEach(chunk => {
    if (enqueuePrefetch(app, p, current, chunk)) added += 1;
  });
  notifyPrefetchState(app);
  if (added || p.queue.length) schedulePump(app, p);
}

function enqueuePrefetch(app, p, current, chunk) {
  if (!current || chunk < 1 || chunk > Math.max(1, Number(current.totalChunks) || 1)) return false;
  if (app.state.loadedChunks?.has(chunk)) {
    if (p.stats) p.stats.skippedLoaded += 1;
    return false;
  }
  const key = `${current.novel?.id || ''}:${current.episode?.id || 'single'}:${chunk}`;
  if (p.queuedKeys.has(key)) {
    if (p.stats) p.stats.skippedDuplicate += 1;
    return false;
  }
  if (p.queue.length >= MAX_QUEUE) {
    const removed = p.queue.shift();
    if (removed) p.queuedKeys.delete(removed.key);
    if (p.stats) p.stats.dropped += 1;
  }
  const snapshot = {
    key,
    novelId: current.novel?.id || '',
    episodeId: current.episode?.id || null,
    current,
    chunk,
    preprocess: { ...(app.state.prefs.preprocess || {}) },
    sessionId: app.state.readerSessionId
  };
  p.queue.push(snapshot);
  p.queuedKeys.add(key);
  if (p.stats) p.stats.enqueued += 1;
  return true;
}

function schedulePump(app, p) {
  if (p.running || p.timer || p.idleId) return;
  const run = () => {
    p.timer = 0;
    p.idleId = 0;
    pumpPrefetch(app, p).catch(() => {});
  };
  if (typeof requestIdleCallback === 'function') {
    p.idleId = requestIdleCallback(run, { timeout: 1500 });
  } else {
    p.timer = window.setTimeout(run, IDLE_DELAY_MS);
  }
}

async function pumpPrefetch(app, p) {
  if (p.running || !p.queue.length) return;
  p.running = true;
  p.controller = new AbortController();
  if (p.stats) {
    p.stats.lastRunAt = Date.now();
    p.stats.lastError = '';
  }
  notifyPrefetchState(app);
  const runSession = p.sessionId;
  try {
    while (p.queue.length && runSession === p.sessionId) {
      const job = p.queue.shift();
      p.queuedKeys.delete(job.key);
      const current = app.state.current;
      if (!current || current !== job.current || job.sessionId !== app.state.readerSessionId) continue;
      if (app.state.loadedChunks?.has(job.chunk)) {
        if (p.stats) p.stats.skippedLoaded += 1;
        notifyPrefetchState(app);
        continue;
      }
      if (p.controller.signal.aborted) break;
      const cached = await readChunkPayloadFromCache(app, current, job.chunk);
      if (cached) {
        if (p.stats) p.stats.cached += 1;
        notifyPrefetchState(app);
        continue;
      }
      const data = await app.api.content({
        novelId: current.novel.id,
        episodeId: current.episode?.id || null,
        chunk: job.chunk,
        preprocess: job.preprocess
      }, { signal: p.controller.signal });
      if (p.controller.signal.aborted || app.state.current !== current || job.sessionId !== app.state.readerSessionId) break;
      const actualChunk = Number(data.currentChunk) || job.chunk;
      const content = String(data.content || '');
      const blocks = splitContentBlocks(content);
      await writeChunkPayloadToCache(app, current, actualChunk, data, blocks);
      if (p.stats) p.stats.fetched += 1;
      notifyPrefetchState(app);
      await idleTick();
    }
  } catch (error) {
    if (error?.name !== 'AbortError') {
      app.state.errors?.push?.({ area: 'reader-prefetch', message: error.message || String(error), at: Date.now() });
      if (p.stats) {
        p.stats.failed += 1;
        p.stats.lastError = error.message || String(error);
      }
    }
  } finally {
    p.running = false;
    p.controller = null;
    if (p.stats) p.stats.lastCompletedAt = Date.now();
    notifyPrefetchState(app);
    if (p.queue.length) schedulePump(app, p);
  }
}

export function getAdaptivePrefetchRadius(app, options = {}) {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return getReaderPrefetchRadiusFromNetwork({
    explicitRadius: options.radius,
    connection,
    isMobileProfile: !!app.isMobileProfile,
    velocityPxMs: app.state.readerVirtual?.lastScrollBufferVelocityPxMs
  });
}

export function getReaderPrefetchSnapshot(app) {
  return buildReaderPrefetchSnapshot(app?.readerPrefetch?.state || null, {
    warmupPass: READER_PREFETCH_WARMUP_PASS,
    bufferPass: READER_SCROLL_BUFFER_PREFETCH_PASS,
    velocityPass: READER_VELOCITY_PREFETCH_PASS
  });
}
function notifyPrefetchState(app) {
  try {
    window.dispatchEvent(new CustomEvent('txt-reader-prefetch-state', {
      detail: getReaderPrefetchSnapshot(app)
    }));
  } catch {}
}

function idleTick() {
  return new Promise(resolve => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve(), { timeout: 800 });
    else window.setTimeout(resolve, 0);
  });
}
