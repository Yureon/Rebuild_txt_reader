const { createAsyncSafeRouter } = require('../utils/async-route');
const { getSessionTokenFromReq } = require('../middleware/auth');
const { OWNER_SESSION_KIND, USER_SESSION_KIND } = require('../services/account-service');
const { isLibraryRelativePathAllowed } = require('../services/library-access-service');

const FILEOPS_CONFIRMATION_PASS = 'v344-fileops-action-confirmation-pass';
const FOLDER_MUTATION_ACCESS_PASS = 'v493-folder-mutation-access-policy-pass';
const FILEOPS_AUDIT_COMPLETENESS_PASS = 'v661-fileops-audit-completeness-pass';
const FILEOPS_REQUEST_ABORT_PASS = 'v661-fileops-request-abort-pass';
const FILEOPS_CONFIRM_ACTIONS = Object.freeze({
  rename: 'fileops-rename',
  move: 'fileops-move',
  delete: 'fileops-delete'
});


function sendFolderMutationDenied(res, reason) {
  return res.status(403).json({
    ok: false,
    error: 'folder_mutation_access_denied',
    reason: reason || 'permission_denied',
    pass: FOLDER_MUTATION_ACCESS_PASS
  });
}

function getRequestSession(req, sessionStore) {
  if (!sessionStore || typeof sessionStore.getSession !== 'function') return null;
  const token = getSessionTokenFromReq(req);
  return token ? sessionStore.getSession(token) : null;
}

function normalizeFolderAclPath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/\s*>\s*/g, '/').split('/').map(x => x.trim()).filter(Boolean).join('/');
}

function isFolderPermissionAllowed(folders, categoryPath) {
  return isLibraryRelativePathAllowed({ mode: 'folders', folders: folders || [] }, normalizeFolderAclPath(categoryPath));
}

function isMoveTargetAllowed(libraryAccess, targetCategoryPath) {
  const access = libraryAccess || { mode: 'none', folders: [] };
  const target = normalizeFolderAclPath(targetCategoryPath);
  if (!target) return access.mode === 'all';
  return isLibraryRelativePathAllowed(access, target);
}

function isSourceInsideLibraryAccess(libraryAccess, categoryPath) {
  const source = normalizeFolderAclPath(categoryPath);
  return !!source && isLibraryRelativePathAllowed(libraryAccess || { mode: 'none', folders: [] }, source);
}

function expectedFolderDeleteConfirmText(req) {
  if (req && req.userSession) return 'DELETE:' + String(req.body && req.body.categoryPath || '').trim();
  return 'DELETE';
}

function auditActorFromFileopsRequest(req) {
  if (req && req.userSession) return { kind:req.userSession.kind, userId:req.userSession.userId, username:req.userSession.username || '', role:req.userSession.role || 'reader' };
  if (req && req.ownerSession) return { kind:req.ownerSession.kind, userId:req.ownerSession.userId, username:req.ownerSession.username || '', role:req.ownerSession.role || 'owner' };
  return { kind:'unknown' };
}

function appendFileMutationAudit(auditLogService, req, eventType, target = {}, details = {}) {
  if (!req || (!req.userSession && !req.ownerSession) || !auditLogService || typeof auditLogService.appendEvent !== 'function') return { ok:false, skipped:true };
  return auditLogService.appendEvent(eventType, { actor:auditActorFromFileopsRequest(req), target, details:{ ...details, pass:FILEOPS_AUDIT_COMPLETENESS_PASS } });
}

function appendFolderMutationAudit(auditLogService, req, eventType, target = {}, details = {}) {
  return appendFileMutationAudit(auditLogService, req, eventType, target, details);
}


function requireFolderMutationSession(action, options = {}) {
  const { sessionStore, accountService, requireOwnerSession } = options;
  const key = action === 'delete' ? 'deleteFolders' : 'moveFolders';
  return function folderMutationSession(req, res, next) {
    const session = getRequestSession(req, sessionStore);
    if (session && session.kind === OWNER_SESSION_KIND) {
      req.ownerSession = session;
      return next();
    }
    if (!sessionStore || !accountService) return requireOwnerSession(req, res, next);
    if (!session || session.kind !== USER_SESSION_KIND) return sendFolderMutationDenied(res, 'user_session_required');
    const mutationAccess = typeof accountService.getUserFolderMutationAccess === 'function'
      ? accountService.getUserFolderMutationAccess(session.userId)
      : { moveFolders: [], deleteFolders: [] };
    const categoryPath = req.body && req.body.categoryPath;
    const libraryAccess = typeof accountService.getUserLibraryAccess === 'function'
      ? accountService.getUserLibraryAccess(session.userId)
      : (session.libraryAccess || { mode: 'none', folders: [] });
    if (!isFolderPermissionAllowed(mutationAccess[key], categoryPath)) return sendFolderMutationDenied(res, action + '_folder_not_allowed');
    if (!isSourceInsideLibraryAccess(libraryAccess, categoryPath)) return sendFolderMutationDenied(res, action + '_source_not_in_library_access');
    req.folderMutationAuthorization = { action, sourceAllowedByMutation:true, sourceAllowedByLibraryAccess:true };
    if (action === 'move') {
      const targetCategoryPath = req.body && typeof req.body.targetCategoryPath === 'string' ? req.body.targetCategoryPath : '';
      if (!isMoveTargetAllowed(libraryAccess, targetCategoryPath)) return sendFolderMutationDenied(res, 'move_target_not_allowed');
      req.folderMutationAuthorization.targetAllowedByLibraryAccess = true;
    }
    req.userSession = session;
    return next();
  };
}

