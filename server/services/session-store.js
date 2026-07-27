const crypto = require('crypto');
const fs = require('fs');
const { loadJsonWithBackup, atomicWriteJson } = require('../repositories/json-file-store');
const { isKnownInsecureSecret } = require('../config/env');

const DEFAULT_SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_CLEANUP_INTERVAL = 60 * 60 * 1000;
const SESSION_STORE_HMAC_PASS = 'v530-session-store-hmac-token-pass';
const SESSION_STORE_LIFECYCLE_PASS = 'v591-session-store-lifecycle-pass';
const SESSION_STORE_SECRET_REQUIRED_PASS = 'v625-session-store-secret-required-pass';

function createSessionStoreSecret(options = {}, logger = console) {
  const explicit = String(options.sessionStoreSecret || process.env.SESSION_STORE_SECRET || '').trim();
  if (explicit.length >= 16 && !isKnownInsecureSecret(explicit)) return { secret: explicit, persistent: true, source: 'SESSION_STORE_SECRET' };
  if (process.env.NODE_ENV === 'production') {
    const error = new Error('SESSION_STORE_SECRET must be at least 16 characters and must not use a published example value in production.');
    error.code = 'SESSION_STORE_SECRET_REQUIRED';
    error.pass = SESSION_STORE_SECRET_REQUIRED_PASS;
    if (logger && typeof logger.error === 'function') logger.error(error.message, SESSION_STORE_SECRET_REQUIRED_PASS);
    throw error;
  }
  return { secret: 'txt-reader-dev-session-store-secret', persistent: false, source: 'development-default' };
}

