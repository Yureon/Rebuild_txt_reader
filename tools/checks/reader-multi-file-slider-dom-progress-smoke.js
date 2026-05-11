#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const projectRoot = path.resolve(__dirname, '..', '..');
const reader = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/reader.mjs'), 'utf8');
const progress = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/reader/progress.mjs'), 'utf8');
const cache = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/reader/cache-store.mjs'), 'utf8');
const releaseVerify = fs.readFileSync(path.join(projectRoot, 'tools/release_verify.js'), 'utf8');
function assert(cond, msg) { if (!cond) throw new Error(msg); }
assert((progress.includes('resolveNavSliderProgress(app, address, localDocRatio)') || progress.includes('resolveNavSliderProgress(app, displayAddress, localDocRatio)')) && progress.includes('READER_SLIDER_FILE_CHAR_PROGRESS_PASS'), 'bottom slider must remain current episode/fileChar-local document scoped');
assert(progress.includes("app.els.navSlider.max = '1000'"), 'nav slider DOM max must be fixed normalized range');
assert(progress.includes('formatDocumentPosition(app, { ...address, documentRatio: localDocRatio })') || progress.includes('formatDocumentPosition(app, { ...displayAddress, documentRatio: localDocRatio })'), 'nav info must format local document address');
assert(reader.includes('v424-reader-manifest-total-chunks-nav-refresh-pass'), 'manifest refresh marker missing');
assert(reader.includes('updateProgressFromViewport(app);'), 'manifest totalChunks refresh must update nav/progress immediately');
assert(cache.includes('v424-reader-multi-file-current-cache-totalchunks-guard-pass'), 'current-version unverified multi-file cache guard missing');
assert(cache.includes('manifestTotal > 1'), 'cache guard must allow verified manifest totals');
assert(releaseVerify.includes('reader-multi-file-slider-dom-progress-smoke.js'), 'release verify must include v424 DOM progress smoke');
console.log('v424-reader-multi-file-slider-dom-progress-smoke-pass');
