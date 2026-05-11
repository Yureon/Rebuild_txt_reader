#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const projectRoot = path.resolve(__dirname, '..', '..');
const summary = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/summary-panel.mjs'), 'utf8');
const cache = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/reader/cache-store.mjs'), 'utf8');
function assert(cond, msg) { if (!cond) throw new Error(msg); }
assert(summary.includes('v424-recovery-reader-stale-cache-summary-pass'), 'recovery summary marker missing');
assert(summary.includes('readerStaleMultiFileCacheBypass'), 'recovery summary must read stale cache bypass state');
assert(summary.includes('Slider/cache guard'), 'summary must expose compact slider/cache guard row');
assert(cache.includes('v424-reader-multi-file-current-cache-totalchunks-guard-pass'), 'reader cache guard marker missing');
console.log('v424-recovery-reader-stale-cache-summary-smoke-pass');
