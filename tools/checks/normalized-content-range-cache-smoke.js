#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { createContentService, NORMALIZED_CONTENT_CACHE_PASS, CONTENT_RANGE_READ_PASS } = require('../../server/services/content-service');
const { buildNormalizedCacheDescriptor, NORMALIZATION_ALGORITHM_VERSION, CHUNK_INDEX_ALGORITHM_VERSION } = require('../../server/services/normalized-content-cache');

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v570-range-'));
  const filePath = path.join(tmp, 'novel.txt');
  const raw = ('\uFEFF첫 문장😀과 확장한자 𠮷.\r\n둘째 줄\t  공백   \r\n\u200B셋째 줄\r\n\r\n').repeat(12000);
  fs.writeFileSync(filePath, raw, 'utf8');
  const common = {
    chunkIndexDir: path.join(tmp, 'chunk_indexes'),
    chunkPayloadDir: path.join(tmp, 'content_chunks'),
    normalizedContentDir: path.join(tmp, 'normalized_content'),
    diskCacheMinBytes: 0,
    chunkSize: 4097,
    chunkBoundaryLookahead: 12000,
    workerPoolSize: 1,
    workerQueueMax: 4
  };
  const service = createContentService(common);
  const expected = service.formatNovelText(raw, {}).text;
  const entries = await Promise.all(Array.from({ length: 6 }, () => service.getCachedFileEntryAsync(filePath, {})));
  const entry = entries[0];
  assert.equal(entry.storage, 'disk');
  assert.equal(entry.text, null, 'large entry must not retain normalized text in main memory');
  assert.equal(entry.totalChars, expected.length);
  assert.ok(entry.normalizedCache && fs.existsSync(entry.normalizedCache.textPath));
  assert.ok(fs.existsSync(entry.normalizedCache.indexPath));
  assert.ok(fs.existsSync(entry.normalizedCache.metaPath));
  assert.ok(entries.every(item => item.cacheKey === entry.cacheKey));
  const status = service.getCacheStatus();
  assert.equal(status.metrics.contentWorkerTasksStarted, 1, 'same-file concurrent requests must share one worker task');
  assert.ok(status.metrics.fileCacheInflightJoins >= 5, 'concurrent requests must join the inflight task');
  assert.equal(status.normalizedContentCachePass, NORMALIZED_CONTENT_CACHE_PASS);
  assert.equal(status.contentRangeReadPass, CONTENT_RANGE_READ_PASS);

  let rebuilt = '';
  for (let chunk = 1; chunk <= service.getTotalChunks(entry); chunk += 1) {
    const range = await service.getChunkByLineAsync(entry, chunk);
    rebuilt += range.content;
    if (range.end > range.start && range.end < expected.length) {
      const left = expected.charCodeAt(range.end - 1);
      const right = expected.charCodeAt(range.end);
      assert.ok(!(left >= 0xD800 && left <= 0xDBFF && right >= 0xDC00 && right <= 0xDFFF), 'chunk boundary split a surrogate pair');
    }
  }
  assert.equal(rebuilt, expected, 'range reads must reconstruct the legacy normalized result exactly');
  service.closeWorkerPool();

  const warmService = createContentService({ ...common, workerThreadsEnabled: false });
  const warmEntry = await warmService.getCachedFileEntryAsync(filePath, {});
  assert.equal(warmEntry.storage, 'disk');
  assert.equal(warmEntry.cacheKey, entry.cacheKey);
  assert.equal(warmService.getCacheStatus().metrics.contentWorkerTasksStarted, 0, 'warm disk hit must not start a worker');
  const warmChunk = await warmService.getChunkByLineAsync(warmEntry, 1);
  assert.equal(warmChunk.content, expected.slice(warmChunk.start, warmChunk.end));

  const baseDescriptor = buildNormalizedCacheDescriptor({
    rootDir: common.normalizedContentDir,
    filePath,
    statSig: warmEntry.statSig,
    preprocessSignature: warmService.serializePreprocessOptions({}),
    chunkSize: common.chunkSize,
    chunkBoundaryLookahead: common.chunkBoundaryLookahead,
    normalizationVersion: NORMALIZATION_ALGORITHM_VERSION,
    chunkIndexVersion: CHUNK_INDEX_ALGORITHM_VERSION
  });
  const changedDescriptor = buildNormalizedCacheDescriptor({
    rootDir: common.normalizedContentDir,
    filePath,
    statSig: warmEntry.statSig,
    preprocessSignature: warmService.serializePreprocessOptions({}),
    chunkSize: common.chunkSize,
    chunkBoundaryLookahead: common.chunkBoundaryLookahead,
    normalizationVersion: NORMALIZATION_ALGORITHM_VERSION + '-changed',
    chunkIndexVersion: CHUNK_INDEX_ALGORITHM_VERSION
  });
  assert.notEqual(baseDescriptor.cacheKey, changedDescriptor.cacheKey, 'normalization version must invalidate the cache key');
  warmService.closeWorkerPool();
  console.log(JSON.stringify({ pass: 'v570-normalized-content-range-cache-smoke-pass', chunks: entry.totalChunks, totalChars: entry.totalChars }));
}

main().catch((error) => { console.error(error); process.exit(1); });
