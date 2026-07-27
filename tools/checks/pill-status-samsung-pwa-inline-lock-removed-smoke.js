const fs = require('fs');
const assert = require('assert');

const ui = fs.readFileSync('public/scripts/rebuild/features/ui.mjs', 'utf8');
const css = fs.readFileSync('public/styles/app.css', 'utf8');

assert.ok(!ui.includes('applyStatusPillInlineHeightLock'), 'Samsung PWA inline status pill lock helper must be removed');
assert.ok(!ui.includes('pillStatusSamsungPwaInlineLockPass'), 'Samsung PWA inline lock dataset must be removed');
assert.ok(!ui.includes('v473-pill-status-samsung-pwa-inline-lock-pass'), 'Samsung PWA inline lock marker must be removed from ui');
assert.ok(!css.includes('pill-status-samsung-pwa-inline-lock-pass'), 'Samsung PWA inline lock CSS selector must be removed');

console.log('v474-pill-status-samsung-pwa-inline-lock-removed-smoke-pass');
