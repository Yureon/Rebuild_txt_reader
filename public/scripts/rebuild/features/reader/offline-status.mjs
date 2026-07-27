import { setNetworkBadge } from '../ui.mjs';
import { getReaderCacheCoverage } from './cache-store.mjs';
import { getAdaptivePrefetchRadius, getReaderPrefetchSnapshot } from './prefetch-queue.mjs';
import { buildOfflineButtonTitle, buildOfflinePanelViewModel, normalizeOfflineFailedChunks } from './offline-status-formatters.mjs';

const COVERAGE_REFRESH_MS = 900;
const PREFETCH_COVERAGE_REFRESH_MS = 1400;
const OFFLINE_COVERAGE_COALESCE_PASS = 'v144-offline-coverage-coalescing-pass';

export function installOfflineStatus(app, { on } = {}) {
  if (app.offlineStatus?.installed) return app.offlineStatus;
  const listen = typeof on === 'function'
    ? on
    : (target, type, handler, options) => target?.addEventListener(type, handler, options);
  const refreshCoverage = (reason = 'manual') => requestOfflineCoverageRefresh(app, reason);
  const update = (reason = '') => updateOfflineStatus(app, { reason });

  listen(app.els.offlineDownloadStatusMinimize, 'click', () => minimizeOfflinePanel(app));
  listen(app.els.offlineDownloadStatusClose, 'click', () => closeOfflinePanel(app, { abort: true }));
  listen(app.els.offlineDownloadStatusCancel, 'click', () => app.state.offlineDownloadAbort?.abort?.());
  listen(app.els.offlineDownloadStatusRetryFailed, 'click', () => retryFailedOfflineChunks(app));
  listen(app.els.offlineDownloadStatusDock, 'click', () => showOfflinePanel(app));
  listen(window, 'online', () => { update('online'); refreshCoverage('online'); });
  listen(window, 'offline', () => { update('offline'); refreshCoverage('offline'); });
  const connection = getConnection();
  listen(connection, 'change', () => { update('connection'); refreshCoverage('connection'); });
  listen(window, 'txt-reader-prefetch-state', () => { update('prefetch'); refreshCoverage('prefetch'); });

  app.offlineStatus = {
    installed: true,
    coverageCoalescePass: OFFLINE_COVERAGE_COALESCE_PASS,
    update,
    refreshCoverage,
    showPanel: () => showOfflinePanel(app),
    minimizePanel: () => minimizeOfflinePanel(app),
    closePanel: options => closeOfflinePanel(app, options || {}),
    dispose: () => {
      window.clearTimeout(app.state.offlineCoverageRefreshTimer || 0);
      app.state.offlineCoverageRefreshTimer = 0;
      app.state.offlineCoverageRefreshPendingReason = '';
      if (app.offlineStatus) app.offlineStatus.installed = false;
      app.offlineStatus = null;
    }
  };
  update('install');
  refreshCoverage('install');
  return app.offlineStatus;
}

function requestOfflineCoverageRefresh(app, reason = 'manual') {
  if (!app?.state) return Promise.resolve(null);
  app.state.offlineCoverageCoalescePass = OFFLINE_COVERAGE_COALESCE_PASS;
  const now = Date.now();
  const interval = reason === 'prefetch' ? PREFETCH_COVERAGE_REFRESH_MS : COVERAGE_REFRESH_MS;
  const elapsed = now - (Number(app.state.offlineCoverageLastRefreshAt) || 0);
  const delay = Math.max(0, interval - elapsed);
  if (app.state.offlineCoverageRefreshRunning) {
    app.state.offlineCoverageRefreshPendingReason = reason || 'pending';
    return Promise.resolve(app.state.offlineCacheCoverage || null);
  }
  window.clearTimeout(app.state.offlineCoverageRefreshTimer || 0);
  if (delay <= 0 || reason === 'install' || reason === 'online' || reason === 'offline') {
    return runOfflineCoverageRefresh(app, reason);
  }
  app.state.offlineCoverageRefreshTimer = window.setTimeout(() => runOfflineCoverageRefresh(app, reason), delay);
  return Promise.resolve(app.state.offlineCacheCoverage || null);
}

function runOfflineCoverageRefresh(app, reason = 'manual') {
  if (app.state.offlineCoverageRefreshRunning) {
    app.state.offlineCoverageRefreshPendingReason = reason || 'pending';
    return Promise.resolve(app.state.offlineCacheCoverage || null);
  }
  app.state.offlineCoverageRefreshRunning = true;
  app.state.offlineCoverageRefreshReason = reason;
  return refreshOfflineCoverage(app)
    .catch(error => {
      app.state.errors?.push?.({ area: 'offline-coverage', message: error?.message || String(error), at: Date.now(), pass: OFFLINE_COVERAGE_COALESCE_PASS });
      return null;
    })
    .finally(() => {
      app.state.offlineCoverageLastRefreshAt = Date.now();
      app.state.offlineCoverageRefreshRunning = false;
      const pending = app.state.offlineCoverageRefreshPendingReason;
      app.state.offlineCoverageRefreshPendingReason = '';
      if (pending) requestOfflineCoverageRefresh(app, pending);
    });
}


