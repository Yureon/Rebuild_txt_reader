#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createContentService, CONTENT_LARGE_FILE_CHUNK_CACHE_PASS } = require('../../server/services/content-service.js');
const PASS = 'v457-content-large-file-chunk-cache-smoke-pass';
assert.strictEqual(CONTENT_LARGE_FILE_CHUNK_CACHE_PASS, PASS);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-chunk-payload-'));
try {
  const chunkIndexDir = path.join(tmp, 'chunk_indexes');
  const chunkPayloadDir = path.join(tmp, 'content_chunks');
  fs.mkdirSync(chunkIndexDir, { recursive: true });
  fs.mkdirSync(chunkPayloadDir, { recursive: true });
  const filePath = path.join(tmp, 'large.txt');
  fs.writeFileSync(filePath, '가'.repeat(260000), 'utf8');
  const service = createContentService({ chunkIndexDir, chunkPayloadDir, chunkSize: 50000, chunkBoundaryLookahead: 50000, fileCacheMaxBytes: 1 });
  (async () => {
    const first = await service.getContentChunkAsync(filePath, {}, 2);
    assert.strictEqual(first.chunkPayloadCacheHit, false, 'first chunk request should compute payload');
    let status = service.getCacheStatus();
    assert.strictEqual(status.largeFileChunkCachePass, PASS, 'cache status marker missing');
    assert.ok(status.metrics.chunkPayloadWriteAttempts >= 1, 'chunk payload write attempt missing');
    const second = await service.getContentChunkAsync(filePath, {}, 2);
    assert.strictEqual(second.chunkPayloadCacheHit, true, 'second chunk request should hit disk payload cache');
    assert.strictEqual(second.content, first.content, 'disk cached chunk payload mismatch');
    status = service.getCacheStatus();
    assert.ok(status.metrics.chunkPayloadDiskHits >= 1, 'chunk payload disk hit metric missing');
    console.log(JSON.stringify({ pass: PASS, totalChunks: second.totalChunks }));
  })().catch(error => { console.error(error && error.stack || error); process.exit(1); });
} finally {
  process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));
}
