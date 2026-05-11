const fs = require('fs');
const path = require('path');

const LIBRARY_CACHE_STRATEGY_PASS = 'v439-library-cache-strategy-pass';
const LIBRARY_CATALOG_PERFORMANCE_PASS = 'v453-library-catalog-performance-pass';
const NOVELS_API_PAYLOAD_BUDGET_PASS = 'v453-novels-api-payload-budget-pass';
const NOVELS_API_RESPONSE_CACHE_BUDGET_PASS = 'v453-novels-api-response-cache-budget-pass';

function createLibraryService(options = {}) {
  const LIBRARY_PATH = options.libraryPath;
  const encodeStableId = options.encodeStableId;
  const collator = options.collator || new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });
  const contentService = options.contentService || null;

  if (!LIBRARY_PATH) {
    throw new Error('libraryPath is required');
  }
  if (typeof encodeStableId !== 'function') {
    throw new Error('encodeStableId is required');
  }

  const DIR_SCAN_CACHE = new Map();
  const DIR_SCAN_CACHE_MAX = options.dirScanCacheMax || 512;
  const LIBRARY_CACHE_TTL = options.libraryCacheTtlMs || 15000;
  const LIBRARY_DEEP_SIGNATURE_CHECK_TTL = Number.isFinite(Number(options.libraryDeepSignatureCheckTtlMs))
    ? Math.max(0, Number(options.libraryDeepSignatureCheckTtlMs))
    : 2000;
  const libraryCacheMetrics = {
    rootSignatureCalls: 0,
    directorySignatureCalls: 0,
    deepSignatureChecks: 0,
    libraryCacheHits: 0,
    libraryCacheMisses: 0,
    dirScanCacheHits: 0,
    dirScanCacheMisses: 0,
    dirScanCacheEvictions: 0
  };
  const novelsApiMetrics = {
    marker: LIBRARY_CATALOG_PERFORMANCE_PASS,
    payloadBudgetPass: NOVELS_API_PAYLOAD_BUDGET_PASS,
    responseCacheBudgetPass: NOVELS_API_RESPONSE_CACHE_BUDGET_PASS,
    requests: 0,
    serialized: 0,
    responseCacheHits: 0,
    responseCacheMisses: 0,
    responseCacheSkips: 0,
    responseCacheBytes: 0,
    lastCacheSkipReason: '',
    lastSerializeMs: 0,
    lastPayloadBytes: 0,
    lastNovelCount: 0,
    maxPayloadBytes: 0,
    maxSerializeMs: 0,
    lastAt: 0
  };
  const libraryCache = {
    data: null,
    time: 0,
    signature: '',
    buildCount: 0,
    lastBuildMs: 0,
    lastBuildAt: 0,
    directorySignatures: new Map(),
    lastDeepSignatureCheckAt: 0
  };

  function getDirScanCache(dirPath, stat) {
    const key = String(dirPath || '');
    if (!key) return null;
    const hit = DIR_SCAN_CACHE.get(key);
    if (!hit) {
      libraryCacheMetrics.dirScanCacheMisses += 1;
      return null;
    }
    if (!stat || hit.mtimeMs !== Math.floor(stat.mtimeMs || 0)) {
      libraryCacheMetrics.dirScanCacheMisses += 1;
      return null;
    }
    libraryCacheMetrics.dirScanCacheHits += 1;
    DIR_SCAN_CACHE.delete(key);
    DIR_SCAN_CACHE.set(key, hit);
    return Array.isArray(hit.files) ? hit.files.slice() : null;
  }

  function setDirScanCache(dirPath, stat, files) {
    const key = String(dirPath || '');
    if (!key || !stat) return;
    DIR_SCAN_CACHE.set(key, { mtimeMs: Math.floor(stat.mtimeMs || 0), files: Array.isArray(files) ? files.slice() : [] });
    while (DIR_SCAN_CACHE.size > DIR_SCAN_CACHE_MAX) {
      const oldestKey = DIR_SCAN_CACHE.keys().next().value;
      if (!oldestKey) break;
      DIR_SCAN_CACHE.delete(oldestKey);
      libraryCacheMetrics.dirScanCacheEvictions += 1;
    }
  }

  function getDirectorySignature(dirPath) {
    libraryCacheMetrics.directorySignatureCalls += 1;
    try {
      const stat = fs.statSync(dirPath);
      if (!stat || !stat.isDirectory || !stat.isDirectory()) return '0:0';
      return `${Math.floor(stat.mtimeMs || 0)}:${stat.size || 0}`;
    } catch (e) {
      return '0:0';
    }
  }

  function recordLibraryDirectorySignature(signatureMap, dirPath) {
    if (!signatureMap || !dirPath) return;
    signatureMap.set(path.resolve(dirPath), getDirectorySignature(dirPath));
  }

  function scanLibrary(dirPath) {
    if (!fs.existsSync(dirPath)) return [];

    function walk(currentDir) {
      let stat = null;
      try {
        stat = fs.statSync(currentDir);
      } catch (err) {
        return [];
      }

      const cached = getDirScanCache(currentDir, stat);
      if (cached) return cached;

      let entries = [];
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch (err) {
        return [];
      }

      const files = [];
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) files.push(...walk(fullPath));
        else if (entry.isFile() && entry.name.toLowerCase().endsWith('.txt')) files.push(fullPath);
      }

      setDirScanCache(currentDir, stat, files);
      return files;
    }

    return walk(dirPath);
  }

  function readDirEntriesSafe(dirPath) {
    try {
      return fs.readdirSync(dirPath, { withFileTypes: true });
    } catch (err) {
      return [];
    }
  }

  function readDirEntriesForLibraryBuild(dirPath, signatureMap) {
    recordLibraryDirectorySignature(signatureMap, dirPath);
    return readDirEntriesSafe(dirPath);
  }

  function isTxtDirEntry(entry) {
    return !!(entry && entry.isFile && entry.isFile() && entry.name && entry.name.toLowerCase().endsWith('.txt'));
  }

  function sanitizeNodeName(name) {
    const s = String(name || '').trim();
    if (!s) return '';
    if (s.includes('/') || s.includes('\\')) return '';
    if (s === '.' || s === '..') return '';
    if (/[<>:"|?*\x00-\x1F]/.test(s)) return '';
    return s;
  }

  function normalizeTxtBaseName(name) {
    const clean = sanitizeNodeName(name);
    if (!clean) return '';
    return clean.replace(/\.txt$/i, '');
  }

  function getDirectoryNovelModeOverride(entries) {
    const safeEntries = Array.isArray(entries) ? entries : [];
    const fileNames = new Set(
      safeEntries
        .filter(entry => entry && entry.isFile && entry.isFile() && entry.name)
        .map(entry => String(entry.name || '').trim().toLowerCase())
    );

    if (fileNames.has('.txt-reader-folder') || fileNames.has('.txt-reader-category')) {
      return 'folder';
    }
    if (fileNames.has('.txt-reader-episodes') || fileNames.has('.txt-reader-novel')) {
      return 'episodes';
    }
    return '';
  }

  function isLikelyEpisodeFileName(name) {
    const base = normalizeTxtBaseName(name);
    if (!base) return false;

    return (
      /^(?:\d{1,4})$/.test(base) ||
      /^(?:\d{1,4})\s*(?:화|회|편|장|권|부)$/.test(base) ||
      /^(?:제\s*)?\d{1,4}\s*(?:화|회|편|장|권|부)$/.test(base) ||
      /^(?:제\s*)?\d{1,4}\s*(?:화|회|편|장|권|부)(?:\s*[-_.:：)）\]]?\s*.+)$/i.test(base) ||
      /^(?:[[(（]?\s*(?:제\s*)?\d{1,4}\s*(?:화|회|편|장|권|부)\s*[\])）]?)(?:\s*[-_.:：]?\s*.+)?$/i.test(base) ||
      /^(?:vol(?:ume)?|book)\s*[.:-]?\s*\d{1,4}(?:\s*[-_.:：]?\s*.+)?$/i.test(base) ||
      /^(?:ep|episode|chapter|ch)\s*[.:-]?\s*[\divxlcdm]+(?:\s*[-_.:：]?\s*.+)?$/i.test(base) ||
      /^(?:prologue|epilogue|interlude|extra|side\s*story|프롤로그|에필로그|막간|외전|번외|서장|종장)$/.test(base)
    );
  }

  function shouldTreatDirectoryAsEpisodeNovel(entries) {
    const safeEntries = Array.isArray(entries) ? entries : [];
    const overrideMode = getDirectoryNovelModeOverride(safeEntries);
    if (overrideMode === 'episodes') return true;
    if (overrideMode === 'folder') return false;
    const dirEntries = safeEntries.filter(entry => entry && entry.isDirectory && entry.isDirectory());
    if (dirEntries.length) return false;

    const txtEntries = safeEntries.filter(isTxtDirEntry);
    if (txtEntries.length < 2) return false;

    const episodeLikeCount = txtEntries.reduce((count, entry) => {
      return count + (isLikelyEpisodeFileName(entry.name) ? 1 : 0);
    }, 0);

    return episodeLikeCount === txtEntries.length;
  }

  function buildLibrary() {
    const novelMap = new Map();
    const buildDirectorySignatures = new Map();

    function upsertSingleFileNovel(filePath, categoryParts) {
      const rel = path.relative(LIBRARY_PATH, filePath);
      const novelKey = rel;

      if (!novelMap.has(novelKey)) {
        novelMap.set(novelKey, {
          id: encodeStableId(novelKey),
          title: path.basename(rel, '.txt'),
          category: categoryParts.slice(),
          categoryPath: categoryParts.join(' > '),
          episodes: [],
          isMultiFile: false,
          singlePath: rel,
        });
      }
    }

    function upsertEpisodeNovel(dirPath, entries, categoryParts) {
      const novelTitle = path.basename(dirPath);
      const novelKey = categoryParts.length ? (categoryParts.join('/') + '/' + novelTitle) : novelTitle;

      if (!novelMap.has(novelKey)) {
        novelMap.set(novelKey, {
          id: encodeStableId(novelKey),
          title: novelTitle,
          category: categoryParts.slice(),
          categoryPath: categoryParts.join(' > '),
          episodes: [],
          isMultiFile: true,
          singlePath: null,
        });
      }

      const novel = novelMap.get(novelKey);
      const txtEntries = entries.filter(isTxtDirEntry).sort((a, b) =>
        collator.compare(a.name, b.name)
      );

      txtEntries.forEach((entry) => {
        const absPath = path.join(dirPath, entry.name);
        const episodePath = path.relative(LIBRARY_PATH, absPath);
        novel.episodes.push({
          id: encodeStableId(episodePath),
          title: path.basename(entry.name, '.txt'),
          path: episodePath,
        });
      });
    }

    function walkCategoryDir(currentDir, categoryParts, preloadedEntries) {
      recordLibraryDirectorySignature(buildDirectorySignatures, currentDir);
      const entries = Array.isArray(preloadedEntries) ? preloadedEntries : readDirEntriesForLibraryBuild(currentDir, buildDirectorySignatures);
      if (!entries.length) return;

      const txtEntries = entries.filter(isTxtDirEntry).sort((a, b) =>
        collator.compare(a.name, b.name)
      );
      const dirEntries = entries
        .filter(entry => entry && entry.isDirectory && entry.isDirectory())
        .sort((a, b) => collator.compare(a.name, b.name));

      txtEntries.forEach((entry) => {
        upsertSingleFileNovel(path.join(currentDir, entry.name), categoryParts);
      });

      dirEntries.forEach((entry) => {
        const childDir = path.join(currentDir, entry.name);
        const childEntries = readDirEntriesForLibraryBuild(childDir, buildDirectorySignatures);
        if (!childEntries.length) return;

        if (shouldTreatDirectoryAsEpisodeNovel(childEntries)) {
          upsertEpisodeNovel(childDir, childEntries, categoryParts);
          return;
        }

        walkCategoryDir(childDir, categoryParts.concat(entry.name), childEntries);
      });
    }

    walkCategoryDir(LIBRARY_PATH, []);

    for (const novel of novelMap.values()) {
      novel.episodes.sort((a, b) =>
        collator.compare(a.title, b.title)
      );
    }

    const library = Array.from(novelMap.values()).sort((a, b) => {
      const catCmp = collator.compare(a.categoryPath, b.categoryPath);
      if (catCmp !== 0) return catCmp;
      return collator.compare(a.title, b.title);
    });

    libraryCache.directorySignatures = buildDirectorySignatures;
    libraryCache.lastDeepSignatureCheckAt = Date.now();
    return library;
  }

  function getLibraryRootSignature() {
    libraryCacheMetrics.rootSignatureCalls += 1;
    try {
      const st = fs.statSync(LIBRARY_PATH);
      return `${Math.floor(st.mtimeMs || 0)}:${st.size || 0}`;
    } catch (e) {
      return '0:0';
    }
  }


  function libraryDirectorySignaturesAreUnchanged(now) {
    const signatures = libraryCache.directorySignatures;
    if (!signatures || !signatures.size) return true;
    if (now - (libraryCache.lastDeepSignatureCheckAt || 0) < LIBRARY_DEEP_SIGNATURE_CHECK_TTL) return true;

    libraryCacheMetrics.deepSignatureChecks += 1;
    for (const [dirPath, signature] of signatures.entries()) {
      if (getDirectorySignature(dirPath) !== signature) return false;
    }

    libraryCache.lastDeepSignatureCheckAt = now;
    return true;
  }

  function getLibraryCached() {
    const now = Date.now();
    if (libraryCache.data && now - libraryCache.time < LIBRARY_CACHE_TTL) {
      if (LIBRARY_DEEP_SIGNATURE_CHECK_TTL > 0 && now - (libraryCache.lastDeepSignatureCheckAt || 0) < LIBRARY_DEEP_SIGNATURE_CHECK_TTL) {
        libraryCacheMetrics.libraryCacheHits += 1;
        return libraryCache.data;
      }
      const cachedSignature = getLibraryRootSignature();
      if (libraryCache.signature === cachedSignature && libraryDirectorySignaturesAreUnchanged(now)) {
        libraryCacheMetrics.libraryCacheHits += 1;
        return libraryCache.data;
      }
    }
    libraryCacheMetrics.libraryCacheMisses += 1;
    const signature = getLibraryRootSignature();
    const startedAt = Date.now();
    const data = buildLibrary();
    libraryCache.data = data;
    libraryCache.time = now;
    libraryCache.signature = signature;
    libraryCache.buildCount += 1;
    libraryCache.lastBuildMs = Date.now() - startedAt;
    libraryCache.lastBuildAt = now;
    return data;
  }



  function recordNovelsApiPayloadMetrics(metrics = {}) {
    novelsApiMetrics.requests += 1;
    if (metrics.cacheHit) novelsApiMetrics.responseCacheHits += 1;
    else novelsApiMetrics.responseCacheMisses += 1;
    if (metrics.serialized) novelsApiMetrics.serialized += 1;
    if (metrics.cacheSkipped) novelsApiMetrics.responseCacheSkips += 1;
    novelsApiMetrics.responseCacheBytes = Math.max(0, Number(metrics.responseCacheBytes) || 0);
    novelsApiMetrics.lastCacheSkipReason = metrics.cacheSkipReason ? String(metrics.cacheSkipReason) : '';
    novelsApiMetrics.lastSerializeMs = Math.max(0, Number(metrics.serializeMs) || 0);
    novelsApiMetrics.lastPayloadBytes = Math.max(0, Number(metrics.payloadBytes) || 0);
    novelsApiMetrics.lastNovelCount = Math.max(0, Number(metrics.novelCount) || 0);
    novelsApiMetrics.maxPayloadBytes = Math.max(novelsApiMetrics.maxPayloadBytes || 0, novelsApiMetrics.lastPayloadBytes);
    novelsApiMetrics.maxSerializeMs = Math.max(novelsApiMetrics.maxSerializeMs || 0, novelsApiMetrics.lastSerializeMs);
    novelsApiMetrics.lastAt = Date.now();
  }

  function invalidateLibraryCache() {
    libraryCache.data = null;
    libraryCache.time = 0;
    libraryCache.signature = '';
    libraryCache.directorySignatures = new Map();
    libraryCache.lastDeepSignatureCheckAt = 0;
    DIR_SCAN_CACHE.clear();
  }

  function setLibraryMetaHeaders(res) {
    try {
      res.setHeader('X-Library-Signature', String(libraryCache.signature || getLibraryRootSignature() || ''));
      res.setHeader('X-Library-Build-Count', String(libraryCache.buildCount || 0));
      res.setHeader('X-Library-Build-Ms', String(libraryCache.lastBuildMs || 0));
      res.setHeader('X-Library-Build-At', String(libraryCache.lastBuildAt || 0));
    } catch (e) {}
  }

  function safeJoinUnderLibrary(relPath) {
    const resolved = path.resolve(LIBRARY_PATH, relPath || '');
    const root = path.resolve(LIBRARY_PATH);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      throw new Error('Invalid path');
    }
    return resolved;
  }

  function ensureExists(targetPath) {
    if (!fs.existsSync(targetPath)) {
      throw new Error('Path not found');
    }
  }

  function ensureNotExists(targetPath) {
    if (fs.existsSync(targetPath)) {
      throw new Error('Target already exists');
    }
  }

  function ensureDirExists(targetPath) {
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }
  }

  function cleanupEmptyParents(startDir) {
    const root = path.resolve(LIBRARY_PATH);
    let cur = path.resolve(startDir);

    while (cur.startsWith(root) && cur !== root) {
      try {
        const entries = fs.readdirSync(cur);
        if (entries.length > 0) break;
        fs.rmdirSync(cur);
        cur = path.dirname(cur);
      } catch (e) {
        break;
      }
    }
  }

  function categoryPathToRelDir(categoryPath) {
    const parts = String(categoryPath || '')
      .split('>')
      .map(s => s.trim())
      .filter(Boolean);

    for (const p of parts) {
      if (!sanitizeNodeName(p)) throw new Error('Invalid category path');
    }

    return parts.join(path.sep);
  }

  function sendFsError(res, err) {
    const msg = String((err && err.message) || 'Unknown error');

    if (
      msg === 'Invalid path' ||
      msg === 'Invalid request' ||
      msg === 'Invalid title' ||
      msg === 'Invalid category path'
    ) {
      return res.status(400).json({ error: msg });
    }

    if (msg === 'Path not found' || msg === 'Novel not found') {
      return res.status(404).json({ error: msg });
    }

    if (msg === 'Target already exists') {
      return res.status(409).json({ error: msg });
    }

    if (err && (err.code === 'EROFS' || /read-only file system|EROFS/i.test(msg))) {
      return res.status(423).json({
        error: 'READ_ONLY_LIBRARY',
        message: 'Library path is read-only. Mount the library volume as writable to rename, move, or delete files.'
      });
    }

    if (err && (err.code === 'EACCES' || err.code === 'EPERM')) {
      return res.status(403).json({ error: 'LIBRARY_PERMISSION_DENIED', message: 'Library path is not writable.' });
    }

    return res.status(500).json({ error: msg });
  }

  function invalidatePathCaches(filePath) {
    if (contentService && typeof contentService.invalidatePathCaches === 'function') {
      contentService.invalidatePathCaches(filePath);
    }
  }

  function clearAllFileCache() {
    if (contentService && typeof contentService.clearAllFileCache === 'function') {
      contentService.clearAllFileCache();
    }
  }

  function clearFileCachePath(filePath) {
    if (contentService && typeof contentService.clearFileCachePath === 'function') {
      contentService.clearFileCachePath(filePath);
    }
  }

  function isSubPath(parentAbs, childAbs) {
    const parent = path.resolve(parentAbs);
    const child = path.resolve(childAbs);
    return child === parent || child.startsWith(parent + path.sep);
  }

  function getNovelStorageInfo(novel) {
    if (!novel) throw new Error('Novel not found');

    if (novel.isMultiFile) {
      const eps = Array.isArray(novel.episodes) ? novel.episodes : [];
      if (!eps.length) throw new Error('Path not found');

      const firstEpisodeAbs = safeJoinUnderLibrary(eps[0].path);
      const folderAbs = path.dirname(firstEpisodeAbs);

      return {
        type: 'folder',
        absPath: folderAbs,
        name: path.basename(folderAbs)
      };
    }

    if (!novel.singlePath) throw new Error('Path not found');

    const singleAbs = safeJoinUnderLibrary(novel.singlePath);
    return {
      type: 'file',
      absPath: singleAbs,
      name: path.basename(singleAbs)
    };
  }

  function getEpisodeStorageInfo(novel, episodeId) {
    if (!novel || !novel.isMultiFile) throw new Error('Path not found');
    const eps = Array.isArray(novel.episodes) ? novel.episodes : [];
    const ep = eps.find(e => e && e.id === episodeId);
    if (!ep || !ep.path) throw new Error('Path not found');

    const absPath = safeJoinUnderLibrary(ep.path);
    return {
      type: 'file',
      absPath,
      name: path.basename(absPath)
    };
  }

  function clearNovelCachesByInfo(info) {
    if (!info) return;

    if (info.type === 'file') {
      invalidatePathCaches(info.absPath);
      return;
    }

    try {
      const files = scanLibrary(info.absPath);
      files.forEach(fp => invalidatePathCaches(fp));
    } catch (e) {}
  }

  function getCacheStatus() {
    return {
      marker: LIBRARY_CACHE_STRATEGY_PASS,
      libraryCache: {
        count: Array.isArray(libraryCache.data) ? libraryCache.data.length : 0,
        buildCount: libraryCache.buildCount || 0,
        lastBuildMs: libraryCache.lastBuildMs || 0,
        lastBuildAt: libraryCache.lastBuildAt || 0,
        signature: libraryCache.signature || '',
        directorySignatureCount: libraryCache.directorySignatures ? libraryCache.directorySignatures.size : 0,
        lastDeepSignatureCheckAt: libraryCache.lastDeepSignatureCheckAt || 0,
        deepSignatureCheckTtlMs: LIBRARY_DEEP_SIGNATURE_CHECK_TTL
      },
      dirScanCacheEntries: DIR_SCAN_CACHE.size || 0,
      metrics: Object.assign({}, libraryCacheMetrics),
      novelsApi: Object.assign({}, novelsApiMetrics)
    };
  }

  return {
    scanLibrary,
    readDirEntriesSafe,
    buildLibrary,
    getLibraryCached,
    invalidateLibraryCache,
    setLibraryMetaHeaders,
    sanitizeNodeName,
    normalizeTxtBaseName,
    safeJoinUnderLibrary,
    ensureExists,
    ensureNotExists,
    ensureDirExists,
    cleanupEmptyParents,
    categoryPathToRelDir,
    sendFsError,
    invalidatePathCaches,
    clearFileCachePath,
    clearAllFileCache,
    isSubPath,
    getNovelStorageInfo,
    getEpisodeStorageInfo,
    clearNovelCachesByInfo,
    getCacheStatus,
    recordNovelsApiPayloadMetrics
  };
}

module.exports = { createLibraryService, LIBRARY_CACHE_STRATEGY_PASS, LIBRARY_CATALOG_PERFORMANCE_PASS, NOVELS_API_PAYLOAD_BUDGET_PASS, NOVELS_API_RESPONSE_CACHE_BUDGET_PASS };
