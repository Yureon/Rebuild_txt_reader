import { compactLibraryVirtualHistoryRecord } from './library-virtual-history-record.mjs';
import { buildLibraryVirtualSessionFallbackFailure, isLibraryVirtualSessionExceptionFailure } from './library-virtual-session-fallback.mjs';
import {
  clampLibraryVirtualTrialDuration,
  evaluateLibraryVirtualTrialPassCriteria,
  getLibraryVirtualTrialDiagnostics,
  getLibraryVirtualTrialResultLabel,
  getLibraryVirtualTrialTone,
  normalizeLibraryVirtualTrialDurationPreset,
  normalizeLibraryVirtualTrialHistoryFilter,
  summarizeLibraryVirtualTrial,
  trimLibraryVirtualTrialObservations
} from './library-virtual-trial-diagnostics.mjs';

export const LIBRARY_VIRTUAL_TRIAL_RUNTIME_PASS = 'v283-library-virtual-trial-runtime-pass';

export function clearLibraryVirtualTrialTimerRuntime(app) {
  const timer = app?.state?.libraryVirtualTrialTimer;
  if (timer) {
    try { window.clearTimeout(timer); } catch {}
    app.state.libraryVirtualTrialTimer = 0;
  }
}

export function captureLibraryVirtualTrialObservationSnapshotRuntime(app, type = 'observation', meta = {}, deps = {}) {
  const box = app?.els?.novelList || null;
  const anchor = box ? deps.getLibraryScrollAnchor?.(app) : null;
  const currentWindowRows = app?.library?.getCurrentWindowRows?.() || deps.getLibraryCurrentWindowRows?.(app);
  const windowInfo = currentWindowRows?.window || {};
  const datasetWindowed = box?.dataset?.libraryVirtualActive === '1';
  const requested = deps.isLibraryVirtualRendererEnabled?.(app) || false;
  const actualRenderer = datasetWindowed ? 'windowed' : (requested ? 'full fallback' : 'full');
  const lastRender = app?.state?.libraryVirtualLastRender || null;
  const trial = app?.state?.libraryVirtualTrial || null;
  const effectiveWindowed = datasetWindowed && lastRender?.mode === 'windowed';
  return {
    type: String(type || 'observation'),
    source: String(meta.source || ''),
    note: String(meta.note || ''),
    meta: { ...(meta || {}) },
    renderer: actualRenderer,
    windowedAtObservation: !!datasetWindowed,
    coverageEligible: !!effectiveWindowed,
    rendererState: {
      requested,
      persistentFlag: !!app?.state?.prefs?.libraryVirtualRenderer,
      trialActive: !!trial?.active,
      datasetWindowed: !!datasetWindowed,
      effectiveWindowed: !!effectiveWindowed,
      actualRenderer,
      lastRenderMode: lastRender?.mode || '',
      lastRenderSource: lastRender?.source || '',
      lastRenderAt: Number(lastRender?.at) || 0,
      trialWindowedRenders: Number(trial?.windowedRenders) || 0,
      trialFullRenders: Number(trial?.fullRenders) || 0,
      trialFallbackCount: Number(trial?.fallbackCount) || 0
    },
    scroll: box ? {
      scrollTop: Math.max(0, Math.round(Number(box.scrollTop) || 0)),
      clientHeight: Math.max(0, Math.round(Number(box.clientHeight) || 0)),
      scrollHeight: Math.max(0, Math.round(Number(box.scrollHeight) || 0))
    } : null,
    topAnchor: anchor ? {
      key: anchor.key || '',
      offset: Number.isFinite(Number(anchor.offset)) ? Number(anchor.offset) : 0,
      virtual: !!anchor.virtual,
      rowCount: Number.isFinite(Number(anchor.rowCount)) ? Number(anchor.rowCount) : 0
    } : null,
    window: currentWindowRows?.available ? {
      totalRows: Number(currentWindowRows.totalRows) || 0,
      renderStart: Number(windowInfo.renderStart) || 0,
      renderEnd: Number(windowInfo.renderEnd) || 0,
      renderCount: Number(windowInfo.renderCount) || 0,
      visibleStart: Number(windowInfo.visibleStart) || 0,
      visibleEnd: Number(windowInfo.visibleEnd) || 0,
      activeIndex: Number.isFinite(Number(windowInfo.activeIndex)) ? Number(windowInfo.activeIndex) : null,
      activeInWindow: !!windowInfo.activeInWindow,
      rowHeight: Number(windowInfo.rowHeight) || 0
    } : null,
    at: Date.now()
  };
}

export function recordLibraryVirtualTrialObservationRuntime(app, type = 'observation', meta = {}, deps = {}) {
  const trial = app?.state?.libraryVirtualTrial;
  if (!trial?.active) return null;
  if (!Array.isArray(trial.observations)) trial.observations = [];
  const observation = captureLibraryVirtualTrialObservationSnapshotRuntime(app, type, meta, deps);
  trial.observations.push(observation);
  trimLibraryVirtualTrialObservations(trial);
  trial.lastObservation = observation;
  deps.notifyLibraryVirtualDiagnostics?.(app);
  return observation;
}

