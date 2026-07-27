import { purgeUnscopedUserStorage, setStorageScope } from './storage.mjs';

export const USER_SCOPED_CLIENT_STORAGE_PASS = 'v613-user-scoped-client-storage-pass';
export const COMMON_ACCESS_BOOTSTRAP_PASS = 'v614-common-access-bootstrap-pass';
export const AUTH_BOOTSTRAP_REDIRECT_PASS = 'v614-auth-bootstrap-redirect-pass';
const ACCESS_SNAPSHOT_STORAGE_KEY = 'txt-reader.multi.userAccessSnapshot.v1';
const ACTIVE_THEME_SCOPE_KEY = 'txt-reader.rebuild.activeThemeScope';

function isRestricted(snapshot = {}) {
  return snapshot?.allNovelsAccessible !== true && String(snapshot?.libraryAccess?.mode || '') !== 'all';
}

function redirectForBootstrapAuthError(error, locationObject = globalThis.location) {
  const status = Number(error?.status) || 0;
  if (status !== 401 && status !== 403) return '';
  const ownerSession = status === 403 && String(error?.code || error?.data?.error || '') === 'reader_user_session_required';
  const target = ownerSession ? '/admin/users.html' : '/login.html';
  try {
    if (typeof locationObject?.replace === 'function') locationObject.replace(target);
    else if (typeof locationObject?.assign === 'function') locationObject.assign(target);
  } catch {}
  return target;
}


function createBootstrapRedirectError(target, cause) {
  const error = new Error(target === '/login.html' ? '로그인이 필요합니다.' : 'Owner 관리 화면으로 이동합니다.');
  error.code = 'CLIENT_AUTH_REDIRECT';
  error.redirectTarget = target;
  error.cause = cause;
  error.pass = AUTH_BOOTSTRAP_REDIRECT_PASS;
  return error;
}

export async function bootstrapUserScope(api, options = {}) {
  let snapshot = null;
  try {
    snapshot = await api.userAccessSnapshot({ noRedirect:true });
  } catch (error) {
    const target = redirectForBootstrapAuthError(error, options.locationObject || globalThis.location);
    if (!target) throw error;
    throw createBootstrapRedirectError(target, error);
  }
  const userId = String(snapshot?.userId || 'anonymous');
  const scope = setStorageScope(userId);
  try { localStorage.setItem(ACTIVE_THEME_SCOPE_KEY, scope); } catch {}
  const migration = purgeUnscopedUserStorage(userId);
  return {
    snapshot,
    scope,
    migration,
    restricted:isRestricted(snapshot),
    pass:USER_SCOPED_CLIENT_STORAGE_PASS
  };
}

export async function initializeAccessBootstrap(app, bootstrap = {}, options = {}) {
  const base = bootstrap?.snapshot || null;
  if (!base?.userId) return null;
  app.state.userId = String(base.userId);
  app.state.userAccessSnapshot = base;
  app.state.userAccessBootstrap = { pass:COMMON_ACCESS_BOOTSTRAP_PASS, detailed:false, at:Date.now() };

  if (!isRestricted(base)) {
    try { await import('../features/reader/cache-store.mjs').then(module => module.purgeLegacyUnscopedReaderCache()); } catch {}
    try {
      const signature = String(base.accessSignature || `${base.userId}:${base.accessVersion || 1}:all`);
      localStorage.setItem(`${ACCESS_SNAPSHOT_STORAGE_KEY}:${base.userId}`, JSON.stringify({ signature, userId:base.userId, accessVersion:base.accessVersion || 1, accessibleNovelCount:base.accessibleNovelCount || 0, updatedAt:Date.now(), verified:true, purge:null }));
    } catch {}
    return base;
  }
  if (options.deferRestrictedDetails === true && !base.accessibleNovelIdsIncluded) {
    app.state.userAccessBootstrap = { pass:COMMON_ACCESS_BOOTSTRAP_PASS, detailed:false, deferred:true, at:Date.now() };
    return base;
  }
  try {
    const detailed = base.accessibleNovelIdsIncluded
      ? base
      : await app.api.userAccessSnapshot({ noRedirect:true, includeNovelIds:true });
    if (detailed?.userId) {
      app.state.userAccessSnapshot = { ...base, ...detailed };
      app.state.userAccessBootstrap = { pass:COMMON_ACCESS_BOOTSTRAP_PASS, detailed:true, at:Date.now() };
      const allowed = Array.isArray(detailed.accessibleNovelIds) ? detailed.accessibleNovelIds : [];
      const [{ purgeReaderCacheOutsideAllowedNovelIds, purgeLegacyUnscopedReaderCache }, { filterLocalStateForAllowedNovelIds }] = await Promise.all([
        import('../features/reader/cache-store.mjs'),
        import('../features/library-access-state-filter.mjs')
      ]);
      filterLocalStateForAllowedNovelIds(app.state, allowed);
      const legacyPurge = await purgeLegacyUnscopedReaderCache().catch(() => ({ removed:0, manifestsRemoved:0 }));
      const accessPurge = await purgeReaderCacheOutsideAllowedNovelIds(app, allowed, { allAccessVersionsForUser:true });
      app.state.userAccessBootstrapPurge = { ...accessPurge, legacyPurge };
      try {
        const signature = String(detailed.accessSignature || `${detailed.userId}:${detailed.accessVersion || 1}:${detailed.libraryAccess?.mode || 'restricted'}`);
        localStorage.setItem(`${ACCESS_SNAPSHOT_STORAGE_KEY}:${detailed.userId}`, JSON.stringify({ signature, userId:detailed.userId, accessVersion:detailed.accessVersion || 1, accessibleNovelCount:detailed.accessibleNovelCount || allowed.length, updatedAt:Date.now(), verified:true, purge:app.state.userAccessBootstrapPurge }));
      } catch {}
    }
    return app.state.userAccessSnapshot;
  } catch (error) {
    const target = redirectForBootstrapAuthError(error, globalThis.location);
    if (target) throw createBootstrapRedirectError(target, error);
    app.state.userAccessBootstrapError = error?.message || String(error);
    return base;
  }
}
