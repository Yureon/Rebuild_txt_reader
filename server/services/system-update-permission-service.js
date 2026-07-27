'use strict';

const TXT_READER_MULTI_SYSTEM_UPDATE_PERMISSION_PASS = 'v627-system-update-dual-permission-pass';

function hasUsableLibraryAccess(access = {}) {
  const mode = String(access && access.mode || 'none');
  if (mode === 'all') return true;
  return mode === 'folders' && Array.isArray(access.folders) && access.folders.length > 0;
}

function systemUpdateAuthorizationForSession(session, accountService) {
  if (!session) return { allowed:false, reason:'login_required', libraryAccessAllowed:false, metadataAccessAllowed:false };
  if (session.kind === 'owner') return { allowed:true, reason:'owner_full_access', libraryAccessAllowed:true, metadataAccessAllowed:true };
  if (session.kind !== 'user') return { allowed:false, reason:'reader_user_session_required', libraryAccessAllowed:false, metadataAccessAllowed:false };
  const snapshot = typeof accountService?.getUserAccessSnapshot === 'function' ? accountService.getUserAccessSnapshot(session.userId) : null;
  const libraryAccess = snapshot && snapshot.libraryAccess || session.libraryAccess || { mode:'none', folders:[] };
  const appPermissions = snapshot && snapshot.appPermissions || session.appPermissions || { metadataAccess:false };
  const libraryAccessAllowed = hasUsableLibraryAccess(libraryAccess);
  const metadataAccessAllowed = appPermissions.metadataAccess === true;
  return {
    allowed:libraryAccessAllowed && metadataAccessAllowed,
    reason:libraryAccessAllowed ? (metadataAccessAllowed ? 'dual_permission_granted' : 'metadata_permission_required') : 'library_permission_required',
    libraryAccessAllowed,
    metadataAccessAllowed
  };
}

module.exports = {
  TXT_READER_MULTI_SYSTEM_UPDATE_PERMISSION_PASS,
  hasUsableLibraryAccess,
  systemUpdateAuthorizationForSession
};
