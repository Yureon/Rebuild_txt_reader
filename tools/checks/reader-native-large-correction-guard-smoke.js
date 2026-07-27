#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const src = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/reader/virtual-layout.mjs'), 'utf8');
const PASS = 'v565-reader-native-large-correction-guard-smoke-pass';
assert.ok(src.includes("READER_NATIVE_LARGE_CORRECTION_GUARD_PASS = 'v565-reader-native-large-correction-guard-pass'"), 'large correction guard marker missing');
assert.ok(src.includes("anchorType === 'measure' || anchorType === 'render-window'"), 'guard must be limited to delayed measure/render corrections');
assert.ok(src.includes('activeUntil + VIRTUAL_NATIVE_LARGE_CORRECTION_SETTLE_MS'), 'native scroll settle window missing');
assert.ok(src.includes('absDeltaPx > thresholdPx'), 'large correction threshold missing');
assert.ok(src.includes('suppressedBy: READER_NATIVE_LARGE_CORRECTION_GUARD_PASS'), 'guard result must identify suppression source');
assert.ok(src.indexOf('resolveNativeLargeCorrectionGuard') < src.indexOf('return applyVirtualScrollAnchor({ reader, rows: v.rows, prefix: v.prefix, anchor });'), 'guard must run before scrollTop correction');
console.log(JSON.stringify({ pass: PASS }));
