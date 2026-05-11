const crypto = require('crypto');
const { loadJsonWithBackup, atomicWriteJson } = require('../repositories/json-file-store');

const DEFAULT_SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_CLEANUP_INTERVAL = 60 * 60 * 1000;
const SESSION_STORE_HMAC_PASS = 'v530-session-store-hmac-token-pass';

function createSessionStoreSecret(options = {}, logger = console) {
  const explicit = String(options.sessionStoreSecret || process.env.SESSION_STORE_SECRET || '').trim();
  if (explicit.length >= 16) return { secret: explicit, persistent: true, source: 'SESSION_STORE_SECRET' };
  if (process.env.NODE_ENV === 'production') {
    const secret = crypto.randomBytes(32).toString('hex');
    if (logger && typeof logger.warn === 'function') {
      logger.warn('SESSION_STORE_SECRET is not set; persisted sessions will be invalidated on restart.', SESSION_STORE_HMAC_PASS);
    }
    return { secret, persistent: false, source: 'runtime-random' };
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
  const secretInfo = createSessionStoreSecret(options, logger);
  const sessionTtl = Math.max(1000, Number(options.sessionTtl || options.ttlMs || DEFAULT_SESSION_TTL));
  const cleanupIntervalMs = Math.max(1000, Number(options.cleanupIntervalMs || DEFAULT_CLEANUP_INTERVAL));
  const sessions = new Map();
  const sessionMeta = new Map();
  const csrfTokens = new Map();

  let saveTimer = null;
  let writing = false;
  let dirty = false;
  let cleanupTimer = null;

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
        if (logger && typeof logger.warn === 'function') logger.warn('legacy plaintext session store ignored; users must sign in again.', SESSION_STORE_HMAC_PASS);
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
          const csrf = String(raw.csrfTokens[key] || '');
          if (csrf.startsWith('hmac:')) csrfTokens.set(key, csrf);
        });
      }
    } catch (error) {
      logger.error('session store load failed:', error.message);
    }
  }

  function flush() {
    dirty = true;
    if (writing) return;
    writing = true;

    const writeNext = () => {
      if (!dirty) {
        writing = false;
        return;
      }

      dirty = false;
      const out = {
        schemaVersion: 2,
        tokenStorage: 'hmac',
        pass: SESSION_STORE_HMAC_PASS,
        secretSource: secretInfo.source,
        secretPersistent: !!secretInfo.persistent,
        sessions: Object.fromEntries(sessions),
        sessionMeta: Object.fromEntries(sessionMeta),
        csrfTokens: Object.fromEntries(csrfTokens)
      };

      atomicWriteJson(storePath, out, (error) => {
        if (error) logger.error('session store save failed:', error.message);
        writeNext();
      });
    };

    writeNext();
  }

  function saveSoon() {
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

  function deleteSession(token) {
    const key = sessionKey(token);
    if (!key) return;
    sessions.delete(key);
    sessionMeta.delete(key);
    csrfTokens.delete(key);
    saveSoon();
  }

  function issueCsrfToken(sessionToken) {
    const key = sessionKey(sessionToken);
    if (!key || !sessions.has(key)) return '';
    const token = crypto.randomBytes(24).toString('hex');
    csrfTokens.set(key, csrfHash(token));
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
    return key ? (csrfTokens.get(key) || '') : '';
  }

  function validateCsrfToken(sessionToken, token) {
    const key = sessionKey(sessionToken);
    const expected = key ? (csrfTokens.get(key) || '') : '';
    const sent = csrfHash(token);
    return !!(expected && sent && safeTimingEqualHex(expected, sent));
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
    if (cleanupTimer) return;
    cleanupTimer = setInterval(cleanupExpired, cleanupIntervalMs);
    if (typeof cleanupTimer.unref === 'function') cleanupTimer.unref();
  }

  function stopCleanup() {
    if (cleanupTimer) clearInterval(cleanupTimer);
    cleanupTimer = null;
  }

  return {
    sessions,
    sessionMeta,
    csrfTokens,
    sessionStoreHmacPass: SESSION_STORE_HMAC_PASS,
    sessionStoreSecret: { source: secretInfo.source, persistent: !!secretInfo.persistent },
    load,
    flush,
    saveSoon,
    createSession,
    validateSession,
    getSession,
    updateSession,
    getSessionKind,
    deleteSession,
    issueCsrfToken,
    deleteCsrfToken,
    getCsrfToken,
    validateCsrfToken,
    cleanupExpired,
    startCleanup,
    stopCleanup
  };
}

module.exports = {
  createSessionStore,
  loadJsonWithBackup,
  atomicWriteJson,
  SESSION_STORE_HMAC_PASS
};
