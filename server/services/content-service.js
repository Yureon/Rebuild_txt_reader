const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { decodeTextBuffer } = require('./text-decoder-service');
const { createContentEntryWorkerPool, createAbortError, CONTENT_ENTRY_WORKER_POOL_PASS } = require('./content-entry-worker-pool');

const DEFAULT_FILE_CACHE_TTL = 1000 * 60 * 60;
const DEFAULT_CHUNK_SIZE = 50000;
const DEFAULT_CHUNK_BOUNDARY_LOOKAHEAD = 250000;
const DEFAULT_FILE_CACHE_MAX = 32;
const DEFAULT_FILE_CACHE_MAX_BYTES = 48 * 1024 * 1024;
const DEFAULT_FILE_CACHE_STALE_MS = 2 * 60 * 60 * 1000;
const CONTENT_CACHE_IO_DIAGNOSTICS_PASS = 'v436-content-cache-io-diagnostics-pass';
const CONTENT_CACHE_STRATEGY_ADJUSTMENT_PASS = 'v439-cache-strategy-adjustment-pass';
const CONTENT_LARGE_TEXT_CHUNK_BOUNDARY_PASS = 'v456-content-large-text-chunk-boundary-pass';
const CONTENT_LARGE_FILE_CHUNK_CACHE_PASS = 'v457-content-large-file-chunk-cache-smoke-pass';
const CONTENT_LARGE_FILE_CHUNK_CACHE_HARDENING_PASS = 'v468-content-large-file-chunk-cache-hardening-pass';
const CHUNK_PAYLOAD_CACHE_SCHEMA = 2;
const DEFAULT_MAX_TEXT_FILE_BYTES = 100 * 1024 * 1024;
const MAX_TEXT_FILE_BYTES_PASS = 'v530-max-text-file-bytes-pass';
const CONTENT_SEARCH_SCAN_LOAD_MITIGATION_PASS = 'v537-search-scan-content-load-mitigation-pass';
const CONTENT_SERVER_WORKER_POOL_PASS = 'v541-content-server-worker-pool-pass';
const CONTENT_REQUEST_ABORT_PASS = 'v541-content-request-abort-pass';

function sha1(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex');
}

