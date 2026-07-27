const { normalizeOrigin } = require('../config/origins');

const LEGACY_SESSION_COOKIE_NAME = 'session_token';
const HOST_SESSION_COOKIE_NAME = '__Host-session_token';

function getCookieValue(cookieHeader, name) {
  const target = String(name || '').trim();
  if (!target) return '';
  const parts = String(cookieHeader || '').split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    if (trimmed.slice(0, eq) === target) return trimmed.slice(eq + 1);
  }
  return '';
}

function getSessionTokenFromCookieHeader(cookieHeader) {
  return getCookieValue(cookieHeader, HOST_SESSION_COOKIE_NAME)
    || getCookieValue(cookieHeader, LEGACY_SESSION_COOKIE_NAME)
    || '';
}

function getSessionTokenFromReq(req) {
  const cookieStr = (req && req.headers && req.headers.cookie) || '';
  return getSessionTokenFromCookieHeader(cookieStr);
}

const PUBLIC_AUTH_PATHS = new Set([
  '/api/login',
  '/api/register',
  '/login.html',
  '/offline.html',
  '/sw.js',
  '/scripts/login.js',
  '/scripts/theme-boot.js',
  '/scripts/service-worker-register.js',
  '/scripts/scroll-to-top.js',
  '/scripts/non-auth-autofill-guard.js',
  '/styles/login.css',
  '/styles/update-banner.css',
  '/styles/scroll-to-top.css',
  '/styles/non-auth-autofill-guard.css',
  '/styles/deferred-ui.css',
  '/fragments/deferred-ui.html',
  '/manifest.json',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  '/icon/apple-icon-180x180.png',
  '/icon/favicon-16x16.png',
  '/icon/favicon-32x32.png',
  '/icon/favicon.ico',
  '/icon/icon-192.png',
  '/icon/icon-512.png',
  '/icon/maskable-192.png',
  '/icon/maskable-512.png'
]);

function isPublicAuthPath(reqPath) {
  return PUBLIC_AUTH_PATHS.has(String(reqPath || ''));
}

const OWNER_READER_ENTRY_REDIRECT_PASS = 'v441-owner-session-entry-redirect-pass';
const READER_ENTRY_PATHS = new Set(['/', '/index.html', '/library.html', '/site.html', '/mobile.html']);

function isReaderEntryPath(reqPath) {
  return READER_ENTRY_PATHS.has(String(reqPath || ''));
}

function shouldRedirectOwnerEntry(reqPath, session) {
  return !!(session && session.kind === 'owner' && isReaderEntryPath(reqPath));
}

function createAuthGate({ sessionStore, publicPathPredicate = isPublicAuthPath, accountService = null } = {}) {
  if (!sessionStore) throw new Error('createAuthGate requires sessionStore');
  return function authGate(req, res, next) {
    if (publicPathPredicate(req.path, req)) return next();

    const token = getSessionTokenFromReq(req);
    const authenticated = sessionStore.validateSession(token);

    let session = null;
    if (authenticated && typeof sessionStore.getSession === 'function') {
      session = sessionStore.getSession(token);
    }

    if (authenticated && accountService) {
      if (session && session.kind === 'user' && typeof accountService.isUserSessionCurrent === 'function' && !accountService.isUserSessionCurrent(session)) {
        sessionStore.deleteSession(token);
        if (req.path.startsWith('/api/')) return res.status(401).json({ error: '사용자 세션이 만료되었습니다.' });
        return res.redirect('/login.html');
      }
    }

    if (authenticated && shouldRedirectOwnerEntry(req.path, session)) {
      res.setHeader('X-Owner-Entry-Redirect', OWNER_READER_ENTRY_REDIRECT_PASS);
      return res.redirect('/admin/users.html');
    }

    if (!authenticated) {
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
      }
      return res.redirect('/login.html');
    }

    next();
  };
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const FETCH_METADATA_SAME_SITE = new Set(['same-origin', 'same-site', 'none']);

function isUnsafeMethod(method) {
  return UNSAFE_METHODS.has(String(method || '').toUpperCase());
}

function getFetchSite(req) {
  return String(req && req.get && req.get('sec-fetch-site') || '').trim().toLowerCase();
}

function createSameOriginMiddleware({ getAllowedOrigins, requireStrictOrigin = false } = {}) {
  if (typeof getAllowedOrigins !== 'function') throw new Error('createSameOriginMiddleware requires getAllowedOrigins');
  return function requireSameOrigin(req, res, next) {
    const origin = normalizeOrigin(req.get('origin') || '');
    const referer = String(req.get('referer') || '');
    const allowedOrigins = (getAllowedOrigins(req) || []).map(normalizeOrigin).filter(Boolean);
    const fetchSite = getFetchSite(req);
    const unsafe = isUnsafeMethod(req.method);

    if (unsafe && fetchSite === 'cross-site') {
      return res.status(403).json({ error: 'fetch metadata blocked', fetchSite });
    }

    if (!allowedOrigins.length) {
      if (unsafe && requireStrictOrigin) return res.status(503).json({ error: 'origin configuration missing', strictOrigin: true });
      return next();
    }

    if (origin) {
      if (!allowedOrigins.includes(origin)) {
        return res.status(403).json({ error:'origin blocked', origin, configuredOrigins:allowedOrigins.length });
      }
      return next();
    }

    if (referer) {
      const refOrigin = normalizeOrigin(referer);
      if (!refOrigin || !allowedOrigins.includes(refOrigin)) {
        return res.status(403).json({ error:'referer blocked', referer:refOrigin, configuredOrigins:allowedOrigins.length });
      }
      return next();
    }

    if (unsafe && requireStrictOrigin) {
      if (fetchSite && FETCH_METADATA_SAME_SITE.has(fetchSite)) return next();
      return res.status(403).json({ error:'origin required', configuredOrigins:allowedOrigins.length });
    }

    return next();
  };
}

function createCsrfMiddleware({ sessionStore } = {}) {
  if (!sessionStore) throw new Error('createCsrfMiddleware requires sessionStore');
  return function requireCsrf(req, res, next) {
    const sessionToken = getSessionTokenFromReq(req);
    if (!sessionToken || !sessionStore.validateSession(sessionToken)) {
      return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    const sent = req.get('x-csrf-token');
    const valid = typeof sessionStore.validateCsrfToken === 'function'
      ? sessionStore.validateCsrfToken(sessionToken, sent)
      : !!(sent && sessionStore.getCsrfToken(sessionToken) && sent === sessionStore.getCsrfToken(sessionToken));

    if (!valid) {
      return res.status(403).json({ error: 'csrf blocked' });
    }

    next();
  };
}

module.exports = {
  LEGACY_SESSION_COOKIE_NAME,
  HOST_SESSION_COOKIE_NAME,
  getCookieValue,
  getSessionTokenFromCookieHeader,
  getSessionTokenFromReq,
  isPublicAuthPath,
  isReaderEntryPath,
  shouldRedirectOwnerEntry,
  OWNER_READER_ENTRY_REDIRECT_PASS,
  isUnsafeMethod,
  createAuthGate,
  createSameOriginMiddleware,
  createCsrfMiddleware
};
