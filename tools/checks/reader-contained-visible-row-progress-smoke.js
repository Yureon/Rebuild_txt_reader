const fs = require('fs');
const assert = require('assert');

const virtual = fs.readFileSync('public/scripts/rebuild/features/reader/virtual-layout.mjs', 'utf8');

assert.ok(
  virtual.includes("v477-reader-contained-visible-row-progress-pass"),
  'contained visible row progress marker missing'
);
const start = virtual.indexOf('function resolveRenderedBodyRowInfoAtAnchor');
const end = virtual.indexOf('export function isProgrammaticSliderScrollEvent', start);
const body = virtual.slice(start, end);
assert.ok(
  body.includes('if (!contains) return;'),
  'rendered progress must not snap to nearest row outside the anchor'
);
assert.ok(
  body.includes('shouldUseRenderedBodyRowProgress'),
  'rendered DOM progress must be gated to slider-settle context'
);
assert.ok(
  !body.includes('measureCache.set'),
  'progress reads must not mutate measureCache'
);

console.log('v477-reader-contained-visible-row-progress-smoke-pass');
