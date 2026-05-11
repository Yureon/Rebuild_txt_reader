#!/usr/bin/env node
const fs = require('fs');
function assert(cond, msg){ if(!cond){ console.error('[pill-toast-fullscreen-height-smoke] FAIL:', msg); process.exit(1); } }
const ui = fs.readFileSync('public/scripts/rebuild/features/ui.mjs','utf8');
const css = fs.readFileSync('public/styles/app.css','utf8');
assert(ui.includes('v464-pill-toast-fullscreen-height-lock-pass'), 'missing v464 pill/toast marker in ui');
assert(ui.includes('pillToastCompactPass'), 'toast/status nodes must expose compact dataset');
assert(css.includes('v464-pill-toast-fullscreen-height-lock-pass'), 'missing v464 CSS marker');
assert(css.includes('#toast-wrap .toast') && css.includes('max-height:34px!important'), 'toast height lock missing');
assert(css.includes('#ui-status-dock .ui-status-pill') && css.includes('max-height:30px!important'), 'status pill height lock missing');
assert(css.includes('html[data-viewport-fit="fullscreen"]') && css.includes('body.fullscreen-fallback'), 'fullscreen/pseudo fullscreen selectors missing');
console.log('[pill-toast-fullscreen-height-smoke] OK');
