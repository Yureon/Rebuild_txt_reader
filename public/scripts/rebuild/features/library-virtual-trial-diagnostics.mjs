export const LIBRARY_VIRTUAL_TRIAL_DIAGNOSTICS_SPLIT_PASS = 'v197-library-virtual-trial-diagnostics-split-pass';

export const LIBRARY_VIRTUAL_TRIAL_HISTORY_LIMIT = 10;
export const LIBRARY_VIRTUAL_TRIAL_HISTORY_FILTERS = ['all', 'pass', 'pass-windowed-rendered', 'pass-no-render', 'fail', 'stopped'];
export const LIBRARY_VIRTUAL_TRIAL_DEFAULT_MS = 30000;
export const LIBRARY_VIRTUAL_TRIAL_MIN_MS = 5000;
export const LIBRARY_VIRTUAL_TRIAL_MAX_MS = 120000;
export const LIBRARY_VIRTUAL_TRIAL_DURATION_PRESETS = [10000, 30000, 60000, 120000];
export const LIBRARY_VIRTUAL_TRIAL_OBSERVATION_LIMIT = 30;
export const LIBRARY_VIRTUAL_TRIAL_CONFIDENCE_PASS_TARGET = 3;
export const LIBRARY_VIRTUAL_TRIAL_COVERAGE_TARGETS = ['force-rerender', 'scroll-observe', 'follow-active', 'top-anchor'];

export function clampLibraryVirtualTrialDuration(value) {
  const ms = Math.round(Number(value) || LIBRARY_VIRTUAL_TRIAL_DEFAULT_MS);
  return Math.max(LIBRARY_VIRTUAL_TRIAL_MIN_MS, Math.min(LIBRARY_VIRTUAL_TRIAL_MAX_MS, ms));
}

export function normalizeLibraryVirtualTrialDurationPreset(value) {
  const ms = clampLibraryVirtualTrialDuration(value);
  return LIBRARY_VIRTUAL_TRIAL_DURATION_PRESETS.includes(ms) ? ms : LIBRARY_VIRTUAL_TRIAL_DEFAULT_MS;
}

export function getLibraryVirtualTrialDurationPresets() {
  return LIBRARY_VIRTUAL_TRIAL_DURATION_PRESETS.slice();
}

export function trimLibraryVirtualTrialObservations(trial) {
  if (!trial || !Array.isArray(trial.observations)) return;
  if (trial.observations.length > LIBRARY_VIRTUAL_TRIAL_OBSERVATION_LIMIT) {
    trial.observations.splice(0, trial.observations.length - LIBRARY_VIRTUAL_TRIAL_OBSERVATION_LIMIT);
  }
}

