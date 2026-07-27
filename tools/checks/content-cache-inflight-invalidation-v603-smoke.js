#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { createContentService } = require('../../server/services/content-service');

const PASS = 'v603-content-cache-inflight-invalidation-smoke-pass';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'content-invalidation-v603-'));
  const filePath = path.join(root, 'novel.txt');
  fs.writeFileSync(filePath, '가나다라마바사 '.repeat(2000));
  let taskStarted = false;
  let taskAborted = false;
  const pool = {
    runTask(payload, options = {}) {
      taskStarted = true;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const text = fs.readFileSync(payload.filePath, 'utf8');
          resolve({ text, textHash:crypto.createHash('sha1').update(text).digest('hex'), chunkBounds:[[0,text.length]], bytes:Buffer.byteLength(text), sourceEncoding:'utf8', formatStats:{} });
        }, 150);
        const onAbort = () => {
          taskAborted = true;
          clearTimeout(timer);
          reject(Object.assign(new Error('aborted'), { name:'AbortError', code:'CONTENT_WORKER_TASK_ABORTED' }));
        };
        options.signal?.addEventListener('abort', onAbort, { once:true });
      });
    },
    getStatus() { return { enabled:true }; },
    close() {}
  };
  const service = createContentService({
    chunkIndexDir:path.join(root, 'chunk-index'),
    chunkPayloadDir:path.join(root, 'chunks'),
    normalizedContentDir:path.join(root, 'normalized'),
    diskCacheMinBytes:Number.MAX_SAFE_INTEGER,
    contentWorkerPool:pool
  });
  try {
    const pending = service.getCachedFileEntryAsync(filePath, {});
    for (let i=0; i<50 && !taskStarted; i++) await wait(5);
    assert.strictEqual(taskStarted, true, 'worker task must start');
    service.clearFileCachePath(filePath);
    await assert.rejects(pending, error => error && (error.name === 'AbortError' || error.code === 'CONTENT_WORKER_TASK_ABORTED'));
    await wait(180);
    const status = service.getCacheStatus();
    assert.strictEqual(taskAborted, true, 'in-flight worker must be aborted on path invalidation');
    assert.strictEqual(status.fileCacheEntries, 0, 'invalidated task must not repopulate file cache');
    assert.strictEqual(status.fileCacheInflightEntries, 0, 'invalidated in-flight record must be removed');
    assert(status.metrics.fileCacheInvalidationAborts >= 1, 'invalidation abort metric must increment');
    console.log(JSON.stringify({ pass:PASS, aborts:status.metrics.fileCacheInvalidationAborts }));
  } finally {
    service.closeWorkerPool();
    fs.rmSync(root, { recursive:true, force:true });
  }
})().catch(error => { console.error(error && error.stack || error); process.exitCode=1; });
