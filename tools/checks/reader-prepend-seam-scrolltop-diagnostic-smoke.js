const fs = require('fs');
const assert = require('assert');

const virtual = fs.readFileSync('public/scripts/rebuild/features/reader/virtual-layout.mjs', 'utf8');
const diag = fs.readFileSync('public/scripts/rebuild/features/reader/virtual-layout-diagnostics.mjs', 'utf8');

assert.ok(virtual.includes('v487-reader-prepend-seam-scrolltop-diagnostic-pass'), 'prepend scrollTop diagnostic marker missing');
assert.ok(virtual.includes('function recordPrependSeamScrollTopDiagnostic'), 'prepend scrollTop diagnostic recorder missing');
assert.ok(virtual.includes('recordPrependSeamScrollTopDiagnostic(v, {'), 'prepend restore must record scrollTop diagnostic');
assert.ok(virtual.includes('scrollTopBefore') && virtual.includes('scrollTopAfter') && virtual.includes('deltaPx'), 'prepend diagnostic must record scrollTop before/after/delta');
assert.ok(diag.includes('lastPrependSeamScrollTopDiagnostic'), 'prepend diagnostic must be exported in virtual diagnostics');

console.log('v487-reader-prepend-seam-scrolltop-diagnostic-smoke-pass');
