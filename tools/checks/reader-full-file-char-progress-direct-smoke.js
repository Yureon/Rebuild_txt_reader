const fs = require('fs');
const assert = require('assert');

const virtual = fs.readFileSync('public/scripts/rebuild/features/reader/virtual-layout.mjs', 'utf8');

assert.ok(virtual.includes('v474-reader-full-file-char-progress-direct-pass'), 'direct full-file char progress marker missing');
assert.ok(virtual.includes('const rowDocumentRatio = guarded.documentRatio'), 'viewport document ratio must use guarded manifest char value directly');
assert.ok(!virtual.includes('tightenFullFileCharProgressRatio'), 'v473 terminal 0.999 clamp helper must be removed');
assert.ok(!virtual.includes('v473-reader-full-file-char-progress-tighten-pass'), 'v473 tighten marker must be removed');
assert.ok(!virtual.includes('Math.min(ratio, 0.999)'), 'full-file progress must not use artificial 0.999 clamp');

console.log('v474-reader-full-file-char-progress-direct-smoke-pass');
