import { finishLibraryVirtualSessionOptInRuntime, recordLibraryVirtualSessionOptInFallbackRuntime, recordLibraryVirtualSessionOptInRenderRuntime, startLibraryVirtualSessionOptInRuntime } from './library-virtual-session-runtime.mjs';
import { captureLibraryVirtualTrialObservationSnapshotRuntime, clearLibraryVirtualTrialTimerRuntime, finishLibraryVirtualTrialRuntime, recordLibraryVirtualTrialFallbackRuntime, recordLibraryVirtualTrialObservationRuntime, recordLibraryVirtualTrialRenderRuntime, runLibraryVirtualTrialScenarioRuntime, setLibraryVirtualTrialHistoryFilterRuntime, startLibraryVirtualTrialRuntime } from './library-virtual-trial-runtime.mjs';
import { recordLibraryVirtualFallbackRuntime, recordLibraryVirtualRenderRuntime } from './library-virtual-recording-runtime.mjs';

export const LIBRARY_VIRTUAL_OPERATIONS_BRIDGE_PASS = 'v304-library-virtual-operations-bridge-pass';

export function createLibraryVirtualOperationsBridge(deps = {}) {
  return {
    clearLibraryVirtualTrialTimer: app => clearLibraryVirtualTrialTimerRuntime(app),
    captureLibraryVirtualTrialObservationSnapshot: (app, type = 'observation', meta = {}) => captureLibraryVirtualTrialObservationSnapshotRuntime(app, type, meta, deps.getLibraryVirtualTrialRuntimeDeps(app)),
    recordLibraryVirtualTrialObservation: (app, type = 'observation', meta = {}) => recordLibraryVirtualTrialObservationRuntime(app, type, meta, deps.getLibraryVirtualTrialRuntimeDeps(app)),
    runLibraryVirtualTrialScenario: (app, scenario, options = {}) => runLibraryVirtualTrialScenarioRuntime(app, scenario, options, deps.getLibraryVirtualTrialRuntimeDeps(app)),
    startLibraryVirtualSessionOptIn: (app, options = {}) => startLibraryVirtualSessionOptInRuntime(app, options, deps.getLibraryVirtualSessionRuntimeDeps(app)),
    finishLibraryVirtualSessionOptIn: (app, options = {}) => finishLibraryVirtualSessionOptInRuntime(app, options, deps.getLibraryVirtualSessionRuntimeDeps(app)),
    recordLibraryVirtualSessionOptInRender: (app, record = {}) => recordLibraryVirtualSessionOptInRenderRuntime(app, record),
    recordLibraryVirtualSessionOptInFallback: (app, record = {}) => recordLibraryVirtualSessionOptInFallbackRuntime(app, record, deps.getLibraryVirtualSessionRuntimeDeps(app)),
    setLibraryVirtualTrialHistoryFilter: (app, filter) => setLibraryVirtualTrialHistoryFilterRuntime(app, filter, deps.getLibraryVirtualTrialRuntimeDeps(app)),
    startLibraryVirtualTrial: (app, options = {}) => startLibraryVirtualTrialRuntime(app, options, deps.getLibraryVirtualTrialRuntimeDeps(app)),
    finishLibraryVirtualTrial: (app, options = {}) => finishLibraryVirtualTrialRuntime(app, options, deps.getLibraryVirtualTrialRuntimeDeps(app)),
    recordLibraryVirtualTrialRender: (app, record = {}) => recordLibraryVirtualTrialRenderRuntime(app, record),
    recordLibraryVirtualTrialFallback: (app, record = {}) => recordLibraryVirtualTrialFallbackRuntime(app, record, deps.getLibraryVirtualTrialRuntimeDeps(app)),
    recordLibraryVirtualRender: (app, record) => recordLibraryVirtualRenderRuntime(app, record, deps.getLibraryVirtualRecordingDeps(app)),
    recordLibraryVirtualFallback: (app, record) => recordLibraryVirtualFallbackRuntime(app, record, deps.getLibraryVirtualRecordingDeps(app))
  };
}
