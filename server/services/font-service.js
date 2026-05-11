const fs = require('fs');
const path = require('path');

const FONT_FILE_MAX_BYTES = 8 * 1024 * 1024;
const FONT_LIBRARY_MAX_FILES = 48;
const FONT_LIBRARY_MAX_TOTAL_BYTES = 64 * 1024 * 1024;
const ALLOWED_FONT_EXTENSIONS = new Set(['.ttf', '.otf', '.woff', '.woff2']);
const USER_FONT_LIBRARY_SCOPE_PASS = 'v426-user-font-library-scope-pass';

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
  now = () => Date.now()
} = {}) {
  if (!fontDir) throw new Error('fontDir is required');
  if (!fontMetaPath) throw new Error('fontMetaPath is required');
  if (!legacyFontDir) throw new Error('legacyFontDir is required');
  if (!legacyFontMetaPath) throw new Error('legacyFontMetaPath is required');
  const scopedUserDataDir = userDataDir || path.join(path.dirname(fontDir), 'user-data');

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

  function ensureFontStorageReady(scope) {
    const scoped = resolveFontScope(scope);
    if (!fs.existsSync(scoped.fontDir)) fs.mkdirSync(scoped.fontDir, { recursive: true });
    const metaParent = path.dirname(scoped.fontMetaPath);
    if (!fs.existsSync(metaParent)) fs.mkdirSync(metaParent, { recursive: true });
    return scoped;
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
    for (const fp of candidates) if (fs.existsSync(fp)) return fp;
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
    try {
      const scoped = resolveFontScope(scope);
      const metaPath = fs.existsSync(scoped.fontMetaPath) ? scoped.fontMetaPath : scoped.legacyFontMetaPath;
      return metaPath && fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf-8')) : [];
    } catch (_e) {
      return [];
    }
  }

  function saveFontMeta(list, scope) {
    const scoped = ensureFontStorageReady(scope);
    const body = JSON.stringify(Array.isArray(list) ? list : [], null, 2);
    const tmpPath = scoped.fontMetaPath + '.tmp';
    fs.writeFileSync(tmpPath, body, 'utf-8');
    fs.renameSync(tmpPath, scoped.fontMetaPath);
    try { fs.writeFileSync(scoped.fontMetaPath + '.bak', body, 'utf-8'); } catch (_e) {}
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
    const usage = getFontLibraryUsage(existingItems);
    if (usage.count >= FONT_LIBRARY_MAX_FILES) throw createHttpError(409, 'font library full');
    if ((usage.totalBytes + buffer.length) > FONT_LIBRARY_MAX_TOTAL_BYTES) throw createHttpError(409, 'font library storage exceeded');

    const safeBase = safeFontName(path.basename(filename, ext)) || 'font';
    const family = (familyHeader || safeBase || 'Custom Font').slice(0, 80);
    const normalizedFamily = String(family).trim() || 'Custom Font';
    const duplicate = existingItems.find(item => item && String(item.family || '').trim().toLowerCase() === normalizedFamily.toLowerCase());
    if (duplicate) throw createHttpError(409, 'font family already exists');

    const list = loadFontMeta(scoped);
    const outName = safeBase + '_' + now() + ext;
    const outPath = resolveCandidate(scoped.fontDir, outName);
    if (!outPath) throw createHttpError(400, 'invalid filename');
    fs.writeFileSync(outPath, buffer);
    list.push({ name: normalizedFamily, family: normalizedFamily, filename: outName, size: buffer.length, createdAt: now() });
    saveFontMeta(list, scoped);
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
    saveFontMeta(list, scoped);
    [resolveCandidate(scoped.fontDir, target), resolveCandidate(scoped.legacyFontDir, target)]
      .filter(Boolean)
      .forEach(fp => { if (fs.existsSync(fp)) fs.unlinkSync(fp); });
    return { success: true, scope: { ownerId: scoped.ownerId, userScoped: scoped.userScoped }, pass: USER_FONT_LIBRARY_SCOPE_PASS };
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

  ensureFontStorageReady({ ownerId: '__owner__' });

  return {
    ensureFontStorageReady,
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
    detectFontMagic,
    uploadFont,
    deleteFont,
    getFontFileForResponse
  };
}

module.exports = {
  createFontService,
  FONT_FILE_MAX_BYTES,
  FONT_LIBRARY_MAX_FILES,
  FONT_LIBRARY_MAX_TOTAL_BYTES,
  USER_FONT_LIBRARY_SCOPE_PASS
};