function safeTimingEqualHex(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createSessionStore(options = {}) {
  const storePath = options.storePath;
  if (!storePath) throw new Error('createSessionStore requires storePath');

  const logger = options.logger || console;
  const writeJson = typeof options.writeJson === 'function' ? options.writeJson : atomicWriteJson;
  const secretInfo = createSessionStoreSecret(options, logger);
  const sessionTtl = Math.max(1000, Number(options.sessionTtl || options.ttlMs || DEFAULT_SESSION_TTL));
  const cleanupIntervalMs = Math.max(1000, Number(options.cleanupIntervalMs || DEFAULT_CLEANUP_INTERVAL));
  const retryDelayMs = Math.max(50, Math.min(30000, Number(options.retryDelayMs) || 1800));
  const sessions = new Map();
  const sessionMeta = new Map();
  const csrfTokens = new Map();
  const maxCsrfTokensPerSession = Math.max(2, Math.min(32, Number(options.maxCsrfTokensPerSession) || 8));

  let saveTimer = null;
  let writing = false;
  let dirty = false;
  let cleanupTimer = null;
  let retryTimer = null;
  let closed = false;
  let closePromise = null;
  let flushWaiters = [];
  let lastWriteError = '';
  let writeFailures = 0;

  function hmac(value) {
    return crypto.createHmac('sha256', secretInfo.secret).update(String(value || '')).digest('hex');
  }

  function sessionKey(token) {
    const raw = String(token || '').trim();
    return raw ? `hmac:${hmac(raw)}` : '';
  }

  function csrfHash(token) {
    const raw = String(token || '').trim();
    return raw ? `hmac:${hmac(`csrf:${raw}`)}` : '';
  }

  function normalizeSessionRecord(key, exp, meta = {}) {
    return {
      tokenKey: key,
      exp: Number(exp),
      kind: String(meta.kind || 'owner'),
      userId: String(meta.userId || (meta.kind === 'user' ? '' : '__owner__')),
      username: meta.username ? String(meta.username) : '',
      role: meta.role ? String(meta.role) : (meta.kind === 'user' ? 'reader' : 'owner'),
      sessionVersion: Math.max(1, Number(meta.sessionVersion || 1)),
      createdAt: Number(meta.createdAt || Date.now()),
      libraryAccess: meta.libraryAccess || undefined,
      pass: meta.pass || undefined,
      storePass: SESSION_STORE_HMAC_PASS
    };
  }

  function load() {
    try {
      const loaded = loadJsonWithBackup(storePath, null);
      if (!loaded.ok || !loaded.data || typeof loaded.data !== 'object') return;
      const raw = loaded.data;

      sessions.clear();
      sessionMeta.clear();
      csrfTokens.clear();

      if (raw.schemaVersion !== 2 || raw.tokenStorage !== 'hmac') {
        if (logger && typeof logger.warn === 'function') logger.warn('unsupported or plaintext session store removed; users must sign in again.', SESSION_STORE_HMAC_PASS);
        for (const target of [storePath, `${storePath}.bak`]) {
          try { fs.rmSync(target, { force:true }); }
          catch (removeError) { logger.error('unsupported session store removal failed:', removeError && removeError.message || removeError); }
        }
        dirty = true;
        saveSoon();
        return;
      }

      if (raw.sessions && typeof raw.sessions === 'object') {
        Object.keys(raw.sessions).forEach((key) => {
          if (!String(key || '').startsWith('hmac:')) return;
          const value = raw.sessions[key];
          const exp = typeof value === 'object' && value ? Number(value.exp) : Number(value);
          if (Number.isFinite(exp)) {
            sessions.set(key, exp);
            const meta = typeof value === 'object' && value ? value : (raw.sessionMeta && raw.sessionMeta[key]) || {};
            sessionMeta.set(key, normalizeSessionRecord(key, exp, meta));
          }
        });
      }

      if (raw.sessionMeta && typeof raw.sessionMeta === 'object') {
        Object.keys(raw.sessionMeta).forEach((key) => {
          if (!sessions.has(key)) return;
          const exp = sessions.get(key);
          sessionMeta.set(key, normalizeSessionRecord(key, exp, raw.sessionMeta[key]));
        });
      }

      if (raw.csrfTokens && typeof raw.csrfTokens === 'object') {
        Object.keys(raw.csrfTokens).forEach((key) => {
          if (!sessions.has(key)) return;
          const source = Array.isArray(raw.csrfTokens[key]) ? raw.csrfTokens[key] : [raw.csrfTokens[key]];
          const values = Array.from(new Set(source.map(value => String(value || '')).filter(value => value.startsWith('hmac:')))).slice(-maxCsrfTokensPerSession);
          if (values.length) csrfTokens.set(key, values);
        });
      }

      if (loaded.source === 'backup') { dirty = true; saveSoon(); }
    } catch (error) {
      logger.error('session store load failed:', error.message);
    }
  }

  function settleFlushWaiters() {
    const waiters = flushWaiters;
    flushWaiters = [];
    const result = { ok: !lastWriteError, error: lastWriteError, pass: SESSION_STORE_LIFECYCLE_PASS };
    waiters.forEach(resolve => resolve(result));
  }

  function waitForFlush() {
    if (!writing && !dirty) return Promise.resolve({ ok: !lastWriteError, error: lastWriteError, pass: SESSION_STORE_LIFECYCLE_PASS });
    return new Promise(resolve => flushWaiters.push(resolve));
  }

  function scheduleRetry() {
    if (closed || retryTimer) return;
    const delay = Math.min(30000, retryDelayMs * Math.pow(2, Math.min(4, Math.max(0, writeFailures - 1))));
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (!closed && dirty) flush();
    }, delay);
    retryTimer.unref?.();
  }

  function flush() {
    dirty = true;
    const pendingFlush = waitForFlush();
    if (!writing && !retryTimer) {
      writing = true;
      lastWriteError = '';

      const writeNext = () => {
        if (!dirty) {
          writing = false;
          settleFlushWaiters();
          return;
        }

        dirty = false;
        const out = {
          schemaVersion: 2,
          tokenStorage: 'hmac',
          pass: SESSION_STORE_HMAC_PASS,
          lifecyclePass: SESSION_STORE_LIFECYCLE_PASS,
          secretSource: secretInfo.source,
          secretPersistent: !!secretInfo.persistent,
          sessions: Object.fromEntries(sessions),
          sessionMeta: Object.fromEntries(sessionMeta),
          csrfTokens: Object.fromEntries(csrfTokens)
        };

        writeJson(storePath, out, (error) => {
          if (error) {
            lastWriteError = error.message || String(error);
            writeFailures += 1;
            logger.error('session store save failed:', lastWriteError);
            writing = false;
            if (!closed) {
              dirty = true;
              settleFlushWaiters();
              scheduleRetry();
              return;
            }
            settleFlushWaiters();
            return;
          }
          writeFailures = 0;
          lastWriteError = '';
          writeNext();
        });
      };

      writeNext();
    }
    return pendingFlush;
  }

  function saveSoon() {
    if (closed) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      flush();
    }, 80);
    if (saveTimer && typeof saveTimer.unref === 'function') saveTimer.unref();
  }

  function createSession(meta = {}) {
    const token = crypto.randomBytes(32).toString('hex');
    const key = sessionKey(token);
    const exp = Date.now() + sessionTtl;
    sessions.set(key, exp);
    sessionMeta.set(key, normalizeSessionRecord(key, exp, { ...meta, createdAt: Date.now() }));
    saveSoon();
    return token;
  }

  function validateSession(token) {
    const key = sessionKey(token);
    if (!key || !sessions.has(key)) return false;
    const exp = sessions.get(key);
    if (Date.now() > exp) {
      sessions.delete(key);
      sessionMeta.delete(key);
      csrfTokens.delete(key);
      saveSoon();
      return false;
    }
    return true;
  }

  function getSession(token) {
    const key = sessionKey(token);
    if (!validateSession(token)) return null;
    const exp = sessions.get(key);
    const meta = sessionMeta.get(key) || normalizeSessionRecord(key, exp, {});
    return { ...meta, token, exp };
  }

  function getSessionKind(token) {
    const session = getSession(token);
    return session ? session.kind : '';
  }

  function updateSession(token, patch = {}) {
    const key = sessionKey(token);
    if (!key || !sessions.has(key)) return null;
    const exp = sessions.get(key);
    const current = sessionMeta.get(key) || normalizeSessionRecord(key, exp, {});
    const next = normalizeSessionRecord(key, exp, { ...current, ...patch });
    sessionMeta.set(key, next);
    saveSoon();
    return { ...next, token, exp };
  }

  async function updateSessionDurably(token, patch = {}) {
    const key = sessionKey(token);
    if (!key || !sessions.has(key)) return { ok:false, updated:false, error:'session_not_found', pass:SESSION_STORE_LIFECYCLE_PASS };
    const exp = sessions.get(key);
    const previous = sessionMeta.get(key) || normalizeSessionRecord(key, exp, {});
    const next = normalizeSessionRecord(key, exp, { ...previous, ...patch });
    sessionMeta.set(key, next);
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    dirty = true;
    const result = await flush();
    if (!result || result.ok === false) {
      sessionMeta.set(key, previous);
      dirty = true;
      scheduleRetry();
      const error = new Error(String(result && result.error || 'session store durable update failed'));
      error.code = 'SESSION_STORE_UPDATE_PERSIST_FAILED';
      error.statusCode = 503;
      throw error;
    }
    return { ...result, updated:true, session:{ ...next, token, exp } };
  }

  function deleteSessionState(token) {
    const key = sessionKey(token);
    if (!key) return false;
    const changed = sessions.delete(key) || sessionMeta.has(key) || csrfTokens.has(key);
    sessionMeta.delete(key);
    csrfTokens.delete(key);
    return changed;
  }

  function deleteSession(token) {
    if (deleteSessionState(token)) saveSoon();
  }

  async function deleteSessionDurably(token) {
    const key = sessionKey(token);
    if (!key || !sessions.has(key)) return { ok:true, deleted:false, pass:SESSION_STORE_LIFECYCLE_PASS };
    const previous = {
      exp:sessions.get(key),
      meta:sessionMeta.get(key),
      csrf:Array.isArray(csrfTokens.get(key)) ? csrfTokens.get(key).slice() : null
    };
    deleteSessionState(token);
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    const result = await flush();
    if (!result || result.ok === false) {
      sessions.set(key, previous.exp);
      if (previous.meta) sessionMeta.set(key, previous.meta); else sessionMeta.delete(key);
      if (previous.csrf && previous.csrf.length) csrfTokens.set(key, previous.csrf); else csrfTokens.delete(key);
      dirty = true;
      scheduleRetry();
      const error = new Error(String(result && result.error || 'session store durable deletion failed'));
      error.code = 'SESSION_STORE_DELETE_PERSIST_FAILED';
      error.statusCode = 503;
      throw error;
    }
    return { ...result, deleted:true };
  }

  function issueCsrfToken(sessionToken) {
    const key = sessionKey(sessionToken);
    if (!key || !sessions.has(key)) return '';
    const token = crypto.randomBytes(24).toString('hex');
    const hashed = csrfHash(token);
    const current = Array.isArray(csrfTokens.get(key)) ? csrfTokens.get(key) : [];
    csrfTokens.set(key, current.filter(value => value !== hashed).concat(hashed).slice(-maxCsrfTokensPerSession));
    saveSoon();
    return token;
  }

  function deleteCsrfToken(sessionToken) {
    const key = sessionKey(sessionToken);
    if (!key) return;
    csrfTokens.delete(key);
    saveSoon();
  }

  function getCsrfToken(sessionToken) {
    const key = sessionKey(sessionToken);
    const values = key && Array.isArray(csrfTokens.get(key)) ? csrfTokens.get(key) : [];
    return values.length ? values[values.length - 1] : '';
  }

  function validateCsrfToken(sessionToken, token) {
    const key = sessionKey(sessionToken);
    const expected = key && Array.isArray(csrfTokens.get(key)) ? csrfTokens.get(key) : [];
    const sent = csrfHash(token);
    return !!(sent && expected.some(value => safeTimingEqualHex(value, sent)));
  }

  function cleanupExpired() {
    const now = Date.now();
    let changed = false;
    for (const [key, exp] of sessions) {
      if (now > exp) {
        sessions.delete(key);
        sessionMeta.delete(key);
        csrfTokens.delete(key);
        changed = true;
      }
    }
    if (changed) saveSoon();
    return changed;
  }

  function startCleanup() {
    if (cleanupTimer || closed) return;
    cleanupTimer = setInterval(cleanupExpired, cleanupIntervalMs);
    if (typeof cleanupTimer.unref === 'function') cleanupTimer.unref();
  }

  function stopCleanup() {
    if (cleanupTimer) clearInterval(cleanupTimer);
    cleanupTimer = null;
  }

  function close() {
    if (closePromise) return closePromise;
    closed = true;
    stopCleanup();
    if (saveTimer) clearTimeout(saveTimer);
    if (retryTimer) clearTimeout(retryTimer);
    saveTimer = null;
    retryTimer = null;
    closePromise = Promise.resolve(flush()).then(result => ({
      ...result,
      closed: true,
      timersCleared: !saveTimer && !cleanupTimer
    }));
    return closePromise;
  }

  function getLifecycleStatus() {
    return {
      pass: SESSION_STORE_LIFECYCLE_PASS,
      closed,
      writing,
      dirty,
      saveTimerActive: !!saveTimer,
      cleanupTimerActive: !!cleanupTimer,
      retryTimerActive: !!retryTimer,
      writeFailures,
      lastWriteError,
      maxCsrfTokensPerSession
    };
  }

  return {
    sessions,
    sessionMeta,
    csrfTokens,
    sessionStoreHmacPass: SESSION_STORE_HMAC_PASS,
    sessionStoreLifecyclePass: SESSION_STORE_LIFECYCLE_PASS,
    sessionStoreSecret: { source: secretInfo.source, persistent: !!secretInfo.persistent },
    load,
    flush,
    saveSoon,
    createSession,
    validateSession,
    getSession,
    updateSession,
    updateSessionDurably,
    getSessionKind,
    deleteSession,
    deleteSessionDurably,
    issueCsrfToken,
    deleteCsrfToken,
    getCsrfToken,
    validateCsrfToken,
    cleanupExpired,
    startCleanup,
    stopCleanup,
    close,
    getLifecycleStatus
  };
}

module.exports = {
  createSessionStore,
  loadJsonWithBackup,
  atomicWriteJson,
  SESSION_STORE_HMAC_PASS,
  SESSION_STORE_LIFECYCLE_PASS,
  SESSION_STORE_SECRET_REQUIRED_PASS
};
