const express = require('express');
const { getSessionTokenFromReq } = require('../middleware/auth');
const { OWNER_SESSION_KIND, TXT_READER_MULTI_OWNER_CONSOLE_PASS, TXT_READER_MULTI_FOLDER_MUTATION_ACCESS_PASS, TXT_READER_MULTI_FULL_SEARCH_PERMISSION_PASS } = require('../services/account-service');
const { filterLibraryByAccess, normalizeLibraryAccess } = require('../services/library-access-service');
const { buildAdminLibraryTreeFromNovels } = require('../services/admin-library-tree-service');

const TXT_READER_MULTI_ADMIN_USER_STATE_MANAGEMENT_ROUTE_PASS = 'v392-admin-user-state-management-route-pass';
const TXT_READER_MULTI_ACCOUNT_DELETE_ROUTE_PASS = 'v393-admin-user-delete-policy-route-pass';
const TXT_READER_MULTI_USER_SESSION_REVOKE_ROUTE_PASS = 'v394-admin-user-session-revoke-route-pass';
const TXT_READER_MULTI_ACCESS_PREVIEW_COMPARE_PASS = 'v396-admin-access-preview-compare-pass';
const TXT_READER_MULTI_SIGNUP_CODE_ADMIN_PASS = 'v397-admin-signup-code-route-pass';
const TXT_READER_MULTI_USER_STATE_SNAPSHOT_ROUTE_PASS = 'v401-admin-user-state-snapshot-route-pass';
const TXT_READER_MULTI_PASSWORD_OPERATIONS_ROUTE_PASS = 'v402-account-password-operations-route-pass';

function requireOwnerSession(sessionStore) {
  if (!sessionStore) throw new Error('requireOwnerSession requires sessionStore');
  return function ownerSessionMiddleware(req, res, next) {
    const token = getSessionTokenFromReq(req);
    const session = sessionStore.getSession ? sessionStore.getSession(token) : null;
    if (!session || session.kind !== OWNER_SESSION_KIND) return res.status(403).json({ ok: false, error: 'owner_session_required' });
    req.ownerSession = session;
    return next();
  };
}

function sendAdminError(res, err, fallbackMessage) {
  const status = err && Number.isFinite(Number(err.statusCode)) ? Number(err.statusCode) : 500;
  if (status >= 500) console.error(err);
  return res.status(status).json({ ok: false, error: err && err.code || 'admin_users_error', message: err && err.message || fallbackMessage || 'admin users request failed' });
}

function auditActorFromRequest(req) {
  return req && req.ownerSession ? { kind:req.ownerSession.kind, userId:req.ownerSession.userId, role:req.ownerSession.role || 'owner' } : { kind:'owner' };
}

function appendAudit(auditLogService, req, type, target = {}, details = {}) {
  if (!auditLogService || typeof auditLogService.appendEvent !== 'function') return { ok:false, skipped:true };
  return auditLogService.appendEvent(type, { actor:auditActorFromRequest(req), target, details });
}


function summarizeNovel(novel) {
  return {
    id: novel && novel.id || '',
    title: novel && novel.title || '',
    categoryPath: novel && novel.categoryPath || '',
    isMultiFile: !!(novel && novel.isMultiFile),
    episodeCount: novel && novel.isMultiFile && Array.isArray(novel.episodes) ? novel.episodes.length : 1
  };
}
function summarizeAccess(access) {
  const normalized = normalizeLibraryAccess(access || { mode:'none', folders:[] });
  return { mode:normalized.mode, folders:normalized.folders || [], folderCount:Array.isArray(normalized.folders) ? normalized.folders.length : 0 };
}
function createNovelIdSet(novels) { return new Set((Array.isArray(novels) ? novels : []).map(novel => novel && novel.id).filter(Boolean)); }
function diffNovelLists(beforeNovels, afterNovels) {
  const beforeSet = createNovelIdSet(beforeNovels);
  const afterSet = createNovelIdSet(afterNovels);
  const added = (Array.isArray(afterNovels) ? afterNovels : []).filter(novel => novel && novel.id && !beforeSet.has(novel.id));
  const revoked = (Array.isArray(beforeNovels) ? beforeNovels : []).filter(novel => novel && novel.id && !afterSet.has(novel.id));
  const retainedCount = (Array.isArray(afterNovels) ? afterNovels : []).filter(novel => novel && novel.id && beforeSet.has(novel.id)).length;
  return { added, revoked, retainedCount };
}

