const crypto = require('crypto');
const { USER_PASSWORD_MIN_LENGTH } = require('../config/env');
const { loadJsonWithBackup, atomicWriteJsonSync, atomicWriteJsonAsync } = require('../repositories/json-file-store');

const TXT_READER_MULTI_OWNER_CONSOLE_PASS = 'v389-txt-reader-multi-owner-console-pass';
const TXT_READER_MULTI_PASSWORD_HASH_PASS = 'v389-txt-reader-multi-password-hash-pass';
const TXT_READER_MULTI_USER_ACCOUNT_PASS = 'v389-txt-reader-multi-user-account-pass';
const TXT_READER_MULTI_ACCOUNT_PASSWORD_OPERATIONS_PASS = 'v402-account-password-operations-pass';
const TXT_READER_MULTI_FOLDER_MUTATION_ACCESS_PASS = 'v490-folder-mutation-access-pass';
const TXT_READER_MULTI_FULL_SEARCH_PERMISSION_PASS = 'v551-full-search-permission-pass';
const TXT_READER_MULTI_METADATA_ACCESS_PERMISSION_PASS = 'v588-metadata-access-permission-pass';
const LOGIN_TELEMETRY_ASYNC_PASS = 'v661-login-telemetry-async-pass';
const OWNER_SESSION_KIND = 'owner';
const USER_SESSION_KIND = 'user';
const DEFAULT_SCRYPT_PARAMS = Object.freeze({ N: 16384, r: 8, p: 1, keylen: 64 });
const DUMMY_PASSWORD_HASH = 'scrypt:16384:8:1:64:4f7d4b3572b831d4f090f0416c9558f1:703c919d881da3fc820db93549df12a02a54d7b50ce5c976eceb3b404f2b5f9b7d440afa9ed40dce333a0d73b908145dd8f4e651a26e635c304d80efcd0f8869';