function createContentService(options = {}) {
  const CHUNK_INDEX_DIR = options.chunkIndexDir;
  const CHUNK_PAYLOAD_DIR = options.chunkPayloadDir || path.join(path.dirname(CHUNK_INDEX_DIR || '.'), 'content_chunks');
  const FILE_CACHE_TTL = options.fileCacheTtlMs || DEFAULT_FILE_CACHE_TTL;
  const CHUNK_SIZE = options.chunkSize || DEFAULT_CHUNK_SIZE;
  const CHUNK_BOUNDARY_LOOKAHEAD = Math.max(CHUNK_SIZE, Number(options.chunkBoundaryLookahead) || DEFAULT_CHUNK_BOUNDARY_LOOKAHEAD);
  const FILE_CACHE_MAX = options.fileCacheMax || DEFAULT_FILE_CACHE_MAX;
  const FILE_CACHE_MAX_BYTES = options.fileCacheMaxBytes || DEFAULT_FILE_CACHE_MAX_BYTES;
  const FILE_CACHE_STALE_MS = options.fileCacheStaleMs || DEFAULT_FILE_CACHE_STALE_MS;
  const MAX_TEXT_FILE_BYTES = Math.max(0, Number(options.maxTextFileBytes || process.env.MAX_TEXT_FILE_BYTES || DEFAULT_MAX_TEXT_FILE_BYTES));
  const CONTENT_WORKER_THREADS_ENABLED = options.workerThreadsEnabled !== false;
  const CONTENT_WORKER_POOL_SIZE = Math.max(0, Math.floor(Number(options.workerPoolSize) || 0));
  const contentWorkerPool = CONTENT_WORKER_THREADS_ENABLED ? createContentEntryWorkerPool({ maxWorkers: CONTENT_WORKER_POOL_SIZE || undefined }) : null;

  if (!CHUNK_INDEX_DIR) {
    throw new Error('chunkIndexDir is required');
  }

  const fileCache = new Map();
  const fileCacheState = { totalBytes: 0 };
  const fileCacheInflight = new Map();
  const dirtyChunkIndexes = new Map();
  const metrics = {
    statSignatureCalls: 0,
    fileReadCalls: 0,
    fileCacheHits: 0,
    fileCacheMisses: 0,
    fileCacheInflightJoins: 0,
    fileCacheInflightLoads: 0,
    fileCacheKnownSignatureLoads: 0,
    chunkIndexDiskHits: 0,
    chunkIndexDiskMisses: 0,
    chunkIndexWriteQueued: 0,
    chunkIndexWriteFlushed: 0,
    chunkPayloadDiskHits: 0,
    chunkPayloadDiskMisses: 0,
    chunkPayloadWriteAttempts: 0,
    chunkPayloadWriteStored: 0,
    chunkPayloadCacheBypasses: 0,
    lastChunkPayloadCacheBypassReason: '',
    searchScanRequests: 0,
    searchScanPayloadWriteSkipped: 0,
    contentWorkerTasksStarted: 0,
    contentWorkerTasksCompleted: 0,
    contentWorkerTaskAborts: 0,
    contentWorkerTaskFallbacks: 0,
    lastSearchScanAt: 0,
    lastFileReadMs: 0
  };
  let chunkIndexWriteTimer = null;

  function createTextFileTooLargeError(filePath, size) {
    const err = new Error('text file is larger than MAX_TEXT_FILE_BYTES');
    err.code = 'TEXT_FILE_TOO_LARGE';
    err.status = 413;
    err.statusCode = 413;
    err.filePath = filePath;
    err.size = Number(size) || 0;
    err.maxBytes = MAX_TEXT_FILE_BYTES;
    err.pass = MAX_TEXT_FILE_BYTES_PASS;
    return err;
  }

  function isAbortError(error) {
    return !!(error && (error.name === 'AbortError' || error.code === 'CONTENT_WORKER_TASK_ABORTED'));
  }

  function assertNotAborted(signal) {
    if (signal && signal.aborted) throw createAbortError('content request aborted');
  }

  function waitForInflightRecord(record, signal) {
    if (!record || !record.promise) return Promise.reject(new Error('invalid inflight content task'));
    assertNotAborted(signal);
    record.waiters += 1;
    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        if (signal && onAbort) signal.removeEventListener('abort', onAbort);
      };
      const release = () => {
        record.waiters = Math.max(0, Number(record.waiters) - 1);
        if (record.waiters === 0 && !record.settled && record.abortController && !record.abortController.signal.aborted) {
          metrics.contentWorkerTaskAborts += 1;
          record.abortController.abort();
        }
      };
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        release();
        fn(value);
      };
      const onAbort = signal ? () => finish(reject, createAbortError('content request aborted')) : null;
      if (signal && typeof signal.addEventListener === 'function') signal.addEventListener('abort', onAbort, { once: true });
      record.promise.then(
        value => finish(resolve, value),
        error => finish(reject, error)
      );
    });
  }

  function assertTextFileSizeAllowed(filePath) {
    if (!MAX_TEXT_FILE_BYTES) return null;
    const stat = fs.statSync(filePath);
    const size = Math.max(0, Number(stat && stat.size) || 0);
    if (size > MAX_TEXT_FILE_BYTES) throw createTextFileTooLargeError(filePath, size);
    return { size, maxBytes: MAX_TEXT_FILE_BYTES, pass: MAX_TEXT_FILE_BYTES_PASS };
  }

  function readFileAutoEncoding(filePath) {
    assertTextFileSizeAllowed(filePath);
    const started = Date.now();
    const raw = fs.readFileSync(filePath);
    metrics.fileReadCalls += 1;
    metrics.lastFileReadMs = Math.max(0, Date.now() - started);

    return decodeTextBuffer(raw).text;
  }

  function normalizePreprocessOptions(input) {
    const src = input && typeof input === 'object' ? input : {};
    return {
      removeNoise: src.removeNoise !== false,
      chapterSpacing: src.chapterSpacing !== false,
      collapseBreaks: src.collapseBreaks !== false,
      splitDense: src.splitDense !== false,
      dialogueBreak: src.dialogueBreak === true,
      paragraphOptimize: src.paragraphOptimize === true,
      aggressive: src.aggressive === true
    };
  }

  function parsePreprocessOptionsFromQuery(query) {
    const q = query || {};
    const on = (value, fallback) => {
      if (value == null || value === '') return fallback;
      return String(value) === '1' || String(value).toLowerCase() === 'true';
    };
    return normalizePreprocessOptions({
      removeNoise: on(q.preRemoveNoise, true),
      chapterSpacing: on(q.preChapterSpacing, true),
      collapseBreaks: on(q.preCollapseBreaks, true),
      splitDense: on(q.preSplitDense, true),
      dialogueBreak: on(q.preDialogueBreak, false),
      paragraphOptimize: on(q.preParagraphOptimize, false),
      aggressive: on(q.preAggressive, false)
    });
  }

  function serializePreprocessOptions(options) {
    const o = normalizePreprocessOptions(options);
    return [
      o.removeNoise ? 'rn1' : 'rn0',
      o.chapterSpacing ? 'cs1' : 'cs0',
      o.collapseBreaks ? 'cb1' : 'cb0',
      o.splitDense ? 'sd1' : 'sd0',
      o.dialogueBreak ? 'db1' : 'db0',
      o.paragraphOptimize ? 'po1' : 'po0',
      o.aggressive ? 'ag1' : 'ag0'
    ].join('-');
  }

  function formatNovelText(text, preprocessOptions) {
    const opts = normalizePreprocessOptions(preprocessOptions);
    let out = String(text || '');
    const stats = {
      removedNoiseLines: 0,
      chapterSpacingAdds: 0,
      collapsedBlankRuns: 0,
      splitDenseSentences: 0,
      dialogueBreaks: 0,
      paragraphOptimizations: 0
    };

    out = out.replace(/^\uFEFF/, '');
    out = out.replace(/\r\n?/g, '\n');
    out = out.replace(/[\u200B-\u200D\u2060]/g, '');
    out = out.replace(/\t/g, '  ');
    out = out.replace(/[ \u00A0]+$/gm, '');

    let lines = out.split('\n');
    if (opts.removeNoise || opts.aggressive) {
      const noiseLineRe = /(?:https?:\/\/|www\.|open\.kakao|discord|telegram|t\.me|blog\.naver|cafe\.naver|txt\s*공유|무단\s*배포|다운로드\s*링크|후원\s*링크|광고)/i;
      const aggressiveRe = /(?:작가\s*후기|공지사항|외부\s*링크|배포\s*안내|감사합니다\s*후원)/i;
      lines = lines.filter((line) => {
        const trimmed = line.trim();
        if (!trimmed) return true;
        if (opts.removeNoise && noiseLineRe.test(trimmed)) {
          stats.removedNoiseLines += 1;
          return false;
        }
        if (opts.aggressive && aggressiveRe.test(trimmed)) {
          stats.removedNoiseLines += 1;
          return false;
        }
        return true;
      });
    }

    out = lines.join('\n');

    if (opts.splitDense) {
      out = out.replace(/([.!?…]|[다요죠니다]\.)((?:[가-힣A-Z"'(\[]))/g, (m, a, b) => {
        stats.splitDenseSentences += 1;
        return a + ' ' + b;
      });
    }

    if (opts.dialogueBreak) {
      out = out.split('\n').map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.length < 24) return line;
        return line
          .replace(/([.!?…]["'”’」』》】]*)\s+(?=(?:["“‘「『〈《【\[]))/g, (m, a) => {
            stats.dialogueBreaks += 1;
            return a + '\n';
          })
          .replace(/([.!?…]["'”’」』》】]*)\s+(?=(?:-|—|―)\s*)/g, (m, a) => {
            stats.dialogueBreaks += 1;
            return a + '\n';
          });
      }).join('\n');
    }

    if (opts.chapterSpacing) {
      const chapterRe = /^\s*(?:프롤로그|에필로그|외전|후기|제\s*\d+\s*[화장편막]|\[\s*제?\s*\d+.*\]|#\s*\d+)/;
      const chapterLines = out.split('\n');
      const next = [];
      chapterLines.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && chapterRe.test(trimmed) && next.length && next[next.length - 1] !== '') {
          next.push('');
          stats.chapterSpacingAdds += 1;
        }
        next.push(line);
      });
      out = next.join('\n');
    }

    if (opts.paragraphOptimize) {
      const sourceLines = out.split('\n');
      const optimized = [];
      const dialogueLike = (txt) => /^(?:["“‘「『〈《【\[]|[-—―]\s*)/.test(txt.trim());
      const sentenceCount = (txt) => (txt.match(/[.!?…](?=\s|$|["'”’」』》】])/g) || []).length;

      for (let i = 0; i < sourceLines.length; i++) {
        let line = sourceLines[i];
        const trimmed = line.trim();

        if (!trimmed) {
          optimized.push('');
          continue;
        }

        if (trimmed.length > 120 && sentenceCount(trimmed) >= 3 && !dialogueLike(trimmed)) {
          line = line.replace(/([.!?…]["'”’」』》】]*)\s+(?=[^\n])/g, (m, a) => {
            stats.paragraphOptimizations += 1;
            return a + '\n';
          });
        }

        const prev = optimized.length ? optimized[optimized.length - 1] : '';
        const prevTrim = String(prev || '').trim();
        if (
          prevTrim &&
          prevTrim.length <= 34 &&
          trimmed.length <= 34 &&
          !/[.!?…]["'”’」』》】]*$/.test(prevTrim) &&
          !dialogueLike(prevTrim) &&
          !dialogueLike(trimmed)
        ) {
          optimized[optimized.length - 1] = prevTrim + ' ' + trimmed;
          stats.paragraphOptimizations += 1;
        } else {
          optimized.push(line);
        }
      }

      out = optimized.join('\n');
    }

    if (opts.collapseBreaks) {
      out = out.replace(/\n{3,}/g, () => {
        stats.collapsedBlankRuns += 1;
        return '\n\n';
      });
    }

    out = out.replace(/[ \t]{2,}/g, ' ');
    out = out.replace(/^\s+$/gm, '');
    return { text: out.trim(), stats };
  }

  function estimateFileCacheEntryBytes(entry) {
    try {
      return Buffer.byteLength(String(entry && entry.text || ''), 'utf8') + Buffer.byteLength(JSON.stringify(entry && entry.chunkBounds || []), 'utf8');
    } catch (e) {
      return Buffer.byteLength(String(entry && entry.text || ''), 'utf8');
    }
  }

  function touchFileCacheEntry(cacheKey, entry) {
    if (!cacheKey || !entry) return;
    if (fileCache.has(cacheKey)) fileCache.delete(cacheKey);
    fileCache.set(cacheKey, entry);
  }

  function removeFileCacheEntry(cacheKey) {
    if (!fileCache.has(cacheKey)) return false;
    const entry = fileCache.get(cacheKey);
    fileCache.delete(cacheKey);
    fileCacheState.totalBytes = Math.max(0, fileCacheState.totalBytes - Math.max(0, Number(entry && entry.bytes) || 0));
    return true;
  }

  function storeFileCacheEntry(cacheKey, entry) {
    if (!cacheKey || !entry) return entry;
    if (fileCache.has(cacheKey)) removeFileCacheEntry(cacheKey);
    fileCacheState.totalBytes += Math.max(0, Number(entry.bytes) || 0);
    touchFileCacheEntry(cacheKey, entry);
    pruneFileCache(false);
    return entry;
  }

  function pruneFileCache(force) {
    const now = Date.now();
    for (const [key, entry] of Array.from(fileCache.entries())) {
      if (!force && now - (entry && entry.time || 0) < FILE_CACHE_STALE_MS && fileCache.size <= FILE_CACHE_MAX && fileCacheState.totalBytes <= FILE_CACHE_MAX_BYTES) continue;
      if (force || now - (entry && entry.time || 0) >= FILE_CACHE_STALE_MS || fileCache.size > FILE_CACHE_MAX || fileCacheState.totalBytes > FILE_CACHE_MAX_BYTES) {
        removeFileCacheEntry(key);
      }
      if (!force && fileCache.size <= FILE_CACHE_MAX && fileCacheState.totalBytes <= FILE_CACHE_MAX_BYTES) break;
    }
  }

  function statSignature(filePath) {
    metrics.statSignatureCalls += 1;
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

  function getChunkIndexCacheKey(filePath, optionKey = '') {
    return optionKey ? String(filePath) + '::' + String(optionKey) : String(filePath);
  }

  function getChunkIndexCachePath(filePath, optionKey = '') {
    const hash = crypto.createHash('sha1').update(getChunkIndexCacheKey(filePath, optionKey)).digest('hex');
    return path.join(CHUNK_INDEX_DIR, hash + '.json');
  }


  function canonicalFilePath(filePath) {
    try { return fs.realpathSync(filePath); }
    catch (e) { return path.resolve(String(filePath || '')); }
  }

  function getChunkPayloadCacheKey(filePath, sig, optionKey = '', chunkIdx = 1) {
    return [
      'schema', CHUNK_PAYLOAD_CACHE_SCHEMA,
      'file', canonicalFilePath(filePath),
      'stat', String(sig || ''),
      'pre', String(optionKey || ''),
      'chunk', Math.max(1, Number(chunkIdx) || 1),
      'chunkSize', CHUNK_SIZE,
      'lookahead', CHUNK_BOUNDARY_LOOKAHEAD,
      'boundary', CONTENT_LARGE_TEXT_CHUNK_BOUNDARY_PASS
    ].join('::');
  }

  function getChunkPayloadCachePath(filePath, sig, optionKey = '', chunkIdx = 1) {
    const hash = crypto.createHash('sha1').update(getChunkPayloadCacheKey(filePath, sig, optionKey, chunkIdx)).digest('hex');
    return path.join(CHUNK_PAYLOAD_DIR, hash.slice(0, 2), hash + '.json');
  }

  function readChunkPayloadFromDisk(filePath, sig, optionKey = '', chunkIdx = 1) {
    const index = Math.max(1, Number(chunkIdx) || 1);
    try {
      const cachePath = getChunkPayloadCachePath(filePath, sig, optionKey, index);
      if (!fs.existsSync(cachePath)) {
        metrics.chunkPayloadDiskMisses += 1;
        return null;
      }
      const raw = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      if (!raw
        || raw.schema !== CHUNK_PAYLOAD_CACHE_SCHEMA
        || raw.pass !== CONTENT_LARGE_FILE_CHUNK_CACHE_PASS
        || raw.hardeningPass !== CONTENT_LARGE_FILE_CHUNK_CACHE_HARDENING_PASS
        || raw.filePath !== canonicalFilePath(filePath)
        || raw.statSig !== sig
        || raw.preprocessSignature !== optionKey
        || Number(raw.chunk) !== index
        || Number(raw.chunkSize) !== CHUNK_SIZE
        || Number(raw.chunkBoundaryLookahead) !== CHUNK_BOUNDARY_LOOKAHEAD
        || raw.boundaryPass !== CONTENT_LARGE_TEXT_CHUNK_BOUNDARY_PASS
        || typeof raw.content !== 'string'
        || !Number.isFinite(Number(raw.totalChunks))
        || !raw.textHash
        || Math.max(0, Number(raw.end) || 0) < Math.max(0, Number(raw.start) || 0)
        || raw.content.length !== Math.max(0, Number(raw.end) || 0) - Math.max(0, Number(raw.start) || 0)) {
        metrics.chunkPayloadDiskMisses += 1;
        return null;
      }
      metrics.chunkPayloadDiskHits += 1;
      return {
        content: raw.content,
        start: Math.max(0, Number(raw.start) || 0),
        end: Math.max(0, Number(raw.end) || 0),
        currentChunk: index,
        totalChunks: Math.max(1, Number(raw.totalChunks) || 1),
        textHash: String(raw.textHash || ''),
        statSig: sig,
        formatStats: raw.formatStats && typeof raw.formatStats === 'object' ? raw.formatStats : {},
        chunkPayloadCacheHit: true,
        chunkPayloadCachePass: CONTENT_LARGE_FILE_CHUNK_CACHE_PASS,
        chunkPayloadCacheHardeningPass: CONTENT_LARGE_FILE_CHUNK_CACHE_HARDENING_PASS
      };
    } catch (e) {
      metrics.chunkPayloadDiskMisses += 1;
      return null;
    }
  }

  function writeChunkPayloadToDisk(filePath, sig, optionKey = '', chunkIdx = 1, payload = {}) {
    metrics.chunkPayloadWriteAttempts += 1;
    try {
      const index = Math.max(1, Number(chunkIdx) || 1);
      const cachePath = getChunkPayloadCachePath(filePath, sig, optionKey, index);
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      const tmpPath = cachePath + '.' + process.pid + '.' + Date.now() + '.tmp';
      const body = {
        schema: CHUNK_PAYLOAD_CACHE_SCHEMA,
        pass: CONTENT_LARGE_FILE_CHUNK_CACHE_PASS,
        hardeningPass: CONTENT_LARGE_FILE_CHUNK_CACHE_HARDENING_PASS,
        filePath: canonicalFilePath(filePath),
        statSig: sig,
        preprocessSignature: optionKey,
        chunk: index,
        chunkSize: CHUNK_SIZE,
        chunkBoundaryLookahead: CHUNK_BOUNDARY_LOOKAHEAD,
        boundaryPass: CONTENT_LARGE_TEXT_CHUNK_BOUNDARY_PASS,
        totalChunks: Math.max(1, Number(payload.totalChunks) || 1),
        start: Math.max(0, Number(payload.start) || 0),
        end: Math.max(0, Number(payload.end) || 0),
        textHash: String(payload.textHash || ''),
        formatStats: payload.formatStats && typeof payload.formatStats === 'object' ? payload.formatStats : {},
        content: String(payload.content || '')
      };
      fs.writeFileSync(tmpPath, JSON.stringify(body), 'utf-8');
      fs.renameSync(tmpPath, cachePath);
      metrics.chunkPayloadWriteStored += 1;
      return true;
    } catch (e) {
      metrics.lastChunkPayloadCacheBypassReason = 'write failed';
      return false;
    }
  }

  function listPreprocessSignatures() {
    const keys = ['removeNoise', 'chapterSpacing', 'collapseBreaks', 'splitDense', 'dialogueBreak', 'paragraphOptimize', 'aggressive'];
    const out = [];
    for (let mask = 0; mask < (1 << keys.length); mask += 1) {
      const options = {};
      keys.forEach((key, idx) => { options[key] = !!(mask & (1 << idx)); });
      out.push(serializePreprocessOptions(options));
    }
    return out;
  }

  function buildChunkBounds(text) {
    const source = String(text || '');
    const bounds = [];
    let pos = 0;
    const length = source.length;
    const lookahead = Math.max(CHUNK_SIZE, CHUNK_BOUNDARY_LOOKAHEAD);

    while (pos < length) {
      const target = Math.min(length, pos + CHUNK_SIZE);
      let end = target;
      if (target < length) {
        const maxBoundary = Math.min(length, target + lookahead);
        const nextNewline = source.indexOf('\n', target);
        if (nextNewline !== -1 && nextNewline + 1 <= maxBoundary) {
          end = nextNewline + 1;
        } else {
          const previousNewline = source.lastIndexOf('\n', maxBoundary);
          end = previousNewline >= target ? previousNewline + 1 : maxBoundary;
        }
      }
      if (end <= pos) end = Math.min(length, pos + Math.max(1, CHUNK_SIZE));
      bounds.push([pos, end]);
      pos = end;
    }

    if (!bounds.length) bounds.push([0, 0]);
    return bounds;
  }

  function loadChunkBoundsFromDisk(filePath, sig, optionKey = '') {
    try {
      const cachePath = getChunkIndexCachePath(filePath, optionKey);
      if (!fs.existsSync(cachePath)) {
        metrics.chunkIndexDiskMisses += 1;
        return null;
      }

      const raw = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      if (!raw || raw.sig !== sig || !Array.isArray(raw.chunkBounds)) {
        metrics.chunkIndexDiskMisses += 1;
        return null;
      }

      metrics.chunkIndexDiskHits += 1;
      return raw.chunkBounds;
    } catch (e) {
      metrics.chunkIndexDiskMisses += 1;
      return null;
    }
  }

  function scheduleChunkIndexWrite(filePath, sig, chunkBounds, optionKey = '') {
    const cacheKey = getChunkIndexCacheKey(filePath, optionKey);
    dirtyChunkIndexes.set(cacheKey, { filePath, optionKey, sig, chunkBounds });
    metrics.chunkIndexWriteQueued += 1;

    if (chunkIndexWriteTimer) return;

    chunkIndexWriteTimer = setTimeout(() => {
      const items = Array.from(dirtyChunkIndexes.entries());
      dirtyChunkIndexes.clear();
      chunkIndexWriteTimer = null;

      items.forEach(([, payload]) => {
        try {
          fs.writeFile(
            getChunkIndexCachePath(payload.filePath, payload.optionKey),
            JSON.stringify({ filePath: payload.filePath, optionKey: payload.optionKey, sig: payload.sig, chunkBounds: payload.chunkBounds }),
            'utf-8',
            (error) => { if (!error) metrics.chunkIndexWriteFlushed += 1; }
          );
        } catch (e) {}
      });
    }, 150);
    if (typeof chunkIndexWriteTimer.unref === 'function') chunkIndexWriteTimer.unref();
  }

  function buildCachedFileEntryFromSignatureLocal(filePath, options, optionKey, sig, now, countKnownLoad = true) {
    if (countKnownLoad) metrics.fileCacheKnownSignatureLoads += 1;
    const formatted = formatNovelText(readFileAutoEncoding(filePath), options);
    const text = formatted.text;
    const textHash = sha1(text);
    let chunkBounds = loadChunkBoundsFromDisk(filePath, sig + ':' + optionKey, optionKey);

    if (!chunkBounds) {
      chunkBounds = buildChunkBounds(text);
      scheduleChunkIndexWrite(filePath, sig + ':' + optionKey, chunkBounds, optionKey);
    }

    const hit = { text, textHash, time: now, chunkBounds, statSig: sig, formatStats: formatted.stats };
    hit.bytes = estimateFileCacheEntryBytes(hit);
    return hit;
  }

  function buildCachedFileEntryFromSignature(filePath, options, optionKey, sig, now) {
    return buildCachedFileEntryFromSignatureLocal(filePath, options, optionKey, sig, now, true);
  }

  async function buildCachedFileEntryFromSignatureAsync(filePath, options, optionKey, sig, now, signal = null) {
    assertNotAborted(signal);
    metrics.fileCacheKnownSignatureLoads += 1;
    if (!contentWorkerPool) {
      metrics.contentWorkerTaskFallbacks += 1;
      return buildCachedFileEntryFromSignatureLocal(filePath, options, optionKey, sig, now, false);
    }

    const existingChunkBounds = loadChunkBoundsFromDisk(filePath, sig + ':' + optionKey, optionKey);
    try {
      metrics.contentWorkerTasksStarted += 1;
      const result = await contentWorkerPool.runTask({
        filePath,
        preprocessOptions: options,
        optionKey,
        statSig: sig,
        chunkSize: CHUNK_SIZE,
        chunkBoundaryLookahead: CHUNK_BOUNDARY_LOOKAHEAD,
        maxTextFileBytes: MAX_TEXT_FILE_BYTES,
        chunkBounds: existingChunkBounds || null
      }, { signal });
      assertNotAborted(signal);
      metrics.contentWorkerTasksCompleted += 1;
      metrics.fileReadCalls += Math.max(1, Number(result.fileReadCalls) || 1);
      metrics.lastFileReadMs = Math.max(0, Number(result.fileReadMs) || 0);
      const text = String(result.text || '');
      const chunkBounds = Array.isArray(result.chunkBounds) && result.chunkBounds.length ? result.chunkBounds : buildChunkBounds(text);
      if (!existingChunkBounds) scheduleChunkIndexWrite(filePath, sig + ':' + optionKey, chunkBounds, optionKey);
      const hit = {
        text,
        textHash: result.textHash || sha1(text),
        time: now,
        chunkBounds,
        statSig: sig,
        formatStats: result.formatStats && typeof result.formatStats === 'object' ? result.formatStats : {}
      };
      hit.bytes = Math.max(0, Number(result.bytes) || estimateFileCacheEntryBytes(hit));
      return hit;
    } catch (error) {
      if (isAbortError(error)) {
        metrics.contentWorkerTaskAborts += 1;
        throw error;
      }
      metrics.contentWorkerTaskFallbacks += 1;
      return buildCachedFileEntryFromSignatureLocal(filePath, options, optionKey, sig, now, false);
    }
  }

  function getCachedFileEntry(filePath, preprocessOptions) {
    const now = Date.now();
    const sig = statSignature(filePath);
    const options = normalizePreprocessOptions(preprocessOptions);
    const optionKey = serializePreprocessOptions(options);
    const cacheKey = filePath + '::' + optionKey;
    const hit = fileCache.get(cacheKey);

    if (hit && hit.statSig === sig && now - hit.time < FILE_CACHE_TTL) {
      metrics.fileCacheHits += 1;
      hit.time = now;
      touchFileCacheEntry(cacheKey, hit);
      return hit;
    }

    metrics.fileCacheMisses += 1;
    return storeFileCacheEntry(cacheKey, buildCachedFileEntryFromSignature(filePath, options, optionKey, sig, now));
  }

  function getCachedFileEntryAsync(filePath, preprocessOptions, requestOptions = {}) {
    const requestFlags = requestOptions && typeof requestOptions === 'object' ? requestOptions : {};
    const signal = requestFlags.signal || null;
    assertNotAborted(signal);
    const options = normalizePreprocessOptions(preprocessOptions);
    const optionKey = serializePreprocessOptions(options);
    const cacheKey = filePath + '::' + optionKey;
    const now = Date.now();
    const sig = statSignature(filePath);
    const hit = fileCache.get(cacheKey);

    if (hit && hit.statSig === sig && now - hit.time < FILE_CACHE_TTL) {
      metrics.fileCacheHits += 1;
      hit.time = now;
      touchFileCacheEntry(cacheKey, hit);
      return Promise.resolve(hit);
    }

    metrics.fileCacheMisses += 1;
    if (fileCacheInflight.has(cacheKey)) {
      metrics.fileCacheInflightJoins += 1;
      return waitForInflightRecord(fileCacheInflight.get(cacheKey), signal);
    }
    metrics.fileCacheInflightLoads += 1;

    const abortController = new AbortController();
    const record = { waiters: 0, settled: false, abortController, promise: null };
    const task = Promise.resolve().then(async () => {
      const freshNow = Date.now();
      const freshHit = fileCache.get(cacheKey);
      if (freshHit && freshHit.statSig === sig && freshNow - freshHit.time < FILE_CACHE_TTL) {
        metrics.fileCacheHits += 1;
        freshHit.time = freshNow;
        touchFileCacheEntry(cacheKey, freshHit);
        return freshHit;
      }
      const entry = await buildCachedFileEntryFromSignatureAsync(filePath, options, optionKey, sig, freshNow, abortController.signal);
      return storeFileCacheEntry(cacheKey, entry);
    }).finally(() => {
      record.settled = true;
      if (fileCacheInflight.get(cacheKey) === record) {
        fileCacheInflight.delete(cacheKey);
      }
    });

    record.promise = task;
    fileCacheInflight.set(cacheKey, record);
    return waitForInflightRecord(record, signal);
  }

  function getCachedFileContent(filePath, preprocessOptions) {
    return getCachedFileEntry(filePath, preprocessOptions).text;
  }


  async function getContentChunkAsync(filePath, preprocessOptions, chunkIdx, requestOptions = {}) {
    const requestFlags = requestOptions && typeof requestOptions === 'object' ? requestOptions : {};
    const signal = requestFlags.signal || null;
    assertNotAborted(signal);
    const searchScan = requestFlags.searchScan === true;
    if (searchScan) {
      metrics.searchScanRequests += 1;
      metrics.lastSearchScanAt = Date.now();
    }
    const options = normalizePreprocessOptions(preprocessOptions);
    const optionKey = serializePreprocessOptions(options);
    const sig = statSignature(filePath);
    const requestedChunk = parseInt(chunkIdx, 10) || 1;
    if (requestedChunk >= 1) {
      const diskPayload = readChunkPayloadFromDisk(filePath, sig, optionKey, requestedChunk);
      if (diskPayload) return diskPayload;
    } else {
      metrics.chunkPayloadCacheBypasses += 1;
      metrics.lastChunkPayloadCacheBypassReason = 'non-positive or last chunk request requires totalChunks';
    }

    const entry = await getCachedFileEntryAsync(filePath, options, { signal });
    assertNotAborted(signal);
    const totalChunks = getTotalChunks(entry);
    const index = requestedChunk === -1 ? totalChunks : Math.max(1, Math.min(totalChunks, requestedChunk));
    const range = getChunkByLine(entry, index);
    const payload = {
      content: range.content,
      start: range.start,
      end: range.end,
      currentChunk: index,
      totalChunks,
      textHash: entry.textHash || '',
      statSig: entry.statSig || sig,
      formatStats: entry.formatStats || {},
      chunkPayloadCacheHit: false,
      chunkPayloadCachePass: CONTENT_LARGE_FILE_CHUNK_CACHE_PASS,
      chunkPayloadCacheHardeningPass: CONTENT_LARGE_FILE_CHUNK_CACHE_HARDENING_PASS
    };
    assertNotAborted(signal);
    if (searchScan) {
      metrics.searchScanPayloadWriteSkipped += 1;
      metrics.lastChunkPayloadCacheBypassReason = 'search scan request skipped sync chunk payload disk write';
      payload.searchScanLoadMitigationPass = CONTENT_SEARCH_SCAN_LOAD_MITIGATION_PASS;
    } else {
      writeChunkPayloadToDisk(filePath, entry.statSig || sig, optionKey, index, payload);
    }
    return payload;
  }

  function clearChunkIndexCachePath(filePath) {
    try {
      const candidates = new Set([getChunkIndexCachePath(filePath)]);
      listPreprocessSignatures().forEach((signature) => candidates.add(getChunkIndexCachePath(filePath, signature)));
      candidates.forEach((cachePath) => {
        try { if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath); } catch (e) {}
      });
      Array.from(dirtyChunkIndexes.entries()).forEach(([key, payload]) => {
        if (payload && payload.filePath === filePath) dirtyChunkIndexes.delete(key);
      });
    } catch (e) {}
  }

  function clearFileCachePath(filePath) {
    Array.from(fileCache.keys()).forEach((key) => { if (key === filePath || key.startsWith(filePath + '::')) removeFileCacheEntry(key); });
    Array.from(fileCacheInflight.keys()).forEach((key) => { if (key === filePath || key.startsWith(filePath + '::')) fileCacheInflight.delete(key); });
    clearChunkIndexCachePath(filePath);
  }

  function clearAllFileCache() {
    fileCache.clear();
    fileCacheState.totalBytes = 0;
    fileCacheInflight.clear();
    dirtyChunkIndexes.clear();
  }

  function getChunkByLine(textOrEntry, chunkIdx) {
    const entry = typeof textOrEntry === 'string'
      ? { text: textOrEntry, chunkBounds: buildChunkBounds(textOrEntry) }
      : textOrEntry;

    const bounds = entry && Array.isArray(entry.chunkBounds) ? entry.chunkBounds : [[0, 0]];
    const idx = Math.max(0, Math.min(bounds.length - 1, (parseInt(chunkIdx, 10) || 1) - 1));
    const range = bounds[idx] || [0, 0];
    const start = range[0] || 0;
    const end = range[1] || 0;
    const content = entry.text.slice(start, end);

    return { content, start, end };
  }

  function getTotalChunks(textOrEntry) {
    if (textOrEntry && Array.isArray(textOrEntry.chunkBounds)) {
      return Math.max(1, textOrEntry.chunkBounds.length);
    }
    return Math.max(1, buildChunkBounds(String(textOrEntry || '')).length);
  }

  function getCacheStatus() {
    return {
      marker: CONTENT_CACHE_IO_DIAGNOSTICS_PASS,
      strategyMarker: CONTENT_CACHE_STRATEGY_ADJUSTMENT_PASS,
      fileCacheEntries: fileCache.size || 0,
      fileCacheInflightEntries: fileCacheInflight.size || 0,
      fileCacheBytes: fileCacheState.totalBytes || 0,
      fileCacheLimits: {
        maxEntries: FILE_CACHE_MAX,
        maxBytes: FILE_CACHE_MAX_BYTES,
        ttlMs: FILE_CACHE_TTL,
        staleMs: FILE_CACHE_STALE_MS,
        chunkBoundaryLookahead: CHUNK_BOUNDARY_LOOKAHEAD,
        maxTextFileBytes: MAX_TEXT_FILE_BYTES,
        maxTextFileBytesPass: MAX_TEXT_FILE_BYTES_PASS
      },
      largeTextChunkBoundaryPass: CONTENT_LARGE_TEXT_CHUNK_BOUNDARY_PASS,
      largeFileChunkCachePass: CONTENT_LARGE_FILE_CHUNK_CACHE_PASS,
      searchScanLoadMitigationPass: CONTENT_SEARCH_SCAN_LOAD_MITIGATION_PASS,
      searchScanLastMarker: metrics.searchScanRequests ? CONTENT_SEARCH_SCAN_LOAD_MITIGATION_PASS : '',
      contentServerWorkerPoolPass: CONTENT_SERVER_WORKER_POOL_PASS,
      contentRequestAbortPass: CONTENT_REQUEST_ABORT_PASS,
      contentWorkerPoolPass: CONTENT_ENTRY_WORKER_POOL_PASS,
      contentWorkerPool: contentWorkerPool && typeof contentWorkerPool.getStatus === 'function' ? contentWorkerPool.getStatus() : { enabled: false, pass: CONTENT_ENTRY_WORKER_POOL_PASS },
      chunkPayloadCacheHardeningPass: CONTENT_LARGE_FILE_CHUNK_CACHE_HARDENING_PASS,
      chunkPayloadCacheDir: CHUNK_PAYLOAD_DIR,
      chunkPayloadCacheSchema: CHUNK_PAYLOAD_CACHE_SCHEMA,
      chunkIndexPending: dirtyChunkIndexes.size || 0,
      metrics: Object.assign({}, metrics)
    };
  }

  function invalidatePathCaches(filePath) {
    try { clearFileCachePath(filePath); } catch (e) {}
    try { clearChunkIndexCachePath(filePath); } catch (e) {}
  }

  function closeWorkerPool() {
    if (contentWorkerPool && typeof contentWorkerPool.close === 'function') contentWorkerPool.close();
  }

  return {
    readFileAutoEncoding,
    assertTextFileSizeAllowed,
    maxTextFileBytes: MAX_TEXT_FILE_BYTES,
    normalizePreprocessOptions,
    parsePreprocessOptionsFromQuery,
    serializePreprocessOptions,
    formatNovelText,
    buildChunkBounds,
    getCachedFileEntry,
    getCachedFileEntryAsync,
    getCachedFileContent,
    getContentChunkAsync,
    getChunkByLine,
    getTotalChunks,
    clearChunkIndexCachePath,
    clearFileCachePath,
    clearAllFileCache,
    pruneFileCache,
    invalidatePathCaches,
    closeWorkerPool,
    getCacheStatus
  };
}

module.exports = { createContentService, CONTENT_CACHE_IO_DIAGNOSTICS_PASS, CONTENT_CACHE_STRATEGY_ADJUSTMENT_PASS, CONTENT_LARGE_TEXT_CHUNK_BOUNDARY_PASS, CONTENT_LARGE_FILE_CHUNK_CACHE_PASS, CONTENT_SEARCH_SCAN_LOAD_MITIGATION_PASS, CONTENT_SERVER_WORKER_POOL_PASS, CONTENT_REQUEST_ABORT_PASS, MAX_TEXT_FILE_BYTES_PASS };
