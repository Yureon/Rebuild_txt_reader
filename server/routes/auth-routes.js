const { createAsyncSafeRouter } = require('../utils/async-route');
const crypto = require('crypto');
const { ADMIN_ID, ADMIN_PW, OWNER_PASSWORD_MIN_LENGTH, isKnownInsecureSecret } = require('../config/env');
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
const TXT_READER_MULTI_PASSWORD_CHANGE_LIMIT_PASS = 'v622-password-change-rate-limit-pass';
const PRODUCTION_PASSWORD_MIN_LENGTH = OWNER_PASSWORD_MIN_LENGTH;
function isProductionRuntime() { return process.env.NODE_ENV === 'production'; }
function getForwardedProto(req) {
  const raw = String(req && req.get && req.get('x-forwarded-proto') || '').trim().toLowerCase();
  return raw.split(',')[0].trim();
}
function deploymentMode() { return String(process.env.DEPLOYMENT_MODE || 'direct').trim().toLowerCase(); }
function isCloudflareTunnelMode() { return deploymentMode() === 'cloudflare-tunnel'; }
function isTrustedProxyMode() { return deploymentMode() !== 'direct'; }

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
  if (isTrustedProxyMode() && getForwardedProto(req) === 'https') return true;
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
function isProductionAdminPasswordAllowed(value = ADMIN_PW) { if (!isProductionRuntime()) return true; return isConfiguredSecret(value) && String(value).trim().length >= PRODUCTION_PASSWORD_MIN_LENGTH && !isKnownInsecureSecret(value); }
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
function sendRegisterError(res, auditLogService, req, err, username) { const status = Math.max(400, Math.min(500, Number(err && err.statusCode) || 400)); const code = err && err.code || 'REGISTER_FAILED'; appendAudit(auditLogService, req, 'auth.register.failed', { username: String(username || '').trim().toLowerCase() }, { code, status }); if (status >= 500) { console.error(err); return res.status(status).json({ ok:false, success:false, error:'internal_server_error', message:'회원가입 처리 중 서버 오류가 발생했습니다.' }); } if (code === 'USER_EXISTS' || code === 'INVALID_SIGNUP_CODE') return res.status(status).json({ ok:false, success:false, error:'register_failed', message:'회원가입 정보를 확인하세요.' }); return res.status(status).json({ ok:false, success:false, error:'register_failed', message: err && err.message || '회원가입에 실패했습니다.' }); }
function createAuthRouter(options = {}) {
  const { sessionStore, loginLimiter, loginIpLimiter, registerLimiter, registerIpLimiter, passwordChangeLimiter, passwordChangeIpLimiter, requireSameOrigin, requireCsrf, setNoStore, accountService, signupCodeService, auditLogService } = options;
  if (!sessionStore || !loginLimiter || !requireSameOrigin || !requireCsrf || !setNoStore || !accountService) throw new Error('createAuthRouter requires session/auth/account dependencies');
  const router = createAsyncSafeRouter();

  router.post('/register', requireSameOrigin, async (req, res) => {
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
      const createUser = async (code) => {
        const input = { username, password, enabled:code.defaultEnabled !== false, libraryAccess:code.libraryAccess || { mode:'none', folders:[] }, folderMutationAccess:code.folderMutationAccess || {}, appPermissions:code.appPermissions || {} };
        if (typeof accountService.createUserAsync === 'function') return accountService.createUserAsync(input);
        return new Promise((resolve, reject) => accountService.createUser(input, (error, user) => error ? reject(error) : resolve(user)));
      };
      const consumed = typeof signupCodeService.consumeCodeForRegistrationAsync === 'function'
        ? await signupCodeService.consumeCodeForRegistrationAsync(signupCode, createUser)
        : signupCodeService.consumeCodeForRegistration(signupCode, (code) => {
            const input = { username, password, enabled:code.defaultEnabled !== false, libraryAccess:code.libraryAccess || { mode:'none', folders:[] }, folderMutationAccess:code.folderMutationAccess || {}, appPermissions:code.appPermissions || {} };
            let createError = null;
            const createdUser = accountService.createUser(input, (error) => { createError = error || null; });
            if (createError) throw createError;
            if (!createdUser) throw Object.assign(new Error('사용자 생성 결과가 비어 있습니다.'), { code:'REGISTER_USER_CREATE_EMPTY', statusCode:500 });
            return createdUser;
          }, (error) => { if (error) throw error; });
      const code = consumed.code;
      const created = consumed.user;
      if (limiter && typeof limiter.reset === 'function') limiter.reset(limitKey);
      if (registerIpLimiter && typeof registerIpLimiter.reset === 'function') registerIpLimiter.reset(ip, 'all-register');
      appendAudit(auditLogService, req, 'auth.register.success', { userId: created.id, username: created.username }, { codeId: code.id, accessMode: code.libraryAccess && code.libraryAccess.mode, folderCount: Array.isArray(code.libraryAccess && code.libraryAccess.folders) ? code.libraryAccess.folders.length : 0, moveFolderPermissionCount: Array.isArray(code.folderMutationAccess && code.folderMutationAccess.moveFolders) ? code.folderMutationAccess.moveFolders.length : 0, deleteFolderPermissionCount: Array.isArray(code.folderMutationAccess && code.folderMutationAccess.deleteFolders) ? code.folderMutationAccess.deleteFolders.length : 0, fullSearch: !code.appPermissions || code.appPermissions.fullSearch !== false, metadataAccess: !!(code.appPermissions && code.appPermissions.metadataAccess === true) });
      return res.status(201).json({ ok:true, success:true, pass:TXT_READER_MULTI_REGISTER_ROUTE_PASS, message:'가입이 완료되었습니다. 로그인해 주세요.', user:{ id:created.id, username:created.username, enabled:created.enabled !== false } });
    } catch (err) {
      return sendRegisterError(res, auditLogService, req, err, username);
    }
  });

  router.post('/login', requireSameOrigin, async (req, res) => {
    setNoStore(res);
    if (!hasConfiguredAdminCredentials()) { console.error('login blocked: admin credentials are not configured', AUTH_CONFIG_FAIL_CLOSED_PASS); return res.status(503).json({ success: false, message: 'login is not configured' }); }
    if (!isProductionAdminPasswordAllowed()) { console.error('login blocked: production admin password is shorter than policy minimum', PRODUCTION_PASSWORD_POLICY_PASS); return res.status(503).json({ success: false, message: `운영 모드 LOGINPW는 공개 예제 값이 아니면서 최소 ${PRODUCTION_PASSWORD_MIN_LENGTH}글자 이상이어야 합니다.` }); }
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
    let redirectTo = `/library-${BUILD_ID}.html`;
    if (isOwnerLogin) {
      sessionMeta = { kind: OWNER_SESSION_KIND, userId: '__owner__', role: 'owner', sessionVersion: 1, pass: TXT_READER_MULTI_OWNER_CONSOLE_PASS };
      redirectTo = `/admin/users-${BUILD_ID}.html`;
    } else {
      const user = typeof accountService.authenticateUserAsync === 'function'
        ? await accountService.authenticateUserAsync(id, pw)
        : accountService.authenticateUser(id, pw);
      if (!user) return res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 틀렸습니다.' });
      if (typeof accountService.recordSuccessfulLoginAsync === 'function') {
        accountService.recordSuccessfulLoginAsync(user.id).catch((telemetryError) => {
          console.warn('successful login telemetry persistence failed:', telemetryError && telemetryError.message || telemetryError);
          appendAudit(auditLogService, req, 'auth.login.telemetry_persistence_failed', { userId:user.id, username:user.username }, { code:telemetryError && telemetryError.code || 'LOGIN_TELEMETRY_PERSIST_FAILED' });
        });
      } else if (typeof accountService.recordSuccessfulLogin === 'function') {
        accountService.recordSuccessfulLogin(user.id, (telemetryError) => {
          if (!telemetryError) return;
          console.warn('successful login telemetry persistence failed:', telemetryError && telemetryError.message || telemetryError);
          appendAudit(auditLogService, req, 'auth.login.telemetry_persistence_failed', { userId:user.id, username:user.username }, { code:telemetryError && telemetryError.code || 'LOGIN_TELEMETRY_PERSIST_FAILED' });
        });
      }
      sessionMeta = { kind: USER_SESSION_KIND, userId: user.id, username: user.username, role: 'reader', sessionVersion: user.sessionVersion || 1, libraryAccess: user.libraryAccess || { mode: 'none', folders: [] }, appPermissions: user.appPermissions || { fullSearch: true, metadataAccess: false } };
    }
    loginLimiter.reset(ip, id);
    if (loginIpLimiter && typeof loginIpLimiter.reset === 'function') loginIpLimiter.reset(ip, 'all-login');
    const token = sessionStore.createSession(sessionMeta);
    const csrfToken = sessionStore.issueCsrfToken(token);
    try {
      const persisted = typeof sessionStore.flush === 'function' ? await sessionStore.flush() : { ok:true };
      if (persisted && persisted.ok === false) throw Object.assign(new Error(persisted.error || 'session store save failed'), { code:'SESSION_STORE_LOGIN_PERSIST_FAILED' });
    } catch (error) {
      try { sessionStore.deleteSession(token); } catch (_cleanupError) {}
      res.setHeader('Set-Cookie', createSessionClearCookies());
      appendAudit(auditLogService, req, 'auth.login.persistence_failed', { userId:sessionMeta.userId, username:sessionMeta.username || '' }, { code:error && error.code || 'SESSION_STORE_LOGIN_PERSIST_FAILED' });
      return res.status(503).json({ success:false, error:'session_persistence_failed', message:'세션 저장에 실패했습니다. 서버 저장소 상태를 확인한 뒤 다시 로그인하세요.' });
    }
    res.setHeader('Set-Cookie', createSessionCookie(token, 604800));
    return res.json({ success: true, csrfToken, sessionKind: sessionMeta.kind, userId: sessionMeta.userId, redirectTo, sessionVerifyPass: LOGIN_SESSION_VERIFY_PASS });
  });
  router.post('/account/password', requireSameOrigin, requireCsrf, async (req, res) => {
    setNoStore(res);
    const token = getSessionTokenFromReq(req);
    const session = sessionStore.getSession ? sessionStore.getSession(token) : null;
    if (!session || session.kind !== USER_SESSION_KIND) return res.status(403).json({ ok:false, error:'user_session_required', message:'일반 사용자 세션이 필요합니다.' });
    const body = req.body || {};
    const passwordIp = getClientIp(req);
    const passwordIdentity = String(session.userId || session.username || 'unknown');
    if (passwordChangeIpLimiter && !passwordChangeIpLimiter.check(passwordIp, 'all-password-change')) {
      appendAudit(auditLogService, req, 'auth.password_change.rate_limited', { userId:session.userId, username:session.username || '' }, { scope:'ip', pass:TXT_READER_MULTI_PASSWORD_CHANGE_LIMIT_PASS });
      return res.status(429).json({ ok:false, error:'PASSWORD_CHANGE_RATE_LIMITED', message:'비밀번호 변경 요청이 너무 많습니다. 잠시 후 다시 시도하세요.', pass:TXT_READER_MULTI_PASSWORD_CHANGE_LIMIT_PASS });
    }
    if (passwordChangeLimiter && !passwordChangeLimiter.check(passwordIp, passwordIdentity)) {
      appendAudit(auditLogService, req, 'auth.password_change.rate_limited', { userId:session.userId, username:session.username || '' }, { scope:'user', pass:TXT_READER_MULTI_PASSWORD_CHANGE_LIMIT_PASS });
      return res.status(429).json({ ok:false, error:'PASSWORD_CHANGE_RATE_LIMITED', message:'비밀번호 변경 요청이 너무 많습니다. 15분 후 다시 시도하세요.', pass:TXT_READER_MULTI_PASSWORD_CHANGE_LIMIT_PASS });
    }
    if (body.newPasswordConfirm && body.newPassword !== body.newPasswordConfirm) return res.status(400).json({ ok:false, error:'PASSWORD_CONFIRM_MISMATCH', message:'새 비밀번호 확인이 일치하지 않습니다.' });
    const done = async (err, user) => {
      if (err) {
        const status = Math.max(400, Math.min(500, Number(err.statusCode) || 400));
        appendAudit(auditLogService, req, 'auth.password_change.failed', { userId:session.userId, username:session.username || '' }, { code:err.code || 'PASSWORD_CHANGE_FAILED', status });
        if (status >= 500) {
          console.error(err);
          return res.status(status).json({ ok:false, error:'internal_server_error', message:'비밀번호 변경 처리 중 서버 오류가 발생했습니다.' });
        }
        return res.status(status).json({ ok:false, error:err.code || 'PASSWORD_CHANGE_FAILED', message:err.message || '비밀번호 변경에 실패했습니다.' });
      }
      try {
        if (typeof sessionStore.updateSessionDurably === 'function') {
          await sessionStore.updateSessionDurably(token, { sessionVersion:user.sessionVersion, username:user.username });
        } else {
          if (typeof sessionStore.updateSession === 'function') sessionStore.updateSession(token, { sessionVersion:user.sessionVersion, username:user.username });
          const persisted = typeof sessionStore.flush === 'function' ? await sessionStore.flush() : { ok:true };
          if (persisted && persisted.ok === false) throw Object.assign(new Error(persisted.error || 'session store save failed'), { code:'SESSION_STORE_PASSWORD_CHANGE_PERSIST_FAILED' });
        }
      } catch (persistError) {
        appendAudit(auditLogService, req, 'auth.password_change.session_persistence_failed', { userId:user.id, username:user.username }, { code:persistError.code || 'SESSION_STORE_PASSWORD_CHANGE_PERSIST_FAILED', currentSessionKept:false });
        return res.status(503).json({ ok:false, error:'session_persistence_failed', message:'비밀번호는 변경되었지만 현재 세션을 안전하게 저장하지 못했습니다. 다시 로그인해 주세요.', sessionPolicy:{ currentSessionKept:false, otherSessionsRevoked:true } });
      }
      if (passwordChangeLimiter && typeof passwordChangeLimiter.reset === 'function') passwordChangeLimiter.reset(passwordIp, passwordIdentity);
      if (passwordChangeIpLimiter && typeof passwordChangeIpLimiter.reset === 'function') passwordChangeIpLimiter.reset(passwordIp, 'all-password-change');
      appendAudit(auditLogService, req, 'auth.password_change.success', { userId:user.id, username:user.username }, { sessionVersion:user.sessionVersion, currentSessionKept:true, otherSessionsRevoked:true });
      return res.json({ ok:true, pass:TXT_READER_MULTI_SELF_PASSWORD_CHANGE_PASS, user:{ id:user.id, username:user.username, sessionVersion:user.sessionVersion, lastPasswordChangedAt:user.lastPasswordChangedAt }, sessionPolicy:{ currentSessionKept:true, otherSessionsRevoked:true } });
    };
    if (typeof accountService.changePasswordAsync === 'function') {
      try { return await done(null, await accountService.changePasswordAsync(session.userId, body.currentPassword, body.newPassword)); }
      catch (error) { return await done(error); }
    }
    return accountService.changePassword(session.userId, body.currentPassword, body.newPassword, (error, user) => { void done(error, user); });
  });

  router.post('/logout', requireSameOrigin, requireCsrf, async (req, res) => {
    setNoStore(res);
    const token = getSessionTokenFromReq(req);
    try {
      if (token) {
        if (typeof sessionStore.deleteSessionDurably === 'function') await sessionStore.deleteSessionDurably(token);
        else {
          sessionStore.deleteSession(token);
          const result = typeof sessionStore.flush === 'function' ? await sessionStore.flush() : { ok:true };
          if (result && result.ok === false) throw Object.assign(new Error(result.error || 'session store save failed'), { code:'SESSION_STORE_DELETE_PERSIST_FAILED' });
        }
      }
      res.setHeader('Set-Cookie', createSessionClearCookies());
      return res.json({ success:true });
    } catch (error) {
      return res.status(503).json({ success:false, error:error && error.code || 'SESSION_STORE_DELETE_PERSIST_FAILED', message:'로그아웃 세션 저장에 실패했습니다. 현재 세션은 유지됩니다. 서버 상태를 확인한 뒤 다시 시도하십시오.' });
    }
  });
  router.get('/csrf', (req, res) => { setNoStore(res); const token = getSessionTokenFromReq(req); if (!token || !sessionStore.validateSession(token)) return res.status(401).json({ error: '로그인이 필요합니다.' }); const csrfToken = sessionStore.issueCsrfToken(token); return res.json({ csrfToken }); });
  return router;
}
module.exports = { AUTH_CONFIG_FAIL_CLOSED_PASS, PRODUCTION_PASSWORD_POLICY_PASS, LOGIN_PRODUCTION_HTTPS_DIAGNOSTIC_PASS, CLOUDFLARE_VISITOR_HTTPS_TRUST_PASS, LOGIN_SESSION_VERIFY_PASS, TXT_READER_MULTI_REGISTER_ROUTE_PASS, TXT_READER_MULTI_SELF_PASSWORD_CHANGE_PASS, OWNER_PASSWORD_MIN_LENGTH_ENV_PASS, TXT_READER_MULTI_AUTH_IP_LIMIT_PASS, TXT_READER_MULTI_PASSWORD_CHANGE_LIMIT_PASS, PRODUCTION_PASSWORD_MIN_LENGTH, createCookieHeader, createSessionCookie, createSessionClearCookies, createAuthRouter, hasConfiguredAdminCredentials, isProductionAdminPasswordAllowed, getForwardedProto, getCloudflareVisitorScheme, isCloudflareVisitorHttps, isTrustedProxyMode, isRequestSecure, createProductionHttpsDiagnostic, timingSafeCredentialEqual };
const { BUILD_ID } = require('../version-contract');
