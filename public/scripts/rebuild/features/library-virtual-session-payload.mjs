export const LIBRARY_VIRTUAL_SESSION_PAYLOAD_SPLIT_PASS = 'v208-library-virtual-session-payload-pass';

export function createLibraryVirtualSessionOptInRecord({ source = 'recovery-session-opt-in', safeTrialAtStart = null, now = Date.now(), token = '' } = {}) {
  const suffix = String(token || Math.random().toString(36).slice(2, 8) || 'manual').slice(0, 16);
  return {
    id: `session-opt-in-${Number(now) || Date.now()}-${suffix}`,
    active: true,
    status: 'running',
    source: String(source || 'recovery-session-opt-in'),
    startedAt: Number(now) || Date.now(),
    endedAt: 0,
    renders: 0,
    windowedRenders: 0,
    fullRenders: 0,
    fallbackCount: 0,
    exceptionCount: 0,
    lastRender: null,
    lastFallback: null,
    failure: null,
    reason: '',
    safeTrialAtStart,
    observations: [],
    liveStabilizationPass: 'v140-session-opt-in-live-stabilization',
    prefsUnchanged: true,
    fallbackToFullOnFailure: true,
    payloadSplitPass: LIBRARY_VIRTUAL_SESSION_PAYLOAD_SPLIT_PASS
  };
}

export function finishLibraryVirtualSessionOptInRecord(session = null, options = {}, now = Date.now()) {
  const src = session && typeof session === 'object' ? session : {};
  return {
    ...src,
    active: false,
    status: options.status || src.status || 'stopped',
    endedAt: Number(now) || Date.now(),
    reason: options.reason || src.reason || 'stopped',
    failure: options.failure || src.failure || null,
    payloadSplitPass: LIBRARY_VIRTUAL_SESSION_PAYLOAD_SPLIT_PASS
  };
}

export function appendLibraryVirtualSessionOptInHistory(history = [], result = null, limit = 12) {
  const safeLimit = Math.max(1, Math.min(50, Math.round(Number(limit) || 12)));
  const list = Array.isArray(history) ? history.slice() : [];
  if (result) list.push(result);
  return list.slice(-safeLimit);
}
