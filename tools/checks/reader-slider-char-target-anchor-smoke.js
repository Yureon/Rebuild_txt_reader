const fs = require('fs');
const assert = require('assert');

const reader = fs.readFileSync('public/scripts/rebuild/features/reader.mjs', 'utf8');
const virtual = fs.readFileSync('public/scripts/rebuild/features/reader/virtual-layout.mjs', 'utf8');

assert.ok(
  reader.includes('v474-reader-slider-nearest-char-anchor-pass'),
  'reader slider char marker missing'
);

assert.ok(
  reader.includes("charAnchor: source === 'nav-slider'") || reader.includes('charAnchor'),
  'nav slider target must mark charAnchor'
);

const start = virtual.indexOf('function resolveVirtualAddress');
const end = virtual.indexOf('function estimateInRowOffset', start);
const body = virtual.slice(start, end);

assert.ok(
  body.includes('const charAnchorTarget') && body.includes('resolveNearestBodyRowByChar'),
  'resolveVirtualAddress must define charAnchorTarget'
);

assert.ok(
  body.indexOf('const charAnchorTarget') < body.indexOf('target.globalBlockIndex != null'),
  'char anchor must be resolved before global block fallback inside resolveVirtualAddress'
);

console.log('v474-reader-slider-nearest-char-anchor-smoke-pass');
