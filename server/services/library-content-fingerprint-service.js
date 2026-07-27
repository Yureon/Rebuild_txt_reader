'use strict';

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { decodeTextBuffer } = require('./text-decoder-service');
const { loadJsonWithBackup, durableRemoveAsync } = require('../repositories/json-file-store');
const { loadCompressedJsonWithBackup, atomicWriteCompressedJsonAsync } = require('../repositories/compressed-json-file-store');
const { buildSketch, sketchSimilarity } = require('./library-fingerprint-sketch');

const LIBRARY_CONTENT_FINGERPRINT_PASS = 'v642-library-content-fingerprint-pass';
const LIBRARY_CONTENT_FINGERPRINT_CACHE_PASS = 'v642-library-content-fingerprint-cache-pass';
const LIBRARY_CONTENT_FINGERPRINT_COMPRESSED_CACHE_PASS = 'v642-library-content-fingerprint-compressed-cache-pass';
const LIBRARY_FINGERPRINT_SEMANTIC_REVISION_PASS = 'v646-library-fingerprint-semantic-revision-pass';
const SCHEMA_VERSION = 1;
const NORMALIZATION_VERSION = 1;
const DEFAULT_SAMPLE_BYTES = 128 * 1024;
const DEFAULT_SAMPLE_CHARS = 16000;
const DEFAULT_SKETCH_SIZE = 48;

function bounded(value, fallback, min, max) {
  const parsed = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(parsed) ? Math.floor(parsed) : fallback));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeRelativePath(value) {
  return String(value || '').replaceAll('\\', '/').normalize('NFKC').trim();
}

function normalizeSampleText(value, maxChars = DEFAULT_SAMPLE_CHARS) {
  let text = String(value || '').replace(/^\uFEFF/u, '').normalize('NFKC').replace(/\r\n?/gu, '\n');
  text = text
    .replace(/https?:\/\/\S+/giu, ' ')
    .replace(/^\s*(?:텍본|텍스트본|공유|배포|업로더|다운로드|출처|원본|목차|차례)\s*[:：].*$/gimu, ' ')
    .replace(/^\s*(?:본\s*파일은|무단\s*배포|재배포\s*금지|개인\s*소장).*$/gimu, ' ')
    .replace(/[\t\u00a0\u2000-\u200b\u202f\u205f\u3000]+/gu, ' ')
    .replace(/\n{3,}/gu, '\n\n')
    .replace(/ {2,}/gu, ' ')
    .trim();
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  let start = 0;
  for (let index = 0; index < Math.min(lines.length, 80); index += 1) {
    const line = lines[index];
    const prose = /[가-힣ぁ-んァ-ヶ一-龠A-Za-z]{8,}/u.test(line) && line.length >= 24;
    const heading = /^(?:제?\s*\d{1,7}\s*(?:화|회|편|장)|chapter\s*\d+|prologue|프롤로그)/iu.test(line);
    if (prose || heading) { start = index; break; }
  }
  return lines.slice(start).join('\n').slice(0, Math.max(1024, maxChars));
}

function replacementRatio(text) {
  const value = String(text || '');
  return (value.match(/\uFFFD/gu) || []).length / Math.max(1, value.length);
}

function normalizeState(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const entries = {};
  for (const [key, raw] of Object.entries(input.entries || {})) {
    const relativePath = normalizeRelativePath(key || raw && raw.relativePath);
    if (!relativePath || !raw || typeof raw !== 'object') continue;
    entries[relativePath] = {
      relativePath,
      bytes:Math.max(0, Number(raw.bytes) || 0),
      mtimeMs:Math.max(0, Math.trunc(Number(raw.mtimeMs) || 0)),
      encoding:String(raw.encoding || ''),
      prefixHash:String(raw.prefixHash || ''),
      prefixSketch:String(raw.prefixSketch || ''),
      middleHash:String(raw.middleHash || ''),
      middleSketch:String(raw.middleSketch || ''),
      prefixChars:Math.max(0, Number(raw.prefixChars) || 0),
      middleChars:Math.max(0, Number(raw.middleChars) || 0),
      replacementRatio:Math.max(0, Number(raw.replacementRatio) || 0),
      computedAt:Math.max(0, Number(raw.computedAt) || 0),
      verifiedAt:Math.max(0, Number(raw.verifiedAt) || 0),
      normalizationVersion:NORMALIZATION_VERSION,
      schemaVersion:SCHEMA_VERSION
    };
  }
  return { schemaVersion:SCHEMA_VERSION, normalizationVersion:NORMALIZATION_VERSION, updatedAt:Math.max(0, Number(input.updatedAt) || 0), entries };
}