export function countLibraryVirtualTrialObservations(observations = []) {
  return (Array.isArray(observations) ? observations : []).reduce((acc, item) => {
    const type = String(item?.type || 'unknown');
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
}

export function getLibraryVirtualTrialCoverageTargetForType(type = '') {
  const text = String(type || '').toLowerCase();
  if (/force-rerender/.test(text)) return 'force-rerender';
  if (/scroll-observe/.test(text)) return 'scroll-observe';
  if (/follow-active/.test(text)) return 'follow-active';
  if (/top-anchor/.test(text)) return 'top-anchor';
  return '';
}

export function isLibraryVirtualTrialObservationWindowed(item = {}) {
  if (!item || typeof item !== 'object') return false;
  if (item.renderer === 'windowed') return true;
  if (item.windowedAtObservation === true) return true;
  if (item.coverageEligible === true) return true;
  if (item.rendererState?.effectiveWindowed === true) return true;
  return false;
}

export function summarizeLibraryVirtualTrialCoverageEvidence(observations = []) {
  const evidence = {};
  LIBRARY_VIRTUAL_TRIAL_COVERAGE_TARGETS.forEach(key => {
    evidence[key] = {
      observed: false,
      qualified: false,
      count: 0,
      qualifiedCount: 0,
      nonWindowedCount: 0,
      rendererCounts: {},
      firstAt: 0,
      firstQualifiedAt: 0,
      latestAt: 0,
      latestQualifiedAt: 0,
      sample: null,
      qualifiedSample: null
    };
  });
  (Array.isArray(observations) ? observations : []).forEach(item => {
    const target = getLibraryVirtualTrialCoverageTargetForType(item?.type || '');
    if (!target || !evidence[target]) return;
    const entry = evidence[target];
    const at = Number(item?.at) || 0;
    const renderer = String(item?.renderer || item?.rendererState?.actualRenderer || 'unknown');
    const qualified = isLibraryVirtualTrialObservationWindowed(item);
    entry.observed = true;
    entry.count += 1;
    entry.rendererCounts[renderer] = (entry.rendererCounts[renderer] || 0) + 1;
    if (!entry.firstAt || (at && at < entry.firstAt)) entry.firstAt = at;
    if (at > entry.latestAt) entry.latestAt = at;
    if (!entry.sample) entry.sample = {
      type: item?.type || '',
      renderer,
      at,
      source: item?.source || '',
      windowRange: item?.window ? String(item.window.renderStart ?? 0) + '-' + String(item.window.renderEnd ?? 0) + '/' + String(item.window.totalRows ?? 0) : ''
    };
    if (qualified) {
      entry.qualified = true;
      entry.qualifiedCount += 1;
      if (!entry.firstQualifiedAt || (at && at < entry.firstQualifiedAt)) entry.firstQualifiedAt = at;
      if (at > entry.latestQualifiedAt) entry.latestQualifiedAt = at;
      if (!entry.qualifiedSample) entry.qualifiedSample = {
        type: item?.type || '',
        renderer,
        at,
        source: item?.source || '',
        windowRange: item?.window ? String(item.window.renderStart ?? 0) + '-' + String(item.window.renderEnd ?? 0) + '/' + String(item.window.totalRows ?? 0) : ''
      };
    } else {
      entry.nonWindowedCount += 1;
    }
  });
  return evidence;
}

export function normalizeLibraryVirtualTrialHistoryFilter(value) {
  const text = String(value || 'all').trim().toLowerCase();
  return LIBRARY_VIRTUAL_TRIAL_HISTORY_FILTERS.includes(text) ? text : 'all';
}

export function getLibraryVirtualTrialTone(status, active = false, failure = null, trial = null) {
  if (active || status === 'running') return 'trial';
  const label = getLibraryVirtualTrialResultLabel(status, active, trial);
  if (label === 'pass-windowed-rendered' || status === 'pass-windowed-rendered') return 'ok';
  if (label === 'pass-no-render' || status === 'pass-no-render') return 'warn';
  if (status === 'pass') return 'ok';
  if (status === 'fail' || failure) return 'bad';
  if (status === 'stopped') return 'warn';
  return 'off';
}

export function evaluateLibraryVirtualTrialPassCriteria(trial = null) {
  const windowedRenders = Number(trial?.windowedRenders) || 0;
  const fallbackCount = Number(trial?.fallbackCount) || 0;
  const exceptionCount = Number(trial?.exceptionCount) || 0;
  const totalRenders = Number(trial?.renders) || 0;
  const observedWindowedRender = windowedRenders > 0;
  const fallbackFree = fallbackCount === 0;
  const exceptionFree = exceptionCount === 0;
  const resultLabel = observedWindowedRender && fallbackFree && exceptionFree ? 'pass-windowed-rendered' : 'pass-no-render';
  return {
    minWindowedRenders: 1,
    observedWindowedRender,
    fallbackFree,
    exceptionFree,
    met: resultLabel === 'pass-windowed-rendered',
    resultLabel,
    reason: resultLabel === 'pass-windowed-rendered' ? 'duration-complete-windowed-rendered' : 'duration-complete-no-windowed-render',
    detail: resultLabel === 'pass-windowed-rendered'
      ? 'windowed render observed ' + windowedRenders + ' time(s) without fallback/exception'
      : 'trial ended without fallback/exception, but no windowed render was observed',
    metrics: {
      renders: totalRenders,
      windowedRenders,
      fallbackCount,
      exceptionCount
    },
    coverageRequirement: 'pass label checks render/fallback only; scenario coverage is evaluated separately and requires windowed-qualified observations'
  };
}

export function getLibraryVirtualTrialResultLabel(status, active = false, trial = null) {
  if (active || status === 'running') return 'running';
  if (status === 'pass-windowed-rendered' || status === 'pass-no-render') return status;
  if (status === 'pass') {
    const stored = String(trial?.resultCode || trial?.resultLabel || '').trim();
    if (stored === 'pass-windowed-rendered' || stored === 'pass-no-render') return stored;
    return evaluateLibraryVirtualTrialPassCriteria(trial).resultLabel;
  }
  if (status === 'fail') return 'fail';
  if (status === 'stopped') return 'stopped';
  return 'idle';
}

export function libraryVirtualTrialMatchesFilter(item = {}, filter = 'all') {
  const key = normalizeLibraryVirtualTrialHistoryFilter(filter);
  if (key === 'all') return true;
  const label = getLibraryVirtualTrialResultLabel(item?.status, item?.active, item);
  if (key === 'pass') return label === 'pass-windowed-rendered' || label === 'pass-no-render' || item?.status === 'pass';
  return label === key;
}

export function buildLibraryVirtualTrialHistoryCounts(history = []) {
  const counts = { all: 0, pass: 0, 'pass-windowed-rendered': 0, 'pass-no-render': 0, fail: 0, stopped: 0 };
  (Array.isArray(history) ? history : []).forEach(item => {
    const label = getLibraryVirtualTrialResultLabel(item?.status, item?.active, item);
    counts.all += 1;
    if (label === 'pass-windowed-rendered' || label === 'pass-no-render' || item?.status === 'pass') counts.pass += 1;
    if (label === 'pass-windowed-rendered') counts['pass-windowed-rendered'] += 1;
    else if (label === 'pass-no-render') counts['pass-no-render'] += 1;
    else if (label === 'fail') counts.fail += 1;
    else if (label === 'stopped') counts.stopped += 1;
  });
  return counts;
}

export function getLibraryVirtualTrialCoverage(trial = {}) {
  const observations = Array.isArray(trial?.observations) ? trial.observations : [];
  const counts = trial?.observationCounts || countLibraryVirtualTrialObservations(observations);
  void counts;
  const evidence = summarizeLibraryVirtualTrialCoverageEvidence(observations);
  const observedTargets = LIBRARY_VIRTUAL_TRIAL_COVERAGE_TARGETS.filter(key => !!evidence[key]?.observed);
  const windowedTargets = LIBRARY_VIRTUAL_TRIAL_COVERAGE_TARGETS.filter(key => !!evidence[key]?.qualified);
  const missingObservedTargets = LIBRARY_VIRTUAL_TRIAL_COVERAGE_TARGETS.filter(key => !evidence[key]?.observed);
  const missingWindowedTargets = LIBRARY_VIRTUAL_TRIAL_COVERAGE_TARGETS.filter(key => !evidence[key]?.qualified);
  const nonWindowedOnlyTargets = LIBRARY_VIRTUAL_TRIAL_COVERAGE_TARGETS.filter(key => evidence[key]?.observed && !evidence[key]?.qualified);
  const observedTargetMap = LIBRARY_VIRTUAL_TRIAL_COVERAGE_TARGETS.reduce((acc, key) => { acc[key] = !!evidence[key]?.observed; return acc; }, {});
  const windowedTargetMap = LIBRARY_VIRTUAL_TRIAL_COVERAGE_TARGETS.reduce((acc, key) => { acc[key] = !!evidence[key]?.qualified; return acc; }, {});
  const windowedRender = (Number(trial?.windowedRenders) || 0) > 0;
  const fallbackFree = (Number(trial?.fallbackCount) || 0) === 0;
  const exceptionFree = (Number(trial?.exceptionCount) || 0) === 0;
  const fullObservedScenarioCoverage = observedTargets.length === LIBRARY_VIRTUAL_TRIAL_COVERAGE_TARGETS.length;
  const fullWindowedScenarioCoverage = windowedTargets.length === LIBRARY_VIRTUAL_TRIAL_COVERAGE_TARGETS.length;
  const complete = fullWindowedScenarioCoverage && windowedRender && fallbackFree && exceptionFree;
  const strictScore = windowedTargets.length;
  const observedScore = observedTargets.length;
  return {
    targets: windowedTargetMap,
    observedTargets: observedTargetMap,
    targetEvidence: evidence,
    coveredScenarioTargets: windowedTargets,
    observedScenarioTargets: observedTargets,
    missingScenarioTargets: missingWindowedTargets,
    missingObservedScenarioTargets: missingObservedTargets,
    nonWindowedOnlyTargets,
    fullScenarioCoverage: fullWindowedScenarioCoverage,
    fullObservedScenarioCoverage,
    fullWindowedScenarioCoverage,
    windowedScenarioCoverage: fullWindowedScenarioCoverage,
    windowedRender,
    fallbackFree,
    exceptionFree,
    complete,
    score: strictScore,
    observedScore,
    targetCount: LIBRARY_VIRTUAL_TRIAL_COVERAGE_TARGETS.length,
    requirement: 'scenario observations count only when captured while the active renderer is windowed',
    label: complete
      ? 'complete-windowed-coverage'
      : fullObservedScenarioCoverage && !fullWindowedScenarioCoverage
        ? 'scenario-observed-not-windowed-qualified'
        : strictScore > 0
          ? 'partial-windowed-scenario-coverage'
          : observedScore > 0
            ? 'observed-only-non-windowed'
            : 'no-scenario-coverage'
  };
}

export function buildLibraryVirtualTrialConfidenceSummary(history = []) {
  const items = (Array.isArray(history) ? history : []).filter(Boolean);
  const newest = items.slice().reverse();
  const counts = buildLibraryVirtualTrialHistoryCounts(items);
  let consecutivePassWindowedRendered = 0;
  let consecutivePassAny = 0;
  for (const item of newest) {
    const label = getLibraryVirtualTrialResultLabel(item?.status, item?.active, item);
    if (label === 'pass-windowed-rendered') consecutivePassWindowedRendered += 1;
    else break;
  }
  for (const item of newest) {
    const label = getLibraryVirtualTrialResultLabel(item?.status, item?.active, item);
    if (label === 'pass-windowed-rendered' || label === 'pass-no-render' || item?.status === 'pass') consecutivePassAny += 1;
    else break;
  }
  const coverageCounts = {
    'force-rerender': 0,
    'scroll-observe': 0,
    'follow-active': 0,
    'top-anchor': 0,
    complete: 0,
    windowedRender: 0,
    fullObservedScenarioCoverage: 0,
    fullWindowedScenarioCoverage: 0
  };
  const observedCoverageCounts = {
    'force-rerender': 0,
    'scroll-observe': 0,
    'follow-active': 0,
    'top-anchor': 0,
    fullObservedScenarioCoverage: 0
  };
  const nonWindowedOnlyCounts = {
    'force-rerender': 0,
    'scroll-observe': 0,
    'follow-active': 0,
    'top-anchor': 0
  };
  let latestCompleteCoverageAt = 0;
  const historyWithCoverage = items.map(item => {
    const coverage = getLibraryVirtualTrialCoverage(item);
    LIBRARY_VIRTUAL_TRIAL_COVERAGE_TARGETS.forEach(key => {
      if (coverage.targets?.[key]) coverageCounts[key] += 1;
      if (coverage.observedTargets?.[key]) observedCoverageCounts[key] += 1;
      if (coverage.nonWindowedOnlyTargets?.includes?.(key)) nonWindowedOnlyCounts[key] += 1;
    });
    if (coverage.windowedRender) coverageCounts.windowedRender += 1;
    if (coverage.fullObservedScenarioCoverage) observedCoverageCounts.fullObservedScenarioCoverage += 1;
    if (coverage.fullObservedScenarioCoverage) coverageCounts.fullObservedScenarioCoverage += 1;
    if (coverage.fullWindowedScenarioCoverage) coverageCounts.fullWindowedScenarioCoverage += 1;
    if (coverage.complete) {
      coverageCounts.complete += 1;
      latestCompleteCoverageAt = Math.max(latestCompleteCoverageAt, Number(item.endedAt || item.startedAt) || 0);
    }
    return {
      id: item.id || '',
      resultLabel: getLibraryVirtualTrialResultLabel(item?.status, item?.active, item),
      status: item.status || '',
      endedAt: Number(item.endedAt || item.startedAt) || 0,
      coverage
    };
  });
  const latest = newest[0] || null;
  const latestLabel = latest ? getLibraryVirtualTrialResultLabel(latest?.status, latest?.active, latest) : 'idle';
  const hasRecentFail = newest.slice(0, 3).some(item => getLibraryVirtualTrialResultLabel(item?.status, item?.active, item) === 'fail');
  const passTargetMet = consecutivePassWindowedRendered >= LIBRARY_VIRTUAL_TRIAL_CONFIDENCE_PASS_TARGET;
  const coverageReady = coverageCounts.complete > 0;
  let level = 'no-history';
  let reason = 'safe trial history가 아직 없습니다.';
  let suggestedAction = 'Recovery Center에서 safe trial을 실행하고 force rerender/scroll/follow-active/top-anchor 관측을 기록하세요.';
  if (items.length) {
    if (hasRecentFail || counts.fail > 0) {
      level = 'blocked-by-failures';
      reason = '최근 또는 전체 history에 fail 결과가 있습니다.';
      suggestedAction = 'Fallback sample JSON과 실패 category를 먼저 확인하고 동일 조건에서 재시도하세요.';
    } else if (counts['pass-windowed-rendered'] <= 0) {
      level = 'pass-no-render-only';
      reason = 'pass는 있으나 windowed render가 관측된 통과가 없습니다.';
      suggestedAction = 'row 수가 충분한 상태에서 trial을 다시 시작하고 강제 rerender/스크롤 관측을 실행하세요.';
    } else if (!passTargetMet) {
      level = 'insufficient-repeated-pass';
      reason = 'windowed render 통과가 반복 기준에 미달합니다.';
      suggestedAction = String(LIBRARY_VIRTUAL_TRIAL_CONFIDENCE_PASS_TARGET) + '회 연속 pass-windowed-rendered를 확보한 뒤 coverage를 검토하세요.';
    } else if (!coverageReady) {
      level = 'needs-scenario-coverage';
      reason = '반복 pass는 있으나 windowed-qualified scenario coverage가 완전하지 않습니다.';
      suggestedAction = 'windowed renderer가 실제 활성 상태인 순간에 force rerender, scroll, follow-active, top-anchor 관측을 모두 기록한 trial을 1회 이상 확보하세요.';
    } else {
      level = 'manual-review-ready';
      reason = '반복 pass와 최소 scenario coverage가 충족되었습니다.';
      suggestedAction = '자동 enable은 금지하고, 다음 단계에서 제한적 opt-in UI/게이트 기준을 별도로 검토하세요.';
    }
  }
  return {
    available: true,
    level,
    reason,
    suggestedAction,
    autoEnableAllowed: false,
    passTarget: LIBRARY_VIRTUAL_TRIAL_CONFIDENCE_PASS_TARGET,
    passTargetMet,
    consecutivePassWindowedRendered,
    consecutivePassAny,
    latestLabel,
    latestAt: latest ? Number(latest.endedAt || latest.startedAt) || 0 : 0,
    counts,
    coverageCounts,
    observedCoverageCounts,
    nonWindowedOnlyCounts,
    coverageReady,
    coverageRequirement: 'Only observations captured while the actual renderer is windowed count toward complete coverage.',
    latestCompleteCoverageAt,
    historyWithCoverage,
    note: 'manual review only; this summary never turns prefs.libraryVirtualRenderer on automatically'
  };
}

export function summarizeLibraryVirtualTrial(trial = null) {
  if (!trial) return null;
  const now = Date.now();
  const startedAt = Number(trial.startedAt) || 0;
  const endedAt = Number(trial.endedAt) || 0;
  const deadlineAt = Number(trial.deadlineAt) || 0;
  const active = !!trial.active;
  const status = trial.status || (active ? 'running' : 'idle');
  const failure = trial.failure || null;
  const resultLabel = getLibraryVirtualTrialResultLabel(status, active, trial);
  const passCriteria = trial.passCriteria || (status === 'pass' || resultLabel === 'pass-windowed-rendered' || resultLabel === 'pass-no-render' ? evaluateLibraryVirtualTrialPassCriteria(trial) : null);
  return {
    id: trial.id || '',
    active,
    status,
    resultLabel,
    resultCode: trial.resultCode || resultLabel,
    resultTone: getLibraryVirtualTrialTone(status, active, failure, { ...trial, resultLabel }),
    passCriteria,
    scenario: trial.scenario || null,
    observations: Array.isArray(trial.observations) ? trial.observations.slice(-LIBRARY_VIRTUAL_TRIAL_OBSERVATION_LIMIT) : [],
    observationCounts: countLibraryVirtualTrialObservations(trial.observations || []),
    lastObservation: trial.lastObservation || null,
    source: trial.source || '',
    durationMs: Number(trial.durationMs) || 0,
    startedAt,
    deadlineAt,
    endedAt,
    elapsedMs: Math.max(0, (endedAt || now) - startedAt),
    remainingMs: active && deadlineAt ? Math.max(0, deadlineAt - now) : 0,
    renders: Number(trial.renders) || 0,
    windowedRenders: Number(trial.windowedRenders) || 0,
    fullRenders: Number(trial.fullRenders) || 0,
    fallbackCount: Number(trial.fallbackCount) || 0,
    exceptionCount: Number(trial.exceptionCount) || 0,
    firstRenderAt: Number(trial.firstRenderAt) || 0,
    lastRenderAt: Number(trial.lastRenderAt) || 0,
    lastRender: trial.lastRender || null,
    failure,
    reason: trial.reason || '',
    coverage: getLibraryVirtualTrialCoverage(trial)
  };
}

export function getLibraryVirtualTrialDiagnostics(app) {
  const current = summarizeLibraryVirtualTrial(app.state.libraryVirtualTrial || null);
  const result = summarizeLibraryVirtualTrial(app.state.libraryVirtualTrialResult || null);
  const history = Array.isArray(app.state.libraryVirtualTrialHistory)
    ? app.state.libraryVirtualTrialHistory.slice(-LIBRARY_VIRTUAL_TRIAL_HISTORY_LIMIT).map(item => summarizeLibraryVirtualTrial(item)).filter(Boolean)
    : [];
  const historyFilter = normalizeLibraryVirtualTrialHistoryFilter(app.state.libraryVirtualTrialHistoryFilter);
  const filteredHistory = history.filter(item => libraryVirtualTrialMatchesFilter(item, historyFilter));
  const confidenceSummary = buildLibraryVirtualTrialConfidenceSummary(history);
  const badgeItem = current?.active ? current : result;
  return {
    available: true,
    active: !!current?.active,
    status: current?.status || result?.status || 'idle',
    current,
    lastResult: result,
    lastBadge: badgeItem ? {
      label: badgeItem.resultLabel || getLibraryVirtualTrialResultLabel(badgeItem.status, badgeItem.active, badgeItem),
      tone: badgeItem.resultTone || getLibraryVirtualTrialTone(badgeItem.status, badgeItem.active, badgeItem.failure, badgeItem),
      at: badgeItem.endedAt || badgeItem.startedAt || 0,
      reason: badgeItem.failure?.reason || badgeItem.reason || '',
      failure: badgeItem.failure || null
    } : { label:'idle', tone:'off', at:0, reason:'', failure:null },
    history,
    historyFilter,
    historyFilters: LIBRARY_VIRTUAL_TRIAL_HISTORY_FILTERS.slice(),
    durationPresets: getLibraryVirtualTrialDurationPresets(),
    observationLimit: LIBRARY_VIRTUAL_TRIAL_OBSERVATION_LIMIT,
    historyCounts: buildLibraryVirtualTrialHistoryCounts(history),
    confidenceSummary,
    filteredHistory,
    defaultDurationMs: LIBRARY_VIRTUAL_TRIAL_DEFAULT_MS,
    minDurationMs: LIBRARY_VIRTUAL_TRIAL_MIN_MS,
    maxDurationMs: LIBRARY_VIRTUAL_TRIAL_MAX_MS,
    persistentFlagEnabled: !!app?.state?.prefs?.libraryVirtualRenderer,
    note: 'runtime-only safe trial; prefs.libraryVirtualRenderer is not persisted by trial start/stop'
  };
}


export function getLibraryVirtualLatestTrialResult(app) {
  const direct = app?.state?.libraryVirtualTrialResult || null;
  const history = Array.isArray(app?.state?.libraryVirtualTrialHistory) ? app.state.libraryVirtualTrialHistory : [];
  const current = app?.state?.libraryVirtualTrial || null;
  const candidates = [current, direct, ...history.slice().reverse()].filter(Boolean);
  return candidates.find(item => !item.active && item.status) || candidates[0] || null;
}

export function summarizeLibraryVirtualTrialForSession(app) {
  const trial = getLibraryVirtualLatestTrialResult(app);
  if (!trial) {
    return {
      available: false,
      status: 'not-run',
      resultLabel: '',
      passedWindowed: false,
      windowedRenders: 0,
      fallbackCount: 0,
      exceptionCount: 0,
      endedAt: 0,
      note: 'safe trial result is not available in this runtime session'
    };
  }
  const resultLabel = trial.resultLabel || trial.resultCode || trial.passCriteria?.resultLabel || trial.status || '';
  const windowedRenders = Number(trial.windowedRenders) || Number(trial.passCriteria?.metrics?.windowedRenders) || 0;
  const fallbackCount = Number(trial.fallbackCount) || 0;
  const exceptionCount = Number(trial.exceptionCount) || 0;
  const passedWindowed = (trial.status === 'pass' || /^pass/.test(String(resultLabel))) && windowedRenders > 0 && fallbackCount === 0 && exceptionCount === 0;
  return {
    available: true,
    status: trial.status || 'unknown',
    resultLabel,
    passedWindowed,
    windowedRenders,
    fallbackCount,
    exceptionCount,
    endedAt: Number(trial.endedAt || trial.generatedAt || trial.deadlineAt) || 0,
    elapsedMs: Number(trial.elapsedMs) || 0,
    reason: trial.reason || '',
    confidenceLevel: trial.confidenceSummary?.level || '',
    note: passedWindowed
      ? 'safe trial passed with at least one windowed render and no fallback/exception'
      : 'safe trial is not yet a full windowed pass for live stabilization gating'
  };
}

