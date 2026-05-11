const fs = require('fs');
const assert = require('assert');

const reader = fs.readFileSync('public/scripts/rebuild/features/reader.mjs', 'utf8');
const css = fs.readFileSync('public/styles/app.css', 'utf8');

assert.ok(
  reader.includes('v473-reader-prev-boundary-top-indicator-pass'),
  'prev top indicator marker missing'
);

assert.ok(
  css.includes('[data-direction="prev"]') && css.includes('top:'),
  'prev pull indicator must have top placement'
);

console.log('v473-reader-prev-boundary-top-indicator-smoke-pass');
