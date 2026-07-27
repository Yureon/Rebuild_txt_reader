const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { StringDecoder } = require('string_decoder');

const NORMALIZED_CONTENT_CACHE_SCHEMA = 2;
const NORMALIZED_CONTENT_CACHE_PASS = 'v570-normalized-content-range-cache-pass';
const NORMALIZED_CONTENT_ENCODING = 'utf16le';
const NORMALIZATION_ALGORITHM_VERSION = 'v572-normalization-contract-2';
const CHUNK_INDEX_ALGORITHM_VERSION = 'v573-filechar-chunk-index-2';
const DEFAULT_MAX_INDEX_BYTES = 16 * 1024 * 1024;
const DEFAULT_MAX_CHUNK_BOUNDS = 1_000_000;
const NORMALIZED_CHUNK_HASH_ALGORITHM = 'sha256-utf16le-v1';

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function canonicalFilePath(filePath) {
  // Source authorization is enforced before cache access. Cache identity must
  // not trigger a synchronous realpath call on every cold chunk request.
  return path.resolve(String(filePath || ''));
}

function isInside(root, candidate) {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  return resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(resolvedRoot + path.sep);
}

function buildNormalizedCacheDescriptor(options = {}) {
  const rootDir = path.resolve(String(options.rootDir || ''));
  if (!rootDir) throw new Error('normalized content cache rootDir is required');
  const canonicalPath = canonicalFilePath(options.filePath);
  const identity = {
    schema: NORMALIZED_CONTENT_CACHE_SCHEMA,
    pass: NORMALIZED_CONTENT_CACHE_PASS,
    sourcePathHash: sha256(canonicalPath),
    statSig: String(options.statSig || ''),
    preprocessSignature: String(options.preprocessSignature || ''),
    chunkSize: Math.max(1, Number(options.chunkSize) || 50000),
    chunkBoundaryLookahead: Math.max(1, Number(options.chunkBoundaryLookahead) || 250000),
    normalizationVersion: String(options.normalizationVersion || NORMALIZATION_ALGORITHM_VERSION),
    chunkIndexVersion: String(options.chunkIndexVersion || CHUNK_INDEX_ALGORITHM_VERSION),
    encoding: NORMALIZED_CONTENT_ENCODING
  };
  const cacheKey = sha256(JSON.stringify(identity));
  const dir = path.join(rootDir, cacheKey.slice(0, 2));
  const base = path.join(dir, cacheKey);
  const descriptor = {
    rootDir,
    dir,
    cacheKey,
    textPath: base + '.text',
    indexPath: base + '.index.json',
    metaPath: base + '.meta.json',
    identity
  };
  for (const candidate of [descriptor.dir, descriptor.textPath, descriptor.indexPath, descriptor.metaPath]) {
    if (!isInside(rootDir, candidate)) throw new Error('normalized cache path escaped cache root');
  }
  return descriptor;
}

function safeReadJson(filePath, maxBytes = DEFAULT_MAX_INDEX_BYTES) {
  const lstat = fs.lstatSync(filePath);
  if (!lstat.isFile() || lstat.isSymbolicLink()) throw new Error('cache metadata is not a regular file');
  if (lstat.size < 2 || lstat.size > maxBytes) throw new Error('cache metadata size is invalid');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function safeReadJsonAsync(filePath, maxBytes = DEFAULT_MAX_INDEX_BYTES) {
  const lstat = await fs.promises.lstat(filePath);
  if (!lstat.isFile() || lstat.isSymbolicLink()) throw new Error('cache metadata is not a regular file');
  if (lstat.size < 2 || lstat.size > maxBytes) throw new Error('cache metadata size is invalid');
  return JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
}

function validateChunkBounds(bounds, totalChars, maxChunkBounds = DEFAULT_MAX_CHUNK_BOUNDS) {
  if (!Array.isArray(bounds) || !bounds.length || bounds.length > maxChunkBounds) return false;
  let previousEnd = 0;
  for (let i = 0; i < bounds.length; i += 1) {
    const pair = bounds[i];
    if (!Array.isArray(pair) || pair.length !== 2) return false;
    const start = Number(pair[0]);
    const end = Number(pair[1]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return false;
    if (start !== previousEnd || start < 0 || end < start || end > totalChars) return false;
    previousEnd = end;
  }
  return previousEnd === totalChars || (totalChars === 0 && bounds.length === 1 && bounds[0][0] === 0 && bounds[0][1] === 0);
}


function hashNormalizedTextFile(filePath) {
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size % 2 !== 0) {
    throw new Error('normalized cache text has an invalid byte length');
  }
  const hash = crypto.createHash('sha1');
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(256 * 1024);
  const decoder = new StringDecoder(NORMALIZED_CONTENT_ENCODING);
  try {
    let position = 0;
    while (position < stat.size) {
      const bytesRead = fs.readSync(fd, buffer, 0, Math.min(buffer.length, stat.size - position), position);
      if (!bytesRead) throw new Error('normalized cache text ended unexpectedly');
      hash.update(decoder.write(buffer.subarray(0, bytesRead)), 'utf8');
      position += bytesRead;
    }
    const tail = decoder.end();
    if (tail) hash.update(tail, 'utf8');
    return hash.digest('hex');
  } finally {
    fs.closeSync(fd);
  }
}

async function hashNormalizedTextFileAsync(filePath) {
  const stat = await fs.promises.lstat(filePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size % 2 !== 0) {
    throw new Error('normalized cache text has an invalid byte length');
  }
  const hash = crypto.createHash('sha1');
  const decoder = new StringDecoder(NORMALIZED_CONTENT_ENCODING);
  const stream = fs.createReadStream(filePath, { highWaterMark: 256 * 1024 });
  for await (const chunk of stream) hash.update(decoder.write(chunk), 'utf8');
  const tail = decoder.end();
  if (tail) hash.update(tail, 'utf8');
  return hash.digest('hex');
}

function hashNormalizedChunkBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length % 2 !== 0) {
    throw new Error('normalized cache chunk has an invalid byte length');
  }
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function validateChunkHashes(hashes, bounds) {
  if (!Array.isArray(hashes) || !Array.isArray(bounds) || hashes.length !== bounds.length) return false;
  return hashes.every(value => /^[a-f0-9]{64}$/i.test(String(value || '')));
}