function requireFileopsConfirmation(expectedAction, options = {}) {
  return (req, res, next) => {
    const actualAction = String(req.get('X-Confirm-Action') || '').trim();
    if (actualAction !== expectedAction) {
      return res.status(428).json({
        error: 'file operation confirmation required',
        expectedConfirmAction: expectedAction,
        pass: FILEOPS_CONFIRMATION_PASS
      });
    }
    const expectedConfirmText = typeof options.confirmText === 'function' ? options.confirmText(req) : options.confirmText;
    if (expectedConfirmText && (!req.body || req.body.confirmText !== expectedConfirmText)) {
      return res.status(428).json({
        error: 'file operation confirmation text required',
        expectedConfirmText,
        pass: FILEOPS_CONFIRMATION_PASS
      });
    }
    return next();
  };
}

function createFileopsRouter({ fileopsService, requireSameOrigin, requireCsrf, requireOwnerSession = (req, res, next) => next(), sessionStore = null, accountService = null, auditLogService = null } = {}) {
  if (!fileopsService) throw new Error('fileopsService is required');
  if (typeof requireSameOrigin !== 'function') throw new Error('requireSameOrigin middleware is required');
  if (typeof requireCsrf !== 'function') throw new Error('requireCsrf middleware is required');
  if (typeof requireOwnerSession !== 'function') throw new Error('requireOwnerSession middleware is required');

  const router = createAsyncSafeRouter();
  const requireFolderMoveSession = requireFolderMutationSession('move', { sessionStore, accountService, requireOwnerSession });
  const requireFolderDeleteSession = requireFolderMutationSession('delete', { sessionStore, accountService, requireOwnerSession });

  function wrap(handler, audit = null) {
    return async (req, res) => {
      const controller = new AbortController();
      const abortRequest = () => {
        if (res.writableEnded) return;
        controller.abort(Object.assign(new Error('file mutation request was cancelled'), { code:'FILEOPS_REQUEST_ABORTED', statusCode:499, pass:FILEOPS_REQUEST_ABORT_PASS }));
      };
      req.fileopsSignal = controller.signal;
      req.once?.('aborted', abortRequest);
      res.once?.('close', abortRequest);
      try {
        const result = await handler(req);
        if (audit && result && result.skipped !== true) {
          const descriptor = typeof audit === 'function' ? audit(req, result) : audit;
          if (descriptor && descriptor.type) appendFileMutationAudit(auditLogService, req, descriptor.type, descriptor.target || {}, descriptor.details || {});
        }
        return res.json(result);
      } catch (error) {
        console.error(error);
        if (audit) {
          const descriptor = typeof audit === 'function' ? audit(req, null, error) : audit;
          if (descriptor && descriptor.type) appendFileMutationAudit(auditLogService, req, `${descriptor.type}.failed`, descriptor.target || {}, {
            ...(descriptor.details || {}),
            errorCode:String(error && error.code || 'FILE_OPERATION_FAILED'),
            statusCode:Number(error && (error.statusCode || error.status)) || 500
          });
        }
        return fileopsService.sendFsError(res, error);
      } finally {
        req.removeListener?.('aborted', abortRequest);
        res.removeListener?.('close', abortRequest);
      }
    };
  }

  router.patch('/folders/rename', requireOwnerSession, requireSameOrigin, requireCsrf, requireFileopsConfirmation(FILEOPS_CONFIRM_ACTIONS.rename), wrap((req) => {
    return fileopsService.renameFolder({
      categoryPath: req.body && req.body.categoryPath,
      newName: req.body && req.body.newName,
      signal:req.fileopsSignal
    });
  }, (req, result) => ({ type:'library.folder.rename', target:{ categoryPath:req.body && req.body.categoryPath }, details:{ newName:req.body && req.body.newName, result } })));

  router.patch('/novels/:novelId/rename', requireOwnerSession, requireSameOrigin, requireCsrf, requireFileopsConfirmation(FILEOPS_CONFIRM_ACTIONS.rename), wrap((req) => {
    return fileopsService.renameNovel({
      novelId: req.params.novelId,
      title: req.body && req.body.title,
      signal:req.fileopsSignal
    });
  }, (req, result) => ({ type:'library.novel.rename', target:{ novelId:req.params.novelId }, details:{ title:req.body && req.body.title, result } })));

  router.delete('/novels/:novelId', requireOwnerSession, requireSameOrigin, requireCsrf, requireFileopsConfirmation(FILEOPS_CONFIRM_ACTIONS.delete, { confirmText: 'DELETE' }), wrap((req) => {
    return fileopsService.deleteNovel({ novelId:req.params.novelId, signal:req.fileopsSignal });
  }, (req, result) => ({ type:'library.novel.delete', target:{ novelId:req.params.novelId }, details:{ result } })));

  router.patch('/novels/:novelId/move', requireOwnerSession, requireSameOrigin, requireCsrf, requireFileopsConfirmation(FILEOPS_CONFIRM_ACTIONS.move), wrap((req) => {
    return fileopsService.moveNovel({
      novelId:req.params.novelId,
      targetCategoryPath:req.body && typeof req.body.targetCategoryPath === 'string' ? req.body.targetCategoryPath : '',
      signal:req.fileopsSignal
    });
  }, (req, result) => ({ type:'library.novel.move', target:{ novelId:req.params.novelId }, details:{ targetCategoryPath:req.body && req.body.targetCategoryPath || '', result } })));

  router.patch('/episodes/:novelId/:episodeId/move', requireOwnerSession, requireSameOrigin, requireCsrf, requireFileopsConfirmation(FILEOPS_CONFIRM_ACTIONS.move), wrap((req) => {
    return fileopsService.moveEpisode({
      novelId:req.params.novelId,
      episodeId:req.params.episodeId,
      targetCategoryPath:req.body && typeof req.body.targetCategoryPath === 'string' ? req.body.targetCategoryPath : '',
      signal:req.fileopsSignal
    });
  }, (req, result) => ({ type:'library.episode.move', target:{ novelId:req.params.novelId, episodeId:req.params.episodeId }, details:{ targetCategoryPath:req.body && req.body.targetCategoryPath || '', result } })));

  router.patch('/folders/move', requireFolderMoveSession, requireSameOrigin, requireCsrf, requireFileopsConfirmation(FILEOPS_CONFIRM_ACTIONS.move), wrap(async (req) => {
    const categoryPath = req.body && req.body.categoryPath;
    const targetCategoryPath = req.body && typeof req.body.targetCategoryPath === 'string' ? req.body.targetCategoryPath : '';
    return fileopsService.moveFolder({ categoryPath, targetCategoryPath, signal:req.fileopsSignal });
  }, (req, result) => ({ type:'library.folder.move', target:{ categoryPath:req.body && req.body.categoryPath, targetCategoryPath:req.body && req.body.targetCategoryPath || '' }, details:{ ...(req.folderMutationAuthorization || {}), result } })));

  router.patch('/novels/:novelId/episodes/:episodeId/rename', requireOwnerSession, requireSameOrigin, requireCsrf, requireFileopsConfirmation(FILEOPS_CONFIRM_ACTIONS.rename), wrap((req) => {
    return fileopsService.renameEpisode({ novelId:req.params.novelId, episodeId:req.params.episodeId, title:req.body && req.body.title, signal:req.fileopsSignal });
  }, (req, result) => ({ type:'library.episode.rename', target:{ novelId:req.params.novelId, episodeId:req.params.episodeId }, details:{ title:req.body && req.body.title, result } })));

  router.delete('/novels/:novelId/episodes/:episodeId', requireOwnerSession, requireSameOrigin, requireCsrf, requireFileopsConfirmation(FILEOPS_CONFIRM_ACTIONS.delete, { confirmText: 'DELETE' }), wrap((req) => {
    return fileopsService.deleteEpisode({ novelId:req.params.novelId, episodeId:req.params.episodeId, signal:req.fileopsSignal });
  }, (req, result) => ({ type:'library.episode.delete', target:{ novelId:req.params.novelId, episodeId:req.params.episodeId }, details:{ result } })));

  router.delete('/folders', requireFolderDeleteSession, requireSameOrigin, requireCsrf, requireFileopsConfirmation(FILEOPS_CONFIRM_ACTIONS.delete, { confirmText: expectedFolderDeleteConfirmText }), wrap(async (req) => {
    const categoryPath = req.body && req.body.categoryPath;
    return fileopsService.deleteFolder({ categoryPath, signal:req.fileopsSignal });
  }, (req, result) => ({ type:'library.folder.delete', target:{ categoryPath:req.body && req.body.categoryPath }, details:{ ...(req.folderMutationAuthorization || {}), result } })));

  return router;
}

module.exports = {
  FILEOPS_CONFIRMATION_PASS,
  FILEOPS_CONFIRM_ACTIONS,
  FOLDER_MUTATION_ACCESS_PASS,
  FILEOPS_AUDIT_COMPLETENESS_PASS,
  FILEOPS_REQUEST_ABORT_PASS,
  requireFileopsConfirmation,
  requireFolderMutationSession,
  createFileopsRouter
};
