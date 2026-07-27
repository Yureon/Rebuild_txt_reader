const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { durableRenameAsync, durableRemoveAsync, fsyncDirectoryAsync } = require('../repositories/json-file-store');

const TXT_READER_MULTI_AUDIT_LOG_PASS = 'v395-audit-log-service-pass';
const TXT_READER_MULTI_AUDIT_LOG_QUERY_PASS = 'v403-audit-log-query-pass';
const TXT_READER_MULTI_AUDIT_LOG_BATCH_PASS = 'v671-audit-log-bounded-batch-pass';
const TXT_READER_MULTI_AUDIT_LOG_NOFOLLOW_PASS = 'v677-audit-log-nofollow-pass';
const MAX_DETAIL_STRING_LENGTH = 2048;
const MAX_DETAIL_ARRAY_LENGTH = 100;
const DEFAULT_MAX_AUDIT_LOG_BYTES = 5 * 1024 * 1024;
const DEFAULT_AUDIT_READ_WINDOW_BYTES = 1024 * 1024;
const DEFAULT_AUDIT_QUEUE_MAX = 4096;
const DEFAULT_AUDIT_BATCH_MAX = 128;
const DEFAULT_AUDIT_BATCH_DELAY_MS = 25;
const DEFAULT_AUDIT_FSYNC_INTERVAL_MS = 1000;

function nowIso() {
  return new Date().toISOString();
}

function sanitizeScalar(value) {
  if (value == null) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.length > MAX_DETAIL_STRING_LENGTH ? value.slice(0, MAX_DETAIL_STRING_LENGTH) + '…' : value;
  return String(value).slice(0, MAX_DETAIL_STRING_LENGTH);
}

function sanitizeDetails(value, depth = 0) {
  if (value == null || typeof value !== 'object') return sanitizeScalar(value);
  if (depth > 3) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, MAX_DETAIL_ARRAY_LENGTH).map((item) => sanitizeDetails(item, depth + 1));
  const out = Object.create(null);
  Object.keys(value).sort().forEach((key) => {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') return;
    if (/password|secret|token|csrf|cookie|hash/i.test(key)) {
      out[key] = '[redacted]';
      return;
    }
    out[key] = sanitizeDetails(value[key], depth + 1);
  });
  return out;
}

function actorFromSession(session = {}) {
  return {
    kind: String(session.kind || ''),
    userId: String(session.userId || ''),
    username: String(session.username || ''),
    role: String(session.role || '')
  };
}

function parseEventLine(line) {
  try {
    if (!line || !String(line).trim()) return null;
    const event = JSON.parse(line);
    if (!event || typeof event !== 'object') return null;
    return event;
  } catch (error) {
    return null;
  }
}

function normalizeLimit(value, fallback = 100) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(500, Math.floor(n)));
}

function normalizeByteLimit(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(64 * 1024, Math.floor(n));
}

function normalizeBoundedInteger(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function isStrictAuditEvent(eventType, options = {}) {
  if (options.strictDurable === true) return true;
  if (options.strictDurable === false) return false;
  const type = String(eventType || '');
  return /^(?:library\.|auth\.|admin\.user\.|admin\.signup_code\.|font\.|admin\.site_language\.)/.test(type);
}

function openNoFollowSync(filePath, flags, mode) {
  const noFollow = Number(fs.constants.O_NOFOLLOW) || 0;
  return fs.openSync(filePath, flags | noFollow, mode);
}

function readTailText(filePath, maxBytes) {
  const fd = openNoFollowSync(filePath, fs.constants.O_RDONLY);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) throw Object.assign(new Error('audit log is not a regular file'), { code:'AUDIT_LOG_NOT_REGULAR' });
    const size = stat.size;
    const bytes = Math.min(size, maxBytes);
    const buffer = Buffer.alloc(bytes);
    fs.readSync(fd, buffer, 0, bytes, size - bytes);
    let text = buffer.toString('utf8');
    if (bytes < size) {
      const firstNewline = text.indexOf('\n');
      if (firstNewline >= 0) text = text.slice(firstNewline + 1);
    }
    return { text, fileSizeBytes:size, windowBytes:bytes, truncatedTail:bytes < size };
  } finally { fs.closeSync(fd); }
}

