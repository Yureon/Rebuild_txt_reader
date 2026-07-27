const { createAsyncSafeRouter, getPublicApiError } = require('../utils/async-route');
const { getSessionTokenFromReq } = require('../middleware/auth');
const { OWNER_SESSION_KIND } = require('../services/account-service');
const { TXT_READER_MULTI_SITE_LANGUAGE_SERVICE_PASS } = require('../services/site-language-service');

function ownerOnlyFromSessionStore(sessionStore) {
  return function ownerOnly(req, res, next) {
    const token = getSessionTokenFromReq(req);
    const session = sessionStore && sessionStore.getSession ? sessionStore.getSession(token) : null;
    if (!session || session.kind !== OWNER_SESSION_KIND) return res.status(403).json({ ok:false, error:'owner_session_required' });
    req.ownerSession = session;
    return next();
  };
}

function auditActorFromRequest(req) {
  return req && req.ownerSession ? { kind:req.ownerSession.kind, userId:req.ownerSession.userId, role:req.ownerSession.role || 'owner' } : { kind:'owner' };
}

function appendAudit(auditLogService, req, type, target = {}, details = {}) {
  if (!auditLogService || typeof auditLogService.appendEvent !== 'function') return { ok:false, skipped:true };
  return auditLogService.appendEvent(type, { actor:auditActorFromRequest(req), target, details });
}

function sendError(res, err, fallbackMessage) {
  const publicError = getPublicApiError(err, {
    fallbackCode:'site_language_error',
    fallbackMessage:fallbackMessage || 'site language request failed'
  });
  if (publicError.status >= 500) console.error(err);
  return res.status(publicError.status).json({ ok:false, error:publicError.error, message:publicError.message });
}

function createSiteLanguageRouter(options = {}) {
  const { sessionStore, siteLanguageService, setNoStore, requireSameOrigin, requireCsrf, auditLogService } = options;
  if (!sessionStore || !siteLanguageService || !setNoStore || !requireSameOrigin || !requireCsrf) throw new Error('createSiteLanguageRouter requires sessionStore/siteLanguageService/setNoStore/requireSameOrigin/requireCsrf');
  const router = createAsyncSafeRouter();
  const ownerOnly = ownerOnlyFromSessionStore(sessionStore);
  const requireAsync = (name) => {
    if (!siteLanguageService || typeof siteLanguageService[name] !== 'function') {
      const error = new Error(`siteLanguageService.${name} is required for production routes`);
      error.code = 'SITE_LANGUAGE_ASYNC_SERVICE_REQUIRED';
      throw error;
    }
    return siteLanguageService[name].bind(siteLanguageService);
  };
  const listPublicLanguagesAsync = requireAsync('listPublicLanguagesAsync');
  const listLanguagesAsync = requireAsync('listLanguagesAsync');
  const saveLanguageAsync = requireAsync('saveLanguageAsync');
  const deleteLanguageAsync = requireAsync('deleteLanguageAsync');

  router.get('/site-languages', async (req, res) => {
    setNoStore(res);
    try {
      return res.json({ ok:true, pass:TXT_READER_MULTI_SITE_LANGUAGE_SERVICE_PASS, languages:await listPublicLanguagesAsync() });
    } catch (err) {
      return sendError(res, err, 'site language list failed');
    }
  });

  router.get('/admin/site-languages', ownerOnly, async (req, res) => {
    setNoStore(res);
    try {
      return res.json({ ok:true, pass:TXT_READER_MULTI_SITE_LANGUAGE_SERVICE_PASS, languages:await listLanguagesAsync({ includeDisabled:true }) });
    } catch (err) {
      return sendError(res, err, 'admin site language list failed');
    }
  });

  router.post('/admin/site-languages', ownerOnly, requireSameOrigin, requireCsrf, async (req, res) => {
    setNoStore(res);
    try {
      const payload = await saveLanguageAsync(req.body || {});
      const lang = payload && payload.language;
      appendAudit(auditLogService, req, 'admin.site_language.save', { languageId:lang && lang.id, name:lang && lang.name }, { enabled:lang && lang.enabled, entryCount:lang && lang.map ? Object.keys(lang.map).length : 0 });
      return res.status(201).json(payload);
    } catch (error) { return sendError(res, error, 'admin site language save failed'); }
  });

  router.patch('/admin/site-languages/:languageId', ownerOnly, requireSameOrigin, requireCsrf, async (req, res) => {
    setNoStore(res);
    try {
      const input = { ...(req.body || {}), id:req.params.languageId };
      const payload = await saveLanguageAsync(input);
      const lang = payload && payload.language;
      appendAudit(auditLogService, req, 'admin.site_language.update', { languageId:lang && lang.id, name:lang && lang.name }, { enabled:lang && lang.enabled, entryCount:lang && lang.map ? Object.keys(lang.map).length : 0 });
      return res.json(payload);
    } catch (error) { return sendError(res, error, 'admin site language update failed'); }
  });

  router.delete('/admin/site-languages/:languageId', ownerOnly, requireSameOrigin, requireCsrf, async (req, res) => {
    setNoStore(res);
    try {
      const payload = await deleteLanguageAsync(req.params.languageId);
      const lang = payload && payload.deletedLanguage;
      appendAudit(auditLogService, req, 'admin.site_language.delete', { languageId:lang && lang.id, name:lang && lang.name }, { entryCount:lang && lang.map ? Object.keys(lang.map).length : 0 });
      return res.json(payload);
    } catch (error) { return sendError(res, error, 'admin site language delete failed'); }
  });

  return router;
}

module.exports = { createSiteLanguageRouter };
