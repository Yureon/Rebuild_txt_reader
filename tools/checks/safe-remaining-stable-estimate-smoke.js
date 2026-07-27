#!/usr/bin/env node
const fs = require('fs');
function assert(cond, msg){ if(!cond){ console.error('[safe-remaining-stable-estimate-smoke] FAIL:', msg); process.exit(1); } }
const progress = fs.readFileSync('public/scripts/rebuild/features/reader/progress.mjs','utf8');
assert(progress.includes('v465-safe-remaining-stable-estimate-pass'), 'missing v465 remaining-time marker');
assert(progress.includes('계산중'), 'safe-area should show 계산중 while ETA warms up');
assert(progress.includes('buildRemainingStatsKey') && progress.includes('readingStats') && progress.includes('byKey'), 'remaining stats must be scoped by stable reading key');
assert(progress.includes('programmatic-slider') && progress.includes('programmatic/jump sample ignored'), 'programmatic slider/jump samples must be ignored');
assert(progress.includes('lastSafeRemainingEstimate') && progress.includes('lastIgnoredSample'), 'diagnostics for remaining estimate missing');
console.log('[safe-remaining-stable-estimate-smoke] OK');
