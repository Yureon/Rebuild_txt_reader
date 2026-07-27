// compatibility contract: from './library-virtual-trial-runtime.mjs'
import { finishLibraryVirtualSessionOptInRuntime, recordLibraryVirtualSessionOptInFallbackRuntime, recordLibraryVirtualSessionOptInRenderRuntime, startLibraryVirtualSessionOptInRuntime } from './library-virtual-session-runtime.mjs';
import { normalizeLibraryVirtualTrialHistoryFilter } from './library-runtime-config.mjs';
import { recordLibraryVirtualFallbackRuntime, recordLibraryVirtualRenderRuntime } from './library-virtual-recording-runtime.mjs';

export const LIBRARY_VIRTUAL_OPERATIONS_BRIDGE_PASS = 'v304-library-virtual-operations-bridge-pass';
export const LIBRARY_VIRTUAL_TRIAL_RUNTIME_LAZY_PASS = 'v599-library-virtual-trial-runtime-lazy-pass';

let trialRuntime = null;
let trialRuntimePromise = null;
function ensureTrialRuntime() {
  if (trialRuntime) return Promise.resolve(trialRuntime);
  if (!trialRuntimePromise) {
    trialRuntimePromise = import('./library-virtual-trial-runtime.mjs').then(module => {
      trialRuntime = module;
      return module;
    }).finally(() => { trialRuntimePromise = null; });
  }
  return trialRuntimePromise;
}

export function preloadLibraryVirtualTrialRuntime() { return ensureTrialRuntime(); }

export function createLibraryVirtualOperationsBridge(deps = {}) {
  const trialDeps = app => deps.getLibraryVirtualTrialRuntimeDeps(app);
  return {
    preloadLibraryVirtualTrialRuntime,
    clearLibraryVirtualTrialTimer: app => {
      const timer = app?.state?.libraryVirtualTrialTimer;
      if (timer) clearTimeout(timer);
      if (app?.state) app.state.libraryVirtualTrialTimer = 0;
      return trialRuntime?.clearLibraryVirtualTrialTimerRuntime?.(app);
    },
    captureLibraryVirtualTrialObservationSnapshot: (app, type = 'observation', meta = {}) => trialRuntime?.captureLibraryVirtualTrialObservationSnapshotRuntime?.(app, type, meta, trialDeps(app)) || null,
    recordLibraryVirtualTrialObservation: (app, type = 'observation', meta = {}) => trialRuntime?.recordLibraryVirtualTrialObservationRuntime?.(app, type, meta, trialDeps(app)) || null,
    runLibraryVirtualTrialScenario: (app, scenario, options = {}) => ensureTrialRuntime().then(module => module.runLibraryVirtualTrialScenarioRuntime(app, scenario, options, trialDeps(app))),
    startLibraryVirtualSessionOptIn: (app, options = {}) => startLibraryVirtualSessionOptInRuntime(app, options, deps.getLibraryVirtualSessionRuntimeDeps(app)),
    finishLibraryVirtualSessionOptIn: (app, options = {}) => finishLibraryVirtualSessionOptInRuntime(app, options, deps.getLibraryVirtualSessionRuntimeDeps(app)),
    recordLibraryVirtualSessionOptInRender: (app, record = {}) => recordLibraryVirtualSessionOptInRenderRuntime(app, record),
    recordLibraryVirtualSessionOptInFallback: (app, record = {}) => recordLibraryVirtualSessionOptInFallbackRuntime(app, record, deps.getLibraryVirtualSessionRuntimeDeps(app)),
    setLibraryVirtualTrialHistoryFilter: (app, filter) => {
      if (trialRuntime) return trialRuntime.setLibraryVirtualTrialHistoryFilterRuntime(app, filter, trialDeps(app));
      if (app?.state) app.state.libraryVirtualTrialHistoryFilter = normalizeLibraryVirtualTrialHistoryFilter(filter);
      return app?.state?.libraryVirtualTrialHistoryFilter || 'all';
    },
    startLibraryVirtualTrial: (app, options = {}) => ensureTrialRuntime().then(module => module.startLibraryVirtualTrialRuntime(app, options, trialDeps(app))),
    finishLibraryVirtualTrial: (app, options = {}) => ensureTrialRuntime().then(module => module.finishLibraryVirtualTrialRuntime(app, options, trialDeps(app))),
    recordLibraryVirtualTrialRender: (app, record = {}) => trialRuntime?.recordLibraryVirtualTrialRenderRuntime?.(app, record),
    recordLibraryVirtualTrialFallback: (app, record = {}) => trialRuntime?.recordLibraryVirtualTrialFallbackRuntime?.(app, record, trialDeps(app)),
    recordLibraryVirtualRender: (app, record) => recordLibraryVirtualRenderRuntime(app, record, deps.getLibraryVirtualRecordingDeps(app)),
    recordLibraryVirtualFallback: (app, record) => recordLibraryVirtualFallbackRuntime(app, record, deps.getLibraryVirtualRecordingDeps(app))
  };
}
