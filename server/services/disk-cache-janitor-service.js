const fs = require('fs');
const path = require('path');

const DISK_CACHE_AUTO_PRUNE_PASS = 'v538-disk-cache-auto-prune-pass';
const DISK_CACHE_PROTECTED_DATA_PASS = 'v538-disk-cache-protected-data-pass';
const DISK_CACHE_HEALTHY_SCAN_SKIP_PASS = 'v565-disk-cache-healthy-scan-skip-pass';
const DISK_CACHE_IN_USE_PROTECTION_PASS = 'v570-disk-cache-in-use-protection-pass';
const DISK_CACHE_BOUNDED_CANDIDATE_PASS = 'v673-disk-cache-bounded-candidate-pass';
const MB = 1024 * 1024;

function toPositiveNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function toNonNegativeNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function safeResolve(value) {
  return path.resolve(String(value || ''));
}

function isInside(parent, child) {
  const root = safeResolve(parent);
  const target = safeResolve(child);
  return target === root || target.startsWith(root + path.sep);
}

function comparePruneCandidates(a, b) {
  if (!!a.tmp !== !!b.tmp) return a.tmp ? -1 : 1;
  const timeDelta = (Number(a.mtimeMs) || 0) - (Number(b.mtimeMs) || 0);
  if (timeDelta) return timeDelta;
  return String(a.path || '').localeCompare(String(b.path || ''));
}

function createBoundedCandidateHeap(limit) {
  const maxSize = Math.max(1, Math.floor(Number(limit) || 1));
  const heap = [];
  let eligibleCount = 0;
  function siftUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (comparePruneCandidates(heap[parent], heap[index]) >= 0) break;
      [heap[parent], heap[index]] = [heap[index], heap[parent]];
      index = parent;
    }
  }
  function siftDown(index) {
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let worst = index;
      if (left < heap.length && comparePruneCandidates(heap[left], heap[worst]) > 0) worst = left;
      if (right < heap.length && comparePruneCandidates(heap[right], heap[worst]) > 0) worst = right;
      if (worst === index) break;
      [heap[index], heap[worst]] = [heap[worst], heap[index]];
      index = worst;
    }
  }
  function add(candidate) {
    eligibleCount += 1;
    if (heap.length < maxSize) {
      heap.push(candidate);
      siftUp(heap.length - 1);
      return;
    }
    if (comparePruneCandidates(candidate, heap[0]) >= 0) return;
    heap[0] = candidate;
    siftDown(0);
  }
  function values() {
    const result = heap.slice().sort(comparePruneCandidates);
    Object.defineProperty(result, 'eligibleCount', { value:eligibleCount, enumerable:false });
    return result;
  }
  return { add, values, get eligibleCount() { return eligibleCount; }, get size() { return heap.length; } };
}

function getDirectorySize(dirPath) {
  const root = safeResolve(dirPath);
  let bytes = 0;
  let files = 0;
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch (error) { continue; }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (!isInside(root, fullPath)) continue;
      try {
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
          stack.push(fullPath);
        } else if (entry.isFile()) {
          const stat = fs.statSync(fullPath);
          bytes += Math.max(0, Number(stat.size) || 0);
          files += 1;
        }
      } catch (error) {}
    }
  }
  return { bytes, files };
}


async function getDirectorySizeAsync(dirPath) {
  const root = safeResolve(dirPath);
  let bytes = 0;
  let files = 0;
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try { entries = await fs.promises.readdir(current, { withFileTypes:true }); } catch { continue; }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (!isInside(root, fullPath) || entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) { stack.push(fullPath); continue; }
      if (!entry.isFile()) continue;
      try {
        const stat = await fs.promises.stat(fullPath);
        bytes += Math.max(0, Number(stat.size) || 0);
        files += 1;
      } catch {}
    }
  }
  return { bytes, files };
}

