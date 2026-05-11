const path = require('path');

const TXT_READER_MULTI_LIBRARY_ACCESS_PASS = 'v389-txt-reader-multi-library-access-pass';
const TXT_READER_MULTI_LIBRARY_API_ACL_PASS = 'v389-txt-reader-multi-library-api-acl-pass';

function safeDecode(value) {
  const raw = String(value == null ? '' : value);
  try { return decodeURIComponent(raw); } catch { return raw; }
}

function splitNormalizedRelativePath(value) {
  const raw = safeDecode(value).replace(/\\/g, '/').normalize('NFC').trim();
  if (!raw) return [];
  if (/^[a-zA-Z]:/.test(raw) || raw.startsWith('//')) throw new Error('absolute library path is not allowed');
  const parts = raw.split('/').map(part => part.trim()).filter(part => part && part !== '.');
  if (parts.some(part => part === '..')) throw new Error('path traversal is not allowed');
  return parts;
}

function normalizeLibraryRelativePath(value) {
  return splitNormalizedRelativePath(value).join('/');
}

function normalizeAccessFolders(folders = []) {
  if (!Array.isArray(folders)) return [];
  const out = [];
  for (const folder of folders) {
    try {
      const normalized = normalizeLibraryRelativePath(folder);
      if (normalized) out.push(normalized);
    } catch {}
  }
  return Array.from(new Set(out)).sort();
}

function normalizeLibraryAccess(access = {}) {
  const mode = String(access && access.mode || 'none').trim().toLowerCase();
  if (mode === 'all') return { mode: 'all', folders: [] };
  if (mode === 'folders') return { mode: 'folders', folders: normalizeAccessFolders(access.folders || []) };
  return { mode: 'none', folders: [] };
}

function isPrefixSegments(prefix, target) {
  return prefix.length > 0 && prefix.length <= target.length && prefix.every((part, index) => target[index] === part);
}

function isLibraryRelativePathAllowed(access = {}, relativePath = '') {
  const normalizedAccess = normalizeLibraryAccess(access);
  if (normalizedAccess.mode === 'all') return true;
  if (normalizedAccess.mode !== 'folders') return false;
  let targetSegments;
  try {
    targetSegments = splitNormalizedRelativePath(relativePath);
  } catch {
    return false;
  }
  if (!targetSegments.length) return false;
  return normalizedAccess.folders.some(folder => {
    try {
      return isPrefixSegments(splitNormalizedRelativePath(folder), targetSegments);
    } catch {
      return false;
    }
  });
}

function makeLibraryAccessError(message = 'library access denied') {
  const err = new Error(message);
  err.code = 'LIBRARY_ACCESS_DENIED';
  err.status = 403;
  err.statusCode = 403;
  return err;
}

function assertLibraryRelativePathAllowed(access, relativePath) {
  if (!isLibraryRelativePathAllowed(access, relativePath)) throw makeLibraryAccessError();
  return normalizeLibraryRelativePath(relativePath);
}

function toSlashPath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

function getEpisodeFolderPath(episodePath) {
  const clean = toSlashPath(episodePath);
  if (!clean) return '';
  const dir = path.posix.dirname(clean);
  return dir === '.' ? '' : dir;
}

function getNovelAccessRelativePath(novel) {
  if (!novel) return '';
  if (novel.isMultiFile) {
    const firstEpisode = Array.isArray(novel.episodes) ? novel.episodes.find(episode => episode && episode.path) : null;
    return firstEpisode ? getEpisodeFolderPath(firstEpisode.path) : '';
  }
  return normalizeLibraryRelativePath(novel.singlePath || '');
}

function isEpisodeAllowed(access, episode) {
  return !!(episode && episode.path && isLibraryRelativePathAllowed(access, episode.path));
}

function isNovelAllowed(access, novel) {
  const normalizedAccess = normalizeLibraryAccess(access);
  if (normalizedAccess.mode === 'all') return true;
  if (!novel) return false;
  if (novel.isMultiFile) {
    const rel = getNovelAccessRelativePath(novel);
    if (rel && isLibraryRelativePathAllowed(normalizedAccess, rel)) return true;
    return (Array.isArray(novel.episodes) ? novel.episodes : []).some(episode => isEpisodeAllowed(normalizedAccess, episode));
  }
  return !!(novel.singlePath && isLibraryRelativePathAllowed(normalizedAccess, novel.singlePath));
}

function assertNovelAllowed(access, novel) {
  if (!isNovelAllowed(access, novel)) throw makeLibraryAccessError();
  return novel;
}

function assertEpisodeAllowed(access, novel, episode) {
  if (!episode || !episode.path || !isLibraryRelativePathAllowed(access, episode.path)) throw makeLibraryAccessError();
  return { novel, episode };
}

