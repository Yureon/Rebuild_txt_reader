#!/usr/bin/env node
const fs = require('fs');
function assert(cond, msg){ if(!cond){ console.error('[safe-area-iterative-collision-fit-smoke] FAIL:', msg); process.exit(1); } }
const viewport = fs.readFileSync('public/scripts/rebuild/features/ui/viewport-fit.mjs','utf8');
const ui = fs.readFileSync('public/scripts/rebuild/features/ui.mjs','utf8');
const css = fs.readFileSync('public/styles/app.css','utf8');
const progress = fs.readFileSync('public/scripts/rebuild/features/reader/progress.mjs','utf8');
assert(viewport.includes('v464-safe-area-iterative-collision-fit-pass'), 'missing v464 iterative marker');
assert(viewport.includes("const modes = ['normal', 'compact', 'minimal', 'hide-network']"), 'missing ordered collision modes');
assert(viewport.includes('measureSafeAreaCollision') && viewport.includes('getVisibleSafeRect'), 'missing iterative measurement helpers');
assert(viewport.includes('txt-reader-safe-area-content-change'), 'missing safe-area content event listener');
assert(progress.includes("scheduleSafeAreaCollisionFit(app, 'safe-progress-update')"), 'safe progress updates must refit collision');
assert(ui.includes("scheduleSafeAreaCollisionFit(app, 'clock-tick')"), 'clock updates must refit collision');
assert(css.includes('v464-safe-area-iterative-collision-fit-pass'), 'missing v464 CSS marker');
assert(css.includes('data-safe-collision-mode="hide-network"'), 'missing hide-network CSS mode');
console.log('[safe-area-iterative-collision-fit-smoke] OK');
