import { setToolbarTitle, toast } from '../ui.mjs';
import { splitContentBlocks } from './text-blocks.mjs';
import { registerChunkBlocks } from './coordinates.mjs';
import { limitChunkTextCache, READER_CHUNK_WINDOW_BUFFER_PASS } from './chunk-window.mjs';
import { writeChunkPayloadToCache } from './cache-store.mjs';
import { ensureVirtualState, rebuildVirtualRows } from './virtual-layout.mjs';
import { updateNav, updateProgressFromViewport } from './progress.mjs';
import { buildReaderChunkFailureReport, rememberReaderFailureReport } from './failure-reporting.mjs';

export const READER_LOAD_CHUNK_SIDE_EFFECTS_PASS = 'v243-reader-load-chunk-side-effects-pass';
export const READER_CHUNK_COMMIT_BUDGET_PASS = 'v286-reader-chunk-commit-budget-pass';
export const READER_SCROLL_BUFFER_COMMIT_DEFER_PASS = 'v312-reader-scroll-buffer-commit-defer-pass';
export const READER_BUFFER_APPEND_CURRENT_CHUNK_RETAIN_PASS = 'v447-reader-buffer-append-current-chunk-retain-pass';
const SCROLL_BUFFER_COMMIT_IDLE_TIMEOUT_MS = 72;

export async function commitLoadedChunk(app, context = {}) {
  const { current, targetChunk, data, mode = 'replace', options = {}, prev = null } = context;
  if (!app?.state || !current || !data) return null;
  const actualChunk = Number(data.currentChunk) || (Number(targetChunk) === -1 ? 1 : Number(targetChunk) || 1);
  const previousChunk = Number(current.chunk) || 1;
  const shouldMoveCurrentChunk = mode === 'replace' || mode === 'jump' || !app.state.loadedChunks?.size;
  if (shouldMoveCurrentChunk) current.chunk = actualChunk;
  else current.chunk = previousChunk;
  current.totalChunks = Number(data.totalChunks) || current.totalChunks || 1;
  recordBufferAppendCurrentChunkRetain(app, { mode, actualChunk, previousChunk, retained: !shouldMoveCurrentChunk });
  current.title = current.episode ? `${current.novel.title} · ${data.title || current.episode.title}` : (data.title || current.novel.title);
  setToolbarTitle(app, current.title);
  const content = String(data.content || '');
  const blocks = Array.isArray(data.__blocks) ? data.__blocks : splitContentBlocks(content);
  registerChunkBlocks(app, actualChunk, blocks.length);
  const loaded = {
    chunk: actualChunk,
    title: data.title || current.title,
    content,
    totalChunks: current.totalChunks,
    blocks
  };
  if (mode === 'replace') {
    app.state.loadedChunks.clear();
    context.resetVirtualDocument?.(app, { clearMeasures: false });
  }
  app.state.loadedChunks.set(actualChunk, loaded);
  app.state.chunkTextCache.set(actualChunk, content);
  limitChunkTextCache(app);
  if (!data.__fromReaderCache) writeChunkPayloadToCache(app, current, actualChunk, data, blocks).catch(() => {});
  app.offlineStatus?.refreshCoverage?.();
  app.offlineStatus?.update?.('chunk-loaded');
  await yieldBeforeVirtualRebuild(app, { mode, options, actualChunk });
  const rebuildStartedAt = nowForCommitDiagnostics();
  rebuildVirtualRows(app, mode, actualChunk, { ...options, prev });
  recordChunkCommitBudget(app, {
    mode,
    chunk: actualChunk,
    source: String(options?.source || ''),
    phase: 'virtual-rebuild',
    durationMs: Math.round((nowForCommitDiagnostics() - rebuildStartedAt) * 10) / 10
  });
  updateNav(app);
  updateProgressFromViewport(app);
  return loaded;
}

async function yieldBeforeVirtualRebuild(app, { mode = 'replace', options = {}, actualChunk = 0 } = {}) {
  if (mode !== 'append' && mode !== 'prepend') return false;
  const v = ensureVirtualState(app);
  const active = Date.now() < (Number(v.userScrollActiveUntil) || 0);
  const source = String(options?.source || '');
  const scrollBufferCommit = active && source === READER_CHUNK_WINDOW_BUFFER_PASS && isUserScrollSource(v.lastUserScrollSource);
  const shouldYield = active && !v.pendingScrollTarget;
  recordChunkCommitBudget(app, {
    mode,
    chunk: actualChunk,
    source,
    phase: 'pre-rebuild-yield-check',
    active,
    scrollBufferCommit,
    commitDeferPass: scrollBufferCommit ? READER_SCROLL_BUFFER_COMMIT_DEFER_PASS : '',
    yielded: shouldYield
  });
  if (!shouldYield) return false;
  await waitForVirtualRebuildSlot({ idle: scrollBufferCommit });
  recordChunkCommitBudget(app, {
    mode,
    chunk: actualChunk,
    source,
    phase: 'pre-rebuild-yield-complete',
    activeAtResume: Date.now() < (Number(v.userScrollActiveUntil) || 0),
    scrollBufferCommit,
    commitDeferPass: scrollBufferCommit ? READER_SCROLL_BUFFER_COMMIT_DEFER_PASS : '',
    yielded: true
  });
  return true;
}

function waitForVirtualRebuildSlot({ idle = false } = {}) {
  return new Promise(resolve => {
    const raf = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : callback => setTimeout(() => callback(nowForCommitDiagnostics()), 16);
    raf(() => {
      if (idle && typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => resolve(), { timeout: SCROLL_BUFFER_COMMIT_IDLE_TIMEOUT_MS });
        return;
      }
      setTimeout(resolve, idle ? 24 : 0);
    });
  });
}

function isUserScrollSource(source = '') {
  const label = String(source || '');
  return label === 'scroll' || label === 'drag-pan' || label === 'touch-scroll' || label === 'touch-coast';
}

function recordChunkCommitBudget(app, payload = {}) {
  const v = ensureVirtualState(app);
  v.chunkCommitBudgetPass = READER_CHUNK_COMMIT_BUDGET_PASS;
  v.lastChunkCommitBudget = {
    pass: READER_CHUNK_COMMIT_BUDGET_PASS,
    ...payload,
    at: Date.now()
  };
}

function nowForCommitDiagnostics() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}

export function reportChunkLoadFailure(app, error, context = {}) {
  if (error && error.name === 'AbortError') return false;
  app?.offlineStatus?.update?.('chunk-load-failed');
  rememberReaderFailureReport(app, buildReaderChunkFailureReport(app, error, context));
  const offlineHint = navigator.onLine === false ? '오프라인 캐시에 없는 구간입니다. 연결 후 다시 시도하거나 오프라인 준비를 실행하세요.' : (error?.message || String(error));
  toast(app, 'error', '본문 로드 실패', offlineHint);
  return true;
}

function recordBufferAppendCurrentChunkRetain(app, payload = {}) {
  const v = ensureVirtualState(app);
  v.bufferAppendCurrentChunkRetainPass = READER_BUFFER_APPEND_CURRENT_CHUNK_RETAIN_PASS;
  v.lastBufferAppendCurrentChunkRetain = {
    pass: READER_BUFFER_APPEND_CURRENT_CHUNK_RETAIN_PASS,
    mode: String(payload.mode || ''),
    actualChunk: Math.max(1, Number(payload.actualChunk) || 1),
    previousChunk: Math.max(1, Number(payload.previousChunk) || 1),
    retained: payload.retained === true,
    at: Date.now()
  };
  return v.lastBufferAppendCurrentChunkRetain;
}
