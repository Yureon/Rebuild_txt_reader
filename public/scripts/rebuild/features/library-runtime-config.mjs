export const LIBRARY_RUNTIME_CONFIG_PASS = 'v300-library-runtime-config-pass';

export const LIBRARY_FILTER_RENDER_WAIT = 120;
export const LIBRARY_VIRTUAL_HISTORY_LIMIT = 20;
export const LIBRARY_VIRTUAL_DEFAULT_ROLLOUT_PASS = 'v141-library-render-path-optimization';
export const LIBRARY_VIRTUAL_AUTO_FALLBACK_STORAGE_KEY = 'libraryVirtualRendererAutoFallback';
export const LIBRARY_VIRTUAL_WIDE_WINDOW_OVERSCAN = 24;
export const LIBRARY_VIRTUAL_WIDE_MAX_WINDOW_ROWS = 360;
export const LIBRARY_VIRTUAL_RENDER_WINDOW_SKIP_PASS = 'v141-library-render-window-skip-pass';
export const LIBRARY_VIRTUAL_AUTO_ENABLE_ROW_THRESHOLD = 750;


// v599 lazy safe-trial contract: detailed diagnostics remain in library-virtual-trial-diagnostics.mjs.
export const LIBRARY_VIRTUAL_TRIAL_LAZY_PASS = 'v599-library-virtual-trial-lazy-pass';
export const LIBRARY_VIRTUAL_TRIAL_HISTORY_LIMIT = 10;
export const LIBRARY_VIRTUAL_TRIAL_HISTORY_FILTERS = ['all', 'pass', 'pass-windowed-rendered', 'pass-no-render', 'fail', 'stopped'];
export const LIBRARY_VIRTUAL_TRIAL_DEFAULT_MS = 30000;
export const LIBRARY_VIRTUAL_TRIAL_MIN_MS = 5000;
export const LIBRARY_VIRTUAL_TRIAL_MAX_MS = 120000;
export const LIBRARY_VIRTUAL_TRIAL_DURATION_PRESETS = [10000, 30000, 60000, 120000];

export function normalizeLibraryVirtualTrialHistoryFilter(value) {
  const text = String(value || 'all').trim().toLowerCase();
  return LIBRARY_VIRTUAL_TRIAL_HISTORY_FILTERS.includes(text) ? text : 'all';
}

function resultLabel(trial = {}) {
  const explicit = String(trial.resultLabel || trial.resultCode || '').trim();
  if (explicit) return explicit;
  if (trial.active || trial.status === 'running') return 'running';
  if (trial.status === 'pass') return Number(trial.windowedRenders) > 0 ? 'pass-windowed-rendered' : 'pass-no-render';
  return String(trial.status || 'idle');
}

function summarize(trial = null) {
  if (!trial) return null;
  const active = !!trial.active;
  const startedAt = Number(trial.startedAt) || 0;
  const endedAt = Number(trial.endedAt) || 0;
  return {
    ...trial,
    active,
    status: trial.status || (active ? 'running' : 'idle'),
    resultLabel: resultLabel(trial),
    startedAt,
    endedAt,
    elapsedMs: Math.max(0, (endedAt || Date.now()) - startedAt),
    windowedRenders: Number(trial.windowedRenders) || 0,
    fallbackCount: Number(trial.fallbackCount) || 0,
    exceptionCount: Number(trial.exceptionCount) || 0
  };
}

export function getLibraryVirtualTrialDiagnostics(app) {
  const current = summarize(app?.state?.libraryVirtualTrial || null);
  const lastResult = summarize(app?.state?.libraryVirtualTrialResult || null);
  const history = Array.isArray(app?.state?.libraryVirtualTrialHistory)
    ? app.state.libraryVirtualTrialHistory.slice(-LIBRARY_VIRTUAL_TRIAL_HISTORY_LIMIT).map(summarize).filter(Boolean)
    : [];
  const historyFilter = normalizeLibraryVirtualTrialHistoryFilter(app?.state?.libraryVirtualTrialHistoryFilter);
  return {
    available: true,
    lazy: true,
    pass: LIBRARY_VIRTUAL_TRIAL_LAZY_PASS,
    active: !!current?.active,
    status: current?.status || lastResult?.status || 'idle',
    current,
    lastResult,
    history,
    filteredHistory: historyFilter === 'all' ? history : history.filter(item => {
      const label = resultLabel(item);
      return historyFilter === 'pass' ? label.startsWith('pass') : label === historyFilter;
    }),
    historyFilter,
    historyFilters: LIBRARY_VIRTUAL_TRIAL_HISTORY_FILTERS.slice(),
    durationPresets: LIBRARY_VIRTUAL_TRIAL_DURATION_PRESETS.slice(),
    defaultDurationMs: LIBRARY_VIRTUAL_TRIAL_DEFAULT_MS,
    minDurationMs: LIBRARY_VIRTUAL_TRIAL_MIN_MS,
    maxDurationMs: LIBRARY_VIRTUAL_TRIAL_MAX_MS,
    persistentFlagEnabled: !!app?.state?.prefs?.libraryVirtualRenderer,
    note: 'detailed safe-trial diagnostics load with Recovery Center'
  };
}

export function summarizeLibraryVirtualTrialForSession(app) {
  const candidates = [
    app?.state?.libraryVirtualTrial,
    app?.state?.libraryVirtualTrialResult,
    ...(Array.isArray(app?.state?.libraryVirtualTrialHistory) ? app.state.libraryVirtualTrialHistory.slice().reverse() : [])
  ].filter(Boolean);
  const trial = candidates.find(item => !item.active && item.status) || candidates[0] || null;
  if (!trial) return { available:false, status:'not-run', resultLabel:'', passedWindowed:false, windowedRenders:0, fallbackCount:0, exceptionCount:0, endedAt:0, note:'safe trial result is not available in this runtime session' };
  const label = resultLabel(trial);
  const windowedRenders = Number(trial.windowedRenders) || Number(trial.passCriteria?.metrics?.windowedRenders) || 0;
  const fallbackCount = Number(trial.fallbackCount) || 0;
  const exceptionCount = Number(trial.exceptionCount) || 0;
  return {
    available:true,
    status:trial.status || 'unknown',
    resultLabel:label,
    passedWindowed:(trial.status === 'pass' || label.startsWith('pass')) && windowedRenders > 0 && fallbackCount === 0 && exceptionCount === 0,
    windowedRenders,
    fallbackCount,
    exceptionCount,
    endedAt:Number(trial.endedAt || trial.generatedAt || trial.deadlineAt) || 0,
    elapsedMs:Number(trial.elapsedMs) || 0,
    reason:trial.reason || '',
    note:'lightweight trial summary; detailed evidence is deferred'
  };
}
