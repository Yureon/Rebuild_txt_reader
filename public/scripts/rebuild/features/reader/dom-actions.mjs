import { toast } from '../ui.mjs';
import { readChunkPayloadFromCache, writeChunkPayloadToCache } from './cache-store.mjs';
import { getOfflineRange, setOfflineDownloadStatus } from './offline-status.mjs';
import { splitContentBlocks } from './text-blocks.mjs';

export function isTyping(target) {
  if (!target) return false;
  const tag = String(target.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || target.isContentEditable;
}

export const READER_IPAD_PSEUDO_FULLSCREEN_PASS = 'v456-reader-ipad-pseudo-fullscreen-pass';
export const READER_VIEWPORT_FIT_PSEUDO_FULLSCREEN_REFRESH_PASS = 'v462-viewport-fit-pseudo-fullscreen-refresh-pass';

const PSEUDO_FULLSCREEN_CLASS = 'fullscreen-fallback';

function dispatchPseudoFullscreenChange(enabled) {
  try {
    window.dispatchEvent(new CustomEvent('txt-reader-pseudo-fullscreen-change', { detail: { enabled: !!enabled, marker: READER_VIEWPORT_FIT_PSEUDO_FULLSCREEN_REFRESH_PASS } }));
  } catch {}
}

function setPseudoFullscreen(enabled) {
  const body = document.body;
  if (!body?.classList) return false;
  body.classList.toggle(PSEUDO_FULLSCREEN_CLASS, !!enabled);
  const app = document.getElementById?.('app');
  if (enabled) {
    body.dataset.readerPseudoFullscreenPass = READER_IPAD_PSEUDO_FULLSCREEN_PASS;
    if (app?.dataset) app.dataset.readerPseudoFullscreenPass = READER_IPAD_PSEUDO_FULLSCREEN_PASS;
  } else {
    delete body.dataset.readerPseudoFullscreenPass;
    if (app?.dataset) delete app.dataset.readerPseudoFullscreenPass;
  }
  dispatchPseudoFullscreenChange(enabled);
  return true;
}

export function toggleFullscreen() {
  const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement || null;
  if (fullscreenElement) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit) return exit.call(document);
  }
  if (document.body?.classList?.contains(PSEUDO_FULLSCREEN_CLASS)) {
    setPseudoFullscreen(false);
    return null;
  }
  const root = document.documentElement;
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  if (!request) {
    setPseudoFullscreen(true);
    return null;
  }
  try {
    const result = request.call(root);
    if (result && typeof result.catch === 'function') result.catch(() => setPseudoFullscreen(true));
    return result;
  } catch (e) {
    setPseudoFullscreen(true);
    return null;
  }
}

export function setChunkLoading(app, visible) {
  const node = app.els.chunkLoading;
  if (!node) return;
  if (visible) {
    node.removeAttribute('hidden');
    node.style.display = 'block';
  } else {
    node.setAttribute('hidden', '');
    node.style.display = 'none';
  }
}

export async function prepareOffline(app) {
  const c = app.state.current;
  if (!c) return toast(app, 'info', '오프라인 준비', '먼저 작품을 열어주세요.');
  const range = getOfflineRange(app, c) || { start: Math.max(1, c.chunk - 3), end: Math.min(c.totalChunks, c.chunk + 5), center: c.chunk, radius: 0 };
  const chunks = [];
  for (let i = range.start; i <= range.end; i += 1) chunks.push(i);
  return prepareOfflineChunks(app, chunks, { label: '현재 주변', start: range.start, end: range.end });
}

