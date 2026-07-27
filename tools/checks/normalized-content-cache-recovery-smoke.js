#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { createContentService } = require('../../server/services/content-service');
const { hashNormalizedTextFile } = require('../../server/services/normalized-content-cache');

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v570-recovery-'));
  const filePath = path.join(tmp, 'novel.txt');
  const common = {
    chunkIndexDir: path.join(tmp, 'chunk_indexes'),
    chunkPayloadDir: path.join(tmp, 'content_chunks'),
    normalizedContentDir: path.join(tmp, 'normalized_content'),
    diskCacheMinBytes: 0,
    chunkSize: 3000,
    workerPoolSize: 1
  };
  fs.writeFileSync(filePath, ('복구 테스트😀\n').repeat(30000), 'utf8');
  let service = createContentService(common);
  const first = await service.getCachedFileEntryAsync(filePath, {});
  const firstKey = first.cacheKey;
  fs.writeFileSync(first.normalizedCache.indexPath, '{broken', 'utf8');
  service.clearAllFileCache();
  const repaired = await service.getCachedFileEntryAsync(filePath, {});
  assert.equal(repaired.cacheKey, firstKey);
  assert.ok(service.getCacheStatus().metrics.normalizedCacheBuilds >= 2, 'corrupt index must trigger regeneration');
  JSON.parse(fs.readFileSync(repaired.normalizedCache.indexPath, 'utf8'));
  service.closeWorkerPool();

  // Warm entry loading must not synchronously scan the full normalized body.
  service.closeWorkerPool();
  service = createContentService(common);
  const originalReadSync = fs.readSync;
  fs.readSync = (fd, buffer, offset, length, position) => {
    const target = fs.readlinkSync(`/proc/self/fd/${fd}`);
    if (path.resolve(target) === path.resolve(repaired.normalizedCache.textPath)) {
      throw new Error('warm metadata load attempted a synchronous full-body read');
    }
    return originalReadSync(fd, buffer, offset, length, position);
  };
  let warmEntry;
  try { warmEntry = await service.getCachedFileEntryAsync(filePath, {}); }
  finally { fs.readSync = originalReadSync; }
  assert.equal(warmEntry.storage, 'disk');
  assert.equal(service.getCacheStatus().metrics.normalizedCacheBuilds, 0, 'warm metadata load must not rebuild or synchronously hash');
  service.closeWorkerPool();

  // The explicit legacy hash helper must tolerate odd-sized short reads.
  const expectedHash = hashNormalizedTextFile(repaired.normalizedCache.textPath);
  fs.readSync = (fd, buffer, offset, length, position) => originalReadSync(fd, buffer, offset, Math.min(length, 4095), position);
  try { assert.equal(hashNormalizedTextFile(repaired.normalizedCache.textPath), expectedHash); }
  finally { fs.readSync = originalReadSync; }

  // Same-size text corruption is detected by the requested chunk hash and rebuilt transparently.
  const corrupted = fs.readFileSync(repaired.normalizedCache.textPath);
  corrupted[0] ^= 0x01;
  fs.writeFileSync(repaired.normalizedCache.textPath, corrupted);
  service = createContentService(common);
  const corruptWarmEntry = await service.getCachedFileEntryAsync(filePath, {});
  const recoveredChunk = await service.getChunkByLineAsync(corruptWarmEntry, 1);
  assert.ok(recoveredChunk.content.startsWith('복구 테스트'), 'same-size normalized text corruption must trigger transparent chunk recovery');
  const hashRecovered = await service.getCachedFileEntryAsync(filePath, {});
  const recoveredText = fs.readFileSync(hashRecovered.normalizedCache.textPath).toString('utf16le');
  assert.ok(recoveredText.startsWith('복구 테스트'));
  const recoveryStatus = service.getCacheStatus();
  assert.ok(recoveryStatus.metrics.normalizedChunkHashFailures >= 1);
  assert.ok(recoveryStatus.metrics.normalizedCacheBuilds >= 1);
  service.closeWorkerPool();

  fs.unlinkSync(hashRecovered.normalizedCache.metaPath);
  service = createContentService(common);
  const partialRecovered = await service.getCachedFileEntryAsync(filePath, {});
  assert.equal(partialRecovered.cacheKey, firstKey);
  assert.ok(fs.existsSync(partialRecovered.normalizedCache.metaPath), 'missing final metadata must be regenerated');
  service.closeWorkerPool();

  await new Promise(resolve => setTimeout(resolve, 12));
  fs.appendFileSync(filePath, '원본 변경\n', 'utf8');
  service = createContentService(common);
  const changed = await service.getCachedFileEntryAsync(filePath, {});
  assert.notEqual(changed.cacheKey, firstKey, 'source stat change must select a new normalized cache key');
  const last = await service.getChunkByLineAsync(changed, service.getTotalChunks(changed));
  assert.ok(last.content.includes('원본 변경'));
  service.closeWorkerPool();
  console.log(JSON.stringify({ pass: 'v570-normalized-content-cache-recovery-smoke-pass' }));
}

main().catch((error) => { console.error(error); process.exit(1); });
