#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PASS = 'v481-reader-append-native-upward-retain-smoke-pass';
const root = path.resolve(__dirname, '..', '..');
const layout = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/reader/virtual-layout.mjs'), 'utf8');

assert.ok(layout.includes("v481-reader-append-native-upward-retain-pass"), 'native upward retain marker missing');
assert.ok(layout.includes('recent forward scroll-buffer append suppresses upward anchor correction after chunk attach'), 'native forward upward suppress reason missing');
assert.ok(layout.includes('const nativeForwardRetain = !!(nativeScrollSource && (active || activeWindow || recentNativeSettle))'), 'upward retain must require native forward retain window');
assert.ok(layout.includes('recentForwardBufferAppend && upward && nativeForwardRetain'), 'upward guard must suppress native forward append upward deltas');
assert.ok(layout.includes('append seam correction exception disabled for upward correction'), 'legacy seam upward correction allowance must be disabled by v522 cleanup');
assert.ok(layout.includes("READER_MULTI_FILE_GUARD_CLEANUP_PASS = 'v522-reader-multi-file-guard-cleanup-pass'"), 'v522 cleanup marker missing');
console.log(PASS);
