const express = require('express');
const { getSessionTokenFromReq } = require('../middleware/auth');
const { OWNER_SESSION_KIND, USER_SESSION_KIND } = require('../services/account-service');
const { isLibraryRelativePathAllowed } = require('../services/library-access-service');

const FILEOPS_CONFIRMATION_PASS = 'v344-fileops-action-confirmation-pass';
const FOLDER_MUTATION_ACCESS_PASS = 'v493-folder-mutation-access-policy-pass';
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

function appendFolderMutationAudit(auditLogService, req, eventType, target = {}, details = {}) {
  if (!req || !req.userSession || !auditLogService || typeof auditLogService.appendEvent !== 'function') return { ok:false, skipped:true };
  return auditLogService.appendEvent(eventType, { actor:auditActorFromFileopsRequest(req), target, details });
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

  const router = express.Router();
  const requireFolderMoveSession = requireFolderMutationSession('move', { sessionStore, accountService, requireOwnerSession });
  const requireFolderDeleteSession = requireFolderMutationSession('delete', { sessionStore, accountService, requireOwnerSession });

  function wrap(handler) {
    return (req, res) => {
      try {
        return res.json(handler(req));
      } catch (error) {
        console.error(error);
        return fileopsService.sendFsError(res, error);
      }
    };
  }

  router.patch('/folders/rename', requireOwnerSession, requireSameOrigin, requireCsrf, requireFileopsConfirmation(FILEOPS_CONFIRM_ACTIONS.rename), wrap((req) => {
    return fileopsService.renameFolder({
      categoryPath: req.body && req.body.categoryPath,
      newName: req.body && req.body.newName
    });
  }));

  router.patch('/novels/:novelId/rename', requireOwnerSession, requireSameOrigin, requireCsrf, requireFileopsConfirmation(FILEOPS_CONFIRM_ACTIONS.rename), wrap((req) => {
    return fileopsService.renameNovel({
      novelId: req.params.novelId,
      title: req.body && req.body.title
    });
  }));

  router.delete('/novels/:novelId', requireOwnerSession, requireSameOrigin, requireCsrf, requireFileopsConfirmation(FILEOPS_CONFIRM_ACTIONS.delete, { confirmText: 'DELETE' }), wrap((req) => {
    return fileopsService.deleteNovel({
      novelId: req.params.novelId
    });
  }));

  router.patch('/novels/:novelId/move', requireOwnerSession, requireSameOrigin, requireCsrf, requireFileopsConfirmation(FILEOPS_CONFIRM_ACTIONS.move), wrap((req) => {
    return fileopsService.moveNovel({
      novelId: req.params.novelId,
      targetCategoryPath: req.body && typeof req.body.targetCategoryPath === 'string'
        ? req.body.targetCategoryPath
        : ''
    });
  }));

  router.patch('/episodes/:novelId/:episodeId/move', requireOwnerSession, requireSameOrigin, requireCsrf, requireFileopsConfirmation(FILEOPS_CONFIRM_ACTIONS.move), wrap((req) => {
    return fileopsService.moveEpisode({
      novelId: req.params.novelId,
      episodeId: req.params.episodeId,
      targetCategoryPath: req.body && typeof req.body.targetCategoryPath === 'string'
        ? req.body.targetCategoryPath
        : ''
    });
  }));

  router.patch('/folders/move', requireFolderMoveSession, requireSameOrigin, requireCsrf, requireFileopsConfirmation(FILEOPS_CONFIRM_ACTIONS.move), wrap((req) => {
    const categoryPath = req.body && req.body.categoryPath;
    const targetCategoryPath = req.body && typeof req.body.targetCategoryPath === 'string' ? req.body.targetCategoryPath : '';
    const result = fileopsService.moveFolder({ categoryPath, targetCategoryPath });
    appendFolderMutationAudit(auditLogService, req, 'library.folder.move', { categoryPath, targetCategoryPath }, req.folderMutationAuthorization || {});
    return result;
  }));

  router.patch('/novels/:novelId/episodes/:episodeId/rename', requireOwnerSession, requireSameOrigin, requireCsrf, requireFileopsConfirmation(FILEOPS_CONFIRM_ACTIONS.rename), wrap((req) => {
    return fileopsService.renameEpisode({
      novelId: req.params.novelId,
      episodeId: req.params.episodeId,
      title: req.body && req.body.title
    });
  }));

  router.delete('/novels/:novelId/episodes/:episodeId', requireOwnerSession, requireSameOrigin, requireCsrf, requireFileopsConfirmation(FILEOPS_CONFIRM_ACTIONS.delete, { confirmText: 'DELETE' }), wrap((req) => {
    return fileopsService.deleteEpisode({
      novelId: req.params.novelId,
      episodeId: req.params.episodeId
    });
  }));

  router.delete('/folders', requireFolderDeleteSession, requireSameOrigin, requireCsrf, requireFileopsConfirmation(FILEOPS_CONFIRM_ACTIONS.delete, { confirmText: expectedFolderDeleteConfirmText }), wrap((req) => {
    const categoryPath = req.body && req.body.categoryPath;
    const result = fileopsService.deleteFolder({ categoryPath });
    appendFolderMutationAudit(auditLogService, req, 'library.folder.delete', { categoryPath }, req.folderMutationAuthorization || {});
    return result;
  }));

  return router;
}

module.exports = {
  FILEOPS_CONFIRMATION_PASS,
  FILEOPS_CONFIRM_ACTIONS,
  FOLDER_MUTATION_ACCESS_PASS,
  requireFileopsConfirmation,
  requireFolderMutationSession,
  createFileopsRouter
};
