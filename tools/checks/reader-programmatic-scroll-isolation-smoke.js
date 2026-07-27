const fs = require('fs');
const assert = require('assert');

const reader = fs.readFileSync('public/scripts/rebuild/features/reader.mjs', 'utf8');
const virtual = fs.readFileSync('public/scripts/rebuild/features/reader/virtual-layout.mjs', 'utf8');

assert.ok(virtual.includes('v479-reader-programmatic-scroll-isolation-pass'), 'programmatic reader scroll isolation marker missing');
assert.ok(virtual.includes('export function markProgrammaticReaderScroll'), 'markProgrammaticReaderScroll export missing');
assert.ok(virtual.includes('export function isProgrammaticReaderScrollEvent'), 'isProgrammaticReaderScrollEvent export missing');
assert.ok(reader.includes('isProgrammaticSliderScrollEvent(app) || isProgrammaticReaderScrollEvent(app)'), 'reader scroll handler must isolate generic programmatic scrolls');
assert.ok(reader.includes("markProgrammaticReaderScroll(app, { source: 'tap-animation'") || reader.includes('markProgrammaticReaderScroll(app, { source, durationMs'), 'tap/page scrolls must be marked programmatic');
assert.ok(reader.includes('scrollSideEffects.schedule();'), 'native scroll side effects must remain for real user scrolls');

console.log('v479-reader-programmatic-scroll-isolation-smoke-pass');
