const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  NORMALIZED_CONTENT_CACHE_PASS,
  NORMALIZATION_ALGORITHM_VERSION,
  CHUNK_INDEX_ALGORITHM_VERSION,
  buildNormalizedCacheDescriptor,
  hashNormalizedChunkBuffer,
  isInside,
  readValidatedNormalizedCache,
  serializeNormalizedCacheMetadata
} = require('../../server/services/normalized-content-cache');

const PASS = 'v570-normalized-content-cache-security-smoke-pass';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'normalized-security-'));
let symlinkBlocked = false;
try {
  const cacheRoot = path.join(root, 'cache');
  const sourcePath = path.join(root, '..', '..', 'private-library', '..', 'secret.txt');
  const descriptor = buildNormalizedCacheDescriptor({
    rootDir: cacheRoot,
    filePath: sourcePath,
    statSig: '1:2:3',
    preprocessSignature: 'default',
    chunkSize: 8,
    chunkBoundaryLookahead: 32
  });
  assert(/^[a-f0-9]{64}$/.test(descriptor.cacheKey), 'cache key must be opaque SHA-256');
  for (const candidate of [descriptor.dir, descriptor.textPath, descriptor.indexPath, descriptor.metaPath]) {
    assert(isInside(cacheRoot, candidate), 'cache path escaped root: ' + candidate);
    assert(!candidate.includes('secret.txt') && !candidate.includes('private-library'), 'source path leaked into cache path');
  }
  fs.mkdirSync(descriptor.dir, { recursive:true });
  const text = '가😀나';
  const payload = serializeNormalizedCacheMetadata(descriptor, {
    totalChars: text.length,
    totalChunks: 1,
    textHash: crypto.createHash('sha1').update(text, 'utf8').digest('hex'),
    sourceEncoding: 'utf8',
    chunkBounds: [[0, text.length]],
    chunkHashes: [hashNormalizedChunkBuffer(Buffer.from(text, 'utf16le'))]
  });
  const serialized = JSON.stringify(payload);
  assert(!serialized.includes(sourcePath) && !serialized.includes('secret.txt'), 'source path leaked into cache metadata');
  fs.writeFileSync(descriptor.textPath, Buffer.from(text, 'utf16le'));
  fs.writeFileSync(descriptor.indexPath, JSON.stringify(payload.index));
  fs.writeFileSync(descriptor.metaPath, JSON.stringify(payload.meta));
  assert(readValidatedNormalizedCache(descriptor), 'valid opaque cache should load');

  const external = path.join(root, 'external.text');
  fs.writeFileSync(external, Buffer.from(text, 'utf16le'));
  fs.rmSync(descriptor.textPath);
  try {
    fs.symlinkSync(external, descriptor.textPath);
    assert.strictEqual(readValidatedNormalizedCache(descriptor), null, 'symlinked cache body must be rejected');
  } catch (error) {
    if (error && ['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) symlinkBlocked = true;
    else throw error;
  }

  const appSource = fs.readFileSync(path.join(__dirname, '../../server/app.js'), 'utf8');
  assert(appSource.includes('express.static(paths.PUBLIC_DIR'), 'public static root contract missing');
  assert(!appSource.includes('express.static(paths.DATA_DIR') && !appSource.includes('express.static(NORMALIZED_CONTENT_CACHE_DIR'), 'normalized cache must not be statically exposed');
  assert(appSource.includes('NORMALIZED_CONTENT_CACHE_DIR'), 'normalized cache runtime wiring missing');
  assert.strictEqual(NORMALIZATION_ALGORITHM_VERSION.startsWith('v572-'), true);
  assert.strictEqual(CHUNK_INDEX_ALGORITHM_VERSION.startsWith('v573-'), true);
  if (symlinkBlocked) {
    console.log(JSON.stringify({ partialPass:PASS, blockedCapabilities:['symlink'], cachePass:NORMALIZED_CONTENT_CACHE_PASS, cacheKey:descriptor.cacheKey }));
    process.exitCode = 77;
  } else {
    console.log(JSON.stringify({ pass:PASS, cachePass:NORMALIZED_CONTENT_CACHE_PASS, cacheKey:descriptor.cacheKey }));
  }
} finally {
  fs.rmSync(root, { recursive:true, force:true });
}