function requireUserExists(accountService, userId, res) {
  const user = accountService.findUserById(userId);
  if (!user) {
    res.status(404).json({ ok: false, error: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다.' });
    return null;
  }
  return user;
}

function createAdminUsersRouter(options = {}) {
  const { sessionStore, accountService, libraryService, userStateServiceManager, setNoStore, requireSameOrigin, requireCsrf, auditLogService, signupCodeService } = options;
  if (!sessionStore || !accountService || !setNoStore || !requireSameOrigin || !requireCsrf) throw new Error('createAdminUsersRouter requires sessionStore/accountService/setNoStore/requireSameOrigin/requireCsrf');
  const router = express.Router();
  const ownerOnly = requireOwnerSession(sessionStore);

  router.get('/admin/users/status', ownerOnly, (req, res) => {
    setNoStore(res);
    return res.json({
      ok: true,
      pass: TXT_READER_MULTI_OWNER_CONSOLE_PASS,
      userStateManagementPass: TXT_READER_MULTI_ADMIN_USER_STATE_MANAGEMENT_ROUTE_PASS,
      sessionKind: OWNER_SESSION_KIND,
      mode: 'owner-console-accounts',
      userManagement: 'active',
      userCount: accountService.listUsers().length,
      libraryAccess: { modes: ['none', 'all', 'folders'], folderModeIncludesChildren: true, folderTreeEndpoint: '/api/admin/library-tree' },
      folderMutationAccess: { fields: ['moveFolders', 'deleteFolders'], mustBeSubsetOfLibraryAccess: true, sourceFolderIncludesChildren: true, sourceMustBeInsideLibraryAccess: true, moveTargetMustBeInsideLibraryAccess: true, userDeleteConfirmPattern: 'DELETE:<categoryPath>', fileopsPass: TXT_READER_MULTI_FOLDER_MUTATION_ACCESS_PASS },
      appPermissions: { fields: ['fullSearch'], fullSearchDefault: true, pass: TXT_READER_MULTI_FULL_SEARCH_PERMISSION_PASS },
      userStateManagement: { exportEndpoint: '/api/admin/users/:userId/state/export', resetEndpoint: '/api/admin/users/:userId/state/reset', resetConfirmText: 'RESET' },
      userStateSnapshots: { listEndpoint: '/api/admin/users/:userId/state/snapshots', downloadEndpoint: '/api/admin/users/:userId/state/snapshots/:snapshotId', restoreEndpoint: '/api/admin/users/:userId/state/snapshots/:snapshotId/restore', restoreConfirmText: 'RESTORE', pass: TXT_READER_MULTI_USER_STATE_SNAPSHOT_ROUTE_PASS },
      userDeletion: { endpoint: '/api/admin/users/:userId', method: 'DELETE', confirmPattern: 'DELETE:<username>', stateActions: ['preserve', 'reset'], pass: TXT_READER_MULTI_ACCOUNT_DELETE_ROUTE_PASS },
      userSessionManagement: { revokeEndpoint: '/api/admin/users/:userId/sessions/revoke', method: 'POST', confirmText: 'REVOKE', pass: TXT_READER_MULTI_USER_SESSION_REVOKE_ROUTE_PASS },
      auditLog: { pass: 'v395-audit-log-service-pass', events: ['admin.user.create','admin.user.update','admin.user.password_reset','admin.user.state_export','admin.user.state_reset','admin.user.state_snapshot_create','admin.user.state_snapshot_download','admin.user.state_snapshot_restore','admin.user.delete','admin.user.sessions_revoke','admin.user.library_preview_compare','admin.signup_code.create','admin.signup_code.update','admin.signup_code.delete','auth.register.success','auth.register.failed','auth.password_change.success','auth.password_change.failed','font.upload','font.delete','library.folder.move','library.folder.delete'] },
      diagnostics: { endpoint: '/api/admin/diagnostics', method: 'GET', pass: 'v395-admin-diagnostics-pass' },
      accessPreviewCompare: { endpoint: '/api/admin/users/:userId/library-preview/compare', method: 'POST', pass: TXT_READER_MULTI_ACCESS_PREVIEW_COMPARE_PASS },
      signupCodes: { endpoint: '/api/admin/signup-codes', registerEndpoint: '/api/register', pass: TXT_READER_MULTI_SIGNUP_CODE_ADMIN_PASS, storesRawCode: false, defaultMaxUses: 1, appPermissions: { fields: ['fullSearch'], fullSearchDefault: true, pass: TXT_READER_MULTI_FULL_SEARCH_PERMISSION_PASS } },
      passwordOperations: { ownerResetEndpoint: '/api/admin/users/:userId/password', selfChangeEndpoint: '/api/account/password', pass: TXT_READER_MULTI_PASSWORD_OPERATIONS_ROUTE_PASS, ownerTemporaryPasswordSupported: true, selfChangePolicy: { currentSessionKept: true, otherSessionsRevoked: true } }
    });
  });



  router.get('/admin/signup-codes', ownerOnly, (req, res) => {
    setNoStore(res);
    if (!signupCodeService || typeof signupCodeService.listCodes !== 'function') return res.status(503).json({ ok:false, error:'signup_code_unavailable' });
    return res.json({ ok:true, pass:TXT_READER_MULTI_SIGNUP_CODE_ADMIN_PASS, codes:signupCodeService.listCodes() });
  });

  router.post('/admin/signup-codes', ownerOnly, requireSameOrigin, requireCsrf, (req, res) => {
    setNoStore(res);
    if (!signupCodeService || typeof signupCodeService.createCode !== 'function') return res.status(503).json({ ok:false, error:'signup_code_unavailable' });
    signupCodeService.createCode({ ...(req.body || {}), createdBy:'__owner__' }, (err, payload) => {
      if (err) return sendAdminError(res, err, 'signup code create failed');
      appendAudit(auditLogService, req, 'admin.signup_code.create', { codeId:payload.code && payload.code.id, label:payload.code && payload.code.label }, { maxUses:payload.code && payload.code.maxUses, expiresAt:payload.code && payload.code.expiresAt, libraryAccess:payload.code && payload.code.libraryAccess, folderMutationAccess:payload.code && payload.code.folderMutationAccess, appPermissions:payload.code && payload.code.appPermissions, rawCodeShownOnce:true });
      return res.status(201).json(payload);
    });
  });

  router.patch('/admin/signup-codes/:codeId', ownerOnly, requireSameOrigin, requireCsrf, (req, res) => {
    setNoStore(res);
    if (!signupCodeService || typeof signupCodeService.updateCode !== 'function') return res.status(503).json({ ok:false, error:'signup_code_unavailable' });
    signupCodeService.updateCode(req.params.codeId, req.body || {}, (err, payload) => {
      if (err) return sendAdminError(res, err, 'signup code update failed');
      appendAudit(auditLogService, req, 'admin.signup_code.update', { codeId:payload.code && payload.code.id, label:payload.code && payload.code.label }, { enabled:payload.code && payload.code.enabled, maxUses:payload.code && payload.code.maxUses, expiresAt:payload.code && payload.code.expiresAt, libraryAccess:payload.code && payload.code.libraryAccess, folderMutationAccess:payload.code && payload.code.folderMutationAccess, appPermissions:payload.code && payload.code.appPermissions });
      return res.json(payload);
    });
  });

  router.delete('/admin/signup-codes/:codeId', ownerOnly, requireSameOrigin, requireCsrf, (req, res) => {
    setNoStore(res);
    if (!signupCodeService || typeof signupCodeService.deleteCode !== 'function') return res.status(503).json({ ok:false, error:'signup_code_unavailable' });
    signupCodeService.deleteCode(req.params.codeId, (err, payload) => {
      if (err) return sendAdminError(res, err, 'signup code delete failed');
      appendAudit(auditLogService, req, 'admin.signup_code.delete', { codeId:payload.deletedCode && payload.deletedCode.id, label:payload.deletedCode && payload.deletedCode.label }, { usedCount:payload.deletedCode && payload.deletedCode.usedCount });
      return res.json(payload);
    });
  });

  router.get('/admin/users', ownerOnly, (req, res) => {
    setNoStore(res);
    return res.json({ ok: true, users: accountService.listUsers() });
  });

  router.get('/admin/users/:userId/library-preview', ownerOnly, (req, res) => {
    setNoStore(res);
    if (!libraryService || typeof libraryService.getLibraryCached !== 'function') return res.status(503).json({ ok:false, error:'library_preview_unavailable' });
    try {
      const user = accountService.findUserById(req.params.userId);
      if (!user) return res.status(404).json({ ok:false, error:'USER_NOT_FOUND', message:'사용자를 찾을 수 없습니다.' });
      const library = libraryService.getLibraryCached();
      const accessible = filterLibraryByAccess(library, user.libraryAccess || { mode:'none', folders:[] });
      return res.json({
        ok:true,
        pass:'v389-admin-library-preview-pass',
        user:{ id:user.id, username:user.username, enabled:user.enabled !== false, accessVersion:Math.max(1, Number(user.accessVersion || 1)), libraryAccess:user.libraryAccess || { mode:'none', folders:[] } },
        totalNovelCount:Array.isArray(library) ? library.length : 0,
        accessibleNovelCount:accessible.length,
        sample:accessible.slice(0,80).map(novel => ({ id:novel.id, title:novel.title, categoryPath:novel.categoryPath || '', isMultiFile:!!novel.isMultiFile, episodeCount:novel.isMultiFile && Array.isArray(novel.episodes) ? novel.episodes.length : 1 }))
      });
    } catch (err) {
      return sendAdminError(res, err, 'library preview request failed');
    }
  });



  router.post('/admin/users/:userId/library-preview/compare', ownerOnly, requireSameOrigin, requireCsrf, (req, res) => {
    setNoStore(res);
    if (!libraryService || typeof libraryService.getLibraryCached !== 'function') return res.status(503).json({ ok:false, error:'library_preview_unavailable' });
    try {
      const user = requireUserExists(accountService, req.params.userId, res);
      if (!user) return;
      const library = libraryService.getLibraryCached();
      const currentAccess = summarizeAccess(user.libraryAccess || { mode:'none', folders:[] });
      const proposedAccess = summarizeAccess(req.body && req.body.libraryAccess || user.libraryAccess || { mode:'none', folders:[] });
      const currentAccessible = filterLibraryByAccess(library, currentAccess);
      const proposedAccessible = filterLibraryByAccess(library, proposedAccess);
      const diff = diffNovelLists(currentAccessible, proposedAccessible);
      const payload = {
        ok:true,
        pass:TXT_READER_MULTI_ACCESS_PREVIEW_COMPARE_PASS,
        user:{ id:user.id, username:user.username, enabled:user.enabled !== false, accessVersion:Math.max(1, Number(user.accessVersion || 1)) },
        totalNovelCount:Array.isArray(library) ? library.length : 0,
        current:{ access:currentAccess, accessibleNovelCount:currentAccessible.length, sample:currentAccessible.slice(0,40).map(summarizeNovel) },
        proposed:{ access:proposedAccess, accessibleNovelCount:proposedAccessible.length, sample:proposedAccessible.slice(0,40).map(summarizeNovel) },
        diff:{ addedCount:diff.added.length, revokedCount:diff.revoked.length, retainedCount:diff.retainedCount, addedSample:diff.added.slice(0,40).map(summarizeNovel), revokedSample:diff.revoked.slice(0,40).map(summarizeNovel) },
        warnings: proposedAccess.mode === 'folders' && !proposedAccess.folders.length ? ['folders mode requires at least one folder to grant access.'] : []
      };
      appendAudit(auditLogService, req, 'admin.user.library_preview_compare', { userId:user.id, username:user.username }, { currentAccess, proposedAccess, totalNovelCount:payload.totalNovelCount, currentAccessibleNovelCount:payload.current.accessibleNovelCount, proposedAccessibleNovelCount:payload.proposed.accessibleNovelCount, addedCount:payload.diff.addedCount, revokedCount:payload.diff.revokedCount });
      return res.json(payload);
    } catch (err) {
      return sendAdminError(res, err, 'library preview compare request failed');
    }
  });

  router.get('/admin/users/:userId/state/export', ownerOnly, (req, res) => {
    setNoStore(res);
    if (!userStateServiceManager || typeof userStateServiceManager.exportStateForUserId !== 'function') return res.status(503).json({ ok:false, error:'user_state_management_unavailable' });
    try {
      const user = requireUserExists(accountService, req.params.userId, res);
      if (!user) return;
      const payload = userStateServiceManager.exportStateForUserId(user.id);
      appendAudit(auditLogService, req, 'admin.user.state_export', { userId:user.id, username:user.username }, { ok:true });
      return res.json({ ...payload, user: { id:user.id, username:user.username, enabled:user.enabled !== false } });
    } catch (err) {
      return sendAdminError(res, err, 'user state export failed');
    }
  });


  router.post('/admin/users/:userId/state/snapshots', ownerOnly, requireSameOrigin, requireCsrf, (req, res) => {
    setNoStore(res);
    if (!userStateServiceManager || typeof userStateServiceManager.createSnapshotForUserId !== 'function') return res.status(503).json({ ok:false, error:'user_state_snapshot_unavailable' });
    try {
      const user = requireUserExists(accountService, req.params.userId, res);
      if (!user) return;
      const reason = String(req.body && req.body.reason || 'manual');
      const payload = userStateServiceManager.createSnapshotForUserId(user.id, reason, { requestedBy:'owner-console' });
      appendAudit(auditLogService, req, 'admin.user.state_snapshot_create', { userId:user.id, username:user.username }, { reason, snapshotId:payload.snapshot && payload.snapshot.id });
      return res.status(201).json({ ...payload, routePass:TXT_READER_MULTI_USER_STATE_SNAPSHOT_ROUTE_PASS, user:{ id:user.id, username:user.username, enabled:user.enabled !== false } });
    } catch (err) {
      return sendAdminError(res, err, 'user state snapshot create failed');
    }
  });

  router.get('/admin/users/:userId/state/snapshots', ownerOnly, (req, res) => {
    setNoStore(res);
    if (!userStateServiceManager || typeof userStateServiceManager.listSnapshotsForUserId !== 'function') return res.status(503).json({ ok:false, error:'user_state_snapshot_unavailable' });
    try {
      const user = requireUserExists(accountService, req.params.userId, res);
      if (!user) return;
      const payload = userStateServiceManager.listSnapshotsForUserId(user.id);
      return res.json({ ...payload, routePass:TXT_READER_MULTI_USER_STATE_SNAPSHOT_ROUTE_PASS, user:{ id:user.id, username:user.username, enabled:user.enabled !== false } });
    } catch (err) {
      return sendAdminError(res, err, 'user state snapshot list failed');
    }
  });

  router.get('/admin/users/:userId/state/snapshots/:snapshotId', ownerOnly, (req, res) => {
    setNoStore(res);
    if (!userStateServiceManager || typeof userStateServiceManager.readSnapshotForUserId !== 'function') return res.status(503).json({ ok:false, error:'user_state_snapshot_unavailable' });
    try {
      const user = requireUserExists(accountService, req.params.userId, res);
      if (!user) return;
      const payload = userStateServiceManager.readSnapshotForUserId(user.id, req.params.snapshotId);
      appendAudit(auditLogService, req, 'admin.user.state_snapshot_download', { userId:user.id, username:user.username }, { snapshotId:payload.snapshot && payload.snapshot.id });
      return res.json({ ...payload, routePass:TXT_READER_MULTI_USER_STATE_SNAPSHOT_ROUTE_PASS, user:{ id:user.id, username:user.username, enabled:user.enabled !== false } });
    } catch (err) {
      return sendAdminError(res, err, 'user state snapshot download failed');
    }
  });

  router.post('/admin/users/:userId/state/snapshots/:snapshotId/restore', ownerOnly, requireSameOrigin, requireCsrf, (req, res) => {
    setNoStore(res);
    if (!userStateServiceManager || typeof userStateServiceManager.restoreSnapshotForUserId !== 'function') return res.status(503).json({ ok:false, error:'user_state_snapshot_unavailable' });
    if (!req.body || req.body.confirmText !== 'RESTORE') return res.status(400).json({ ok:false, error:'RESTORE_CONFIRM_REQUIRED', message:'confirmText 값으로 RESTORE를 보내야 합니다.' });
    try {
      const user = requireUserExists(accountService, req.params.userId, res);
      if (!user) return;
      const payload = userStateServiceManager.restoreSnapshotForUserId(user.id, req.params.snapshotId);
      appendAudit(auditLogService, req, 'admin.user.state_snapshot_restore', { userId:user.id, username:user.username }, { snapshotId:req.params.snapshotId, beforeSnapshotId:payload.beforeSnapshot && payload.beforeSnapshot.id });
      return res.json({ ...payload, routePass:TXT_READER_MULTI_USER_STATE_SNAPSHOT_ROUTE_PASS, user:{ id:user.id, username:user.username, enabled:user.enabled !== false } });
    } catch (err) {
      return sendAdminError(res, err, 'user state snapshot restore failed');
    }
  });

  router.post('/admin/users/:userId/state/reset', ownerOnly, requireSameOrigin, requireCsrf, (req, res) => {
    setNoStore(res);
    if (!userStateServiceManager || typeof userStateServiceManager.resetStateForUserId !== 'function') return res.status(503).json({ ok:false, error:'user_state_management_unavailable' });
    if (!req.body || req.body.confirmText !== 'RESET') return res.status(400).json({ ok:false, error:'RESET_CONFIRM_REQUIRED', message:'confirmText 값으로 RESET을 보내야 합니다.' });
    try {
      const user = requireUserExists(accountService, req.params.userId, res);
      if (!user) return;
      const payload = userStateServiceManager.resetStateForUserId(user.id);
      appendAudit(auditLogService, req, 'admin.user.state_reset', { userId:user.id, username:user.username }, { confirmText:'RESET', ok:true, beforeSnapshotId:payload.beforeSnapshot && payload.beforeSnapshot.id });
      return res.json({ ...payload, user: { id:user.id, username:user.username, enabled:user.enabled !== false } });
    } catch (err) {
      return sendAdminError(res, err, 'user state reset failed');
    }
  });

  router.get('/admin/library-tree', ownerOnly, (req, res) => {
    setNoStore(res);
    if (!libraryService || typeof libraryService.getLibraryCached !== 'function') return res.status(503).json({ ok: false, error: 'library_tree_unavailable' });
    try {
      const novels = libraryService.getLibraryCached();
      return res.json({ ok: true, libraryTree: buildAdminLibraryTreeFromNovels(novels) });
    } catch (err) {
      return sendAdminError(res, err, 'library tree request failed');
    }
  });

  router.post('/admin/users', ownerOnly, requireSameOrigin, requireCsrf, (req, res) => {
    setNoStore(res);
    accountService.createUser(req.body || {}, (err, user) => {
      if (err) return sendAdminError(res, err, 'user create failed');
      appendAudit(auditLogService, req, 'admin.user.create', { userId:user.id, username:user.username }, { enabled:user.enabled !== false, libraryAccess:user.libraryAccess, folderMutationAccess:user.folderMutationAccess, appPermissions:user.appPermissions });
      return res.status(201).json({ ok: true, user });
    });
  });

  router.patch('/admin/users/:userId', ownerOnly, requireSameOrigin, requireCsrf, (req, res) => {
    setNoStore(res);
    const before = accountService.findUserById(req.params.userId);
    accountService.updateUser(req.params.userId, req.body || {}, (err, user) => {
      if (err) return sendAdminError(res, err, 'user update failed');
      appendAudit(auditLogService, req, 'admin.user.update', { userId:user.id, username:user.username }, { before: before ? { enabled:before.enabled !== false, accessVersion:before.accessVersion, sessionVersion:before.sessionVersion, libraryAccess:before.libraryAccess, folderMutationAccess:before.folderMutationAccess, appPermissions:before.appPermissions } : null, after: { enabled:user.enabled !== false, accessVersion:user.accessVersion, sessionVersion:user.sessionVersion, libraryAccess:user.libraryAccess, folderMutationAccess:user.folderMutationAccess, appPermissions:user.appPermissions } });
      return res.json({ ok: true, user });
    });
  });


  router.delete('/admin/users/:userId', ownerOnly, requireSameOrigin, requireCsrf, (req, res) => {
    setNoStore(res);
    if (!accountService || typeof accountService.deleteUser !== 'function') return res.status(503).json({ ok:false, error:'user_delete_unavailable' });
    try {
      const user = requireUserExists(accountService, req.params.userId, res);
      if (!user) return;
      const confirmText = String(req.body && req.body.confirmText || '');
      const expectedConfirmText = `DELETE:${user.username}`;
      if (confirmText !== expectedConfirmText) return res.status(400).json({ ok:false, error:'DELETE_CONFIRM_REQUIRED', message:`삭제 확인 문구로 ${expectedConfirmText} 를 입력해야 합니다.`, expectedConfirmText });
      const stateAction = req.body && req.body.stateAction === 'reset' ? 'reset' : 'preserve';
      let stateResult = null;
      if (stateAction === 'reset') {
        if (!userStateServiceManager || typeof userStateServiceManager.resetStateForUserId !== 'function') return res.status(503).json({ ok:false, error:'user_state_management_unavailable' });
        stateResult = userStateServiceManager.resetStateForUserId(user.id, { snapshotReason:'before_delete_reset' });
      }
      accountService.deleteUser(user.id, { confirmText }, (err, deletedUser) => {
        if (err) return sendAdminError(res, err, 'user delete failed');
        appendAudit(auditLogService, req, 'admin.user.delete', { userId:deletedUser.id, username:deletedUser.username }, { stateAction, resetState:stateAction === 'reset', beforeSnapshotId:stateResult && stateResult.beforeSnapshot && stateResult.beforeSnapshot.id });
        return res.json({ ok:true, pass:TXT_READER_MULTI_ACCOUNT_DELETE_ROUTE_PASS, deletedUser, stateAction, stateResult });
      });
    } catch (err) {
      return sendAdminError(res, err, 'user delete failed');
    }
  });

  router.post('/admin/users/:userId/sessions/revoke', ownerOnly, requireSameOrigin, requireCsrf, (req, res) => {
    setNoStore(res);
    if (!accountService || typeof accountService.revokeUserSessions !== 'function') return res.status(503).json({ ok:false, error:'user_session_revoke_unavailable' });
    if (!req.body || req.body.confirmText !== 'REVOKE') return res.status(400).json({ ok:false, error:'REVOKE_CONFIRM_REQUIRED', message:'confirmText 값으로 REVOKE를 보내야 합니다.' });
    try {
      const user = requireUserExists(accountService, req.params.userId, res);
      if (!user) return;
      accountService.revokeUserSessions(user.id, (err, updatedUser) => {
        if (err) return sendAdminError(res, err, 'user session revoke failed');
        appendAudit(auditLogService, req, 'admin.user.sessions_revoke', { userId:updatedUser.id, username:updatedUser.username }, { sessionVersion:updatedUser.sessionVersion });
        return res.json({ ok:true, pass:TXT_READER_MULTI_USER_SESSION_REVOKE_ROUTE_PASS, user:updatedUser });
      });
    } catch (err) {
      return sendAdminError(res, err, 'user session revoke failed');
    }
  });

  router.post('/admin/users/:userId/password', ownerOnly, requireSameOrigin, requireCsrf, (req, res) => {
    setNoStore(res);
    const generateTemporary = !!(req.body && req.body.generateTemporary);
    const done = (err, payload) => {
      if (err) return sendAdminError(res, err, 'password reset failed');
      const user = payload && payload.user ? payload.user : payload;
      appendAudit(auditLogService, req, 'admin.user.password_reset', { userId:user.id, username:user.username }, { sessionVersion:user.sessionVersion, generatedTemporaryPassword:generateTemporary, lastPasswordResetAt:user.lastPasswordResetAt });
      return res.json({ ok: true, pass:TXT_READER_MULTI_PASSWORD_OPERATIONS_ROUTE_PASS, user, temporaryPassword: generateTemporary ? payload.temporaryPassword : undefined, sessionPolicy:{ allUserSessionsRevoked:true } });
    };
    if (generateTemporary && typeof accountService.resetPasswordWithTemporary === 'function') return accountService.resetPasswordWithTemporary(req.params.userId, done);
    return accountService.resetPassword(req.params.userId, req.body && req.body.password, done);
  });

  return router;
}

module.exports = { TXT_READER_MULTI_ADMIN_USER_STATE_MANAGEMENT_ROUTE_PASS, TXT_READER_MULTI_ACCOUNT_DELETE_ROUTE_PASS, TXT_READER_MULTI_USER_SESSION_REVOKE_ROUTE_PASS, TXT_READER_MULTI_ACCESS_PREVIEW_COMPARE_PASS, TXT_READER_MULTI_USER_STATE_SNAPSHOT_ROUTE_PASS, TXT_READER_MULTI_PASSWORD_OPERATIONS_ROUTE_PASS, requireOwnerSession, createAdminUsersRouter, buildAdminLibraryTreeFromNovels };
