const fs = require('fs');
const path = require('path');

const TXT_READER_MULTI_SITE_LANGUAGE_SERVICE_PASS = 'v560-site-language-pack-service-pass';
const SITE_LANGUAGE_BUNDLE_FALLBACK_PASS = 'v564-site-language-bundle-fallback-pass';
const MAX_SITE_LANGUAGES = 80;
const MAX_LANGUAGE_ENTRIES = 1200;
const MAX_TEXT_KEY_LENGTH = 260;
const MAX_TEXT_VALUE_LENGTH = 800;

function siteLanguageError(statusCode, message, code = 'SITE_LANGUAGE_ERROR') {
  const err = new Error(message || code);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

function normalizeLanguageId(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^site:/, '')
    .replace(/^custom:/, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

function normalizeLanguageMap(input = {}) {
  const out = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  for (const [rawKey, rawValue] of Object.entries(input)) {
    if (Object.keys(out).length >= MAX_LANGUAGE_ENTRIES) break;
    const key = String(rawKey || '').trim().replace(/\s+/g, ' ').slice(0, MAX_TEXT_KEY_LENGTH);
    const value = String(rawValue ?? '').trim().replace(/\r\n/g, '\n').slice(0, MAX_TEXT_VALUE_LENGTH);
    if (!key || !value) continue;
    out[key] = value;
  }
  return out;
}

function parseLanguageMap(raw = '') {
  const text = String(raw || '').trim();
  if (!text) return {};
  if (text.startsWith('{')) return normalizeLanguageMap(JSON.parse(text));
  const out = {};
  text.split(/\r?\n/).forEach(line => {
    if (Object.keys(out).length >= MAX_LANGUAGE_ENTRIES) return;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const separator = trimmed.includes('=>') ? '=>' : trimmed.includes('\t') ? '\t' : '=';
    const index = trimmed.indexOf(separator);
    if (index <= 0) return;
    const key = trimmed.slice(0, index).trim().replace(/\s+/g, ' ').slice(0, MAX_TEXT_KEY_LENGTH);
    const value = trimmed.slice(index + separator.length).trim().slice(0, MAX_TEXT_VALUE_LENGTH);
    if (key && value) out[key] = value;
  });
  return normalizeLanguageMap(out);
}

function normalizeLanguageRecord(input = {}) {
  if (!input || typeof input !== 'object') throw siteLanguageError(400, '언어팩 payload가 올바르지 않습니다.', 'SITE_LANGUAGE_INVALID_PAYLOAD');
  const id = normalizeLanguageId(input.id || input.code || input.value || '');
  if (!id) throw siteLanguageError(400, '언어팩 id/code가 필요합니다.', 'SITE_LANGUAGE_ID_REQUIRED');
  const name = String(input.name || input.label || id).trim().slice(0, 60) || id;
  const description = String(input.description || '').trim().slice(0, 240);
  const map = normalizeLanguageMap(input.map || input.translations || input.entries || parseLanguageMap(input.rawMap || input.text || ''));
  if (!Object.keys(map).length) throw siteLanguageError(400, '언어팩에는 표시 문구가 1개 이상 필요합니다.', 'SITE_LANGUAGE_MAP_REQUIRED');
  const now = new Date().toISOString();
  return {
    id,
    name,
    description,
    enabled: input.enabled !== false,
    map,
    createdAt: String(input.createdAt || now),
    updatedAt: String(input.updatedAt || now),
    pass: TXT_READER_MULTI_SITE_LANGUAGE_SERVICE_PASS
  };
}

function publicLanguageRecord(record = {}) {
  return {
    id: record.id || '',
    name: record.name || record.id || '',
    description: record.description || '',
    enabled: record.enabled !== false,
    map: normalizeLanguageMap(record.map || {}),
    updatedAt: record.updatedAt || '',
    source: record.source || (record.bundled ? 'bundle' : 'storage'),
    bundled: !!record.bundled,
    pass: TXT_READER_MULTI_SITE_LANGUAGE_SERVICE_PASS
  };
}

function createSiteLanguageService(options = {}) {
  const siteLanguagesDir = options.siteLanguagesDir;
  const bundledSiteLanguagesDir = options.bundledSiteLanguagesDir || null;
  const logger = options.logger || console;
  if (!siteLanguagesDir) throw new Error('createSiteLanguageService requires siteLanguagesDir');

  function ensureDir() {
    fs.mkdirSync(siteLanguagesDir, { recursive: true });
  }

  function fileForId(id) {
    const normalized = normalizeLanguageId(id);
    if (!normalized) throw siteLanguageError(400, '언어팩 id가 올바르지 않습니다.', 'SITE_LANGUAGE_ID_REQUIRED');
    return path.join(siteLanguagesDir, `${normalized}.json`);
  }

  function bundleFileForId(id) {
    if (!bundledSiteLanguagesDir) return null;
    const normalized = normalizeLanguageId(id);
    if (!normalized) throw siteLanguageError(400, '언어팩 id가 올바르지 않습니다.', 'SITE_LANGUAGE_ID_REQUIRED');
    return path.join(bundledSiteLanguagesDir, `${normalized}.json`);
  }

  function readFile(filePath, source = 'storage') {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const record = normalizeLanguageRecord(parsed);
    record.source = source;
    record.bundled = source === 'bundle';
    return record;
  }

  function readDirectoryRecords(dir, source = 'storage') {
    const out = [];
    if (!dir || !fs.existsSync(dir)) return out;
    const files = fs.readdirSync(dir).filter(name => name.toLowerCase().endsWith('.json')).sort();
    for (const name of files) {
      if (out.length >= MAX_SITE_LANGUAGES) break;
      try {
        out.push(readFile(path.join(dir, name), source));
      } catch (err) {
        if (logger && typeof logger.warn === 'function') logger.warn('site language pack skipped:', name, err.message);
      }
    }
    return out;
  }

  function allRecords() {
    ensureDir();
    const byId = new Map();
    for (const record of readDirectoryRecords(bundledSiteLanguagesDir, 'bundle')) {
      byId.set(record.id, record);
    }
    for (const record of readDirectoryRecords(siteLanguagesDir, 'storage')) {
      byId.set(record.id, record);
    }
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true, sensitivity: 'base' }));
  }

  function listLanguages({ includeDisabled = true } = {}) {
    return allRecords()
      .filter(record => includeDisabled || record.enabled !== false)
      .slice(0, MAX_SITE_LANGUAGES)
      .map(publicLanguageRecord);
  }

  function getLanguage(id) {
    ensureDir();
    const filePath = fileForId(id);
    if (fs.existsSync(filePath)) return publicLanguageRecord(readFile(filePath, 'storage'));
    const bundlePath = bundleFileForId(id);
    if (bundlePath && fs.existsSync(bundlePath)) return publicLanguageRecord(readFile(bundlePath, 'bundle'));
    throw siteLanguageError(404, '언어팩을 찾을 수 없습니다.', 'SITE_LANGUAGE_NOT_FOUND');
  }

  function saveLanguage(input = {}, cb = () => {}) {
    let record;
    try {
      ensureDir();
      const id = normalizeLanguageId(input.id || input.code || '');
      const filePath = fileForId(id);
      const existing = fs.existsSync(filePath) ? readFile(filePath) : null;
      record = normalizeLanguageRecord({ ...(existing || {}), ...(input || {}), id, createdAt: existing && existing.createdAt });
      record.updatedAt = new Date().toISOString();
      fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8');
    } catch (err) {
      cb(err);
      return null;
    }
    const payload = { ok: true, pass: TXT_READER_MULTI_SITE_LANGUAGE_SERVICE_PASS, language: publicLanguageRecord(record) };
    cb(null, payload);
    return payload;
  }

  function deleteLanguage(id, cb = () => {}) {
    let deleted = null;
    try {
      ensureDir();
      const filePath = fileForId(id);
      if (!fs.existsSync(filePath)) {
        const bundlePath = bundleFileForId(id);
        if (bundlePath && fs.existsSync(bundlePath)) {
          throw siteLanguageError(403, '기본 제공 언어팩은 삭제할 수 없습니다.', 'BUNDLED_SITE_LANGUAGE_READ_ONLY');
        }
        throw siteLanguageError(404, '언어팩을 찾을 수 없습니다.', 'SITE_LANGUAGE_NOT_FOUND');
      }
      deleted = publicLanguageRecord(readFile(filePath, 'storage'));
      fs.unlinkSync(filePath);
    } catch (err) {
      cb(err);
      return null;
    }
    const payload = { ok: true, pass: TXT_READER_MULTI_SITE_LANGUAGE_SERVICE_PASS, deletedLanguage: deleted };
    cb(null, payload);
    return payload;
  }

  return {
    pass: TXT_READER_MULTI_SITE_LANGUAGE_SERVICE_PASS,
    ensureDir,
    listLanguages,
    listPublicLanguages: () => listLanguages({ includeDisabled: false }),
    getLanguage,
    saveLanguage,
    deleteLanguage,
    normalizeLanguageId,
    normalizeLanguageMap,
    parseLanguageMap,
    normalizeLanguageRecord
  };
}

module.exports = {
  TXT_READER_MULTI_SITE_LANGUAGE_SERVICE_PASS,
  SITE_LANGUAGE_BUNDLE_FALLBACK_PASS,
  MAX_SITE_LANGUAGES,
  MAX_LANGUAGE_ENTRIES,
  normalizeLanguageId,
  normalizeLanguageMap,
  parseLanguageMap,
  normalizeLanguageRecord,
  publicLanguageRecord,
  createSiteLanguageService
};
