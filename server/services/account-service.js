const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { USER_PASSWORD_MIN_LENGTH } = require('../config/env');
const { loadJsonWithBackup } = require('../repositories/json-file-store');

const TXT_READER_MULTI_OWNER_CONSOLE_PASS = 'v389-txt-reader-multi-owner-console-pass';
const TXT_READER_MULTI_PASSWORD_HASH_PASS = 'v389-txt-reader-multi-password-hash-pass';
const TXT_READER_MULTI_USER_ACCOUNT_PASS = 'v389-txt-reader-multi-user-account-pass';
const TXT_READER_MULTI_ACCOUNT_PASSWORD_OPERATIONS_PASS = 'v402-account-password-operations-pass';
const TXT_READER_MULTI_FOLDER_MUTATION_ACCESS_PASS = 'v490-folder-mutation-access-pass';
const TXT_READER_MULTI_FULL_SEARCH_PERMISSION_PASS = 'v551-full-search-permission-pass';
const OWNER_SESSION_KIND = 'owner';
const USER_SESSION_KIND = 'user';
const DEFAULT_SCRYPT_PARAMS = Object.freeze({ N: 16384, r: 8, p: 1, keylen: 64 });

function normalizeUsername(value) { return String(value || '').trim().toLowerCase(); }
function accountError(statusCode, message, code) { const e = new Error(message); e.statusCode = statusCode; e.code = code; return e; }
function validateUsername(v) { const u = normalizeUsername(v); if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(u)) throw accountError(400, '아이디는 영문 소문자, 숫자, 점, 밑줄, 하이픈 3~32자로 입력하세요.', 'INVALID_USERNAME'); return u; }
function validateUserPassword(v) { if (typeof v !== 'string' || v.length < USER_PASSWORD_MIN_LENGTH) throw accountError(400, `비밀번호는 최소 ${USER_PASSWORD_MIN_LENGTH}글자 이상이어야 합니다.`, 'INVALID_PASSWORD'); return v; }
function hashPassword(password, options = {}) { if (typeof password !== 'string' || !password) throw new Error('password is required'); const params = { ...DEFAULT_SCRYPT_PARAMS, ...(options.params || {}) }; const salt = options.salt || crypto.randomBytes(16).toString('hex'); const key = crypto.scryptSync(password, salt, params.keylen, { N: params.N, r: params.r, p: params.p }); return `scrypt:${params.N}:${params.r}:${params.p}:${params.keylen}:${salt}:${key.toString('hex')}`; }
function safeEq(a, b) { const A = Buffer.from(String(a || ''), 'hex'), B = Buffer.from(String(b || ''), 'hex'); return A.length > 0 && A.length === B.length && crypto.timingSafeEqual(A, B); }
function verifyPassword(password, encodedHash) { if (typeof password !== 'string' || typeof encodedHash !== 'string') return false; const parts = encodedHash.split(':'); if (parts.length !== 7 || parts[0] !== 'scrypt') return false; const [, N, r, pp, k, salt, hex] = parts; try { const out = crypto.scryptSync(password, salt, Number(k), { N: Number(N), r: Number(r), p: Number(pp) }).toString('hex'); return safeEq(out, hex); } catch { return false; } }
function createEmptyAccounts() { return { version: 1, users: [] }; }
function normalizeLibraryAccess(a = {}) { const mode = ['none', 'all', 'folders'].includes(String(a.mode || 'none')) ? String(a.mode || 'none') : 'none'; const folders = Array.isArray(a.folders) ? a.folders.map(normalizeFolderPermissionPath).filter(Boolean) : []; return { mode, folders: Array.from(new Set(folders)).sort() }; }
function normalizeFolderPermissionPath(value) { const parts = String(value || '').replace(/\\/g, '/').split('/').map(x => x.trim()).filter(Boolean); if (!parts.length || parts.some(x => x === '.' || x === '..')) return ''; return parts.join('/'); }
function normalizeFolderMutationAccess(a = {}) { const moveFolders = Array.isArray(a.moveFolders) ? a.moveFolders.map(normalizeFolderPermissionPath).filter(Boolean) : []; const deleteFolders = Array.isArray(a.deleteFolders) ? a.deleteFolders.map(normalizeFolderPermissionPath).filter(Boolean) : []; return { moveFolders: Array.from(new Set(moveFolders)).sort(), deleteFolders: Array.from(new Set(deleteFolders)).sort() }; }
function normalizeAppPermissions(a = {}) { return { fullSearch: a.fullSearch !== false }; }
function isFolderPathInsideLibraryAccess(libraryAccess, folderPath) { const access = normalizeLibraryAccess(libraryAccess || { mode: 'none', folders: [] }); const target = normalizeFolderPermissionPath(folderPath); if (!target) return false; if (access.mode === 'all') return true; if (access.mode !== 'folders') return false; return access.folders.some(folder => target === folder || target.startsWith(folder + '/')); }
function assertFolderMutationAccessInsideLibraryAccess(libraryAccess, folderMutationAccess) { const access = normalizeLibraryAccess(libraryAccess || { mode: 'none', folders: [] }); const mutation = normalizeFolderMutationAccess(folderMutationAccess || {}); const invalid = mutation.moveFolders.concat(mutation.deleteFolders).filter(folder => !isFolderPathInsideLibraryAccess(access, folder)); if (invalid.length) throw accountError(400, '폴더 이동/삭제 권한은 라이브러리 접근 권한 범위 안에서만 지정할 수 있습니다.', 'FOLDER_MUTATION_ACCESS_OUTSIDE_LIBRARY_ACCESS'); return mutation; }
function iso(v) { const d = v ? new Date(v) : null; return d && Number.isFinite(d.getTime()) ? d.toISOString() : new Date(0).toISOString(); }
function optionalIso(v) { const d = v ? new Date(v) : null; return d && Number.isFinite(d.getTime()) ? d.toISOString() : ''; }
function generateTemporaryPassword() { return crypto.randomBytes(12).toString('base64url') + '-T9'; }
function normalizeAccountRecord(r = {}) {
  const id = normalizeUsername(r.id || r.username), username = normalizeUsername(r.username || id);
  if (!id || !username) return null;
  return {
    id,
    username,
    passwordHash: String(r.passwordHash || ''),
    enabled: r.enabled !== false,
    sessionVersion: Math.max(1, Number(r.sessionVersion || 1)),
    accessVersion: Math.max(1, Number(r.accessVersion || 1)),
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
    lastLoginAt: optionalIso(r.lastLoginAt),
    lastPasswordResetAt: optionalIso(r.lastPasswordResetAt),
    lastPasswordChangedAt: optionalIso(r.lastPasswordChangedAt),
    lastSessionRevokedAt: optionalIso(r.lastSessionRevokedAt),
    libraryAccess: normalizeLibraryAccess(r.libraryAccess),
    folderMutationAccess: normalizeFolderMutationAccess(r.folderMutationAccess),
    appPermissions: normalizeAppPermissions(r.appPermissions)
  };
}
function normalizeAccountsDocument(input = {}) { const records = Array.isArray(input && input.users) ? input.users : []; const seen = new Set(), users = []; for (const u of records.map(normalizeAccountRecord).filter(Boolean)) { if (seen.has(u.id) || seen.has(u.username)) continue; seen.add(u.id); seen.add(u.username); users.push(u); } return { version: 1, users }; }
function safe(u) { if (!u) return null; const { passwordHash, ...rest } = u; return { ...rest }; }

