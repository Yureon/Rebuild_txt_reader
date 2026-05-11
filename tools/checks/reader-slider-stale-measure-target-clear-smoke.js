const fs = require('fs');
const assert = require('assert');

const reader = fs.readFileSync('public/scripts/rebuild/features/reader.mjs', 'utf8');
const virtual = fs.readFileSync('public/scripts/rebuild/features/reader/virtual-layout.mjs', 'utf8');

assert.ok(virtual.includes('v479-reader-slider-stale-measure-target-clear-pass'), 'stale slider pending clear marker missing');
assert.ok(virtual.includes('export function clearPendingSliderMeasureTarget'), 'clearPendingSliderMeasureTarget export missing');
assert.ok(virtual.includes("phase: 'measure-noop'") && virtual.includes('measure produced no changed row heights'), 'measure-noop must clear stale slider target');
assert.ok(reader.includes('clearPendingSliderMeasureTarget(app') && reader.includes("phase: 'viewport-transition'"), 'reader viewport transitions must clear stale slider target');
assert.ok(reader.includes("'fullscreenchange'") && reader.includes("'webkitfullscreenchange'") && reader.includes('visualViewport'), 'fullscreen/visualViewport transitions must be covered');
assert.ok(!virtual.includes("String(state?.lastUserScrollSource || '') === 'programmatic-slider'"), 'rendered-row progress must not depend on stale lastUserScrollSource');

console.log('v479-reader-slider-stale-measure-target-clear-smoke-pass');
