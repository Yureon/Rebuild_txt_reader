import { summarizeLibraryVirtualTrialForSession } from './library-runtime-config.mjs';

export const LIBRARY_VIRTUAL_SESSION_DIAGNOSTICS_SPLIT_PASS = 'v203-library-virtual-session-diagnostics-split-pass';
export const LIBRARY_VIRTUAL_SESSION_OPT_IN_HISTORY_LIMIT = 12;
export const LIBRARY_VIRTUAL_SESSION_OBSERVATION_LIMIT = 20;

export function pushLibraryVirtualSessionObservation(session, type, record = {}) {
  if (!session) return;
  if (!Array.isArray(session.observations)) session.observations = [];
  session.observations.push({
    type: String(type || 'observation'),
    at: Date.now(),
    mode: record.mode || '',
    source: record.source || '',
    reason: record.reason || '',
    rowCount: Number.isFinite(Number(record.rowCount)) ? Number(record.rowCount) : null,
    renderedRows: Number.isFinite(Number(record.renderedRows)) ? Number(record.renderedRows) : null,
    renderStart: Number.isFinite(Number(record.renderStart)) ? Number(record.renderStart) : null,
    renderEnd: Number.isFinite(Number(record.renderEnd)) ? Number(record.renderEnd) : null,
    activeFollowApplied: !!record.scrollPolicy?.activeFollowApplied,
    activeFollowIndex: Number.isFinite(Number(record.scrollPolicy?.activeFollowIndex)) ? Number(record.scrollPolicy.activeFollowIndex) : null,
    anchorRestored: !!record.scrollPolicy?.anchorRestored,
    gateAllowed: record.gate ? !!record.gate.allowed : null,
    gateReason: record.gate?.reason || ''
  });
  if (session.observations.length > LIBRARY_VIRTUAL_SESSION_OBSERVATION_LIMIT) {
    session.observations.splice(0, session.observations.length - LIBRARY_VIRTUAL_SESSION_OBSERVATION_LIMIT);
  }
}

export function buildLibraryVirtualSessionLiveStabilization(app, session = null) {
  const trial = summarizeLibraryVirtualTrialForSession(app);
  const active = !!session?.active;
  const windowed = Number(session?.windowedRenders) || 0;
  const fallback = Number(session?.fallbackCount) || 0;
  const exceptions = Number(session?.exceptionCount) || 0;
  const full = Number(session?.fullRenders) || 0;
  const hasWindowed = windowed > 0;
  const fallbackFree = fallback === 0;
  const exceptionFree = exceptions === 0;
  const status = !session
    ? 'idle'
    : fallback > 0 || exceptions > 0
      ? 'failed-fallback-to-full'
      : active && hasWindowed
        ? 'running-windowed'
        : active
          ? 'running-awaiting-windowed-render'
          : hasWindowed
            ? 'completed-windowed'
            : 'stopped-no-windowed-render';
  const blockers = [];
  if (!trial.passedWindowed) blockers.push('safe-trial-windowed-pass-not-confirmed-in-runtime');
  if (session && !hasWindowed) blockers.push('session-windowed-render-not-observed');
  if (!fallbackFree) blockers.push('session-fallback-observed');
  if (!exceptionFree) blockers.push('session-exception-observed');
  return {
    pass: 'v140-session-opt-in-live-stabilization',
    status,
    active,
    rendererMode: active ? (hasWindowed ? 'windowed' : 'pending-first-windowed-render') : 'full-default',
    sessionWindowedObserved: hasWindowed,
    safeTrialWindowedPass: !!trial.passedWindowed,
    fallbackFree,
    exceptionFree,
    fullRenderCount: full,
    windowedRenderCount: windowed,
    fallbackCount: fallback,
    exceptionCount: exceptions,
    blockers,
    readyForExtendedOptIn: blockers.length === 0 && !!session && hasWindowed,
    nextAction: blockers.length
      ? 'session opt-in 상태에서 목록 접기/펼치기, active follow, 장기 스크롤을 실행하고 diagnostics JSON을 확인하세요.'
      : 'session opt-in 장시간 사용에서 fallback/error가 없으면 다음 단계에서 제한 persistent opt-in을 검토할 수 있습니다.',
    latestSafeTrial: trial
  };
}

export function summarizeLibraryVirtualSessionOptIn(session = null, app = null) {
  if (!session) return null;
  const now = Date.now();
  const startedAt = Number(session.startedAt) || 0;
  const endedAt = Number(session.endedAt) || 0;
  const active = !!session.active;
  const observations = Array.isArray(session.observations) ? session.observations.slice(-LIBRARY_VIRTUAL_SESSION_OBSERVATION_LIMIT) : [];
  const summary = {
    id: session.id || '',
    active,
    status: session.status || (active ? 'running' : 'idle'),
    source: session.source || '',
    startedAt,
    endedAt,
    elapsedMs: Math.max(0, (endedAt || now) - startedAt),
    renders: Number(session.renders) || 0,
    windowedRenders: Number(session.windowedRenders) || 0,
    fullRenders: Number(session.fullRenders) || 0,
    fallbackCount: Number(session.fallbackCount) || 0,
    exceptionCount: Number(session.exceptionCount) || 0,
    lastRender: session.lastRender || null,
    lastFallback: session.lastFallback || null,
    failure: session.failure || null,
    reason: session.reason || '',
    safeTrialAtStart: session.safeTrialAtStart || null,
    observations,
    observationCount: observations.length,
    prefsUnchanged: session.prefsUnchanged !== false,
    fallbackToFullOnFailure: session.fallbackToFullOnFailure !== false,
    scope: 'current-session-only',
    note: 'runtime-only live opt-in; prefs.libraryVirtualRenderer is not persisted and page reload returns to full renderer'
  };
  summary.liveStabilization = buildLibraryVirtualSessionLiveStabilization(app, session);
  return summary;
}

export function getLibraryVirtualSessionOptInDiagnostics(app) {
  const current = summarizeLibraryVirtualSessionOptIn(app?.state?.libraryVirtualSessionOptIn || null, app);
  const history = Array.isArray(app?.state?.libraryVirtualSessionOptInHistory)
    ? app.state.libraryVirtualSessionOptInHistory.slice(-LIBRARY_VIRTUAL_SESSION_OPT_IN_HISTORY_LIMIT).map(item => summarizeLibraryVirtualSessionOptIn(item, app)).filter(Boolean)
    : [];
  const lastResult = current && !current.active ? current : (history.length ? history[history.length - 1] : null);
  const liveStabilization = buildLibraryVirtualSessionLiveStabilization(app, app?.state?.libraryVirtualSessionOptIn || null);
  return {
    available: true,
    active: !!current?.active,
    status: current?.status || 'idle',
    current,
    lastResult,
    history,
    latestSafeTrial: liveStabilization.latestSafeTrial,
    liveStabilization,
    policy: {
      scope: 'current-session-only',
      persisted: false,
      prefsUnchanged: true,
      defaultRenderer: 'virtual-guarded',
      fallbackRenderer: 'full',
      fallbackToFullOnFailure: true,
      settingsToggleExposed: false,
      automaticEnableAllowed: false,
      extendedPersistentOptInAllowed: false,
      productionDefaultEnabled: true
    }
  };
}
