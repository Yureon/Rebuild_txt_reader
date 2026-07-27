const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadJsonWithBackup, loadJsonWithBackupAsync, atomicWriteJsonSync, atomicWriteJsonAsync, durableRenameAsync, durableRemoveAsync, durableRenameSync, durableRemoveSync, fsyncDirectoryAsync, fsyncDirectorySync } = require('../repositories/json-file-store');

const FONT_FILE_MAX_BYTES = 8 * 1024 * 1024;
const FONT_LIBRARY_MAX_FILES = 48;
const FONT_LIBRARY_MAX_TOTAL_BYTES = 64 * 1024 * 1024;
const ALLOWED_FONT_EXTENSIONS = new Set(['.ttf', '.otf', '.woff', '.woff2']);
const USER_FONT_LIBRARY_SCOPE_PASS = 'v426-user-font-library-scope-pass';
const V675_FONT_NOFOLLOW_PASS = 'v675-font-nofollow-pass';

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isPathInside(parentDir, candidatePath) {
  const parent = path.resolve(parentDir);
  const candidate = path.resolve(candidatePath);
  return candidate === parent || candidate.startsWith(parent + path.sep);
}

function createFontService({
  fontDir,
  fontMetaPath,
  legacyFontDir,
  legacyFontMetaPath,
  userDataDir,
  now = () => Date.now(),
  logger = console
} = {}) {
  if (!fontDir) throw new Error('fontDir is required');
  if (!fontMetaPath) throw new Error('fontMetaPath is required');
  if (!legacyFontDir) throw new Error('legacyFontDir is required');
  if (!legacyFontMetaPath) throw new Error('legacyFontMetaPath is required');
  const scopedUserDataDir = userDataDir || path.join(path.dirname(fontDir), 'user-data');
  const mutationQueues = new Map();
  const reconciledScopes = new Set();

  function safeFontOwnerId(value) {
    const cleaned = String(value || '__owner__').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_');
    return cleaned || '__owner__';
  }

  function resolveFontScope(scope = {}) {
    const rawOwnerId = scope && typeof scope === 'object'
      ? (scope.ownerId || scope.userId || scope.scopeId || scope.id || '')
      : scope;
    const ownerId = safeFontOwnerId(rawOwnerId || '__owner__');
    const ownerScoped = ownerId === '__owner__';
    return {
      ownerId,
      userScoped: !ownerScoped,
      fontDir: ownerScoped ? fontDir : path.join(scopedUserDataDir, ownerId, 'fonts'),
      fontMetaPath: ownerScoped ? fontMetaPath : path.join(scopedUserDataDir, ownerId, 'font-library.json'),
      legacyFontDir: ownerScoped ? legacyFontDir : '',
      legacyFontMetaPath: ownerScoped ? legacyFontMetaPath : ''
    };
  }

  function stagedOriginalName(name) {
    const match = String(name || '').match(/^(.*)\.\d+\.\d+(?:\.\d+)?\.deleting$/);
    return match ? safeFontName(match[1]) : '';
  }

  function readFontMetaDirectSync(scoped) {
    for (const candidate of [scoped.fontMetaPath, scoped.legacyFontMetaPath].filter(Boolean)) {
      const loaded = loadJsonWithBackup(candidate, null);
      if (loaded.ok && Array.isArray(loaded.data)) return loaded.data;
    }
    return [];
  }

  async function readFontMetaDirectAsync(scoped) {
    for (const candidate of [scoped.fontMetaPath, scoped.legacyFontMetaPath].filter(Boolean)) {
      const loaded = await loadJsonWithBackupAsync(candidate, null);
      if (loaded.ok && Array.isArray(loaded.data)) return loaded.data;
    }
    return [];
  }

  function reconcileFontStorageSync(scoped) {
    if (reconciledScopes.has(scoped.ownerId)) return;
    const list = readFontMetaDirectSync(scoped);
    const referenced = new Set(list.map(item => safeFontName(item && item.filename || '')).filter(Boolean));
    let changed = false;
    let entries = [];
    try { entries = fs.readdirSync(scoped.fontDir, { withFileTypes:true }); } catch { entries = []; }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const fullPath = path.join(scoped.fontDir, entry.name);
      const originalName = stagedOriginalName(entry.name);
      if (originalName) {
        const originalPath = path.join(scoped.fontDir, originalName);
        try {
          if (referenced.has(originalName) && !fs.existsSync(originalPath)) durableRenameSync(fullPath, originalPath);
          else durableRemoveSync(fullPath, { force:true });
        } catch (error) { logger?.warn?.('font staged recovery failed:', entry.name, error.message); }
        continue;
      }
      if (/\.tmp$/i.test(entry.name)) {
        try { if (now() - fs.statSync(fullPath).mtimeMs > 60 * 60 * 1000) durableRemoveSync(fullPath, { force:true }); } catch {}
      }
    }
    entries = (() => { try { return fs.readdirSync(scoped.fontDir, { withFileTypes:true }); } catch { return []; } })();
    const actual = new Map();
    for (const entry of entries) {
      if (!entry.isFile() || entry.isSymbolicLink()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!ALLOWED_FONT_EXTENSIONS.has(ext)) continue;
      try { actual.set(entry.name, fs.statSync(path.join(scoped.fontDir, entry.name))); } catch {}
    }
    const next = [];
    const familyKeys = new Set();
    for (const item of list) {
      const filename = safeFontName(item && item.filename || '');
      const stat = actual.get(filename);
      if (!filename || !stat) { changed = true; continue; }
      const family = String(item.family || item.name || path.basename(filename, path.extname(filename))).trim() || 'Custom Font';
      const familyKey = family.toLowerCase();
      if (familyKeys.has(familyKey)) { changed = true; continue; }
      familyKeys.add(familyKey);
      next.push({ ...item, name:family, family, filename, size:stat.size, createdAt:Number(item.createdAt) || stat.mtimeMs || now() });
      actual.delete(filename);
    }
    for (const [filename, stat] of actual) {
      let family = path.basename(filename, path.extname(filename)).replace(/_\d+_[a-f0-9]{12}$/i, '') || 'Recovered Font';
      let base = family; let index = 2;
      while (familyKeys.has(family.toLowerCase())) family = `${base} (${index++})`;
      familyKeys.add(family.toLowerCase());
      next.push({ name:family, family, filename, size:stat.size, createdAt:stat.mtimeMs || now(), recovered:true });
      changed = true;
    }
    if (changed) atomicWriteJsonSync(scoped.fontMetaPath, next);
    reconciledScopes.add(scoped.ownerId);
    try { fsyncDirectorySync(scoped.fontDir); } catch {}
  }

  async function reconcileFontStorageAsync(scoped) {
    if (reconciledScopes.has(scoped.ownerId)) return;
    const list = await readFontMetaDirectAsync(scoped);
    const referenced = new Set(list.map(item => safeFontName(item && item.filename || '')).filter(Boolean));
    let entries = [];
    try { entries = await fs.promises.readdir(scoped.fontDir, { withFileTypes:true }); } catch { entries = []; }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const fullPath = path.join(scoped.fontDir, entry.name);
      const originalName = stagedOriginalName(entry.name);
      if (originalName) {
        const originalPath = path.join(scoped.fontDir, originalName);
        try {
          let originalExists = true;
          try { await fs.promises.access(originalPath); } catch { originalExists = false; }
          if (referenced.has(originalName) && !originalExists) await durableRenameAsync(fullPath, originalPath);
          else await durableRemoveAsync(fullPath, { force:true });
        } catch (error) { logger?.warn?.('font staged recovery failed:', entry.name, error.message); }
        continue;
      }
      if (/\.tmp$/i.test(entry.name)) {
        try { const stat = await fs.promises.stat(fullPath); if (now() - stat.mtimeMs > 60 * 60 * 1000) await durableRemoveAsync(fullPath, { force:true }); } catch {}
      }
    }
    try { entries = await fs.promises.readdir(scoped.fontDir, { withFileTypes:true }); } catch { entries = []; }
    const actual = new Map();
    for (const entry of entries) {
      if (!entry.isFile() || entry.isSymbolicLink()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!ALLOWED_FONT_EXTENSIONS.has(ext)) continue;
      try { actual.set(entry.name, await fs.promises.stat(path.join(scoped.fontDir, entry.name))); } catch {}
    }
    const next = [];
    const familyKeys = new Set();
    let changed = false;
    for (const item of list) {
      const filename = safeFontName(item && item.filename || '');
      const stat = actual.get(filename);
      if (!filename || !stat) { changed = true; continue; }
      const family = String(item.family || item.name || path.basename(filename, path.extname(filename))).trim() || 'Custom Font';
      const familyKey = family.toLowerCase();
      if (familyKeys.has(familyKey)) { changed = true; continue; }
      familyKeys.add(familyKey);
      next.push({ ...item, name:family, family, filename, size:stat.size, createdAt:Number(item.createdAt) || stat.mtimeMs || now() });
      actual.delete(filename);
    }
    for (const [filename, stat] of actual) {
      let family = path.basename(filename, path.extname(filename)).replace(/_\d+_[a-f0-9]{12}$/i, '') || 'Recovered Font';
      const base = family; let index = 2;
      while (familyKeys.has(family.toLowerCase())) family = `${base} (${index++})`;
      familyKeys.add(family.toLowerCase());
      next.push({ name:family, family, filename, size:stat.size, createdAt:stat.mtimeMs || now(), recovered:true });
      changed = true;
    }
    if (changed) await atomicWriteJsonAsync(scoped.fontMetaPath, next);
    reconciledScopes.add(scoped.ownerId);
    try { await fsyncDirectoryAsync(scoped.fontDir); } catch {}
  }

  function scanFontDiskUsageSync(scoped) {
    let count = 0; let totalBytes = 0;
    try {
      for (const entry of fs.readdirSync(scoped.fontDir, { withFileTypes:true })) {
        if (!entry.isFile() || !ALLOWED_FONT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
        const stat = fs.statSync(path.join(scoped.fontDir, entry.name)); count += 1; totalBytes += stat.size;
      }
    } catch {}
    return { count, totalBytes };
  }

  async function scanFontDiskUsageAsync(scoped) {
    let count = 0; let totalBytes = 0;
    try {
      for (const entry of await fs.promises.readdir(scoped.fontDir, { withFileTypes:true })) {
        if (!entry.isFile() || !ALLOWED_FONT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
        const stat = await fs.promises.stat(path.join(scoped.fontDir, entry.name)); count += 1; totalBytes += stat.size;
      }
    } catch {}
    return { count, totalBytes };
  }

  function ensureFontStorageReady(scope) {
    const scoped = resolveFontScope(scope);
    if (!fs.existsSync(scoped.fontDir)) fs.mkdirSync(scoped.fontDir, { recursive: true });
    const metaParent = path.dirname(scoped.fontMetaPath);
    if (!fs.existsSync(metaParent)) fs.mkdirSync(metaParent, { recursive: true });
    reconcileFontStorageSync(scoped);
    return scoped;
  }

  async function ensureFontStorageReadyAsync(scope) {
    const scoped = resolveFontScope(scope);
    await fs.promises.mkdir(scoped.fontDir, { recursive:true });
    await fs.promises.mkdir(path.dirname(scoped.fontMetaPath), { recursive:true });
    await reconcileFontStorageAsync(scoped);
    return scoped;
  }

  function withFontMutation(scope, operation) {
    const scoped = resolveFontScope(scope);
    const key = scoped.ownerId;
    const previous = mutationQueues.get(key) || Promise.resolve();
    const task = previous.catch(() => {}).then(() => operation(scoped));
    mutationQueues.set(key, task);
    return task.finally(() => {
      if (mutationQueues.get(key) === task) mutationQueues.delete(key);
    });
  }

  function safeFontName(name) {
    const cleaned = String(name || '').replace(/[^a-zA-Z0-9._-]/g, '_');
    const base = path.basename(cleaned);
    if (!base || base === '.' || base === '..' || /^\.+$/.test(base)) return '';
    return base;
  }

  function getFontLibraryItemUrl(filename) {
    return '/api/fonts/file/' + encodeURIComponent(filename);
  }

  function resolveCandidate(baseDir, filename) {
    if (!baseDir) return '';
    const fullPath = path.resolve(baseDir, filename);
    if (!isPathInside(baseDir, fullPath)) return '';
    return fullPath;
  }

  function resolveFontFilePath(filename, scope) {
    const safeName = safeFontName(filename);
    if (!safeName) return '';
    const scoped = resolveFontScope(scope);
    const candidates = [
      resolveCandidate(scoped.fontDir, safeName),
      resolveCandidate(scoped.legacyFontDir, safeName)
    ].filter(Boolean);
    for (const fp of candidates) {
      try {
        const stat = fs.lstatSync(fp);
        if (!stat.isFile() || stat.isSymbolicLink()) continue;
        const baseReal = fs.realpathSync(path.dirname(fp));
        const fileReal = fs.realpathSync(fp);
        if (isPathInside(baseReal, fileReal)) return fp;
      } catch {}
    }
    return candidates[0] || '';
  }

  function getFontMimeType(filename) {
    const ext = path.extname(String(filename || '')).toLowerCase();
    if (ext === '.ttf') return 'font/ttf';
    if (ext === '.otf') return 'font/otf';
    if (ext === '.woff') return 'font/woff';
    if (ext === '.woff2') return 'font/woff2';
    return 'application/octet-stream';
  }

  function getFontLibraryUsage(list) {
    const items = Array.isArray(list) ? list : [];
    return {
      count: items.length,
      totalBytes: items.reduce((sum, item) => sum + Math.max(0, Number(item && item.size) || 0), 0)
    };
  }

  function loadFontMeta(scope) {
    const scoped = resolveFontScope(scope);
    for (const candidate of [scoped.fontMetaPath, scoped.legacyFontMetaPath].filter(Boolean)) {
      const loaded = loadJsonWithBackup(candidate, null);
      if (loaded.ok && Array.isArray(loaded.data)) {
        if (loaded.source === 'backup') {
          try { atomicWriteJsonSync(candidate, loaded.data); }
          catch (error) { logger?.warn?.('font metadata backup recovery heal failed:', error.message); }
        }
        return loaded.data;
      }
    }
    return [];
  }

  function saveFontMeta(list, scope) {
    const scoped = ensureFontStorageReady(scope);
    atomicWriteJsonSync(scoped.fontMetaPath, Array.isArray(list) ? list : []);
  }

  function normalizeFontLibraryItem(item, scope) {
    try {
      const filename = safeFontName(item && item.filename || '');
      if (!filename) return null;
      const filePath = resolveFontFilePath(filename, scope);
      if (!filePath || !fs.existsSync(filePath)) return null;
      const stat = fs.statSync(filePath);
      const family = String(item && (item.family || item.name) || '').trim() || path.basename(filename, path.extname(filename)) || 'Custom Font';
      return {
        name: family,
        family,
        filename,
        size: Number(item && item.size) || Number(stat.size) || 0,
        createdAt: parseInt(item && item.createdAt, 10) || Number(stat.mtimeMs) || now(),
        url: getFontLibraryItemUrl(filename)
      };
    } catch (_e) {
      return null;
    }
  }

  function listAvailableFontLibraryItems(scope) {
    const scoped = resolveFontScope(scope);
    const rawItems = loadFontMeta(scoped);
    const seenFiles = new Set();
    const seenFamilies = new Set();
    return (Array.isArray(rawItems) ? rawItems : [])
      .map(item => normalizeFontLibraryItem(item, scoped))
      .filter((item) => {
        if (!item) return false;
        const familyKey = String(item.family || '').trim().toLowerCase();
        if (seenFiles.has(item.filename)) return false;
        if (familyKey && seenFamilies.has(familyKey)) return false;
        seenFiles.add(item.filename);
        if (familyKey) seenFamilies.add(familyKey);
        return true;
      });
  }

  function getLimits() {
    return {
      maxFileBytes: FONT_FILE_MAX_BYTES,
      maxFiles: FONT_LIBRARY_MAX_FILES,
      maxTotalBytes: FONT_LIBRARY_MAX_TOTAL_BYTES
    };
  }

  function getFontListResponse(scope) {
    const scoped = resolveFontScope(scope);
    const items = listAvailableFontLibraryItems(scoped);
    const usage = getFontLibraryUsage(items);
    return {
      items: items.map(x => ({ name: x.name, family: x.family, filename: x.filename, size: Number(x.size) || 0, url: x.url || getFontLibraryItemUrl(x.filename) })),
      usage,
      limits: getLimits(),
      scope: { ownerId: scoped.ownerId, userScoped: scoped.userScoped },
      pass: USER_FONT_LIBRARY_SCOPE_PASS
    };
  }

  function detectFontMagic(buffer) {
    if (!buffer || buffer.length < 4) return '';
    if (buffer.slice(0, 4).equals(Buffer.from([0x00, 0x01, 0x00, 0x00]))) return 'ttf';
    if (buffer.slice(0, 4).toString('ascii') === 'OTTO') return 'otf';
    if (buffer.slice(0, 4).toString('ascii') === 'wOFF') return 'woff';
    if (buffer.slice(0, 4).toString('ascii') === 'wOF2') return 'woff2';
    return '';
  }

  function uploadFont({ rawFilename, rawFamily, bodyBuffer, scope }) {
    const filename = String(rawFilename || '').trim();
    const familyHeader = String(rawFamily || '').trim();
    if (!filename) throw createHttpError(400, 'missing filename');
    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_FONT_EXTENSIONS.has(ext)) throw createHttpError(400, 'invalid font extension');
    if (!bodyBuffer || !bodyBuffer.length) throw createHttpError(400, 'empty file');
    const buffer = Buffer.from(bodyBuffer);
    if (buffer.length > FONT_FILE_MAX_BYTES) throw createHttpError(400, 'font file too large');
    const detectedMagic = detectFontMagic(buffer);
    if (!detectedMagic || detectedMagic !== ext.slice(1)) throw createHttpError(400, 'font signature mismatch');

    const scoped = ensureFontStorageReady(scope);
    const existingItems = listAvailableFontLibraryItems(scoped);
    const usage = scanFontDiskUsageSync(scoped);
    if (usage.count >= FONT_LIBRARY_MAX_FILES) throw createHttpError(409, 'font library full');
    if ((usage.totalBytes + buffer.length) > FONT_LIBRARY_MAX_TOTAL_BYTES) throw createHttpError(409, 'font library storage exceeded');

    const safeBase = safeFontName(path.basename(filename, ext)) || 'font';
    const family = (familyHeader || safeBase || 'Custom Font').slice(0, 80);
    const normalizedFamily = String(family).trim() || 'Custom Font';
    const duplicate = existingItems.find(item => item && String(item.family || '').trim().toLowerCase() === normalizedFamily.toLowerCase());
    if (duplicate) throw createHttpError(409, 'font family already exists');

    const list = loadFontMeta(scoped);
    const outName = `${safeBase}_${now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
    const outPath = resolveCandidate(scoped.fontDir, outName);
    if (!outPath) throw createHttpError(400, 'invalid filename');
    const tempPath = `${outPath}.${process.pid}.${Date.now()}.tmp`;
    let fd = null;
    try {
      fd = fs.openSync(tempPath, 'wx', 0o600);
      fs.writeFileSync(fd, buffer);
      fs.fsyncSync(fd);
      fs.closeSync(fd); fd = null;
      durableRenameSync(tempPath, outPath);
      list.push({ name: normalizedFamily, family: normalizedFamily, filename: outName, size: buffer.length, createdAt: now() });
      saveFontMeta(list, scoped);
    } catch (error) {
      if (fd != null) try { fs.closeSync(fd); } catch {}
      try { durableRemoveSync(tempPath, { force:true }); } catch {}
      try { durableRemoveSync(outPath, { force:true }); } catch {}
      throw error;
    }
    return {
      success: true,
      name: normalizedFamily,
      family: normalizedFamily,
      filename: outName,
      size: buffer.length,
      limits: getLimits(),
      scope: { ownerId: scoped.ownerId, userScoped: scoped.userScoped },
      pass: USER_FONT_LIBRARY_SCOPE_PASS,
      url: getFontLibraryItemUrl(outName)
    };
  }

  function deleteFont(filename, scope) {
    const target = safeFontName(filename);
    if (!target) throw createHttpError(400, 'invalid filename');
    const scoped = ensureFontStorageReady(scope);
    const list = loadFontMeta(scoped).filter(x => x && x.filename !== target);
    const candidates = [resolveCandidate(scoped.fontDir, target), resolveCandidate(scoped.legacyFontDir, target)].filter(Boolean);
    const renamed = [];
    try {
      candidates.forEach((filePath, index) => {
        if (!fs.existsSync(filePath)) return;
        const staged = `${filePath}.${process.pid}.${now()}.${index}.deleting`;
        durableRenameSync(filePath, staged);
        renamed.push([filePath, staged]);
      });
      saveFontMeta(list, scoped);
      const cleanupWarnings = [];
      renamed.forEach(([, staged]) => {
        try { durableRemoveSync(staged, { force:true }); }
        catch (cleanupError) {
          cleanupWarnings.push({ file:path.basename(staged), error:String(cleanupError && cleanupError.message || cleanupError) });
          logger?.warn?.('font staged deletion cleanup failed:', staged, cleanupError && cleanupError.message || cleanupError);
        }
      });
      return { success:true, cleanupWarnings, scope:{ ownerId:scoped.ownerId, userScoped:scoped.userScoped }, pass:USER_FONT_LIBRARY_SCOPE_PASS };
    } catch (error) {
      const rollbackFailures = [];
      renamed.forEach(([original, staged]) => {
        try { durableRenameSync(staged, original); }
        catch (rollbackError) { rollbackFailures.push({ original, staged, error:String(rollbackError && rollbackError.message || rollbackError) }); }
      });
      if (rollbackFailures.length) {
        const rollbackError = createHttpError(500, 'font deletion rollback failed');
        rollbackError.code = 'FONT_DELETE_ROLLBACK_FAILED';
        rollbackError.cause = error;
        rollbackError.rollbackFailures = rollbackFailures;
        logger?.error?.('font deletion rollback failed:', rollbackFailures);
        throw rollbackError;
      }
      throw error;
    }
  }

  function getFontFileForResponse(filename, scope) {
    const safeName = safeFontName(filename || '');
    if (!safeName) throw createHttpError(400, 'invalid filename');
    const scoped = resolveFontScope(scope);
    const filePath = resolveFontFilePath(safeName, scoped);
    if (!filePath || !fs.existsSync(filePath)) throw createHttpError(404, 'file not found');
    return {
      filename: safeName,
      filePath,
      mimeType: getFontMimeType(safeName),
      scope: { ownerId: scoped.ownerId, userScoped: scoped.userScoped },
      pass: USER_FONT_LIBRARY_SCOPE_PASS
    };
  }


  async function resolveFontFilePathAsync(filename, scope) {
    const safeName = safeFontName(filename);
    if (!safeName) return '';
    const scoped = resolveFontScope(scope);
    const candidates = [
      resolveCandidate(scoped.fontDir, safeName),
      resolveCandidate(scoped.legacyFontDir, safeName)
    ].filter(Boolean);
    for (const candidate of candidates) {
      try { await fs.promises.access(candidate, fs.constants.R_OK); return candidate; } catch {}
    }
    return candidates[0] || '';
  }

  async function loadFontMetaAsync(scope) {
    const scoped = resolveFontScope(scope);
    for (const candidate of [scoped.fontMetaPath, scoped.legacyFontMetaPath].filter(Boolean)) {
      const loaded = await loadJsonWithBackupAsync(candidate, null);
      if (loaded.ok && Array.isArray(loaded.data)) {
        if (loaded.source === 'backup') {
          try { await atomicWriteJsonAsync(candidate, loaded.data); }
          catch (error) { logger?.warn?.('font metadata backup recovery heal failed:', error.message); }
        }
        return loaded.data;
      }
    }
    return [];
  }

  async function saveFontMetaAsync(list, scope) {
    const scoped = await ensureFontStorageReadyAsync(scope);
    await atomicWriteJsonAsync(scoped.fontMetaPath, Array.isArray(list) ? list : []);
    return scoped;
  }

  async function normalizeFontLibraryItemAsync(item, scope) {
    try {
      const filename = safeFontName(item && item.filename || '');
      if (!filename) return null;
      const filePath = await resolveFontFilePathAsync(filename, scope);
      if (!filePath) return null;
      const stat = await fs.promises.stat(filePath);
      const family = String(item && (item.family || item.name) || '').trim() || path.basename(filename, path.extname(filename)) || 'Custom Font';
      return {
        name:family,
        family,
        filename,
        size:Number(item && item.size) || Number(stat.size) || 0,
        createdAt:parseInt(item && item.createdAt, 10) || Number(stat.mtimeMs) || now(),
        url:getFontLibraryItemUrl(filename)
      };
    } catch {
      return null;
    }
  }

  async function listAvailableFontLibraryItemsAsync(scope) {
    const scoped = resolveFontScope(scope);
    const rawItems = await loadFontMetaAsync(scoped);
    const normalized = await Promise.all((Array.isArray(rawItems) ? rawItems : []).map(item => normalizeFontLibraryItemAsync(item, scoped)));
    const seenFiles = new Set();
    const seenFamilies = new Set();
    return normalized.filter((item) => {
      if (!item) return false;
      const familyKey = String(item.family || '').trim().toLowerCase();
      if (seenFiles.has(item.filename) || (familyKey && seenFamilies.has(familyKey))) return false;
      seenFiles.add(item.filename);
      if (familyKey) seenFamilies.add(familyKey);
      return true;
    });
  }

  async function getFontListResponseAsync(scope) {
    const scoped = resolveFontScope(scope);
    const items = await listAvailableFontLibraryItemsAsync(scoped);
    return {
      items:items.map(item => ({ name:item.name, family:item.family, filename:item.filename, size:Number(item.size) || 0, url:item.url || getFontLibraryItemUrl(item.filename) })),
      usage:getFontLibraryUsage(items),
      limits:getLimits(),
      scope:{ ownerId:scoped.ownerId, userScoped:scoped.userScoped },
      pass:USER_FONT_LIBRARY_SCOPE_PASS
    };
  }

  async function uploadFontAsync({ rawFilename, rawFamily, bodyBuffer, scope }) {
    return withFontMutation(scope, async (scoped) => {
      const filename = String(rawFilename || '').trim();
      const familyHeader = String(rawFamily || '').trim();
      if (!filename) throw createHttpError(400, 'missing filename');
      const ext = path.extname(filename).toLowerCase();
      if (!ALLOWED_FONT_EXTENSIONS.has(ext)) throw createHttpError(400, 'invalid font extension');
      if (!bodyBuffer || !bodyBuffer.length) throw createHttpError(400, 'empty file');
      const buffer = Buffer.from(bodyBuffer);
      if (buffer.length > FONT_FILE_MAX_BYTES) throw createHttpError(400, 'font file too large');
      const detectedMagic = detectFontMagic(buffer);
      if (!detectedMagic || detectedMagic !== ext.slice(1)) throw createHttpError(400, 'font signature mismatch');

      await ensureFontStorageReadyAsync(scoped);
      const existingItems = await listAvailableFontLibraryItemsAsync(scoped);
      const usage = await scanFontDiskUsageAsync(scoped);
      if (usage.count >= FONT_LIBRARY_MAX_FILES) throw createHttpError(409, 'font library full');
      if (usage.totalBytes + buffer.length > FONT_LIBRARY_MAX_TOTAL_BYTES) throw createHttpError(409, 'font library storage exceeded');

      const safeBase = safeFontName(path.basename(filename, ext)) || 'font';
      const normalizedFamily = String((familyHeader || safeBase || 'Custom Font').slice(0, 80)).trim() || 'Custom Font';
      if (existingItems.some(item => String(item && item.family || '').trim().toLowerCase() === normalizedFamily.toLowerCase())) throw createHttpError(409, 'font family already exists');

      const list = await loadFontMetaAsync(scoped);
      const outName = `${safeBase}_${now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
      const outPath = resolveCandidate(scoped.fontDir, outName);
      if (!outPath) throw createHttpError(400, 'invalid filename');
      const tempPath = `${outPath}.${process.pid}.${Date.now()}.tmp`;
      let handle = null;
      try {
        handle = await fs.promises.open(tempPath, 'wx', 0o600);
        await handle.writeFile(buffer);
        await handle.sync();
        await handle.close();
        handle = null;
        await durableRenameAsync(tempPath, outPath);
        list.push({ name:normalizedFamily, family:normalizedFamily, filename:outName, size:buffer.length, createdAt:now() });
        await saveFontMetaAsync(list, scoped);
      } catch (error) {
        try { await handle?.close(); } catch {}
        try { await durableRemoveAsync(tempPath, { force:true }); } catch {}
        try { await durableRemoveAsync(outPath, { force:true }); } catch {}
        throw error;
      }
      return {
        success:true,
        name:normalizedFamily,
        family:normalizedFamily,
        filename:outName,
        size:buffer.length,
        limits:getLimits(),
        scope:{ ownerId:scoped.ownerId, userScoped:scoped.userScoped },
        pass:USER_FONT_LIBRARY_SCOPE_PASS,
        url:getFontLibraryItemUrl(outName)
      };
    });
  }

  async function deleteFontAsync(filename, scope) {
    return withFontMutation(scope, async (scoped) => {
      const target = safeFontName(filename);
      if (!target) throw createHttpError(400, 'invalid filename');
      await ensureFontStorageReadyAsync(scoped);
      const originalList = await loadFontMetaAsync(scoped);
      const nextList = originalList.filter(item => item && item.filename !== target);
      const candidates = [resolveCandidate(scoped.fontDir, target), resolveCandidate(scoped.legacyFontDir, target)].filter(Boolean);
      const renamed = [];
      try {
        for (const filePath of candidates) {
          try {
            await fs.promises.access(filePath, fs.constants.F_OK);
            const staged = `${filePath}.${process.pid}.${Date.now()}.deleting`;
            await durableRenameAsync(filePath, staged);
            renamed.push([filePath, staged]);
          } catch (error) {
            if (!error || error.code !== 'ENOENT') throw error;
          }
        }
        await saveFontMetaAsync(nextList, scoped);
        const cleanupResults = await Promise.allSettled(renamed.map(([, staged]) => durableRemoveAsync(staged, { force:true })));
        const cleanupWarnings = cleanupResults.flatMap((result, index) => result.status === 'rejected'
          ? [{ file:path.basename(renamed[index][1]), error:String(result.reason && result.reason.message || result.reason) }]
          : []);
        cleanupWarnings.forEach(warning => logger?.warn?.('font staged deletion cleanup failed:', warning.file, warning.error));
        return { success:true, cleanupWarnings, scope:{ ownerId:scoped.ownerId, userScoped:scoped.userScoped }, pass:USER_FONT_LIBRARY_SCOPE_PASS };
      } catch (error) {
        const rollbackResults = await Promise.allSettled(renamed.map(([original, staged]) => durableRenameAsync(staged, original)));
        const rollbackFailures = rollbackResults.flatMap((result, index) => result.status === 'rejected'
          ? [{ original:renamed[index][0], staged:renamed[index][1], error:String(result.reason && result.reason.message || result.reason) }]
          : []);
        if (rollbackFailures.length) {
          const rollbackError = createHttpError(500, 'font deletion rollback failed');
          rollbackError.code = 'FONT_DELETE_ROLLBACK_FAILED';
          rollbackError.cause = error;
          rollbackError.rollbackFailures = rollbackFailures;
          logger?.error?.('font deletion rollback failed:', rollbackFailures);
          throw rollbackError;
        }
        throw error;
      }
    });
  }

  async function openFontFileNoFollow(filename, scope) {
    const safeName = safeFontName(filename || '');
    if (!safeName) throw createHttpError(400, 'invalid filename');
    const scoped = resolveFontScope(scope);
    const roots = [scoped.fontDir, scoped.legacyFontDir].filter(Boolean);
    for (const baseDir of roots) {
      const candidate = resolveCandidate(baseDir, safeName);
      if (!candidate) continue;
      let handle = null;
      try {
        const linkStat = await fs.promises.lstat(candidate);
        if (!linkStat.isFile() || linkStat.isSymbolicLink()) continue;
        const [baseReal, fileReal] = await Promise.all([fs.promises.realpath(baseDir), fs.promises.realpath(candidate)]);
        if (!isPathInside(baseReal, fileReal)) continue;
        const noFollow = Number(fs.constants.O_NOFOLLOW) || 0;
        handle = await fs.promises.open(candidate, fs.constants.O_RDONLY | noFollow);
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size < 1 || stat.size > FONT_FILE_MAX_BYTES) {
          await handle.close();
          handle = null;
          continue;
        }
        return {
          filename:safeName,
          filePath:candidate,
          handle,
          stat,
          mimeType:getFontMimeType(safeName),
          scope:{ ownerId:scoped.ownerId, userScoped:scoped.userScoped },
          pass:USER_FONT_LIBRARY_SCOPE_PASS,
          noFollowPass:V675_FONT_NOFOLLOW_PASS
        };
      } catch (error) {
        try { await handle?.close(); } catch {}
        if (error && ['ENOENT','ELOOP','ENOTDIR'].includes(error.code)) continue;
        if (error && error.status) throw error;
        throw error;
      }
    }
    throw createHttpError(404, 'file not found');
  }

  async function getFontFileForResponseAsync(filename, scope) {
    return openFontFileNoFollow(filename, scope);
  }

  ensureFontStorageReady({ ownerId: '__owner__' });

  return {
    ensureFontStorageReady,
    ensureFontStorageReadyAsync,
    safeFontName,
    safeFontOwnerId,
    resolveFontScope,
    getFontLibraryItemUrl,
    getFontLibraryUsage,
    getLimits,
    loadFontMeta,
    saveFontMeta,
    listAvailableFontLibraryItems,
    getFontListResponse,
    getFontListResponseAsync,
    detectFontMagic,
    uploadFont,
    uploadFontAsync,
    deleteFont,
    deleteFontAsync,
    getFontFileForResponse,
    getFontFileForResponseAsync,
    openFontFileNoFollow
  };
}

module.exports = { V675_FONT_NOFOLLOW_PASS,
  createFontService,
  FONT_FILE_MAX_BYTES,
  FONT_LIBRARY_MAX_FILES,
  FONT_LIBRARY_MAX_TOTAL_BYTES,
  USER_FONT_LIBRARY_SCOPE_PASS
};