function readValidatedNormalizedCache(descriptor, options = {}) {
  try {
    if (!descriptor || !descriptor.cacheKey) return null;
    const maxIndexBytes = Math.max(1024, Number(options.maxIndexBytes) || DEFAULT_MAX_INDEX_BYTES);
    const maxChunkBounds = Math.max(1, Number(options.maxChunkBounds) || DEFAULT_MAX_CHUNK_BOUNDS);
    const meta = safeReadJson(descriptor.metaPath, Math.min(maxIndexBytes, 1024 * 1024));
    const index = safeReadJson(descriptor.indexPath, maxIndexBytes);
    const textStat = fs.lstatSync(descriptor.textPath);
    if (!textStat.isFile() || textStat.isSymbolicLink()) return null;
    const expected = descriptor.identity || {};
    const sharedChecks = (value) => value
      && Number(value.schema) === NORMALIZED_CONTENT_CACHE_SCHEMA
      && value.pass === NORMALIZED_CONTENT_CACHE_PASS
      && value.cacheKey === descriptor.cacheKey
      && value.statSig === expected.statSig
      && value.preprocessSignature === expected.preprocessSignature
      && Number(value.chunkSize) === Number(expected.chunkSize)
      && Number(value.chunkBoundaryLookahead) === Number(expected.chunkBoundaryLookahead)
      && value.normalizationVersion === expected.normalizationVersion
      && value.chunkIndexVersion === expected.chunkIndexVersion
      && value.encoding === NORMALIZED_CONTENT_ENCODING;
    if (!sharedChecks(meta) || !sharedChecks(index)) return null;
    const totalChars = Number(index.totalChars);
    if (!Number.isSafeInteger(totalChars) || totalChars < 0) return null;
    if (Number(meta.totalChars) !== totalChars || Number(meta.totalChunks) !== index.chunkBounds.length) return null;
    if (!validateChunkBounds(index.chunkBounds, totalChars, maxChunkBounds)) return null;
    if (!validateChunkHashes(index.chunkHashes, index.chunkBounds)) return null;
    if (index.chunkHashAlgorithm !== NORMALIZED_CHUNK_HASH_ALGORITHM || meta.chunkHashAlgorithm !== NORMALIZED_CHUNK_HASH_ALGORITHM) return null;
    if (textStat.size !== totalChars * 2) return null;
    if (!/^[a-f0-9]{40}$/i.test(String(index.textHash || '')) || index.textHash !== meta.textHash) return null;
    if (options.verifyTextHash === true && hashNormalizedTextFile(descriptor.textPath) !== index.textHash) return null;
    return {
      descriptor,
      meta,
      index,
      textStat,
      storage: 'disk',
      encoding: NORMALIZED_CONTENT_ENCODING,
      totalChars,
      totalChunks: index.chunkBounds.length,
      chunkBounds: index.chunkBounds,
      chunkHashes: index.chunkHashes,
      chunkHashAlgorithm: index.chunkHashAlgorithm,
      textHash: index.textHash,
      formatStats: index.formatStats && typeof index.formatStats === 'object' ? index.formatStats : {},
      sourceEncoding: String(index.sourceEncoding || meta.sourceEncoding || '')
    };
  } catch (_) {
    return null;
  }
}

