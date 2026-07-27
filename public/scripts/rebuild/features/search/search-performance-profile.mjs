export const SEARCH_ADAPTIVE_PROFILE_PASS = 'v509-search-adaptive-profile-pass';
export const SEARCH_ADAPTIVE_FEEDBACK_PASS = 'v509-search-adaptive-feedback-pass';
export const SEARCH_ADAPTIVE_INPUT_PRESSURE_PASS = 'v509-search-adaptive-input-pressure-pass';
export const SEARCH_SERVER_LOAD_MITIGATION_PASS = 'v549-search-auto-server-profile-pass';
export const SEARCH_SERVER_PROFILE_CLIENT_PASS = 'v549-search-server-profile-client-pass';

const DEFAULT_LIMITS = Object.freeze({
  full: { min: 1, max: 3, step: 1 },
  live: { min: 1, max: 3, step: 1 },
  multi: { min: 1, max: 2, step: 1 },
  workerBatch: { min: 2, max: 5, step: 1 }
});
const DEFAULT_CACHE_ONLY_CONCURRENCY = 4;
const INPUT_PRESSURE_HOLD_MS = 1400;
const SERVER_PROFILE_TTL_MS = 5 * 60 * 1000;

function nowMs() {
  try { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }
  catch { return Date.now(); }
}

function wallNow() {
  try { return Date.now(); }
  catch { return Math.round(nowMs()); }
}

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function cloneLimits(limits = DEFAULT_LIMITS) {
  return {
    full: normalizeLimit(limits.full, DEFAULT_LIMITS.full),
    live: normalizeLimit(limits.live, DEFAULT_LIMITS.live),
    multi: normalizeLimit(limits.multi, DEFAULT_LIMITS.multi),
    workerBatch: normalizeLimit(limits.workerBatch, DEFAULT_LIMITS.workerBatch)
  };
}

function normalizeLimit(value = {}, fallback = { min:1, max:1, step:1 }) {
  const min = clampInt(value.min, 1, 16, fallback.min || 1);
  const max = clampInt(value.max, min, 16, fallback.max || min);
  const step = clampInt(value.step, 1, 4, fallback.step || 1);
  return { min, max, step };
}

function normalizeServerProfile(payload) {
  if (!payload || typeof payload !== 'object' || payload.ok === false) return null;
  const limits = cloneLimits(payload.limits || DEFAULT_LIMITS);
  const initial = payload.initial && typeof payload.initial === 'object' ? payload.initial : {};
  return {
    pass: payload.pass || SEARCH_SERVER_LOAD_MITIGATION_PASS,
    clientPass: SEARCH_SERVER_PROFILE_CLIENT_PASS,
    profile: String(payload.profile || 'balanced'),
    requestedProfile: String(payload.requestedProfile || 'auto'),
    source: String(payload.source || 'auto'),
    server: payload.server && typeof payload.server === 'object' ? { ...payload.server } : {},
    limits,
    initial: {
      full: clampInt(initial.full, limits.full.min, limits.full.max, limits.full.min),
      live: clampInt(initial.live, limits.live.min, limits.live.max, limits.live.min),
      multi: clampInt(initial.multi, limits.multi.min, limits.multi.max, limits.multi.min),
      workerBatch: clampInt(initial.workerBatch, limits.workerBatch.min, limits.workerBatch.max, limits.workerBatch.min)
    },
    cacheOnlyConcurrency: clampInt(payload.cacheOnlyConcurrency, 1, 16, DEFAULT_CACHE_ONLY_CONCURRENCY),
    loadedAt: wallNow()
  };
}

function detectClientTier() {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const cores = Math.max(1, Math.round(Number(nav?.hardwareConcurrency) || 4));
  const memory = Math.max(0, Number(nav?.deviceMemory) || 0);
  const connection = nav?.connection || nav?.mozConnection || nav?.webkitConnection || null;
  const effectiveType = String(connection?.effectiveType || 'unknown');
  const saveData = !!connection?.saveData;
  let tier = 'mid';
  if (saveData || cores <= 2 || (memory > 0 && memory <= 2) || effectiveType === '2g' || effectiveType === 'slow-2g') tier = 'low';
  else if (cores >= 8 && (memory === 0 || memory >= 6) && effectiveType !== '3g') tier = 'high';
  return { cores, memory, effectiveType, saveData, tier };
}

