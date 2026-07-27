export const CLIENT_PERFORMANCE_METRICS_PASS = 'v569-client-performance-metrics-pass';
const LONG_TASK_LIMIT = 24;

function now() {
  return globalThis.performance?.now?.() ?? Date.now();
}

export function getPerformanceStore() {
  if (!globalThis.__TXT_READER_PERF__ || typeof globalThis.__TXT_READER_PERF__ !== 'object') {
    globalThis.__TXT_READER_PERF__ = { version:'rebuild-v682', pass:CLIENT_PERFORMANCE_METRICS_PASS, phases:{}, resources:{}, longTasks:[] };
  }
  const store = globalThis.__TXT_READER_PERF__;
  store.version = 'rebuild-v682';
  store.pass = CLIENT_PERFORMANCE_METRICS_PASS;
  store.phases ||= {};
  store.resources ||= {};
  store.longTasks ||= [];
  return store;
}

export function markPerformancePhase(name, payload = {}) {
  const store = getPerformanceStore();
  store.phases[String(name || 'phase')] = { at:now(), ...payload };
  return store.phases[String(name || 'phase')];
}

export function installClientPerformanceMetrics(app) {
  const store = getPerformanceStore();
  app.performanceMetrics = store;
  if (store.observerInstalled) return store;
  store.observerInstalled = true;
  if (typeof PerformanceObserver === 'function') {
    try {
      const supported = PerformanceObserver.supportedEntryTypes || [];
      if (supported.includes('longtask')) {
        const observer = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            store.longTasks.push({ startTime:entry.startTime, duration:entry.duration, name:entry.name || 'longtask' });
          }
          if (store.longTasks.length > LONG_TASK_LIMIT) store.longTasks.splice(0, store.longTasks.length - LONG_TASK_LIMIT);
        });
        observer.observe({ type:'longtask', buffered:true });
        app.performanceMetricsCleanup = () => observer.disconnect();
      }
    } catch {}
  }
  return store;
}

export function getBootLongTasks(store = getPerformanceStore()) {
  const start = Number(store?.phases?.bootStart?.at);
  const end = Number(store?.phases?.bootComplete?.at);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  return (Array.isArray(store.longTasks) ? store.longTasks : []).filter(entry => {
    const taskStart = Number(entry?.startTime);
    const duration = Math.max(0, Number(entry?.duration) || 0);
    const taskEnd = taskStart + duration;
    return Number.isFinite(taskStart) && taskStart < end && taskEnd > start;
  });
}

export function finalizeBootPerformance() {
  const store = getPerformanceStore();
  const entries = globalThis.performance?.getEntriesByType?.('resource') || [];
  store.resourceSummary = {
    count:entries.length,
    transferBytes:entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.transferSize) || 0), 0),
    decodedBytes:entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.decodedBodySize) || 0), 0)
  };
  const complete = markPerformancePhase('bootComplete');
  const start = Number(store.phases?.bootStart?.at);
  complete.durationMs = Number.isFinite(start) ? Math.max(0, complete.at - start) : 0;
  store.bootDurationMs = complete.durationMs;
  store.bootWindow = { startAt:Number.isFinite(start) ? start : 0, endAt:complete.at };
  store.bootLongTasks = getBootLongTasks(store);
  return store;
}
