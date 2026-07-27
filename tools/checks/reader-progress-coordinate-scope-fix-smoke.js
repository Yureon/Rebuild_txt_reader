const fs = require('fs');
const assert = require('assert');

const progress = fs.readFileSync('public/scripts/rebuild/features/reader/progress.mjs', 'utf8');

assert.ok(
  progress.includes('v486-reader-progress-coordinate-scope-fix-pass'),
  'progress coordinate scope fix marker missing'
);

const start = progress.indexOf('export function updateProgressFromViewport');
const end = progress.indexOf('export function snapshotProgress', start);
const body = progress.slice(start, end);

assert.ok(body.includes('const sliderProgress = resolveNavSliderProgress(app, displayAddress, localRatio);'), 'updateProgressFromViewport must define terminal-synchronized sliderProgress locally');
assert.ok(body.includes('const sliderRatio = sliderProgress.ratio;'), 'updateProgressFromViewport must define sliderRatio locally');
assert.ok(body.indexOf('const sliderRatio = sliderProgress.ratio;') < body.indexOf('app.state.lastReaderCoordinatePolicy'), 'sliderRatio must be defined before lastReaderCoordinatePolicy uses it');
assert.ok(!body.includes('silderRatio'), 'misspelled silderRatio must not exist');

console.log('v486-reader-progress-coordinate-scope-fix-smoke-pass');
