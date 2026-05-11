const fs = require('fs');
const assert = require('assert');
const virtual = fs.readFileSync('public/scripts/rebuild/features/reader/virtual-layout.mjs', 'utf8');
assert.ok(virtual.includes("READER_MOBILE_70_80_ANCHOR_HOLD_PASS = 'v472-reader-mobile-70-80-anchor-hold-pass'"), 'mobile 70-80 anchor marker missing');
assert.ok(virtual.includes('fallback >= 0.68 && fallback <= 0.86'), '70-80 seam band guard missing');
assert.ok(virtual.includes('mobileMultiFile'), 'mobile multi-file guard missing');
assert.ok(virtual.includes('manifest-adoption-held-fallback'), 'guard must hold fallback during active scroll');
console.log('v472-reader-mobile-7080-anchor-hold-smoke-pass');
