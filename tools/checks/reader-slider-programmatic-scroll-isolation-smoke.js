const fs = require('fs');
const assert = require('assert');

const reader = fs.readFileSync('public/scripts/rebuild/features/reader.mjs', 'utf8');
const virtual = fs.readFileSync('public/scripts/rebuild/features/reader/virtual-layout.mjs', 'utf8');

assert.ok(
  virtual.includes("v477-reader-slider-programmatic-scroll-isolation-pass"),
  'programmatic slider scroll isolation marker missing'
);
assert.ok(
  reader.includes('isProgrammaticSliderScrollEvent(app)'),
  'reader scroll handler must consume programmatic slider scroll events'
);
assert.ok(
  virtual.includes('sliderProgrammaticScrollUntil') && virtual.includes('sliderProgrammaticScrollTop'),
  'virtual state must track programmatic slider scroll window'
);
assert.ok(
  reader.indexOf('isProgrammaticSliderScrollEvent(app)') < reader.indexOf("markVirtualScrollActivity(app, { source: 'scroll' })"),
  'programmatic slider scroll must be isolated before native scroll activity is marked'
);

console.log('v477-reader-slider-programmatic-scroll-isolation-smoke-pass');
