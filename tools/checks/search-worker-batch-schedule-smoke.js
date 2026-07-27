#!/usr/bin/env node
const assert = require('assert');
const { CURRENT_REBUILD_VERSION } = require('./current-rebuild-version');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const PASS = 'v467-search-worker-batch-schedule-pass';
const matcher = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/search/matcher.mjs'), 'utf8');
assert.ok(matcher.includes(`SEARCH_WORKER_BATCH_SCHEDULE_PASS = '${PASS}'`), 'v467 search worker schedule marker missing');
assert.ok(matcher.includes('for (let offset = 0; offset < chunks.length && out.length < limit;)'), 'worker matcher must process every adaptive payload sub-batch');
assert.ok(matcher.includes('const adaptiveBatchSize = Math.max(1, resolveAdaptiveSearchWorkerBatchSize(app));'), 'worker sub-batch must use adaptive batch size');
assert.ok(matcher.includes('const capped = chunks.slice(offset, offset + adaptiveBatchSize);'), 'worker sub-batch must remain capped to adaptive batch size');
assert.ok(matcher.includes('client.match({ chunks: capped, query:q, limit:remaining }'), 'worker must receive capped sub-batches with remaining limit');
assert.ok(!matcher.includes('const capped = chunks.slice(0, Math.max(1, SEARCH_WORKER_BATCH_SIZE'), 'worker matcher must not drop chunks after the first capped batch');
assert.ok(matcher.includes('workerBatchSchedulePass'), 'worker batch schedule diagnostics missing');
assert.ok(matcher.includes(`SEARCH_WORKER_SCRIPT_URL = '/scripts/rebuild/features/search/search-worker.js?v=${CURRENT_REBUILD_VERSION}'`), 'worker cachebuster must match current rebuild');
console.log(JSON.stringify({ pass: PASS }));
