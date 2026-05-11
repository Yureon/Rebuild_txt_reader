#!/usr/bin/env node
const fs = require('fs');
function assert(cond, msg){ if(!cond){ console.error('[reader-live-scroll-progress-smoke] FAIL:', msg); process.exit(1); } }
const side = fs.readFileSync('public/scripts/rebuild/features/reader/scroll-side-effects.mjs','utf8');
const reader = fs.readFileSync('public/scripts/rebuild/features/reader.mjs','utf8');
const progress = fs.readFileSync('public/scripts/rebuild/features/reader/progress.mjs','utf8');
assert(side.includes('v464-reader-live-scroll-progress-pass'), 'missing live progress marker');
assert(side.includes('requestAnimationFrame?.(runProgress)'), 'progress update must be rAF scheduled');
assert(!side.includes('window.clearTimeout(progressTimer);\n      window.clearTimeout(extendTimer);\n      progressTimer = window.setTimeout(runProgress'), 'old debounced progress path still present');
assert(reader.includes('}, 32);'), 'reader scroll throttle must be tightened to 32ms');
assert(progress.includes('readerLiveScrollProgressPass'), 'nav/safe progress must expose live marker');
assert(progress.includes('app.state.navSliderSeeking !== true'), 'scroll progress must not fight active slider input');
console.log('[reader-live-scroll-progress-smoke] OK');
