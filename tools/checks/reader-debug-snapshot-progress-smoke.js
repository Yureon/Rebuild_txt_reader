const fs = require('fs');
const assert = require('assert');

const diag = fs.readFileSync('public/scripts/rebuild/features/reader/virtual-layout-diagnostics.mjs', 'utf8');
const recovery = fs.readFileSync('public/scripts/rebuild/features/recovery/snapshot-export.mjs', 'utf8');
const report = fs.readFileSync('public/scripts/rebuild/features/devtools/report.mjs', 'utf8');

assert.ok(diag.includes('v487-reader-debug-snapshot-progress-pass'), 'virtual diagnostics progress marker missing');
assert.ok(diag.includes('lastReaderSliderProgressDiagnostic'), 'slider progress diagnostic must be included in virtual diagnostics');
assert.ok(diag.includes('lastReaderCoordinatePolicy'), 'coordinate policy must be included in virtual diagnostics');
assert.ok(diag.includes('lastSafeAreaMultiFileProgress'), 'safe-area multi-file progress must be included in virtual diagnostics');
assert.ok(diag.includes('lastAppendSeamProgressDiagnostic'), 'append seam progress diagnostic must be included in virtual diagnostics');
assert.ok(diag.includes('lastNativeForwardMeasureFreeze') && diag.includes('lastNativeBackwardMeasureFreeze'), 'measure freeze diagnostics must be exposed');
assert.ok(recovery.includes('v487-reader-recovery-progress-diagnostics-pass'), 'recovery snapshot progress marker missing');
assert.ok(recovery.includes('readerProgressDiagnostics: buildReaderProgressDiagnostics(app)'), 'recovery snapshot must include reader progress diagnostics');
assert.ok(report.includes('sliderProgress') && report.includes('appendScrollTop') && report.includes('prependScrollTop'), 'devtools report must surface reader progress/scrollTop diagnostics');

console.log('v487-reader-debug-snapshot-progress-smoke-pass');