export async function prepareOfflineChunks(app, chunks = [], options = {}) {
  const c = app.state.current;
  if (!c) return toast(app, 'info', '오프라인 준비', '먼저 작품을 열어주세요.');
  const totalChunks = Math.max(1, Number(c.totalChunks) || 1);
  const selected = normalizeChunkSelection(chunks, totalChunks);
  if (!selected.length) return toast(app, 'info', '오프라인 준비', '저장할 구간이 없습니다.');
  if (options.confirmLarge !== false && selected.length > 120 && typeof window !== 'undefined' && typeof window.confirm === 'function') {
    const ok = window.confirm(`${selected.length}개 구간을 오프라인 캐시에 저장합니다. 계속할까요?`);
    if (!ok) return;
  }
  app.state.offlineDownloadAbort?.abort?.();
  const controller = new AbortController();
  app.state.offlineDownloadAbort = controller;
  const first = selected[0];
  const last = selected[selected.length - 1];
  const total = selected.length;
  const panel = app.els.offlineDownloadStatus;
  const dock = app.els.offlineDownloadStatusDock;
  panel?.removeAttribute('hidden');
  dock?.setAttribute('hidden','');
  setOfflineDownloadStatus(app, {
    running: true,
    label: options.label || '선택 구간',
    start: Number(options.start) || first,
    end: Number(options.end) || last,
    total,
    done: 0,
    currentChunk: 0,
    cached: 0,
    fetched: 0,
    failed: 0,
    failedChunks: [],
    lastError: '',
    error: ''
  });
  try {
    let cachedCount = 0;
    let fetchedCount = 0;
    const failedChunks = [];
    let lastError = '';
    for (let index = 0; index < selected.length; index += 1) {
      const chunk = selected[index];
      if (controller.signal.aborted) throw abortError();
      setOfflineDownloadStatus(app, { currentChunk: chunk, done: index, cached: cachedCount, fetched: fetchedCount, failed: failedChunks.length, failedChunks: failedChunks.slice(), lastError });
      try {
        let data = await readChunkPayloadFromCache(app, c, chunk);
        if (data) {
          cachedCount += 1;
        } else {
          data = await app.api.content({ novelId:c.novel.id, episodeId:c.episode?.id || null, chunk, preprocess:app.state.prefs.preprocess }, { signal: controller.signal });
          const blocks = splitContentBlocks(String(data.content || ''));
          await writeChunkPayloadToCache(app, c, Number(data.currentChunk) || chunk, data, blocks);
          fetchedCount += 1;
        }
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
        failedChunks.push(chunk);
        lastError = error?.message || String(error);
      }
      setOfflineDownloadStatus(app, { done: index + 1, cached: cachedCount, fetched: fetchedCount, failed: failedChunks.length, failedChunks: failedChunks.slice(), lastError });
    }
    setOfflineDownloadStatus(app, { running: false, done: total, currentChunk: 0, cached: cachedCount, fetched: fetchedCount, failed: failedChunks.length, failedChunks: failedChunks.slice(), error: failedChunks.length ? lastError : '', lastError });
    app.offlineStatus?.refreshCoverage?.();
    if (failedChunks.length) toast(app, 'warn', '오프라인 준비 일부 실패', `완료 ${total - failedChunks.length}/${total} · 실패 ${failedChunks.length}개`);
    else toast(app, 'success', '오프라인 준비', `${options.label || '선택'} ${total}개 구간을 준비했습니다.`);
  } catch (e) {
    if (e?.name === 'AbortError') {
      setOfflineDownloadStatus(app, { running: false, error: '사용자가 중단함', currentChunk: 0 });
      toast(app, 'info', '오프라인 준비 중단', '진행 중인 캐시 저장을 취소했습니다.');
    } else {
      setOfflineDownloadStatus(app, { running: false, error: e.message || String(e) });
      toast(app, 'error', '오프라인 준비 실패', e.message || String(e));
    }
  } finally {
    if (app.state.offlineDownloadAbort === controller) app.state.offlineDownloadAbort = null;
    app.offlineStatus?.update?.('offline-prepare-done');
  }
}

function normalizeChunkSelection(chunks, totalChunks) {
  const max = Math.max(1, Number(totalChunks) || 1);
  const seen = new Set();
  const out = [];
  (Array.isArray(chunks) ? chunks : []).forEach(value => {
    const chunk = Math.max(1, Math.min(max, Math.round(Number(value) || 0)));
    if (!chunk || seen.has(chunk)) return;
    seen.add(chunk);
    out.push(chunk);
  });
  return out.sort((a, b) => a - b);
}

function abortError() {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}
