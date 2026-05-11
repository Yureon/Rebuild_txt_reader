#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const reader = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/reader.mjs'), 'utf8');
const runner = fs.readFileSync(path.join(root, 'tools/run_smoke_tests.js'), 'utf8');

assert.ok(reader.includes("READER_NAV_SLIDER_IN_WINDOW_JUMP_PASS = 'v520-reader-nav-slider-in-window-jump-pass'"), 'v520 nav slider in-window marker missing');
assert.ok(reader.includes('const rowsReady = loaded && hasVirtualChunkRows(app, targetChunk)'), 'nav slider must verify target chunk rows before direct in-window jump');
assert.ok(reader.includes("if (source === 'nav-slider' && rowsReady)"), 'nav slider in-window branch missing');
assert.ok(reader.includes('v.navSliderInWindowJumpPass = READER_NAV_SLIDER_IN_WINDOW_JUMP_PASS'), 'nav slider in-window diagnostic missing');
assert.ok(reader.includes("scrollToVirtualTarget(app, { ...targetAddress, chunk: targetChunk, source })"), 'loaded nav slider target must scroll directly instead of replace-loading');
assert.ok(reader.includes('avoiding replace-load guards resetting to the first block'), 'nav slider in-window reason missing');
assert.ok(runner.includes('reader-nav-slider-in-window-jump-smoke.js'), 'reader smoke runner must include v520 nav slider in-window smoke');

console.log('v520-reader-nav-slider-in-window-jump-smoke-pass');
