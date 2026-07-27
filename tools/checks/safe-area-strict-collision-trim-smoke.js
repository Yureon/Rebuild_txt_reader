#!/usr/bin/env node
const fs = require('fs');
function assert(cond, msg){ if(!cond){ console.error('[safe-area-strict-collision-trim-smoke] FAIL:', msg); process.exit(1); } }
const viewport = fs.readFileSync('public/scripts/rebuild/features/ui/viewport-fit.mjs','utf8');
const css = fs.readFileSync('public/styles/app.css','utf8');
assert(viewport.includes('v465-safe-area-strict-collision-trim-pass'), 'missing v465 strict safe-area marker');
assert(viewport.includes("bar.dataset.safeOverflowTrim = 'false'") && viewport.includes("bar.dataset.safeOverflowTrim = 'true'"), 'strict trim flag must be toggled');
assert(viewport.includes('strictTrimPass') && viewport.includes('strictTrim'), 'strict trim diagnostics missing');
assert(css.includes('data-safe-overflow-trim="true"'), 'strict trim CSS selector missing');
assert(css.includes('#toolbar-network-mode{display:none!important}') && css.includes('#safe-clock') && css.includes('#safe-progress'), 'strict trim must hide network and pin clock/progress');
console.log('[safe-area-strict-collision-trim-smoke] OK');
