const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { loadJsonWithBackup } = require('../repositories/json-file-store');
const { normalizeLibraryAccess, normalizeFolderMutationAccess, normalizeUsername, normalizeAppPermissions, assertFolderMutationAccessInsideLibraryAccess } = require('./account-service');

const TXT_READER_MULTI_SIGNUP_CODE_PASS = 'v397-signup-code-service-pass';
const TXT_READER_MULTI_REGISTER_PASS = 'v397-signup-code-register-pass';
const DEFAULT_SIGNUP_CODE_BYTES = 12;
const DEFAULT_SIGNUP_CODE_TTL_DAYS = 30;

function signupCodeError(statusCode, message, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

function normalizeSignupCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '');
}

function hashSignupCode(value) {
  const normalized = normalizeSignupCode(value);
  if (!normalized) throw signupCodeError(400, '가입코드를 입력하세요.', 'INVALID_SIGNUP_CODE');
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

function formatSignupCode(raw) {
  const normalized = normalizeSignupCode(raw);
  return normalized.replace(/(.{4})/g, '$1-').replace(/-$/, '');
}

function generateSignupCode(bytes = DEFAULT_SIGNUP_CODE_BYTES) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buf = crypto.randomBytes(Math.max(8, Number(bytes) || DEFAULT_SIGNUP_CODE_BYTES));
  let out = '';
  for (const b of buf) out += alphabet[b % alphabet.length];
  return formatSignupCode(out.slice(0, 16));
}

function createEmptySignupCodes() {
  return { version: 1, codes: [] };
}

function isoOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function defaultExpiresAt() {
  return new Date(Date.now() + DEFAULT_SIGNUP_CODE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function normalizeCodeRecord(record = {}) {
  const id = String(record.id || '').trim() || `code_${crypto.randomBytes(8).toString('hex')}`;
  const codeHash = String(record.codeHash || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(codeHash)) return null;
  const maxUses = Math.max(1, Number(record.maxUses || 1));
  const usedCount = Math.max(0, Number(record.usedCount || 0));
  return {
    id,
    codeHash,
    label: String(record.label || '').trim().slice(0, 120),
    enabled: record.enabled !== false,
    maxUses,
    usedCount: Math.min(usedCount, maxUses),
    expiresAt: isoOrNull(record.expiresAt) || defaultExpiresAt(),
    createdAt: isoOrNull(record.createdAt) || new Date(0).toISOString(),
    updatedAt: isoOrNull(record.updatedAt) || isoOrNull(record.createdAt) || new Date(0).toISOString(),
    createdBy: String(record.createdBy || '__owner__'),
    libraryAccess: normalizeLibraryAccess(record.libraryAccess || { mode: 'none', folders: [] }),
    folderMutationAccess: normalizeFolderMutationAccess(record.folderMutationAccess || {}),
    appPermissions: normalizeAppPermissions(record.appPermissions || {}),
    defaultEnabled: record.defaultEnabled !== false,
    lastUsedAt: isoOrNull(record.lastUsedAt),
    lastUsedBy: normalizeUsername(record.lastUsedBy || '') || ''
  };
}

function normalizeSignupCodesDocument(input = {}) {
  const seen = new Set();
  const codes = [];
  for (const item of (Array.isArray(input.codes) ? input.codes : []).map(normalizeCodeRecord).filter(Boolean)) {
    if (seen.has(item.id) || seen.has(item.codeHash)) continue;
    seen.add(item.id);
    seen.add(item.codeHash);
    codes.push(item);
  }
  return { version: 1, codes };
}

function isExpired(record, now = Date.now()) {
  const expiresAt = new Date(record.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

function isExhausted(record) {
  return Number(record.usedCount || 0) >= Number(record.maxUses || 1);
}

function publicCode(record) {
  if (!record) return null;
  return {
    id: record.id,
    label: record.label,
    enabled: record.enabled !== false,
    maxUses: Math.max(1, Number(record.maxUses || 1)),
    usedCount: Math.max(0, Number(record.usedCount || 0)),
    remainingUses: Math.max(0, Number(record.maxUses || 1) - Number(record.usedCount || 0)),
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    libraryAccess: normalizeLibraryAccess(record.libraryAccess || { mode: 'none', folders: [] }),
    folderMutationAccess: normalizeFolderMutationAccess(record.folderMutationAccess || {}),
    appPermissions: normalizeAppPermissions(record.appPermissions || {}),
    defaultEnabled: record.defaultEnabled !== false,
    lastUsedAt: record.lastUsedAt || null,
    lastUsedBy: record.lastUsedBy || '',
    expired: isExpired(record),
    exhausted: isExhausted(record)
  };
}

function createSignupCodeService(options = {}) {
  const signupCodesPath = options.signupCodesPath;
  if (!signupCodesPath) throw new Error('createSignupCodeService requires signupCodesPath');
  const logger = options.logger || console;
  let doc = createEmptySignupCodes();

  function load() {
    const loaded = loadJsonWithBackup(signupCodesPath, createEmptySignupCodes());
    doc = normalizeSignupCodesDocument(loaded.data || createEmptySignupCodes());
    return doc;
  }

  function save(cb = () => {}) {
    try {
      fs.mkdirSync(path.dirname(signupCodesPath), { recursive: true });
      if (fs.existsSync(signupCodesPath)) {
        try { fs.copyFileSync(signupCodesPath, `${signupCodesPath}.bak`); } catch {}
      }
      fs.writeFileSync(signupCodesPath, JSON.stringify(doc, null, 2), 'utf8');
      cb(null);
    } catch (err) {
      if (logger && typeof logger.error === 'function') logger.error('signup code store save failed:', err.message);
      cb(err);
    }
  }

  function listCodes() {
    return doc.codes.map(publicCode);
  }

  function findCodeById(codeId) {
    const id = String(codeId || '').trim();
    return doc.codes.find((code) => code.id === id) || null;
  }

  function findCodeByRaw(rawCode) {
    const hash = hashSignupCode(rawCode);
    return doc.codes.find((code) => code.codeHash === hash) || null;
  }

  function assertUsable(record, now = Date.now()) {
    if (!record) throw signupCodeError(400, '가입코드가 유효하지 않습니다.', 'INVALID_SIGNUP_CODE');
    if (record.enabled === false) throw signupCodeError(400, '가입코드가 유효하지 않습니다.', 'INVALID_SIGNUP_CODE');
    if (isExpired(record, now)) throw signupCodeError(400, '가입코드가 유효하지 않습니다.', 'INVALID_SIGNUP_CODE');
    if (isExhausted(record)) throw signupCodeError(400, '가입코드가 유효하지 않습니다.', 'INVALID_SIGNUP_CODE');
    return record;
  }

  function previewSignupCode(rawCode) {
    const record = assertUsable(findCodeByRaw(rawCode));
    return publicCode(record);
  }

  function createCode(input = {}, cb = () => {}) {
    let out;
    try {
      const rawCode = input.signupCode ? formatSignupCode(input.signupCode) : generateSignupCode(input.codeBytes);
      const codeHash = hashSignupCode(rawCode);
      if (doc.codes.some((code) => code.codeHash === codeHash)) throw signupCodeError(409, '이미 존재하는 가입코드입니다.', 'SIGNUP_CODE_EXISTS');
      const now = new Date().toISOString();
      const record = normalizeCodeRecord({
        id: `code_${crypto.randomBytes(8).toString('hex')}`,
        codeHash,
        label: input.label || '',
        enabled: input.enabled !== false,
        maxUses: input.maxUses || 1,
        usedCount: 0,
        expiresAt: isoOrNull(input.expiresAt) || defaultExpiresAt(),
        createdAt: now,
        updatedAt: now,
        createdBy: input.createdBy || '__owner__',
        libraryAccess: normalizeLibraryAccess(input.libraryAccess || { mode: 'none', folders: [] }),
        folderMutationAccess: assertFolderMutationAccessInsideLibraryAccess(input.libraryAccess || { mode: 'none', folders: [] }, input.folderMutationAccess || {}),
        appPermissions: normalizeAppPermissions(input.appPermissions || {}),
        defaultEnabled: input.defaultEnabled !== false
      });
      if (!record) throw signupCodeError(400, '가입코드 레코드를 생성할 수 없습니다.', 'INVALID_SIGNUP_CODE_RECORD');
      doc.codes.push(record);
      out = { ok: true, pass: TXT_READER_MULTI_SIGNUP_CODE_PASS, signupCode: rawCode, code: publicCode(record) };
    } catch (err) { cb(err); return null; }
    save((err) => cb(err, out));
    return out;
  }

  function updateCode(codeId, patch = {}, cb = () => {}) {
    let out;
    try {
      const record = findCodeById(codeId);
      if (!record) throw signupCodeError(404, '가입코드를 찾을 수 없습니다.', 'SIGNUP_CODE_NOT_FOUND');
      const hasLibraryAccess = Object.prototype.hasOwnProperty.call(patch, 'libraryAccess');
      const hasFolderMutationAccess = Object.prototype.hasOwnProperty.call(patch, 'folderMutationAccess');
      const hasAppPermissions = Object.prototype.hasOwnProperty.call(patch, 'appPermissions');
      const nextLibraryAccess = hasLibraryAccess ? normalizeLibraryAccess(patch.libraryAccess || { mode: 'none', folders: [] }) : normalizeLibraryAccess(record.libraryAccess || { mode: 'none', folders: [] });
      const nextFolderMutationAccess = hasFolderMutationAccess ? normalizeFolderMutationAccess(patch.folderMutationAccess || {}) : normalizeFolderMutationAccess(record.folderMutationAccess || {});
      const nextAppPermissions = hasAppPermissions ? normalizeAppPermissions(patch.appPermissions || {}) : normalizeAppPermissions(record.appPermissions || {});
      assertFolderMutationAccessInsideLibraryAccess(nextLibraryAccess, nextFolderMutationAccess);
      if (Object.prototype.hasOwnProperty.call(patch, 'label')) record.label = String(patch.label || '').trim().slice(0, 120);
      if (Object.prototype.hasOwnProperty.call(patch, 'enabled')) record.enabled = patch.enabled !== false;
      if (Object.prototype.hasOwnProperty.call(patch, 'maxUses')) record.maxUses = Math.max(1, Number(patch.maxUses || 1));
      if (Object.prototype.hasOwnProperty.call(patch, 'expiresAt')) record.expiresAt = isoOrNull(patch.expiresAt) || record.expiresAt;
      if (hasLibraryAccess) record.libraryAccess = nextLibraryAccess;
      if (hasFolderMutationAccess) record.folderMutationAccess = nextFolderMutationAccess;
      if (hasAppPermissions) record.appPermissions = nextAppPermissions;
      if (Object.prototype.hasOwnProperty.call(patch, 'defaultEnabled')) record.defaultEnabled = patch.defaultEnabled !== false;
      record.usedCount = Math.min(Math.max(0, Number(record.usedCount || 0)), Math.max(1, Number(record.maxUses || 1)));
      record.updatedAt = new Date().toISOString();
      out = { ok: true, pass: TXT_READER_MULTI_SIGNUP_CODE_PASS, code: publicCode(record) };
    } catch (err) { cb(err); return null; }
    save((err) => cb(err, out));
    return out;
  }
  function revokeCode(codeId, cb = () => {}) {
    return updateCode(codeId, { enabled: false }, cb);
  }

  function deleteCode(codeId, cb = () => {}) {
    let out;
    try {
      const record = findCodeById(codeId);
      if (!record) throw signupCodeError(404, '가입코드를 찾을 수 없습니다.', 'SIGNUP_CODE_NOT_FOUND');
      doc.codes = doc.codes.filter((code) => code.id !== record.id);
      out = { ok: true, pass: TXT_READER_MULTI_SIGNUP_CODE_PASS, deletedCode: publicCode(record) };
    } catch (err) { cb(err); return null; }
    save((err) => cb(err, out));
    return out;
  }

  function markUsed(rawCode, user, cb = () => {}) {
    let out;
    try {
      const record = assertUsable(findCodeByRaw(rawCode));
      record.usedCount = Math.max(0, Number(record.usedCount || 0)) + 1;
      record.lastUsedAt = new Date().toISOString();
      record.lastUsedBy = normalizeUsername(user && (user.username || user.id) || '');
      record.updatedAt = record.lastUsedAt;
      out = { ok: true, pass: TXT_READER_MULTI_REGISTER_PASS, code: publicCode(record) };
    } catch (err) { cb(err); return null; }
    save((err) => cb(err, out));
    return out;
  }

  function restoreRecordUsage(record, previous) {
    if (!record || !previous) return;
    record.usedCount = previous.usedCount;
    record.lastUsedAt = previous.lastUsedAt;
    record.lastUsedBy = previous.lastUsedBy;
    record.updatedAt = previous.updatedAt;
  }

  function saveOrThrow() {
    let failure = null;
    save((err) => { failure = err || null; });
    if (failure) throw failure;
  }

  function consumeCodeForRegistration(rawCode, createUser, cb = () => {}) {
    let out;
    let record = null;
    let previous = null;
    try {
      if (typeof createUser !== 'function') throw signupCodeError(500, '가입 처리기가 준비되지 않았습니다.', 'SIGNUP_CONSUMER_UNAVAILABLE');
      record = assertUsable(findCodeByRaw(rawCode));
      previous = {
        usedCount: Math.max(0, Number(record.usedCount || 0)),
        lastUsedAt: record.lastUsedAt || null,
        lastUsedBy: record.lastUsedBy || '',
        updatedAt: record.updatedAt || null
      };
      const usedAt = new Date().toISOString();
      record.usedCount = previous.usedCount + 1;
      record.lastUsedAt = usedAt;
      record.updatedAt = usedAt;
      // Persist the reservation before account creation so a one-time code cannot be
      // consumed twice by concurrent registration requests in the same process.
      saveOrThrow();

      let user = null;
      try {
        user = createUser(publicCode(record));
      } catch (err) {
        restoreRecordUsage(record, previous);
        try { saveOrThrow(); } catch (rollbackError) {
          if (logger && typeof logger.error === 'function') logger.error('signup code consume rollback failed:', rollbackError.message);
        }
        throw err;
      }
      record.lastUsedBy = normalizeUsername(user && (user.username || user.id) || '');
      record.updatedAt = new Date().toISOString();
      saveOrThrow();
      out = { ok: true, pass: TXT_READER_MULTI_REGISTER_PASS, code: publicCode(record), user };
      cb(null, out);
      return out;
    } catch (err) {
      cb(err);
      return null;
    }
  }

  return {
    load,
    save,
    listCodes,
    findCodeById,
    previewSignupCode,
    createCode,
    updateCode,
    revokeCode,
    deleteCode,
    markUsed,
    consumeCodeForRegistration,
    normalizeSignupCodesDocument: () => normalizeSignupCodesDocument(doc),
    signupCodesPath
  };
}

module.exports = {
  TXT_READER_MULTI_SIGNUP_CODE_PASS,
  TXT_READER_MULTI_REGISTER_PASS,
  DEFAULT_SIGNUP_CODE_TTL_DAYS,
  normalizeSignupCode,
  hashSignupCode,
  formatSignupCode,
  generateSignupCode,
  createEmptySignupCodes,
  normalizeCodeRecord,
  normalizeSignupCodesDocument,
  createSignupCodeService
};
