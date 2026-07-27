export const READER_SCROLL_SIDE_EFFECTS_PASS = 'v242-reader-scroll-side-effects-pass';
export const READER_SCROLL_EDGE_EARLY_EXTEND_PASS = 'v285-reader-scroll-edge-early-extend-pass';
export const READER_LIVE_SCROLL_PROGRESS_PASS = 'v464-reader-live-scroll-progress-pass';

export function createReaderScrollSideEffectScheduler(app, handlers = {}) {
  let progressTimer = 0;
  let progressRaf = 0;
  let extendTimer = 0;
  const progressDelayMs = Math.max(32, Number(handlers.progressDelayMs) || 96);
  const extendDelayMs = Math.max(32, Number(handlers.extendDelayMs) || 56);
  const runProgress = () => {
    progressTimer = 0;
    progressRaf = 0;
    handlers.updateProgressFromViewport?.(app);
    handlers.saveProgressDebounced?.();
    if (app?.state) app.state.lastReaderLiveScrollProgress = { pass: READER_LIVE_SCROLL_PROGRESS_PASS, at: Date.now() };
  };
  const runExtend = () => {
    extendTimer = 0;
    handlers.maybeExtendChunks?.(app, (chunk, mode, options) => handlers.loadChunk?.(chunk, mode, options));
  };
  const scheduleProgress = () => {
    if (progressRaf || progressTimer) return;
    progressRaf = window.requestAnimationFrame?.(runProgress) || 0;
    if (!progressRaf) progressTimer = window.setTimeout(runProgress, progressDelayMs);
  };
  return {
    schedule() {
      if (typeof window === 'undefined') {
        runProgress();
        runExtend();
        return;
      }
      scheduleProgress();
      window.clearTimeout(extendTimer);
      extendTimer = window.setTimeout(runExtend, extendDelayMs);
    },
    flush() {
      const hadProgress = !!(progressRaf || progressTimer);
      const hadExtend = !!extendTimer;
      if (typeof window !== 'undefined') {
        if (progressRaf) window.cancelAnimationFrame?.(progressRaf);
        window.clearTimeout(progressTimer);
        window.clearTimeout(extendTimer);
      }
      progressRaf = 0;
      progressTimer = 0;
      extendTimer = 0;
      if (hadProgress) runProgress();
      if (hadExtend) runExtend();
    },
    cancel() {
      if (typeof window !== 'undefined') {
        if (progressRaf) window.cancelAnimationFrame?.(progressRaf);
        window.clearTimeout(progressTimer);
        window.clearTimeout(extendTimer);
      }
      progressRaf = 0;
      progressTimer = 0;
      extendTimer = 0;
    }
  };
}
