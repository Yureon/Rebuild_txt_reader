export const PERIODIC_DEVICE_SYNC_REFACTOR_PASS = 'v622-periodic-device-sync-diagnostics-pass';
export const PERIODIC_DEVICE_SYNC_DIRTY_CHECK_PASS = 'v457-periodic-device-sync-dirty-check-smoke-pass';
export const PERIODIC_DEVICE_SYNC_VISIBILITY_GUARD_PASS = 'v565-periodic-device-sync-visibility-guard-pass';
export const PERIODIC_DEVICE_SYNC_LAZY_UI_PASS = 'v568-periodic-device-sync-lazy-ui-pass';

let remoteResumeModulePromise = null;

function maybeRefreshLoadedSyncUi(app, summary, options = {}) {
  if (!summary) return;
  if (app.lazyFeatures?.isLoaded?.('devtools')) {
    app.ensureDevtools?.().then(() => {
      window.dispatchEvent?.(new CustomEvent('txt-reader:sync-policy-updated', { detail:{ summary, notify:!!options.notify, pass:PERIODIC_DEVICE_SYNC_LAZY_UI_PASS } }));
    }).catch(() => {});
  }
  if (!summary?.progressAuthority?.shouldOfferRemoteResume) return;
  remoteResumeModulePromise ||= import('./remote-resume.mjs');
  remoteResumeModulePromise
    .then(module => module.handleRemoteResumeOffer(app, summary, { notify:!!options.notify }))
    .catch(() => { remoteResumeModulePromise = null; });
}

