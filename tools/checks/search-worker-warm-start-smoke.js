#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { CURRENT_REBUILD_VERSION } = require('./current-rebuild-version');
const root = path.join(__dirname, '../..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
const matcher = read('public/scripts/rebuild/features/search/matcher.mjs');
const search = read('public/scripts/rebuild/features/search.mjs');
assert(matcher.includes("v453-search-worker-warm-start-pass"), 'warm-start marker missing');
assert(matcher.includes('export function prewarmSearchWorker'), 'prewarmSearchWorker export missing');
assert(matcher.includes('getSearchWorkerClient(app'), 'prewarm must reuse worker client helper');
assert(matcher.includes('searchWorkerWarmStart'), 'stats must expose warm-start record');
assert(matcher.includes(`search-worker.js?v=${CURRENT_REBUILD_VERSION}`), 'worker URL cachebuster must match current rebuild');
assert(search.includes('prewarmSearchWorker'), 'search shell must import/call prewarmSearchWorker');
assert(search.includes("prewarmSearchWorker(app, 'search-open')"), 'search open warm-start call missing');
assert(search.includes("prewarmSearchWorker(app, 'search-run')"), 'search run warm-start call missing');
console.log('v453-search-worker-warm-start-smoke-pass');
