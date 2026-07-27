const fs = require('fs');
const assert = require('assert');
const reader = fs.readFileSync('public/scripts/rebuild/features/reader.mjs', 'utf8');
const css = fs.readFileSync('public/styles/app.css', 'utf8');
assert.ok(reader.includes("READER_EPISODE_BOUNDARY_PULL_CONFIRM_PASS = 'v471-reader-episode-boundary-pull-confirm-pass'"), 'reader boundary pull confirm marker missing');
assert.ok(reader.includes('episode-boundary-pull-indicator'), 'boundary pull indicator DOM missing');
assert.ok(css.includes('#episode-boundary-pull-indicator[data-boundary-pull-pass="v471-reader-episode-boundary-pull-confirm-pass"]'), 'boundary pull indicator css missing');
console.log('v471-reader-boundary-pull-smoke-pass');