function createAccountService(options = {}) {
  const accountsPath = options.accountsPath;
  if (!accountsPath) throw new Error('createAccountService requires accountsPath');
  const logger = options.logger || console;
  let accounts = createEmptyAccounts();

  function load() { const loaded = loadJsonWithBackup(accountsPath, createEmptyAccounts()); accounts = normalizeAccountsDocument(loaded.data || createEmptyAccounts()); return accounts; }
  function save(cb = () => {}) { try { fs.mkdirSync(path.dirname(accountsPath), { recursive: true }); if (fs.existsSync(accountsPath)) { try { fs.copyFileSync(accountsPath, `${accountsPath}.bak`); } catch {} } fs.writeFileSync(accountsPath, JSON.stringify(accounts, null, 2), 'utf8'); cb(null); } catch (e) { logger.error('account store save failed:', e.message); cb(e); } }
  function listUsers() { return accounts.users.map(safe); }
  function findUserByUsername(v) { const u = normalizeUsername(v); return accounts.users.find(x => x.username === u || x.id === u) || null; }
  function findUserById(v) { const u = normalizeUsername(v); return accounts.users.find(x => x.id === u) || null; }
  function createUser(input = {}, cb = () => {}) { let next; try { const username = validateUsername(input.username || input.id); validateUserPassword(input.password); if (findUserByUsername(username)) throw accountError(409, '이미 존재하는 사용자입니다.', 'USER_EXISTS'); const now = new Date().toISOString(); const libraryAccess = normalizeLibraryAccess(input.libraryAccess || { mode: 'none', folders: [] }); const folderMutationAccess = assertFolderMutationAccessInsideLibraryAccess(libraryAccess, input.folderMutationAccess || {}); next = normalizeAccountRecord({ id: username, username, passwordHash: hashPassword(input.password), enabled: input.enabled !== false, sessionVersion: 1, createdAt: now, updatedAt: now, accessVersion: 1, libraryAccess, folderMutationAccess, appPermissions: normalizeAppPermissions(input.appPermissions) }); accounts.users.push(next); accounts = normalizeAccountsDocument(accounts); } catch (e) { cb(e); return null; } save(e => cb(e, safe(next))); return safe(next); }
  function updateUser(userId, patch = {}, cb = () => {}) {
    let out;
    try {
      const u = findUserById(userId);
      if (!u) throw accountError(404, '사용자를 찾을 수 없습니다.', 'USER_NOT_FOUND');
      const hasEnabled = Object.prototype.hasOwnProperty.call(patch, 'enabled');
      const hasLibraryAccess = Object.prototype.hasOwnProperty.call(patch, 'libraryAccess');
      const hasFolderMutationAccess = Object.prototype.hasOwnProperty.call(patch, 'folderMutationAccess');
      const hasAppPermissions = Object.prototype.hasOwnProperty.call(patch, 'appPermissions');
      const now = new Date().toISOString();
      const beforeEnabled = u.enabled !== false;
      const nextEnabled = hasEnabled ? patch.enabled !== false : beforeEnabled;
      const nextLibraryAccess = hasLibraryAccess ? normalizeLibraryAccess(patch.libraryAccess) : normalizeLibraryAccess(u.libraryAccess);
      const nextFolderMutationAccess = hasFolderMutationAccess ? normalizeFolderMutationAccess(patch.folderMutationAccess) : normalizeFolderMutationAccess(u.folderMutationAccess);
      const nextAppPermissions = hasAppPermissions ? normalizeAppPermissions(patch.appPermissions) : normalizeAppPermissions(u.appPermissions);
      assertFolderMutationAccessInsideLibraryAccess(nextLibraryAccess, nextFolderMutationAccess);
      if (hasEnabled) {
        if (beforeEnabled !== nextEnabled) {
          u.sessionVersion = Math.max(1, Number(u.sessionVersion || 1)) + 1;
          u.lastSessionRevokedAt = now;
        }
        u.enabled = nextEnabled;
      }
      if (hasLibraryAccess) {
        const before = JSON.stringify(normalizeLibraryAccess(u.libraryAccess));
        u.libraryAccess = nextLibraryAccess;
        if (before !== JSON.stringify(u.libraryAccess)) u.accessVersion = Math.max(1, Number(u.accessVersion || 1)) + 1;
      }
      if (hasFolderMutationAccess) {
        const before = JSON.stringify(normalizeFolderMutationAccess(u.folderMutationAccess));
        u.folderMutationAccess = nextFolderMutationAccess;
        if (before !== JSON.stringify(u.folderMutationAccess)) u.accessVersion = Math.max(1, Number(u.accessVersion || 1)) + 1;
      }
      if (hasAppPermissions) {
        const before = JSON.stringify(normalizeAppPermissions(u.appPermissions));
        u.appPermissions = nextAppPermissions;
        if (before !== JSON.stringify(u.appPermissions)) u.accessVersion = Math.max(1, Number(u.accessVersion || 1)) + 1;
      }
      u.updatedAt = now;
      out = safe(u);
    } catch (e) { cb(e); return null; }
    save(e => cb(e, out));
    return out;
  }
  function resetPassword(userId, password, cb = () => {}) { let out; try { const u = findUserById(userId); if (!u) throw accountError(404, '사용자를 찾을 수 없습니다.', 'USER_NOT_FOUND'); validateUserPassword(password); u.passwordHash = hashPassword(password); u.sessionVersion = Math.max(1, Number(u.sessionVersion || 1)) + 1; u.lastPasswordResetAt = new Date().toISOString(); u.lastSessionRevokedAt = u.lastPasswordResetAt; u.updatedAt = u.lastPasswordResetAt; out = safe(u); } catch (e) { cb(e); return null; } save(e => cb(e, out)); return out; }
  function resetPasswordWithTemporary(userId, cb = () => {}) { const temporaryPassword = generateTemporaryPassword(); const user = resetPassword(userId, temporaryPassword, (err, out) => cb(err, err ? null : { user: out, temporaryPassword })); return user ? { user, temporaryPassword } : null; }
  function changePassword(userId, currentPassword, newPassword, cb = () => {}) { let out; try { const u = findUserById(userId); if (!u) throw accountError(404, '사용자를 찾을 수 없습니다.', 'USER_NOT_FOUND'); if (!verifyPassword(String(currentPassword || ''), u.passwordHash)) throw accountError(403, '현재 비밀번호가 일치하지 않습니다.', 'CURRENT_PASSWORD_INVALID'); validateUserPassword(newPassword); if (verifyPassword(newPassword, u.passwordHash)) throw accountError(400, '새 비밀번호는 현재 비밀번호와 달라야 합니다.', 'PASSWORD_REUSE_BLOCKED'); u.passwordHash = hashPassword(newPassword); u.sessionVersion = Math.max(1, Number(u.sessionVersion || 1)) + 1; u.lastPasswordChangedAt = new Date().toISOString(); u.lastSessionRevokedAt = u.lastPasswordChangedAt; u.updatedAt = u.lastPasswordChangedAt; out = safe(u); } catch (e) { cb(e); return null; } save(e => cb(e, out)); return out; }
  function recordSuccessfulLogin(userId, cb = () => {}) { let out; try { const u = findUserById(userId); if (!u) throw accountError(404, '사용자를 찾을 수 없습니다.', 'USER_NOT_FOUND'); u.lastLoginAt = new Date().toISOString(); u.updatedAt = u.updatedAt || u.lastLoginAt; out = safe(u); } catch (e) { cb(e); return null; } save(e => cb(e, out)); return out; }
  function revokeUserSessions(userId, cb = () => {}) { let out; try { const u = findUserById(userId); if (!u) throw accountError(404, '사용자를 찾을 수 없습니다.', 'USER_NOT_FOUND'); u.sessionVersion = Math.max(1, Number(u.sessionVersion || 1)) + 1; u.lastSessionRevokedAt = new Date().toISOString(); u.updatedAt = u.lastSessionRevokedAt; out = safe(u); } catch (e) { cb(e); return null; } save(e => cb(e, out)); return out; }
  function deleteUser(userId, options = {}, cb = () => {}) { let out; try { const u = findUserById(userId); if (!u) throw accountError(404, '사용자를 찾을 수 없습니다.', 'USER_NOT_FOUND'); const confirmText = String(options && options.confirmText || ''); if (confirmText !== `DELETE:${u.username}`) throw accountError(400, `삭제 확인 문구로 DELETE:${u.username} 를 입력해야 합니다.`, 'DELETE_CONFIRM_REQUIRED'); out = safe(u); accounts.users = accounts.users.filter(x => x.id !== u.id); accounts = normalizeAccountsDocument(accounts); } catch (e) { cb(e); return null; } save(e => cb(e, out)); return out; }
  function authenticateUser(username, password) { const u = findUserByUsername(username); if (!u || u.enabled === false) return null; return verifyPassword(password, u.passwordHash) ? safe(u) : null; }
  function isUserSessionCurrent(session = {}) { if (!session || session.kind !== USER_SESSION_KIND) return false; const u = findUserById(session.userId); return !!(u && u.enabled !== false && Number(u.sessionVersion || 1) === Number(session.sessionVersion || 0)); }

  return {
    load,
    save,
    listUsers,
    findUserByUsername,
    findUserById,
    createUser,
    updateUser,
    resetPassword,
    resetPasswordWithTemporary,
    changePassword,
    recordSuccessfulLogin,
    revokeUserSessions,
    deleteUser,
    authenticateUser,
    isUserSessionCurrent,
    getUserLibraryAccess: (id) => { const u = findUserById(id); return u ? normalizeLibraryAccess(u.libraryAccess) : { mode: 'none', folders: [] }; },
    getUserFolderMutationAccess: (id) => { const u = findUserById(id); return u ? normalizeFolderMutationAccess(u.folderMutationAccess) : { moveFolders: [], deleteFolders: [] }; },
    getUserAppPermissions: (id) => { const u = findUserById(id); return u ? normalizeAppPermissions(u.appPermissions) : normalizeAppPermissions({}); },
    canUserFullSearch: (id) => { const u = findUserById(id); return u ? normalizeAppPermissions(u.appPermissions).fullSearch !== false : false; },
    getUserAccessSnapshot: (id) => { const u = findUserById(id); return u ? { userId: u.id, username: u.username, enabled: u.enabled !== false, accessVersion: Math.max(1, Number(u.accessVersion || 1)), libraryAccess: normalizeLibraryAccess(u.libraryAccess), folderMutationAccess: normalizeFolderMutationAccess(u.folderMutationAccess), appPermissions: normalizeAppPermissions(u.appPermissions), permissionPass: TXT_READER_MULTI_FULL_SEARCH_PERMISSION_PASS } : null; },
    normalizeAccountsDocument: () => normalizeAccountsDocument(accounts)
  };
}

module.exports = { TXT_READER_MULTI_OWNER_CONSOLE_PASS, TXT_READER_MULTI_PASSWORD_HASH_PASS, TXT_READER_MULTI_USER_ACCOUNT_PASS, TXT_READER_MULTI_ACCOUNT_PASSWORD_OPERATIONS_PASS, TXT_READER_MULTI_FOLDER_MUTATION_ACCESS_PASS, TXT_READER_MULTI_FULL_SEARCH_PERMISSION_PASS, OWNER_SESSION_KIND, USER_SESSION_KIND, DEFAULT_SCRYPT_PARAMS, USER_PASSWORD_MIN_LENGTH, normalizeUsername, validateUsername, validateUserPassword, hashPassword, verifyPassword, generateTemporaryPassword, createEmptyAccounts, normalizeLibraryAccess, normalizeFolderMutationAccess, normalizeAppPermissions, isFolderPathInsideLibraryAccess, assertFolderMutationAccessInsideLibraryAccess, normalizeAccountRecord, normalizeAccountsDocument, createAccountService };
