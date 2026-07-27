const { createAsyncSafeRouter } = require('../utils/async-route');
const {
  TXT_READER_MULTI_LIBRARY_API_ACL_PASS,
  getUserLibraryAccessFromRequest,
  getSessionFromRequest,
  filterLibraryByAccess
} = require('../services/library-access-service');

const TXT_READER_MULTI_USER_ACCESS_SNAPSHOT_PASS = 'v491-user-access-folder-mutation-snapshot-pass';
const TXT_READER_MULTI_FULL_SEARCH_PERMISSION_SNAPSHOT_PASS = 'v551-user-full-search-permission-snapshot-pass';
const TXT_READER_MULTI_METADATA_ACCESS_PERMISSION_SNAPSHOT_PASS = 'v588-user-metadata-access-permission-snapshot-pass';
const TXT_READER_MULTI_LAZY_ACCESS_ID_SNAPSHOT_PASS = 'v612-lazy-access-id-snapshot-pass';
const {
  TXT_READER_MULTI_SYSTEM_UPDATE_PERMISSION_PASS,
  hasUsableLibraryAccess,
  systemUpdateAuthorizationForSession
} = require('../services/system-update-permission-service');

function createUserAccessRouter(options = {}) {
  const { sessionStore, accountService, libraryService, setNoStore = () => {} } = options;
  if (!sessionStore || !accountService || !libraryService) {
    throw new Error('createUserAccessRouter requires sessionStore/accountService/libraryService');
  }
  const router = createAsyncSafeRouter();
  router.get('/system-update/authorization', (req, res) => {
    setNoStore(res);
    const session = getSessionFromRequest(req, sessionStore);
    const authorization = systemUpdateAuthorizationForSession(session, accountService);
    const status = session ? 200 : 401;
    return res.status(status).json({
      ok:authorization.allowed,
      allowed:authorization.allowed,
      reason:authorization.reason,
      libraryAccessAllowed:authorization.libraryAccessAllowed,
      metadataAccessAllowed:authorization.metadataAccessAllowed,
      pass:TXT_READER_MULTI_SYSTEM_UPDATE_PERMISSION_PASS
    });
  });

  router.get('/user-access/snapshot', async (req, res) => {
    setNoStore(res);
    try {
      const auth = getUserLibraryAccessFromRequest(req, { sessionStore, accountService });
      if (!auth.ok) {
        return res.status(auth.status || 403).json({
          ok: false,
          error: auth.error || 'reader_user_session_required'
        });
      }
      const accountSnapshot = typeof accountService.getUserAccessSnapshot === 'function'
        ? accountService.getUserAccessSnapshot(auth.session.userId)
        : null;
      const folderMutationAccess = typeof accountService.getUserFolderMutationAccess === 'function'
        ? accountService.getUserFolderMutationAccess(auth.session.userId)
        : { moveFolders: [], deleteFolders: [] };
      const appPermissions = accountSnapshot && accountSnapshot.appPermissions
        ? accountSnapshot.appPermissions
        : (typeof accountService.getUserAppPermissions === 'function'
          ? accountService.getUserAppPermissions(auth.session.userId)
          : { fullSearch: true, metadataAccess: false });
      const allNovelsAccessible = String(auth.access && auth.access.mode || '') === 'all';
      let totalNovelCount = null;
      let accessibleNovelCount = null;
      let accessibleNovelIds = null;
      const includeNovelIds = String(req.query?.includeNovelIds || '') === '1';
      if (allNovelsAccessible) {
        const cacheStatus = typeof libraryService.getCacheStatus === 'function' ? libraryService.getCacheStatus() : null;
        const cachedCount = Number(cacheStatus && cacheStatus.libraryCache && cacheStatus.libraryCache.count);
        const cacheBuildCount = Number(cacheStatus && cacheStatus.libraryCache && cacheStatus.libraryCache.buildCount);
        if (Number.isFinite(cachedCount) && Number.isFinite(cacheBuildCount) && cacheBuildCount > 0) totalNovelCount = accessibleNovelCount = Math.max(0, cachedCount);
      } else if (includeNovelIds) {
        const library = typeof libraryService.getLibraryCachedForRequestAsync === 'function'
          ? await libraryService.getLibraryCachedForRequestAsync()
          : typeof libraryService.getLibraryCachedAsync === 'function'
            ? await libraryService.getLibraryCachedAsync()
            : libraryService.getLibraryCached();
        const filtered = filterLibraryByAccess(library, auth.access);
        totalNovelCount = Array.isArray(library) ? library.length : 0;
        accessibleNovelCount = filtered.length;
        accessibleNovelIds = filtered.map(novel => novel && novel.id).filter(Boolean);
      }
      return res.json({
        ok: true,
        pass: TXT_READER_MULTI_USER_ACCESS_SNAPSHOT_PASS,
        aclPass: TXT_READER_MULTI_LIBRARY_API_ACL_PASS,
        userId: auth.session.userId,
        accessVersion: accountSnapshot ? accountSnapshot.accessVersion : 1,
        libraryAccess: auth.access,
        folderMutationAccess,
        appPermissions,
        fullSearchAllowed: appPermissions.fullSearch !== false,
        metadataAccessAllowed: appPermissions.metadataAccess === true,
        systemUpdateAllowed:hasUsableLibraryAccess(auth.access) && appPermissions.metadataAccess === true,
        systemUpdatePermissionPass:TXT_READER_MULTI_SYSTEM_UPDATE_PERMISSION_PASS,
        permissionPass: TXT_READER_MULTI_FULL_SEARCH_PERMISSION_SNAPSHOT_PASS,
        metadataPermissionPass: TXT_READER_MULTI_METADATA_ACCESS_PERMISSION_SNAPSHOT_PASS,
        totalNovelCount,
        accessibleNovelCount,
        allNovelsAccessible,
        accessSignature:`${auth.session.userId}:${accountSnapshot ? accountSnapshot.accessVersion : 1}:${String(auth.access && auth.access.mode || 'none')}`,
        accessibleNovelIds,
        accessibleNovelIdsIncluded:Array.isArray(accessibleNovelIds),
        lazyAccessIdSnapshotPass:TXT_READER_MULTI_LAZY_ACCESS_ID_SNAPSHOT_PASS
      });
    } catch (error) {
      console.error(error);
      return res.status(503).json({
        ok: false,
        error: 'internal_server_error',
        message: 'library unavailable'
      });
    }
  });
  return router;
}

module.exports = {
  TXT_READER_MULTI_USER_ACCESS_SNAPSHOT_PASS,
  TXT_READER_MULTI_FULL_SEARCH_PERMISSION_SNAPSHOT_PASS,
  TXT_READER_MULTI_METADATA_ACCESS_PERMISSION_SNAPSHOT_PASS,
  TXT_READER_MULTI_LAZY_ACCESS_ID_SNAPSHOT_PASS,
  TXT_READER_MULTI_SYSTEM_UPDATE_PERMISSION_PASS,
  hasUsableLibraryAccess,
  systemUpdateAuthorizationForSession,
  createUserAccessRouter
};