async function readTailTextAsync(filePath, maxBytes) {
  const noFollow = Number(fs.constants.O_NOFOLLOW) || 0;
  const handle = await fs.promises.open(filePath, fs.constants.O_RDONLY | noFollow);
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) throw Object.assign(new Error('audit log is not a regular file'), { code:'AUDIT_LOG_NOT_REGULAR' });
    const size = stat.size;
    const bytes = Math.min(size, maxBytes);
    const buffer = Buffer.alloc(bytes);
    await handle.read(buffer, 0, bytes, size - bytes);
    let text = buffer.toString('utf8');
    if (bytes < size) {
      const firstNewline = text.indexOf('\n');
      if (firstNewline >= 0) text = text.slice(firstNewline + 1);
    }
    return { text, fileSizeBytes:size, windowBytes:bytes, truncatedTail:bytes < size };
  } finally { await handle.close(); }
}

function parseTime(value) {
  if (!value) return 0;
  const n = Date.parse(String(value));
  return Number.isFinite(n) ? n : 0;
}

function eventMatchesFilters(event, filters = {}) {
  if (!event) return false;
  const type = String(filters.type || filters.eventType || '').trim();
  if (type && String(event.type || '') !== type) return false;
  const userId = String(filters.userId || '').trim();
  if (userId) {
    const actorUserId = event.actor && String(event.actor.userId || '');
    const targetUserId = event.target && String(event.target.userId || '');
    if (actorUserId !== userId && targetUserId !== userId) return false;
  }
  const username = String(filters.username || '').trim().toLowerCase();
  if (username) {
    const actorUsername = event.actor && String(event.actor.username || '').toLowerCase();
    const targetUsername = event.target && String(event.target.username || '').toLowerCase();
    if (actorUsername !== username && targetUsername !== username) return false;
  }
  const since = parseTime(filters.since || filters.from);
  const until = parseTime(filters.until || filters.to);
  const ts = parseTime(event.ts);
  if (since && (!ts || ts < since)) return false;
  if (until && (!ts || ts > until)) return false;
  const q = String(filters.q || filters.query || '').trim().toLowerCase();
  if (q) {
    const haystack = JSON.stringify({ type: event.type, actor: event.actor, target: event.target, details: event.details }).toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

function createAuditLogService(options = {}) {
  const auditLogPath = options.auditLogPath;
  if (!auditLogPath) throw new Error('createAuditLogService requires auditLogPath');
  const logger = options.logger || console;
  const now = typeof options.now === 'function' ? options.now : nowIso;
  const maxLogBytes = normalizeByteLimit(options.maxLogBytes, DEFAULT_MAX_AUDIT_LOG_BYTES);
  const readWindowBytes = normalizeByteLimit(options.readWindowBytes, DEFAULT_AUDIT_READ_WINDOW_BYTES);
  const rotatedAuditLogPath = `${auditLogPath}.1`;
  const queueMax = normalizeBoundedInteger(options.queueMax, DEFAULT_AUDIT_QUEUE_MAX, 64, 65536);
  const batchMax = normalizeBoundedInteger(options.batchMax, DEFAULT_AUDIT_BATCH_MAX, 1, 2048);
  const batchDelayMs = normalizeBoundedInteger(options.batchDelayMs, DEFAULT_AUDIT_BATCH_DELAY_MS, 0, 5000);
  const fsyncIntervalMs = normalizeBoundedInteger(options.fsyncIntervalMs, DEFAULT_AUDIT_FSYNC_INTERVAL_MS, 0, 60000);
  const pendingQueue = [];
  let writeChain = Promise.resolve();
  let flushTimer = null;
  let drainScheduled = false;
  let activeBatchEvents = 0;
  let pendingWrites = 0;
  let lastWriteError = '';
  let lastFsyncAt = 0;
  let stopping = false;
  const queueMetrics = {
    queued:0,
    written:0,
    batches:0,
    fsyncs:0,
    rejected:0,
    evicted:0,
    maxPending:0
  };

  function updatePendingWrites() {
    pendingWrites = pendingQueue.length + activeBatchEvents;
    queueMetrics.maxPending = Math.max(queueMetrics.maxPending, pendingWrites);
  }

  async function rotateIfNeeded(extraBytes = 0) {
    try {
      let size = 0;
      try {
        const stat = await fs.promises.lstat(auditLogPath);
        if (stat.isSymbolicLink() || !stat.isFile()) throw Object.assign(new Error('audit log path is not a regular file'), { code:'AUDIT_LOG_UNSAFE_PATH' });
        size = stat.size;
      } catch (error) {
        if (error && error.code === 'ENOENT') return false;
        throw error;
      }
      if (size + Math.max(0, Number(extraBytes) || 0) <= maxLogBytes) return false;
      await durableRemoveAsync(rotatedAuditLogPath, { force:true }).catch(() => {});
      await durableRenameAsync(auditLogPath, rotatedAuditLogPath);
      return true;
    } catch (error) {
      lastWriteError = error && error.message || String(error);
      if (logger && typeof logger.error === 'function') logger.error('audit log rotate failed:', lastWriteError);
      throw error;
    }
  }

  function rejectEntry(entry, errorCode) {
    if (!entry || !entry.result) return;
    entry.result.ok = false;
    entry.result.queued = false;
    entry.result.error = errorCode;
  }

  function makeQueueRoomForStrictEntry() {
    const index = pendingQueue.findIndex(entry => !entry.strict);
    if (index < 0) return false;
    const [evicted] = pendingQueue.splice(index, 1);
    rejectEntry(evicted, 'audit_log_queue_evicted_for_strict_event');
    queueMetrics.evicted += 1;
    updatePendingWrites();
    return true;
  }

  function scheduleDrain(delay = batchDelayMs) {
    if (stopping) return;
    if (drainScheduled) {
      if (delay !== 0) return;
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = null;
      drainScheduled = false;
    }
    drainScheduled = true;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      drainScheduled = false;
      void enqueueDrain(false);
    }, Math.max(0, delay));
    flushTimer.unref?.();
  }

  async function writeBatch(batch, forceSync = false) {
    if (!batch.length) return;
    const body = batch.map(entry => entry.line).join('');
    const bytes = Buffer.byteLength(body, 'utf8');
    const containsStrict = batch.some(entry => entry.strict);
    const shouldSync = forceSync || containsStrict || fsyncIntervalMs === 0 || Date.now() - lastFsyncAt >= fsyncIntervalMs;
    activeBatchEvents = batch.length;
    updatePendingWrites();
    try {
      await fs.promises.mkdir(path.dirname(auditLogPath), { recursive:true });
      const rotated = await rotateIfNeeded(bytes);
      const noFollow = Number(fs.constants.O_NOFOLLOW) || 0;
      const handle = await fs.promises.open(auditLogPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_APPEND | noFollow, 0o600);
      try {
        const stat = await handle.stat();
        if (!stat.isFile()) throw Object.assign(new Error('audit log path is not a regular file'), { code:'AUDIT_LOG_UNSAFE_PATH' });
        await handle.writeFile(body, 'utf8');
        if (shouldSync) {
          await handle.sync();
          queueMetrics.fsyncs += 1;
          lastFsyncAt = Date.now();
        }
      } finally {
        await handle.close();
      }
      if (shouldSync || rotated) await fsyncDirectoryAsync(path.dirname(auditLogPath));
      for (const entry of batch) {
        entry.result.rotated = rotated;
        entry.result.durable = shouldSync;
      }
      queueMetrics.written += batch.length;
      queueMetrics.batches += 1;
      lastWriteError = '';
    } catch (error) {
      const message = error && error.message || String(error);
      lastWriteError = message;
      for (const entry of batch) {
        entry.result.ok = false;
        entry.result.error = message;
      }
      if (logger && typeof logger.error === 'function') logger.error('audit log batch write failed:', message);
    } finally {
      activeBatchEvents = 0;
      updatePendingWrites();
    }
  }

  async function drainQueue(forceSync = false) {
    while (pendingQueue.length) {
      const batch = pendingQueue.splice(0, batchMax);
      updatePendingWrites();
      await writeBatch(batch, forceSync);
    }
  }

  function enqueueDrain(forceSync = false) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    drainScheduled = false;
    const run = writeChain.catch(() => {}).then(() => drainQueue(forceSync));
    writeChain = run.then(() => undefined, () => undefined);
    return run;
  }

  function appendEvent(eventType, options = {}) {
    const event = {
      id: crypto.randomBytes(12).toString('hex'),
      ts: now(),
      type: String(eventType || 'unknown'),
      actor: sanitizeDetails(options.actor || {}),
      target: sanitizeDetails(options.target || {}),
      details: sanitizeDetails(options.details || {})
    };
    const strict = isStrictAuditEvent(event.type, options);
    const result = {
      ok:true,
      queued:true,
      durable:false,
      strict,
      pass:TXT_READER_MULTI_AUDIT_LOG_PASS,
      batchPass:TXT_READER_MULTI_AUDIT_LOG_BATCH_PASS,
      noFollowPass:TXT_READER_MULTI_AUDIT_LOG_NOFOLLOW_PASS,
      event,
      rotated:false
    };
    if (stopping) {
      result.ok = false;
      result.queued = false;
      result.error = 'audit_log_stopping';
      return result;
    }
    if (pendingQueue.length >= queueMax) {
      if (!strict || !makeQueueRoomForStrictEntry()) {
        result.ok = false;
        result.queued = false;
        result.error = 'audit_log_queue_full';
        queueMetrics.rejected += 1;
        return result;
      }
    }
    pendingQueue.push({ line:JSON.stringify(event) + '\n', result, strict });
    queueMetrics.queued += 1;
    updatePendingWrites();
    // Security and filesystem mutation records enter the immediate durable lane;
    // telemetry records can coalesce for a short bounded interval.
    scheduleDrain(strict ? 0 : batchDelayMs);
    return result;
  }

  async function flush() {
    await enqueueDrain(true).catch(() => {});
    // Entries can arrive while the first forced drain is active. Stop only
    // after the queue is observed empty behind the serialized writer.
    while (pendingQueue.length || activeBatchEvents) await enqueueDrain(true).catch(() => {});
    return { ok:!lastWriteError, pass:TXT_READER_MULTI_AUDIT_LOG_PASS, pendingWrites, error:lastWriteError };
  }

  async function stop() {
    stopping = true;
    return flush();
  }

  function getStatus() {
    const dir = path.dirname(auditLogPath);
    let exists = false;
    let sizeBytes = 0;
    let writable = false;
    let error = '';
    try {
      fs.mkdirSync(dir, { recursive:true });
      fs.accessSync(dir, fs.constants.W_OK);
      writable = true;
      exists = fs.existsSync(auditLogPath);
      if (exists) sizeBytes = fs.statSync(auditLogPath).size;
    } catch (err) {
      error = err && err.message || String(err);
    }
    const rotatedExists = fs.existsSync(rotatedAuditLogPath);
    let rotatedSizeBytes = 0;
    try { if (rotatedExists) rotatedSizeBytes = fs.statSync(rotatedAuditLogPath).size; } catch {}
    const warnings = [];
    if (sizeBytes > Math.floor(maxLogBytes * 0.85)) warnings.push('audit_log_near_rotation_limit');
    if (lastWriteError) warnings.push('audit_log_last_write_failed');
    if (queueMetrics.rejected) warnings.push('audit_log_queue_rejected_events');
    return { ok:writable && !lastWriteError, pass:TXT_READER_MULTI_AUDIT_LOG_PASS, batchPass:TXT_READER_MULTI_AUDIT_LOG_BATCH_PASS, noFollowPass:TXT_READER_MULTI_AUDIT_LOG_NOFOLLOW_PASS, path:auditLogPath, exists, sizeBytes, writable, error:error || lastWriteError, maxLogBytes, readWindowBytes, rotatedPath:rotatedAuditLogPath, rotatedExists, rotatedSizeBytes, pendingWrites, queueMax, batchMax, batchDelayMs, fsyncIntervalMs, queueMetrics:{ ...queueMetrics }, stopping, warnings };
  }

  function readEvents(filters = {}) {
    const limit = normalizeLimit(filters.limit, 100);
    const events = [];
    let scanned = 0;
    let malformed = 0;
    let exists = false;
    let tailInfo = { fileSizeBytes:0, windowBytes:0, truncatedTail:false };
    try {
      exists = fs.existsSync(auditLogPath);
      if (!exists) return { ok:true, pass:TXT_READER_MULTI_AUDIT_LOG_QUERY_PASS, events:[], count:0, scanned:0, malformed:0, hasMore:false, filters:sanitizeDetails(filters), ...tailInfo };
      tailInfo = readTailText(auditLogPath, normalizeByteLimit(filters.readWindowBytes, readWindowBytes));
      const lines = tailInfo.text.split(/\r?\n/).filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i -= 1) {
        const event = parseEventLine(lines[i]);
        scanned += 1;
        if (!event) { malformed += 1; continue; }
        if (!eventMatchesFilters(event, filters)) continue;
        events.push(event);
        if (events.length >= limit) break;
      }
      return { ok:true, pass:TXT_READER_MULTI_AUDIT_LOG_QUERY_PASS, events, count:events.length, scanned, malformed, hasMore:scanned < lines.length || tailInfo.truncatedTail, filters:sanitizeDetails(filters), ...tailInfo };
    } catch (error) {
      return { ok:false, pass:TXT_READER_MULTI_AUDIT_LOG_QUERY_PASS, error:error.message, events, count:events.length, scanned, malformed, hasMore:false, filters:sanitizeDetails(filters), ...tailInfo };
    }
  }

  function exportEvents(filters = {}) {
    const payload = readEvents(filters);
    const lines = (payload.events || []).slice().reverse().map((event) => JSON.stringify(event));
    return { ...payload, jsonl:lines.join('\n') + (lines.length ? '\n' : '') };
  }

  async function getStatusAsync() {
    const dir = path.dirname(auditLogPath);
    let exists = false;
    let sizeBytes = 0;
    let writable = false;
    let error = '';
    try {
      await fs.promises.mkdir(dir, { recursive:true });
      await fs.promises.access(dir, fs.constants.W_OK);
      writable = true;
      try { sizeBytes = (await fs.promises.stat(auditLogPath)).size; exists = true; }
      catch (statError) { if (!statError || statError.code !== 'ENOENT') throw statError; }
    } catch (statusError) {
      error = statusError && statusError.message || String(statusError);
    }
    let rotatedExists = false;
    let rotatedSizeBytes = 0;
    try { rotatedSizeBytes = (await fs.promises.stat(rotatedAuditLogPath)).size; rotatedExists = true; }
    catch (statError) { if (statError && statError.code !== 'ENOENT' && !error) error = statError.message; }
    const warnings = [];
    if (sizeBytes > Math.floor(maxLogBytes * 0.85)) warnings.push('audit_log_near_rotation_limit');
    if (lastWriteError) warnings.push('audit_log_last_write_failed');
    if (queueMetrics.rejected) warnings.push('audit_log_queue_rejected_events');
    return { ok:writable && !lastWriteError, pass:TXT_READER_MULTI_AUDIT_LOG_PASS, batchPass:TXT_READER_MULTI_AUDIT_LOG_BATCH_PASS, noFollowPass:TXT_READER_MULTI_AUDIT_LOG_NOFOLLOW_PASS, path:auditLogPath, exists, sizeBytes, writable, error:error || lastWriteError, maxLogBytes, readWindowBytes, rotatedPath:rotatedAuditLogPath, rotatedExists, rotatedSizeBytes, pendingWrites, queueMax, batchMax, batchDelayMs, fsyncIntervalMs, queueMetrics:{ ...queueMetrics }, stopping, warnings };
  }

  async function readEventsAsync(filters = {}) {
    const limit = normalizeLimit(filters.limit, 100);
    const events = [];
    let scanned = 0;
    let malformed = 0;
    let tailInfo = { fileSizeBytes:0, windowBytes:0, truncatedTail:false };
    try {
      tailInfo = await readTailTextAsync(auditLogPath, normalizeByteLimit(filters.readWindowBytes, readWindowBytes));
      const lines = tailInfo.text.split(/\r?\n/).filter(Boolean);
      for (let index = lines.length - 1; index >= 0; index -= 1) {
        const event = parseEventLine(lines[index]);
        scanned += 1;
        if (!event) { malformed += 1; continue; }
        if (!eventMatchesFilters(event, filters)) continue;
        events.push(event);
        if (events.length >= limit) break;
      }
      return { ok:true, pass:TXT_READER_MULTI_AUDIT_LOG_QUERY_PASS, events, count:events.length, scanned, malformed, hasMore:scanned < lines.length || tailInfo.truncatedTail, filters:sanitizeDetails(filters), ...tailInfo };
    } catch (readError) {
      if (readError && readError.code === 'ENOENT') return { ok:true, pass:TXT_READER_MULTI_AUDIT_LOG_QUERY_PASS, events:[], count:0, scanned:0, malformed:0, hasMore:false, filters:sanitizeDetails(filters), ...tailInfo };
      return { ok:false, pass:TXT_READER_MULTI_AUDIT_LOG_QUERY_PASS, error:readError.message, events, count:events.length, scanned, malformed, hasMore:false, filters:sanitizeDetails(filters), ...tailInfo };
    }
  }

  async function exportEventsAsync(filters = {}) {
    const payload = await readEventsAsync(filters);
    const lines = (payload.events || []).slice().reverse().map(event => JSON.stringify(event));
    return { ...payload, jsonl:lines.join('\n') + (lines.length ? '\n' : '') };
  }

  const api = {
    appendEvent,
    flush,
    stop,
    getStatus,
    getStatusAsync,
    readEventsAsync,
    exportEventsAsync,
    rotateIfNeeded,
    actorFromSession,
    auditLogPath
  };
  if (options.enableSyncQuery === true) {
    api.readEvents = readEvents;
    api.exportEvents = exportEvents;
  }
  return api;
}

module.exports = {
  TXT_READER_MULTI_AUDIT_LOG_PASS,
  TXT_READER_MULTI_AUDIT_LOG_QUERY_PASS,
  TXT_READER_MULTI_AUDIT_LOG_BATCH_PASS,
  TXT_READER_MULTI_AUDIT_LOG_NOFOLLOW_PASS,
  DEFAULT_MAX_AUDIT_LOG_BYTES,
  DEFAULT_AUDIT_READ_WINDOW_BYTES,
  createAuditLogService,
  actorFromSession,
  sanitizeDetails,
  eventMatchesFilters
};