function filterLibraryByAccess(library = [], access = {}) {
  const normalizedAccess = normalizeLibraryAccess(access);
  if (normalizedAccess.mode === 'all') return Array.isArray(library) ? library.slice() : [];
  if (normalizedAccess.mode === 'none') return [];
  const out = [];
  for (const novel of Array.isArray(library) ? library : []) {
    if (!novel) continue;
    if (!novel.isMultiFile) {
      if (isNovelAllowed(normalizedAccess, novel)) out.push(novel);
      continue;
    }
    const episodes = Array.isArray(novel.episodes) ? novel.episodes.filter(episode => isEpisodeAllowed(normalizedAccess, episode)) : [];
    if (episodes.length) out.push({ ...novel, episodes });
  }
  return out;
}

function createAccessibleNovelIdSet(library = [], access = {}) {
  return new Set(filterLibraryByAccess(library, access).map(novel => novel && novel.id).filter(Boolean));
}

function filterProgressByAllowedNovelIds(progress = {}, allowedNovelIds = new Set()) {
  const src = progress && typeof progress === 'object' ? progress : {};
  const out = { ...src };
  const allowed = id => !id || allowedNovelIds.has(String(id));

  if (src.lastRead && src.lastRead.novelId && !allowed(src.lastRead.novelId)) out.lastRead = null;

  out.byNovel = {};
  Object.keys(src.byNovel || {}).forEach((novelId) => {
    if (allowed(novelId)) out.byNovel[novelId] = src.byNovel[novelId];
  });

  out.readMeta = {};
  Object.keys(src.readMeta || {}).forEach((key) => {
    const item = src.readMeta[key];
    if (!item || !item.novelId || allowed(item.novelId)) out.readMeta[key] = item;
  });

  out.positions = {};
  Object.keys(src.positions || {}).forEach((key) => {
    const item = src.positions[key];
    if (!item || !item.novelId || allowed(item.novelId)) out.positions[key] = item;
  });

  return out;
}

function filterSharedStateByAllowedNovelIds(shared = {}, allowedNovelIds = new Set()) {
  const src = shared && typeof shared === 'object' ? shared : {};
  const allowed = id => !!id && allowedNovelIds.has(String(id));
  const out = { ...src };
  out.favorites = Array.isArray(src.favorites) ? src.favorites.filter(allowed) : [];
  out.bookmarks = Array.isArray(src.bookmarks) ? src.bookmarks.filter(item => !item || !item.novelId || allowed(item.novelId)) : [];
  out.recents = Array.isArray(src.recents) ? src.recents.filter(item => !item || !item.novelId || allowed(item.novelId)) : [];
  out.progress = filterProgressByAllowedNovelIds(src.progress || {}, allowedNovelIds);
  if (src.lastOpenedNovelId && !allowed(src.lastOpenedNovelId)) out.lastOpenedNovelId = null;
  return out;
}

function filterStateResponseByLibraryAccess(response = {}, library = [], access = {}) {
  const allowedNovelIds = createAccessibleNovelIdSet(library, access);
  const out = { ...response };
  out.shared = filterSharedStateByAllowedNovelIds(response.shared || {}, allowedNovelIds);
  return out;
}

function sendLibraryAccessDenied(res, reason = 'library_access_denied') {
  return res.status(403).json({ ok: false, error: reason, message: 'Library access denied for this user.' });
}

function getSessionFromRequest(req, sessionStore) {
  if (!req || !sessionStore || typeof sessionStore.getSession !== 'function') return null;
  const cookieHeader = req.headers && req.headers.cookie || '';
  const parts = String(cookieHeader || '').split(';');
  let token = '';
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith('__Host-session_token=')) token = trimmed.slice('__Host-session_token='.length);
    if (!token && trimmed.startsWith('session_token=')) token = trimmed.slice('session_token='.length);
  }
  return token ? sessionStore.getSession(token) : null;
}

function getUserLibraryAccessFromRequest(req, { sessionStore, accountService } = {}) {
  const session = getSessionFromRequest(req, sessionStore);
  if (!session) return { ok: false, status: 401, error: 'login_required', session: null, access: normalizeLibraryAccess({ mode: 'none' }) };
  if (session.kind !== 'user') return { ok: false, status: 403, error: 'reader_user_session_required', session, access: normalizeLibraryAccess({ mode: 'none' }) };
  const access = accountService && typeof accountService.getUserLibraryAccess === 'function'
    ? accountService.getUserLibraryAccess(session.userId)
    : session.libraryAccess;
  return { ok: true, status: 200, error: '', session, access: normalizeLibraryAccess(access) };
}

module.exports = {
  TXT_READER_MULTI_LIBRARY_ACCESS_PASS,
  TXT_READER_MULTI_LIBRARY_API_ACL_PASS,
  normalizeLibraryAccess,
  normalizeLibraryRelativePath,
  normalizeAccessFolders,
  isLibraryRelativePathAllowed,
  assertLibraryRelativePathAllowed,
  makeLibraryAccessError,
  getNovelAccessRelativePath,
  isNovelAllowed,
  assertNovelAllowed,
  isEpisodeAllowed,
  assertEpisodeAllowed,
  filterLibraryByAccess,
  createAccessibleNovelIdSet,
  filterSharedStateByAllowedNovelIds,
  filterStateResponseByLibraryAccess,
  sendLibraryAccessDenied,
  getSessionFromRequest,
  getUserLibraryAccessFromRequest
};
