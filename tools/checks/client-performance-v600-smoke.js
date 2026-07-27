#!/usr/bin/env node
const fs = require('fs');
const assert = require('assert');
const source = fs.readFileSync('public/scripts/rebuild/core/performance-metrics.mjs','utf8');
const browser = fs.readFileSync('tools/checks/initial-load-browser-v600-smoke.js','utf8');
assert(source.includes('export function getBootLongTasks'), 'boot-window task filter missing');
assert(source.includes('taskStart < end && taskEnd > start'), 'long tasks must overlap the boot window');
assert(source.includes('complete.durationMs =') && source.includes('complete.at - start'), 'boot duration must be calculated from phase timestamps');
assert(source.includes('store.bootLongTasks = getBootLongTasks(store)'), 'filtered boot task snapshot missing');
assert(browser.includes('bootStart') && browser.includes('bootComplete'), 'browser smoke must read the boot window');
assert(browser.includes('warmup') && browser.includes('samples'), 'browser smoke must use warm-up and repeated samples');
assert(!browser.includes('phases?.bootComplete?.durationMs || window.__TXT_READER_PERF__?.bootDurationMs || 0'), 'v599 zero-duration fallback must not return');
console.log(JSON.stringify({ pass:'v600-client-performance-smoke-pass' }));
