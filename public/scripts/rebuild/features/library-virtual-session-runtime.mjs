import { compactLibraryVirtualHistoryRecord } from './library-virtual-history-record.mjs';
import { pushLibraryVirtualSessionObservation } from './library-virtual-session-diagnostics.mjs';
import { appendLibraryVirtualSessionOptInHistory, createLibraryVirtualSessionOptInRecord, finishLibraryVirtualSessionOptInRecord } from './library-virtual-session-payload.mjs';
import { buildLibraryVirtualSessionFallbackFailure, isLibraryVirtualSessionExceptionFailure } from './library-virtual-session-fallback.mjs';

export const LIBRARY_VIRTUAL_SESSION_RUNTIME_PASS = 'v283-library-virtual-session-runtime-pass';

export function startLibraryVirtualSessionOptInRuntime(app, options = {}, deps = {}) {
  const now = Date.now();
  app.state.libraryVirtualSessionOptIn = createLibraryVirtualSessionOptInRecord({
    source: options.source || 'recovery-session-opt-in',
    safeTrialAtStart: deps.summarizeLibraryVirtualTrialForSession?.(app) || null,
    now
  });
  deps.notifyLibraryVirtualDiagnostics?.(app);
  deps.renderLibrary?.(app, { source: options.source || 'recovery-session-opt-in-start', followActive:true });
  return deps.getLibraryVirtualSessionOptInDiagnostics?.(app) || null;
}

export function finishLibraryVirtualSessionOptInRuntime(app, options = {}, deps = {}) {
  const session = app?.state?.libraryVirtualSessionOptIn;
  if (!session) return deps.getLibraryVirtualSessionOptInDiagnostics?.(app) || null;
  const result = finishLibraryVirtualSessionOptInRecord(session, options, Date.now());
  app.state.libraryVirtualSessionOptIn = result;
  app.state.libraryVirtualSessionOptInHistory = appendLibraryVirtualSessionOptInHistory(
    app.state.libraryVirtualSessionOptInHistory,
    result,
    deps.sessionOptInHistoryLimit
  );
  deps.notifyLibraryVirtualDiagnostics?.(app);
  if (options.toast) {
    const failed = result.status === 'fail';
    deps.toast?.(
      app,
      failed ? 'error' : 'info',
      failed ? 'Session opt-in fallback' : 'Session opt-in 종료',
      failed ? (result.failure?.reason || result.reason || 'full renderer로 되돌렸습니다.') : '현재 세션 virtual renderer opt-in을 종료했습니다.'
    );
  }
  if (options.renderFull) deps.renderLibrary?.(app, { source: options.source || 'recovery-session-opt-in-stop', followActive:true });
  return deps.getLibraryVirtualSessionOptInDiagnostics?.(app) || null;
}

export function recordLibraryVirtualSessionOptInRenderRuntime(app, record = {}) {
  const session = app?.state?.libraryVirtualSessionOptIn;
  if (!session?.active) return;
  session.renders = (Number(session.renders) || 0) + 1;
  if (record.mode === 'windowed') session.windowedRenders = (Number(session.windowedRenders) || 0) + 1;
  if (record.mode === 'full') session.fullRenders = (Number(session.fullRenders) || 0) + 1;
  session.lastRender = compactLibraryVirtualHistoryRecord(record);
  session.lastRenderAt = record.at || Date.now();
  pushLibraryVirtualSessionObservation(session, record.mode === 'windowed' ? 'windowed-render' : 'full-render', record);
}

export function recordLibraryVirtualSessionOptInFallbackRuntime(app, record = {}, deps = {}) {
  const session = app?.state?.libraryVirtualSessionOptIn;
  if (!session?.active) return;
  const failure = buildLibraryVirtualSessionFallbackFailure(record);
  session.fallbackCount = (Number(session.fallbackCount) || 0) + 1;
  if (isLibraryVirtualSessionExceptionFailure(failure)) session.exceptionCount = (Number(session.exceptionCount) || 0) + 1;
  session.lastFallback = compactLibraryVirtualHistoryRecord(record);
  session.failure = failure;
  pushLibraryVirtualSessionObservation(session, 'fallback-to-full', record);
  finishLibraryVirtualSessionOptInRuntime(app, { status:'fail', reason:'fallback-to-full', failure, renderFull:false, toast:true }, deps);
}
