const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TXT_READER_MULTI_AUDIT_LOG_PASS = 'v395-audit-log-service-pass';
const TXT_READER_MULTI_AUDIT_LOG_QUERY_PASS = 'v403-audit-log-query-pass';
const MAX_DETAIL_STRING_LENGTH = 2048;
const MAX_DETAIL_ARRAY_LENGTH = 100;
const DEFAULT_MAX_AUDIT_LOG_BYTES = 5 * 1024 * 1024;
const DEFAULT_AUDIT_READ_WINDOW_BYTES = 1024 * 1024;

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
  const out = {};
  Object.keys(value).sort().forEach((key) => {
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

function readTailText(filePath, maxBytes) {
  const stat = fs.statSync(filePath);
  const size = stat.size;
  const bytes = Math.min(size, maxBytes);
  const fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(bytes);
    fs.readSync(fd, buffer, 0, bytes, size - bytes);
    let text = buffer.toString('utf8');
    if (bytes < size) {
      const firstNewline = text.indexOf('\n');
      if (firstNewline >= 0) text = text.slice(firstNewline + 1);
    }
    return { text, fileSizeBytes: size, windowBytes: bytes, truncatedTail: bytes < size };
  } finally {
    fs.closeSync(fd);
  }
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

  function rotateIfNeeded(extraBytes = 0) {
    try {
      if (!fs.existsSync(auditLogPath)) return false;
      const size = fs.statSync(auditLogPath).size;
      if (size + Math.max(0, Number(extraBytes) || 0) <= maxLogBytes) return false;
      try { fs.rmSync(rotatedAuditLogPath, { force: true }); } catch {}
      fs.renameSync(auditLogPath, rotatedAuditLogPath);
      return true;
    } catch (error) {
      if (logger && typeof logger.error === 'function') logger.error('audit log rotate failed:', error.message);
      return false;
    }
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
    try {
      fs.mkdirSync(path.dirname(auditLogPath), { recursive: true });
      const line = JSON.stringify(event) + '\n';
      const rotated = rotateIfNeeded(Buffer.byteLength(line, 'utf8'));
      fs.appendFileSync(auditLogPath, line, 'utf8');
      return { ok: true, pass: TXT_READER_MULTI_AUDIT_LOG_PASS, event, rotated };
    } catch (error) {
      if (logger && typeof logger.error === 'function') logger.error('audit log write failed:', error.message);
      return { ok: false, pass: TXT_READER_MULTI_AUDIT_LOG_PASS, error: error.message, event };
    }
  }

  function getStatus() {
    const dir = path.dirname(auditLogPath);
    let exists = false;
    let sizeBytes = 0;
    let writable = false;
    let error = '';
    try {
      fs.mkdirSync(dir, { recursive: true });
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
    return { ok: writable, pass: TXT_READER_MULTI_AUDIT_LOG_PASS, path: auditLogPath, exists, sizeBytes, writable, error, maxLogBytes, readWindowBytes, rotatedPath: rotatedAuditLogPath, rotatedExists, rotatedSizeBytes, warnings };
  }

  function readEvents(filters = {}) {
    const limit = normalizeLimit(filters.limit, 100);
    const events = [];
    let scanned = 0;
    let malformed = 0;
    let exists = false;
    let tailInfo = { fileSizeBytes: 0, windowBytes: 0, truncatedTail: false };
    try {
      exists = fs.existsSync(auditLogPath);
      if (!exists) return { ok: true, pass: TXT_READER_MULTI_AUDIT_LOG_QUERY_PASS, events: [], count: 0, scanned: 0, malformed: 0, hasMore: false, filters: sanitizeDetails(filters), ...tailInfo };
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
      return { ok: true, pass: TXT_READER_MULTI_AUDIT_LOG_QUERY_PASS, events, count: events.length, scanned, malformed, hasMore: scanned < lines.length || tailInfo.truncatedTail, filters: sanitizeDetails(filters), ...tailInfo };
    } catch (error) {
      return { ok: false, pass: TXT_READER_MULTI_AUDIT_LOG_QUERY_PASS, error: error.message, events, count: events.length, scanned, malformed, hasMore: false, filters: sanitizeDetails(filters), ...tailInfo };
    }
  }

  function exportEvents(filters = {}) {
    const payload = readEvents(filters);
    const lines = (payload.events || []).slice().reverse().map((event) => JSON.stringify(event));
    return { ...payload, jsonl: lines.join('\n') + (lines.length ? '\n' : '') };
  }

  return {
    appendEvent,
    getStatus,
    readEvents,
    exportEvents,
    rotateIfNeeded,
    actorFromSession,
    auditLogPath
  };
}

module.exports = {
  TXT_READER_MULTI_AUDIT_LOG_PASS,
  TXT_READER_MULTI_AUDIT_LOG_QUERY_PASS,
  DEFAULT_MAX_AUDIT_LOG_BYTES,
  DEFAULT_AUDIT_READ_WINDOW_BYTES,
  createAuditLogService,
  actorFromSession,
  sanitizeDetails,
  eventMatchesFilters
};