function normalizeUsername(value) { return String(value || '').trim().toLowerCase(); }
function accountError(statusCode, message, code) { const e = new Error(message); e.statusCode = statusCode; e.code = code; return e; }
function validateUsername(v) { const u = normalizeUsername(v); if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(u)) throw accountError(400, '아이디는 영문 소문자, 숫자, 점, 밑줄, 하이픈 3~32자로 입력하세요.', 'INVALID_USERNAME'); return u; }
function validateUserPassword(v) { if (typeof v !== 'string' || v.length < USER_PASSWORD_MIN_LENGTH) throw accountError(400, `비밀번호는 최소 ${USER_PASSWORD_MIN_LENGTH}글자 이상이어야 합니다.`, 'INVALID_PASSWORD'); return v; }
function hashPassword(password, options = {}) { if (typeof password !== 'string' || !password) throw new Error('password is required'); const params = { ...DEFAULT_SCRYPT_PARAMS, ...(options.params || {}) }; const salt = options.salt || crypto.randomBytes(16).toString('hex'); const key = crypto.scryptSync(password, salt, params.keylen, { N: params.N, r: params.r, p: params.p }); return `scrypt:${params.N}:${params.r}:${params.p}:${params.keylen}:${salt}:${key.toString('hex')}`; }
function hashPasswordAsync(password, options = {}) {
  if (typeof password !== 'string' || !password) return Promise.reject(new Error('password is required'));
  const params = { ...DEFAULT_SCRYPT_PARAMS, ...(options.params || {}) };
  const salt = options.salt || crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, params.keylen, { N:params.N, r:params.r, p:params.p }, (error, key) => {
      if (error) return reject(error);
      return resolve(`scrypt:${params.N}:${params.r}:${params.p}:${params.keylen}:${salt}:${key.toString('hex')}`);
    });
  });
}
function safeEq(a, b) { const A = Buffer.from(String(a || ''), 'hex'), B = Buffer.from(String(b || ''), 'hex'); return A.length > 0 && A.length === B.length && crypto.timingSafeEqual(A, B); }
function parseScryptHash(encodedHash) { if (typeof encodedHash !== 'string') return null; const parts = encodedHash.split(':'); if (parts.length !== 7 || parts[0] !== 'scrypt') return null; const [, rawN, rawR, rawP, rawK, salt, hex] = parts; const N=Number(rawN), r=Number(rawR), p=Number(rawP), keylen=Number(rawK); if (!Number.isInteger(N) || N < 1024 || N > 1048576 || (N & (N-1)) !== 0) return null; if (!Number.isInteger(r) || r < 1 || r > 32 || !Number.isInteger(p) || p < 1 || p > 16 || !Number.isInteger(keylen) || keylen < 16 || keylen > 128) return null; if (!/^[a-f0-9]{16,256}$/i.test(String(salt || '')) || !/^[a-f0-9]+$/i.test(String(hex || '')) || String(hex).length !== keylen * 2) return null; return { N, r, p, keylen, salt, hex }; }
function verifyPassword(password, encodedHash) { if (typeof password !== 'string') return false; const params=parseScryptHash(encodedHash); if (!params) return false; try { const out = crypto.scryptSync(password, params.salt, params.keylen, { N:params.N, r:params.r, p:params.p }).toString('hex'); return safeEq(out, params.hex); } catch { return false; } }
function verifyPasswordAsync(password, encodedHash) { if (typeof password !== 'string') return Promise.resolve(false); const params=parseScryptHash(encodedHash); if (!params) return Promise.resolve(false); return new Promise(resolve => { crypto.scrypt(password, params.salt, params.keylen, { N:params.N, r:params.r, p:params.p }, (error, key) => resolve(!error && safeEq(key.toString('hex'), params.hex))); }); }
function createEmptyAccounts() { return { version: 1, users: [] }; }
function normalizeLibraryAccess(a = {}) { const mode = ['none', 'all', 'folders'].includes(String(a.mode || 'none')) ? String(a.mode || 'none') : 'none'; const folders = Array.isArray(a.folders) ? a.folders.map(normalizeFolderPermissionPath).filter(Boolean) : []; return { mode, folders: Array.from(new Set(folders)).sort() }; }
function normalizeFolderPermissionPath(value) { const parts = String(value || '').replace(/\\/g, '/').split('/').map(x => x.trim()).filter(Boolean); if (!parts.length || parts.some(x => x === '.' || x === '..')) return ''; return parts.join('/'); }
function normalizeFolderMutationAccess(a = {}) { const moveFolders = Array.isArray(a.moveFolders) ? a.moveFolders.map(normalizeFolderPermissionPath).filter(Boolean) : []; const deleteFolders = Array.isArray(a.deleteFolders) ? a.deleteFolders.map(normalizeFolderPermissionPath).filter(Boolean) : []; return { moveFolders: Array.from(new Set(moveFolders)).sort(), deleteFolders: Array.from(new Set(deleteFolders)).sort() }; }
function normalizeAppPermissions(a = {}) { return { fullSearch: a.fullSearch !== false, metadataAccess: a.metadataAccess === true }; }
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
  const writeJsonSync = typeof options.writeJsonSync === 'function' ? options.writeJsonSync : atomicWriteJsonSync;
  const writeJsonAsync = typeof options.writeJsonAsync === 'function' ? options.writeJsonAsync : atomicWriteJsonAsync;
  const loginTelemetryPath = options.loginTelemetryPath || `${accountsPath}.login-telemetry.json`;
  let accounts = createEmptyAccounts();
  let loginTelemetry = { version:1, users:{} };
  let loginTelemetryWrite = Promise.resolve();

  function cloneAccounts() {
    return normalizeAccountsDocument(JSON.parse(JSON.stringify(accounts)));
  }

  function load() {
    const loaded = loadJsonWithBackup(accountsPath, createEmptyAccounts());
    accounts = normalizeAccountsDocument(loaded.data || createEmptyAccounts());
    if (loaded.source === 'backup') {
      try { writeJsonSync(accountsPath, accounts); }
      catch (error) { if (logger && typeof logger.error === 'function') logger.error('account store backup recovery heal failed:', error.message); }
    }
    const telemetryLoaded = loadJsonWithBackup(loginTelemetryPath, { version:1, users:{} });
    const telemetryUsers = telemetryLoaded.data && typeof telemetryLoaded.data.users === 'object' && !Array.isArray(telemetryLoaded.data.users)
      ? telemetryLoaded.data.users : {};
    loginTelemetry = { version:1, users:{} };
    for (const user of accounts.users) {
      const candidate = optionalIso(telemetryUsers[user.id]);
      if (!candidate) continue;
      loginTelemetry.users[user.id] = candidate;
      if (!user.lastLoginAt || Date.parse(candidate) > Date.parse(user.lastLoginAt)) user.lastLoginAt = candidate;
    }
    return accounts;
  }

  function persistLoginTelemetryAsync() {
    const snapshot = { version:1, users:{ ...loginTelemetry.users } };
    const write = () => writeJsonAsync(loginTelemetryPath, snapshot);
    loginTelemetryWrite = loginTelemetryWrite.catch(() => {}).then(write);
    return loginTelemetryWrite;
  }

  function persistCurrent() {
    writeJsonSync(accountsPath, accounts);
  }

  function save(cb = () => {}) {
    try {
      persistCurrent();
      cb(null);
      return true;
    } catch (error) {
      if (logger && typeof logger.error === 'function') logger.error('account store save failed:', error.message);
      cb(error);
      return false;
    }
  }

  function commitMutation(previous, out, cb = () => {}) {
    try {
      persistCurrent();
      cb(null, out);
      return out;
    } catch (error) {
      accounts = previous;
      if (logger && typeof logger.error === 'function') logger.error('account store mutation rollback:', error.message);
      cb(error);
      return null;
    }
  }

  function listUsers() { return accounts.users.map(safe); }
  function findUserByUsername(value) { const username = normalizeUsername(value); return accounts.users.find(item => item.username === username || item.id === username) || null; }
  function findUserById(value) { const userId = normalizeUsername(value); return accounts.users.find(item => item.id === userId) || null; }

  function createUser(input = {}, cb = () => {}) {
    const previous = cloneAccounts();
    let next;
    try {
      const username = validateUsername(input.username || input.id);
      validateUserPassword(input.password);
      if (findUserByUsername(username)) throw accountError(409, '이미 존재하는 사용자입니다.', 'USER_EXISTS');
      const now = new Date().toISOString();
      const libraryAccess = normalizeLibraryAccess(input.libraryAccess || { mode: 'none', folders: [] });
      const folderMutationAccess = assertFolderMutationAccessInsideLibraryAccess(libraryAccess, input.folderMutationAccess || {});
      next = normalizeAccountRecord({
        id: username,
        username,
        passwordHash: hashPassword(input.password),
        enabled: input.enabled !== false,
        sessionVersion: 1,
        createdAt: now,
        updatedAt: now,
        accessVersion: 1,
        libraryAccess,
        folderMutationAccess,
        appPermissions: normalizeAppPermissions(input.appPermissions)
      });
      accounts.users.push(next);
      accounts = normalizeAccountsDocument(accounts);
    } catch (error) {
      cb(error);
      return null;
    }
    return commitMutation(previous, safe(next), cb);
  }

  async function createUserAsync(input = {}) {
    const username = validateUsername(input.username || input.id);
    validateUserPassword(input.password);
    if (findUserByUsername(username)) throw accountError(409, '이미 존재하는 사용자입니다.', 'USER_EXISTS');
    const libraryAccess = normalizeLibraryAccess(input.libraryAccess || { mode:'none', folders:[] });
    const folderMutationAccess = assertFolderMutationAccessInsideLibraryAccess(libraryAccess, input.folderMutationAccess || {});
    const passwordHash = await hashPasswordAsync(input.password);
    return new Promise((resolve, reject) => {
      const previous = cloneAccounts();
      try {
        if (findUserByUsername(username)) throw accountError(409, '이미 존재하는 사용자입니다.', 'USER_EXISTS');
        const now = new Date().toISOString();
        const next = normalizeAccountRecord({
          id:username,
          username,
          passwordHash,
          enabled:input.enabled !== false,
          sessionVersion:1,
          createdAt:now,
          updatedAt:now,
          accessVersion:1,
          libraryAccess,
          folderMutationAccess,
          appPermissions:normalizeAppPermissions(input.appPermissions)
        });
        accounts.users.push(next);
        accounts = normalizeAccountsDocument(accounts);
        commitMutation(previous, safe(next), (error, out) => error ? reject(error) : resolve(out));
      } catch (error) {
        accounts = previous;
        reject(error);
      }
    });
  }

  function updateUser(userId, patch = {}, cb = () => {}) {
    const previous = cloneAccounts();
    let out;
    try {
      const user = findUserById(userId);
      if (!user) throw accountError(404, '사용자를 찾을 수 없습니다.', 'USER_NOT_FOUND');
      const hasEnabled = Object.prototype.hasOwnProperty.call(patch, 'enabled');
      const hasLibraryAccess = Object.prototype.hasOwnProperty.call(patch, 'libraryAccess');
      const hasFolderMutationAccess = Object.prototype.hasOwnProperty.call(patch, 'folderMutationAccess');
      const hasAppPermissions = Object.prototype.hasOwnProperty.call(patch, 'appPermissions');
      const now = new Date().toISOString();
      const beforeEnabled = user.enabled !== false;
      const nextEnabled = hasEnabled ? patch.enabled !== false : beforeEnabled;
      const nextLibraryAccess = hasLibraryAccess ? normalizeLibraryAccess(patch.libraryAccess) : normalizeLibraryAccess(user.libraryAccess);
      const nextFolderMutationAccess = hasFolderMutationAccess ? normalizeFolderMutationAccess(patch.folderMutationAccess) : normalizeFolderMutationAccess(user.folderMutationAccess);
      const nextAppPermissions = hasAppPermissions ? normalizeAppPermissions(patch.appPermissions) : normalizeAppPermissions(user.appPermissions);
      assertFolderMutationAccessInsideLibraryAccess(nextLibraryAccess, nextFolderMutationAccess);
      if (hasEnabled) {
        if (beforeEnabled !== nextEnabled) {
          user.sessionVersion = Math.max(1, Number(user.sessionVersion || 1)) + 1;
          user.lastSessionRevokedAt = now;
        }
        user.enabled = nextEnabled;
      }
      if (hasLibraryAccess) {
        const before = JSON.stringify(normalizeLibraryAccess(user.libraryAccess));
        user.libraryAccess = nextLibraryAccess;
        if (before !== JSON.stringify(user.libraryAccess)) user.accessVersion = Math.max(1, Number(user.accessVersion || 1)) + 1;
      }
      if (hasFolderMutationAccess) {
        const before = JSON.stringify(normalizeFolderMutationAccess(user.folderMutationAccess));
        user.folderMutationAccess = nextFolderMutationAccess;
        if (before !== JSON.stringify(user.folderMutationAccess)) user.accessVersion = Math.max(1, Number(user.accessVersion || 1)) + 1;
      }
      if (hasAppPermissions) {
        const before = JSON.stringify(normalizeAppPermissions(user.appPermissions));
        user.appPermissions = nextAppPermissions;
        if (before !== JSON.stringify(user.appPermissions)) user.accessVersion = Math.max(1, Number(user.accessVersion || 1)) + 1;
      }
      user.updatedAt = now;
      out = safe(user);
    } catch (error) {
      cb(error);
      return null;
    }
    return commitMutation(previous, out, cb);
  }

  function mutateUser(userId, mutation, cb = () => {}) {
    const previous = cloneAccounts();
    let out;
    try {
      const user = findUserById(userId);
      if (!user) throw accountError(404, '사용자를 찾을 수 없습니다.', 'USER_NOT_FOUND');
      mutation(user);
      out = safe(user);
    } catch (error) {
      cb(error);
      return null;
    }
    return commitMutation(previous, out, cb);
  }

  function resetPassword(userId, password, cb = () => {}) {
    return mutateUser(userId, (user) => {
      validateUserPassword(password);
      user.passwordHash = hashPassword(password);
      user.sessionVersion = Math.max(1, Number(user.sessionVersion || 1)) + 1;
      user.lastPasswordResetAt = new Date().toISOString();
      user.lastSessionRevokedAt = user.lastPasswordResetAt;
      user.updatedAt = user.lastPasswordResetAt;
    }, cb);
  }

  async function resetPasswordAsync(userId, password) {
    validateUserPassword(password);
    if (!findUserById(userId)) throw accountError(404, '사용자를 찾을 수 없습니다.', 'USER_NOT_FOUND');
    const passwordHash = await hashPasswordAsync(password);
    return new Promise((resolve, reject) => {
      mutateUser(userId, (user) => {
        user.passwordHash = passwordHash;
        user.sessionVersion = Math.max(1, Number(user.sessionVersion || 1)) + 1;
        user.lastPasswordResetAt = new Date().toISOString();
        user.lastSessionRevokedAt = user.lastPasswordResetAt;
        user.updatedAt = user.lastPasswordResetAt;
      }, (error, out) => error ? reject(error) : resolve(out));
    });
  }

  function resetPasswordWithTemporary(userId, cb = () => {}) {
    const temporaryPassword = generateTemporaryPassword();
    const user = resetPassword(userId, temporaryPassword, (error, out) => cb(error, error ? null : { user: out, temporaryPassword }));
    return user ? { user, temporaryPassword } : null;
  }

  async function resetPasswordWithTemporaryAsync(userId) {
    const temporaryPassword = generateTemporaryPassword();
    const user = await resetPasswordAsync(userId, temporaryPassword);
    return { user, temporaryPassword };
  }

  function changePassword(userId, currentPassword, newPassword, cb = () => {}) {
    return mutateUser(userId, (user) => {
      if (!verifyPassword(String(currentPassword || ''), user.passwordHash)) throw accountError(403, '현재 비밀번호가 일치하지 않습니다.', 'CURRENT_PASSWORD_INVALID');
      validateUserPassword(newPassword);
      if (verifyPassword(newPassword, user.passwordHash)) throw accountError(400, '새 비밀번호는 현재 비밀번호와 달라야 합니다.', 'PASSWORD_REUSE_BLOCKED');
      user.passwordHash = hashPassword(newPassword);
      user.sessionVersion = Math.max(1, Number(user.sessionVersion || 1)) + 1;
      user.lastPasswordChangedAt = new Date().toISOString();
      user.lastSessionRevokedAt = user.lastPasswordChangedAt;
      user.updatedAt = user.lastPasswordChangedAt;
    }, cb);
  }

  async function changePasswordAsync(userId, currentPassword, newPassword) {
    validateUserPassword(newPassword);
    const currentUser = findUserById(userId);
    if (!currentUser) throw accountError(404, '사용자를 찾을 수 없습니다.', 'USER_NOT_FOUND');
    const observedHash = currentUser.passwordHash;
    const currentMatches = await verifyPasswordAsync(String(currentPassword || ''), observedHash);
    if (!currentMatches) throw accountError(403, '현재 비밀번호가 일치하지 않습니다.', 'CURRENT_PASSWORD_INVALID');
    const reusesPassword = await verifyPasswordAsync(newPassword, observedHash);
    if (reusesPassword) throw accountError(400, '새 비밀번호는 현재 비밀번호와 달라야 합니다.', 'PASSWORD_REUSE_BLOCKED');
    const passwordHash = await hashPasswordAsync(newPassword);
    return new Promise((resolve, reject) => {
      mutateUser(userId, (user) => {
        if (user.passwordHash !== observedHash) throw accountError(409, '비밀번호가 다른 요청에서 변경되었습니다. 다시 시도하세요.', 'PASSWORD_CHANGED_RETRY');
        user.passwordHash = passwordHash;
        user.sessionVersion = Math.max(1, Number(user.sessionVersion || 1)) + 1;
        user.lastPasswordChangedAt = new Date().toISOString();
        user.lastSessionRevokedAt = user.lastPasswordChangedAt;
        user.updatedAt = user.lastPasswordChangedAt;
      }, (error, out) => error ? reject(error) : resolve(out));
    });
  }

  async function recordSuccessfulLoginAsync(userId) {
    const user = findUserById(userId);
    if (!user) throw accountError(404, '사용자를 찾을 수 없습니다.', 'USER_NOT_FOUND');
    const timestamp = new Date().toISOString();
    user.lastLoginAt = timestamp;
    loginTelemetry.users[user.id] = timestamp;
    await persistLoginTelemetryAsync();
    return safe(user);
  }

  function recordSuccessfulLogin(userId, cb = () => {}) {
    const user = findUserById(userId);
    if (!user) {
      const error = accountError(404, '사용자를 찾을 수 없습니다.', 'USER_NOT_FOUND');
      queueMicrotask(() => cb(error));
      return null;
    }
    const out = safe(user);
    recordSuccessfulLoginAsync(userId).then(value => cb(null, value), cb);
    return out;
  }

  function flushLoginTelemetry() {
    return loginTelemetryWrite;
  }

  function revokeUserSessions(userId, cb = () => {}) {
    return mutateUser(userId, (user) => {
      user.sessionVersion = Math.max(1, Number(user.sessionVersion || 1)) + 1;
      user.lastSessionRevokedAt = new Date().toISOString();
      user.updatedAt = user.lastSessionRevokedAt;
    }, cb);
  }

  function deleteUser(userId, options = {}, cb = () => {}) {
    const previous = cloneAccounts();
    let out;
    try {
      const user = findUserById(userId);
      if (!user) throw accountError(404, '사용자를 찾을 수 없습니다.', 'USER_NOT_FOUND');
      const confirmText = String(options && options.confirmText || '');
      if (confirmText !== `DELETE:${user.username}`) throw accountError(400, `삭제 확인 문구로 DELETE:${user.username} 를 입력해야 합니다.`, 'DELETE_CONFIRM_REQUIRED');
      out = safe(user);
      accounts.users = accounts.users.filter(item => item.id !== user.id);
      accounts = normalizeAccountsDocument(accounts);
    } catch (error) {
      cb(error);
      return null;
    }
    return commitMutation(previous, out, cb);
  }

  function authenticateUser(username, password) { const user = findUserByUsername(username); const eligible = !!(user && user.enabled !== false); const valid = verifyPassword(password, eligible ? user.passwordHash : DUMMY_PASSWORD_HASH); return eligible && valid ? safe(user) : null; }
  async function authenticateUserAsync(username, password) { const user = findUserByUsername(username); const eligible = !!(user && user.enabled !== false); const valid = await verifyPasswordAsync(password, eligible ? user.passwordHash : DUMMY_PASSWORD_HASH); return eligible && valid ? safe(user) : null; }
  function isUserSessionCurrent(session = {}) { if (!session || session.kind !== USER_SESSION_KIND) return false; const user = findUserById(session.userId); return !!(user && user.enabled !== false && Number(user.sessionVersion || 1) === Number(session.sessionVersion || 0)); }

  return {
    load,
    save,
    listUsers,
    findUserByUsername,
    findUserById,
    createUser,
    createUserAsync,
    updateUser,
    resetPassword,
    resetPasswordAsync,
    resetPasswordWithTemporary,
    resetPasswordWithTemporaryAsync,
    changePassword,
    changePasswordAsync,
    recordSuccessfulLogin,
    recordSuccessfulLoginAsync,
    flushLoginTelemetry,
    loginTelemetryPass:LOGIN_TELEMETRY_ASYNC_PASS,
    revokeUserSessions,
    deleteUser,
    authenticateUser,
    authenticateUserAsync,
    isUserSessionCurrent,
    getUserLibraryAccess: (id) => { const user = findUserById(id); return user ? normalizeLibraryAccess(user.libraryAccess) : { mode: 'none', folders: [] }; },
    getUserFolderMutationAccess: (id) => { const user = findUserById(id); return user ? normalizeFolderMutationAccess(user.folderMutationAccess) : { moveFolders: [], deleteFolders: [] }; },
    getUserAppPermissions: (id) => { const user = findUserById(id); return user ? normalizeAppPermissions(user.appPermissions) : normalizeAppPermissions({}); },
    canUserFullSearch: (id) => { const user = findUserById(id); return user ? normalizeAppPermissions(user.appPermissions).fullSearch !== false : false; },
    canUserMetadataAccess: (id) => { const user = findUserById(id); return user ? normalizeAppPermissions(user.appPermissions).metadataAccess === true : false; },
    getUserAccessSnapshot: (id) => { const user = findUserById(id); return user ? { userId: user.id, username: user.username, enabled: user.enabled !== false, accessVersion: Math.max(1, Number(user.accessVersion || 1)), libraryAccess: normalizeLibraryAccess(user.libraryAccess), folderMutationAccess: normalizeFolderMutationAccess(user.folderMutationAccess), appPermissions: normalizeAppPermissions(user.appPermissions), permissionPass: TXT_READER_MULTI_FULL_SEARCH_PERMISSION_PASS, metadataPermissionPass: TXT_READER_MULTI_METADATA_ACCESS_PERMISSION_PASS } : null; },
    normalizeAccountsDocument: () => cloneAccounts()
  };
}

