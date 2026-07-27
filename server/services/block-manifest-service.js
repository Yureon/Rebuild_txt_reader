const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { NORMALIZATION_ALGORITHM_VERSION, CHUNK_INDEX_ALGORITHM_VERSION } = require('./normalized-content-cache');
const { atomicWriteFileAsync, atomicWriteFileSync } = require('../repositories/json-file-store');

const MAX_BLOCK_CHARS = 1200;
const MIN_BLOCK_CHARS = 420;
const DEFAULT_MANIFEST_CACHE_MAX = 48;
const BLOCK_MANIFEST_CACHE_STATUS_PASS = 'v436-block-manifest-cache-status-pass';
const BLOCK_MANIFEST_CACHE_STRATEGY_PASS = 'v439-block-manifest-cache-strategy-pass';
const BLOCK_MANIFEST_DISK_CACHE_PASS = 'v457-block-manifest-disk-cache-smoke-pass';
const BLOCK_MANIFEST_EPISODE_DISK_CACHE_PASS = 'v460-block-manifest-episode-disk-cache-smoke-pass';
const BLOCK_MANIFEST_EPISODE_DISK_CACHE_V469_PASS = 'v469-block-manifest-episode-disk-cache-pass';
const BLOCK_MANIFEST_STABLE_ETAG_PASS = 'v469-block-manifest-stable-etag-pass';
const FOLDER_MANIFEST_DISK_SCHEMA = 5;
const EPISODE_MANIFEST_DISK_SCHEMA = 4;
const BLOCK_MANIFEST_BLOCK_CHAR_RANGES_PASS = 'v482-block-manifest-block-char-ranges-pass';
const BLOCK_MANIFEST_COORDINATE_VERSION = 2;
const BLOCK_MANIFEST_FOLDER_BUILD_THROTTLE_PASS = 'v540-block-manifest-folder-build-throttle-pass';
const BLOCK_MANIFEST_ASYNC_IO_PASS = 'v591-block-manifest-async-io-pass';
const FOLDER_BLOCK_MANIFEST_WINDOW_PASS = 'v544-folder-block-manifest-window-cache-pass';
const DEFAULT_FOLDER_SIGNATURE_CACHE_TTL_MS = 0;
const DEFAULT_FOLDER_MANIFEST_HOT_CACHE_TTL_MS = 0;
const DEFAULT_FOLDER_BUILD_YIELD_EVERY = 25;
const DEFAULT_FOLDER_RUNTIME_CACHE_MAX = 24;
const DEFAULT_FOLDER_BLOCK_MANIFEST_RADIUS = 5;
const MAX_FOLDER_BLOCK_MANIFEST_RADIUS = 200;

function splitContentBlocks(content, signal = null) {
  assertNotAborted(signal);
  const text = String(content || '').replace(/\r\n?/g, '\n');
  if (!text.trim()) return [{ index: 0, start: 0, end: 0, text: '(빈 블럭)' }];
  const blocks = [];
  const re = /\n{2,}/g;
  let last = 0;
  let match;
  let blockIndex = 0;
  const pushParagraph = (paragraph, offset) => {
    assertNotAborted(signal);
    if (!paragraph.trim()) return;
    let pos = 0;
    while (pos < paragraph.length) {
      assertNotAborted(signal);
      const remaining = paragraph.length - pos;
      let cut = remaining <= MAX_BLOCK_CHARS ? remaining : findSplitPoint(paragraph, pos, Math.min(paragraph.length, pos + MAX_BLOCK_CHARS));
      if (cut < MIN_BLOCK_CHARS && remaining > MAX_BLOCK_CHARS) cut = Math.min(MAX_BLOCK_CHARS, remaining);
      const part = paragraph.slice(pos, pos + cut);
      blocks.push({ index: blockIndex++, start: offset + pos, end: offset + pos + part.length, text: part });
      pos += cut;
      while (paragraph[pos] === '\n') pos += 1;
    }
  };
  while ((match = re.exec(text))) {
    assertNotAborted(signal);
    pushParagraph(text.slice(last, match.index), last);
    last = re.lastIndex;
  }
  pushParagraph(text.slice(last), last);
  return blocks.length ? blocks : [{ index: 0, start: 0, end: text.length, text }];
}

function findSplitPoint(text, start, hardEnd) {
  const slice = text.slice(start, hardEnd);
  const candidates = ['\n', '다.', '요.', '까.', '죠.', '!”', '!"', '?"', '. ', '! ', '? ', ' '];
  let best = -1;
  for (const token of candidates) {
    const idx = slice.lastIndexOf(token);
    if (idx > best) best = idx + token.length;
    if (best >= MIN_BLOCK_CHARS) break;
  }
  return best >= MIN_BLOCK_CHARS ? best : hardEnd - start;
}

function sha1(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex');
}

function clampNumber(value, min, max) {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.min(max, Math.max(min, num));
}

function createAbortError() {
  const err = new Error('block manifest request aborted');
  err.name = 'AbortError';
  err.code = 'ABORT_ERR';
  return err;
}

function assertNotAborted(signal) {
  if (signal && signal.aborted) throw createAbortError();
}

function waitForPromiseWithAbort(promise, signal) {
  assertNotAborted(signal);
  if (!signal || typeof signal.addEventListener !== 'function') return promise;
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => signal.removeEventListener('abort', onAbort);
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(value);
    };
    const onAbort = () => finish(reject, createAbortError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      value => finish(resolve, value),
      error => finish(reject, error)
    );
  });
}

