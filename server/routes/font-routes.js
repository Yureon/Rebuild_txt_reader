const fs = require('fs');
const { pipeline } = require('stream/promises');
const express = require('express');
const { createAsyncSafeRouter, getPublicApiError } = require('../utils/async-route');

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
  const router = createAsyncSafeRouter();

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
  function sendFontError(res, error, compact = false) { const publicError = getPublicApiError(error, { fallbackCode:'font_error', fallbackMessage:'font request failed' }); if (publicError.status >= 500) console.error(error); if (compact) return res.status(publicError.status).json({ error:publicError.error, message:publicError.message }); return res.status(publicError.status).json({ success:false, error:publicError.error, message:publicError.message }); }

  function appendVaryCookie(res) {
    const current = String(res.getHeader('Vary') || '').split(',').map(value => value.trim()).filter(Boolean);
    if (!current.some(value => value.toLowerCase() === 'cookie') && !current.includes('*')) current.push('Cookie');
    if (current.length) res.setHeader('Vary', current.join(', '));
  }

  function requestNotModified(req, stat, etag) {
    const inm = String(req.get('if-none-match') || '').trim();
    if (inm) return inm.split(',').map(value => value.trim()).some(value => value === '*' || value === etag);
    const ims = Date.parse(String(req.get('if-modified-since') || ''));
    return Number.isFinite(ims) && Math.floor(Number(stat.mtimeMs) / 1000) <= Math.floor(ims / 1000);
  }

  router.get('/fonts', requireFontSession, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try { return res.json(fontService.getFontListResponseAsync ? await fontService.getFontListResponseAsync(req.fontScope) : fontService.getFontListResponse(req.fontScope)); }
    catch (error) { return sendFontError(res, error); }
  });
  router.post('/fonts/upload', requireFontSession, requireSameOrigin, requireCsrf, express.raw({ type: 'application/octet-stream', limit: '8mb' }), async (req, res) => {
    try {
      if (!checkApiWriteLimit(req, 'font-upload:' + String(req.fontScope && req.fontScope.ownerId || 'unknown'), 12, 10 * 60 * 1000)) return res.status(429).json({ success:false, error:'too many font uploads' });
      if (typeof fontService.uploadFontAsync !== 'function') throw new Error('font async mutation service is required');
      const result = await fontService.uploadFontAsync({ scope:req.fontScope, rawFilename:req.headers['x-font-filename'], rawFamily:req.headers['x-font-family'], bodyBuffer:req.body });
      appendAudit(req, 'font.upload', { filename:result.filename, family:result.family, ownerId:req.fontScope && req.fontScope.ownerId }, { size:result.size, userScoped:!!(result.scope && result.scope.userScoped) });
      return res.json({ ...result, uploadPass: TXT_READER_MULTI_USER_FONT_UPLOAD_PASS });
    } catch (error) { return sendFontError(res, error); }
  });
  router.delete('/fonts/:filename', requireFontSession, requireSameOrigin, requireCsrf, async (req, res) => {
    try { if (typeof fontService.deleteFontAsync !== 'function') throw new Error('font async mutation service is required'); const result = await fontService.deleteFontAsync(req.params.filename, req.fontScope); appendAudit(req, 'font.delete', { filename:req.params.filename, ownerId:req.fontScope && req.fontScope.ownerId }, { success:!!(result && result.success), userScoped:!!(result.scope && result.scope.userScoped) }); return res.json(result); }
    catch (error) { return sendFontError(res, error); }
  });
  router.get('/fonts/file/:filename', requireFontSession, async (req, res) => {
    try {
      const fontFile = fontService.getFontFileForResponseAsync ? await fontService.getFontFileForResponseAsync(req.params.filename, req.fontScope) : fontService.getFontFileForResponse(req.params.filename, req.fontScope);
      const stat = fontFile.stat || await fs.promises.stat(fontFile.filePath);
      if (!stat.isFile()) { await fontFile.handle?.close?.(); return res.status(404).json({ error:'font_not_found', message:'font file not found' }); }
      const etag = `W/"${Number(stat.size).toString(16)}-${Math.trunc(Number(stat.mtimeMs) || 0).toString(16)}"`;
      res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
      appendVaryCookie(res);
      res.setHeader('ETag', etag);
      res.setHeader('Last-Modified', stat.mtime.toUTCString());
      res.setHeader('Content-Length', String(stat.size));
      res.setHeader('Content-Disposition', 'inline; filename="' + fontFile.filename.replace(/"/g, '') + '"');
      res.setHeader('X-Font-Scope-Pass', TXT_READER_MULTI_USER_FONT_LIBRARY_SCOPE_PASS);
      res.setHeader('X-Font-NoFollow-Pass', fontFile.noFollowPass || 'legacy-path');
      res.setHeader('X-Txt-Reader-Asset', 'user-font-v675');
      if (requestNotModified(req, stat, etag)) { await fontFile.handle?.close?.(); return res.status(304).end(); }
      res.type(fontFile.mimeType);
      if (req.method === 'HEAD') { await fontFile.handle?.close?.(); return res.status(200).end(); }
      res.status(200);
      try {
        const stream = fontFile.handle?.createReadStream ? fontFile.handle.createReadStream({ autoClose:false }) : fs.createReadStream(fontFile.filePath);
        await pipeline(stream, res);
      } finally {
        await fontFile.handle?.close?.().catch?.(() => {});
      }
      return undefined;
    } catch (error) {
      if (res.headersSent) { res.destroy(error); return undefined; }
      return sendFontError(res, error, true);
    }
  });
  return router;
}

module.exports = { TXT_READER_MULTI_USER_FONT_LIBRARY_SCOPE_PASS, TXT_READER_MULTI_USER_FONT_UPLOAD_PASS, TXT_READER_MULTI_FONT_UPLOAD_BODY_LIMIT_PASS, createFontRouter };