export function installPeriodicDeviceSync(app) {
  if (app.deviceSync?.installed) return app.deviceSync;
  const state = {
    installed: true,
    inFlight: false,
    intervalId: 0,
    initialTimer: 0,
    beforeUnloadHandler: null,
    visibilityHandler: null,
    onlineHandler: null,
    lastSuccessfulPayloadHash: '',
    skippedUnchangedPushes: 0,
    skippedHiddenPushes: 0,
    skippedOfflinePushes: 0,
    consecutiveFailures: 0,
    lastFailureAt: 0,
    lastError: '',
    lastErrorCode: '',
    nextRetryAt: 0,
    lastSuccessAt: 0,
    dirtyCheckPass: PERIODIC_DEVICE_SYNC_DIRTY_CHECK_PASS,
    visibilityGuardPass: PERIODIC_DEVICE_SYNC_VISIBILITY_GUARD_PASS,
    lazyUiPass: PERIODIC_DEVICE_SYNC_LAZY_UI_PASS
  };
  const push = async (options = {}) => {
    if (state.inFlight) return null;
    if (state.nextRetryAt && Date.now() < state.nextRetryAt && options?.force !== true) {
      state.lastSkip = { reason:'failure-backoff', skippedAt:Date.now(), nextRetryAt:state.nextRetryAt };
      return { ok:false, skipped:true, reason:'failure-backoff', nextRetryAt:state.nextRetryAt };
    }
    const force = options === true || options?.force === true;
    const allowBackground = options?.allowBackground === true;
    if (!allowBackground && typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      state.skippedHiddenPushes += 1;
      state.lastSkip = { pass: PERIODIC_DEVICE_SYNC_VISIBILITY_GUARD_PASS, reason: 'document hidden', skippedAt: Date.now() };
      return { ok: true, skipped: true, pass: PERIODIC_DEVICE_SYNC_VISIBILITY_GUARD_PASS, reason: 'hidden' };
    }
    if (!allowBackground && typeof navigator !== 'undefined' && navigator.onLine === false) {
      state.skippedOfflinePushes += 1;
      state.lastSkip = { pass: PERIODIC_DEVICE_SYNC_VISIBILITY_GUARD_PASS, reason: 'offline', skippedAt: Date.now() };
      return { ok: true, skipped: true, pass: PERIODIC_DEVICE_SYNC_VISIBILITY_GUARD_PASS, reason: 'offline' };
    }
    state.inFlight = true;
    try {
      if (app.state.serverStateHydrated !== true) {
        const { hydrateServerState } = await import('./server-state-hydration.mjs');
        if (!await hydrateServerState(app, { silent:true })) {
          return { ok:false, skipped:true, reason:'server-state-not-hydrated' };
        }
      }
      const { buildPeriodicSyncEnvelope, pushPeriodicState } = await import('./periodic-state-push.mjs');
      const envelope = buildPeriodicSyncEnvelope(app);
      const payloadHash = envelope.payloadHash;
      if (!force && state.lastSuccessfulPayloadHash && payloadHash === state.lastSuccessfulPayloadHash) {
        state.skippedUnchangedPushes += 1;
        state.lastSkip = { pass: PERIODIC_DEVICE_SYNC_DIRTY_CHECK_PASS, reason: 'unchanged payload', skippedAt: Date.now() };
        return { ok: true, skipped: true, pass: PERIODIC_DEVICE_SYNC_DIRTY_CHECK_PASS };
      }
      const res = await pushPeriodicState(app, envelope);
      if (res?.synced === true) {
        state.lastSuccessfulPayloadHash = payloadHash;
        state.consecutiveFailures = 0;
        state.lastFailureAt = 0;
        state.lastError = '';
        state.lastErrorCode = '';
        state.nextRetryAt = 0;
        state.lastSuccessAt = Date.now();
        if (res.syncPolicySummary) maybeRefreshLoadedSyncUi(app, res.syncPolicySummary, { notify:true });
      }
      return res || null;
    } catch (error) {
      state.consecutiveFailures += 1;
      state.lastFailureAt = Date.now();
      state.lastError = String(error?.message || error || 'periodic sync failed').slice(0, 600);
      state.lastErrorCode = String(error?.code || 'PERIODIC_SYNC_FAILED').slice(0, 120);
      const backoffMs = Math.min(5 * 60_000, 30_000 * (2 ** Math.min(4, Math.max(0, state.consecutiveFailures - 1))));
      state.nextRetryAt = Date.now() + backoffMs;
      app.state.syncDiagnostics = {
        pass:PERIODIC_DEVICE_SYNC_REFACTOR_PASS,
        consecutiveFailures:state.consecutiveFailures,
        lastFailureAt:state.lastFailureAt,
        lastError:state.lastError,
        lastErrorCode:state.lastErrorCode,
        nextRetryAt:state.nextRetryAt,
        deviceError:String(error?.deviceError || '').slice(0, 500),
        sharedError:String(error?.sharedError || '').slice(0, 500)
      };
      window.dispatchEvent?.(new CustomEvent('txt-reader:periodic-sync-error', { detail:app.state.syncDiagnostics }));
      if (state.consecutiveFailures === 1 || state.consecutiveFailures % 5 === 0) console.warn('[periodic-sync]', state.lastErrorCode, state.lastError);
      return { ok:false, error:state.lastErrorCode, message:state.lastError, nextRetryAt:state.nextRetryAt };
    } finally {
      state.inFlight = false;
    }
  };
  state.beforeUnloadHandler = () => { state.lastPageExitAt = Date.now(); };
  state.visibilityHandler = () => {
    if (document.visibilityState === 'visible') push();
  };
  state.onlineHandler = () => push();
  window.addEventListener('beforeunload', state.beforeUnloadHandler);
  document.addEventListener('visibilitychange', state.visibilityHandler);
  window.addEventListener('online', state.onlineHandler);
  state.intervalId = window.setInterval(() => push(), 30_000);
  maybeRefreshLoadedSyncUi(app, app.state.syncPolicySummary, { notify:false });
  state.initialTimer = window.setTimeout(() => push({ force: true }), 1200);
  app.deviceSync = {
    installed: true,
    push,
    stop: () => {
      window.clearInterval(state.intervalId);
      window.clearTimeout(state.initialTimer);
      if (state.beforeUnloadHandler) window.removeEventListener('beforeunload', state.beforeUnloadHandler);
      if (state.visibilityHandler) document.removeEventListener('visibilitychange', state.visibilityHandler);
      if (state.onlineHandler) window.removeEventListener('online', state.onlineHandler);
      state.installed = false;
      if (app.deviceSync?.state === state) app.deviceSync = null;
    },
    state
  };
  return app.deviceSync;
}
