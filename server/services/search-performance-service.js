const fs = require('fs');
const os = require('os');

const SEARCH_PERFORMANCE_SERVICE_PASS = 'v649-search-profile-snapshot-pass';
const PROFILE_NAMES = new Set(['auto', 'safe', 'balanced', 'fast', 'aggressive', 'n100_2core']);

function parseBooleanFlag(value, fallback = false) {
  const raw = String(value == null ? '' : value).trim().toLowerCase();
  if (!raw) return !!fallback;
  if (raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes') return true;
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'no') return false;
  return !!fallback;
}

function parsePositiveInteger(value, fallback = 0) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function readFirstExisting(paths) {
  for (const filePath of paths) {
    try {
      if (fs.existsSync(filePath)) return String(fs.readFileSync(filePath, 'utf8') || '').trim();
    } catch {}
  }
  return '';
}

function parseCpuList(value) {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  let count = 0;
  for (const part of raw.split(',')) {
    const token = part.trim();
    if (!token) continue;
    const range = token.split('-').map(v => Number(v));
    if (range.length === 2 && Number.isInteger(range[0]) && Number.isInteger(range[1]) && range[1] >= range[0]) {
      count += range[1] - range[0] + 1;
    } else if (Number.isInteger(range[0])) {
      count += 1;
    }
  }
  return count;
}

function detectCpuQuotaCores() {
  const cpuMax = readFirstExisting(['/sys/fs/cgroup/cpu.max']);
  if (cpuMax) {
    const [quotaRaw, periodRaw] = cpuMax.split(/\s+/);
    const quota = Number(quotaRaw);
    const period = Number(periodRaw);
    if (Number.isFinite(quota) && quota > 0 && Number.isFinite(period) && period > 0) return Math.max(1, Math.floor(quota / period));
  }

  const quota = Number(readFirstExisting(['/sys/fs/cgroup/cpu/cpu.cfs_quota_us']));
  const period = Number(readFirstExisting(['/sys/fs/cgroup/cpu/cpu.cfs_period_us']));
  if (Number.isFinite(quota) && quota > 0 && Number.isFinite(period) && period > 0) return Math.max(1, Math.floor(quota / period));
  return 0;
}

function detectCpusetCores() {
  const cpuset = readFirstExisting([
    '/sys/fs/cgroup/cpuset.cpus.effective',
    '/sys/fs/cgroup/cpuset/cpuset.cpus.effective',
    '/sys/fs/cgroup/cpuset.cpus',
    '/sys/fs/cgroup/cpuset/cpuset.cpus'
  ]);
  return parseCpuList(cpuset);
}

function detectAvailableParallelism() {
  const candidates = [];
  try {
    if (typeof os.availableParallelism === 'function') candidates.push(os.availableParallelism());
  } catch {}
  try {
    if (Array.isArray(os.cpus())) candidates.push(os.cpus().length);
  } catch {}
  candidates.push(detectCpuQuotaCores());
  candidates.push(detectCpusetCores());
  const positive = candidates.map(value => Math.floor(Number(value) || 0)).filter(value => value > 0);
  return positive.length ? Math.max(1, Math.min(...positive)) : 1;
}

function detectMemoryMb() {
  const candidates = [];
  const cgroup = readFirstExisting(['/sys/fs/cgroup/memory.max', '/sys/fs/cgroup/memory/memory.limit_in_bytes']);
  const cgroupBytes = Number(cgroup);
  if (Number.isFinite(cgroupBytes) && cgroupBytes > 0 && cgroupBytes < 9e18) candidates.push(cgroupBytes);
  try { candidates.push(os.totalmem()); } catch {}
  const positive = candidates.filter(value => Number.isFinite(value) && value > 0);
  return positive.length ? Math.round(Math.min(...positive) / 1024 / 1024) : 0;
}

function normalizeProfile(value) {
  const raw = String(value || 'auto').trim().toLowerCase();
  return PROFILE_NAMES.has(raw) ? raw : 'auto';
}

function normalizeStorageProfile(value) {
  const raw = String(value || 'auto').trim().toLowerCase();
  if (raw === 'local' || raw === 'network' || raw === 'slow' || raw === 'auto') return raw;
  return 'auto';
}

function classifyAutoProfile({ cores, memoryMb, storageProfile }) {
  if (storageProfile === 'network' || storageProfile === 'slow') return cores <= 2 ? 'safe' : 'balanced';
  if (cores <= 2) return 'n100_2core';
  if (cores >= 8 && (memoryMb === 0 || memoryMb >= 4096)) return 'aggressive';
  if (cores >= 4 && (memoryMb === 0 || memoryMb >= 2048)) return 'fast';
  return 'balanced';
}

