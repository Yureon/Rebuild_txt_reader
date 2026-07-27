#!/usr/bin/env node
const fs = require('fs');
const assert = require('assert');
const { buildCssDuplicateSelectorAuditReport } = require('./css-duplicate-selector-report.js');
const css = fs.readFileSync('public/styles/app.css', 'utf8');
assert.ok(css.includes('v489-safe-area-css-ownership-budget-pass'), 'safe-area CSS ownership marker missing');
assert.ok(css.includes('#safe-area-\\000062ar') || css.includes('#safe-area-\000062ar'), 'escaped safe-area ID selector missing');
const report = buildCssDuplicateSelectorAuditReport(css);
const safe = report.entries.find(entry => entry.selector === '#safe-area-bar');
assert.ok(safe, 'safe-area duplicate entry missing');
assert.ok(safe.count <= 80, `#safe-area-bar duplicate count must be <= 80, got ${safe.count}`);
console.log('v489-safe-area-css-ownership-budget-smoke-pass');
