#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const PASS = 'v591-search-adaptive-listener-cleanup-smoke-pass';
const MARKER = 'v591-search-adaptive-input-cleanup-pass';
const sourcePath = path.join(__dirname, '../../public/scripts/rebuild/features/search.mjs');
const profilePath = path.join(__dirname, '../../public/scripts/rebuild/features/search/search-performance-profile.mjs');
const source = fs.readFileSync(sourcePath, 'utf8');
const profile = fs.readFileSync(profilePath, 'utf8');
assert(source.includes(`SEARCH_ADAPTIVE_INPUT_CLEANUP_PASS = '${MARKER}'`), 'cleanup marker missing');
assert(profile.includes('search.adaptiveInputCleanup = () =>'), 'adaptive listener disposer factory missing');
assert(source.includes('app.searchCleanup?.();'), 'reinstall cleanup entry missing');
const cleanupStart = source.indexOf('app.searchCleanup = () => {');
const cleanupEnd = source.indexOf('\n  };', cleanupStart);
assert(cleanupStart >= 0 && cleanupEnd > cleanupStart, 'search cleanup block missing');
const cleanup = source.slice(cleanupStart, cleanupEnd);
assert(cleanup.includes('app.state.search.adaptiveInputCleanup?.();'), 'adaptive input listeners are not disposed');
assert(cleanup.includes('disposers.splice(0).forEach'), 'regular search listeners are not disposed');
const adaptiveCall = cleanup.indexOf('adaptiveInputCleanup?.()');
const disposerCall = cleanup.indexOf('disposers.splice(0)');
assert(adaptiveCall >= 0 && adaptiveCall < disposerCall, 'adaptive listeners should be removed before general cleanup completes');
console.log(JSON.stringify({ pass:PASS, marker:MARKER }));