function createBlockManifestService(options = {}) {
  const libraryPath = options.libraryPath;
  const libraryService = options.libraryService;
  const contentService = options.contentService;
  const manifestCache = new Map();
  const folderManifestHotCache = new Map();
  const folderSignatureCache = new Map();
  const folderManifestInflight = new Map();
  const episodeManifestInflight = new Map();
  const manifestCacheMetrics = {
    manifestCacheHits: 0,
    manifestCacheMisses: 0,
    manifestCacheStores: 0,
    manifestCacheEvictions: 0,
    manifestDiskHits: 0,
    manifestDiskMisses: 0,
    manifestDiskWriteAttempts: 0,
    manifestDiskWriteStored: 0,
    manifestDiskWriteSkippedFresh: 0,
    manifestDiskBypasses: 0,
    lastManifestDiskBypassReason: '',
    episodeManifestDiskHits: 0,
    episodeManifestDiskMisses: 0,
    episodeManifestDiskWriteAttempts: 0,
    episodeManifestDiskWriteStored: 0,
    episodeManifestDiskBypasses: 0,
    lastEpisodeManifestDiskBypassReason: '',
    episodeManifestDiskWriteSkippedForFolderBuild: 0,
    episodeManifestDiskWriteSkippedFresh: 0,
    episodeManifestInflightJoins: 0,
    episodeManifestInflightLoads: 0,
    folderManifestHotCacheHits: 0,
    folderManifestHotCacheMisses: 0,
    folderManifestHotCacheStores: 0,
    folderSignatureCacheHits: 0,
    folderSignatureCacheMisses: 0,
    folderManifestInflightJoins: 0,
    folderManifestInflightLoads: 0,
    folderManifestBuildYields: 0,
    lastFolderManifestBuildMs: 0,
    folderManifestWindowBuilds: 0,
    folderManifestFullBuilds: 0,
    lastFolderManifestScope: '',
    lastFolderManifestWindowStartIndex: -1,
    lastFolderManifestWindowEndIndex: -1,
    lastFolderManifestCenterEpisodeIndex: -1,
    asyncStatSignatureCalls: 0,
    asyncDiskReadCalls: 0,
    asyncDiskWriteCalls: 0,
    asyncSignatureConcurrencyPeak: 0
  };
  const manifestDiskCacheDir = options.manifestDiskCacheDir || null;
  const manifestCacheMax = Math.max(0, Number(options.manifestCacheMax) || DEFAULT_MANIFEST_CACHE_MAX);
  const folderSignatureCacheTtlMs = Math.max(0, Number(options.folderSignatureCacheTtlMs ?? DEFAULT_FOLDER_SIGNATURE_CACHE_TTL_MS) || 0);
  const folderManifestHotCacheTtlMs = Math.max(0, Number(options.folderManifestHotCacheTtlMs ?? DEFAULT_FOLDER_MANIFEST_HOT_CACHE_TTL_MS) || 0);
  const folderRuntimeCacheMax = Math.max(0, Number(options.folderRuntimeCacheMax ?? DEFAULT_FOLDER_RUNTIME_CACHE_MAX) || 0);
  const folderBuildYieldEvery = Math.max(0, Math.floor(Number(options.folderBuildYieldEvery ?? DEFAULT_FOLDER_BUILD_YIELD_EVERY) || 0));
  const configuredFolderBlockManifestRadius = Number(options.folderBlockManifestRadius ?? DEFAULT_FOLDER_BLOCK_MANIFEST_RADIUS);
  const folderBlockManifestRadius = Math.floor(clampNumber(Number.isFinite(configuredFolderBlockManifestRadius) ? configuredFolderBlockManifestRadius : DEFAULT_FOLDER_BLOCK_MANIFEST_RADIUS, 0, MAX_FOLDER_BLOCK_MANIFEST_RADIUS));
  const episodeDiskCacheDuringFolderBuild = options.episodeDiskCacheDuringFolderBuild !== false;

  if (!libraryPath) throw new Error('libraryPath is required');
  if (!libraryService) throw new Error('libraryService is required');
  if (!contentService) throw new Error('contentService is required');

  function resolveSingleFileNovel(novelId, libraryInput = null) {
    const library = Array.isArray(libraryInput) ? libraryInput : libraryService.getLibraryCached();
    const novel = library.find(n => n && n.id === novelId);
    if (!novel) return { status: 404, body: { error: 'Not found' } };
    if (novel.isMultiFile) return { status: 400, body: { error: 'Use episode endpoint' } };
    if (!novel.singlePath) return { status: 404, body: { error: 'Path not found' } };

    return {
      novel,
      episode: null,
      sourceType: 'single',
      filePath: resolveLibraryFilePath(novel.singlePath)
    };
  }

  function resolveEpisode(novelId, episodeId, libraryInput = null) {
    const library = Array.isArray(libraryInput) ? libraryInput : libraryService.getLibraryCached();
    const novel = library.find(n => n && n.id === novelId);
    if (!novel) return { status: 404, body: { error: 'Novel not found' } };

    const episode = (novel.episodes || []).find(e => e && e.id === episodeId);
    if (!episode) return { status: 404, body: { error: 'Episode not found' } };
    if (!episode.path) return { status: 404, body: { error: 'Path not found' } };

    return {
      novel,
      episode,
      sourceType: 'episode',
      filePath: resolveLibraryFilePath(episode.path)
    };
  }

  function resolveLibraryFilePath(relPath) {
    if (typeof libraryService.safeJoinUnderLibrary === 'function') {
      return libraryService.safeJoinUnderLibrary(relPath);
    }
    return path.join(libraryPath, relPath);
  }

  function resolveNovel(novelId, libraryInput = null) {
    const library = Array.isArray(libraryInput) ? libraryInput : libraryService.getLibraryCached();
    const novel = library.find(n => n && n.id === novelId);
    if (!novel) return { status: 404, body: { error: 'Not found' } };
    return { novel };
  }

  async function getSingleManifest(novelId, query = {}, requestOptions = {}) {
    const library = typeof libraryService.getLibraryCachedForRequestAsync === 'function'
      ? await libraryService.getLibraryCachedForRequestAsync()
      : typeof libraryService.getLibraryCachedAsync === 'function'
        ? await libraryService.getLibraryCachedAsync()
        : libraryService.getLibraryCached();
    const base = resolveNovel(novelId, library);
    if (base.status) return base;
    const preprocessOptions = contentService.parsePreprocessOptionsFromQuery(query);
    if (base.novel && base.novel.isMultiFile) {
      const body = await buildMultiFileManifest(base.novel, preprocessOptions, { query, signal: requestOptions.signal });
      return { status: 200, body };
    }

    const resolved = resolveSingleFileNovel(novelId, library);
    if (resolved.status) return resolved;
    const body = await buildManifest(resolved, preprocessOptions, null, { signal: requestOptions.signal });
    return { status: 200, body };
  }

  async function getEpisodeManifest(novelId, episodeId, query = {}, requestOptions = {}) {
    assertNotAborted(requestOptions.signal);
    const library = typeof libraryService.getLibraryCachedForRequestAsync === 'function'
      ? await libraryService.getLibraryCachedForRequestAsync()
      : typeof libraryService.getLibraryCachedAsync === 'function'
        ? await libraryService.getLibraryCachedAsync()
        : libraryService.getLibraryCached();
    const resolved = resolveEpisode(novelId, episodeId, library);
    if (resolved.status) return resolved;
    const preprocessOptions = contentService.parsePreprocessOptionsFromQuery(query);
    const body = await buildManifestWithEpisodeDiskCache(resolved, preprocessOptions, -1, { signal: requestOptions.signal });
    return { status: 200, body };
  }

  async function buildMultiFileManifest(novel, preprocessOptions, options = {}) {
    const episodes = Array.isArray(novel && novel.episodes) ? novel.episodes : [];
    const signal = options.signal || null;
    assertNotAborted(signal);
    const preprocessSignature = contentService.serializePreprocessOptions(preprocessOptions);
    const folderOptions = resolveFolderManifestRequestOptions(novel, episodes, options.query || {});
    const structuralKey = getFolderManifestStructuralKey(novel, episodes, preprocessSignature, folderOptions);
    const hotManifest = getHotFolderManifest(structuralKey);
    if (hotManifest) return hotManifest;
    const inflight = folderManifestInflight.get(structuralKey);
    if (inflight) {
      manifestCacheMetrics.folderManifestInflightJoins += 1;
      return waitForPromiseWithAbort(inflight, signal);
    }
    manifestCacheMetrics.folderManifestInflightLoads += 1;
    const task = buildMultiFileManifestFresh(novel, episodes, preprocessOptions, preprocessSignature, structuralKey, folderOptions, signal)
      .finally(() => {
        if (folderManifestInflight.get(structuralKey) === task) folderManifestInflight.delete(structuralKey);
      });
    folderManifestInflight.set(structuralKey, task);
    return task;
  }

  async function buildMultiFileManifestFresh(novel, episodes, preprocessOptions, preprocessSignature, structuralKey, folderOptions, signal = null) {
    const startedAt = Date.now();
    assertNotAborted(signal);
    const folderSignature = await resolveFolderManifestSignatureAsync(novel, episodes, preprocessSignature, structuralKey, folderOptions);
    const cachedFolderManifest = await readFolderManifestFromDiskAsync(folderSignature);
    if (cachedFolderManifest) {
      setHotFolderManifest(structuralKey, folderSignature, cachedFolderManifest);
      manifestCacheMetrics.lastFolderManifestBuildMs = Math.max(0, Date.now() - startedAt);
      return cachedFolderManifest;
    }
    if (folderOptions.partial) manifestCacheMetrics.folderManifestWindowBuilds += 1;
    else manifestCacheMetrics.folderManifestFullBuilds += 1;
    manifestCacheMetrics.lastFolderManifestScope = folderOptions.scope;
    manifestCacheMetrics.lastFolderManifestWindowStartIndex = folderOptions.windowStartIndex;
    manifestCacheMetrics.lastFolderManifestWindowEndIndex = folderOptions.windowEndIndex;
    manifestCacheMetrics.lastFolderManifestCenterEpisodeIndex = folderOptions.centerEpisodeIndex;
    let totalChunks = 0;
    let totalBlocks = 0;
    let totalChars = 0;
    const episodeManifests = [];

    for (const entry of folderOptions.entries) {
      assertNotAborted(signal);
      const index = Math.max(0, Number(entry && entry.index) || 0);
      const episode = entry && entry.episode;
      if (!episode || !episode.path) continue;
      const filePath = resolveLibraryFilePath(episode.path);
      const manifest = await buildManifestWithEpisodeDiskCache({ novel, episode, sourceType: 'episode', filePath }, preprocessOptions, index, {
        writeDisk: episodeDiskCacheDuringFolderBuild,
        source: 'folder-build',
        signal
      });
      const blockStart = totalBlocks;
      const charStart = totalChars;
      const episodeChunks = Array.isArray(manifest.chunks) ? manifest.chunks.map(chunk => {
        const localBlocks = Array.isArray(chunk.blocks) ? chunk.blocks.map(block => ({
          ...block,
          folderCharStart: charStart + Math.max(0, Number(block.charStart) || 0),
          folderCharEnd: charStart + Math.max(0, Number(block.charEnd) || 0)
        })) : [];
        return {
          ...chunk,
          folderBlockStart: blockStart + Math.max(0, Number(chunk.blockStart) || 0),
          folderCharStart: charStart + Math.max(0, Number(chunk.charStart) || 0),
          episodeId: episode.id,
          blockCharRangesPass: chunk.blockCharRangesPass || BLOCK_MANIFEST_BLOCK_CHAR_RANGES_PASS,
          blocks: localBlocks
        };
      }) : [];

      const episodeTotalChunks = Math.max(1, Number(manifest.totalChunks) || 1);
      const episodeTotalBlocks = Math.max(1, Number(manifest.totalBlocks) || 1);
      const episodeTotalChars = Math.max(0, Number(manifest.totalChars) || 0);

      episodeManifests.push({
        episodeId: episode.id,
        title: episode.title || '',
        index,
        blockStart,
        charStart,
        totalChunks: episodeTotalChunks,
        totalBlocks: episodeTotalBlocks,
        totalChars: episodeTotalChars,
        contentHash: manifest.contentHash || '',
        statSignature: manifest.statSignature || '',
        episodeManifestDiskCachePass: manifest.episodeManifestDiskCachePass || '',
        episodeManifestDiskCacheV469Pass: manifest.episodeManifestDiskCacheV469Pass || '',
        blockManifestStableEtagPass: manifest.blockManifestStableEtagPass || '',
        episodeSignatureHash: manifest.episodeSignatureHash || '',
        chunks: episodeChunks
      });

      totalChunks += episodeTotalChunks;
      totalBlocks += episodeTotalBlocks;
      totalChars += episodeTotalChars;
      await yieldDuringFolderBuild(episodeManifests.length, signal);
    }

    const manifest = {
      version: BLOCK_MANIFEST_COORDINATE_VERSION,
      novelId: novel.id,
      title: novel.title || '',
      sourceType: 'multi',
      scope: folderOptions.scope,
      partial: folderOptions.partial,
      totalEpisodes: folderOptions.totalEpisodes,
      manifestedEpisodes: episodeManifests.length,
      windowStartIndex: folderOptions.windowStartIndex,
      windowEndIndex: folderOptions.windowEndIndex,
      centerEpisodeIndex: folderOptions.centerEpisodeIndex,
      centerEpisodeId: folderOptions.centerEpisodeId,
      radius: folderOptions.radius,
      folderBlockManifestWindowPass: FOLDER_BLOCK_MANIFEST_WINDOW_PASS,
      preprocessOptions,
      preprocessSignature,
      totalChunks: Math.max(1, totalChunks),
      totalBlocks: Math.max(1, totalBlocks),
      totalChars: Math.max(0, totalChars),
      windowTotalChunks: Math.max(1, totalChunks),
      windowTotalBlocks: Math.max(1, totalBlocks),
      windowTotalChars: Math.max(0, totalChars),
      totalsRepresent: folderOptions.partial ? 'window' : 'full',
      generatedAt: Date.now(),
      folderManifestDiskCachePass: BLOCK_MANIFEST_DISK_CACHE_PASS,
      folderManifestEpisodeDiskCachePass: BLOCK_MANIFEST_EPISODE_DISK_CACHE_V469_PASS,
      blockManifestStableEtagPass: BLOCK_MANIFEST_STABLE_ETAG_PASS,
      blockManifestAsyncIoPass: BLOCK_MANIFEST_ASYNC_IO_PASS,
      blockManifestBlockCharRangesPass: BLOCK_MANIFEST_BLOCK_CHAR_RANGES_PASS,
      folderSignatureHash: folderSignature.hash,
      episodes: episodeManifests
    };
    await writeFolderManifestToDiskAsync(folderSignature, manifest);
    setHotFolderManifest(structuralKey, folderSignature, manifest);
    manifestCacheMetrics.lastFolderManifestBuildMs = Math.max(0, Date.now() - startedAt);
    return manifest;
  }

  async function buildManifestWithEpisodeDiskCache(resolved, preprocessOptions, episodeIndex = -1, cacheOptions = {}) {
    const signal = cacheOptions.signal || null;
    assertNotAborted(signal);
    const preprocessSignature = contentService.serializePreprocessOptions(preprocessOptions);
    const signature = await buildEpisodeManifestSignatureAsync(resolved, preprocessSignature, episodeIndex);
    const writeDisk = cacheOptions.writeDisk !== false;
    const cached = await readEpisodeManifestFromDiskAsync(signature);
    if (cached) {
      const cacheKey = getManifestCacheKeyFromManifest(resolved, cached, preprocessSignature);
      if (cacheKey) setCachedManifest(cacheKey, cached);
      return cached;
    }
    const inflightKey = signature?.hash || '';
    const inflight = inflightKey ? episodeManifestInflight.get(inflightKey) : null;
    if (inflight) {
      manifestCacheMetrics.episodeManifestInflightJoins += 1;
      const joinedManifest = await waitForPromiseWithAbort(inflight, signal);
      if (writeDisk) await writeEpisodeManifestToDiskAsync(signature, joinedManifest);
      else manifestCacheMetrics.episodeManifestDiskWriteSkippedForFolderBuild += 1;
      return joinedManifest;
    }
    manifestCacheMetrics.episodeManifestInflightLoads += 1;
    const task = buildManifest(resolved, preprocessOptions, signature, { signal })
      .finally(() => {
        if (inflightKey && episodeManifestInflight.get(inflightKey) === task) episodeManifestInflight.delete(inflightKey);
      });
    if (inflightKey) episodeManifestInflight.set(inflightKey, task);
    const manifest = await waitForPromiseWithAbort(task, signal);
    if (writeDisk) await writeEpisodeManifestToDiskAsync(signature, manifest);
    else manifestCacheMetrics.episodeManifestDiskWriteSkippedForFolderBuild += 1;
    return manifest;
  }

  async function buildManifest(resolved, preprocessOptions, episodeDiskSignature = null, requestOptions = {}) {
    const signal = requestOptions.signal || null;
    assertNotAborted(signal);
    const entry = await contentService.getCachedFileEntryAsync(resolved.filePath, preprocessOptions, { signal });
    assertNotAborted(signal);
    const preprocessSignature = contentService.serializePreprocessOptions(preprocessOptions);
    const cacheKey = getManifestCacheKey(resolved, entry, preprocessSignature);
    const cached = getCachedManifest(cacheKey);
    if (cached) return cached;

    const totalChunks = contentService.getTotalChunks(entry);
    const chunks = [];
    let blockStart = 0;
    if (typeof contentService.getChunkByLineAsync !== 'function') {
      throw Object.assign(new Error('async content chunk reader is required'), { code:'ASYNC_CONTENT_READER_REQUIRED' });
    }
    const readChunk = (chunk, fileHandle) => contentService.getChunkByLineAsync(entry, chunk, { signal, fileHandle });
    const withFileHandle = typeof contentService.withCachedFileHandle === 'function'
      ? (callback) => contentService.withCachedFileHandle(entry, callback)
      : (callback) => callback(null);

    await withFileHandle(async (fileHandle) => {
      for (let chunk = 1; chunk <= totalChunks; chunk += 1) {
        assertNotAborted(signal);
        const range = await readChunk(chunk, fileHandle);
        const blocks = splitContentBlocks(range.content, signal);
        const blockCount = Math.max(1, blocks.length || 1);
        const chunkCharStart = Number(range.start) || 0;
        const blockRanges = blocks.map(block => ({
          index: Math.max(0, Number(block.index) || 0),
          localCharStart: Math.max(0, Number(block.start) || 0),
          localCharEnd: Math.max(0, Number(block.end) || 0),
          charStart: chunkCharStart + Math.max(0, Number(block.start) || 0),
          charEnd: chunkCharStart + Math.max(0, Number(block.end) || 0)
        }));
        chunks.push({
          chunk,
          blockStart,
          blockCount,
          charStart: chunkCharStart,
          charEnd: Number(range.end) || 0,
          blockCharRangesPass: BLOCK_MANIFEST_BLOCK_CHAR_RANGES_PASS,
          blocks: blockRanges
        });
        blockStart += blockCount;
      }
    });

    const text = String(entry && entry.text || '');
    const totalChars = typeof contentService.getTotalChars === 'function' ? contentService.getTotalChars(entry) : text.length;
    const contentHash = entry && entry.textHash ? String(entry.textHash) : sha1(text);
    const novel = resolved.novel;
    const episode = resolved.episode;

    const manifest = {
      version: BLOCK_MANIFEST_COORDINATE_VERSION,
      novelId: novel.id,
      episodeId: episode ? episode.id : null,
      title: episode ? episode.title : novel.title,
      novelTitle: episode ? novel.title : null,
      sourceType: resolved.sourceType,
      preprocessOptions,
      preprocessSignature,
      contentHash,
      statSignature: entry && entry.statSig || '',
      chunkBase: 1,
      blockBase: 0,
      totalChunks,
      totalBlocks: blockStart,
      totalChars,
      generatedAt: Date.now(),
      episodeManifestDiskCachePass: episodeDiskSignature ? BLOCK_MANIFEST_EPISODE_DISK_CACHE_PASS : '',
      episodeManifestDiskCacheV469Pass: episodeDiskSignature ? BLOCK_MANIFEST_EPISODE_DISK_CACHE_V469_PASS : '',
      blockManifestStableEtagPass: episodeDiskSignature ? BLOCK_MANIFEST_STABLE_ETAG_PASS : '',
      blockManifestAsyncIoPass: BLOCK_MANIFEST_ASYNC_IO_PASS,
      blockManifestBlockCharRangesPass: BLOCK_MANIFEST_BLOCK_CHAR_RANGES_PASS,
      episodeSignatureHash: episodeDiskSignature?.hash || '',
      chunks
    };
    setCachedManifest(cacheKey, manifest);
    return manifest;
  }

  function getManifestCacheKey(resolved, entry, preprocessSignature) {
    return [
      resolved.filePath || '',
      entry && entry.statSig || '',
      entry && entry.textHash || '',
      preprocessSignature || '',
      resolved.sourceType || '',
      resolved.episode && resolved.episode.id || 'single'
    ].join('::');
  }


  function getManifestCacheKeyFromManifest(resolved, manifest, preprocessSignature) {
    if (!manifest) return '';
    return [resolved.filePath || '', manifest.statSignature || '', manifest.contentHash || '', preprocessSignature || '', resolved.sourceType || '', resolved.episode && resolved.episode.id || 'single'].join('::');
  }

  function buildEpisodeManifestSignature(resolved, preprocessSignature, episodeIndex = -1) {
    if (!resolved || !resolved.filePath || resolved.sourceType !== 'episode') return null;
    const episode = resolved.episode || {};
    const novel = resolved.novel || {};
    const payload = {
      schema: EPISODE_MANIFEST_DISK_SCHEMA,
      pass: BLOCK_MANIFEST_EPISODE_DISK_CACHE_PASS,
      novelId: String(novel.id || ''),
      episodeId: String(episode.id || ''),
      title: String(episode.title || ''),
      path: String(episode.path || ''),
      sourceType: String(resolved.sourceType || ''),
      preprocessSignature: String(preprocessSignature || ''),
      canonicalPath: canonicalFilePath(resolved.filePath),
      statSignature: statFileSignature(resolved.filePath),
      normalizationVersion: NORMALIZATION_ALGORITHM_VERSION,
      chunkIndexVersion: CHUNK_INDEX_ALGORITHM_VERSION
    };
    return { payload, hash: sha1(JSON.stringify(payload)) };
  }

  async function buildEpisodeManifestSignatureAsync(resolved, preprocessSignature, episodeIndex = -1) {
    if (!resolved || !resolved.filePath || resolved.sourceType !== 'episode') return null;
    const episode = resolved.episode || {};
    const novel = resolved.novel || {};
    const payload = {
      schema: EPISODE_MANIFEST_DISK_SCHEMA,
      pass: BLOCK_MANIFEST_EPISODE_DISK_CACHE_PASS,
      asyncIoPass: BLOCK_MANIFEST_ASYNC_IO_PASS,
      novelId: String(novel.id || ''),
      episodeId: String(episode.id || ''),
      title: String(episode.title || ''),
      path: String(episode.path || ''),
      sourceType: String(resolved.sourceType || ''),
      preprocessSignature: String(preprocessSignature || ''),
      canonicalPath: canonicalFilePath(resolved.filePath),
      statSignature: await statFileSignatureAsync(resolved.filePath),
      normalizationVersion: NORMALIZATION_ALGORITHM_VERSION,
      chunkIndexVersion: CHUNK_INDEX_ALGORITHM_VERSION
    };
    return { payload, hash: sha1(JSON.stringify(payload)) };
  }

  function getEpisodeManifestDiskPath(signature) {
    if (!manifestDiskCacheDir || !signature?.hash) return '';
    const hash = signature.hash;
    return path.join(manifestDiskCacheDir, 'episodes', hash.slice(0, 2), hash + '.json');
  }

  async function readValidatedManifestJsonAsync(cachePath) {
    manifestCacheMetrics.asyncDiskReadCalls += 1;
    try {
      const st = await fs.promises.lstat(cachePath);
      if (!st.isFile() || st.isSymbolicLink()) return null;
      return JSON.parse(await fs.promises.readFile(cachePath, 'utf-8'));
    } catch (error) {
      if (error && error.code === 'ENOENT') return null;
      return null;
    }
  }

  async function readEpisodeManifestFromDiskAsync(signature) {
    if (!signature) return null;
    const cachePath = getEpisodeManifestDiskPath(signature);
    if (!cachePath) {
      manifestCacheMetrics.episodeManifestDiskBypasses += 1;
      manifestCacheMetrics.lastEpisodeManifestDiskBypassReason = 'episode manifest disk cache dir unavailable';
      return null;
    }
    const raw = await readValidatedManifestJsonAsync(cachePath);
    if (!raw || raw.schema !== EPISODE_MANIFEST_DISK_SCHEMA || raw.signatureHash !== signature.hash || JSON.stringify(raw.signature || {}) !== JSON.stringify(signature.payload || {}) || !raw.manifest || typeof raw.manifest !== 'object') {
      manifestCacheMetrics.episodeManifestDiskMisses += 1;
      return null;
    }
    manifestCacheMetrics.episodeManifestDiskHits += 1;
    return {
      ...raw.manifest,
      episodeManifestDiskCachePass: BLOCK_MANIFEST_EPISODE_DISK_CACHE_PASS,
      episodeManifestDiskCacheV469Pass: BLOCK_MANIFEST_EPISODE_DISK_CACHE_V469_PASS,
      blockManifestStableEtagPass: BLOCK_MANIFEST_STABLE_ETAG_PASS,
      blockManifestAsyncIoPass: BLOCK_MANIFEST_ASYNC_IO_PASS,
      episodeSignatureHash: signature.hash
    };
  }

  async function writeEpisodeManifestToDiskAsync(signature, manifest) {
    if (!signature || !manifest) return false;
    const cachePath = getEpisodeManifestDiskPath(signature);
    manifestCacheMetrics.episodeManifestDiskWriteAttempts += 1;
    if (!cachePath) {
      manifestCacheMetrics.episodeManifestDiskBypasses += 1;
      manifestCacheMetrics.lastEpisodeManifestDiskBypassReason = 'episode manifest disk cache dir unavailable';
      return false;
    }
    try {
      if (await readEpisodeManifestFromDiskAsync(signature)) {
        manifestCacheMetrics.episodeManifestDiskWriteSkippedFresh += 1;
        return true;
      }
      const body = JSON.stringify({
        schema: EPISODE_MANIFEST_DISK_SCHEMA,
        pass: BLOCK_MANIFEST_EPISODE_DISK_CACHE_PASS,
        asyncIoPass: BLOCK_MANIFEST_ASYNC_IO_PASS,
        v469Pass: BLOCK_MANIFEST_EPISODE_DISK_CACHE_V469_PASS,
        stableEtagPass: BLOCK_MANIFEST_STABLE_ETAG_PASS,
        signatureHash: signature.hash,
        signature: signature.payload,
        manifest: {
          ...manifest,
          episodeManifestDiskCachePass: BLOCK_MANIFEST_EPISODE_DISK_CACHE_PASS,
          episodeManifestDiskCacheV469Pass: BLOCK_MANIFEST_EPISODE_DISK_CACHE_V469_PASS,
          blockManifestStableEtagPass: BLOCK_MANIFEST_STABLE_ETAG_PASS,
          blockManifestAsyncIoPass: BLOCK_MANIFEST_ASYNC_IO_PASS,
          episodeSignatureHash: signature.hash
        }
      });
      manifestCacheMetrics.asyncDiskWriteCalls += 1;
      await atomicWriteFileAsync(cachePath, body, { encoding:'utf8', mode:0o600 });
      manifestCacheMetrics.episodeManifestDiskWriteStored += 1;
      return true;
    } catch (error) {
      manifestCacheMetrics.lastEpisodeManifestDiskBypassReason = 'episode manifest disk write failed';
      return false;
    }
  }

  function readEpisodeManifestFromDisk(signature) {
    if (!signature) return null;
    const cachePath = getEpisodeManifestDiskPath(signature);
    if (!cachePath) { manifestCacheMetrics.episodeManifestDiskBypasses += 1; manifestCacheMetrics.lastEpisodeManifestDiskBypassReason = 'episode manifest disk cache dir unavailable'; return null; }
    try {
      if (!fs.existsSync(cachePath)) { manifestCacheMetrics.episodeManifestDiskMisses += 1; return null; }
      const raw = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      if (!raw || raw.schema !== EPISODE_MANIFEST_DISK_SCHEMA || raw.signatureHash !== signature.hash || JSON.stringify(raw.signature || {}) !== JSON.stringify(signature.payload || {}) || !raw.manifest || typeof raw.manifest !== 'object') { manifestCacheMetrics.episodeManifestDiskMisses += 1; return null; }
      manifestCacheMetrics.episodeManifestDiskHits += 1;
      return {
        ...raw.manifest,
        episodeManifestDiskCachePass: BLOCK_MANIFEST_EPISODE_DISK_CACHE_PASS,
        episodeManifestDiskCacheV469Pass: BLOCK_MANIFEST_EPISODE_DISK_CACHE_V469_PASS,
        blockManifestStableEtagPass: BLOCK_MANIFEST_STABLE_ETAG_PASS,
        episodeSignatureHash: signature.hash
      };
    } catch (e) { manifestCacheMetrics.episodeManifestDiskMisses += 1; return null; }
  }

  function writeEpisodeManifestToDisk(signature, manifest) {
    if (!signature || !manifest) return false;
    const cachePath = getEpisodeManifestDiskPath(signature);
    manifestCacheMetrics.episodeManifestDiskWriteAttempts += 1;
    if (!cachePath) { manifestCacheMetrics.episodeManifestDiskBypasses += 1; manifestCacheMetrics.lastEpisodeManifestDiskBypassReason = 'episode manifest disk cache dir unavailable'; return false; }
    try {
      if (fs.existsSync(cachePath) && readEpisodeManifestFromDisk(signature)) {
        manifestCacheMetrics.episodeManifestDiskWriteSkippedFresh += 1;
        return true;
      }
      atomicWriteFileSync(cachePath, JSON.stringify({
        schema: EPISODE_MANIFEST_DISK_SCHEMA,
        pass: BLOCK_MANIFEST_EPISODE_DISK_CACHE_PASS,
        v469Pass: BLOCK_MANIFEST_EPISODE_DISK_CACHE_V469_PASS,
        stableEtagPass: BLOCK_MANIFEST_STABLE_ETAG_PASS,
        signatureHash: signature.hash,
        signature: signature.payload,
        manifest: {
          ...manifest,
          episodeManifestDiskCachePass: BLOCK_MANIFEST_EPISODE_DISK_CACHE_PASS,
          episodeManifestDiskCacheV469Pass: BLOCK_MANIFEST_EPISODE_DISK_CACHE_V469_PASS,
          blockManifestStableEtagPass: BLOCK_MANIFEST_STABLE_ETAG_PASS,
          episodeSignatureHash: signature.hash
        }
      }), { encoding:'utf8', mode:0o600 });
      manifestCacheMetrics.episodeManifestDiskWriteStored += 1;
      return true;
    } catch (e) { manifestCacheMetrics.lastEpisodeManifestDiskBypassReason = 'episode manifest disk write failed'; return false; }
  }

  function canonicalFilePath(filePath) {
    return path.resolve(String(filePath || ''));
  }

  function statFileSignature(filePath) {
    try {
      const st = fs.statSync(filePath);
      return [
        Math.max(0, Number(st.size) || 0),
        Math.floor(Number(st.mtimeMs) || 0),
        Number.isFinite(Number(st.ino)) ? Number(st.ino) : 0,
        Number.isFinite(Number(st.dev)) ? Number(st.dev) : 0
      ].join(':');
    } catch (e) {
      return '0:0:0:0';
    }
  }

  async function statFileSignatureAsync(filePath) {
    manifestCacheMetrics.asyncStatSignatureCalls += 1;
    try {
      const st = await fs.promises.stat(filePath);
      return [
        Math.max(0, Number(st.size) || 0),
        Math.floor(Number(st.mtimeMs) || 0),
        Number.isFinite(Number(st.ino)) ? Number(st.ino) : 0,
        Number.isFinite(Number(st.dev)) ? Number(st.dev) : 0
      ].join(':');
    } catch (e) {
      return '0:0:0:0';
    }
  }

  async function mapWithConcurrency(items, concurrency, mapper) {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return [];
    const limit = Math.max(1, Math.min(list.length, Math.floor(Number(concurrency) || 1)));
    const results = new Array(list.length);
    let cursor = 0;
    let active = 0;
    await Promise.all(Array.from({ length: limit }, async () => {
      while (true) {
        const index = cursor++;
        if (index >= list.length) return;
        active += 1;
        manifestCacheMetrics.asyncSignatureConcurrencyPeak = Math.max(manifestCacheMetrics.asyncSignatureConcurrencyPeak, active);
        try {
          results[index] = await mapper(list[index], index);
        } finally {
          active -= 1;
        }
      }
    }));
    return results;
  }

  function buildFolderManifestSignature(novel, episodes, preprocessSignature, folderOptions) {
    const options = folderOptions || resolveFolderManifestRequestOptions(novel, episodes, {});
    const payload = {
      schema: FOLDER_MANIFEST_DISK_SCHEMA,
      pass: BLOCK_MANIFEST_DISK_CACHE_PASS,
      windowPass: FOLDER_BLOCK_MANIFEST_WINDOW_PASS,
      novelId: String(novel?.id || ''),
      title: String(novel?.title || ''),
      preprocessSignature: String(preprocessSignature || ''),
      normalizationVersion: NORMALIZATION_ALGORITHM_VERSION,
      chunkIndexVersion: CHUNK_INDEX_ALGORITHM_VERSION,
      scope: options.scope,
      partial: options.partial,
      totalEpisodes: options.totalEpisodes,
      manifestedRange: {
        start: options.windowStartIndex,
        end: options.windowEndIndex,
        center: options.centerEpisodeIndex,
        centerEpisodeId: options.centerEpisodeId,
        radius: options.radius
      },
      episodes: (Array.isArray(options.entries) ? options.entries : []).map(entry => {
        const episode = entry && entry.episode || {};
        const index = Math.max(0, Number(entry && entry.index) || 0);
        const relPath = String(episode?.path || '');
        const filePath = relPath ? resolveLibraryFilePath(relPath) : '';
        return {
          index,
          episodeId: String(episode?.id || ''),
          title: String(episode?.title || ''),
          path: relPath,
          canonicalPath: filePath ? canonicalFilePath(filePath) : '',
          statSignature: filePath ? statFileSignature(filePath) : '0:0:0:0'
        };
      })
    };
    return { payload, hash: sha1(JSON.stringify(payload)) };
  }

  function buildFolderManifestStructuralPayload(novel, episodes, preprocessSignature, folderOptions) {
    const options = folderOptions || resolveFolderManifestRequestOptions(novel, episodes, {});
    return {
      schema: FOLDER_MANIFEST_DISK_SCHEMA,
      pass: BLOCK_MANIFEST_FOLDER_BUILD_THROTTLE_PASS,
      windowPass: FOLDER_BLOCK_MANIFEST_WINDOW_PASS,
      novelId: String(novel?.id || ''),
      title: String(novel?.title || ''),
      preprocessSignature: String(preprocessSignature || ''),
      scope: options.scope,
      partial: options.partial,
      totalEpisodes: options.totalEpisodes,
      manifestedRange: {
        start: options.windowStartIndex,
        end: options.windowEndIndex,
        center: options.centerEpisodeIndex,
        centerEpisodeId: options.centerEpisodeId,
        radius: options.radius
      },
      episodes: (Array.isArray(options.entries) ? options.entries : []).map(entry => {
        const episode = entry && entry.episode || {};
        return {
          index: Math.max(0, Number(entry && entry.index) || 0),
          episodeId: String(episode?.id || ''),
          title: String(episode?.title || ''),
          path: String(episode?.path || '')
        };
      })
    };
  }

  function getFolderManifestStructuralKey(novel, episodes, preprocessSignature, folderOptions) {
    return sha1(JSON.stringify(buildFolderManifestStructuralPayload(novel, episodes, preprocessSignature, folderOptions)));
  }


  function queryValue(query, names) {
    const source = query && typeof query === 'object' ? query : {};
    for (const name of names) {
      const value = source[name];
      if (Array.isArray(value)) {
        if (value.length && value[0] != null && String(value[0]).trim()) return value[0];
      } else if (value != null && String(value).trim()) {
        return value;
      }
    }
    return '';
  }

  function parseBooleanQuery(value) {
    const raw = String(value == null ? '' : value).trim().toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes' || raw === 'full';
  }

  function parseFolderRadius(value, fallback) {
    const raw = String(value == null ? '' : value).trim();
    if (!raw) return Math.floor(clampNumber(fallback, 0, MAX_FOLDER_BLOCK_MANIFEST_RADIUS));
    const parsed = Number(raw);
    if (!Number.isInteger(parsed)) return Math.floor(clampNumber(fallback, 0, MAX_FOLDER_BLOCK_MANIFEST_RADIUS));
    return Math.floor(clampNumber(parsed, 0, MAX_FOLDER_BLOCK_MANIFEST_RADIUS));
  }

  function resolveFolderManifestRequestOptions(novel, episodes, query = {}) {
    const list = Array.isArray(episodes) ? episodes : [];
    const totalEpisodes = list.length;
    const requestedScope = String(queryValue(query, ['folderManifestScope', 'manifestScope', 'scope']) || 'window').trim().toLowerCase();
    const fullRequested = requestedScope === 'full' || parseBooleanQuery(queryValue(query, ['fullFolderManifest', 'full']));
    const radius = parseFolderRadius(queryValue(query, ['folderManifestRadius', 'radius']), folderBlockManifestRadius);
    const centerEpisodeId = String(queryValue(query, ['centerEpisodeId', 'folderCenterEpisodeId', 'episodeId']) || '').trim();
    let centerEpisodeIndex = centerEpisodeId ? list.findIndex(episode => String(episode && episode.id || '') === centerEpisodeId) : -1;
    if (centerEpisodeIndex < 0) {
      const rawIndex = queryValue(query, ['centerEpisodeIndex', 'folderCenterEpisodeIndex']);
      const parsedIndex = Number(rawIndex);
      if (Number.isInteger(parsedIndex)) centerEpisodeIndex = parsedIndex;
    }
    if (centerEpisodeIndex < 0) centerEpisodeIndex = 0;
    centerEpisodeIndex = totalEpisodes ? Math.floor(clampNumber(centerEpisodeIndex, 0, totalEpisodes - 1)) : -1;
    const scope = fullRequested ? 'full' : 'window';
    const partial = scope !== 'full';
    const windowStartIndex = totalEpisodes ? (partial ? Math.max(0, centerEpisodeIndex - radius) : 0) : -1;
    const windowEndIndex = totalEpisodes ? (partial ? Math.min(totalEpisodes - 1, centerEpisodeIndex + radius) : totalEpisodes - 1) : -1;
    const entries = [];
    if (windowStartIndex >= 0 && windowEndIndex >= windowStartIndex) {
      for (let index = windowStartIndex; index <= windowEndIndex; index += 1) {
        entries.push({ index, episode: list[index] });
      }
    }
    const resolvedCenterEpisodeId = centerEpisodeIndex >= 0 ? String(list[centerEpisodeIndex] && list[centerEpisodeIndex].id || centerEpisodeId || '') : '';
    return {
      scope,
      partial,
      totalEpisodes,
      radius: partial ? radius : Math.max(0, totalEpisodes - 1),
      centerEpisodeIndex,
      centerEpisodeId: resolvedCenterEpisodeId,
      windowStartIndex,
      windowEndIndex,
      entries
    };
  }

  function trimMapToLimit(map, maxEntries) {
    if (!map || !maxEntries) return;
    while (map.size > maxEntries) {
      const oldestKey = map.keys().next().value;
      if (!oldestKey) break;
      map.delete(oldestKey);
    }
  }

  function getHotFolderManifest(structuralKey) {
    if (!structuralKey || !folderManifestHotCacheTtlMs || !folderRuntimeCacheMax) return null;
    const hit = folderManifestHotCache.get(structuralKey);
    const now = Date.now();
    if (!hit || hit.expiresAt <= now || !hit.manifest) {
      if (hit) folderManifestHotCache.delete(structuralKey);
      manifestCacheMetrics.folderManifestHotCacheMisses += 1;
      return null;
    }
    manifestCacheMetrics.folderManifestHotCacheHits += 1;
    folderManifestHotCache.delete(structuralKey);
    folderManifestHotCache.set(structuralKey, hit);
    return hit.manifest;
  }

  function setHotFolderManifest(structuralKey, signature, manifest) {
    if (!structuralKey || !manifest || !folderManifestHotCacheTtlMs || !folderRuntimeCacheMax) return;
    folderManifestHotCache.set(structuralKey, {
      signatureHash: signature?.hash || '',
      expiresAt: Date.now() + folderManifestHotCacheTtlMs,
      manifest
    });
    manifestCacheMetrics.folderManifestHotCacheStores += 1;
    trimMapToLimit(folderManifestHotCache, folderRuntimeCacheMax);
  }

  async function buildFolderManifestSignatureAsync(novel, episodes, preprocessSignature, folderOptions) {
    const options = folderOptions || resolveFolderManifestRequestOptions(novel, episodes, {});
    const entries = await mapWithConcurrency(Array.isArray(options.entries) ? options.entries : [], 8, async entry => {
      const episode = entry && entry.episode || {};
      const index = Math.max(0, Number(entry && entry.index) || 0);
      const relPath = String(episode?.path || '');
      const filePath = relPath ? resolveLibraryFilePath(relPath) : '';
      return {
        index,
        episodeId: String(episode?.id || ''),
        title: String(episode?.title || ''),
        path: relPath,
        canonicalPath: filePath ? canonicalFilePath(filePath) : '',
        statSignature: filePath ? await statFileSignatureAsync(filePath) : '0:0:0:0'
      };
    });
    const payload = {
      schema: FOLDER_MANIFEST_DISK_SCHEMA,
      pass: BLOCK_MANIFEST_DISK_CACHE_PASS,
      asyncIoPass: BLOCK_MANIFEST_ASYNC_IO_PASS,
      windowPass: FOLDER_BLOCK_MANIFEST_WINDOW_PASS,
      novelId: String(novel?.id || ''),
      title: String(novel?.title || ''),
      preprocessSignature: String(preprocessSignature || ''),
      normalizationVersion: NORMALIZATION_ALGORITHM_VERSION,
      chunkIndexVersion: CHUNK_INDEX_ALGORITHM_VERSION,
      scope: options.scope,
      partial: options.partial,
      totalEpisodes: options.totalEpisodes,
      manifestedRange: {
        start: options.windowStartIndex,
        end: options.windowEndIndex,
        center: options.centerEpisodeIndex,
        centerEpisodeId: options.centerEpisodeId,
        radius: options.radius
      },
      episodes: entries
    };
    return { payload, hash: sha1(JSON.stringify(payload)) };
  }

  async function resolveFolderManifestSignatureAsync(novel, episodes, preprocessSignature, structuralKey, folderOptions) {
    const key = structuralKey || getFolderManifestStructuralKey(novel, episodes, preprocessSignature, folderOptions);
    const now = Date.now();
    if (key && folderSignatureCacheTtlMs && folderRuntimeCacheMax) {
      const hit = folderSignatureCache.get(key);
      if (hit && hit.expiresAt > now && hit.signature) {
        manifestCacheMetrics.folderSignatureCacheHits += 1;
        folderSignatureCache.delete(key);
        folderSignatureCache.set(key, hit);
        return hit.signature;
      }
      if (hit) folderSignatureCache.delete(key);
    }
    manifestCacheMetrics.folderSignatureCacheMisses += 1;
    const signature = await buildFolderManifestSignatureAsync(novel, episodes, preprocessSignature, folderOptions);
    if (key && folderSignatureCacheTtlMs && folderRuntimeCacheMax) {
      folderSignatureCache.set(key, { expiresAt: now + folderSignatureCacheTtlMs, signature });
      trimMapToLimit(folderSignatureCache, folderRuntimeCacheMax);
    }
    return signature;
  }

  function resolveFolderManifestSignature(novel, episodes, preprocessSignature, structuralKey, folderOptions) {
    const key = structuralKey || getFolderManifestStructuralKey(novel, episodes, preprocessSignature, folderOptions);
    const now = Date.now();
    if (key && folderSignatureCacheTtlMs && folderRuntimeCacheMax) {
      const hit = folderSignatureCache.get(key);
      if (hit && hit.expiresAt > now && hit.signature) {
        manifestCacheMetrics.folderSignatureCacheHits += 1;
        folderSignatureCache.delete(key);
        folderSignatureCache.set(key, hit);
        return hit.signature;
      }
      if (hit) folderSignatureCache.delete(key);
    }
    manifestCacheMetrics.folderSignatureCacheMisses += 1;
    const signature = buildFolderManifestSignature(novel, episodes, preprocessSignature, folderOptions);
    if (key && folderSignatureCacheTtlMs && folderRuntimeCacheMax) {
      folderSignatureCache.set(key, { expiresAt: now + folderSignatureCacheTtlMs, signature });
      trimMapToLimit(folderSignatureCache, folderRuntimeCacheMax);
    }
    return signature;
  }

  function yieldDuringFolderBuild(doneEpisodes, signal = null) {
    assertNotAborted(signal);
    if (!folderBuildYieldEvery || doneEpisodes <= 0 || doneEpisodes % folderBuildYieldEvery !== 0) return Promise.resolve();
    manifestCacheMetrics.folderManifestBuildYields += 1;
    return new Promise((resolve, reject) => {
      setImmediate(() => {
        try {
          assertNotAborted(signal);
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  function getFolderManifestDiskPath(signature) {
    if (!manifestDiskCacheDir || !signature?.hash) return '';
    const hash = signature.hash;
    return path.join(manifestDiskCacheDir, hash.slice(0, 2), hash + '.json');
  }

  async function readFolderManifestFromDiskAsync(signature) {
    const cachePath = getFolderManifestDiskPath(signature);
    if (!cachePath) {
      manifestCacheMetrics.manifestDiskBypasses += 1;
      manifestCacheMetrics.lastManifestDiskBypassReason = 'manifest disk cache dir unavailable';
      return null;
    }
    const raw = await readValidatedManifestJsonAsync(cachePath);
    if (!raw || raw.schema !== FOLDER_MANIFEST_DISK_SCHEMA || raw.signatureHash !== signature.hash || JSON.stringify(raw.signature || {}) !== JSON.stringify(signature.payload || {}) || !raw.manifest || typeof raw.manifest !== 'object') {
      manifestCacheMetrics.manifestDiskMisses += 1;
      return null;
    }
    manifestCacheMetrics.manifestDiskHits += 1;
    return {
      ...raw.manifest,
      folderManifestDiskCachePass: BLOCK_MANIFEST_DISK_CACHE_PASS,
      folderManifestEpisodeDiskCachePass: BLOCK_MANIFEST_EPISODE_DISK_CACHE_V469_PASS,
      blockManifestStableEtagPass: BLOCK_MANIFEST_STABLE_ETAG_PASS,
      blockManifestAsyncIoPass: BLOCK_MANIFEST_ASYNC_IO_PASS,
      folderSignatureHash: signature.hash
    };
  }

  async function writeFolderManifestToDiskAsync(signature, manifest) {
    const cachePath = getFolderManifestDiskPath(signature);
    manifestCacheMetrics.manifestDiskWriteAttempts += 1;
    if (!cachePath) {
      manifestCacheMetrics.manifestDiskBypasses += 1;
      manifestCacheMetrics.lastManifestDiskBypassReason = 'manifest disk cache dir unavailable';
      return false;
    }
    try {
      if (await readFolderManifestFromDiskAsync(signature)) {
        manifestCacheMetrics.manifestDiskWriteSkippedFresh += 1;
        return true;
      }
      const payload = {
        schema: FOLDER_MANIFEST_DISK_SCHEMA,
        pass: BLOCK_MANIFEST_DISK_CACHE_PASS,
        asyncIoPass: BLOCK_MANIFEST_ASYNC_IO_PASS,
        v469Pass: BLOCK_MANIFEST_EPISODE_DISK_CACHE_V469_PASS,
        stableEtagPass: BLOCK_MANIFEST_STABLE_ETAG_PASS,
        signatureHash: signature.hash,
        signature: signature.payload,
        manifest: { ...manifest, blockManifestAsyncIoPass: BLOCK_MANIFEST_ASYNC_IO_PASS }
      };
      manifestCacheMetrics.asyncDiskWriteCalls += 1;
      await atomicWriteFileAsync(cachePath, JSON.stringify(payload), { encoding:'utf8', mode:0o600 });
      manifestCacheMetrics.manifestDiskWriteStored += 1;
      return true;
    } catch (error) {
      manifestCacheMetrics.lastManifestDiskBypassReason = 'manifest disk write failed';
      return false;
    }
  }

  function readFolderManifestFromDisk(signature) {
    const cachePath = getFolderManifestDiskPath(signature);
    if (!cachePath) {
      manifestCacheMetrics.manifestDiskBypasses += 1;
      manifestCacheMetrics.lastManifestDiskBypassReason = 'manifest disk cache dir unavailable';
      return null;
    }
    try {
      if (!fs.existsSync(cachePath)) {
        manifestCacheMetrics.manifestDiskMisses += 1;
        return null;
      }
      const raw = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      if (!raw || raw.schema !== FOLDER_MANIFEST_DISK_SCHEMA || raw.signatureHash !== signature.hash || JSON.stringify(raw.signature || {}) !== JSON.stringify(signature.payload || {}) || !raw.manifest || typeof raw.manifest !== 'object') {
        manifestCacheMetrics.manifestDiskMisses += 1;
        return null;
      }
      manifestCacheMetrics.manifestDiskHits += 1;
      return {
        ...raw.manifest,
        folderManifestDiskCachePass: BLOCK_MANIFEST_DISK_CACHE_PASS,
        folderManifestEpisodeDiskCachePass: BLOCK_MANIFEST_EPISODE_DISK_CACHE_V469_PASS,
        blockManifestStableEtagPass: BLOCK_MANIFEST_STABLE_ETAG_PASS,
        folderSignatureHash: signature.hash
      };
    } catch (e) {
      manifestCacheMetrics.manifestDiskMisses += 1;
      return null;
    }
  }

  function writeFolderManifestToDisk(signature, manifest) {
    const cachePath = getFolderManifestDiskPath(signature);
    manifestCacheMetrics.manifestDiskWriteAttempts += 1;
    if (!cachePath) {
      manifestCacheMetrics.manifestDiskBypasses += 1;
      manifestCacheMetrics.lastManifestDiskBypassReason = 'manifest disk cache dir unavailable';
      return false;
    }
    try {
      if (fs.existsSync(cachePath) && readFolderManifestFromDisk(signature)) {
        manifestCacheMetrics.manifestDiskWriteSkippedFresh += 1;
        return true;
      }
      const payload = {
        schema: FOLDER_MANIFEST_DISK_SCHEMA,
        pass: BLOCK_MANIFEST_DISK_CACHE_PASS,
        v469Pass: BLOCK_MANIFEST_EPISODE_DISK_CACHE_V469_PASS,
        stableEtagPass: BLOCK_MANIFEST_STABLE_ETAG_PASS,
        signatureHash: signature.hash,
        signature: signature.payload,
        manifest
      };
      atomicWriteFileSync(cachePath, JSON.stringify(payload), { encoding:'utf8', mode:0o600 });
      manifestCacheMetrics.manifestDiskWriteStored += 1;
      return true;
    } catch (e) {
      manifestCacheMetrics.lastManifestDiskBypassReason = 'manifest disk write failed';
      return false;
    }
  }

  function getCachedManifest(cacheKey) {
    if (!cacheKey || !manifestCacheMax) return null;
    const hit = manifestCache.get(cacheKey);
    if (!hit) {
      manifestCacheMetrics.manifestCacheMisses += 1;
      return null;
    }
    manifestCacheMetrics.manifestCacheHits += 1;
    manifestCache.delete(cacheKey);
    manifestCache.set(cacheKey, hit);
    return hit;
  }

  function setCachedManifest(cacheKey, manifest) {
    if (!cacheKey || !manifestCacheMax || !manifest) return;
    if (manifestCache.has(cacheKey)) manifestCache.delete(cacheKey);
    manifestCache.set(cacheKey, manifest);
    manifestCacheMetrics.manifestCacheStores += 1;
    while (manifestCache.size > manifestCacheMax) {
      const oldestKey = manifestCache.keys().next().value;
      if (!oldestKey) break;
      manifestCache.delete(oldestKey);
      manifestCacheMetrics.manifestCacheEvictions += 1;
    }
  }

  function clearManifestCache() {
    manifestCache.clear();
    folderManifestHotCache.clear();
    folderSignatureCache.clear();
    folderManifestInflight.clear();
    episodeManifestInflight.clear();
  }

  function getCacheStatus() {
    return {
      marker: BLOCK_MANIFEST_CACHE_STATUS_PASS,
      strategyMarker: BLOCK_MANIFEST_CACHE_STRATEGY_PASS,
      diskCacheMarker: BLOCK_MANIFEST_DISK_CACHE_PASS,
      diskCacheDir: manifestDiskCacheDir || '',
      diskCacheSchema: FOLDER_MANIFEST_DISK_SCHEMA,
      episodeDiskCacheMarker: BLOCK_MANIFEST_EPISODE_DISK_CACHE_PASS,
      episodeDiskCacheV469Marker: BLOCK_MANIFEST_EPISODE_DISK_CACHE_V469_PASS,
      stableEtagMarker: BLOCK_MANIFEST_STABLE_ETAG_PASS,
      folderBuildThrottleMarker: BLOCK_MANIFEST_FOLDER_BUILD_THROTTLE_PASS,
      asyncIoMarker: BLOCK_MANIFEST_ASYNC_IO_PASS,
      folderBlockManifestWindowMarker: FOLDER_BLOCK_MANIFEST_WINDOW_PASS,
      episodeDiskCacheSchema: EPISODE_MANIFEST_DISK_SCHEMA,
      folderBuildConfig: {
        folderSignatureCacheTtlMs,
        folderManifestHotCacheTtlMs,
        folderRuntimeCacheMax,
        folderBuildYieldEvery,
        folderBlockManifestRadius,
        folderBlockManifestWindowMarker: FOLDER_BLOCK_MANIFEST_WINDOW_PASS,
        episodeDiskCacheDuringFolderBuild
      },
      manifestCacheEntries: manifestCache.size,
      folderManifestHotCacheEntries: folderManifestHotCache.size,
      folderSignatureCacheEntries: folderSignatureCache.size,
      folderManifestInflightEntries: folderManifestInflight.size,
      episodeManifestInflightEntries: episodeManifestInflight.size,
      manifestCacheMax,
      metrics: Object.assign({}, manifestCacheMetrics)
    };
  }

  return {
    splitContentBlocks,
    getSingleManifest,
    getEpisodeManifest,
    clearManifestCache,
    getCacheStatus
  };
}

module.exports = { createBlockManifestService, splitContentBlocks, BLOCK_MANIFEST_CACHE_STATUS_PASS, BLOCK_MANIFEST_CACHE_STRATEGY_PASS, BLOCK_MANIFEST_DISK_CACHE_PASS, BLOCK_MANIFEST_EPISODE_DISK_CACHE_PASS, BLOCK_MANIFEST_EPISODE_DISK_CACHE_V469_PASS, BLOCK_MANIFEST_STABLE_ETAG_PASS, BLOCK_MANIFEST_FOLDER_BUILD_THROTTLE_PASS, BLOCK_MANIFEST_ASYNC_IO_PASS, FOLDER_BLOCK_MANIFEST_WINDOW_PASS };