export function getNetworkProfile() {
  const connection = getConnection();
  const effectiveType = String(connection?.effectiveType || '').toLowerCase();
  const saveData = !!connection?.saveData;
  const downlink = Number(connection?.downlink) || 0;
  const rtt = Number(connection?.rtt) || 0;
  const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
  let mode = 'normal';
  let label = '온라인';
  let detail = '일반 네트워크 정책';
  if (!online) {
    mode = 'offline';
    label = '오프라인';
    detail = '서버 요청 대신 준비된 캐시만 사용할 수 있습니다.';
  } else if (saveData) {
    mode = 'degraded';
    label = '절약';
    detail = 'Save-Data 환경으로 프리패치 반경을 줄입니다.';
  } else if (effectiveType.includes('2g')) {
    mode = 'slow';
    label = '저속';
    detail = '2G 계열 연결로 프리패치를 최소화합니다.';
  } else if (effectiveType.includes('3g')) {
    mode = 'degraded';
    label = '제한';
    detail = '3G 계열 연결로 프리패치 반경을 줄입니다.';
  } else if (effectiveType.includes('4g') || downlink >= 3) {
    mode = 'fast';
    label = '빠름';
    detail = '인접 구간 프리패치를 적극적으로 사용할 수 있습니다.';
  }
  return { online, saveData, effectiveType, downlink, rtt, mode, label, detail };
}

export function getOfflineRange(app, current = app?.state?.current) {
  if (!current) return null;
  const chunk = Math.max(1, Number(current.chunk) || 1);
  const total = Math.max(1, Number(current.totalChunks) || 1);
  const radius = getAdaptivePrefetchRadius(app);
  const backward = Math.max(2, Math.ceil(radius / 2));
  const forward = Math.max(4, radius + 2);
  return {
    start: Math.max(1, chunk - backward),
    end: Math.min(total, chunk + forward),
    center: chunk,
    radius,
    totalChunks: total
  };
}

export function updateOfflineStatus(app, { reason = '' } = {}) {
  const profile = getNetworkProfile();
  const prefetch = getReaderPrefetchSnapshot(app);
  const coverage = app.state.offlineCacheCoverage || null;
  const download = app.state.offlineDownloadStatus || null;
  const mode = profile.mode;
  const label = profile.label;
  const cacheDetail = coverage?.total ? ` · 캐시 ${coverage.cached || 0}/${coverage.total}` : '';
  const activityDetail = download?.running ? ' · 오프라인 저장 중' : (prefetch.running ? ' · 프리패치 중' : '');
  setNetworkBadge(app, mode, label, `${profile.detail}${cacheDetail}${activityDetail}`);
  updateOfflineButton(app, { profile, prefetch, coverage, download, reason });
  updateOfflinePanelText(app, { profile, prefetch, coverage, download });
}

export async function refreshOfflineCoverage(app) {
  const current = app?.state?.current;
  if (!current) {
    app.state.offlineCacheCoverage = null;
    updateOfflineStatus(app, { reason: 'coverage-empty' });
    return null;
  }
  const range = getOfflineRange(app, current);
  if (!range) return null;
  const coverage = await getReaderCacheCoverage(app, current, range);
  coverage.radius = range.radius;
  coverage.center = range.center;
  app.state.offlineCacheCoverage = coverage;
  updateOfflineStatus(app, { reason: 'coverage' });
  return coverage;
}

export function setOfflineDownloadStatus(app, patch = {}) {
  const prev = app.state.offlineDownloadStatus || {};
  app.state.offlineDownloadStatus = { ...prev, ...patch, updatedAt: Date.now() };
  updateOfflineStatus(app, { reason: 'download' });
}

function updateOfflineButton(app, info) {
  const btn = app.els.offlineReadyBtn;
  if (!btn) return;
  const { profile, prefetch, coverage, download } = info;
  btn.classList.toggle('is-busy', !!download?.running || !!prefetch.running);
  btn.title = buildOfflineButtonTitle({ profile, prefetch, coverage });
}

function updateOfflinePanelText(app, { profile, prefetch, coverage, download }) {
  const panel = app.els.offlineDownloadStatus;
  if (!panel || panel.hasAttribute('hidden')) return;
  const view = buildOfflinePanelViewModel({ profile, prefetch, coverage, download });
  const title = panel.querySelector('.offline-download-status__title');
  const meta = app.els.offlineDownloadStatusText;
  const stats = app.els.offlineDownloadStatusStats;
  const fill = app.els.offlineDownloadStatusFill;
  const cancelBtn = app.els.offlineDownloadStatusCancel;
  const retryBtn = app.els.offlineDownloadStatusRetryFailed;
  if (title) title.textContent = view.title;
  if (fill) fill.style.width = `${view.fillPercent}%`;
  if (meta) meta.textContent = view.meta;
  if (stats) stats.textContent = view.stats;
  if (cancelBtn) cancelBtn.hidden = !view.cancelVisible;
  if (retryBtn) {
    retryBtn.hidden = !view.retryVisible;
    retryBtn.textContent = view.failedChunks.length ? `실패 ${view.failedChunks.length}개 재시도` : '실패 재시도';
  }
}

function retryFailedOfflineChunks(app) {
  const failedChunks = normalizeOfflineFailedChunks(app.state.offlineDownloadStatus?.failedChunks || []);
  if (!failedChunks.length) return;
  app.reader?.prepareOfflineChunks?.(failedChunks, { label: '실패 재시도', confirmLarge: false });
}

function showOfflinePanel(app) {
  app.els.offlineDownloadStatus?.removeAttribute('hidden');
  app.els.offlineDownloadStatusDock?.setAttribute('hidden', '');
  updateOfflineStatus(app, { reason: 'panel-open' });
}

function minimizeOfflinePanel(app) {
  app.els.offlineDownloadStatus?.setAttribute('hidden', '');
  app.els.offlineDownloadStatusDock?.removeAttribute('hidden');
}

function closeOfflinePanel(app, { abort = false } = {}) {
  if (abort) app.state.offlineDownloadAbort?.abort?.();
  app.els.offlineDownloadStatus?.setAttribute('hidden', '');
  app.els.offlineDownloadStatusDock?.setAttribute('hidden', '');
  updateOfflineStatus(app, { reason: 'panel-close' });
}

function getConnection() {
  if (typeof navigator === 'undefined') return null;
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
}