export function runLibraryVirtualTrialScenarioRuntime(app, scenario, options = {}, deps = {}) {
  const key = String(scenario || '').trim().toLowerCase();
  const trial = app?.state?.libraryVirtualTrial;
  if (!trial?.active) {
    return { ok:false, reason:'trial-inactive', diagnostics:getLibraryVirtualTrialDiagnostics(app) };
  }
  if (key === 'observe-scroll') {
    const observation = recordLibraryVirtualTrialObservationRuntime(app, 'scroll-observe', { source:options.source || 'recovery-trial-scroll-observe', note:'manual scroll/top-window snapshot only' }, deps);
    return { ok:true, scenario:key, observation, diagnostics:getLibraryVirtualTrialDiagnostics(app) };
  }
  if (key === 'force-rerender') {
    const before = recordLibraryVirtualTrialObservationRuntime(app, 'force-rerender-before', { source:options.source || 'recovery-trial-force-rerender' }, deps);
    deps.renderLibrary?.(app, { source:options.source || 'recovery-trial-force-rerender', followActive:!!options.followActive });
    const after = recordLibraryVirtualTrialObservationRuntime(app, 'force-rerender-after', { source:options.source || 'recovery-trial-force-rerender' }, deps);
    return { ok:true, scenario:key, before, after, diagnostics:getLibraryVirtualTrialDiagnostics(app) };
  }
  if (key === 'follow-active') {
    const before = recordLibraryVirtualTrialObservationRuntime(app, 'follow-active-before', { source:options.source || 'recovery-trial-follow-active' }, deps);
    deps.renderLibrary?.(app, { source:options.source || 'recovery-trial-follow-active', followActive:true });
    const after = recordLibraryVirtualTrialObservationRuntime(app, 'follow-active-after', { source:options.source || 'recovery-trial-follow-active' }, deps);
    return { ok:true, scenario:key, before, after, diagnostics:getLibraryVirtualTrialDiagnostics(app) };
  }
  if (key === 'top-anchor') {
    const anchor = deps.getLibraryScrollAnchor?.(app);
    const before = recordLibraryVirtualTrialObservationRuntime(app, 'top-anchor-before', { source:options.source || 'recovery-trial-top-anchor', anchorKey:anchor?.key || '' }, deps);
    deps.renderLibrary?.(app, { source:options.source || 'recovery-trial-top-anchor', scrollAnchor:anchor, followActive:false });
    const after = recordLibraryVirtualTrialObservationRuntime(app, 'top-anchor-after', { source:options.source || 'recovery-trial-top-anchor', anchorKey:anchor?.key || '' }, deps);
    return { ok:true, scenario:key, anchor, before, after, diagnostics:getLibraryVirtualTrialDiagnostics(app) };
  }
  return { ok:false, reason:'unknown-scenario', scenario:key, diagnostics:getLibraryVirtualTrialDiagnostics(app) };
}

export function setLibraryVirtualTrialHistoryFilterRuntime(app, filter, deps = {}) {
  app.state.libraryVirtualTrialHistoryFilter = normalizeLibraryVirtualTrialHistoryFilter(filter);
  deps.notifyLibraryVirtualDiagnostics?.(app);
  return getLibraryVirtualTrialDiagnostics(app);
}

export function startLibraryVirtualTrialRuntime(app, options = {}, deps = {}) {
  const durationMs = clampLibraryVirtualTrialDuration(options.durationMs);
  clearLibraryVirtualTrialTimerRuntime(app);
  const now = Date.now();
  const trial = {
    id: `trial-${now}-${Math.random().toString(36).slice(2, 8)}`,
    active: true,
    status: 'running',
    source: String(options.source || 'recovery-safe-trial'),
    scenario: {
      durationPresetMs: normalizeLibraryVirtualTrialDurationPreset(durationMs),
      durationMs,
      forceRerenderOnStart: options.forceRerenderOnStart !== false,
      controls: ['duration-preset', 'force-rerender', 'scroll-observe', 'follow-active', 'top-anchor'],
      source: String(options.source || 'recovery-safe-trial')
    },
    durationMs,
    startedAt: now,
    deadlineAt: now + durationMs,
    endedAt: 0,
    renders: 0,
    windowedRenders: 0,
    fullRenders: 0,
    fallbackCount: 0,
    exceptionCount: 0,
    firstRenderAt: 0,
    lastRenderAt: 0,
    lastRender: null,
    observations: [],
    lastObservation: null,
    failure: null,
    reason: ''
  };
  app.state.libraryVirtualTrial = trial;
  app.state.libraryVirtualTrialResult = null;
  recordLibraryVirtualTrialObservationRuntime(app, 'trial-start', { source:trial.source, durationMs }, deps);
  app.state.libraryVirtualTrialTimer = window.setTimeout(() => {
    const passCriteria = evaluateLibraryVirtualTrialPassCriteria(app.state.libraryVirtualTrial);
    finishLibraryVirtualTrialRuntime(app, {
      status:'pass',
      reason:passCriteria.reason,
      resultCode:passCriteria.resultLabel,
      passCriteria,
      renderFull:true,
      toast:true
    }, deps);
  }, durationMs);
  deps.notifyLibraryVirtualDiagnostics?.(app);
  deps.renderLibrary?.(app, { source:'recovery-safe-trial-start', followActive:true });
  if (trial.scenario.forceRerenderOnStart) {
    window.requestAnimationFrame(() => {
      if (!app.state.libraryVirtualTrial?.active || app.state.libraryVirtualTrial.id !== trial.id) return;
      recordLibraryVirtualTrialObservationRuntime(app, 'start-force-rerender-before', { source:'recovery-safe-trial-start-force-rerender' }, deps);
      deps.renderLibrary?.(app, { source:'recovery-safe-trial-start-force-rerender', followActive:true });
      recordLibraryVirtualTrialObservationRuntime(app, 'start-force-rerender-after', { source:'recovery-safe-trial-start-force-rerender' }, deps);
    });
  }
  return getLibraryVirtualTrialDiagnostics(app);
}