async function readValidatedNormalizedCacheAsync(descriptor, options = {}) {
  try {
    if (!descriptor || !descriptor.cacheKey) return null;
    const maxIndexBytes = Math.max(1024, Number(options.maxIndexBytes) || DEFAULT_MAX_INDEX_BYTES);
    const maxChunkBounds = Math.max(1, Number(options.maxChunkBounds) || DEFAULT_MAX_CHUNK_BOUNDS);
    const [meta, index, textStat] = await Promise.all([
      safeReadJsonAsync(descriptor.metaPath, Math.min(maxIndexBytes, 1024 * 1024)),
      safeReadJsonAsync(descriptor.indexPath, maxIndexBytes),
      fs.promises.lstat(descriptor.textPath)
    ]);
    if (!textStat.isFile() || textStat.isSymbolicLink()) return null;
    const expected = descriptor.identity || {};
    const sharedChecks = (value) => value
      && Number(value.schema) === NORMALIZED_CONTENT_CACHE_SCHEMA
      && value.pass === NORMALIZED_CONTENT_CACHE_PASS
      && value.cacheKey === descriptor.cacheKey
      && value.statSig === expected.statSig
      && value.preprocessSignature === expected.preprocessSignature
      && Number(value.chunkSize) === Number(expected.chunkSize)
      && Number(value.chunkBoundaryLookahead) === Number(expected.chunkBoundaryLookahead)
      && value.normalizationVersion === expected.normalizationVersion
      && value.chunkIndexVersion === expected.chunkIndexVersion
      && value.encoding === NORMALIZED_CONTENT_ENCODING;
    if (!sharedChecks(meta) || !sharedChecks(index)) return null;
    const totalChars = Number(index.totalChars);
    if (!Number.isSafeInteger(totalChars) || totalChars < 0) return null;
    if (Number(meta.totalChars) !== totalChars || Number(meta.totalChunks) !== index.chunkBounds.length) return null;
    if (!validateChunkBounds(index.chunkBounds, totalChars, maxChunkBounds)) return null;
    if (!validateChunkHashes(index.chunkHashes, index.chunkBounds)) return null;
    if (index.chunkHashAlgorithm !== NORMALIZED_CHUNK_HASH_ALGORITHM || meta.chunkHashAlgorithm !== NORMALIZED_CHUNK_HASH_ALGORITHM) return null;
    if (textStat.size !== totalChars * 2) return null;
    if (!/^[a-f0-9]{40}$/i.test(String(index.textHash || '')) || index.textHash !== meta.textHash) return null;
    if (options.verifyTextHash === true && await hashNormalizedTextFileAsync(descriptor.textPath) !== index.textHash) return null;
    return {
      descriptor,
      meta,
      index,
      textStat,
      storage: 'disk',
      encoding: NORMALIZED_CONTENT_ENCODING,
      totalChars,
      totalChunks: index.chunkBounds.length,
      chunkBounds: index.chunkBounds,
      chunkHashes: index.chunkHashes,
      chunkHashAlgorithm: index.chunkHashAlgorithm,
      textHash: index.textHash,
      formatStats: index.formatStats && typeof index.formatStats === 'object' ? index.formatStats : {},
      sourceEncoding: String(index.sourceEncoding || meta.sourceEncoding || '')
    };
  } catch (_) {
    return null;
  }
}

function serializeNormalizedCacheMetadata(descriptor, details = {}) {
  const identity = descriptor.identity || {};
  const common = {
    schema: NORMALIZED_CONTENT_CACHE_SCHEMA,
    pass: NORMALIZED_CONTENT_CACHE_PASS,
    cacheKey: descriptor.cacheKey,
    statSig: identity.statSig,
    preprocessSignature: identity.preprocessSignature,
    chunkSize: identity.chunkSize,
    chunkBoundaryLookahead: identity.chunkBoundaryLookahead,
    normalizationVersion: identity.normalizationVersion,
    chunkIndexVersion: identity.chunkIndexVersion,
    encoding: NORMALIZED_CONTENT_ENCODING,
    totalChars: Math.max(0, Number(details.totalChars) || 0),
    totalChunks: Math.max(1, Number(details.totalChunks) || 1),
    textHash: String(details.textHash || ''),
    chunkHashAlgorithm: NORMALIZED_CHUNK_HASH_ALGORITHM,
    sourceEncoding: String(details.sourceEncoding || ''),
    createdAt: Math.max(0, Number(details.createdAt) || Date.now())
  };
  return {
    meta: common,
    index: Object.assign({}, common, {
      formatStats: details.formatStats && typeof details.formatStats === 'object' ? details.formatStats : {},
      chunkBounds: Array.isArray(details.chunkBounds) ? details.chunkBounds : [[0, 0]],
      chunkHashes: Array.isArray(details.chunkHashes) ? details.chunkHashes : []
    })
  };
}

module.exports = {
  NORMALIZED_CONTENT_CACHE_SCHEMA,
  NORMALIZED_CONTENT_CACHE_PASS,
  NORMALIZED_CONTENT_ENCODING,
  NORMALIZATION_ALGORITHM_VERSION,
  CHUNK_INDEX_ALGORITHM_VERSION,
  NORMALIZED_CHUNK_HASH_ALGORITHM,
  DEFAULT_MAX_INDEX_BYTES,
  DEFAULT_MAX_CHUNK_BOUNDS,
  sha256,
  canonicalFilePath,
  isInside,
  buildNormalizedCacheDescriptor,
  validateChunkBounds,
  validateChunkHashes,
  hashNormalizedTextFile,
  hashNormalizedTextFileAsync,
  hashNormalizedChunkBuffer,
  readValidatedNormalizedCache,
  readValidatedNormalizedCacheAsync,
  serializeNormalizedCacheMetadata
};
