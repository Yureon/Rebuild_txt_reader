#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const CONTENT_CACHE_RAWTEXT_SMOKE_PASS = 'v352-content-cache-rawtext-smoke-pass';
const CONTENT_HASH_CACHE_SMOKE_PASS = 'v352-content-hash-cache-smoke-pass';

function sha1(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex');
}

async function runContentCacheRawTextSmoke(projectRoot = path.resolve(__dirname, '..', '..')) {
  const { createContentService } = require(path.join(projectRoot, 'server/services/content-service.js'));
  const { createBlockManifestService } = require(path.join(projectRoot, 'server/services/block-manifest-service.js'));
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-content-cache-'));
  const chunkIndexDir = path.join(tempRoot, 'chunks');
  const libraryRoot = path.join(tempRoot, 'library');
  fs.mkdirSync(chunkIndexDir, { recursive: true });
  fs.mkdirSync(libraryRoot, { recursive: true });
  const novelPath = path.join(libraryRoot, 'novel.txt');
  const body = ['제 1화', '', '첫 문단입니다. 다음 문장입니다.', '', '둘째 문단입니다.'].join('\n');
  fs.writeFileSync(novelPath, body, 'utf8');

  try {
    const contentService = createContentService({ chunkIndexDir, chunkSize: 24, fileCacheMax: 4, fileCacheMaxBytes: 1024 * 1024 });
    const entry = await contentService.getCachedFileEntryAsync(novelPath, {});
    assert.ok(entry && typeof entry.text === 'string', 'cached entry must keep formatted text');
    assert.ok(!Object.prototype.hasOwnProperty.call(entry, 'rawText'), 'cached entry must not retain rawText');
    assert.ok(typeof entry.textHash === 'string' && /^[0-9a-f]{40}$/.test(entry.textHash), 'cached entry must expose sha1 textHash');
    assert.strictEqual(entry.textHash, sha1(entry.text), 'textHash must match formatted text sha1');
    assert.ok(Array.isArray(entry.chunkBounds) && entry.chunkBounds.length >= 1, 'cached entry must keep chunk bounds');
    assert.ok(entry.formatStats && typeof entry.formatStats === 'object', 'cached entry must keep format stats');

    const entry2 = await contentService.getCachedFileEntryAsync(novelPath, {});
    assert.strictEqual(entry2, entry, 'async cached entry should reuse the in-memory cache hit');
    assert.ok(!Object.prototype.hasOwnProperty.call(entry2, 'rawText'), 'async cached entry must not reintroduce rawText');

    const libraryService = {
      getLibraryCached() { return [{ id: 'novel-1', title: 'Novel', isMultiFile: false, singlePath: 'novel.txt' }]; },
      safeJoinUnderLibrary(relPath) { return path.join(libraryRoot, relPath); }
    };
    const blockManifestService = createBlockManifestService({ libraryPath: libraryRoot, libraryService, contentService, manifestCacheMax: 2 });
    const manifest = await blockManifestService.getSingleManifest('novel-1', {});
    assert.strictEqual(manifest.status, 200, 'manifest request must succeed');
    assert.strictEqual(manifest.body.contentHash, entry.textHash, 'block manifest must reuse cached entry.textHash as contentHash');
    assert.ok(manifest.body.totalChunks >= 1 && manifest.body.totalBlocks >= 1, 'manifest must preserve chunk/block counts');

    const cached = await blockManifestService.getSingleManifest('novel-1', {});
    assert.strictEqual(cached.body, manifest.body, 'manifest cache must still reuse identical object');

    return {
      pass: CONTENT_CACHE_RAWTEXT_SMOKE_PASS,
      hashPass: CONTENT_HASH_CACHE_SMOKE_PASS,
      textHash: entry.textHash,
      chunks: entry.chunkBounds.length,
      blocks: manifest.body.totalBlocks
    };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

module.exports = {
  CONTENT_CACHE_RAWTEXT_SMOKE_PASS,
  CONTENT_HASH_CACHE_SMOKE_PASS,
  runContentCacheRawTextSmoke
};

if (require.main === module) {
  runContentCacheRawTextSmoke().then((result) => console.log(JSON.stringify(result))).catch((error) => {
    console.error(error && error.stack || error);
    process.exit(1);
  });
}