module.exports = { LOGIN_TELEMETRY_ASYNC_PASS, DUMMY_PASSWORD_HASH, TXT_READER_MULTI_OWNER_CONSOLE_PASS, TXT_READER_MULTI_PASSWORD_HASH_PASS, TXT_READER_MULTI_USER_ACCOUNT_PASS, TXT_READER_MULTI_ACCOUNT_PASSWORD_OPERATIONS_PASS, TXT_READER_MULTI_FOLDER_MUTATION_ACCESS_PASS, TXT_READER_MULTI_FULL_SEARCH_PERMISSION_PASS, TXT_READER_MULTI_METADATA_ACCESS_PERMISSION_PASS, OWNER_SESSION_KIND, USER_SESSION_KIND, DEFAULT_SCRYPT_PARAMS, USER_PASSWORD_MIN_LENGTH, normalizeUsername, validateUsername, validateUserPassword, hashPassword, hashPasswordAsync, verifyPassword, verifyPasswordAsync, generateTemporaryPassword, createEmptyAccounts, normalizeLibraryAccess, normalizeFolderMutationAccess, normalizeAppPermissions, isFolderPathInsideLibraryAccess, assertFolderMutationAccessInsideLibraryAccess, normalizeAccountRecord, normalizeAccountsDocument, createAccountService };