export function finishLibraryVirtualTrialRuntime(app, options = {}, deps = {}) {
  const trial = app?.state?.libraryVirtualTrial || null;
  if (!trial) return getLibraryVirtualTrialDiagnostics(app);
  clearLibraryVirtualTrialTimerRuntime(app);
  const now = Date.now();
  const status = options.status || (trial.failure ? 'fail' : 'stopped');
  const passCriteria = options.passCriteria || trial.passCriteria || (status === 'pass' ? evaluateLibraryVirtualTrialPassCriteria(trial) : null);
  const resultCode = options.resultCode || trial.resultCode || passCriteria?.resultLabel || '';
  const result = summarizeLibraryVirtualTrial({
    ...trial,
    active: false,
    status,
    resultCode,
    passCriteria,
    endedAt: now,
    reason: options.reason || passCriteria?.reason || trial.reason || status,
    failure: options.failure || trial.failure || null
  });
  app.state.libraryVirtualTrial = result;
  app.state.libraryVirtualTrialResult = result;
  if (!Array.isArray(app.state.libraryVirtualTrialHistory)) app.state.libraryVirtualTrialHistory = [];
  app.state.libraryVirtualTrialHistory.push(result);
  if (app.state.libraryVirtualTrialHistory.length > deps.trialHistoryLimit) {
    app.state.libraryVirtualTrialHistory.splice(0, app.state.libraryVirtualTrialHistory.length - deps.trialHistoryLimit);
  }
  if (options.toast) {
    const passLabel = result.resultLabel || resultCode || '';
    const title = status === 'pass'
      ? (passLabel === 'pass-windowed-rendered' ? 'Safe trial 통과' : 'Safe trial 관찰 부족')
      : status === 'fail' ? 'Safe trial 실패' : 'Safe trial 종료';
    const detail = status === 'fail'
      ? `${result.failure?.categoryLabel || result.failure?.category || 'unknown'} · ${result.failure?.reason || result.reason || '-'}`
      : `${passLabel || status} · ${result.windowedRenders || 0} windowed renders · ${Math.round((result.elapsedMs || 0) / 1000)}s`;
    const toastType = status === 'fail' ? 'error' : passLabel === 'pass-no-render' ? 'warn' : 'info';
    deps.toast?.(app, toastType, title, detail);
  }
  deps.notifyLibraryVirtualDiagnostics?.(app);
  if (options.renderFull && !app.state.prefs?.libraryVirtualRenderer) {
    deps.renderLibrary?.(app, { source: status === 'pass' ? 'recovery-safe-trial-pass' : 'recovery-safe-trial-stop', followActive:true });
  }
  return getLibraryVirtualTrialDiagnostics(app);
}

export function recordLibraryVirtualTrialRenderRuntime(app, record = {}) {
  const trial = app?.state?.libraryVirtualTrial;
  if (!trial?.active) return;
  const now = record.at || Date.now();
  trial.renders = (Number(trial.renders) || 0) + 1;
  if (record.mode === 'windowed') trial.windowedRenders = (Number(trial.windowedRenders) || 0) + 1;
  if (record.mode === 'full') trial.fullRenders = (Number(trial.fullRenders) || 0) + 1;
  if (!trial.firstRenderAt) trial.firstRenderAt = now;
  trial.lastRenderAt = now;
  trial.lastRender = compactLibraryVirtualHistoryRecord(record);
}

export function recordLibraryVirtualTrialFallbackRuntime(app, record = {}, deps = {}) {
  const trial = app?.state?.libraryVirtualTrial;
  if (!trial?.active) return;
  const failure = buildLibraryVirtualSessionFallbackFailure(record);
  trial.fallbackCount = (Number(trial.fallbackCount) || 0) + 1;
  if (isLibraryVirtualSessionExceptionFailure(failure)) {
    trial.exceptionCount = (Number(trial.exceptionCount) || 0) + 1;
  }
  trial.failure = failure;
  finishLibraryVirtualTrialRuntime(app, { status:'fail', reason:'fallback', failure, renderFull:false, toast:true }, deps);
}

export { getLibraryVirtualTrialResultLabel, getLibraryVirtualTrialTone };
