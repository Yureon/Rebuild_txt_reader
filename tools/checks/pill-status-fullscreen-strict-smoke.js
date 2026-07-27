#!/usr/bin/env node
const fs = require('fs');
function assert(cond, msg){ if(!cond){ console.error('[pill-status-fullscreen-strict-smoke] FAIL:', msg); process.exit(1); } }
const ui = fs.readFileSync('public/scripts/rebuild/features/ui.mjs','utf8');
const css = fs.readFileSync('public/styles/app.css','utf8');
assert(ui.includes('v465-pill-status-fullscreen-strict-lock-pass'), 'missing v465 strict pill marker in ui');
assert(ui.includes('pillStatusFullscreenStrictLockPass'), 'status/toast nodes must expose strict dataset');
assert(css.includes('v465-pill-status-fullscreen-strict-lock-pass'), 'missing v465 strict CSS marker');
assert(css.includes('html:fullscreen') && css.includes('html:-webkit-full-screen'), 'native fullscreen selectors missing');
assert(css.includes('html[data-viewport-fit="fullscreen"]') && css.includes('body.fullscreen-fallback'), 'viewport/pseudo fullscreen selectors missing');
assert(css.includes('height:30px!important') && css.includes('max-height:30px!important') && css.includes('line-height:18px!important'), 'status pill height/text lock missing');
console.log('[pill-status-fullscreen-strict-smoke] OK');