function initialValuesForTier(tier = 'mid', limits = DEFAULT_LIMITS, serverInitial = null) {
  let base = { full: 2, live: 2, multi: 1, workerBatch: 4 };
  if (tier === 'high') base = { full: 3, live: 3, multi: 2, workerBatch: 5 };
  else if (tier === 'low') base = { full: 1, live: 1, multi: 1, workerBatch: 2 };
  if (serverInitial && typeof serverInitial === 'object') {
    base = {
      full: Math.min(base.full, Number(serverInitial.full) || base.full),
      live: Math.min(base.live, Number(serverInitial.live) || base.live),
      multi: Math.min(base.multi, Number(serverInitial.multi) || base.multi),
      workerBatch: Math.min(base.workerBatch, Number(serverInitial.workerBatch) || base.workerBatch)
    };
  }
  return {
    full: clampInt(base.full, limits.full.min, limits.full.max, limits.full.min),
    live: clampInt(base.live, limits.live.min, limits.live.max, limits.live.min),
    multi: clampInt(base.multi, limits.multi.min, limits.multi.max, limits.multi.min),
    workerBatch: clampInt(base.workerBatch, limits.workerBatch.min, limits.workerBatch.max, limits.workerBatch.min)
  };
}

function createProfile(serverProfile = null) {
  const normalizedServer = normalizeServerProfile(serverProfile);
  const limits = cloneLimits(normalizedServer?.limits || DEFAULT_LIMITS);
  const client = detectClientTier();
  const current = initialValuesForTier(client.tier, limits, normalizedServer?.initial || null);
  return {
    pass: SEARCH_ADAPTIVE_PROFILE_PASS,
    feedbackPass: SEARCH_ADAPTIVE_FEEDBACK_PASS,
    inputPressurePass: SEARCH_ADAPTIVE_INPUT_PRESSURE_PASS,
    serverProfilePass: normalizedServer?.pass || '',
    serverProfileClientPass: normalizedServer ? SEARCH_SERVER_PROFILE_CLIENT_PASS : '',
    client,
    serverProfile: normalizedServer,
    limits,
    cacheOnlyConcurrency: normalizedServer?.cacheOnlyConcurrency || DEFAULT_CACHE_ONLY_CONCURRENCY,
    serverLoadMitigationPass: SEARCH_SERVER_LOAD_MITIGATION_PASS,
    current,
    stableBatches: 0,
    slowBatches: 0,
    feedbackEvents: 0,
    inputPressureEvents: 0,
    pressureUntil: 0,
    lastFeedback: null,
    lastAdjustment: null,
    startedAt: wallNow()
  };
}

function applyServerProfile(profile, serverProfile = null) {
  const normalized = normalizeServerProfile(serverProfile);
  if (!profile || !normalized) return profile;
  profile.serverProfile = normalized;
  profile.serverProfilePass = normalized.pass;
  profile.serverProfileClientPass = SEARCH_SERVER_PROFILE_CLIENT_PASS;
  profile.limits = cloneLimits(normalized.limits || DEFAULT_LIMITS);
  profile.cacheOnlyConcurrency = normalized.cacheOnlyConcurrency || DEFAULT_CACHE_ONLY_CONCURRENCY;
  const preferred = initialValuesForTier(profile.client?.tier || 'mid', profile.limits, normalized.initial || null);
  for (const key of ['full', 'live', 'multi', 'workerBatch']) {
    const limit = profile.limits[key];
    const current = clampInt(profile.current?.[key], limit.min, limit.max, preferred[key]);
    profile.current[key] = Math.min(Math.max(current, limit.min), Math.max(limit.min, preferred[key], current));
    profile.current[key] = clampInt(profile.current[key], limit.min, limit.max, preferred[key]);
  }
  profile.lastAdjustment = { pass: SEARCH_SERVER_PROFILE_CLIENT_PASS, direction: 'server-profile', reason: normalized.profile, at: wallNow(), current: { ...profile.current } };
  return profile;
}

function ensureProfile(app) {
  const search = app?.state?.search;
  if (!search) return createProfile();
  if (!search.adaptiveProfile || search.adaptiveProfile.pass !== SEARCH_ADAPTIVE_PROFILE_PASS) {
    search.adaptiveProfile = createProfile(search.searchServerProfile || null);
  } else if (search.searchServerProfile && search.adaptiveProfile.serverProfile?.loadedAt !== search.searchServerProfile.loadedAt) {
    applyServerProfile(search.adaptiveProfile, search.searchServerProfile);
  }
  ensureInputPressureListeners(app);
  return search.adaptiveProfile;
}

export function startSearchAdaptiveProfile(app) {
  const profile = createProfile(app?.state?.search?.searchServerProfile || null);
  if (app?.state?.search) app.state.search.adaptiveProfile = profile;
  ensureInputPressureListeners(app);
  return profile;
}

export function getSearchAdaptiveProfile(app) {
  return ensureProfile(app);
}

