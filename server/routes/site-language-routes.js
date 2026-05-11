const express = require('express');
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
  const status = err && Number.isFinite(Number(err.statusCode)) ? Number(err.statusCode) : 500;
  if (status >= 500) console.error(err);
  return res.status(status).json({ ok:false, error:err && err.code || 'site_language_error', message:err && err.message || fallbackMessage || 'site language request failed' });
}

function createSiteLanguageRouter(options = {}) {
  const { sessionStore, siteLanguageService, setNoStore, requireSameOrigin, requireCsrf, auditLogService } = options;
  if (!sessionStore || !siteLanguageService || !setNoStore || !requireSameOrigin || !requireCsrf) throw new Error('createSiteLanguageRouter requires sessionStore/siteLanguageService/setNoStore/requireSameOrigin/requireCsrf');
  const router = express.Router();
  const ownerOnly = ownerOnlyFromSessionStore(sessionStore);

  router.get('/site-languages', (req, res) => {
    setNoStore(res);
    try {
      return res.json({ ok:true, pass:TXT_READER_MULTI_SITE_LANGUAGE_SERVICE_PASS, languages:siteLanguageService.listPublicLanguages() });
    } catch (err) {
      return sendError(res, err, 'site language list failed');
    }
  });

  router.get('/admin/site-languages', ownerOnly, (req, res) => {
    setNoStore(res);
    try {
      return res.json({ ok:true, pass:TXT_READER_MULTI_SITE_LANGUAGE_SERVICE_PASS, languages:siteLanguageService.listLanguages({ includeDisabled:true }) });
    } catch (err) {
      return sendError(res, err, 'admin site language list failed');
    }
  });

  router.post('/admin/site-languages', ownerOnly, requireSameOrigin, requireCsrf, (req, res) => {
    setNoStore(res);
    siteLanguageService.saveLanguage(req.body || {}, (err, payload) => {
      if (err) return sendError(res, err, 'admin site language save failed');
      const lang = payload && payload.language;
      appendAudit(auditLogService, req, 'admin.site_language.save', { languageId:lang && lang.id, name:lang && lang.name }, { enabled:lang && lang.enabled, entryCount:lang && lang.map ? Object.keys(lang.map).length : 0 });
      return res.status(201).json(payload);
    });
  });

  router.patch('/admin/site-languages/:languageId', ownerOnly, requireSameOrigin, requireCsrf, (req, res) => {
    setNoStore(res);
    siteLanguageService.saveLanguage({ ...(req.body || {}), id:req.params.languageId }, (err, payload) => {
      if (err) return sendError(res, err, 'admin site language update failed');
      const lang = payload && payload.language;
      appendAudit(auditLogService, req, 'admin.site_language.update', { languageId:lang && lang.id, name:lang && lang.name }, { enabled:lang && lang.enabled, entryCount:lang && lang.map ? Object.keys(lang.map).length : 0 });
      return res.json(payload);
    });
  });

  router.delete('/admin/site-languages/:languageId', ownerOnly, requireSameOrigin, requireCsrf, (req, res) => {
    setNoStore(res);
    siteLanguageService.deleteLanguage(req.params.languageId, (err, payload) => {
      if (err) return sendError(res, err, 'admin site language delete failed');
      const lang = payload && payload.deletedLanguage;
      appendAudit(auditLogService, req, 'admin.site_language.delete', { languageId:lang && lang.id, name:lang && lang.name }, { entryCount:lang && lang.map ? Object.keys(lang.map).length : 0 });
      return res.json(payload);
    });
  });

  return router;
}

module.exports = { createSiteLanguageRouter };
