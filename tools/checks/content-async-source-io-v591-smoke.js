#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createContentService, CONTENT_ASYNC_SOURCE_IO_PASS } = require('../../server/services/content-service');
const { readValidatedNormalizedCacheAsync } = require('../../server/services/normalized-content-cache');

const PASS = 'v591-content-async-source-io-smoke-pass';
const MARKER = 'v591-content-async-source-io-pass';
assert.strictEqual(CONTENT_ASYNC_SOURCE_IO_PASS, MARKER);
assert.strictEqual(typeof readValidatedNormalizedCacheAsync, 'function');

function waitFor(check, timeoutMs = 8000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      try { if (check()) return resolve(); } catch (error) { return reject(error); }
      if (Date.now() - started > timeoutMs) return reject(new Error('waitFor timeout'));
      setTimeout(tick, 20);
    };
    tick();
  });
}

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'content-async-v591-'));
  const chunkIndexDir = path.join(root, 'indexes');
  const chunkPayloadDir = path.join(root, 'chunks');
  const normalizedContentDir = path.join(root, 'normalized');
  const sourcePath = path.join(root, 'novel.txt');
  fs.mkdirSync(chunkIndexDir, { recursive:true });
  fs.mkdirSync(chunkPayloadDir, { recursive:true });
  fs.writeFileSync(sourcePath, ('첫 문장입니다. 😀\n두 번째 문장입니다.\n').repeat(15000), 'utf8');

  const service = createContentService({
    chunkIndexDir,
    chunkPayloadDir,
    normalizedContentDir,
    chunkSize:50000,
    chunkBoundaryLookahead:80000,
    diskCacheMinBytes:1,
    workerPoolSize:1,
    workerQueueMax:2
  });
  const original = {
    statSync:fs.statSync,
    lstatSync:fs.lstatSync,
    existsSync:fs.existsSync,
    readFileSync:fs.readFileSync,
    writeFileSync:fs.writeFileSync,
    renameSync:fs.renameSync,
    realpathSync:fs.realpathSync
  };
  const blockedRoots = [sourcePath, chunkIndexDir, chunkPayloadDir, normalizedContentDir].map(String);
  const shouldBlock = value => blockedRoots.some(rootPath => String(value || '').startsWith(rootPath));
  try {
    for (const name of Object.keys(original)) {
      fs[name] = function blockedSyncIo(filePath, ...args) {
        if (shouldBlock(filePath)) throw new Error(`async content request used ${name}: ${filePath}`);
        return original[name].call(this, filePath, ...args);
      };
    }

    const first = await service.getContentChunkAsync(sourcePath, {}, 2);
    assert.strictEqual(first.asyncSourceIoPass, MARKER);
    assert.strictEqual(first.chunkPayloadCacheHit, false);
    await waitFor(() => service.getCacheStatus().chunkPayloadWritesInflight === 0);
    service.clearAllFileCache();
    const second = await service.getContentChunkAsync(sourcePath, {}, 2);
    assert.strictEqual(second.asyncSourceIoPass, MARKER);
    assert.strictEqual(second.chunkPayloadCacheHit, true, 'second request should use async disk payload cache');
    assert.strictEqual(second.content, first.content);
    const status = service.getCacheStatus();
    assert(status.metrics.asyncStatSignatureCalls >= 2, 'async source stat metric missing');
    assert(status.metrics.chunkPayloadAsyncReadCalls >= 2, 'async payload read metric missing');
    assert(status.metrics.normalizedRangeReads >= 1, 'normalized range read missing');
    console.log(JSON.stringify({ pass:PASS, marker:MARKER, metrics:status.metrics }));
  } finally {
    Object.assign(fs, original);
    service.closeWorkerPool();
    fs.rmSync(root, { recursive:true, force:true });
  }
})().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