export async function loadSearchServerPerformanceProfile(app, options = {}) {
  const search = app?.state?.search;
  const force = options.force === true;
  if (!search || !app?.api || typeof app.api.searchPerformanceProfile !== 'function') return null;
  const now = wallNow();
  if (!force && search.searchServerProfile && now - Number(search.searchServerProfile.loadedAt || 0) < SERVER_PROFILE_TTL_MS) return search.searchServerProfile;
  if (search.searchServerProfilePromise && !force) return search.searchServerProfilePromise;
  search.searchServerProfilePromise = app.api.searchPerformanceProfile({ noRedirect: true })
    .then(payload => {
      const profile = normalizeServerProfile(payload);
      if (profile) {
        search.searchServerProfile = profile;
        applyServerProfile(ensureProfile(app), profile);
      }
      return profile;
    })
    .catch(error => {
      search.searchServerProfileError = error?.message || String(error || 'search performance profile failed');
      return null;
    })
    .finally(() => {
      if (search.searchServerProfilePromise) search.searchServerProfilePromise = null;
    });
  return search.searchServerProfilePromise;
}

function adjustValue(profile, key, direction) {
  const limit = profile?.limits?.[key] || DEFAULT_LIMITS[key];
  if (!limit) return false;
  const prev = clampInt(profile.current[key], limit.min, limit.max, limit.min);
  const next = clampInt(prev + (direction * limit.step), limit.min, limit.max, prev);
  profile.current[key] = next;
  return next !== prev;
}

function reduceProfile(profile, reason = 'slow') {
  const changed = [
    adjustValue(profile, 'workerBatch', -1),
    adjustValue(profile, 'full', -1),
    adjustValue(profile, 'live', -1),
    adjustValue(profile, 'multi', -1)
  ].some(Boolean);
  if (changed) profile.lastAdjustment = { pass: SEARCH_ADAPTIVE_FEEDBACK_PASS, direction: 'down', reason, at: wallNow(), current: { ...profile.current } };
  profile.stableBatches = 0;
  profile.slowBatches += 1;
}

function increaseProfile(profile, reason = 'stable') {
  const changed = [
    adjustValue(profile, 'full', 1),
    adjustValue(profile, 'workerBatch', 1),
    adjustValue(profile, 'live', 1),
    adjustValue(profile, 'multi', 1)
  ].some(Boolean);
  if (changed) profile.lastAdjustment = { pass: SEARCH_ADAPTIVE_FEEDBACK_PASS, direction: 'up', reason, at: wallNow(), current: { ...profile.current } };
  profile.stableBatches = 0;
}

function hasInputPressure(profile) {
  return Number(profile?.pressureUntil) > wallNow();
}

function markPressure(app, reason = 'input') {
  const search = app?.state?.search;
  if (!search?.running) return;
  const profile = ensureProfile(app);
  profile.pressureUntil = Math.max(Number(profile.pressureUntil) || 0, wallNow() + INPUT_PRESSURE_HOLD_MS);
  profile.inputPressureEvents += 1;
  reduceProfile(profile, reason);
}

export function recordSearchAdaptiveInputPressure(app, reason = 'input') {
  markPressure(app, reason);
  return app?.state?.search?.adaptiveProfile || null;
}

export function recordSearchAdaptiveFeedback(app, feedback = {}) {
  const profile = ensureProfile(app);
  const elapsedMs = Math.max(0, Number(feedback.elapsedMs) || 0);
  const count = Math.max(1, Number(feedback.count) || 1);
  const kind = String(feedback.kind || 'batch');
  const perItemMs = elapsedMs / count;
  const pressure = hasInputPressure(profile) || isInputPending();
  profile.feedbackEvents += 1;
  profile.lastFeedback = { pass: SEARCH_ADAPTIVE_FEEDBACK_PASS, kind, elapsedMs: Math.round(elapsedMs), count, perItemMs: Math.round(perItemMs * 10) / 10, pressure, at: wallNow() };

  const slow = pressure || elapsedMs >= 900 || perItemMs >= 180 || (kind === 'worker' && elapsedMs >= 650);
  const fast = !pressure && elapsedMs <= 220 && perItemMs <= 45;
  if (slow) {
    reduceProfile(profile, pressure ? 'input-pressure' : `${kind}-slow`);
  } else if (fast) {
    profile.stableBatches += 1;
    if (profile.stableBatches >= 4) increaseProfile(profile, `${kind}-stable`);
  } else {
    profile.stableBatches = Math.max(0, profile.stableBatches - 1);
  }
  return profile;
}

function isInputPending() {
  try {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    return !!(nav?.scheduling?.isInputPending?.({ includeContinuous: true }));
  } catch { return false; }
}

