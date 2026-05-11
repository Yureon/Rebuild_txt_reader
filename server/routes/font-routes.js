const express = require('express');

const TXT_READER_MULTI_USER_FONT_LIBRARY_SCOPE_PASS = 'v426-user-font-library-scope-pass';
const TXT_READER_MULTI_USER_FONT_UPLOAD_PASS = 'v426-user-font-upload-route-pass';
const TXT_READER_MULTI_FONT_UPLOAD_BODY_LIMIT_PASS = 'v535-font-upload-body-limit-pass';

function createFontRouter({
  fontService,
  requireSameOrigin,
  requireCsrf,
  checkApiWriteLimit,
  sessionStore,
  getSessionTokenFromReq,
  requireOwnerSession,
  auditLogService
} = {}) {
  if (!fontService) throw new Error('fontService is required');
  if (typeof requireSameOrigin !== 'function') throw new Error('requireSameOrigin middleware is required');
  if (typeof requireCsrf !== 'function') throw new Error('requireCsrf middleware is required');
  if (typeof checkApiWriteLimit !== 'function') throw new Error('checkApiWriteLimit is required');
  const router = express.Router();

  function getSessionFromRequest(req) {
    if (req && req.fontSession) return req.fontSession;
    if (!sessionStore || typeof getSessionTokenFromReq !== 'function') return null;
    const token = getSessionTokenFromReq(req);
    if (!token || !sessionStore.validateSession(token) || typeof sessionStore.getSession !== 'function') return null;
    return sessionStore.getSession(token);
  }

  function getFontScopeFromSession(session) {
    if (session && session.kind === 'user') return { ownerId: session.userId, kind: 'user' };
    if (session && session.kind === 'owner') return { ownerId: '__owner__', kind: 'owner' };
    return { ownerId: '__owner__', kind: 'owner' };
  }

  function requireFontSession(req, res, next) {
    const session = getSessionFromRequest(req);
    if (!session || (session.kind !== 'user' && session.kind !== 'owner')) return res.status(401).json({ error: '로그인이 필요합니다.' });
    req.fontSession = session;
    req.fontScope = getFontScopeFromSession(session);
    return next();
  }

  function auditActorFromRequest(req) {
    const session = req && (req.fontSession || req.ownerSession) || getSessionFromRequest(req);
    if (session) return { kind:session.kind || 'user', userId:session.kind === 'owner' ? '__owner__' : String(session.userId || ''), username:session.username || '', role:session.role || (session.kind === 'owner' ? 'owner' : 'reader') };
    return { kind:'unknown', userId:'', role:'unknown' };
  }
  function appendAudit(req, type, target = {}, details = {}) { if (!auditLogService || typeof auditLogService.appendEvent !== 'function') return { ok:false, skipped:true }; return auditLogService.appendEvent(type, { actor:auditActorFromRequest(req), target, details }); }
  function sendFontError(res, error, compact = false) { const status = Number(error && error.status) || 500; const message = error && error.message || 'font error'; if (compact) return res.status(status).json({ error: message }); return res.status(status).json({ success:false, error:message }); }

  router.get('/fonts', requireFontSession, (req, res) => { res.setHeader('Cache-Control', 'no-store'); return res.json(fontService.getFontListResponse(req.fontScope)); });
  router.post('/fonts/upload', requireFontSession, requireSameOrigin, requireCsrf, express.raw({ type: 'application/octet-stream', limit: '8mb' }), (req, res) => {
    try {
      if (!checkApiWriteLimit(req, 'font-upload:' + String(req.fontScope && req.fontScope.ownerId || 'unknown'), 12, 10 * 60 * 1000)) return res.status(429).json({ success:false, error:'too many font uploads' });
      const result = fontService.uploadFont({ scope:req.fontScope, rawFilename:req.headers['x-font-filename'], rawFamily:req.headers['x-font-family'], bodyBuffer:req.body });
      appendAudit(req, 'font.upload', { filename:result.filename, family:result.family, ownerId:req.fontScope && req.fontScope.ownerId }, { size:result.size, userScoped:!!(result.scope && result.scope.userScoped) });
      return res.json({ ...result, uploadPass: TXT_READER_MULTI_USER_FONT_UPLOAD_PASS });
    } catch (error) { return sendFontError(res, error); }
  });
  router.delete('/fonts/:filename', requireFontSession, requireSameOrigin, requireCsrf, (req, res) => {
    try { const result = fontService.deleteFont(req.params.filename, req.fontScope); appendAudit(req, 'font.delete', { filename:req.params.filename, ownerId:req.fontScope && req.fontScope.ownerId }, { success:!!(result && result.success), userScoped:!!(result.scope && result.scope.userScoped) }); return res.json(result); }
    catch (error) { return sendFontError(res, error); }
  });
  router.get('/fonts/file/:filename', requireFontSession, (req, res) => {
    try { const fontFile = fontService.getFontFileForResponse(req.params.filename, req.fontScope); res.setHeader('Cache-Control', 'private, max-age=3600'); res.setHeader('Content-Disposition', 'inline; filename="' + fontFile.filename.replace(/"/g, '') + '"'); res.setHeader('X-Font-Scope-Pass', TXT_READER_MULTI_USER_FONT_LIBRARY_SCOPE_PASS); res.type(fontFile.mimeType); return res.sendFile(fontFile.filePath); }
    catch (error) { return sendFontError(res, error, true); }
  });
  return router;
}

module.exports = { TXT_READER_MULTI_USER_FONT_LIBRARY_SCOPE_PASS, TXT_READER_MULTI_USER_FONT_UPLOAD_PASS, TXT_READER_MULTI_FONT_UPLOAD_BODY_LIMIT_PASS, createFontRouter };
