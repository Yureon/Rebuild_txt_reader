#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const PASS = 'v460-search-worker-batch-pass';
const TUNE_PASS = 'v509-search-worker-adaptive-batch-pass';
const matcher = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/search/matcher.mjs'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/search/search-worker.js'), 'utf8');
assert.ok(matcher.includes(`SEARCH_WORKER_BATCH_PASS = '${PASS}'`), 'search worker batch marker missing');
assert.ok(matcher.includes('const SEARCH_WORKER_BATCH_SIZE_MAX = 4'), 'search worker batch max must stay server-friendly while reducing worker postMessage round trips');
assert.ok(matcher.includes('collectMatchesBatchWithOptionalWorker'), 'batch matcher helper missing');
assert.ok(matcher.includes('client.match({ chunks: capped'), 'worker must receive multiple chunks in one message');
assert.ok(matcher.includes('workerBatchSchedulePass'), 'v467 batch scheduling diagnostics missing');
assert.ok(!matcher.includes('client.match({ chunks:[chunkPayload]'), 'worker path must not be fixed to one chunk per postMessage');
assert.ok(matcher.includes('workerBatchChunks'), 'batch diagnostics missing');
assert.ok(worker.includes('collectWorkerMatches(message.chunks'), 'worker must accept message.chunks arrays');
assert.ok(matcher.includes(TUNE_PASS) && worker.includes(TUNE_PASS), 'v509 adaptive worker batch marker missing');
console.log(JSON.stringify({ pass: PASS }));