function ensureInputPressureListeners(app) {
  const search = app?.state?.search;
  if (!search || search.adaptiveInputListenersInstalled) return;
  if (typeof window === 'undefined' || !window.addEventListener) return;
  const events = ['wheel', 'touchstart', 'pointerdown', 'keydown', 'scroll'];
  const handler = event => {
    const type = String(event?.type || 'input');
    markPressure(app, `user-${type}`);
  };
  events.forEach(type => window.addEventListener(type, handler, { passive: true, capture: true }));
  search.adaptiveInputListenersInstalled = true;
  search.adaptiveInputCleanup = () => {
    events.forEach(type => window.removeEventListener(type, handler, { passive: true, capture: true }));
    search.adaptiveInputListenersInstalled = false;
    search.adaptiveInputCleanup = null;
  };
}

export function resolveAdaptiveSearchConcurrency(app, { useLiveMemory = false, noNetwork = false, multiEpisode = false } = {}) {
  const profile = ensureProfile(app);
  if (noNetwork) return clampInt(profile.cacheOnlyConcurrency, 1, 16, DEFAULT_CACHE_ONLY_CONCURRENCY);
  if (multiEpisode) return clampInt(profile.current.multi, profile.limits.multi.min, profile.limits.multi.max, 1);
  if (useLiveMemory) return clampInt(profile.current.live, profile.limits.live.min, profile.limits.live.max, 1);
  return clampInt(profile.current.full, profile.limits.full.min, profile.limits.full.max, 1);
}

export function resolveAdaptiveSearchWorkerBatchSize(app) {
  const profile = ensureProfile(app);
  return clampInt(profile.current.workerBatch, profile.limits.workerBatch.min, profile.limits.workerBatch.max, 4);
}

export function applySearchAdaptiveStats(stats = {}, profile = null) {
  if (!stats || !profile) return stats;
  stats.adaptiveSearchProfilePass = profile.pass;
  stats.adaptiveSearchFeedbackPass = profile.feedbackPass;
  stats.adaptiveSearchInputPressurePass = profile.inputPressurePass;
  stats.searchServerLoadMitigationPass = SEARCH_SERVER_LOAD_MITIGATION_PASS;
  stats.searchServerProfileClientPass = profile.serverProfileClientPass || '';
  stats.searchServerProfilePass = profile.serverProfilePass || '';
  stats.searchServerProfile = profile.serverProfile?.profile || '';
  stats.searchServerProfileSource = profile.serverProfile?.source || '';
  stats.searchServerCores = Number(profile.serverProfile?.server?.cores) || 0;
  stats.searchServerMemoryMb = Number(profile.serverProfile?.server?.memoryMb) || 0;
  stats.searchServerStorageProfile = profile.serverProfile?.server?.storageProfile || '';
  stats.adaptiveSearchClientTier = profile.client?.tier || 'unknown';
  stats.adaptiveSearchHardwareConcurrency = profile.client?.cores || 0;
  stats.adaptiveSearchDeviceMemory = profile.client?.memory || 0;
  stats.adaptiveSearchPressureEvents = Number(profile.inputPressureEvents) || 0;
  stats.adaptiveSearchFeedbackEvents = Number(profile.feedbackEvents) || 0;
  stats.adaptiveSearchLastFeedback = profile.lastFeedback || null;
  stats.adaptiveSearchLastAdjustment = profile.lastAdjustment || null;
  stats.fullScanConcurrency = Number(profile.current?.full) || stats.fullScanConcurrency || 1;
  stats.liveFullScanConcurrency = Number(profile.current?.live) || stats.liveFullScanConcurrency || 1;
  stats.multiEpisodeTargetConcurrency = Number(profile.current?.multi) || stats.multiEpisodeTargetConcurrency || 1;
  stats.workerBatchSize = Number(profile.current?.workerBatch) || stats.workerBatchSize || 4;
  stats.searchCacheOnlyConcurrency = Number(profile.cacheOnlyConcurrency) || DEFAULT_CACHE_ONLY_CONCURRENCY;
  return stats;
}

export function getSearchAdaptiveProfileSnapshot(app) {
  const profile = ensureProfile(app);
  return {
    pass: profile.pass,
    serverLoadMitigationPass: profile.serverLoadMitigationPass || SEARCH_SERVER_LOAD_MITIGATION_PASS,
    serverProfileClientPass: profile.serverProfileClientPass || '',
    serverProfile: profile.serverProfile ? { ...profile.serverProfile } : null,
    feedbackPass: profile.feedbackPass,
    inputPressurePass: profile.inputPressurePass,
    client: { ...profile.client },
    current: { ...profile.current },
    limits: profile.limits,
    cacheOnlyConcurrency: profile.cacheOnlyConcurrency,
    feedbackEvents: Number(profile.feedbackEvents) || 0,
    inputPressureEvents: Number(profile.inputPressureEvents) || 0,
    lastFeedback: profile.lastFeedback || null,
    lastAdjustment: profile.lastAdjustment || null
  };
}

export function searchAdaptiveNow() {
  return nowMs();
}
