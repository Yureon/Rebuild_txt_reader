#!/usr/bin/env node
const fs = require('fs');
const assert = require('assert');
const layout = fs.readFileSync('public/scripts/rebuild/features/reader/virtual-layout.mjs', 'utf8');
const diag = fs.readFileSync('public/scripts/rebuild/features/reader/virtual-layout-diagnostics.mjs', 'utf8');
assert.ok(layout.includes('v481-reader-append-seam-scrolltop-diagnostic-pass'), 'append seam scrollTop diagnostic marker missing');
assert.ok(layout.includes('recordAppendSeamScrollTopDiagnostic'), 'append seam scrollTop diagnostic helper missing');
assert.ok(layout.includes('scrollTopBefore') && layout.includes('scrollTopAfter'), 'append seam diagnostic must capture scrollTop before/after');
assert.ok(diag.includes('lastAppendSeamScrollTopDiagnostic'), 'diagnostics must expose append seam scrollTop diagnostic');
console.log('v481-reader-append-seam-scrolltop-diagnostic-smoke-pass');
