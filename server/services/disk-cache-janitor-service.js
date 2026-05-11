const fs = require('fs');
const path = require('path');

const DISK_CACHE_AUTO_PRUNE_PASS = 'v538-disk-cache-auto-prune-pass';
const DISK_CACHE_PROTECTED_DATA_PASS = 'v538-disk-cache-protected-data-pass';
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

  let timer = null;
  let runInFlight = false;
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
    lastDeletedBytes: 0
  };
  let lastStatus = {
    marker: DISK_CACHE_AUTO_PRUNE_PASS,
    protectedDataPass: DISK_CACHE_PROTECTED_DATA_PASS,
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
    const candidates = [];
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
            const stat = fs.statSync(fullPath);
            const ageMs = now - Math.floor(Number(stat.mtimeMs) || 0);
            if (ageMs < minFileAgeMs) continue;
            const tmp = entry.name.endsWith('.tmp') || entry.name.includes('.tmp.');
            candidates.push({ path: fullPath, scope: item.label, size: Math.max(0, Number(stat.size) || 0), mtimeMs: Number(stat.mtimeMs) || 0, tmp });
          } catch (error) {}
        }
      }
    }
    candidates.sort((a, b) => {
      if (a.tmp !== b.tmp) return a.tmp ? -1 : 1;
      return (a.mtimeMs || 0) - (b.mtimeMs || 0);
    });
    return candidates;
  }

  function summarizeCacheDirs() {
    let cacheBytes = 0;
    let cacheFiles = 0;
    const perDir = [];
    for (const item of cacheDirs) {
      const size = getDirectorySize(item.dir);
      cacheBytes += size.bytes;
      cacheFiles += size.files;
      perDir.push({ label: item.label, dir: item.dir, bytes: size.bytes, files: size.files });
    }
    return { cacheBytes, cacheFiles, perDir };
  }

  function updateStatus(fsStatus, extra = {}) {
    const summary = summarizeCacheDirs();
    lastStatus = {
      marker: DISK_CACHE_AUTO_PRUNE_PASS,
      protectedDataPass: DISK_CACHE_PROTECTED_DATA_PASS,
      enabled,
      dataDir,
      cacheDirs,
      config: { usagePct, targetUsagePct, minFreeBytes, targetFreeBytes, intervalMs, minFileAgeMs, maxDeletePerRun },
      fs: fsStatus || getFilesystemStatus(),
      cacheBytes: summary.cacheBytes,
      cacheFiles: summary.cacheFiles,
      perDir: summary.perDir,
      metrics: Object.assign({}, metrics),
      lastResult: extra
    };
    return lastStatus;
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
        return updateStatus(fsStatus, { skipped: true, reason: 'healthy' });
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
      return updateStatus(fsStatus, { skipped: false, trigger, deletedFiles, deletedBytes, candidates: candidates.length, targetReached: targetReached(fsStatus) });
    } finally {
      runInFlight = false;
    }
  }

  function start() {
    if (timer || !enabled) return;
    timer = setInterval(() => {
      try { pruneOnce(false); }
      catch (error) {
        metrics.lastError = error && error.message || String(error);
        if (logger && typeof logger.warn === 'function') logger.warn('disk cache auto-prune failed', metrics.lastError);
      }
    }, intervalMs);
    if (typeof timer.unref === 'function') timer.unref();
    const initialDelay = Math.min(30 * 1000, Math.max(1000, intervalMs));
    const initialTimer = setTimeout(() => {
      try { pruneOnce(false); } catch (error) {}
    }, initialDelay);
    if (typeof initialTimer.unref === 'function') initialTimer.unref();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function getStatus() {
    return updateStatus(getFilesystemStatus(), { timerActive: !!timer });
  }

  updateStatus(getFilesystemStatus(), { initialized: true });

  return {
    marker: DISK_CACHE_AUTO_PRUNE_PASS,
    protectedDataPass: DISK_CACHE_PROTECTED_DATA_PASS,
    start,
    stop,
    pruneOnce,
    getStatus
  };
}

module.exports = {
  createDiskCacheJanitorService,
  DISK_CACHE_AUTO_PRUNE_PASS,
  DISK_CACHE_PROTECTED_DATA_PASS
};