function createLibraryContentFingerprintService(options = {}) {
  const cachePath = String(options.cachePath || '').trim();
  const compressedCachePath = String(options.compressedCachePath || `${cachePath}.gz`);
  const libraryService = options.libraryService;
  const logger = options.logger || console;
  if (!cachePath || !libraryService) throw new Error('fingerprint cachePath and libraryService are required');
  const sampleBytes = bounded(options.sampleBytes, DEFAULT_SAMPLE_BYTES, 16 * 1024, 512 * 1024);
  const sampleChars = bounded(options.sampleChars, DEFAULT_SAMPLE_CHARS, 4000, 64000);
  const concurrency = bounded(options.concurrency, 1, 1, 4);
  const queueMax = bounded(options.queueMax, 512, 32, 4096);
  const maxEntries = bounded(options.maxEntries, 100000, 1000, 250000);
  const freshnessMs = bounded(options.freshnessMs, 10 * 60 * 1000, 30000, 24 * 60 * 60 * 1000);
  const backgroundBatch = bounded(options.backgroundBatch, 64, 1, 512);
  const compressionLevel = bounded(options.compressionLevel, 6, 1, 9);
  const compressedLoaded = loadCompressedJsonWithBackup(compressedCachePath, null);
  const legacyLoaded = compressedLoaded.ok ? null : loadJsonWithBackup(cachePath, null);
  const loaded = compressedLoaded.ok ? compressedLoaded : legacyLoaded;
  let state = normalizeState(loaded.data);
  let revision = 1;
  let entryCount = Object.keys(state.entries).length;
  let dirty = !!(legacyLoaded && legacyLoaded.ok) || !!(compressedLoaded.ok && compressedLoaded.source === 'backup');
  let loadedFromLegacy = !!(legacyLoaded && legacyLoaded.ok);
  let storageBytes = { logical:Math.max(0, Number(compressedLoaded.jsonBytes) || (legacyLoaded && legacyLoaded.path ? (()=>{ try{return fs.lstatSync(legacyLoaded.path).size;}catch{return 0;} })() : 0)), compressed:Math.max(0, Number(compressedLoaded.compressedBytes) || 0) };
  let trustedPrimarySha256 = compressedLoaded.ok && compressedLoaded.source === 'primary' ? String(compressedLoaded.compressedSha256 || '') : '';
  let stopped = false;
  let libraryCursor = 0;
  let active = 0;
  let flushTimer = null;
  let flushPromise = Promise.resolve();
  const queue = [];
  const queued = new Set();
  const inflight = new Map();
  const metrics = { queued:0, completed:0, failed:0, cacheHits:0, cacheMisses:0, queueDrops:0, bytesRead:0, verificationUpdates:0, semanticUpdates:0 };

  function entryForNovel(novel, options = {}) {
    const relativePath = normalizeRelativePath(novel && novel.singlePath);
    if (!relativePath) return null;
    const entry = state.entries[relativePath] || null;
    if (!entry || entry.normalizationVersion !== NORMALIZATION_VERSION) {
      metrics.cacheMisses += 1;
      return null;
    }
    if (Date.now() - (entry.verifiedAt || entry.computedAt || 0) > freshnessMs) {
      if (options.queueRefresh !== false) request(novel, { priority:'low' });
      metrics.cacheMisses += 1;
      return null;
    }
    metrics.cacheHits += 1;
    return entry;
  }

  function getRevision() { return revision; }
  function getCached(novel, options = {}) { return entryForNovel(novel, options); }

  function scheduleFlush() {
    if (flushTimer || stopped) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flush().catch(() => {});
    }, 1000);
    flushTimer.unref?.();
  }

  async function readRange(handle, start, length) {
    const buffer = Buffer.allocUnsafe(length);
    const result = await handle.read(buffer, 0, length, Math.max(0, start));
    metrics.bytesRead += result.bytesRead;
    return buffer.subarray(0, result.bytesRead);
  }

  async function compute(novel) {
    const relativePath = normalizeRelativePath(novel && novel.singlePath);
    if (!relativePath) throw Object.assign(new Error('singlePath required'), { code:'LIBRARY_FINGERPRINT_PATH_REQUIRED' });
    const absolutePath = libraryService.safeJoinUnderLibrary(relativePath);
    const stat = await fs.promises.lstat(absolutePath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw Object.assign(new Error('fingerprint target is not a regular file'), { code:'LIBRARY_FINGERPRINT_NOT_REGULAR' });
    const bytes = Math.max(0, Number(stat.size) || 0);
    const mtimeMs = Math.max(0, Math.trunc(Number(stat.mtimeMs) || 0));
    const existing = state.entries[relativePath];
    if (existing && existing.bytes === bytes && existing.mtimeMs === mtimeMs && existing.normalizationVersion === NORMALIZATION_VERSION) {
      existing.verifiedAt = Date.now();
      metrics.verificationUpdates += 1;
      dirty = true;
      scheduleFlush();
      return existing;
    }
    const handle = await fs.promises.open(absolutePath, 'r');
    try {
      const prefixBuffer = await readRange(handle, 0, Math.min(sampleBytes, bytes));
      const middleStart = bytes > sampleBytes * 2 ? Math.max(0, Math.floor(bytes * 0.25) - 4) : 0;
      const middleBuffer = middleStart > 0 ? await readRange(handle, middleStart, Math.min(sampleBytes, Math.max(0, bytes - middleStart))) : Buffer.alloc(0);
      const prefixDecoded = decodeTextBuffer(prefixBuffer, { sampleSize:Math.min(prefixBuffer.length, 65536) });
      const middleDecoded = middleBuffer.length ? decodeTextBuffer(middleBuffer, { sampleSize:Math.min(middleBuffer.length, 65536), forceEncoding:prefixDecoded.encoding }) : { text:'', encoding:prefixDecoded.encoding };
      const prefixText = normalizeSampleText(prefixDecoded.text, sampleChars);
      const middleDecodedText = middleStart > 0 ? String(middleDecoded.text || '').slice(8) : String(middleDecoded.text || '');
      const middleText = normalizeSampleText(middleDecodedText, Math.max(4000, Math.floor(sampleChars / 2)));
      const record = {
        schemaVersion:SCHEMA_VERSION,
        normalizationVersion:NORMALIZATION_VERSION,
        relativePath,
        bytes,
        mtimeMs,
        encoding:String(prefixDecoded.encoding || ''),
        prefixHash:sha256(prefixText),
        prefixSketch:buildSketch(prefixText),
        middleHash:middleText ? sha256(middleText) : '',
        middleSketch:middleText ? buildSketch(middleText) : '',
        prefixChars:prefixText.length,
        middleChars:middleText.length,
        replacementRatio:Math.max(replacementRatio(prefixDecoded.text), replacementRatio(middleDecodedText)),
        computedAt:Date.now(),
        verifiedAt:Date.now()
      };
      if (!state.entries[relativePath]) entryCount += 1;
      state.entries[relativePath] = record;
      if (entryCount > maxEntries) {
        const orderedEntries = Object.values(state.entries).sort((a, b) => (a.computedAt || 0) - (b.computedAt || 0));
        const removeCount = Math.min(entryCount - maxEntries, orderedEntries.length);
        for (let index = 0; index < removeCount; index += 1) {
          const oldest = orderedEntries[index];
          if (oldest && state.entries[oldest.relativePath]) {
            delete state.entries[oldest.relativePath];
            entryCount -= 1;
          }
        }
      }
      state.updatedAt = Date.now();
      revision += 1;
      metrics.semanticUpdates += 1;
      dirty = true;
      scheduleFlush();
      return record;
    } finally {
      await handle.close();
    }
  }

  function pump() {
    if (stopped) return;
    while (active < concurrency && queue.length) {
      const item = queue.shift();
      if (!item) break;
      queued.delete(item.key);
      active += 1;
      const task = compute(item.novel)
        .then(value => { metrics.completed += 1; return value; })
        .catch(error => { metrics.failed += 1; logger.warn?.('library fingerprint failed:', item.key, error && error.message || error); return null; })
        .finally(() => { active -= 1; inflight.delete(item.key); setImmediate(pump).unref?.(); });
      inflight.set(item.key, task);
    }
  }

  function request(novel, options = {}) {
    if (stopped || !novel || novel.isMultiFile || !novel.singlePath) return false;
    const key = normalizeRelativePath(novel.singlePath);
    if (!key || queued.has(key) || inflight.has(key)) return false;
    if (queue.length >= queueMax) {
      metrics.queueDrops += 1;
      return false;
    }
    const item = { key, novel:{ id:String(novel.id || ''), singlePath:key }, priority:String(options.priority || 'normal') };
    if (item.priority === 'high') queue.unshift(item); else queue.push(item);
    queued.add(key);
    metrics.queued += 1;
    setImmediate(pump).unref?.();
    return true;
  }

  function requestCandidates(novels) {
    for (const novel of Array.isArray(novels) ? novels : []) request(novel, { priority:'normal' });
  }

  function requestLibrary(novels, options = {}) {
    const source = (Array.isArray(novels) ? novels : []).filter(novel => novel && !novel.isMultiFile && novel.singlePath);
    if (!source.length || stopped) return { considered:0, queued:0, cursor:libraryCursor };
    const limit = bounded(options.limit, backgroundBatch, 1, 512);
    const now = Date.now();
    let considered = 0;
    let accepted = 0;
    for (let offset = 0; offset < source.length && considered < limit; offset += 1) {
      const index = (libraryCursor + offset) % source.length;
      const novel = source[index];
      const key = normalizeRelativePath(novel.singlePath);
      if (!key) continue;
      considered += 1;
      const cached = state.entries[key];
      const current = cached
        && cached.normalizationVersion === NORMALIZATION_VERSION
        && now - (cached.verifiedAt || cached.computedAt || 0) <= freshnessMs;
      if (!current && request(novel, { priority:'low' })) accepted += 1;
    }
    libraryCursor = (libraryCursor + Math.max(1, considered)) % source.length;
    return { considered, queued:accepted, cursor:libraryCursor };
  }

  async function flush() {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    if (!dirty) return true;
    const serializedJson = Buffer.from(JSON.stringify(state), 'utf8');
    dirty = false;
    flushPromise = flushPromise.then(async () => {
      const result = await atomicWriteCompressedJsonAsync(compressedCachePath, state, { level:compressionLevel, serializedJson, trustedPrimarySha256 });
      storageBytes = { logical:Number(result.jsonBytes) || 0, compressed:Number(result.compressedBytes) || 0 };
      trustedPrimarySha256 = String(result.primarySha256 || '');
      if (loadedFromLegacy) {
        for (const legacyPath of [cachePath, `${cachePath}.bak`]) {
          try { await durableRemoveAsync(legacyPath, { force:true }); }
          catch (error) { logger.warn?.('legacy fingerprint cache cleanup failed:', legacyPath, error && error.message || error); }
        }
        loadedFromLegacy = false;
      }
    }).catch(error => {
      dirty = true;
      throw error;
    });
    await flushPromise;
    return true;
  }

  async function stop() {
    stopped = true;
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    await Promise.allSettled([...inflight.values()]);
    try { await flush(); return { ok:true, pass:LIBRARY_CONTENT_FINGERPRINT_PASS }; }
    catch (error) { return { ok:false, pass:LIBRARY_CONTENT_FINGERPRINT_PASS, error:String(error && error.message || error) }; }
  }

  function getStatus() {
    return {
      pass:LIBRARY_CONTENT_FINGERPRINT_PASS,
      cachePass:LIBRARY_CONTENT_FINGERPRINT_CACHE_PASS,
      compressedCachePass:LIBRARY_CONTENT_FINGERPRINT_COMPRESSED_CACHE_PASS,
      semanticRevisionPass:LIBRARY_FINGERPRINT_SEMANTIC_REVISION_PASS,
      revision,
      entryCount,
      queueLength:queue.length,
      active,
      concurrency,
      sampleBytes,
      sampleChars,
      backgroundBatch,
      storage:{ logicalBytes:storageBytes.logical, compressedBytes:storageBytes.compressed, compressionRatio:storageBytes.logical ? Number((storageBytes.compressed / storageBytes.logical).toFixed(4)) : 0, level:compressionLevel },
      backgroundCursor:libraryCursor,
      metrics:{ ...metrics }
    };
  }

  if (dirty) { const migration = setImmediate(() => { void flush().catch(error => logger.warn?.('fingerprint compressed cache migration failed:', error && error.message || error)); }); migration.unref?.(); }

  return {
    pass:LIBRARY_CONTENT_FINGERPRINT_PASS,
    cachePass:LIBRARY_CONTENT_FINGERPRINT_CACHE_PASS,
    compressedCachePass:LIBRARY_CONTENT_FINGERPRINT_COMPRESSED_CACHE_PASS,
    semanticRevisionPass:LIBRARY_FINGERPRINT_SEMANTIC_REVISION_PASS,
    getRevision,
    getCached,
    request,
    requestCandidates,
    requestLibrary,
    flush,
    stop,
    getStatus,
    sketchSimilarity,
    normalizeSampleText,
    buildSketch
  };
}

module.exports = {
  LIBRARY_CONTENT_FINGERPRINT_PASS,
  LIBRARY_CONTENT_FINGERPRINT_CACHE_PASS,
  LIBRARY_CONTENT_FINGERPRINT_COMPRESSED_CACHE_PASS,
  LIBRARY_FINGERPRINT_SEMANTIC_REVISION_PASS,
  createLibraryContentFingerprintService,
  normalizeSampleText,
  buildSketch,
  sketchSimilarity
};