function createDiskCacheJanitorService(options = {}) {
  const dataDir = safeResolve(options.dataDir || 'data');
  const cacheDirs = (Array.isArray(options.cacheDirs) ? options.cacheDirs : [])
    .map((item) => ({
      label: String(item && item.label || '').trim() || 'cache',
      dir: safeResolve(item && item.dir || '')
    }))
    .filter((item) => item.dir && isInside(dataDir, item.dir));

  const enabled = options.enabled !== false;
  const usagePct = Math.max(1, Math.min(99, toPositiveNumber(options.usagePct, 85)));
  const targetUsagePct = Math.max(1, Math.min(usagePct - 1, toPositiveNumber(options.targetUsagePct, 80)));
  const minFreeBytes = Math.max(0, toNonNegativeNumber(options.minFreeMb, 2048) * MB);
  const targetFreeBytes = Math.max(minFreeBytes, toNonNegativeNumber(options.targetFreeMb, 4096) * MB);
  const intervalMs = Math.max(60 * 1000, toPositiveNumber(options.intervalMs, 5 * 60 * 1000));
  const minFileAgeMs = Math.max(0, toNonNegativeNumber(options.minFileAgeMs, 60 * 1000));
  const maxDeletePerRun = Math.max(1, Math.floor(toPositiveNumber(options.maxDeletePerRun, 5000)));
  const logger = options.logger || console;
  const isPathProtected = typeof options.isPathProtected === 'function' ? options.isPathProtected : () => false;

  let timer = null;
  let initialTimer = null;
  let runInFlight = false;
  let asyncRunPromise = null;
  const metrics = {
    runs: 0,
    skippedDisabled: 0,
    skippedHealthy: 0,
    skippedUnavailable: 0,
    pruneRuns: 0,
    filesDeleted: 0,
    bytesDeleted: 0,
    deleteErrors: 0,
    lastRunAt: 0,
    lastTrigger: '',
    lastError: '',
    lastDeletedFiles: 0,
    lastDeletedBytes: 0,
    summaryScans: 0,
    summaryCacheHits: 0,
    healthyFullScanSkips: 0,
    protectedFilesSkipped: 0
  };
  let cachedSummary = { cacheBytes: 0, cacheFiles: 0, perDir: [], updatedAt: 0 };
  let lastStatus = {
    marker: DISK_CACHE_AUTO_PRUNE_PASS,
    protectedDataPass: DISK_CACHE_PROTECTED_DATA_PASS,
    healthyScanSkipPass: DISK_CACHE_HEALTHY_SCAN_SKIP_PASS,
    inUseProtectionPass: DISK_CACHE_IN_USE_PROTECTION_PASS,
    enabled,
    dataDir,
    cacheDirs,
    config: { usagePct, targetUsagePct, minFreeBytes, targetFreeBytes, intervalMs, minFileAgeMs, maxDeletePerRun },
    fs: null,
    cacheBytes: 0,
    cacheFiles: 0,
    metrics: Object.assign({}, metrics)
  };

  function getFilesystemStatus() {
    try {
      if (typeof fs.statfsSync !== 'function') {
        return { available: false, error: 'fs.statfsSync unavailable' };
      }
      const stats = fs.statfsSync(dataDir);
      const blockSize = Number(stats.bsize || stats.frsize || 0) || 0;
      const blocks = Number(stats.blocks || 0) || 0;
      const bavail = Number(stats.bavail || 0) || 0;
      const bfree = Number(stats.bfree || 0) || 0;
      const totalBytes = Math.max(0, blockSize * blocks);
      const availableBytes = Math.max(0, blockSize * bavail);
      const freeBytes = Math.max(0, blockSize * bfree);
      const usedBytes = Math.max(0, totalBytes - freeBytes);
      const usedPct = totalBytes ? (usedBytes / totalBytes) * 100 : 0;
      return { available: true, totalBytes, freeBytes, availableBytes, usedBytes, usedPct };
    } catch (error) {
      return { available: false, error: error && error.message || String(error) };
    }
  }


  async function getFilesystemStatusAsync() {
    try {
      if (typeof fs.promises.statfs !== 'function') return getFilesystemStatus();
      const stats = await fs.promises.statfs(dataDir);
      const blockSize = Number(stats.bsize || stats.frsize || 0) || 0;
      const blocks = Number(stats.blocks || 0) || 0;
      const bavail = Number(stats.bavail || 0) || 0;
      const bfree = Number(stats.bfree || 0) || 0;
      const totalBytes = Math.max(0, blockSize * blocks);
      const availableBytes = Math.max(0, blockSize * bavail);
      const freeBytes = Math.max(0, blockSize * bfree);
      const usedBytes = Math.max(0, totalBytes - freeBytes);
      const usedPct = totalBytes ? (usedBytes / totalBytes) * 100 : 0;
      return { available:true, totalBytes, freeBytes, availableBytes, usedBytes, usedPct };
    } catch (error) {
      return { available:false, error:error && error.message || String(error) };
    }
  }

  function buildTrigger(fsStatus) {
    if (!fsStatus || !fsStatus.available) return 'unavailable';
    const reasons = [];
    if (fsStatus.usedPct >= usagePct) reasons.push('usage_pct');
    if (fsStatus.availableBytes <= minFreeBytes) reasons.push('min_free_bytes');
    return reasons.join('+');
  }

  function targetReached(fsStatus) {
    if (!fsStatus || !fsStatus.available) return true;
    return fsStatus.usedPct <= targetUsagePct && fsStatus.availableBytes >= targetFreeBytes;
  }

  function collectCandidates(now) {
    const selection = createBoundedCandidateHeap(maxDeletePerRun);
    for (const item of cacheDirs) {
      const root = item.dir;
      const stack = [root];
      while (stack.length) {
        const current = stack.pop();
        let entries = [];
        try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch (error) { continue; }
        for (const entry of entries) {
          const fullPath = path.join(current, entry.name);
          if (!isInside(root, fullPath)) continue;
          try {
            if (entry.isSymbolicLink()) continue;
            if (entry.isDirectory()) {
              stack.push(fullPath);
              continue;
            }
            if (!entry.isFile()) continue;
            if (isPathProtected(fullPath)) { metrics.protectedFilesSkipped += 1; continue; }
            const stat = fs.statSync(fullPath);
            const ageMs = now - Math.floor(Number(stat.mtimeMs) || 0);
            if (ageMs < minFileAgeMs) continue;
            const tmp = entry.name.endsWith('.tmp') || entry.name.includes('.tmp.');
            selection.add({ path: fullPath, scope: item.label, size: Math.max(0, Number(stat.size) || 0), mtimeMs: Number(stat.mtimeMs) || 0, tmp });
          } catch (error) {}
        }
      }
    }
    return selection.values();
  }


  async function collectCandidatesAsync(now) {
    const selection = createBoundedCandidateHeap(maxDeletePerRun);
    for (const item of cacheDirs) {
      const root = item.dir;
      const stack = [root];
      while (stack.length) {
        const current = stack.pop();
        let entries = [];
        try { entries = await fs.promises.readdir(current, { withFileTypes:true }); } catch { continue; }
        for (const entry of entries) {
          const fullPath = path.join(current, entry.name);
          if (!isInside(root, fullPath) || entry.isSymbolicLink()) continue;
          if (entry.isDirectory()) { stack.push(fullPath); continue; }
          if (!entry.isFile()) continue;
          if (isPathProtected(fullPath)) { metrics.protectedFilesSkipped += 1; continue; }
          try {
            const stat = await fs.promises.stat(fullPath);
            const ageMs = now - Math.floor(Number(stat.mtimeMs) || 0);
            if (ageMs < minFileAgeMs) continue;
            const tmp = entry.name.endsWith('.tmp') || entry.name.includes('.tmp.');
            selection.add({ path:fullPath, scope:item.label, size:Math.max(0, Number(stat.size) || 0), mtimeMs:Number(stat.mtimeMs) || 0, tmp });
          } catch {}
        }
      }
    }
    return selection.values();
  }

  function summarizeCacheDirs() {
    metrics.summaryScans += 1;
    let cacheBytes = 0;
    let cacheFiles = 0;
    const perDir = [];
    for (const item of cacheDirs) {
      const size = getDirectorySize(item.dir);
      cacheBytes += size.bytes;
      cacheFiles += size.files;
      perDir.push({ label: item.label, dir: item.dir, bytes: size.bytes, files: size.files });
    }
    cachedSummary = { cacheBytes, cacheFiles, perDir, updatedAt: Date.now() };
    return cachedSummary;
  }

  function updateStatus(fsStatus, extra = {}, options = {}) {
    const refreshSummary = options?.refreshSummary === true;
    const summary = refreshSummary ? summarizeCacheDirs() : cachedSummary;
    if (!refreshSummary) metrics.summaryCacheHits += 1;
    lastStatus = {
      marker: DISK_CACHE_AUTO_PRUNE_PASS,
      protectedDataPass: DISK_CACHE_PROTECTED_DATA_PASS,
      healthyScanSkipPass: DISK_CACHE_HEALTHY_SCAN_SKIP_PASS,
      inUseProtectionPass: DISK_CACHE_IN_USE_PROTECTION_PASS,
      boundedCandidatePass: DISK_CACHE_BOUNDED_CANDIDATE_PASS,
      enabled,
      dataDir,
      cacheDirs,
      config: { usagePct, targetUsagePct, minFreeBytes, targetFreeBytes, intervalMs, minFileAgeMs, maxDeletePerRun },
      fs: fsStatus || getFilesystemStatus(),
      cacheBytes: summary.cacheBytes,
      cacheFiles: summary.cacheFiles,
      perDir: summary.perDir,
      cacheSummaryUpdatedAt: Number(summary.updatedAt) || 0,
      metrics: Object.assign({}, metrics),
      lastResult: extra
    };
    return lastStatus;
  }


  async function summarizeCacheDirsAsync() {
    metrics.summaryScans += 1;
    let cacheBytes = 0;
    let cacheFiles = 0;
    const perDir = [];
    for (const item of cacheDirs) {
      const size = await getDirectorySizeAsync(item.dir);
      cacheBytes += size.bytes;
      cacheFiles += size.files;
      perDir.push({ label:item.label, dir:item.dir, bytes:size.bytes, files:size.files });
    }
    cachedSummary = { cacheBytes, cacheFiles, perDir, updatedAt:Date.now() };
    return cachedSummary;
  }

  async function updateStatusAsync(fsStatus, extra = {}, options = {}) {
    const refreshSummary = options?.refreshSummary === true;
    const summary = refreshSummary ? await summarizeCacheDirsAsync() : cachedSummary;
    if (!refreshSummary) metrics.summaryCacheHits += 1;
    lastStatus = {
      marker:DISK_CACHE_AUTO_PRUNE_PASS,
      protectedDataPass:DISK_CACHE_PROTECTED_DATA_PASS,
      healthyScanSkipPass:DISK_CACHE_HEALTHY_SCAN_SKIP_PASS,
      inUseProtectionPass:DISK_CACHE_IN_USE_PROTECTION_PASS,
      enabled,
      dataDir,
      cacheDirs,
      config:{ usagePct, targetUsagePct, minFreeBytes, targetFreeBytes, intervalMs, minFileAgeMs, maxDeletePerRun },
      fs:fsStatus || await getFilesystemStatusAsync(),
      cacheBytes:summary.cacheBytes,
      cacheFiles:summary.cacheFiles,
      perDir:summary.perDir,
      cacheSummaryUpdatedAt:Number(summary.updatedAt) || 0,
      metrics:Object.assign({}, metrics),
      lastResult:extra
    };
    return lastStatus;
  }

  function pruneOnceAsync(force = false) {
    if (asyncRunPromise) return asyncRunPromise;
    if (runInFlight) return Promise.resolve(lastStatus);
    runInFlight = true;
    asyncRunPromise = (async () => {
      metrics.runs += 1;
      metrics.lastRunAt = Date.now();
      if (!enabled && !force) {
        metrics.skippedDisabled += 1;
        return updateStatusAsync(await getFilesystemStatusAsync(), { skipped:true, reason:'disabled' });
      }
      let fsStatus = await getFilesystemStatusAsync();
      if (!fsStatus.available) {
        metrics.skippedUnavailable += 1;
        metrics.lastError = fsStatus.error || 'filesystem status unavailable';
        return updateStatusAsync(fsStatus, { skipped:true, reason:'filesystem-unavailable' });
      }
      const trigger = force ? 'manual-force' : buildTrigger(fsStatus);
      if (!force && !trigger) {
        metrics.skippedHealthy += 1;
        metrics.healthyFullScanSkips += 1;
        return updateStatusAsync(fsStatus, { skipped:true, reason:'healthy', pass:DISK_CACHE_HEALTHY_SCAN_SKIP_PASS });
      }
      metrics.pruneRuns += 1;
      metrics.lastTrigger = trigger;
      const candidates = await collectCandidatesAsync(Date.now());
      let deletedFiles = 0;
      let deletedBytes = 0;
      let checkedSinceStat = 0;
      for (const candidate of candidates) {
        if (deletedFiles >= maxDeletePerRun) break;
        if (!force && targetReached(fsStatus)) break;
        try {
          if (isPathProtected(candidate.path)) { metrics.protectedFilesSkipped += 1; continue; }
          await fs.promises.unlink(candidate.path);
          deletedFiles += 1;
          deletedBytes += candidate.size;
          metrics.filesDeleted += 1;
          metrics.bytesDeleted += candidate.size;
          checkedSinceStat += 1;
          if (checkedSinceStat >= 25 || deletedBytes >= 16 * MB) {
            fsStatus = await getFilesystemStatusAsync();
            checkedSinceStat = 0;
          }
        } catch (error) {
          if (!error || error.code !== 'ENOENT') {
            metrics.deleteErrors += 1;
            metrics.lastError = error && error.message || String(error);
          }
        }
      }
      fsStatus = await getFilesystemStatusAsync();
      metrics.lastDeletedFiles = deletedFiles;
      metrics.lastDeletedBytes = deletedBytes;
      return updateStatusAsync(fsStatus, { skipped:false, trigger, deletedFiles, deletedBytes, candidates:Number(candidates.eligibleCount) || candidates.length, retainedCandidates:candidates.length, targetReached:targetReached(fsStatus) }, { refreshSummary:true });
    })().finally(() => {
      runInFlight = false;
      asyncRunPromise = null;
    });
    return asyncRunPromise;
  }

  function pruneOnce(force = false) {
    if (runInFlight) return lastStatus;
    runInFlight = true;
    try {
      metrics.runs += 1;
      metrics.lastRunAt = Date.now();
      if (!enabled && !force) {
        metrics.skippedDisabled += 1;
        return updateStatus(getFilesystemStatus(), { skipped: true, reason: 'disabled' });
      }
      let fsStatus = getFilesystemStatus();
      if (!fsStatus.available) {
        metrics.skippedUnavailable += 1;
        metrics.lastError = fsStatus.error || 'filesystem status unavailable';
        return updateStatus(fsStatus, { skipped: true, reason: 'filesystem-unavailable' });
      }
      const trigger = force ? 'manual-force' : buildTrigger(fsStatus);
      if (!force && !trigger) {
        metrics.skippedHealthy += 1;
        metrics.healthyFullScanSkips += 1;
        return updateStatus(fsStatus, { skipped: true, reason: 'healthy', pass: DISK_CACHE_HEALTHY_SCAN_SKIP_PASS });
      }
      metrics.pruneRuns += 1;
      metrics.lastTrigger = trigger;
      const now = Date.now();
      const candidates = collectCandidates(now);
      let deletedFiles = 0;
      let deletedBytes = 0;
      let checkedSinceStat = 0;
      for (const candidate of candidates) {
        if (deletedFiles >= maxDeletePerRun) break;
        if (!force && targetReached(fsStatus)) break;
        try {
          if (isPathProtected(candidate.path)) { metrics.protectedFilesSkipped += 1; continue; }
          fs.unlinkSync(candidate.path);
          deletedFiles += 1;
          deletedBytes += candidate.size;
          metrics.filesDeleted += 1;
          metrics.bytesDeleted += candidate.size;
          checkedSinceStat += 1;
          if (checkedSinceStat >= 25 || deletedBytes >= 16 * MB) {
            fsStatus = getFilesystemStatus();
            checkedSinceStat = 0;
          }
        } catch (error) {
          metrics.deleteErrors += 1;
          metrics.lastError = error && error.message || String(error);
        }
      }
      fsStatus = getFilesystemStatus();
      metrics.lastDeletedFiles = deletedFiles;
      metrics.lastDeletedBytes = deletedBytes;
      return updateStatus(fsStatus, { skipped: false, trigger, deletedFiles, deletedBytes, candidates: Number(candidates.eligibleCount) || candidates.length, retainedCandidates: candidates.length, targetReached: targetReached(fsStatus) }, { refreshSummary: true });
    } finally {
      runInFlight = false;
    }
  }

  function start() {
    if (timer || initialTimer || !enabled) return;
    timer = setInterval(() => {
      void pruneOnceAsync(false).catch((error) => {
        metrics.lastError = error && error.message || String(error);
        if (logger && typeof logger.warn === 'function') logger.warn('disk cache auto-prune failed', metrics.lastError);
      });
    }, intervalMs);
    if (typeof timer.unref === 'function') timer.unref();
    const initialDelay = Math.min(30 * 1000, Math.max(1000, intervalMs));
    initialTimer = setTimeout(() => {
      initialTimer = null;
      void pruneOnceAsync(false).catch(() => {});
    }, initialDelay);
    if (typeof initialTimer.unref === 'function') initialTimer.unref();
  }

  async function stop() {
    if (timer) clearInterval(timer);
    if (initialTimer) clearTimeout(initialTimer);
    timer = null;
    initialTimer = null;
    if (asyncRunPromise) await asyncRunPromise.catch(() => {});
  }

  function getStatus() {
    return updateStatus(getFilesystemStatus(), { timerActive:!!timer, initialTimerActive:!!initialTimer }, { refreshSummary:true });
  }

  async function getStatusAsync() {
    return updateStatusAsync(await getFilesystemStatusAsync(), { timerActive:!!timer, initialTimerActive:!!initialTimer }, { refreshSummary:true });
  }

  updateStatus(getFilesystemStatus(), { initialized: true, summaryDeferred: true, pass: DISK_CACHE_HEALTHY_SCAN_SKIP_PASS });

  return {
    marker: DISK_CACHE_AUTO_PRUNE_PASS,
    protectedDataPass: DISK_CACHE_PROTECTED_DATA_PASS,
    boundedCandidatePass: DISK_CACHE_BOUNDED_CANDIDATE_PASS,
    start,
    stop,
    pruneOnce,
    pruneOnceAsync,
    getStatus,
    getStatusAsync
  };
}

module.exports = {
  createDiskCacheJanitorService,
  DISK_CACHE_AUTO_PRUNE_PASS,
  DISK_CACHE_PROTECTED_DATA_PASS,
  DISK_CACHE_HEALTHY_SCAN_SKIP_PASS,
  DISK_CACHE_IN_USE_PROTECTION_PASS,
  DISK_CACHE_BOUNDED_CANDIDATE_PASS,
  comparePruneCandidates,
  createBoundedCandidateHeap
};
