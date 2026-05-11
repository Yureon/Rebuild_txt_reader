#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '../..');
const src = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/reader/virtual-layout-diagnostics.mjs'), 'utf8');
assert(src.includes('v453-reader-row-measure-cache-diagnostics-pass'), 'row/measure diagnostics marker missing');
assert(src.includes('buildRowMeasureCacheDiagnostics'), 'diagnostics builder missing');
assert(src.includes('measureCoverageRatio'), 'measure coverage ratio missing');
assert(src.includes('poolReuseRatio'), 'pool reuse ratio missing');
assert(src.includes('rowMeasureCacheDiagnostics'), 'snapshot must expose rowMeasureCacheDiagnostics');
console.log('v453-reader-row-measure-cache-diagnostics-smoke-pass');
