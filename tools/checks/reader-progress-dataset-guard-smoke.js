#!/usr/bin/env node
const fs = require('fs');
const assert = require('assert');
const progress = fs.readFileSync('public/scripts/rebuild/features/reader/progress.mjs', 'utf8');
assert.ok(progress.includes('v489-reader-progress-dataset-guard-pass'), 'dataset guard marker missing');
assert.ok(progress.includes('if (app.els.navInfo.dataset)'), 'navInfo dataset write must be guarded');
assert.ok(progress.includes('if (app.els.navSlider.dataset)'), 'navSlider dataset writes must be guarded');
console.log('v489-reader-progress-dataset-guard-smoke-pass');
