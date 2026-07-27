const fs = require('fs');
const path = require('path');
const { loadJsonWithBackup, loadJsonWithBackupAsync, atomicWriteJsonSync, atomicWriteJsonAsync, durableRenameSync, durableRemoveSync, durableRenameAsync, durableRemoveAsync, fsyncDirectorySync, fsyncDirectoryAsync } = require('../repositories/json-file-store');

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
  const out = Object.create(null);
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  for (const [rawKey, rawValue] of Object.entries(input)) {
    if (Object.keys(out).length >= MAX_LANGUAGE_ENTRIES) break;
    const key = String(rawKey || '').trim().replace(/\s+/g, ' ').slice(0, MAX_TEXT_KEY_LENGTH);
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') continue;
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
  let mutationQueue = Promise.resolve();
  let storageReconciled = false;
  if (!siteLanguagesDir) throw new Error('createSiteLanguageService requires siteLanguagesDir');

  function existsWithBackup(filePath) {
    return !!filePath && (fs.existsSync(filePath) || fs.existsSync(filePath + '.bak'));
  }

  async function existsWithBackupAsync(filePath) {
    return !!filePath && (await pathExists(filePath) || await pathExists(filePath + '.bak'));
  }

  function languageFileNames(names = []) {
    const canonical = new Set();
    for (const rawName of names) {
      const name = String(rawName || '');
      const lower = name.toLowerCase();
      if (lower.endsWith('.json')) canonical.add(name);
      else if (lower.endsWith('.json.bak')) canonical.add(name.slice(0, -4));
    }
    return Array.from(canonical).sort();
  }

  function deleteJournalPath(id) { return path.join(siteLanguagesDir, `.delete-${normalizeLanguageId(id)}.json`); }

  function reconcileDeletingFilesSync() {
    if (storageReconciled) return;
    fs.mkdirSync(siteLanguagesDir, { recursive:true });
    let entries = [];
    try { entries = fs.readdirSync(siteLanguagesDir, { withFileTypes:true }); } catch { entries = []; }
    const journals = new Map();
    for (const entry of entries) {
      const match = entry.isFile() && entry.name.match(/^\.delete-([a-z0-9_-]+)\.json$/);
      if (!match) continue;
      const journalPath = path.join(siteLanguagesDir, entry.name);
      const loaded = loadJsonWithBackup(journalPath, null);
      if (loaded.ok && loaded.data && loaded.data.id) journals.set(normalizeLanguageId(loaded.data.id), journalPath);
    }
    for (const [id, journalPath] of journals) {
      const prefix = `${id}.json`;
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (entry.name === prefix || entry.name === `${prefix}.bak` || entry.name.startsWith(`${prefix}.`) && entry.name.endsWith('.deleting')) {
          try { durableRemoveSync(path.join(siteLanguagesDir, entry.name), { force:true }); } catch {}
        }
      }
      try { durableRemoveSync(journalPath, { force:true }); } catch {}
    }
    entries = (() => { try { return fs.readdirSync(siteLanguagesDir, { withFileTypes:true }); } catch { return []; } })();
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.deleting')) continue;
      const match = entry.name.match(/^(.*\.json(?:\.bak)?)\.\d+\.\d+\.\d+\.deleting$/);
      if (!match) continue;
      const staged = path.join(siteLanguagesDir, entry.name);
      const original = path.join(siteLanguagesDir, match[1]);
      try { if (!fs.existsSync(original)) durableRenameSync(staged, original); else durableRemoveSync(staged, { force:true }); } catch {}
    }
    storageReconciled = true;
    try { fsyncDirectorySync(siteLanguagesDir); } catch {}
  }

  async function reconcileDeletingFilesAsync() {
    if (storageReconciled) return;
    await fs.promises.mkdir(siteLanguagesDir, { recursive:true });
    let entries = [];
    try { entries = await fs.promises.readdir(siteLanguagesDir, { withFileTypes:true }); } catch { entries = []; }
    const journals = new Map();
    for (const entry of entries) {
      const match = entry.isFile() && entry.name.match(/^\.delete-([a-z0-9_-]+)\.json$/);
      if (!match) continue;
      const journalPath = path.join(siteLanguagesDir, entry.name);
      const loaded = await loadJsonWithBackupAsync(journalPath, null);
      if (loaded.ok && loaded.data && loaded.data.id) journals.set(normalizeLanguageId(loaded.data.id), journalPath);
    }
    for (const [id, journalPath] of journals) {
      const prefix = `${id}.json`;
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (entry.name === prefix || entry.name === `${prefix}.bak` || entry.name.startsWith(`${prefix}.`) && entry.name.endsWith('.deleting')) {
          try { await durableRemoveAsync(path.join(siteLanguagesDir, entry.name), { force:true }); } catch {}
        }
      }
      try { await durableRemoveAsync(journalPath, { force:true }); } catch {}
    }
    try { entries = await fs.promises.readdir(siteLanguagesDir, { withFileTypes:true }); } catch { entries = []; }
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.deleting')) continue;
      const match = entry.name.match(/^(.*\.json(?:\.bak)?)\.\d+\.\d+\.\d+\.deleting$/);
      if (!match) continue;
      const staged = path.join(siteLanguagesDir, entry.name);
      const original = path.join(siteLanguagesDir, match[1]);
      try { let exists=true; try { await fs.promises.access(original); } catch { exists=false; } if (!exists) await durableRenameAsync(staged, original); else await durableRemoveAsync(staged, { force:true }); } catch {}
    }
    storageReconciled = true;
    try { await fsyncDirectoryAsync(siteLanguagesDir); } catch {}
  }

  function ensureDir() {
    fs.mkdirSync(siteLanguagesDir, { recursive: true });
    reconcileDeletingFilesSync();
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
    const loaded = loadJsonWithBackup(filePath, null);
    if (!loaded.ok) throw siteLanguageError(500, '언어팩 파일을 읽을 수 없습니다.', 'SITE_LANGUAGE_READ_FAILED');
    if (source === 'storage' && loaded.source === 'backup') {
      try { atomicWriteJsonSync(filePath, loaded.data); }
      catch (error) { logger?.warn?.('site language backup recovery heal failed:', path.basename(filePath), error.message); }
    }
    const record = normalizeLanguageRecord(loaded.data);
    record.source = source;
    record.bundled = source === 'bundle';
    return record;
  }

  function readDirectoryRecords(dir, source = 'storage') {
    const out = [];
    if (!dir || !fs.existsSync(dir)) return out;
    const files = languageFileNames(fs.readdirSync(dir));
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
    if (existsWithBackup(filePath)) return publicLanguageRecord(readFile(filePath, 'storage'));
    const bundlePath = bundleFileForId(id);
    if (bundlePath && existsWithBackup(bundlePath)) return publicLanguageRecord(readFile(bundlePath, 'bundle'));
    throw siteLanguageError(404, '언어팩을 찾을 수 없습니다.', 'SITE_LANGUAGE_NOT_FOUND');
  }

  function saveLanguage(input = {}, cb = () => {}) {
    let record;
    try {
      ensureDir();
      const id = normalizeLanguageId(input.id || input.code || '');
      const filePath = fileForId(id);
      const existing = existsWithBackup(filePath) ? readFile(filePath) : null;
      record = normalizeLanguageRecord({ ...(existing || {}), ...(input || {}), id, createdAt: existing && existing.createdAt });
      record.updatedAt = new Date().toISOString();
      atomicWriteJsonSync(filePath, record);
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
    const staged = [];
    let journalPath = '';
    try {
      ensureDir();
      const normalizedId = normalizeLanguageId(id);
      const filePath = fileForId(normalizedId);
      if (!existsWithBackup(filePath)) {
        const bundlePath = bundleFileForId(normalizedId);
        if (bundlePath && existsWithBackup(bundlePath)) throw siteLanguageError(403, '기본 제공 언어팩은 삭제할 수 없습니다.', 'BUNDLED_SITE_LANGUAGE_READ_ONLY');
        throw siteLanguageError(404, '언어팩을 찾을 수 없습니다.', 'SITE_LANGUAGE_NOT_FOUND');
      }
      deleted = publicLanguageRecord(readFile(filePath, 'storage'));
      journalPath = deleteJournalPath(normalizedId);
      atomicWriteJsonSync(journalPath, { schemaVersion:1, id:normalizedId, createdAt:new Date().toISOString() });
      for (const source of [filePath, filePath + '.bak']) {
        if (!fs.existsSync(source)) continue;
        const target = `${source}.${process.pid}.${Date.now()}.${staged.length}.deleting`;
        durableRenameSync(source, target);
        staged.push([source, target]);
      }
      for (const [, target] of staged) durableRemoveSync(target, { force:true });
      durableRemoveSync(journalPath, { force:true });
    } catch (err) {
      if (!journalPath) {
        for (const [source, target] of staged.slice().reverse()) {
          try { if (fs.existsSync(target)) durableRenameSync(target, source); } catch {}
        }
      }
      cb(err);
      return null;
    }
    const payload = { ok:true, pass:TXT_READER_MULTI_SITE_LANGUAGE_SERVICE_PASS, deletedLanguage:deleted };
    cb(null, payload);
    return payload;
  }

  async function ensureDirAsync() {
    await fs.promises.mkdir(siteLanguagesDir, { recursive:true });
    await reconcileDeletingFilesAsync();
  }

  async function pathExists(filePath) {
    if (!filePath) return false;
    try { await fs.promises.access(filePath, fs.constants.F_OK); return true; }
    catch { return false; }
  }

  async function readFileAsync(filePath, source = 'storage') {
    const loaded = await loadJsonWithBackupAsync(filePath, null);
    if (!loaded.ok) throw siteLanguageError(500, '언어팩 파일을 읽을 수 없습니다.', 'SITE_LANGUAGE_READ_FAILED');
    if (source === 'storage' && loaded.source === 'backup') {
      try { await atomicWriteJsonAsync(filePath, loaded.data); }
      catch (error) { logger?.warn?.('site language backup recovery heal failed:', path.basename(filePath), error.message); }
    }
    const record = normalizeLanguageRecord(loaded.data);
    record.source = source;
    record.bundled = source === 'bundle';
    return record;
  }

  async function readDirectoryRecordsAsync(dir, source = 'storage') {
    if (!dir) return [];
    let files;
    try { files = languageFileNames((await fs.promises.readdir(dir, { withFileTypes:true })).filter(entry => entry.isFile()).map(entry => entry.name)); }
    catch (error) { if (error && error.code === 'ENOENT') return []; throw error; }
    const records = await Promise.all(files.slice(0, MAX_SITE_LANGUAGES).map(async (name) => {
      try { return await readFileAsync(path.join(dir, name), source); }
      catch (error) {
        if (logger && typeof logger.warn === 'function') logger.warn('site language pack skipped:', name, error.message);
        return null;
      }
    }));
    return records.filter(Boolean);
  }

  async function allRecordsAsync() {
    await ensureDirAsync();
    const [bundled, stored] = await Promise.all([
      readDirectoryRecordsAsync(bundledSiteLanguagesDir, 'bundle'),
      readDirectoryRecordsAsync(siteLanguagesDir, 'storage')
    ]);
    const byId = new Map();
    for (const record of bundled) byId.set(record.id, record);
    for (const record of stored) byId.set(record.id, record);
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric:true, sensitivity:'base' }));
  }

  async function listLanguagesAsync({ includeDisabled = true } = {}) {
    return (await allRecordsAsync())
      .filter(record => includeDisabled || record.enabled !== false)
      .slice(0, MAX_SITE_LANGUAGES)
      .map(publicLanguageRecord);
  }

  async function getLanguageAsync(id) {
    await ensureDirAsync();
    const filePath = fileForId(id);
    if (await existsWithBackupAsync(filePath)) return publicLanguageRecord(await readFileAsync(filePath, 'storage'));
    const bundlePath = bundleFileForId(id);
    if (bundlePath && await existsWithBackupAsync(bundlePath)) return publicLanguageRecord(await readFileAsync(bundlePath, 'bundle'));
    throw siteLanguageError(404, '언어팩을 찾을 수 없습니다.', 'SITE_LANGUAGE_NOT_FOUND');
  }

  function serializeMutation(operation) {
    const task = mutationQueue.catch(() => {}).then(operation);
    mutationQueue = task;
    return task;
  }

  async function saveLanguageAsync(input = {}) {
    return serializeMutation(async () => {
      await ensureDirAsync();
      const id = normalizeLanguageId(input.id || input.code || '');
      const filePath = fileForId(id);
      const existing = await existsWithBackupAsync(filePath) ? await readFileAsync(filePath, 'storage') : null;
      const record = normalizeLanguageRecord({ ...(existing || {}), ...(input || {}), id, createdAt:existing && existing.createdAt });
      record.updatedAt = new Date().toISOString();
      await atomicWriteJsonAsync(filePath, record);
      return { ok:true, pass:TXT_READER_MULTI_SITE_LANGUAGE_SERVICE_PASS, language:publicLanguageRecord(record) };
    });
  }

  async function deleteLanguageAsync(id) {
    return serializeMutation(async () => {
      await ensureDirAsync();
      const normalizedId = normalizeLanguageId(id);
      const filePath = fileForId(normalizedId);
      if (!await existsWithBackupAsync(filePath)) {
        const bundlePath = bundleFileForId(normalizedId);
        if (bundlePath && await existsWithBackupAsync(bundlePath)) throw siteLanguageError(403, '기본 제공 언어팩은 삭제할 수 없습니다.', 'BUNDLED_SITE_LANGUAGE_READ_ONLY');
        throw siteLanguageError(404, '언어팩을 찾을 수 없습니다.', 'SITE_LANGUAGE_NOT_FOUND');
      }
      const deleted = publicLanguageRecord(await readFileAsync(filePath, 'storage'));
      const journalPath = deleteJournalPath(normalizedId);
      await atomicWriteJsonAsync(journalPath, { schemaVersion:1, id:normalizedId, createdAt:new Date().toISOString() });
      const staged = [];
      for (const source of [filePath, filePath + '.bak']) {
        if (!await pathExists(source)) continue;
        const target = `${source}.${process.pid}.${Date.now()}.${staged.length}.deleting`;
        await durableRenameAsync(source, target);
        staged.push([source, target]);
      }
      await Promise.all(staged.map(([, target]) => durableRemoveAsync(target, { force:true })));
      await durableRemoveAsync(journalPath, { force:true });
      return { ok:true, pass:TXT_READER_MULTI_SITE_LANGUAGE_SERVICE_PASS, deletedLanguage:deleted };
    });
  }


  return {
    pass: TXT_READER_MULTI_SITE_LANGUAGE_SERVICE_PASS,
    ensureDir,
    listLanguages,
    listLanguagesAsync,
    listPublicLanguages: () => listLanguages({ includeDisabled: false }),
    listPublicLanguagesAsync: () => listLanguagesAsync({ includeDisabled:false }),
    getLanguage,
    getLanguageAsync,
    saveLanguage,
    saveLanguageAsync,
    deleteLanguage,
    deleteLanguageAsync,
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