function profileSettings(profile) {
  if (profile === 'safe') return {
    limits: { full:{ min:1, max:2, step:1 }, live:{ min:1, max:2, step:1 }, multi:{ min:1, max:1, step:1 }, workerBatch:{ min:2, max:4, step:1 } },
    initial: { full:1, live:1, multi:1, workerBatch:2 },
    cacheOnlyConcurrency: 2
  };
  if (profile === 'n100_2core') return {
    limits: { full:{ min:1, max:3, step:1 }, live:{ min:1, max:3, step:1 }, multi:{ min:1, max:2, step:1 }, workerBatch:{ min:2, max:5, step:1 } },
    initial: { full:2, live:2, multi:1, workerBatch:4 },
    cacheOnlyConcurrency: 3
  };
  if (profile === 'fast') return {
    limits: { full:{ min:1, max:4, step:1 }, live:{ min:1, max:4, step:1 }, multi:{ min:1, max:3, step:1 }, workerBatch:{ min:2, max:6, step:1 } },
    initial: { full:3, live:3, multi:2, workerBatch:5 },
    cacheOnlyConcurrency: 5
  };
  if (profile === 'aggressive') return {
    limits: { full:{ min:1, max:6, step:1 }, live:{ min:1, max:6, step:1 }, multi:{ min:1, max:4, step:1 }, workerBatch:{ min:2, max:8, step:1 } },
    initial: { full:4, live:4, multi:3, workerBatch:6 },
    cacheOnlyConcurrency: 6
  };
  return {
    limits: { full:{ min:1, max:3, step:1 }, live:{ min:1, max:3, step:1 }, multi:{ min:1, max:2, step:1 }, workerBatch:{ min:2, max:5, step:1 } },
    initial: { full:2, live:2, multi:1, workerBatch:4 },
    cacheOnlyConcurrency: 4
  };
}

function applyOverride(settings, env, key, envName) {
  const target = settings.limits[key];
  if (!target) return;
  const override = parsePositiveInteger(env[envName], 0);
  if (!override) return;
  target.max = clampInt(override, target.min, 16, target.max);
  settings.initial[key] = clampInt(settings.initial[key], target.min, target.max, target.min);
}

function buildSearchPerformanceProfile(env = process.env) {
  const overrideCores = parsePositiveInteger(env.SEARCH_SERVER_CORES, 0);
  const cores = overrideCores || detectAvailableParallelism();
  const memoryMb = detectMemoryMb();
  const storageProfile = normalizeStorageProfile(env.SEARCH_STORAGE_PROFILE);
  const requestedProfile = normalizeProfile(env.SEARCH_PERFORMANCE_PROFILE);
  const resolvedProfile = requestedProfile === 'auto' ? classifyAutoProfile({ cores, memoryMb, storageProfile }) : requestedProfile;
  const settings = profileSettings(resolvedProfile);

  applyOverride(settings, env, 'full', 'SEARCH_FULL_CONCURRENCY_MAX');
  applyOverride(settings, env, 'live', 'SEARCH_LIVE_CONCURRENCY_MAX');
  applyOverride(settings, env, 'multi', 'SEARCH_MULTI_EPISODE_CONCURRENCY_MAX');
  applyOverride(settings, env, 'workerBatch', 'SEARCH_WORKER_BATCH_MAX');
  const cacheOverride = parsePositiveInteger(env.SEARCH_CACHE_ONLY_CONCURRENCY, 0);
  if (cacheOverride) settings.cacheOnlyConcurrency = clampInt(cacheOverride, 1, 16, settings.cacheOnlyConcurrency);

  return {
    ok: true,
    pass: SEARCH_PERFORMANCE_SERVICE_PASS,
    profile: resolvedProfile,
    requestedProfile,
    source: requestedProfile === 'auto' ? 'auto' : 'env',
    server: {
      cores,
      memoryMb,
      storageProfile,
      workerThreadsEnabled: parseBooleanFlag(env.CONTENT_WORKER_THREADS_ENABLED, true),
      configuredWorkerPoolSize: parsePositiveInteger(env.CONTENT_WORKER_POOL_SIZE, 0),
      explicitServerCores: overrideCores || 0
    },
    limits: settings.limits,
    initial: settings.initial,
    cacheOnlyConcurrency: settings.cacheOnlyConcurrency,
    envOverrideKeys: [
      'SEARCH_PERFORMANCE_PROFILE',
      'SEARCH_STORAGE_PROFILE',
      'SEARCH_SERVER_CORES',
      'SEARCH_FULL_CONCURRENCY_MAX',
      'SEARCH_LIVE_CONCURRENCY_MAX',
      'SEARCH_MULTI_EPISODE_CONCURRENCY_MAX',
      'SEARCH_CACHE_ONLY_CONCURRENCY',
      'SEARCH_WORKER_BATCH_MAX'
    ]
  };
}

function createSearchPerformanceService(options = {}) {
  const env = options.env || process.env;
  let profile = buildSearchPerformanceProfile(env);
  let generatedAt = Date.now();
  function snapshot() {
    return JSON.parse(JSON.stringify({ ...profile, generatedAt, snapshotPass:SEARCH_PERFORMANCE_SERVICE_PASS }));
  }
  return {
    getProfile() {
      return snapshot();
    },
    refreshProfile() {
      profile = buildSearchPerformanceProfile(env);
      generatedAt = Date.now();
      return snapshot();
    }
  };
}

module.exports = {
  SEARCH_PERFORMANCE_SERVICE_PASS,
  buildSearchPerformanceProfile,
  createSearchPerformanceService
};
