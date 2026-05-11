const express = require('express');
const crypto = require('crypto');
const { ADMIN_ID, ADMIN_PW, OWNER_PASSWORD_MIN_LENGTH } = require('../config/env');
const { OWNER_SESSION_KIND, USER_SESSION_KIND, TXT_READER_MULTI_OWNER_CONSOLE_PASS } = require('../services/account-service');
const { getClientIp } = require('../services/rate-limit');
const {
  LEGACY_SESSION_COOKIE_NAME,
  HOST_SESSION_COOKIE_NAME,
  getSessionTokenFromReq
} = require('../middleware/auth');

const AUTH_CONFIG_FAIL_CLOSED_PASS = 'v313-auth-config-fail-closed-pass';
const PRODUCTION_PASSWORD_POLICY_PASS = 'v347-production-password-policy-pass';
const LOGIN_PRODUCTION_HTTPS_DIAGNOSTIC_PASS = 'v391-login-production-https-diagnostic-pass';
const CLOUDFLARE_VISITOR_HTTPS_TRUST_PASS = 'v525-cloudflare-visitor-https-trust-pass';
const LOGIN_SESSION_VERIFY_PASS = 'v391-login-session-verify-pass';
const TXT_READER_MULTI_REGISTER_ROUTE_PASS = 'v397-signup-code-register-route-pass';
const TXT_READER_MULTI_SELF_PASSWORD_CHANGE_PASS = 'v402-user-self-password-change-route-pass';
const OWNER_PASSWORD_MIN_LENGTH_ENV_PASS = 'v531-owner-password-min-length-env-pass';
const TXT_READER_MULTI_AUTH_IP_LIMIT_PASS = 'v535-auth-ip-wide-rate-limit-pass';
const PRODUCTION_PASSWORD_MIN_LENGTH = OWNER_PASSWORD_MIN_LENGTH;
function isProductionRuntime() { return process.env.NODE_ENV === 'production'; }
function getForwardedProto(req) {
  const raw = String(req && req.get && req.get('x-forwarded-proto') || '').trim().toLowerCase();
  return raw.split(',')[0].trim();
}
function isCloudflareTunnelMode() {
  return String(process.env.DEPLOYMENT_MODE || '').trim().toLowerCase() === 'cloudflare-tunnel';
}
function getCloudflareVisitorScheme(req) {
  const raw = String(req && req.get && req.get('cf-visitor') || '').trim();
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    return String(parsed && parsed.scheme || '').trim().toLowerCase();
  } catch (error) {
    return '';
  }
}
function isCloudflareVisitorHttps(req) {
  return isCloudflareTunnelMode() && getCloudflareVisitorScheme(req) === 'https';
}
function isRequestSecure(req) {
  if (!req) return false;
  if (req.secure === true) return true;
  if (String(req.protocol || '').toLowerCase() === 'https') return true;
  if (getForwardedProto(req) === 'https') return true;
  return isCloudflareVisitorHttps(req);
}
function createProductionHttpsDiagnostic(req) {
  return {
    pass: LOGIN_PRODUCTION_HTTPS_DIAGNOSTIC_PASS,
    nodeEnv: String(process.env.NODE_ENV || ''),
    deploymentMode: String(process.env.DEPLOYMENT_MODE || 'direct'),
    requestProtocol: String(req && req.protocol || ''),
    forwardedProto: getForwardedProto(req),
    cloudflareVisitorScheme: getCloudflareVisitorScheme(req),
    cloudflareVisitorHttpsTrusted: isCloudflareVisitorHttps(req),
    cloudflareVisitorHttpsTrustPass: CLOUDFLARE_VISITOR_HTTPS_TRUST_PASS,
    secure: isRequestSecure(req)
  };
}
function createCookieHeader(name, token, maxAgeSeconds, options = {}) { const secure = options.secure ? '; Secure' : ''; return `${name}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure}`; }
function createSessionCookie(token, maxAgeSeconds) { const isProd = isProductionRuntime(); const name = isProd ? HOST_SESSION_COOKIE_NAME : LEGACY_SESSION_COOKIE_NAME; return createCookieHeader(name, token, maxAgeSeconds, { secure: isProd }); }
function createSessionClearCookies() { const isProd = isProductionRuntime(); return [ createCookieHeader(HOST_SESSION_COOKIE_NAME, '', 0, { secure: true }), createCookieHeader(LEGACY_SESSION_COOKIE_NAME, '', 0, { secure: isProd }) ]; }
function hasConfiguredAdminCredentials() { return isConfiguredSecret(ADMIN_ID) && isConfiguredSecret(ADMIN_PW); }
function isProductionAdminPasswordAllowed(value = ADMIN_PW) { if (!isProductionRuntime()) return true; return isConfiguredSecret(value) && String(value).trim().length >= PRODUCTION_PASSWORD_MIN_LENGTH; }
function isConfiguredSecret(value) { return typeof value === 'string' && value.trim().length > 0; }
function timingSafeCredentialEqual(actual, expected) { if (!isConfiguredSecret(expected) || typeof actual !== 'string') return false; const actualHash = crypto.createHash('sha256').update(actual, 'utf8').digest(); const expectedHash = crypto.createHash('sha256').update(expected, 'utf8').digest(); return crypto.timingSafeEqual(actualHash, expectedHash); }
function auditActorFromReq(req) { return { kind: 'public', userId: '', username: '', role: 'register', ip: getClientIp(req) }; }
function createRegisterLimitKey(req, username, signupCode) {
  const ip = getClientIp(req);
  const normalizedUsername = String(username || '').trim().toLowerCase().slice(0, 80);
  const normalizedCode = String(signupCode || '').trim().toUpperCase().replace(/[\s-]+/g, '');
  const codeDigest = normalizedCode ? crypto.createHash('sha256').update(normalizedCode, 'utf8').digest('hex').slice(0, 16) : 'no-code';
  return ['register', ip, normalizedUsername || 'no-user', codeDigest].join(':');
}
function appendAudit(auditLogService, req, eventType, target = {}, details = {}) { if (!auditLogService || typeof auditLogService.appendEvent !== 'function') return null; return auditLogService.appendEvent(eventType, { actor: auditActorFromReq(req), target, details }); }
function sendRegisterError(res, auditLogService, req, err, username) { const status = Math.max(400, Math.min(500, Number(err && err.statusCode) || 400)); const code = err && err.code || 'REGISTER_FAILED'; appendAudit(auditLogService, req, 'auth.register.failed', { username: String(username || '').trim().toLowerCase() }, { code, status }); if (code === 'USER_EXISTS' || code === 'INVALID_SIGNUP_CODE') return res.status(status).json({ ok:false, success:false, error:'register_failed', message:'회원가입 정보를 확인하세요.' }); return res.status(status).json({ ok:false, success:false, error:'register_failed', message: err && err.message || '회원가입에 실패했습니다.' }); }
function createAuthRouter(options = {}) {
  const { sessionStore, loginLimiter, loginIpLimiter, registerLimiter, registerIpLimiter, requireSameOrigin, requireCsrf, setNoStore, accountService, signupCodeService, auditLogService } = options;
  if (!sessionStore || !loginLimiter || !requireSameOrigin || !requireCsrf || !setNoStore || !accountService) throw new Error('createAuthRouter requires session/auth/account dependencies');
  const router = express.Router();

  router.post('/register', requireSameOrigin, (req, res) => {
    setNoStore(res);
    if (!signupCodeService || typeof signupCodeService.consumeCodeForRegistration !== 'function') return res.status(503).json({ ok:false, success:false, error:'register_unavailable', message:'회원가입 기능이 준비되지 않았습니다.' });
    const body = req.body || {};
    const username = body.username || body.id || '';
    const password = body.password || '';
    const passwordConfirm = body.passwordConfirm || body.confirmPassword || '';
    const signupCode = body.signupCode || body.code || '';
    const ip = getClientIp(req);
    if (registerIpLimiter && !registerIpLimiter.check(ip, 'all-register')) return res.status(429).json({ ok:false, success:false, error:'too_many_register_attempts', message:'Too many registration attempts. Try again later.' });
    const limiter = registerLimiter || loginLimiter;
    const limitKey = createRegisterLimitKey(req, username, signupCode);
    if (limiter && !limiter.check(limitKey)) return res.status(429).json({ ok:false, success:false, error:'too_many_register_attempts', message:'회원가입 시도가 너무 많습니다. 15분 후 재시도하세요.' });
    try {
      if (passwordConfirm && password !== passwordConfirm) {
        const err = new Error('비밀번호 확인이 일치하지 않습니다.');
        err.statusCode = 400;
        err.code = 'PASSWORD_CONFIRM_MISMATCH';
        throw err;
      }
      const consumed = signupCodeService.consumeCodeForRegistration(signupCode, (code) => {
        let createdUser = null;
        accountService.createUser({ username, password, enabled: code.defaultEnabled !== false, libraryAccess: code.libraryAccess || { mode:'none', folders:[] }, folderMutationAccess: code.folderMutationAccess || {}, appPermissions: code.appPermissions || {} }, (err, user) => {
          if (err) throw err;
          createdUser = user;
        });
        return createdUser;
      }, (err) => { if (err) throw err; });
      const code = consumed.code;
      const created = consumed.user;
      if (limiter && typeof limiter.reset === 'function') limiter.reset(limitKey);
      appendAudit(auditLogService, req, 'auth.register.success', { userId: created.id, username: created.username }, { codeId: code.id, accessMode: code.libraryAccess && code.libraryAccess.mode, folderCount: Array.isArray(code.libraryAccess && code.libraryAccess.folders) ? code.libraryAccess.folders.length : 0, moveFolderPermissionCount: Array.isArray(code.folderMutationAccess && code.folderMutationAccess.moveFolders) ? code.folderMutationAccess.moveFolders.length : 0, deleteFolderPermissionCount: Array.isArray(code.folderMutationAccess && code.folderMutationAccess.deleteFolders) ? code.folderMutationAccess.deleteFolders.length : 0, fullSearch: !code.appPermissions || code.appPermissions.fullSearch !== false });
      return res.status(201).json({ ok:true, success:true, pass:TXT_READER_MULTI_REGISTER_ROUTE_PASS, message:'가입이 완료되었습니다. 로그인해 주세요.', user:{ id:created.id, username:created.username, enabled:created.enabled !== false } });
    } catch (err) {
      return sendRegisterError(res, auditLogService, req, err, username);
    }
  });

  router.post('/login', requireSameOrigin, (req, res) => {
    setNoStore(res);
    if (!hasConfiguredAdminCredentials()) { console.error('login blocked: admin credentials are not configured', AUTH_CONFIG_FAIL_CLOSED_PASS); return res.status(503).json({ success: false, message: 'login is not configured' }); }
    if (!isProductionAdminPasswordAllowed()) { console.error('login blocked: production admin password is shorter than policy minimum', PRODUCTION_PASSWORD_POLICY_PASS); return res.status(503).json({ success: false, message: `운영 모드 LOGINPW는 최소 ${PRODUCTION_PASSWORD_MIN_LENGTH}글자 이상이어야 합니다.` }); }
    if (isProductionRuntime() && !isRequestSecure(req)) {
      const diagnostic = createProductionHttpsDiagnostic(req);
      console.error('login blocked: production secure session cookie requires HTTPS', diagnostic);
      return res.status(503).json({
        success: false,
        error: 'production_https_required',
        message: '운영 모드에서는 HTTPS 접속이 필요합니다. HTTP로 접속하면 Secure 세션 쿠키가 브라우저에 저장되지 않아 owner 콘솔로 이동할 수 없습니다. HTTPS로 접속하거나, 내부망 HTTP 운영이면 NODE_ENV=production을 끄고 다시 시작하세요.',
        diagnostic
      });
    }
    const ip = getClientIp(req);
    const { id, pw } = req.body || {};
    if (loginIpLimiter && !loginIpLimiter.check(ip, 'all-login')) return res.status(429).json({ success: false, message: 'Too many login attempts. Try again later.', pass: TXT_READER_MULTI_AUTH_IP_LIMIT_PASS });
    if (!loginLimiter.check(ip, id)) return res.status(429).json({ success: false, message: '로그인 시도가 너무 많습니다. 15분 후 재시도하세요.' });
    const isOwnerLogin = timingSafeCredentialEqual(id, ADMIN_ID) && timingSafeCredentialEqual(pw, ADMIN_PW);
    let sessionMeta = null;
    let redirectTo = '/site.html';
    if (isOwnerLogin) {
      sessionMeta = { kind: OWNER_SESSION_KIND, userId: '__owner__', role: 'owner', sessionVersion: 1, pass: TXT_READER_MULTI_OWNER_CONSOLE_PASS };
      redirectTo = '/admin/users.html';
    } else {
      const user = accountService.authenticateUser(id, pw);
      if (!user) return res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 틀렸습니다.' });
      if (typeof accountService.recordSuccessfulLogin === 'function') accountService.recordSuccessfulLogin(user.id, () => {});
      sessionMeta = { kind: USER_SESSION_KIND, userId: user.id, username: user.username, role: 'reader', sessionVersion: user.sessionVersion || 1, libraryAccess: user.libraryAccess || { mode: 'none', folders: [] }, appPermissions: user.appPermissions || { fullSearch: true } };
    }
    loginLimiter.reset(ip, id);
    const token = sessionStore.createSession(sessionMeta);
    const csrfToken = sessionStore.issueCsrfToken(token);
    res.setHeader('Set-Cookie', createSessionCookie(token, 604800));
    return res.json({ success: true, csrfToken, sessionKind: sessionMeta.kind, userId: sessionMeta.userId, redirectTo, sessionVerifyPass: LOGIN_SESSION_VERIFY_PASS });
  });
  router.post('/account/password', requireSameOrigin, requireCsrf, (req, res) => {
    setNoStore(res);
    const token = getSessionTokenFromReq(req);
    const session = sessionStore.getSession ? sessionStore.getSession(token) : null;
    if (!session || session.kind !== USER_SESSION_KIND) return res.status(403).json({ ok:false, error:'user_session_required', message:'일반 사용자 세션이 필요합니다.' });
    const body = req.body || {};
    if (body.newPasswordConfirm && body.newPassword !== body.newPasswordConfirm) return res.status(400).json({ ok:false, error:'PASSWORD_CONFIRM_MISMATCH', message:'새 비밀번호 확인이 일치하지 않습니다.' });
    accountService.changePassword(session.userId, body.currentPassword, body.newPassword, (err, user) => {
      if (err) {
        appendAudit(auditLogService, req, 'auth.password_change.failed', { userId:session.userId, username:session.username || '' }, { code:err.code || 'PASSWORD_CHANGE_FAILED', status:err.statusCode || 400 });
        return res.status(Math.max(400, Math.min(500, Number(err.statusCode) || 400))).json({ ok:false, error:err.code || 'PASSWORD_CHANGE_FAILED', message:err.message || '비밀번호 변경에 실패했습니다.' });
      }
      if (typeof sessionStore.updateSession === 'function') sessionStore.updateSession(token, { sessionVersion:user.sessionVersion, username:user.username });
      appendAudit(auditLogService, req, 'auth.password_change.success', { userId:user.id, username:user.username }, { sessionVersion:user.sessionVersion, currentSessionKept:true, otherSessionsRevoked:true });
      return res.json({ ok:true, pass:TXT_READER_MULTI_SELF_PASSWORD_CHANGE_PASS, user:{ id:user.id, username:user.username, sessionVersion:user.sessionVersion, lastPasswordChangedAt:user.lastPasswordChangedAt }, sessionPolicy:{ currentSessionKept:true, otherSessionsRevoked:true } });
    });
  });

  router.post('/logout', requireSameOrigin, requireCsrf, (req, res) => { setNoStore(res); const token = getSessionTokenFromReq(req); if (token) { sessionStore.deleteSession(token); sessionStore.deleteCsrfToken(token); } res.setHeader('Set-Cookie', createSessionClearCookies()); return res.json({ success: true }); });
  router.get('/csrf', (req, res) => { setNoStore(res); const token = getSessionTokenFromReq(req); if (!token || !sessionStore.validateSession(token)) return res.status(401).json({ error: '로그인이 필요합니다.' }); const csrfToken = sessionStore.issueCsrfToken(token); return res.json({ csrfToken }); });
  return router;
}
module.exports = { AUTH_CONFIG_FAIL_CLOSED_PASS, PRODUCTION_PASSWORD_POLICY_PASS, LOGIN_PRODUCTION_HTTPS_DIAGNOSTIC_PASS, CLOUDFLARE_VISITOR_HTTPS_TRUST_PASS, LOGIN_SESSION_VERIFY_PASS, TXT_READER_MULTI_REGISTER_ROUTE_PASS, TXT_READER_MULTI_SELF_PASSWORD_CHANGE_PASS, OWNER_PASSWORD_MIN_LENGTH_ENV_PASS, TXT_READER_MULTI_AUTH_IP_LIMIT_PASS, PRODUCTION_PASSWORD_MIN_LENGTH, createCookieHeader, createSessionCookie, createSessionClearCookies, createAuthRouter, hasConfiguredAdminCredentials, isProductionAdminPasswordAllowed, getForwardedProto, getCloudflareVisitorScheme, isCloudflareVisitorHttps, isRequestSecure, createProductionHttpsDiagnostic, timingSafeCredentialEqual };
